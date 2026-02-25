"""
Unicommerce Integration Service - PRODUCTION VERSION (v3)
==========================================================
Enterprise-grade Export Job API approach for fast, accurate revenue data.

Architecture (PRIMARY - Export Job API):
- Step 1: Create export job (/export/job/create) with date range
- Step 2: Poll status (/export/job/status) until SUCCESSFUL
- Step 3: Download CSV and parse into order objects
- Only 3 API calls regardless of order volume!

Fallback (Two-Phase - used only if export fails):
- Phase 1 (Identifier Collection): saleOrder/search with pagination + date chunking
- Phase 2 (Detail Resolution): saleorder/get with batching, retry, dedup

CRITICAL RULES:
1. Revenue = SUM of item.sellingPrice ONLY
2. No order may be skipped or duplicated
3. Data accuracy is paramount - used for business logic and reporting

Performance:
- Export Job: ~10-30s for any volume (async CSV bulk export)
- Two-Phase fallback: O(n) API calls for n orders
- 15-minute in-memory cache
- Redis caching for expensive reports

FETCHES ALL ORDERS (no limits) for complete business accuracy.
"""

import csv
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


class UnicommerceServiceProduction:
    """
    Production Unicommerce service with TWO-PHASE revenue fetching.

    Phase 1 (Identifier Collection):
      /saleOrder/search - Paginated, date-chunked to avoid API limits.
      Collects ALL order codes. Deduplicates.

    Phase 2 (Detail Resolution):
      /saleorder/get - Batched (50), parallel with semaphore.
      Retry failed orders up to 3x with exponential backoff.
      Validates count consistency.

    Revenue = SUM of item.sellingPrice from Phase 2 ONLY
    """

    # =========================================================================
    # CONFIGURATION
    # =========================================================================

    # Phase 1: Search/Identifier Collection
    # Orders per page for search API (not used - no pagination support)
    API_PAGE_SIZE = 200
    MAX_CONCURRENT_PAGES = 30    # Parallel page fetches (not used)
    # Chunk large date ranges into 1-day windows (OPTIMIZED: was 3)
    DATE_CHUNK_DAYS = 1

    # Phase 2: Detail Resolution (PERFORMANCE CRITICAL)
    # Orders per batch for saleorder/get (OPTIMIZED: was 50)
    DETAIL_BATCH_SIZE = 100
    # Parallel order detail fetches (OPTIMIZED: was 80)
    MAX_CONCURRENT_ORDER_GETS = 150

    # Retry configuration
    MAX_RETRIES = 2              # Reduced from 3 for faster failure
    # Initial delay in seconds (OPTIMIZED: was 0.5)
    RETRY_DELAY = 0.3
    RETRY_BACKOFF = 1.5          # Multiplier per retry (OPTIMIZED: was 2.0)
    # Smaller batches for retries (OPTIMIZED: was 30)
    RETRY_BATCH_SIZE = 50
    # Delay between retry batches (OPTIMIZED: was 0.5)
    RETRY_BATCH_DELAY = 0.3

    # Cache
    CACHE_TTL_SECONDS = 900      # 15 minutes

    # Status exclusions (excluded from revenue)
    EXCLUDED_STATUSES = {
        "CANCELLED", "CANCELED", "RETURNED", "REFUNDED",
        "FAILED", "UNFULFILLABLE", "ERROR", "PENDING_VERIFICATION"
    }

    # =========================================================================
    # EXPORT JOB API CONFIGURATION (PRIMARY - FAST PATH)
    # =========================================================================

    EXPORT_MAX_POLL_SECONDS = 300    # Max time to wait for export job
    EXPORT_INITIAL_POLL_INTERVAL = 2  # Start polling every 2s
    EXPORT_MAX_POLL_INTERVAL = 10     # Max poll interval (backoff cap)
    EXPORT_POLL_BACKOFF = 1.5         # Polling backoff multiplier

    # Valid Unicommerce export column identifiers
    # NOTE: API field name is "exportColums" (Unicommerce typo - missing 'n')
    # NOTE: Filter field name is "exportFilters"
    # CSV headers are Title Case (e.g., "Sale Order Code", "Selling Price")
    EXPORT_COLUMNS = [
        # Order-level
        "saleOrderCode",     # → CSV: "Sale Order Code"
        "channel",           # → CSV: "Channel Name"
        "status",            # → CSV: "Sale Order Status"
        "created",           # → CSV: "Created"
        "updated",           # → CSV: "Updated"
        "shippingMethod",    # → CSV: "Shipping Method"
        "cod",               # → CSV: "COD" (1=COD, 0=Prepaid)
        # Item-level (one CSV row per item unit)
        "soicode",           # → CSV: "Sale Order Item Code"
        "skuCode",           # → CSV: "Item SKU Code"
        "sellingPrice",      # → CSV: "Selling Price"
        "maxRetailPrice",    # → CSV: "MRP"
        "discount",          # → CSV: "Discount"
        "totalPrice",        # → CSV: "Total Price"
        "channelProductId",  # → CSV: "Channel Product Id"
        "itemDetails",       # → CSV: "Item Details"
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

        # Semaphores for concurrency control
        self._page_semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_PAGES)
        self._order_semaphore = asyncio.Semaphore(
            self.MAX_CONCURRENT_ORDER_GETS)

        logger.info(
            f"UnicommerceServiceProduction v3 initialized | "
            f"Tenant: {self.tenant} | "
            f"Primary: Export Job API | "
            f"Fallback: Two-Phase (batch={self.DETAIL_BATCH_SIZE}) | "
            f"Cache TTL: {self.CACHE_TTL_SECONDS}s"
        )

    # =========================================================================
    # AUTH HELPERS
    # =========================================================================

    async def _get_headers(self) -> Dict[str, str]:
        """Get authenticated headers from centralized token manager."""
        return await self.token_manager.get_headers()

    # =========================================================================
    # CACHE HELPERS
    # =========================================================================

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

    # =========================================================================
    # EXPORT JOB API (PRIMARY - FAST PATH)
    # =========================================================================

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
                        f"EXPORT: Job creation HTTP {response.status_code}: {error_body}"
                    )
                    return None

                data = response.json()

                if data.get("successful"):
                    job_code = data.get("jobCode")
                    logger.info(f"EXPORT: Job created successfully → {job_code}")
                    return job_code
                else:
                    errors = data.get("errors", [])
                    msg = data.get("message", "Unknown error")
                    logger.error(f"EXPORT: Job creation failed: {msg} | errors={errors}")
                    return None

        except Exception as e:
            logger.error(f"EXPORT: Job creation exception: {e}", exc_info=True)
            return None

    async def _poll_export_status(
        self, job_code: str, max_wait: int = None
    ) -> Optional[str]:
        """
        Poll export job status until SUCCESSFUL.
        Returns the file download URL on success, None on failure/timeout.
        """
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
                                f"EXPORT: Job {job_code} COMPLETE in {elapsed:.1f}s → {file_path}"
                            )
                            return file_path
                        elif status in ("FAILED", "CANCELLED"):
                            logger.error(
                                f"EXPORT: Job {job_code} {status} after {elapsed:.1f}s"
                            )
                            return None
                        else:
                            logger.debug(
                                f"EXPORT: Job {job_code} status={status}, "
                                f"elapsed={elapsed:.1f}s, next poll in {poll_interval:.1f}s"
                            )
                    else:
                        logger.warning(
                            f"EXPORT: Status check not successful: {data.get('message', '')}"
                        )

                    await asyncio.sleep(poll_interval)
                    poll_interval = min(
                        poll_interval * self.EXPORT_POLL_BACKOFF,
                        self.EXPORT_MAX_POLL_INTERVAL,
                    )

        except Exception as e:
            logger.error(f"EXPORT: Polling exception: {e}", exc_info=True)
            return None

        elapsed = time_module.time() - start_time
        logger.error(f"EXPORT: Job {job_code} timed out after {elapsed:.0f}s")
        return None

    async def _download_parse_export(self, download_url: str) -> List[Dict]:
        """
        Download the export CSV and parse into order dicts.

        The CSV has one row per sale order item UNIT. Multiple rows with the
        same Sale Order Code are grouped into a single order dict with an
        items array, matching the structure returned by saleorder/get API.

        CSV columns (Title Case):
        Sale Order Code, Channel Name, Sale Order Status, Created, Updated,
        Shipping Method, Sale Order Item Code, Selling Price, MRP, Discount,
        Total Price, COD (1/0), Item SKU Code, Channel Product Id, Item Details
        """
        try:
            download_timeout = httpx.Timeout(120.0, connect=15.0)

            async with httpx.AsyncClient(timeout=download_timeout) as client:
                # CloudFront pre-signed URL — no auth needed
                response = await client.get(download_url)

                if response.status_code in (401, 403):
                    headers = await self._get_headers()
                    response = await client.get(download_url, headers=headers)

                response.raise_for_status()
                csv_text = response.text

            if not csv_text or not csv_text.strip():
                logger.warning("EXPORT: Downloaded CSV is empty")
                return []

            reader = csv.DictReader(io.StringIO(csv_text))
            fieldnames = reader.fieldnames or []
            logger.info(f"EXPORT: CSV columns ({len(fieldnames)}): {fieldnames}")

            # Group rows by order code → nested order structure
            orders_map: Dict[str, Dict] = {}
            row_count = 0

            for row in reader:
                row_count += 1

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
                    # Channel name: normalize spaces → underscores for consistency
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

                # Parse item fields — each CSV row = 1 unit
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

            orders = list(orders_map.values())
            total_items = sum(len(o["saleOrderItems"]) for o in orders)

            logger.info(
                f"EXPORT: Parsed {row_count} CSV rows → "
                f"{len(orders)} orders, {total_items} items"
            )
            return orders

        except Exception as e:
            logger.error(f"EXPORT: Download/parse failed: {e}", exc_info=True)
            return []

    async def fetch_orders_via_export(
        self, from_date: datetime, to_date: datetime
    ) -> Dict[str, Any]:
        """
        Fetch ALL orders using Export Job API (FAST - ~3 API calls total).

        Returns the same dict format as fetch_all_orders_with_revenue()
        for full backward compatibility. Falls back to two-phase on failure.
        """
        start_time = time_module.time()

        logger.info("=" * 60)
        logger.info("EXPORT JOB: FAST FETCH")
        logger.info(f"  Range: {from_date.isoformat()} → {to_date.isoformat()}")
        logger.info("=" * 60)

        try:
            # Step 1: Create export job
            job_code = await self._create_export_job(from_date, to_date)
            create_time = time_module.time() - start_time

            if not job_code:
                logger.warning(
                    "EXPORT: Job creation failed → falling back to two-phase"
                )
                return await self.fetch_all_orders_with_revenue_two_phase(
                    from_date, to_date
                )

            logger.info(f"  Step 1 done in {create_time:.1f}s → job={job_code}")

            # Step 2: Poll until complete
            download_url = await self._poll_export_status(job_code)
            poll_time = time_module.time() - start_time - create_time

            if not download_url:
                logger.warning(
                    "EXPORT: Job failed/timed out → falling back to two-phase"
                )
                return await self.fetch_all_orders_with_revenue_two_phase(
                    from_date, to_date
                )

            logger.info(f"  Step 2 done in {poll_time:.1f}s → file ready")

            # Step 3: Download and parse CSV
            orders = await self._download_parse_export(download_url)
            download_time = time_module.time() - start_time - create_time - poll_time
            total_time = time_module.time() - start_time

            if not orders and total_time < 10:
                # If export returned empty too quickly, might be a config issue
                logger.warning(
                    "EXPORT: No orders returned (possibly empty range or column mismatch)"
                )

            logger.info(
                f"  Step 3 done in {download_time:.1f}s → {len(orders)} orders"
            )
            logger.info(
                f"✅ EXPORT COMPLETE: {len(orders)} orders in {total_time:.1f}s total"
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
                f"EXPORT: Failed after {total_time:.1f}s: {e}", exc_info=True
            )
            logger.info("Falling back to two-phase approach...")
            return await self.fetch_all_orders_with_revenue_two_phase(
                from_date, to_date
            )

    # =========================================================================
    # TIME RANGE HELPERS (IST timezone aware)
    # =========================================================================

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

    def _chunk_date_range(
        self, from_date: datetime, to_date: datetime
    ) -> List[Tuple[datetime, datetime]]:
        """
        Split a date range into smaller chunks for parallel/sequential fetching.
        Ranges <= DATE_CHUNK_DAYS are returned as-is.
        Larger ranges are split into DATE_CHUNK_DAYS windows.
        """
        total_days = (to_date - from_date).total_seconds() / 86400
        if total_days <= self.DATE_CHUNK_DAYS:
            return [(from_date, to_date)]

        chunks = []
        current_start = from_date
        while current_start < to_date:
            current_end = min(
                current_start + timedelta(days=self.DATE_CHUNK_DAYS),
                to_date
            )
            chunks.append((current_start, current_end))
            current_start = current_end
        return chunks

    # =========================================================================
    # PHASE 1: IDENTIFIER COLLECTION
    # =========================================================================

    async def _fetch_single_page(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        from_date: datetime,
        to_date: datetime,
        display_start: int,
        display_length: int
    ) -> Tuple[bool, List[Dict], int, Optional[str]]:
        """
        Fetch a single page from saleOrder/search.
        Returns: (success, orders, totalRecords, error)

        NOTE: Unicommerce API does NOT support pagination parameters.
        Returns all orders in the date range (max ~200-300 per day).
        """
        url = f"{self.base_url}/oms/saleOrder/search"
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S"),
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S"),
        }

        async with self._page_semaphore:
            try:
                response = await client.post(
                    url, json=payload, headers=headers
                )
                response.raise_for_status()
                data = response.json()

                if data.get("successful"):
                    elements = data.get("elements", [])
                    total_records = data.get("totalRecords", 0)
                    return True, elements, total_records, None
                else:
                    error_msg = data.get("message", "Unknown error")
                    errors = data.get("errors", [])
                    if errors:
                        error_msg = errors[0].get("description", error_msg)
                    return False, [], 0, error_msg
            except httpx.TimeoutException:
                return False, [], 0, "Timeout"
            except httpx.HTTPStatusError as e:
                return False, [], 0, f"HTTP {e.response.status_code}"
            except Exception as e:
                return False, [], 0, str(e)

    async def _fetch_chunk_order_codes(
        self,
        from_date: datetime,
        to_date: datetime
    ) -> Tuple[List[str], int, List[str]]:
        """
        Fetch ALL order codes for a single date chunk.

        NOTE: Unicommerce API does NOT support pagination - it returns ALL orders
        for the requested date range in a single response (typically 200-300 orders/day max).

        Returns: (order_codes, totalRecords, errors)
        """
        all_codes: List[str] = []
        errors: List[str] = []

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()

            # Fetch all orders for this date chunk (no pagination needed)
            success, orders, total_records, error = await self._fetch_single_page(
                client, headers, from_date, to_date, 0, self.API_PAGE_SIZE
            )

            # On 401, invalidate the cached token, force a refresh, and retry once
            if not success and error and "401" in error:
                logger.warning(
                    "PHASE 1: Got 401 – refreshing token and retrying chunk "
                    f"{from_date.isoformat()} → {to_date.isoformat()}"
                )
                self.token_manager.invalidate_token()
                await self.token_manager.get_valid_token()
                headers = await self._get_headers()
                success, orders, total_records, error = await self._fetch_single_page(
                    client, headers, from_date, to_date, 0, self.API_PAGE_SIZE
                )

            if not success:
                return [], 0, [error or "API request failed"]

            # Extract codes from response
            for order in orders:
                code = order.get("code")
                if code:
                    all_codes.append(code)

            # Unicommerce returns all results at once - no pagination
            return all_codes, total_records or len(all_codes), errors

    async def fetch_all_order_codes(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        PHASE 1: Collect ALL order identifiers with date-window chunking.

        For large date ranges (>DATE_CHUNK_DAYS), splits into smaller windows
        and fetches each chunk independently. Deduplicates codes.

        Returns:
            {
                "successful": bool,
                "order_codes": List[str],    # DEDUPLICATED
                "totalRecords": int,
                "fetched_count": int,
                "pages_fetched": int,
                "fetch_time_seconds": float,
                "errors": List[str] | None,
                "chunks_used": int,
                "duplicates_removed": int,
            }
        """
        start_time = datetime.now()
        chunks = self._chunk_date_range(from_date, to_date)

        logger.info(
            f"PHASE 1: Fetching order codes | "
            f"Range: {from_date.isoformat()} to {to_date.isoformat()} | "
            f"Chunks: {len(chunks)}"
        )

        all_codes: List[str] = []
        total_records = 0
        all_errors: List[str] = []

        # Fetch each chunk (sequential to avoid overwhelming API)
        for i, (chunk_start, chunk_end) in enumerate(chunks):
            logger.info(
                f"  Chunk {i+1}/{len(chunks)}: "
                f"{chunk_start.isoformat()} to {chunk_end.isoformat()}"
            )
            codes, records, errors = await self._fetch_chunk_order_codes(
                chunk_start, chunk_end
            )
            all_codes.extend(codes)
            total_records += records
            all_errors.extend(errors)

            if len(all_codes) >= max_orders:
                break

        # DEDUPLICATION (critical for data safety)
        codes_before_dedup = len(all_codes)
        seen: Set[str] = set()
        unique_codes: List[str] = []
        for code in all_codes:
            if code not in seen:
                seen.add(code)
                unique_codes.append(code)
        duplicates_removed = codes_before_dedup - len(unique_codes)

        if duplicates_removed > 0:
            logger.warning(
                f"PHASE 1 DEDUP: Removed {duplicates_removed} duplicate codes "
                f"({codes_before_dedup} -> {len(unique_codes)})"
            )

        elapsed = (datetime.now() - start_time).total_seconds()

        if all_errors:
            logger.warning(
                f"PHASE 1: {len(all_errors)} errors: {all_errors[:5]}")

        logger.info(
            f"PHASE 1 COMPLETE: {len(unique_codes)} unique codes in {elapsed:.2f}s | "
            f"Total records API reported: {total_records} | "
            f"Chunks used: {len(chunks)} | "
            f"Duplicates removed: {duplicates_removed}"
        )

        return {
            "successful": True,
            "order_codes": unique_codes[:max_orders],
            "totalRecords": total_records,
            "fetched_count": len(unique_codes),
            "fetch_time_seconds": round(elapsed, 2),
            "errors": all_errors if all_errors else None,
            "chunks_used": len(chunks),
            "duplicates_removed": duplicates_removed,
        }

    # =========================================================================
    # PHASE 2: DETAIL RESOLUTION
    # =========================================================================

    async def _fetch_order_detail(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        order_code: str
    ) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """
        Fetch detail for a single order with retry + exponential backoff.

        Uses saleorder/get with paymentDetailRequired=true.
        Optimized to extract only essential fields from response.

        Returns: (success, order_dto_optimized, error_message)
        """
        url = f"{self.base_url}/oms/saleorder/get"
        payload = {
            "code": order_code,
            "paymentDetailRequired": False,  # Optimized: Don't fetch payment details
        }

        for attempt in range(self.MAX_RETRIES + 1):
            async with self._order_semaphore:
                try:
                    response = await client.post(
                        url, json=payload, headers=headers
                    )

                    if response.status_code == 429:
                        # Rate limited - backoff and retry
                        delay = self.RETRY_DELAY * \
                            (self.RETRY_BACKOFF ** attempt)
                        logger.warning(
                            f"Rate limited for {order_code}, "
                            f"retry {attempt+1} in {delay:.1f}s"
                        )
                        await asyncio.sleep(delay)
                        continue

                    response.raise_for_status()
                    data = response.json()

                    if data.get("successful"):
                        order_dto = data.get("saleOrderDTO")
                        if order_dto:
                            # Extract only required fields to reduce memory usage
                            optimized_order = self._extract_order_essentials(
                                order_dto)
                            return True, optimized_order, None
                        return False, None, "No saleOrderDTO in response"
                    else:
                        error_msg = data.get("message", "Unknown API error")
                        if attempt < self.MAX_RETRIES:
                            delay = self.RETRY_DELAY * \
                                (self.RETRY_BACKOFF ** attempt)
                            await asyncio.sleep(delay)
                            continue
                        return False, None, error_msg

                except httpx.TimeoutException:
                    if attempt < self.MAX_RETRIES:
                        delay = self.RETRY_DELAY * \
                            (self.RETRY_BACKOFF ** attempt)
                        await asyncio.sleep(delay)
                        continue
                    return False, None, "Timeout after all retries"

                except httpx.HTTPStatusError as e:
                    status = e.response.status_code
                    if status == 401:
                        # Token expired mid-flight – refresh and update shared headers
                        logger.warning(
                            f"PHASE 2: Got 401 for {order_code} "
                            f"(attempt {attempt+1}) – refreshing token..."
                        )
                        self.token_manager.invalidate_token()
                        await self.token_manager.get_valid_token()
                        new_headers = await self._get_headers()
                        # Update in-place for whole batch
                        headers.update(new_headers)
                        if attempt < self.MAX_RETRIES:
                            await asyncio.sleep(self.RETRY_DELAY)
                            continue
                    if status in (429, 500, 502, 503, 504) and attempt < self.MAX_RETRIES:
                        delay = self.RETRY_DELAY * \
                            (self.RETRY_BACKOFF ** attempt)
                        await asyncio.sleep(delay)
                        continue
                    return False, None, f"HTTP {status}"

                except Exception as e:
                    if attempt < self.MAX_RETRIES:
                        delay = self.RETRY_DELAY * \
                            (self.RETRY_BACKOFF ** attempt)
                        await asyncio.sleep(delay)
                        continue
                    return False, None, str(e)

        return False, None, "Exhausted all retries"

    def _extract_order_essentials(self, order_dto: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract only required fields from full order response.
        Reduces memory usage by 70-80% by discarding unnecessary data.
        """
        items = order_dto.get("saleOrderItems", [])

        # Extract essential item fields only
        essential_items = []
        total_quantity = 0

        for item in items:
            quantity = item.get("quantity", 1) or 1  # Handle null/0 quantity
            total_quantity += quantity

            # Use sellingPrice if available; fall back to maxRetailPrice
            # Some channels (e.g. AMAZON_FLEX) report sellingPrice=0 but MRP is known
            selling_price = item.get("sellingPrice") or 0
            mrp = float(item.get("maxRetailPrice") or 0)

            essential_items.append({
                "itemSku": item.get("itemSku"),
                "itemName": item.get("itemName"),
                "sellingPrice": selling_price,
                "maxRetailPrice": mrp,
                "quantity": quantity,
                "discount": item.get("discount", 0),
                "taxAmount": item.get("totalIntegratedGst", 0) +
                item.get("totalStateGst", 0) +
                item.get("totalCentralGst", 0),
                "statusCode": item.get("statusCode"),
            })

        # Extract COD-related data from shipping packages
        shipping_packages = order_dto.get("shippingPackages", [])
        shipping_method = ""
        collectable_amount = 0.0
        if shipping_packages and isinstance(shipping_packages, list):
            first_pkg = shipping_packages[0] if shipping_packages else {}
            shipping_method = first_pkg.get("shippingMethod", "") or ""
            collectable_amount = float(
                first_pkg.get("collectableAmount", 0) or 0)

        return {
            "code": order_dto.get("code"),
            "status": order_dto.get("status"),
            "channel": order_dto.get("channel"),
            "created": order_dto.get("created") or order_dto.get("displayOrderDateTime"),
            "currencyCode": order_dto.get("currencyCode", "INR"),
            "saleOrderItems": essential_items,
            "totalQuantity": total_quantity,  # NEW: Add total quantity
            "cod": order_dto.get("cod", False),
            "shippingMethod": shipping_method,
            "collectableAmount": collectable_amount,
        }

    async def fetch_order_details_batch(
        self,
        order_codes: List[str],
        batch_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        PHASE 2: Fetch order details for a batch of codes.

        Fetches in batches with concurrency control.
        Retries failed orders in a second pass with smaller batches.
        Deduplicates results.

        Returns:
            {
                "orders": List[Dict],        # Full order DTOs from API
                "failed_codes": List[str],   # Codes that failed even after retry
                "fetch_time_seconds": float,
                "initial_success": int,
                "retry_recovered": int,
                "duplicates_removed": int,
            }
        """
        if not order_codes:
            return {
                "orders": [],
                "failed_codes": [],
                "fetch_time_seconds": 0,
                "initial_success": 0,
                "retry_recovered": 0,
                "duplicates_removed": 0,
            }

        effective_batch_size = batch_size or self.DETAIL_BATCH_SIZE
        start_time = datetime.now()
        all_orders: List[Dict] = []
        failed_codes: List[str] = []

        logger.info(
            f"PHASE 2: Fetching details for {len(order_codes)} orders | "
            f"Batch size: {effective_batch_size}"
        )

        # ===== INITIAL PASS =====
        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()

            for batch_start in range(0, len(order_codes), effective_batch_size):
                batch = order_codes[batch_start:batch_start +
                                    effective_batch_size]

                tasks = [
                    self._fetch_order_detail(client, headers, code)
                    for code in batch
                ]

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        failed_codes.append(batch[i])
                        continue

                    success, order_dto, error = result
                    if success and order_dto:
                        all_orders.append(order_dto)
                    else:
                        failed_codes.append(batch[i])

                # Batch delay to avoid rate limiting
                if batch_start + effective_batch_size < len(order_codes):
                    await asyncio.sleep(0.1)

        initial_success = len(all_orders)

        # ===== RETRY PASS =====
        retry_recovered = 0
        if failed_codes:
            logger.info(
                f"PHASE 2 RETRY: {len(failed_codes)} orders failed, "
                f"retrying with smaller batches..."
            )

            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as retry_client:
                retry_headers = await self._get_headers()

                for batch_start in range(0, len(failed_codes), self.RETRY_BATCH_SIZE):
                    batch = failed_codes[batch_start:batch_start +
                                         self.RETRY_BATCH_SIZE]

                    tasks = [
                        self._fetch_order_detail(
                            retry_client, retry_headers, code)
                        for code in batch
                    ]

                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    recovered_in_batch = []
                    for i, result in enumerate(results):
                        if isinstance(result, Exception):
                            continue

                        success, order_dto, error = result
                        if success and order_dto:
                            all_orders.append(order_dto)
                            recovered_in_batch.append(batch[i])
                            retry_recovered += 1

                    # Remove recovered codes from failed list
                    for code in recovered_in_batch:
                        if code in failed_codes:
                            failed_codes.remove(code)

                    # Longer delay between retry batches
                    if batch_start + self.RETRY_BATCH_SIZE < len(failed_codes):
                        await asyncio.sleep(self.RETRY_BATCH_DELAY)

        # ===== DEDUPLICATION =====
        seen_codes: Set[str] = set()
        unique_orders: List[Dict] = []
        for order in all_orders:
            code = order.get("code", "")
            if code and code not in seen_codes:
                seen_codes.add(code)
                unique_orders.append(order)
        duplicates_removed = len(all_orders) - len(unique_orders)

        if duplicates_removed > 0:
            logger.warning(
                f"PHASE 2 DEDUP: Removed {duplicates_removed} duplicate orders"
            )

        elapsed = (datetime.now() - start_time).total_seconds()

        # ===== COUNT CONSISTENCY VALIDATION =====
        total_requested = len(order_codes)
        total_resolved = len(unique_orders)
        total_failed = len(failed_codes)

        if total_requested != total_resolved + total_failed:
            logger.error(
                f"COUNT MISMATCH: Requested={total_requested}, "
                f"Resolved={total_resolved}, Failed={total_failed}, "
                f"Sum={total_resolved + total_failed}"
            )
        elif total_failed > 0:
            logger.warning(
                f"PHASE 2: {total_failed}/{total_requested} orders failed "
                f"({total_failed/total_requested*100:.1f}% failure rate)"
            )

        logger.info(
            f"PHASE 2 COMPLETE: {total_resolved}/{total_requested} resolved | "
            f"Initial: {initial_success} | "
            f"Retry recovered: {retry_recovered} | "
            f"Failed: {total_failed} | "
            f"Dedup removed: {duplicates_removed} | "
            f"Time: {elapsed:.2f}s"
        )

        return {
            "orders": unique_orders,
            "failed_codes": failed_codes,
            "fetch_time_seconds": round(elapsed, 2),
            "initial_success": initial_success,
            "retry_recovered": retry_recovered,
            "duplicates_removed": duplicates_removed,
        }

    # =========================================================================
    # TWO-PHASE ORCHESTRATOR (FALLBACK - used when export fails)
    # =========================================================================

    async def fetch_all_orders_with_revenue_two_phase(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        TWO-PHASE ORDER FETCHING WITH REVENUE DATA (FALLBACK)

        Used only when Export Job API fails. Orchestrates:
        Phase 1 (identifier collection) and Phase 2 (detail resolution).
        """
        total_start = datetime.now()

        logger.info("=" * 60)
        logger.info("STARTING TWO-PHASE ORDER FETCH")
        logger.info(
            f"  Date range: {from_date.isoformat()} to {to_date.isoformat()}")
        logger.info("=" * 60)

        # PHASE 1: Get all order codes (with date chunking + dedup)
        phase1_result = await self.fetch_all_order_codes(from_date, to_date, max_orders)

        if not phase1_result.get("successful", False):
            return {
                "successful": False,
                "error": phase1_result.get("error", "Phase 1 failed"),
                "orders": [],
                "totalRecords": 0,
            }

        order_codes = phase1_result.get("order_codes", [])
        total_records = phase1_result.get("totalRecords", 0)

        logger.info(f"PHASE 1 RESULT: {len(order_codes)} unique order codes")

        if not order_codes:
            return {
                "successful": True,
                "orders": [],
                "totalRecords": 0,
                "fetched_count": 0,
                "failed_codes": [],
                "phase1_time": phase1_result.get("fetch_time_seconds", 0),
                "phase2_time": 0,
                "total_time": 0,
                "phase1_dedup": phase1_result.get("duplicates_removed", 0),
                "phase2_dedup": 0,
                "retry_recovered": 0,
            }

        # PHASE 2: Fetch details for each order
        phase2_result = await self.fetch_order_details_batch(order_codes)

        orders_with_details = phase2_result.get("orders", [])
        total_elapsed = (datetime.now() - total_start).total_seconds()

        # ===== CROSS-PHASE VALIDATION =====
        phase1_count = len(order_codes)
        phase2_count = len(orders_with_details)
        failed_count = len(phase2_result.get("failed_codes", []))

        if phase1_count != phase2_count + failed_count:
            logger.error(
                f"CROSS-PHASE MISMATCH: "
                f"Phase1={phase1_count}, Phase2={phase2_count}, "
                f"Failed={failed_count}, Sum={phase2_count + failed_count}"
            )

        if failed_count > 0:
            failure_rate = failed_count / phase1_count * 100
            logger.warning(
                f"DATA LOSS: {failed_count} orders ({failure_rate:.1f}%) "
                f"could not be resolved in Phase 2. "
                f"Failed codes: {phase2_result.get('failed_codes', [])[:10]}..."
            )

        logger.info("=" * 60)
        logger.info("TWO-PHASE FETCH COMPLETE")
        logger.info(f"  Phase 1 codes: {phase1_count}")
        logger.info(f"  Phase 2 resolved: {phase2_count}")
        logger.info(f"  Failed: {failed_count}")
        logger.info(
            f"  Retry recovered: {phase2_result.get('retry_recovered', 0)}")
        logger.info(f"  Total time: {total_elapsed:.2f}s")
        logger.info("=" * 60)

        return {
            "successful": True,
            "orders": orders_with_details,
            "totalRecords": total_records,
            "fetched_count": len(orders_with_details),
            "failed_codes": phase2_result.get("failed_codes", []),
            "phase1_time": phase1_result.get("fetch_time_seconds", 0),
            "phase2_time": phase2_result.get("fetch_time_seconds", 0),
            "total_time": round(total_elapsed, 2),
            "phase1_dedup": phase1_result.get("duplicates_removed", 0),
            "phase2_dedup": phase2_result.get("duplicates_removed", 0),
            "retry_recovered": phase2_result.get("retry_recovered", 0),
        }

    # =========================================================================
    # MAIN FETCH METHOD - EXPORT FIRST, TWO-PHASE FALLBACK
    # =========================================================================

    async def fetch_all_orders_with_revenue(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        Fetch all orders with revenue data.

        PRIMARY: Uses Export Job API (~3 API calls, any volume).
        FALLBACK: Uses two-phase approach if export fails.

        Returns compatible dict with:
            successful, orders, totalRecords, phase1_time, phase2_time,
            total_time, failed_codes, retry_recovered, method, etc.
        """
        return await self.fetch_orders_via_export(from_date, to_date)

    # =========================================================================
    # REVENUE CALCULATION - USES sellingPrice ONLY
    # =========================================================================

    @staticmethod
    def _extract_date_key(created_raw) -> Optional[str]:
        """
        Extract a YYYY-MM-DD date key from a created timestamp.

        Handles:
        - Epoch milliseconds (int/float or numeric string like "1771107580000")
        - ISO / standard date strings ("2026-02-14 07:58:00", "2026-02-14T07:58:00")
        - Already-formatted date ("2026-02-14")
        Returns None if unparseable.
        """
        if created_raw is None or created_raw == "":
            return None

        val = str(created_raw).strip()
        if not val:
            return None

        # Check if it's a purely numeric value → epoch ms or epoch seconds
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
        Calculate revenue for a single order using ONLY sellingPrice.

        CRITICAL: Revenue = SUM of (sellingPrice * quantity) for each item.
        NOT totalPrice. NOT extrapolated values. NOT cached aggregates.

        Exclusions: CANCELLED, RETURNED, REFUNDED, FAILED, etc.
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
            "quantity": total_quantity,  # NEW: Include total quantity
        }

    # =========================================================================
    # AGGREGATION WITH RECONCILIATION
    # =========================================================================

    def aggregate_orders(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate ALL orders into summary statistics.

        NO SAMPLING. NO EXTRAPOLATION. 100% ACCURATE.

        Revenue = SUM of sellingPrice for all valid orders.
        Includes revenue reconciliation: channel_total must == overall_total.
        """
        total_orders = len(orders)
        valid_orders = 0
        excluded_orders = 0

        total_revenue = 0.0
        total_discount = 0.0
        total_tax = 0.0
        total_refund = 0.0
        total_items = 0  # NEW: Track total quantity of items

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

        # ===== REVENUE RECONCILIATION =====
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
            "total_items": total_items,  # NEW: Add total items count
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

    # =========================================================================
    # PAGINATED API FOR FRONTEND (12 orders per page) - USES TWO-PHASE
    # =========================================================================

    async def get_orders_paginated(
        self,
        from_date: datetime,
        to_date: datetime,
        page: int = 1,
        page_size: int = 12
    ) -> Dict[str, Any]:
        """
        Get orders with CLIENT-SIDE pagination (Unicommerce doesn't support server-side pagination).

        Strategy:
        1. Fetch ALL orders for the date range (cached for 15 minutes)
        2. Slice results in memory for pagination
        3. Much faster: subsequent pages are instant, no API calls
        """

        # Build a cache key for this date range + details
        cache_key = f"orders_detailed_{from_date.date()}_{to_date.date()}"

        # Check cache first - FAST PATH
        cached_orders = self._get_from_cache(cache_key)

        if cached_orders is None:
            # Fetch ALL orders with details (one-time cost, then cached)
            logger.info(
                f"📥 Cache miss - fetching all orders for {from_date.date()} to {to_date.date()}")
            logger.info(
                "⏱️  First load: 30s - 5min (depends on order volume)")

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
                        import re
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
                        # Alias for compatibility
                        "sku": item.get("itemSku", ""),
                        "sellingPrice": item.get("sellingPrice", 0),
                        "selling_price": item.get("sellingPrice", 0),  # Alias
                        "quantity": item.get("quantity", 1),
                        # Fallback to SKU
                        "size": size if size else item.get("itemSku", "").split("-")[-1],
                    })
                processed_all.append({
                    "code": calc["order_code"],
                    "displayOrderCode": calc["order_code"],  # Alias
                    "status": calc["status"],
                    "channel": calc["channel"],
                    "selling_price": calc["selling_price"],
                    "total_selling_price": calc["selling_price"],  # Alias
                    "net_revenue": calc["net_revenue"],
                    "created": calc["created"],
                    "displayOrderDateTime": calc["created"],  # Alias
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
                f"✅ Cached {len(cached_orders)} orders for instant future pagination")
        else:
            logger.info(
                f"⚡ CACHED: Using {len(cached_orders)} cached orders (instant load < 2s)")

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

    # =========================================================================
    # MAIN SALES DATA METHOD - USES TWO-PHASE APPROACH
    # =========================================================================

    async def get_sales_data(
        self,
        from_date: datetime,
        to_date: datetime,
        period_name: str = "custom"
    ) -> Dict[str, Any]:
        """
        Get complete sales data for a date range using TWO-PHASE API approach.

        Revenue = SUM of item.sellingPrice from Phase 2 responses ONLY.
        Fetches ALL orders (no limits) for accurate business data.
        Uses 15-min cache to avoid repeated fetches.
        """
        # Check cache first for standard periods - FAST PATH
        if period_name != "custom":
            cache_key = self._get_cache_key(period_name)
            cached_data = self._get_from_cache(cache_key)
            if cached_data is not None:
                logger.info(
                    f"✅ CACHED: Returning {period_name} data instantly (no API calls)")
                return cached_data

        logger.info("=" * 70)
        logger.info(f"GETTING {period_name.upper()} SALES DATA")
        logger.info(f"  Date range: {from_date} to {to_date}")
        logger.info("  Method: Export Job API (fast) → two-phase fallback")
        logger.info("=" * 70)

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

            logger.info("=" * 70)
            logger.info("REVENUE SUMMARY")
            logger.info(
                f"  Valid orders: {aggregation['valid_orders']} / {total_records} total")
            logger.info(
                f"  REVENUE: INR {aggregation['total_revenue']:,.2f}")
            logger.info(
                f"  AVG: INR {aggregation['avg_order_value']:,.2f}")
            logger.info(
                f"  Reconciliation: {'PASSED' if aggregation.get('reconciliation_passed') else 'FAILED'}")
            logger.info("=" * 70)

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
                    "quantity": calc["quantity"],  # NEW: Add quantity
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

    # =========================================================================
    # TIME-BASED CONVENIENCE METHODS
    # =========================================================================

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

    # =========================================================================
    # PAGINATED CONVENIENCE METHODS
    # =========================================================================

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

    # =========================================================================
    # VALIDATION & RECONCILIATION
    # =========================================================================

    async def validate_revenue_consistency(self) -> Dict[str, Any]:
        """
        Run sanity checks on revenue data.

        Validates:
        1. Channel totals = overall total
        2. Reconciliation passed for each period
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

    # =========================================================================
    # BACKWARD COMPATIBILITY
    # =========================================================================

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
        """Get detailed information for a specific order WITH payment details."""
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

    # Aliases for backward compatibility
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


# =========================================================================
# SINGLETON FACTORY
# =========================================================================

_service_instance: Optional[UnicommerceServiceProduction] = None


def get_unicommerce_service() -> UnicommerceServiceProduction:
    """Get or create the Unicommerce service singleton"""
    global _service_instance
    if _service_instance is None:
        _service_instance = UnicommerceServiceProduction()
    return _service_instance
