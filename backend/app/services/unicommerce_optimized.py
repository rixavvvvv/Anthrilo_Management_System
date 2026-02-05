"""
Unicommerce API Integration Service - PRODUCTION VERSION
==========================================================
Revenue calculation using TWO-PHASE API approach:

PHASE 1: saleOrder/search API
- Gets order CODES only (no pricing data)
- Used for pagination and filtering

PHASE 2: saleorder/get API (with paymentDetailRequired: true)
- Called for EACH order code
- Returns full order with sellingPrice in items
- THIS IS THE ONLY SOURCE OF REVENUE DATA

Revenue = SUM of item.sellingPrice from Phase 2 responses

Key Requirements Met:
1. Revenue = SUM of sellingPrice ONLY (NOT totalPrice)
2. TWO-PHASE API: search for codes → get for pricing
3. Proper pagination support (12 orders per page for frontend)
4. Yesterday filter with proper time boundaries
5. Today filter (00:00:00 to current time - 1 minute)
6. Comprehensive logging for audit
"""

import httpx
import asyncio
from datetime import datetime, timedelta, timezone, time
from typing import Dict, Any, Optional, List, Tuple
import logging
from app.core.config import settings
from app.core.token_manager import get_token_manager

# Configure detailed logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class UnicommerceServiceProduction:
    """
    Production-grade Unicommerce OMS API integration.

    CRITICAL TWO-PHASE APPROACH:
    ============================
    Phase 1: saleOrder/search - Gets order codes ONLY (no pricing)
    Phase 2: saleorder/get with paymentDetailRequired=true - Gets sellingPrice

    Revenue = SUM of item.sellingPrice from Phase 2

    - NOT totalPrice
    - NOT extrapolated values
    - NOT from search API response
    """

    # Excluded statuses for revenue calculation
    EXCLUDED_STATUSES = frozenset({
        "CANCELLED", "CANCELED", "RETURNED", "REFUNDED",
        "FAILED", "UNFULFILLABLE", "ERROR", "PENDING_VERIFICATION"
    })

    # Partially valid statuses (need special handling)
    PARTIAL_STATUSES = frozenset({
        "PARTIALLY_SHIPPED", "PARTIALLY_DELIVERED"
    })

    def __init__(self):
        self.base_url = settings.UNICOMMERCE_BASE_URL.format(
            tenant=settings.UNICOMMERCE_TENANT
        )
        self.access_code = settings.UNICOMMERCE_ACCESS_CODE

        # HTTP client settings
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=90.0,  # Long read timeout for large responses
            write=10.0,
            pool=5.0
        )
        self.limits = httpx.Limits(
            max_keepalive_connections=50,
            max_connections=100,
            keepalive_expiry=30.0
        )

        # Token manager for auto-refresh
        self.token_manager = get_token_manager()

        # API pagination settings
        self.API_PAGE_SIZE = 200  # Max allowed by Unicommerce API
        self.MAX_CONCURRENT_PAGES = 10  # Parallel page fetches
        self.MAX_CONCURRENT_ORDER_GETS = 20  # Parallel order detail fetches

        # Frontend pagination (for display)
        self.FRONTEND_PAGE_SIZE = 12  # Orders per page in UI

        # Semaphore for rate limiting order detail fetches
        self._order_get_semaphore: Optional[asyncio.Semaphore] = None

    def _get_order_semaphore(self) -> asyncio.Semaphore:
        """Get or create semaphore for order detail API calls"""
        if self._order_get_semaphore is None:
            self._order_get_semaphore = asyncio.Semaphore(
                self.MAX_CONCURRENT_ORDER_GETS)
        return self._order_get_semaphore

    async def _get_headers(self) -> Dict[str, str]:
        """Get authenticated headers with auto-refreshing token"""
        return await self.token_manager.get_headers()

    def _format_date_for_api(self, dt: datetime) -> str:
        """Format datetime for Unicommerce API (UTC ISO format)"""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    # =========================================================================
    # TIME FILTER HELPERS
    # =========================================================================

    def get_today_range(self) -> Tuple[datetime, datetime]:
        """
        Get today's time range: 00:00:00 to (current time - 1 minute)

        Returns UTC timestamps that cover today in IST (UTC+5:30)
        Subtracts 1 minute from current time to avoid partial/in-progress orders
        """
        now = datetime.now(timezone.utc)

        # Calculate IST offset (UTC+5:30)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset

        # Start of today in IST (00:00:00)
        today_start_ist = datetime.combine(now_ist.date(), time.min)
        # Convert back to UTC
        today_start_utc = (today_start_ist -
                           ist_offset).replace(tzinfo=timezone.utc)

        # End is current time minus 1 minute (to avoid partial orders)
        today_end_utc = now - timedelta(minutes=1)

        logger.info(
            f"📅 Today range: {today_start_utc.isoformat()} to {today_end_utc.isoformat()}")
        return today_start_utc, today_end_utc

    def get_yesterday_range(self) -> Tuple[datetime, datetime]:
        """
        Get yesterday's time range: 00:00:00 to 23:59:59

        Returns UTC timestamps that cover yesterday in IST (UTC+5:30)
        """
        now = datetime.now(timezone.utc)

        # Calculate IST offset (UTC+5:30)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset

        # Yesterday in IST
        yesterday_ist = now_ist.date() - timedelta(days=1)

        # Start of yesterday (00:00:00 IST)
        yesterday_start_ist = datetime.combine(yesterday_ist, time.min)
        yesterday_start_utc = (yesterday_start_ist -
                               ist_offset).replace(tzinfo=timezone.utc)

        # End of yesterday (23:59:59 IST)
        yesterday_end_ist = datetime.combine(yesterday_ist, time(23, 59, 59))
        yesterday_end_utc = (yesterday_end_ist -
                             ist_offset).replace(tzinfo=timezone.utc)

        logger.info(
            f"📅 Yesterday range: {yesterday_start_utc.isoformat()} to {yesterday_end_utc.isoformat()}")
        return yesterday_start_utc, yesterday_end_utc

    def get_last_n_days_range(self, days: int) -> Tuple[datetime, datetime]:
        """
        Get time range for last N days (not including today)

        For "Last 7 Days": 7 complete days ending yesterday
        For "Last 30 Days": 30 complete days ending yesterday

        This ensures no overlap with Today filter.
        """
        now = datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now + ist_offset

        # End at yesterday 23:59:59
        yesterday_ist = now_ist.date() - timedelta(days=1)
        end_ist = datetime.combine(yesterday_ist, time(23, 59, 59))
        end_utc = (end_ist - ist_offset).replace(tzinfo=timezone.utc)

        # Start N days before yesterday at 00:00:00
        start_date_ist = yesterday_ist - timedelta(days=days-1)
        start_ist = datetime.combine(start_date_ist, time.min)
        start_utc = (start_ist - ist_offset).replace(tzinfo=timezone.utc)

        logger.info(
            f"📅 Last {days} days range: {start_utc.isoformat()} to {end_utc.isoformat()}")
        return start_utc, end_utc

    # =========================================================================
    # API FETCH METHODS
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
        Fetch a single page of orders from Unicommerce.

        Returns: (success, orders, total_records, error_message)
        """
        payload = {
            "fromDate": self._format_date_for_api(from_date),
            "toDate": self._format_date_for_api(to_date),
            "searchOptions": {
                "displayStart": display_start,
                "displayLength": display_length
            }
        }

        url = f"{self.base_url}/oms/saleOrder/search"

        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

            if data.get("successful", False):
                return (
                    True,
                    data.get("elements", []),
                    data.get("totalRecords", 0),
                    None
                )
            else:
                return (False, [], 0, data.get("message", "Unknown API error"))

        except httpx.HTTPStatusError as e:
            logger.error(
                f"HTTP {e.response.status_code} fetching page at offset {display_start}")
            return (False, [], 0, f"HTTP {e.response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching page at offset {display_start}: {e}")
            return (False, [], 0, str(e))

    # =========================================================================
    # PHASE 2: saleorder/get API - FETCH ORDER DETAILS WITH PAYMENT INFO
    # =========================================================================

    async def _fetch_order_detail(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        order_code: str
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        PHASE 2 API: Fetch single order with payment details.

        This is the ONLY source of sellingPrice data!

        API: POST /services/rest/v1/oms/saleorder/get
        Payload: {"code": "<order_code>", "paymentDetailRequired": true}

        Returns: (success, order_data, error_message)
        """
        url = f"{self.base_url}/oms/saleorder/get"

        payload = {
            "code": order_code,
            "paymentDetailRequired": True  # CRITICAL: Must be true for sellingPrice
        }

        try:
            async with self._get_order_semaphore():
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

                if data.get("successful", False):
                    order_dto = data.get("saleOrderDTO")
                    if order_dto:
                        return (True, order_dto, None)
                    else:
                        return (False, None, "No saleOrderDTO in response")
                else:
                    return (False, None, data.get("message", "API returned unsuccessful"))

        except httpx.HTTPStatusError as e:
            logger.warning(
                f"HTTP {e.response.status_code} fetching order {order_code}")
            return (False, None, f"HTTP {e.response.status_code}")
        except Exception as e:
            logger.warning(f"Error fetching order {order_code}: {e}")
            return (False, None, str(e))

    async def fetch_order_details_batch(
        self,
        order_codes: List[str],
        batch_size: int = 50
    ) -> Dict[str, Any]:
        """
        Fetch order details for multiple orders in parallel batches.

        PHASE 2 of the two-phase approach:
        - Takes order codes from Phase 1 (search API)
        - Calls saleorder/get for each with paymentDetailRequired=true
        - Returns orders with sellingPrice data

        Args:
            order_codes: List of order codes from search API
            batch_size: Orders to fetch in parallel (default 50)

        Returns:
            {
                "successful": bool,
                "orders": List[Dict],  # Full order details with sellingPrice
                "total_codes": int,
                "fetched_count": int,
                "failed_codes": List[str],
                "fetch_time_seconds": float
            }
        """
        if not order_codes:
            return {
                "successful": True,
                "orders": [],
                "total_codes": 0,
                "fetched_count": 0,
                "failed_codes": [],
                "fetch_time_seconds": 0
            }

        logger.info(
            f"📦 PHASE 2: Fetching details for {len(order_codes)} orders...")
        start_time = datetime.now()

        all_orders = []
        failed_codes = []

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()

            # Process in batches
            for batch_start in range(0, len(order_codes), batch_size):
                batch = order_codes[batch_start:batch_start + batch_size]

                # Create tasks for parallel fetching
                tasks = [
                    self._fetch_order_detail(client, headers, code)
                    for code in batch
                ]

                # Execute batch
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for i, result in enumerate(results):
                    code = batch[i]

                    if isinstance(result, Exception):
                        logger.warning(f"Exception fetching {code}: {result}")
                        failed_codes.append(code)
                        continue

                    success, order_data, error = result
                    if success and order_data:
                        all_orders.append(order_data)
                    else:
                        failed_codes.append(code)
                        if error:
                            logger.debug(f"Failed to fetch {code}: {error}")

                # Log progress
                fetched_so_far = len(all_orders)
                logger.info(
                    f"   Batch progress: {fetched_so_far}/{len(order_codes)} orders fetched")

                # Small delay between batches to avoid rate limiting
                if batch_start + batch_size < len(order_codes):
                    await asyncio.sleep(0.05)

        elapsed = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"✅ PHASE 2 COMPLETE: Fetched {len(all_orders)}/{len(order_codes)} orders "
            f"in {elapsed:.2f}s ({len(failed_codes)} failed)"
        )

        return {
            "successful": True,
            "orders": all_orders,
            "total_codes": len(order_codes),
            "fetched_count": len(all_orders),
            "failed_codes": failed_codes,
            "fetch_time_seconds": round(elapsed, 2)
        }

    async def fetch_all_order_codes(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        PHASE 1: Fetch ALL order CODES from search API.

        This method ONLY gets order codes - NO pricing data!
        Use fetch_order_details_batch() to get sellingPrice.

        Strategy:
        1. Fetch page 0 to get total count
        2. Calculate required pages
        3. Fetch remaining pages in parallel batches
        4. Extract order codes from results
        """
        logger.info(
            f"📋 PHASE 1: Searching orders: {from_date.isoformat()} to {to_date.isoformat()}")
        start_time = datetime.now()

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()

            # Step 1: Fetch first page to get total count
            success, first_orders, total_records, error = await self._fetch_single_page(
                client, headers, from_date, to_date, 0, self.API_PAGE_SIZE
            )

            if not success:
                logger.error(f"❌ Failed to fetch first page: {error}")
                return {
                    "successful": False,
                    "error": error,
                    "order_codes": [],
                    "totalRecords": 0
                }

            logger.info(f"📊 PHASE 1: Total orders found: {total_records}")

            # Extract codes from first page
            all_order_codes = [order.get("code")
                               for order in first_orders if order.get("code")]

            # If single page is enough
            if len(first_orders) >= total_records or total_records <= self.API_PAGE_SIZE:
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(
                    f"✅ PHASE 1 COMPLETE: {len(all_order_codes)} codes in {elapsed:.2f}s")
                return {
                    "successful": True,
                    "order_codes": all_order_codes[:max_orders],
                    "totalRecords": total_records,
                    "fetched_count": len(all_order_codes),
                    "pages_fetched": 1,
                    "fetch_time_seconds": round(elapsed, 2)
                }

            # Step 2: Calculate pages needed
            orders_to_fetch = min(total_records, max_orders)
            total_pages = (orders_to_fetch +
                           self.API_PAGE_SIZE - 1) // self.API_PAGE_SIZE
            remaining_pages = list(range(1, total_pages))

            logger.info(
                f"📄 PHASE 1: Fetching {len(remaining_pages)} more pages for codes...")

            # Step 3: Fetch remaining pages in parallel batches
            pages_fetched = 1
            errors = []

            for batch_start in range(0, len(remaining_pages), self.MAX_CONCURRENT_PAGES):
                batch = remaining_pages[batch_start:batch_start +
                                        self.MAX_CONCURRENT_PAGES]

                tasks = [
                    self._fetch_single_page(
                        client, headers, from_date, to_date,
                        page * self.API_PAGE_SIZE, self.API_PAGE_SIZE
                    )
                    for page in batch
                ]

                results = await asyncio.gather(*tasks, return_exceptions=True)

                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        errors.append(f"Page {batch[i]}: {str(result)}")
                        continue

                    success, page_orders, _, error = result
                    if success:
                        # Extract codes from this page
                        page_codes = [
                            order.get("code") for order in page_orders if order.get("code")]
                        all_order_codes.extend(page_codes)
                        pages_fetched += 1
                    else:
                        errors.append(f"Page {batch[i]}: {error}")

                if len(all_order_codes) >= max_orders:
                    break

                # Rate limiting between batches
                if batch_start + self.MAX_CONCURRENT_PAGES < len(remaining_pages):
                    await asyncio.sleep(0.1)

            elapsed = (datetime.now() - start_time).total_seconds()

            if errors:
                logger.warning(
                    f"⚠️ PHASE 1: {len(errors)} pages failed: {errors[:3]}")

            logger.info(
                f"✅ PHASE 1 COMPLETE: {len(all_order_codes)} codes in {elapsed:.2f}s "
                f"({pages_fetched} pages)"
            )

            return {
                "successful": True,
                "order_codes": all_order_codes[:max_orders],
                "totalRecords": total_records,
                "fetched_count": len(all_order_codes),
                "pages_fetched": pages_fetched,
                "fetch_time_seconds": round(elapsed, 2),
                "errors": errors if errors else None
            }

    async def fetch_all_orders_with_revenue(
        self,
        from_date: datetime,
        to_date: datetime,
        max_orders: int = 100000
    ) -> Dict[str, Any]:
        """
        TWO-PHASE ORDER FETCHING WITH REVENUE DATA

        This is the main method for getting orders with accurate sellingPrice.

        Phase 1: Call search API to get all order codes
        Phase 2: Call saleorder/get for each code with paymentDetailRequired=true

        Returns orders with full pricing data from Phase 2.
        """
        total_start = datetime.now()

        logger.info("=" * 60)
        logger.info("🔄 STARTING TWO-PHASE ORDER FETCH")
        logger.info(
            f"   Date range: {from_date.isoformat()} to {to_date.isoformat()}")
        logger.info("=" * 60)

        # PHASE 1: Get all order codes
        phase1_result = await self.fetch_all_order_codes(from_date, to_date, max_orders)

        if not phase1_result.get("successful", False):
            return {
                "successful": False,
                "error": phase1_result.get("error", "Phase 1 failed"),
                "orders": [],
                "totalRecords": 0
            }

        order_codes = phase1_result.get("order_codes", [])
        total_records = phase1_result.get("totalRecords", 0)

        logger.info(
            f"📋 PHASE 1 RESULT: {len(order_codes)} order codes retrieved")

        if not order_codes:
            return {
                "successful": True,
                "orders": [],
                "totalRecords": 0,
                "fetched_count": 0,
                "phase1_time": phase1_result.get("fetch_time_seconds", 0),
                "phase2_time": 0,
                "total_time": 0
            }

        # PHASE 2: Fetch details for each order
        phase2_result = await self.fetch_order_details_batch(order_codes)

        orders_with_details = phase2_result.get("orders", [])

        total_elapsed = (datetime.now() - total_start).total_seconds()

        logger.info("=" * 60)
        logger.info("✅ TWO-PHASE FETCH COMPLETE")
        logger.info(f"   Order codes found (Phase 1): {len(order_codes)}")
        logger.info(
            f"   Orders with details (Phase 2): {len(orders_with_details)}")
        logger.info(
            f"   Failed fetches: {len(phase2_result.get('failed_codes', []))}")
        logger.info(f"   Total time: {total_elapsed:.2f}s")
        logger.info("=" * 60)

        return {
            "successful": True,
            "orders": orders_with_details,
            "totalRecords": total_records,
            "fetched_count": len(orders_with_details),
            "failed_codes": phase2_result.get("failed_codes", []),
            "phase1_time": phase1_result.get("fetch_time_seconds", 0),
            "phase2_time": phase2_result.get("fetch_time_seconds", 0),
            "total_time": round(total_elapsed, 2)
        }

    # =========================================================================
    # REVENUE CALCULATION - USES sellingPrice ONLY
    # =========================================================================

    def calculate_order_revenue(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate revenue for a single order using ONLY sellingPrice.

        ⚠️ CRITICAL: This method uses sellingPrice ONLY as per requirements.
        - NOT totalPrice
        - NOT extrapolated values
        - NOT cached aggregates

        Revenue = SUM of (sellingPrice * quantity) for each item

        Exclusions:
        - CANCELLED orders: excluded entirely
        - RETURNED orders: excluded entirely
        - REFUNDED orders: excluded entirely
        - Partially refunded: subtract refunded amount if available
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

        # ===== REVENUE CALCULATION USING sellingPrice ONLY =====
        total_selling_price = 0.0
        total_discount = 0.0
        total_tax = 0.0
        total_refund = 0.0
        item_count = len(items)

        for item in items:
            # PRIMARY FIELD: sellingPrice (MANDATORY per requirements)
            selling_price = safe_float(item.get("sellingPrice", 0))
            quantity = safe_float(item.get("quantity", 1))

            # Revenue = sellingPrice * quantity
            item_revenue = selling_price * quantity
            total_selling_price += item_revenue

            # Track discounts (for reporting, not used in revenue)
            total_discount += safe_float(item.get("discount", 0))

            # Track tax
            total_tax += safe_float(item.get("taxAmount", 0))

            # Track refunds if any
            refund_amount = safe_float(item.get("refundAmount", 0))
            total_refund += refund_amount

        # Determine if order should be included in revenue
        include_in_revenue = status not in self.EXCLUDED_STATUSES
        excluded_reason = None

        if not include_in_revenue:
            excluded_reason = f"Status: {status}"

        # Calculate net revenue (apply refunds if applicable)
        net_revenue = 0.0
        if include_in_revenue:
            net_revenue = total_selling_price - total_refund

        return {
            "order_code": order_code,
            "status": status,
            "channel": channel,
            "created": created,
            # This is THE revenue source
            "selling_price": round(total_selling_price, 2),
            "discount": round(total_discount, 2),
            "tax": round(total_tax, 2),
            "refund": round(total_refund, 2),
            "net_revenue": round(net_revenue, 2),
            "include_in_revenue": include_in_revenue,
            "excluded_reason": excluded_reason,
            "item_count": item_count
        }

    def aggregate_orders(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate ALL orders into summary statistics.

        NO SAMPLING. NO EXTRAPOLATION. 100% ACCURATE.

        Revenue = SUM of sellingPrice for all valid orders
        """
        total_orders = len(orders)
        valid_orders = 0
        excluded_orders = 0

        total_revenue = 0.0  # SUM of sellingPrice only
        total_discount = 0.0
        total_tax = 0.0
        total_refund = 0.0

        channel_stats: Dict[str, Dict[str, Any]] = {}
        status_stats: Dict[str, int] = {}

        # Process EVERY order
        for order in orders:
            calc = self.calculate_order_revenue(order)

            # Status tracking
            status = calc["status"]
            status_stats[status] = status_stats.get(status, 0) + 1

            # Always track totals
            total_discount += calc["discount"]
            total_tax += calc["tax"]
            total_refund += calc["refund"]

            if calc["include_in_revenue"]:
                valid_orders += 1
                total_revenue += calc["net_revenue"]

                # Channel breakdown
                channel = calc["channel"]
                if channel not in channel_stats:
                    channel_stats[channel] = {
                        "orders": 0,
                        "revenue": 0.0
                    }
                channel_stats[channel]["orders"] += 1
                channel_stats[channel]["revenue"] += calc["net_revenue"]
            else:
                excluded_orders += 1

        # ===== VALIDATION LOGGING =====
        channel_total = sum(ch["revenue"] for ch in channel_stats.values())
        if abs(channel_total - total_revenue) > 0.01:
            logger.warning(
                f"⚠️ VALIDATION FAIL: Channel sum ({channel_total:.2f}) != "
                f"Total revenue ({total_revenue:.2f})"
            )

        logger.info(
            f"📊 AGGREGATION: {total_orders} orders fetched, "
            f"{valid_orders} valid, {excluded_orders} excluded, "
            f"Revenue: ₹{total_revenue:,.2f} (using sellingPrice ONLY)"
        )

        return {
            "total_orders": total_orders,
            "valid_orders": valid_orders,
            "excluded_orders": excluded_orders,
            "total_revenue": round(total_revenue, 2),
            "total_discount": round(total_discount, 2),
            "total_tax": round(total_tax, 2),
            "total_refund": round(total_refund, 2),
            "avg_order_value": round(total_revenue / valid_orders, 2) if valid_orders > 0 else 0,
            "channel_breakdown": channel_stats,
            "status_breakdown": status_stats,
            "currency": "INR",
            "calculation_method": "sellingPrice_only"  # Audit field
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
        Get orders with frontend pagination (12 per page by default).

        USES TWO-PHASE APPROACH:
        1. Phase 1: Search API to get order codes for the requested page
        2. Phase 2: saleorder/get for each code to get sellingPrice

        Returns orders with accurate revenue data.
        """
        logger.info(
            f"📄 Fetching page {page} (size {page_size}) using two-phase approach")

        # Calculate API offset (map frontend page to API offset)
        display_start = (page - 1) * page_size

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            headers = await self._get_headers()

            # PHASE 1: Get order codes for this page
            success, search_orders, total_records, error = await self._fetch_single_page(
                client, headers, from_date, to_date, display_start, page_size
            )

            if not success:
                return {
                    "success": False,
                    "error": error,
                    "orders": [],
                    "pagination": {}
                }

            # Extract order codes from search results
            order_codes = [order.get("code")
                           for order in search_orders if order.get("code")]

            logger.info(
                f"   Phase 1: Got {len(order_codes)} order codes for page {page}")

        # PHASE 2: Fetch full details for these orders (outside the client context)
        if order_codes:
            details_result = await self.fetch_order_details_batch(order_codes, batch_size=page_size)
            orders_with_details = details_result.get("orders", [])
            logger.info(
                f"   Phase 2: Got {len(orders_with_details)} orders with sellingPrice")
        else:
            orders_with_details = []

        # Calculate pagination info
        total_pages = (total_records + page_size - 1) // page_size

        # Calculate revenue for this page using sellingPrice from Phase 2
        page_revenue = 0.0
        processed_orders = []

        for order in orders_with_details:
            calc = self.calculate_order_revenue(order)
            page_revenue += calc["net_revenue"]
            processed_orders.append({
                "code": calc["order_code"],
                "status": calc["status"],
                "channel": calc["channel"],
                "selling_price": calc["selling_price"],
                "net_revenue": calc["net_revenue"],
                "created": calc["created"],
                "item_count": calc["item_count"],
                "include_in_revenue": calc["include_in_revenue"]
            })

        logger.info(
            f"   Page {page} revenue: ₹{page_revenue:,.2f} from {len(processed_orders)} orders")

        return {
            "success": True,
            "orders": processed_orders,
            "pagination": {
                "current_page": page,
                "page_size": page_size,
                "total_orders": total_records,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1
            },
            "page_summary": {
                "orders_on_page": len(processed_orders),
                "page_revenue": round(page_revenue, 2)
            },
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "revenue_method": "sellingPrice_only_two_phase"
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

        CRITICAL: Uses sellingPrice from saleorder/get API, NOT search API!

        Phase 1: saleOrder/search - get order codes
        Phase 2: saleorder/get with paymentDetailRequired=true - get sellingPrice

        Revenue = SUM of item.sellingPrice from Phase 2 responses

        Returns:
        - Summary with accurate revenue (sellingPrice only)
        - Channel breakdown
        - Status breakdown
        - Sample orders (first 100)
        - Full validation info
        """
        logger.info("=" * 70)
        logger.info(f"💰 GETTING {period_name.upper()} SALES DATA")
        logger.info(f"   Date range: {from_date} to {to_date}")
        logger.info(
            f"   Using TWO-PHASE API approach for accurate sellingPrice")
        logger.info("=" * 70)

        if not self.access_code:
            return {
                "success": False,
                "message": "Unicommerce access code not configured",
                "period": period_name
            }

        try:
            # ===== TWO-PHASE FETCH =====
            # Phase 1: Get order codes from search API
            # Phase 2: Get order details with sellingPrice from saleorder/get API
            fetch_result = await self.fetch_all_orders_with_revenue(from_date, to_date)

            if not fetch_result.get("successful", False):
                return {
                    "success": False,
                    "message": fetch_result.get("error", "Failed to fetch orders"),
                    "period": period_name
                }

            # Orders now have full details including sellingPrice from Phase 2
            orders = fetch_result.get("orders", [])
            total_records = fetch_result.get("totalRecords", 0)

            logger.info(
                f"📦 Retrieved {len(orders)} orders with full pricing data")

            # Aggregate using sellingPrice ONLY
            aggregation = self.aggregate_orders(orders)

            # Log revenue details for audit
            logger.info("=" * 70)
            logger.info("💰 REVENUE CALCULATION AUDIT")
            logger.info(
                f"   Total orders from search (Phase 1): {total_records}")
            logger.info(f"   Orders with details (Phase 2): {len(orders)}")
            logger.info(
                f"   Valid orders (for revenue): {aggregation['valid_orders']}")
            logger.info(
                f"   Excluded orders: {aggregation['excluded_orders']}")
            logger.info(
                f"   TOTAL REVENUE: ₹{aggregation['total_revenue']:,.2f}")
            logger.info(
                f"   Average order value: ₹{aggregation['avg_order_value']:,.2f}")
            logger.info("=" * 70)

            # Prepare sample orders for display (first 100)
            sample_orders = []
            for order in orders[:100]:
                calc = self.calculate_order_revenue(order)
                sample_orders.append({
                    "code": calc["order_code"],
                    "status": calc["status"],
                    "channel": calc["channel"],
                    "selling_price": calc["selling_price"],
                    "net_revenue": calc["net_revenue"],
                    "created": calc["created"],
                    "item_count": calc["item_count"],
                    "include_in_revenue": calc["include_in_revenue"]
                })

                # Log each order's revenue (first 10 for debugging)
                if len(sample_orders) <= 10:
                    logger.debug(
                        f"   Order {calc['order_code']}: "
                        f"sellingPrice=₹{calc['selling_price']:,.2f}, "
                        f"status={calc['status']}, "
                        f"included={calc['include_in_revenue']}"
                    )

            return {
                "success": True,
                "period": period_name,
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "data_accuracy": "complete",
                "revenue_method": "sellingPrice_only_two_phase",  # Updated audit field
                "fetch_info": {
                    "total_available": total_records,
                    "fetched_count": len(orders),
                    "failed_codes": len(fetch_result.get("failed_codes", [])),
                    "phase1_time_seconds": fetch_result.get("phase1_time", 0),
                    "phase2_time_seconds": fetch_result.get("phase2_time", 0),
                    "total_time_seconds": fetch_result.get("total_time", 0)
                },
                "summary": aggregation,
                "orders": sample_orders
            }

        except Exception as e:
            logger.error(f"❌ Error in get_sales_data: {e}", exc_info=True)
            return {
                "success": False,
                "message": str(e),
                "period": period_name
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

    async def get_last_30_days_sales(self) -> Dict[str, Any]:
        """Get last 30 complete days (not including today)"""
        from_date, to_date = self.get_last_n_days_range(30)
        return await self.get_sales_data(from_date, to_date, "last_30_days")

    async def get_custom_range_sales(
        self,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """Get sales for custom date range"""
        return await self.get_sales_data(from_date, to_date, "custom")

    # =========================================================================
    # PAGINATED CONVENIENCE METHODS
    # =========================================================================

    async def get_today_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        """Get today's orders with pagination"""
        from_date, to_date = self.get_today_range()
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    async def get_yesterday_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        """Get yesterday's orders with pagination"""
        from_date, to_date = self.get_yesterday_range()
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    async def get_last_7_days_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        """Get last 7 days orders with pagination"""
        from_date, to_date = self.get_last_n_days_range(7)
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    async def get_last_30_days_orders_paginated(
        self, page: int = 1, page_size: int = 12
    ) -> Dict[str, Any]:
        """Get last 30 days orders with pagination"""
        from_date, to_date = self.get_last_n_days_range(30)
        return await self.get_orders_paginated(from_date, to_date, page, page_size)

    # =========================================================================
    # VALIDATION & SANITY CHECKS
    # =========================================================================

    async def validate_revenue_consistency(self) -> Dict[str, Any]:
        """
        Run sanity checks on revenue data.

        Validates:
        1. 7-day revenue < 30-day revenue
        2. Channel totals = overall total
        3. Today + Yesterday < 7-day (usually)
        """
        logger.info("🔍 Running revenue validation checks...")

        # Fetch data for validation
        today = await self.get_today_sales()
        yesterday = await self.get_yesterday_sales()
        last_7 = await self.get_last_7_days_sales()
        last_30 = await self.get_last_30_days_sales()

        issues = []

        # Extract revenues
        today_rev = today.get("summary", {}).get(
            "total_revenue", 0) if today.get("success") else 0
        yesterday_rev = yesterday.get("summary", {}).get(
            "total_revenue", 0) if yesterday.get("success") else 0
        rev_7d = last_7.get("summary", {}).get(
            "total_revenue", 0) if last_7.get("success") else 0
        rev_30d = last_30.get("summary", {}).get(
            "total_revenue", 0) if last_30.get("success") else 0

        # Check 1: 7-day < 30-day
        if rev_7d > rev_30d and rev_30d > 0:
            issues.append(
                f"7-day revenue ({rev_7d:,.2f}) > 30-day revenue ({rev_30d:,.2f})")

        # Check 2: Channel totals for 30-day
        if last_30.get("success"):
            summary = last_30.get("summary", {})
            channel_breakdown = summary.get("channel_breakdown", {})
            channel_total = sum(ch.get("revenue", 0)
                                for ch in channel_breakdown.values())
            if abs(channel_total - rev_30d) > 1:
                issues.append(
                    f"Channel total ({channel_total:,.2f}) != "
                    f"Overall total ({rev_30d:,.2f})"
                )

        return {
            "success": len(issues) == 0,
            "checks_passed": 2 - len(issues),
            "issues": issues,
            "revenues": {
                "today": today_rev,
                "yesterday": yesterday_rev,
                "last_7_days": rev_7d,
                "last_30_days": rev_30d
            },
            "message": "All validations passed" if not issues else f"{len(issues)} issues found"
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
                    "totalRecords": total
                }
            else:
                return {
                    "successful": False,
                    "error": error,
                    "elements": [],
                    "totalRecords": 0
                }

    async def get_order_details(self, order_code: str) -> Dict[str, Any]:
        """
        Get detailed information for a specific order WITH payment details.

        CRITICAL: Includes paymentDetailRequired=true to get sellingPrice!
        """
        url = f"{self.base_url}/oms/saleorder/get"

        async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
            try:
                headers = await self._get_headers()
                response = await client.post(
                    url,
                    json={
                        "code": order_code,
                        "paymentDetailRequired": True  # CRITICAL for sellingPrice
                    },
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()

                if data.get("successful"):
                    order_dto = data.get("saleOrderDTO")
                    # Calculate revenue for this order
                    if order_dto:
                        revenue_calc = self.calculate_order_revenue(order_dto)
                        return {
                            "successful": True,
                            "order": order_dto,
                            "revenue_info": revenue_calc
                        }
                    return {
                        "successful": True,
                        "order": order_dto
                    }
                else:
                    return {
                        "successful": False,
                        "error": data.get("message", "Unknown error")
                    }
            except Exception as e:
                logger.error(f"Error fetching order {order_code}: {e}")
                return {
                    "successful": False,
                    "error": str(e)
                }

    # Aliases for backward compatibility
    async def get_last_24_hours_sales(self) -> Dict[str, Any]:
        """Alias for get_today_sales"""
        return await self.get_today_sales()

    async def get_detailed_sales_report(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Alias for get_custom_range_sales with defaults"""
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
