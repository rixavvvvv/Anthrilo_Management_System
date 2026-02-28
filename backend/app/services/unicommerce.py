"""Unicommerce integration service.

Handles fetching and processing sale orders via the Unicommerce API.
Uses the export job API exclusively for bulk CSV downloads.
"""

import csv
import re
import io
import time as time_module
import httpx
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set
from app.core.token_manager import get_token_manager

logger = logging.getLogger(__name__)

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))


class UnicommerceService:
    """Fetches and aggregates Unicommerce sale orders."""

    CACHE_TTL_SECONDS = 900  # 15 min

    EXCLUDED_STATUSES = {
        "CANCELLED", "CANCELED", "RETURNED", "REFUNDED",
        "FAILED", "UNFULFILLABLE", "ERROR", "PENDING_VERIFICATION"
    }

    # Item categories to exclude from sales data (faulty/non-product entries)
    EXCLUDED_CATEGORIES = {"FABRIC"}

    EXPORT_MAX_POLL_SECONDS = 300
    EXPORT_INITIAL_POLL_INTERVAL = 2
    EXPORT_MAX_POLL_INTERVAL = 10     # Max poll interval (backoff cap)
    EXPORT_POLL_BACKOFF = 1.5         # Polling backoff multiplier

    # Columns for the export job (note: UC spells it "exportColums")
    EXPORT_COLUMNS = [
        "saleOrderCode",
        "channel",
        "status",
        "created",
        "updated",
        "shippingMethod",
        "cod",              # 1 = COD, 0 = Prepaid
        "soicode",
        "skuCode",
        "sellingPrice",
        "maxRetailPrice",
        "discount",
        "totalPrice",
        "channelProductId",
        "itemDetails",
        "category",
    ]

    def __init__(self):
        self.token_manager = get_token_manager()
        self.access_code = self.token_manager.access_code
        self.tenant = self.token_manager.tenant
        self.base_url = f"https://{self.tenant}.unicommerce.com/services/rest/v1"

        # HTTP client settings
        self.timeout = httpx.Timeout(60.0, connect=10.0)
        self.limits = httpx.Limits(
            max_connections=150,
            max_keepalive_connections=50
        )

        # In-memory cache
        self._cache: Dict[str, Tuple[datetime, Any]] = {}

        logger.info(
            f"UnicommerceService v3 initialized | "
            f"Tenant: {self.tenant} | "
            f"Method: Export Job API only | "
            f"Cache TTL: {self.CACHE_TTL_SECONDS}s"
        )


    async def _get_headers(self) -> Dict[str, str]:
        """Build auth headers."""
        return await self.token_manager.get_headers()


    def _get_cache_key(self, period: str) -> str:
        return f"sales_data_{period}"

    def _get_from_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            timestamp, data = self._cache[key]
            age = (datetime.now() - timestamp).total_seconds()
            if age < self.CACHE_TTL_SECONDS:
                logger.debug(
                    f"Cache hit for {key} (age: {age:.1f}s / {self.CACHE_TTL_SECONDS}s)")
                return data
            else:
                del self._cache[key]
        return None

    def _set_cache(self, key: str, data: Any):
        self._cache[key] = (datetime.now(), data)


    async def _create_export_job(
        self, from_date: datetime, to_date: datetime
    ) -> Optional[str]:
        """
        Create a Unicommerce export job for Sale Orders.
        Returns the jobCode on success, None on failure.
        """
        url = f"{self.base_url}/export/job/create"

        # Convert dates to epoch milliseconds for the filter
        start_ms = int(from_date.timestamp() * 1000)
        end_ms = int(to_date.timestamp() * 1000)

        payload = {
            "exportJobTypeName": "Sale Orders",
            "frequency": "ONETIME",
            "exportColums": self.EXPORT_COLUMNS,
            "exportFilters": [
                {
                    "id": "addedOn",
                    "dateRange": {
                        "start": start_ms,
                        "end": end_ms,
                    },
                }
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                headers = await self._get_headers()
                headers["Facility"] = "anthrilo"

                response = await client.post(url, json=payload, headers=headers)

                # Handle 401 - token refresh
                if response.status_code == 401:
                    self.token_manager.invalidate_token()
                    await self.token_manager.get_valid_token()
                    headers = await self._get_headers()
                    headers["Facility"] = "anthrilo"
                    response = await client.post(url, json=payload, headers=headers)

                # Log error response body for debugging
                if response.status_code >= 400:
                    try:
                        error_body = response.json()
                    except Exception:
                        error_body = response.text[:500]
                    logger.error(
                        f"Export: Job creation HTTP {response.status_code}: {error_body}"
                    )
                    return None

                data = response.json()

                if data.get("successful"):
                    job_code = data.get("jobCode")
                    logger.info(f"Export: Job created successfully {job_code}")
                    return job_code
                else:
                    errors = data.get("errors", [])
                    msg = data.get("message", "Unknown error")
                    logger.error(f"Export: Job creation failed: {msg} | errors={errors}")
                    return None

        except Exception as e:
            logger.error(f"Export: Job creation exception: {e}", exc_info=True)
            return None

    async def _poll_export_status(
        self, job_code: str, max_wait: int = None
    ) -> Optional[str]:
        """Poll export job until complete; return download URL or None."""
        if max_wait is None:
            max_wait = self.EXPORT_MAX_POLL_SECONDS

        url = f"{self.base_url}/export/job/status"
        payload = {"jobCode": job_code}

        start_time = time_module.time()
        poll_interval = self.EXPORT_INITIAL_POLL_INTERVAL

        try:
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                while (time_module.time() - start_time) < max_wait:
                    headers = await self._get_headers()
                    headers["Facility"] = "anthrilo"

                    response = await client.post(url, json=payload, headers=headers)

                    if response.status_code == 401:
                        self.token_manager.invalidate_token()
                        await self.token_manager.get_valid_token()
                        headers = await self._get_headers()
                        headers["Facility"] = "anthrilo"
                        response = await client.post(url, json=payload, headers=headers)

                    response.raise_for_status()
                    data = response.json()

                    if data.get("successful"):
                        # UC export status: top-level fields (not nested)
                        status = data.get("status", "")
                        file_path = data.get("filePath", "")

                        elapsed = time_module.time() - start_time

                        if status == "COMPLETE":
                            logger.info(
                                f"Export: Job {job_code} COMPLETE in {elapsed:.1f}s {file_path}"
                            )
                            return file_path
                        elif status in ("FAILED", "CANCELLED"):
                            logger.error(
                                f"Export: Job {job_code} {status} after {elapsed:.1f}s"
                            )
                            return None
                        else:
                            logger.debug(
                                f"Export: Job {job_code} status={status}, "
                                f"elapsed={elapsed:.1f}s, next poll in {poll_interval:.1f}s"
                            )
                    else:
                        logger.warning(
                            f"Export: Status check not successful: {data.get('message', '')}"
                        )

                    await asyncio.sleep(poll_interval)
                    poll_interval = min(
                        poll_interval * self.EXPORT_POLL_BACKOFF,
                        self.EXPORT_MAX_POLL_INTERVAL,
                    )

        except Exception as e:
            logger.error(f"Export: Polling exception: {e}", exc_info=True)
            return None

        elapsed = time_module.time() - start_time
        logger.error(f"Export: Job {job_code} timed out after {elapsed:.0f}s")
        return None

    async def _download_parse_export(self, download_url: str) -> List[Dict]:
        """Download export CSV and group rows by order code into order dicts."""
        try:
            download_timeout = httpx.Timeout(120.0, connect=15.0)

            async with httpx.AsyncClient(timeout=download_timeout) as client:
                # CloudFront pre-signed URL â€” no auth needed
                response = await client.get(download_url)

                if response.status_code in (401, 403):
                    headers = await self._get_headers()
                    response = await client.get(download_url, headers=headers)

                response.raise_for_status()
                csv_text = response.text

            if not csv_text or not csv_text.strip():
                logger.warning("Export: Downloaded CSV is empty")
                return []

            reader = csv.DictReader(io.StringIO(csv_text))
            fieldnames = reader.fieldnames or []
            logger.info(f"Export: CSV columns ({len(fieldnames)}): {fieldnames}")

            # Group rows by order code nested order structure
            orders_map: Dict[str, Dict] = {}
            row_count = 0
            fabric_skipped = 0

            for row in reader:
                row_count += 1

                # Skip items with excluded categories (e.g. FABRIC)
                item_category = (
                    row.get("Category")
                    or row.get("category")
                    or row.get("Item Type Category")
                    or row.get("categoryCode")
                    or ""
                ).strip().upper()
                if item_category in self.EXCLUDED_CATEGORIES:
                    fabric_skipped += 1
                    continue

                # Order code
                order_code = (
                    row.get("Sale Order Code")
                    or row.get("saleOrderCode")
                    or row.get("code")
                    or ""
                ).strip()
                if not order_code:
                    continue

                if order_code not in orders_map:
                    # Channel name: normalize spaces underscores for consistency
                    channel_raw = (
                        row.get("Channel Name")
                        or row.get("channel")
                        or "UNKNOWN"
                    ).strip()
                    channel = channel_raw.replace(" ", "_")

                    # COD: "1" = COD, "0" = Prepaid
                    cod_raw = (
                        row.get("COD")
                        or row.get("cod")
                        or "0"
                    ).strip()
                    is_cod = cod_raw in ("1", "true", "True", "yes")

                    orders_map[order_code] = {
                        "code": order_code,
                        "displayOrderCode": order_code,
                        "channel": channel,
                        "status": (
                            row.get("Sale Order Status")
                            or row.get("status")
                            or ""
                        ).strip(),
                        "created": (
                            row.get("Created")
                            or row.get("created")
                            or ""
                        ).strip(),
                        "updated": (
                            row.get("Updated")
                            or row.get("updated")
                            or ""
                        ).strip(),
                        "cod": is_cod,
                        "cashOnDelivery": is_cod,
                        "shippingMethod": (
                            row.get("Shipping Method")
                            or row.get("shippingMethod")
                            or ""
                        ).strip(),
                        "collectableAmount": 0.0,
                        "saleOrderItems": [],
                    }

                # Parse item fields â€” each CSV row = 1 unit
                try:
                    selling_price = float(
                        row.get("Selling Price")
                        or row.get("sellingPrice")
                        or 0
                    )
                except (ValueError, TypeError):
                    selling_price = 0.0

                try:
                    mrp = float(
                        row.get("MRP")
                        or row.get("maxRetailPrice")
                        or 0
                    )
                except (ValueError, TypeError):
                    mrp = 0.0

                try:
                    discount = float(
                        row.get("Discount")
                        or row.get("discount")
                        or 0
                    )
                except (ValueError, TypeError):
                    discount = 0.0

                sku_code = (
                    row.get("Item SKU Code")
                    or row.get("skuCode")
                    or row.get("itemSku")
                    or ""
                ).strip()

                item_details = (
                    row.get("Item Details")
                    or row.get("itemDetails")
                    or ""
                ).strip()

                item_code = (
                    row.get("Sale Order Item Code")
                    or row.get("soicode")
                    or ""
                ).strip()

                item = {
                    "code": item_code,
                    "itemSku": sku_code,
                    "itemName": item_details or sku_code,
                    "sellingPrice": selling_price,
                    "maxRetailPrice": mrp,
                    "quantity": 1,  # Each CSV row = 1 unit
                    "discount": discount,
                }

                orders_map[order_code]["saleOrderItems"].append(item)

            # Remove orders with 0 items after filtering
            orders = [o for o in orders_map.values() if o["saleOrderItems"]]
            total_items = sum(len(o["saleOrderItems"]) for o in orders)

            if fabric_skipped:
                logger.info(
                    f"Export: Excluded {fabric_skipped} FABRIC category rows"
                )
            logger.info(
                f"Export: Parsed {row_count} CSV rows "
                f"{len(orders)} orders, {total_items} items"
            )
            return orders

        except Exception as e:
            logger.error(f"Export: Download/parse failed: {e}", exc_info=True)
            return []

    async def fetch_orders_via_export(
        self, from_date: datetime, to_date: datetime
    ) -> Dict[str, Any]:
        """Fetch orders via export job API (only method used)."""
        start_time = time_module.time()
        logger.info("Starting export job fetch")
        logger.info(f"  Range: {from_date.isoformat()} {to_date.isoformat()}")

        try:
            # Step 1: Create export job
            job_code = await self._create_export_job(from_date, to_date)
            create_time = time_module.time() - start_time

            if not job_code:
                logger.error("Export: Job creation failed")
                return {
                    "successful": False,
                    "error": "Export job creation failed",
                    "orders": [],
                    "totalRecords": 0,
                }

            logger.info(f"  Step 1 done in {create_time:.1f}s job={job_code}")

            # Step 2: Poll until complete
            download_url = await self._poll_export_status(job_code)
            poll_time = time_module.time() - start_time - create_time

            if not download_url:
                logger.error("Export: Job failed or timed out")
                return {
                    "successful": False,
                    "error": "Export job timed out or failed",
                    "orders": [],
                    "totalRecords": 0,
                }

            logger.info(f"  Step 2 done in {poll_time:.1f}s file ready")

            # Step 3: Download and parse CSV
            orders = await self._download_parse_export(download_url)
            download_time = time_module.time() - start_time - create_time - poll_time
            total_time = time_module.time() - start_time

            if not orders and total_time < 10:
                logger.warning(
                    "Export: No orders returned (possibly empty range or column mismatch)"
                )

            logger.info(
                f"  Step 3 done in {download_time:.1f}s {len(orders)} orders"
            )
            logger.info(
                f"Export done: {len(orders)} orders in {total_time:.1f}s total"
            )

            return {
                "successful": True,
                "orders": orders,
                "totalRecords": len(orders),
                "phase1_time": round(create_time + poll_time, 2),
                "phase2_time": round(download_time, 2),
                "total_time": round(total_time, 2),
                "method": "export_job",
                "failed_codes": [],
                "retry_recovered": 0,
                "phase1_dedup": 0,
                "phase2_dedup": 0,
            }

        except Exception as e:
            total_time = time_module.time() - start_time
            logger.error(
                f"Export: Failed after {total_time:.1f}s: {e}", exc_info=True
            )
            return {
                "successful": False,
                "error": f"Export failed: {str(e)}",
                "orders": [],
                "totalRecords": 0,
            }

    # Date range helpers

    def get_today_range(self) -> Tuple[datetime, datetime]:
        """Get today's date range in UTC (IST 00:00:00 to current time - 1 min)"""
        now_ist = datetime.now(IST)
        start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        end_ist = now_ist - timedelta(minutes=1)
        return start_ist.astimezone(timezone.utc), end_ist.astimezone(timezone.utc)

    def get_yesterday_range(self) -> Tuple[datetime, datetime]:
        """Get yesterday's date range in UTC (IST 00:00:00 to 23:59:59)"""
        now_ist = datetime.now(IST)
        yesterday_ist = now_ist - timedelta(days=1)
        start_ist = yesterday_ist.replace(
            hour=0, minute=0, second=0, microsecond=0)
        end_ist = yesterday_ist.replace(
            hour=23, minute=59, second=59, microsecond=0)
        return start_ist.astimezone(timezone.utc), end_ist.astimezone(timezone.utc)

    def get_last_n_days_range(self, days: int) -> Tuple[datetime, datetime]:
        """Get last N complete days (not including today)."""
        now_ist = datetime.now(IST)
        yesterday_ist = now_ist - timedelta(days=1)
        start_ist = now_ist - timedelta(days=days)
        start = start_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday_ist.replace(
            hour=23, minute=59, second=59, microsecond=0)
        return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


    async def fetch_all_orders_with_revenue(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        Fetch all orders with revenue data using Export Job API.

        Uses Export Job API exclusively (~3 API calls, any volume).
        Items with category FABRIC are excluded during CSV parsing.

        Returns dict with:
            successful, orders, totalRecords, phase1_time, phase2_time,
            total_time, failed_codes, retry_recovered, method, etc.
        """
        return await self.fetch_orders_via_export(from_date, to_date)

    # Revenue helpers

    @staticmethod
    def _extract_date_key(created_raw) -> Optional[str]:
        """Extract a YYYY-MM-DD date key from epoch ms, ISO string, or date string."""
        if created_raw is None or created_raw == "":
            return None

        val = str(created_raw).strip()
        if not val:
            return None

        # Check if it's a purely numeric value epoch ms or epoch seconds
        try:
            numeric = float(val)
            # Epoch milliseconds (>= 1e12) vs seconds (< 1e12)
            if numeric > 1e12:
                numeric = numeric / 1000.0
            dt = datetime.fromtimestamp(numeric, tz=IST)
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError, OverflowError, OSError):
            pass

        # Already a proper YYYY-MM-DD or YYYY-MM-DD ... string
        if len(val) >= 10 and val[4] == "-" and val[7] == "-":
            return val[:10]

        # Try common datetime parsing as fallback
        for fmt in ("%d %b %Y %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
            try:
                dt = datetime.strptime(val, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        logger.debug(f"Could not parse created date: {val!r}")
        return None

    def calculate_order_revenue(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate revenue for a single order from sellingPrice, excluding cancelled/returned.
        """
        def safe_float(value, default=0.0) -> float:
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        order_code = order.get("code", "UNKNOWN")
        status = (order.get("status") or "").upper()
        channel = order.get("channel", "UNKNOWN")
        created = order.get("created") or order.get("displayOrderDateTime")
        items = order.get("saleOrderItems", [])

        total_selling_price = 0.0
        total_discount = 0.0
        total_tax = 0.0
        total_refund = 0.0
        item_count = len(items)
        # Get pre-calculated quantity, or compute from items
        total_quantity = order.get("totalQuantity", 0)
        if total_quantity == 0 and items:
            total_quantity = sum(
                int(safe_float(item.get("quantity", 1)) or 1)
                for item in items
            )

        for item in items:
            selling_price = safe_float(item.get("sellingPrice", 0))
            quantity = safe_float(item.get("quantity", 1))
            item_revenue = selling_price * quantity
            total_selling_price += item_revenue

            # Multiply by quantity for per-item values
            total_discount += safe_float(item.get("discount", 0)) * quantity
            total_tax += safe_float(item.get("taxAmount", 0)) * quantity
            total_refund += safe_float(item.get("refundAmount", 0)) * quantity

        include_in_revenue = status not in self.EXCLUDED_STATUSES
        excluded_reason = f"Status: {status}" if not include_in_revenue else None

        net_revenue = 0.0
        if include_in_revenue:
            net_revenue = total_selling_price - total_refund

        return {
            "order_code": order_code,
            "status": status,
            "channel": channel,
            "created": created,
            "selling_price": round(total_selling_price, 2),
            "discount": round(total_discount, 2),
            "tax": round(total_tax, 2),
            "refund": round(total_refund, 2),
            "net_revenue": round(net_revenue, 2),
            "include_in_revenue": include_in_revenue,
            "excluded_reason": excluded_reason,
            "item_count": item_count,
            "quantity": total_quantity,
        }

    # Aggregation with reconciliation
    def aggregate_orders(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate orders into summary statistics with channel reconciliation.
        """
        total_orders = len(orders)
        valid_orders = 0
        excluded_orders = 0

        total_revenue = 0.0
        total_discount = 0.0
        total_tax = 0.0
        total_refund = 0.0
        total_items = 0

        channel_stats: Dict[str, Dict[str, Any]] = {}
        status_stats: Dict[str, int] = {}
        daily_stats: Dict[str, Dict[str, Any]] = {}  # day-level aggregation

        # Single-pass aggregation
        for order in orders:
            calc = self.calculate_order_revenue(order)

            status = calc["status"]
            status_stats[status] = status_stats.get(status, 0) + 1

            total_discount += calc["discount"]
            total_tax += calc["tax"]
            total_refund += calc["refund"]

            if calc["include_in_revenue"]:
                valid_orders += 1
                total_revenue += calc["net_revenue"]
                total_items += calc.get("quantity", 0)  # Only count valid orders' items

                channel = calc["channel"]
                if channel not in channel_stats:
                    # Initialize channel stats with orders, revenue, and items
                    channel_stats[channel] = {
                        "orders": 0, "revenue": 0.0, "items": 0}
                channel_stats[channel]["orders"] += 1
                channel_stats[channel]["revenue"] += calc["net_revenue"]
                # Track items per channel
                channel_stats[channel]["items"] += calc.get("quantity", 0)

                # Daily breakdown (YYYY-MM-DD)
                day_key = self._extract_date_key(calc.get("created"))
                if day_key:
                    if day_key not in daily_stats:
                        daily_stats[day_key] = {
                            "date": day_key, "orders": 0, "revenue": 0.0, "items": 0}
                    daily_stats[day_key]["orders"] += 1
                    daily_stats[day_key]["revenue"] += calc["net_revenue"]
                    daily_stats[day_key]["items"] += calc.get("quantity", 0)
            else:
                excluded_orders += 1

        channel_total = sum(ch["revenue"] for ch in channel_stats.values())
        reconciliation_passed = abs(channel_total - total_revenue) < 0.01

        if not reconciliation_passed:
            logger.error(
                f"REVENUE RECONCILIATION FAILED: "
                f"Channel sum={channel_total:.2f}, Total={total_revenue:.2f}, "
                f"Diff={abs(channel_total - total_revenue):.2f}"
            )
        else:
            logger.debug("Revenue reconciliation passed")

        # Round channel revenues
        for ch_data in channel_stats.values():
            ch_data["revenue"] = round(ch_data["revenue"], 2)

        # Round daily revenues and sort by date
        for day_data in daily_stats.values():
            day_data["revenue"] = round(day_data["revenue"], 2)
        daily_breakdown = sorted(daily_stats.values(), key=lambda d: d["date"])

        logger.info(
            f"AGGREGATION: {total_orders} orders, "
            f"{valid_orders} valid, {excluded_orders} excluded, "
            f"{total_items} items, "
            f"Revenue: INR {total_revenue:,.2f}"
        )

        return {
            "total_orders": total_orders,
            "valid_orders": valid_orders,
            "excluded_orders": excluded_orders,
            "total_items": total_items,
            "total_revenue": round(total_revenue, 2),
            "total_discount": round(total_discount, 2),
            "total_tax": round(total_tax, 2),
            "total_refund": round(total_refund, 2),
            "avg_order_value": round(
                total_revenue / valid_orders, 2
            ) if valid_orders > 0 else 0,
            "channel_breakdown": channel_stats,
            "daily_breakdown": daily_breakdown,
            "status_breakdown": status_stats,
            "currency": "INR",
            "calculation_method": "sellingPrice_only",
            "reconciliation_passed": reconciliation_passed,
        }

    # Paginated API for frontend (12 orders per page)

    async def get_orders_paginated(
        self,
        from_date: datetime,
        to_date: datetime,
        page: int = 1,
        page_size: int = 12
    ) -> Dict[str, Any]:
        """
        Return a page of orders using cached full-fetch and in-memory slicing.
        """

        # Build a cache key for this date range + details
        cache_key = f"orders_detailed_{from_date.date()}_{to_date.date()}"

        # Check cache
        cached_orders = self._get_from_cache(cache_key)

        if cached_orders is None:
            # Fetch ALL orders with details (one-time cost, then cached)
            logger.info(
                f"Fetching all orders for {from_date.date()} to {to_date.date()}")
            logger.info(
                "Initial fetch may take a while")

            fetch_result = await self.fetch_all_orders_with_revenue(
                from_date, to_date, max_orders=100000
            )

            if not fetch_result.get("successful", False):
                return {
                    "success": False,
                    "error": fetch_result.get("error", "Failed to fetch orders"),
                    "orders": [],
                    "pagination": {},
                }

            all_orders = fetch_result.get("orders", [])

            # Process all orders
            processed_all = []
            for order in all_orders:
                calc = self.calculate_order_revenue(order)
                # Extract items with SKU and size information
                items = []
                for item in order.get("saleOrderItems", []):
                    item_name = item.get("itemName", "")
                    # Extract size from itemName - common patterns: "SIZE YEARS/MONTHS", "XS/S/M/L/XL", numbers
                    size = ""
                    if item_name:
                        # Try to extract size from end of name (e.g., "- 3-4 YEARS", "- XL", "- 10")
                            # Pattern 1: X-Y YEARS/MONTHS (e.g., "3-4 YEARS", "6-9 MONTHS")
                        match = re.search(
                            r'-?\s*(\d+-\d+\s+(?:YEARS?|MONTHS?))\s*$', item_name, re.IGNORECASE)
                        if not match:
                            # Pattern 2: Single size (e.g., "XS", "S", "M", "L", "XL", "XXL", "XXXL")
                            match = re.search(
                                r'-?\s*(XXX?L|XX?L|[SMLX])\s*$', item_name, re.IGNORECASE)
                        if not match:
                            # Pattern 3: Number size (e.g., "- 2", "- 10", "- 12-14")
                            match = re.search(
                                r'-?\s*(\d+(?:-\d+)?)\s*$', item_name)
                        if match:
                            size = match.group(1).strip()

                    items.append({
                        "itemSku": item.get("itemSku", ""),
                        "itemName": item_name,
                        "sku": item.get("itemSku", ""),
                        "sellingPrice": item.get("sellingPrice", 0),
                        "selling_price": item.get("sellingPrice", 0),
                        "quantity": item.get("quantity", 1),
                        # Fallback to SKU
                        "size": size if size else item.get("itemSku", "").split("-")[-1],
                    })
                processed_all.append({
                    "code": calc["order_code"],
                    "displayOrderCode": calc["order_code"],
                    "status": calc["status"],
                    "channel": calc["channel"],
                    "selling_price": calc["selling_price"],
                    "total_selling_price": calc["selling_price"],
                    "net_revenue": calc["net_revenue"],
                    "created": calc["created"],
                    "displayOrderDateTime": calc["created"],
                    "item_count": calc["item_count"],
                    "quantity": calc["quantity"],
                    "include_in_revenue": calc["include_in_revenue"],
                    "cashOnDelivery": order.get("cod", False),
                    "cod": order.get("cod", False),
                    "items": items,  # Add items array with SKU and size
                })

            # Cache the processed orders
            self._set_cache(cache_key, processed_all)
            cached_orders = processed_all
            logger.info(
                f"Cached {len(cached_orders)} orders")
        else:
            logger.info(
                f"Cache hit, using {len(cached_orders)} cached orders (instant load < 2s)")

        # Client-side pagination
        total_orders = len(cached_orders)
        total_pages = (total_orders + page_size -
                       1) // page_size if total_orders > 0 else 1

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_orders = cached_orders[start_idx:end_idx]

        page_revenue = sum(order["net_revenue"] for order in page_orders)

        return {
            "success": True,
            "orders": page_orders,
            "pagination": {
                "current_page": page,
                "page_size": page_size,
                "total_orders": total_orders,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
            },
            "page_summary": {
                "orders_on_page": len(page_orders),
                "page_revenue": round(page_revenue, 2),
            },
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "revenue_method": "sellingPrice_export_job",
            "cache_used": cached_orders is not None,
        }

    # Main sales data method - uses export job API
    async def get_sales_data(
        self,
        from_date: datetime,
        to_date: datetime,
        period_name: str = "custom"
    ) -> Dict[str, Any]:
        """
        Get complete sales data for a date range.

        Revenue = SUM of item.sellingPrice from detail responses.
        Fetches ALL orders (no limits) for accurate business data.
        Uses 15-min cache to avoid repeated fetches.
        """
        # Check cache
        if period_name != "custom":
            cache_key = self._get_cache_key(period_name)
            cached_data = self._get_from_cache(cache_key)
            if cached_data is not None:
                logger.info(
                    f"Cache hit, returning {period_name} data instantly (no API calls)")
                return cached_data
        logger.info(f"Getting {period_name.upper()} SALES DATA")
        logger.info(f"  Date range: {from_date} to {to_date}")
        logger.info("  Method: Export Job API")

        if not self.access_code:
            return {
                "success": False,
                "message": "Unicommerce access code not configured",
                "period": period_name,
            }

        try:
            # Two-phase fetch
            fetch_result = await self.fetch_all_orders_with_revenue(
                from_date, to_date, max_orders=100000
            )

            if not fetch_result.get("successful", False):
                return {
                    "success": False,
                    "message": fetch_result.get("error", "Failed to fetch orders"),
                    "period": period_name,
                }

            orders = fetch_result.get("orders", [])
            total_records = fetch_result.get("totalRecords", 0)

            logger.info(
                f"Retrieved {len(orders)} orders with full pricing data")

            # Aggregate using sellingPrice ONLY
            aggregation = self.aggregate_orders(orders)
            logger.info("Revenue summary")
            logger.info(
                f"  Valid orders: {aggregation['valid_orders']} / {total_records} total")
            logger.info(
                f"  REVENUE: INR {aggregation['total_revenue']:,.2f}")
            logger.info(
                f"  AVG: INR {aggregation['avg_order_value']:,.2f}")
            logger.info(
                f"  Reconciliation: {'PASSED' if aggregation.get('reconciliation_passed') else 'FAILED'}")

            # Sample orders for display (first 10)
            sample_orders = []
            for order in orders[:10]:
                calc = self.calculate_order_revenue(order)
                sample_orders.append({
                    "code": calc["order_code"],
                    "status": calc["status"],
                    "channel": calc["channel"],
                    "selling_price": calc["selling_price"],
                    "net_revenue": calc["net_revenue"],
                    "created": calc["created"],
                    "item_count": calc["item_count"],
                    "quantity": calc["quantity"],
                    "include_in_revenue": calc["include_in_revenue"],
                })

            result = {
                "success": True,
                "period": period_name,
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "data_accuracy": "complete",
                "revenue_method": "sellingPrice_export_job",
                "fetch_info": {
                    "total_available": total_records,
                    "fetched_count": len(orders),
                    "failed_codes": len(fetch_result.get("failed_codes", [])),
                    "phase1_time_seconds": fetch_result.get("phase1_time", 0),
                    "phase2_time_seconds": fetch_result.get("phase2_time", 0),
                    "total_time_seconds": fetch_result.get("total_time", 0),
                    "retry_recovered": fetch_result.get("retry_recovered", 0),
                    "phase1_dedup": fetch_result.get("phase1_dedup", 0),
                    "phase2_dedup": fetch_result.get("phase2_dedup", 0),
                    "reconciliation_passed": aggregation.get("reconciliation_passed", True),
                },
                "summary": aggregation,
                "orders": sample_orders,
            }

            # Cache the result
            if period_name != "custom":
                cache_key = self._get_cache_key(period_name)
                self._set_cache(cache_key, result)

            return result

        except Exception as e:
            logger.error(f"Error in get_sales_data: {e}", exc_info=True)
            return {
                "success": False,
                "message": str(e),
                "period": period_name,
            }

    # Time-based convenience methods
    async def get_today_sales(self) -> Dict[str, Any]:
        """Get today's sales (00:00:00 to current time - 1 minute)"""
        from_date, to_date = self.get_today_range()
        return await self.get_sales_data(from_date, to_date, "today")

    async def get_yesterday_sales(self) -> Dict[str, Any]:
        """Get yesterday's sales (00:00:00 to 23:59:59)"""
        from_date, to_date = self.get_yesterday_range()
        return await self.get_sales_data(from_date, to_date, "yesterday")

    async def get_last_7_days_sales(self) -> Dict[str, Any]:
        """Get last 7 complete days (not including today)"""
        from_date, to_date = self.get_last_n_days_range(7)
        return await self.get_sales_data(from_date, to_date, "last_7_days")

    async def get_custom_range_sales(
        self, from_date: datetime, to_date: datetime
    ) -> Dict[str, Any]:
        """Get sales for custom date range"""
        return await self.get_sales_data(from_date, to_date, "custom")


    async def get_today_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        from_date, to_date = self.get_today_range()
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    async def get_yesterday_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        from_date, to_date = self.get_yesterday_range()
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    async def get_last_7_days_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        from_date, to_date = self.get_last_n_days_range(7)
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    # Validation & reconciliation
    async def validate_revenue_consistency(self) -> Dict[str, Any]:
        """
        Run sanity checks on revenue data across periods.
        """
        logger.info("Running revenue validation checks...")

        today = await self.get_today_sales()
        yesterday = await self.get_yesterday_sales()
        last_7 = await self.get_last_7_days_sales()

        issues = []

        today_rev = today.get("summary", {}).get(
            "total_revenue", 0) if today.get("success") else 0
        yesterday_rev = yesterday.get("summary", {}).get(
            "total_revenue", 0) if yesterday.get("success") else 0
        rev_7d = last_7.get("summary", {}).get(
            "total_revenue", 0) if last_7.get("success") else 0

        # Check 1: Channel totals for 7-day
        if last_7.get("success"):
            summary = last_7.get("summary", {})
            channel_breakdown = summary.get("channel_breakdown", {})
            channel_total = sum(ch.get("revenue", 0)
                                for ch in channel_breakdown.values())
            if abs(channel_total - rev_7d) > 1:
                issues.append(
                    f"Channel total ({channel_total:,.2f}) != "
                    f"Overall total ({rev_7d:,.2f})"
                )

        # Check 2: Reconciliation flags
        for period_data, period_name in [
            (today, "today"), (yesterday, "yesterday"),
            (last_7, "last_7_days")
        ]:
            fetch_info = period_data.get("fetch_info", {})
            if not fetch_info.get("reconciliation_passed", True):
                issues.append(
                    f"Revenue reconciliation failed for {period_name}")

        return {
            "success": len(issues) == 0,
            "checks_passed": 2 - len(issues),
            "issues": issues,
            "revenues": {
                "today": today_rev,
                "yesterday": yesterday_rev,
                "last_7_days": rev_7d,
            },
            "message": "All validations passed" if not issues else f"{len(issues)} issues found",
        }

    # Backward compatibility
    async def search_sale_orders(
        self,
        from_date: datetime = None,
        to_date: datetime = None,
        display_start: int = 0,
        display_length: int = 100
    ) -> Dict[str, Any]:
        """Backward compatible search method"""
        now = datetime.now(timezone.utc)
        if to_date is None:
            to_date = now
        if from_date is None:
            from_date = now - timedelta(hours=24)

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()
            success, orders, total, error = await self._fetch_single_page(
                client, headers, from_date, to_date, display_start, display_length
            )

            if success:
                return {
                    "successful": True,
                    "elements": orders,
                    "totalRecords": total,
                }
            else:
                return {
                    "successful": False,
                    "error": error,
                    "elements": [],
                    "totalRecords": 0,
                }

    async def get_order_details(self, order_code: str) -> Dict[str, Any]:
        """Get full order details including payment info."""
        url = f"{self.base_url}/oms/saleorder/get"

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            try:
                headers = await self._get_headers()
                response = await client.post(
                    url,
                    json={
                        "code": order_code,
                        "paymentDetailRequired": True,
                    },
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()

                if data.get("successful"):
                    order_dto = data.get("saleOrderDTO")
                    if order_dto:
                        revenue_calc = self.calculate_order_revenue(order_dto)
                        return {
                            "successful": True,
                            "order": order_dto,
                            "revenue_info": revenue_calc,
                        }
                    return {"successful": True, "order": order_dto}
                else:
                    return {
                        "successful": False,
                        "error": data.get("message", "Unknown error"),
                    }
            except Exception as e:
                logger.error(f"Error fetching order {order_code}: {e}")
                return {"successful": False, "error": str(e)}

    # Backward-compatible aliases
    async def get_last_24_hours_sales(self) -> Dict[str, Any]:
        return await self.get_today_sales()

    async def get_detailed_sales_report(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        if to_date is None:
            to_date = now
        if from_date is None:
            from_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return await self.get_custom_range_sales(from_date, to_date)

    # ── Fabric-only sales data ────────────────────────────────────────

    async def _download_parse_export_fabric(self, download_url: str) -> List[Dict]:
        """Download export CSV and return ONLY rows where category = FABRIC."""
        try:
            download_timeout = httpx.Timeout(120.0, connect=15.0)
            async with httpx.AsyncClient(timeout=download_timeout) as client:
                response = await client.get(download_url)
                if response.status_code in (401, 403):
                    headers = await self._get_headers()
                    response = await client.get(download_url, headers=headers)
                response.raise_for_status()
                csv_text = response.text

            if not csv_text or not csv_text.strip():
                return []

            reader = csv.DictReader(io.StringIO(csv_text))
            orders_map: Dict[str, Dict] = {}
            fabric_count = 0

            for row in reader:
                item_category = (
                    row.get("Category") or row.get("category")
                    or row.get("Item Type Category") or row.get("categoryCode") or ""
                ).strip().upper()
                if item_category not in self.EXCLUDED_CATEGORIES:
                    continue  # skip non-fabric

                fabric_count += 1
                order_code = (
                    row.get("Sale Order Code") or row.get("saleOrderCode")
                    or row.get("code") or ""
                ).strip()
                if not order_code:
                    continue

                if order_code not in orders_map:
                    channel_raw = (row.get("Channel Name") or row.get("channel") or "UNKNOWN").strip()
                    cod_raw = (row.get("COD") or row.get("cod") or "0").strip()
                    is_cod = cod_raw in ("1", "true", "True", "yes")
                    orders_map[order_code] = {
                        "code": order_code,
                        "channel": channel_raw.replace(" ", "_"),
                        "status": (row.get("Sale Order Status") or row.get("status") or "").strip(),
                        "created": (row.get("Created") or row.get("created") or "").strip(),
                        "cod": is_cod,
                        "saleOrderItems": [],
                    }

                try:
                    selling_price = float(row.get("Selling Price") or row.get("sellingPrice") or 0)
                except (ValueError, TypeError):
                    selling_price = 0.0
                try:
                    mrp = float(row.get("MRP") or row.get("maxRetailPrice") or 0)
                except (ValueError, TypeError):
                    mrp = 0.0
                try:
                    discount = float(row.get("Discount") or row.get("discount") or 0)
                except (ValueError, TypeError):
                    discount = 0.0

                sku_code = (row.get("Item SKU Code") or row.get("skuCode") or row.get("itemSku") or "").strip()
                item_details = (row.get("Item Details") or row.get("itemDetails") or "").strip()
                soi_code = (row.get("Sale Order Item Code") or row.get("soicode") or "").strip()

                orders_map[order_code]["saleOrderItems"].append({
                    "soiCode": soi_code,
                    "itemSku": sku_code,
                    "itemName": item_details or sku_code,
                    "sellingPrice": selling_price,
                    "maxRetailPrice": mrp,
                    "quantity": 1,
                    "discount": discount,
                })

            orders = [o for o in orders_map.values() if o["saleOrderItems"]]
            logger.info(f"Fabric export: {fabric_count} rows → {len(orders)} orders")
            return orders

        except Exception as e:
            logger.error(f"Fabric export parse failed: {e}", exc_info=True)
            return []

    async def get_fabric_sales_data(
        self,
        from_date: datetime,
        to_date: datetime,
        period_name: str = "custom"
    ) -> Dict[str, Any]:
        """Get sales data for FABRIC category items only."""
        cache_key = f"uc:fabric:{period_name}:{from_date.date()}_{to_date.date()}"
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            logger.info(f"Fabric data: cache hit for {period_name}")
            return cached

        logger.info(f"Fetching FABRIC sales data for {period_name}")

        try:
            job_code = await self._create_export_job(from_date, to_date)
            if not job_code:
                return {"success": False, "error": "Export job creation failed", "orders": [], "summary": {}}

            download_url = await self._poll_export_status(job_code)
            if not download_url:
                return {"success": False, "error": "Export job timed out", "orders": [], "summary": {}}

            orders = await self._download_parse_export_fabric(download_url)

            # Build flat item-level rows and aggregate summary
            total_orders = 0
            total_items = 0
            items_list: List[Dict] = []
            seen_orders: set = set()

            for order in orders:
                status = order.get("status", "")
                if status in self.EXCLUDED_STATUSES:
                    continue
                order_code = order.get("code", "")
                created = order.get("created", "")
                if order_code not in seen_orders:
                    seen_orders.add(order_code)
                    total_orders += 1
                for item in order.get("saleOrderItems", []):
                    total_items += 1
                    items_list.append({
                        "soiCode": item.get("soiCode", ""),
                        "sku": item.get("itemSku", ""),
                        "orderCode": order_code,
                        "created": created,
                    })

            result = {
                "success": True,
                "period": period_name,
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": total_orders,
                    "total_items": total_items,
                },
                "items": items_list,
                "total_items_count": len(items_list),
            }

            self._set_cache(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Fabric sales data error: {e}", exc_info=True)
            return {"success": False, "error": str(e), "orders": [], "summary": {}}

    # ── Bundle SKU data (Item Master export) ──────────────────────────

    async def _create_item_master_export_job(self) -> Optional[str]:
        """
        Create a Unicommerce export job for Item Master (all items).
        Item Master does not support date filters — we fetch all and filter
        by Type=BUNDLE during CSV parsing.
        Returns the jobCode on success, None on failure.
        """
        url = f"{self.base_url}/export/job/create"

        payload = {
            "exportJobTypeName": "Item Master",
            "exportColums": ["All"],
            "exportFilters": [],
            "frequency": "ONETIME",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                headers = await self._get_headers()
                headers["Facility"] = "anthrilo"

                response = await client.post(url, json=payload, headers=headers)

                if response.status_code == 401:
                    self.token_manager.invalidate_token()
                    await self.token_manager.get_valid_token()
                    headers = await self._get_headers()
                    headers["Facility"] = "anthrilo"
                    response = await client.post(url, json=payload, headers=headers)

                if response.status_code >= 400:
                    try:
                        error_body = response.json()
                    except Exception:
                        error_body = response.text[:500]
                    logger.error(
                        f"Item Master Export: Job creation HTTP {response.status_code}: {error_body}"
                    )
                    return None

                data = response.json()

                if data.get("successful"):
                    job_code = data.get("jobCode")
                    logger.info(f"Item Master Export: Job created successfully {job_code}")
                    return job_code
                else:
                    errors = data.get("errors", [])
                    msg = data.get("message", "Unknown error")
                    logger.error(f"Item Master Export: Job creation failed: {msg} | errors={errors}")
                    return None

        except Exception as e:
            logger.error(f"Item Master Export: Job creation exception: {e}", exc_info=True)
            return None

    async def _download_parse_bundle_export(
        self, download_url: str,
    ) -> List[Dict]:
        """
        Download Item Master export CSV, keep only Type=BUNDLE rows,
        and aggregate multiple component rows per SKU into a single record
        with a 'components' array.

        UC CSV has one row per (bundle SKU × component), so a bundle with
        3 components produces 3 CSV rows sharing the same Product Code.
        """
        try:
            download_timeout = httpx.Timeout(120.0, connect=15.0)
            async with httpx.AsyncClient(timeout=download_timeout) as client:
                response = await client.get(download_url)
                if response.status_code in (401, 403):
                    headers = await self._get_headers()
                    response = await client.get(download_url, headers=headers)
                response.raise_for_status()
                csv_text = response.text

            if not csv_text or not csv_text.strip():
                logger.warning("Bundle Export: Downloaded CSV is empty")
                return []

            reader = csv.DictReader(io.StringIO(csv_text))
            fieldnames = reader.fieldnames or []
            logger.info(f"Bundle Export: CSV columns ({len(fieldnames)}): {fieldnames[:10]}...")

            # Aggregate: dict keyed by SKU code → single bundle record
            bundle_map: Dict[str, Dict] = {}
            skipped_type = 0
            total_rows = 0

            for row in reader:
                total_rows += 1
                row_type = (row.get("Type") or row.get("type") or "").strip().upper()
                if row_type != "BUNDLE":
                    skipped_type += 1
                    continue

                sku_code = (row.get("Product Code") or row.get("SKU Code") or "").strip()
                if not sku_code:
                    continue

                # Component info from this row
                comp_sku = (row.get("Component Product Code") or "").strip()
                comp_qty = (row.get("Component Quantity") or "").strip()
                comp_price = (row.get("Component Price") or "").strip()

                if sku_code in bundle_map:
                    # SKU already seen — just append this component
                    if comp_sku:
                        bundle_map[sku_code]["components"].append({
                            "sku": comp_sku,
                            "quantity": comp_qty,
                            "price": comp_price,
                        })
                    continue

                # First row for this SKU — extract all fields
                item_name = (row.get("Name") or row.get("Item Name") or "").strip()
                category = (row.get("Category Name") or row.get("Category") or "").strip()
                category_code = (row.get("Category Code") or "").strip()
                updated_raw = (row.get("Updated") or "").strip()

                try:
                    cost_price = float(row.get("Cost Price") or 0)
                except (ValueError, TypeError):
                    cost_price = 0.0
                try:
                    mrp = float(row.get("MRP") or 0)
                except (ValueError, TypeError):
                    mrp = 0.0
                try:
                    base_price = float(row.get("Base Price") or 0)
                except (ValueError, TypeError):
                    base_price = 0.0

                color = (row.get("Color") or "").strip()
                size = (row.get("Size") or "").strip()
                brand = (row.get("Brand") or "").strip()
                enabled_str = (row.get("Enabled") or "").strip()
                hsn_code = (row.get("HSN CODE") or "").strip()
                weight = (row.get("Weight (gms)") or "").strip()
                image_url = (row.get("Image Url") or "").strip()

                components = []
                if comp_sku:
                    components.append({
                        "sku": comp_sku,
                        "quantity": comp_qty,
                        "price": comp_price,
                    })

                bundle_map[sku_code] = {
                    "skuCode": sku_code,
                    "itemName": item_name or sku_code,
                    "category": category,
                    "categoryCode": category_code,
                    "costPrice": cost_price,
                    "mrp": mrp,
                    "basePrice": base_price,
                    "color": color,
                    "size": size,
                    "brand": brand,
                    "enabled": enabled_str.lower() in ("true", "1", "yes", "y"),
                    "hsnCode": hsn_code,
                    "weight": weight,
                    "imageUrl": image_url,
                    "updated": updated_raw,
                    "components": components,
                }

            bundles = list(bundle_map.values())
            # Add componentCount for convenience
            for b in bundles:
                b["componentCount"] = len(b["components"])

            logger.info(
                f"Bundle Export: {total_rows} CSV rows → {len(bundles)} unique bundles "
                f"(skipped {skipped_type} non-bundle rows)"
            )
            return bundles

        except Exception as e:
            logger.error(f"Bundle Export: Download/parse failed: {e}", exc_info=True)
            return []

    async def get_bundle_sku_data(self) -> Dict[str, Any]:
        """
        Get all BUNDLE type items from the Item Master export.
        This is catalogue data — no date filtering (UC doesn't support
        date filters for Item Master, and the 'Updated' column only
        reflects when the item record was last modified in UC).
        Components are aggregated into each bundle record.
        """
        cache_key = "uc:bundle_skus:all"

        cached = self._get_from_cache(cache_key)
        if cached is not None:
            logger.info("Bundle SKU data: cache hit")
            return cached

        logger.info("Fetching BUNDLE SKU data via Item Master export")

        try:
            job_code = await self._create_item_master_export_job()
            if not job_code:
                return {"success": False, "error": "Item Master export job creation failed", "bundles": [], "summary": {}}

            download_url = await self._poll_export_status(job_code)
            if not download_url:
                return {"success": False, "error": "Item Master export job timed out", "bundles": [], "summary": {}}

            bundles = await self._download_parse_bundle_export(download_url)

            total_bundles = len(bundles)
            enabled_count = sum(1 for b in bundles if b.get("enabled"))
            disabled_count = total_bundles - enabled_count
            mrp_values = [b["mrp"] for b in bundles if b["mrp"] > 0]
            cost_values = [b["costPrice"] for b in bundles if b["costPrice"] > 0]
            avg_mrp = round(sum(mrp_values) / len(mrp_values), 2) if mrp_values else 0
            avg_cost = round(sum(cost_values) / len(cost_values), 2) if cost_values else 0

            # Category breakdown
            category_map: Dict[str, int] = {}
            for b in bundles:
                cat = b.get("category") or "Unknown"
                category_map[cat] = category_map.get(cat, 0) + 1

            # Sort categories by count descending
            sorted_categories = dict(
                sorted(category_map.items(), key=lambda x: x[1], reverse=True)
            )

            result = {
                "success": True,
                "bundles": bundles,
                "summary": {
                    "total_bundles": total_bundles,
                    "enabled": enabled_count,
                    "disabled": disabled_count,
                    "avg_mrp": avg_mrp,
                    "avg_cost": avg_cost,
                    "total_categories": len(category_map),
                    "categories": sorted_categories,
                },
            }

            # Cache — this is static catalogue data
            self._set_cache(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Bundle SKU data error: {e}", exc_info=True)
            return {"success": False, "error": str(e), "bundles": [], "summary": {}}


# Singleton factory
_service_instance: Optional[UnicommerceService] = None


def get_unicommerce_service() -> UnicommerceService:
    """Get or create the Unicommerce service singleton"""
    global _service_instance
    if _service_instance is None:
        _service_instance = UnicommerceService()
    return _service_instance
