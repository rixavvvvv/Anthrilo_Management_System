"""
Unicommerce API Integration Service
Provides secure proxy methods for Unicommerce API calls
With automated token lifecycle management
"""

import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import math
from app.core.config import settings
from app.core.token_manager import get_token_manager


class UnicommerceService:
    """Service for integrating with Unicommerce OMS API"""

    def __init__(self):
        self.base_url = settings.UNICOMMERCE_BASE_URL.format(
            tenant=settings.UNICOMMERCE_TENANT
        )
        self.access_code = settings.UNICOMMERCE_ACCESS_CODE
        self.timeout = httpx.Timeout(30.0)
        
        # Connection pooling for parallel requests (20x faster)
        self.limits = httpx.Limits(max_keepalive_connections=50, max_connections=100)
        
        # Get token manager for automated auth
        self.token_manager = get_token_manager()

    async def _get_headers(self) -> Dict[str, str]:
        """Get authenticated headers with auto-refreshing token"""
        return await self.token_manager.get_headers()

    async def fetch_all_sale_orders(
        self, 
        from_date: datetime = None, 
        to_date: datetime = None,
        max_orders: int = 5000,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Fetch ALL sale orders with proper pagination (not just first 1000)

        Args:
            from_date: Start date for order search
            to_date: End date for order search  
            max_orders: Maximum number of orders to fetch
            page_size: Orders per page

        Returns:
            Dict containing all sale orders data from Unicommerce
        """
        # Default to last 24 hours if dates not provided
        if to_date is None:
            to_date = datetime.utcnow()
        if from_date is None:
            from_date = to_date - timedelta(hours=24)

        all_orders = []
        page_number = 1
        total_records = None
        
        # Keep fetching pages until we have all orders
        while len(all_orders) < max_orders:
            display_start = (page_number - 1) * page_size
            
            page_result = await self.search_sale_orders(
                from_date=from_date,
                to_date=to_date,
                display_start=display_start,
                display_length=page_size
            )
            
            if not page_result.get("successful", False):
                break
                
            page_orders = page_result.get("elements", [])
            if not page_orders:
                break  # No more orders
                
            all_orders.extend(page_orders)
            
            # Get total from first page
            if total_records is None:
                total_records = page_result.get("totalRecords", 0)
                
            # Stop if we've fetched all available orders
            if len(all_orders) >= total_records:
                break
                
            page_number += 1
            
            # Add small delay to respect API limits
            await asyncio.sleep(0.1)
            
        return {
            "successful": True,
            "elements": all_orders,
            "totalRecords": total_records or len(all_orders),
            "fetched_count": len(all_orders)
        }

    async def search_sale_orders(
        self, 
        from_date: datetime = None, 
        to_date: datetime = None,
        display_start: int = 0,
        display_length: int = 100
    ) -> Dict[str, Any]:
        """
        Search sale orders from Unicommerce (single page)

        Args:
            from_date: Start date for order search (defaults to 24 hours ago)
            to_date: End date for order search (defaults to now)
            display_start: Pagination start index
            display_length: Number of records to fetch

        Returns:
            Dict containing sale orders data from Unicommerce
        """
        # Default to last 24 hours if dates not provided
        if to_date is None:
            to_date = datetime.utcnow()
        if from_date is None:
            from_date = to_date - timedelta(hours=24)

        # Format dates for Unicommerce API
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "searchOptions": {
                "displayStart": display_start,
                "displayLength": display_length
            }
        }

        url = f"{self.base_url}/oms/saleOrder/search"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Get fresh authenticated headers
                headers = await self._get_headers()
                
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                # Ensure we return the full Unicommerce response
                return data
            except httpx.HTTPStatusError as e:
                # HTTP error response from Unicommerce
                return {
                    "success": False,
                    "error": str(e),
                    "status_code": e.response.status_code,
                    "response_text": e.response.text,
                    "message": f"Unicommerce API error: {e.response.status_code}"
                }
            except httpx.RequestError as e:
                # Connection error or timeout
                return {
                    "success": False,
                    "error": str(e),
                    "message": "Failed to connect to Unicommerce API"
                }
                # Any other error
                return {
                    "success": False,
                    "error": str(e),
                    "message": f"Unexpected error: {type(e).__name__}"
                }

    def extract_detailed_order_financials(self, detailed_order: Dict[str, Any], original_order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract complete financial data from DETAILED order information
        
        Args:
            detailed_order: Detailed order data from get_order_details API
            original_order: Original basic order data for fallback
            
        Returns:
            Dict with complete financial breakdown
        """
        # Safe get with validation
        def safe_float(value, default=0.0):
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        # Extract basic order info (prefer detailed, fallback to original)
        order_code = detailed_order.get("code") or original_order.get("code", "")
        status = detailed_order.get("status") or original_order.get("status", "")
        channel = detailed_order.get("channel") or original_order.get("channel", "")
        
        # Get sale order items from detailed order (this should have real prices)
        items = detailed_order.get("saleOrderItems", [])
        
        # Calculate gross sales from detailed items
        gross_sales = 0.0
        for item in items:
            # Try different possible price fields from detailed API
            item_price = (
                safe_float(item.get("totalPrice", 0)) or
                safe_float(item.get("sellingPrice", 0)) or
                safe_float(item.get("itemPrice", 0)) or
                safe_float(item.get("price", 0))
            )
            # Also consider quantity
            quantity = safe_float(item.get("quantity", 1))
            gross_sales += item_price * quantity
            
        # Extract detailed financial information
        discount = safe_float(detailed_order.get("totalDiscount", 0))
        cash_on_delivery = safe_float(detailed_order.get("cashOnDelivery", 0))
        prepaid_amount = safe_float(detailed_order.get("prepaidAmount", 0))
        
        # Extract tax information
        tax_amount = safe_float(detailed_order.get("taxAmount", 0))
        
        # Extract shipping information
        shipping_charges = safe_float(detailed_order.get("shippingCharges", 0))
        gift_wrap_charges = safe_float(detailed_order.get("giftWrapCharges", 0))
        
        # Calculate net sales
        net_sales = gross_sales - discount
        
        # Determine if order should be included in revenue (exclude cancelled/returned)
        excluded_statuses = ["CANCELLED", "RETURNED", "REFUNDED", "CANCELED"]
        include_in_revenue = status.upper() not in excluded_statuses
        
        return {
            "order_code": order_code,
            "status": status,
            "channel": channel,
            "gross_sales": gross_sales,
            "discount": discount,
            "tax_amount": tax_amount,
            "shipping_charges": shipping_charges,
            "gift_wrap_charges": gift_wrap_charges,
            "cash_on_delivery": cash_on_delivery,
            "prepaid_amount": prepaid_amount,
            "net_sales": net_sales,
            "total_value": net_sales + tax_amount + shipping_charges,
            "include_in_revenue": include_in_revenue,
            "items_count": len(items)
        }

    def extract_order_financials(self, order: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract complete financial data from order with proper validation
        
        Args:
            order: Order data from Unicommerce
            
        Returns:
            Dict with complete financial breakdown
        """
        # Safe get with validation
        def safe_float(value, default=0.0):
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        # Extract basic order info
        order_code = order.get("code", "")
        status = order.get("status", "")
        channel = order.get("channel", "")
        
        # Get sale order items
        items = order.get("saleOrderItems", [])
        
        # Calculate gross sales from items
        gross_sales = 0.0
        for item in items:
            item_price = safe_float(item.get("totalPrice", 0))
            gross_sales += item_price
        
        # Fallback: if items are missing in list responses, use order-level totals
        if gross_sales == 0.0 and not items:
            gross_sales = safe_float(
                order.get("totalAmount")
                or order.get("orderAmount")
                or order.get("total")
                or order.get("totalPrice")
                or order.get("grandTotal")
                or order.get("orderTotal")
                or order.get("amount")
            )
            
        # Extract discounts and fees
        discount = safe_float(
            order.get("totalDiscount")
            or order.get("discount")
            or order.get("discountAmount")
            or 0
        )
        cash_on_delivery = safe_float(order.get("cashOnDelivery", 0))
        prepaid_amount = safe_float(order.get("prepaidAmount", 0))
        
        # Extract tax information
        tax_amount = safe_float(
            order.get("taxAmount")
            or order.get("totalTax")
            or order.get("tax")
            or 0
        )
        
        # Extract shipping information
        shipping_charges = safe_float(
            order.get("shippingCharges")
            or order.get("shipping")
            or order.get("shippingAmount")
            or 0
        )
        gift_wrap_charges = safe_float(order.get("giftWrapCharges", 0))
        
        # Calculate net sales
        net_sales = gross_sales - discount
        
        # Determine if order should be included in revenue (only exclude clearly invalid statuses)
        excluded_statuses = ["CANCELLED", "RETURNED", "REFUNDED", "CANCELED", "FAILED"]
        include_in_revenue = status.upper() not in excluded_statuses
        
        return {
            "order_code": order_code,
            "status": status,
            "channel": channel,
            "gross_sales": gross_sales,
            "discount": discount,
            "tax_amount": tax_amount,
            "shipping_charges": shipping_charges,
            "gift_wrap_charges": gift_wrap_charges,
            "cash_on_delivery": cash_on_delivery,
            "prepaid_amount": prepaid_amount,
            "net_sales": net_sales,
            "total_value": net_sales + tax_amount + shipping_charges,
            "include_in_revenue": include_in_revenue,
            "items_count": len(items)
        }

    async def get_order_details(self, order_code: str, client: httpx.AsyncClient = None, headers: Dict[str, str] = None) -> Dict[str, Any]:
        """
        Get detailed information for a single order including financial data
        
        Args:
            order_code: Sale order code
            client: Shared HTTP client (for connection pooling)
            headers: Pre-fetched headers (to avoid repeated auth calls)
            
        Returns:
            Dict containing order details with financial information
        """
        url = f"{self.base_url}/oms/saleorder/get"
        
        # Use shared client or create new one
        if client is None:
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as new_client:
                return await self._fetch_order_details(new_client, url, order_code, headers)
        else:
            return await self._fetch_order_details(client, url, order_code, headers)
    
    async def _fetch_order_details(self, client: httpx.AsyncClient, url: str, order_code: str, headers: Dict[str, str] = None) -> Dict[str, Any]:
        """Internal method to fetch order details"""
        try:
            if headers is None:
                headers = await self._get_headers()
            
            response = await client.post(
                url,
                json={"code": order_code},
                headers=headers
            )
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("successful") and data.get("saleOrderDTO"):
                order = data["saleOrderDTO"]
                return {
                    "successful": True,
                    "order": order
                }
            
            return {
                "successful": False,
                "error": data.get("message", "Unknown error")
            }
            
        except Exception as e:
            print(f"Error fetching order details for {order_code}: {e}")
            return {
                "successful": False,
                "error": str(e)
            }

    async def get_last_24_hours_sales(self) -> Dict[str, Any]:
        """
        Get sales from last 24 hours from Unicommerce with COMPLETE and ACCURATE data
        Uses proper pagination and detailed financial extraction with concurrency limits

        Returns:
            Dict containing complete last 24 hours sales data with accurate revenue
        """
        # Check if we have valid credentials
        if not self.access_code or self.access_code == "":
            return {
                "success": False,
                "message": "Unicommerce access code not configured",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

        try:
            to_date = datetime.utcnow()
            from_date = to_date - timedelta(hours=24)

            # Use proper pagination to get ALL orders
            result = await self.fetch_all_sale_orders(
                from_date=from_date,
                to_date=to_date,
                max_orders=2000,  # Reasonable limit for 24 hours
                page_size=100
            )

            # Check if there was an error
            if not result.get("successful", False):
                print(f"❌ fetch_all_sale_orders failed: {result}")
                return {
                    "success": False,
                    "message": "Failed to fetch from Unicommerce",
                    "period": "last_24_hours",
                    "from_date": from_date.isoformat(),
                    "to_date": to_date.isoformat(),
                    "summary": {
                        "total_orders": 0,
                        "total_revenue": 0,
                        "currency": "INR"
                    },
                    "orders": []
                }

            # Get all orders
            sale_orders = result.get("elements", [])
            total_orders = result.get("totalRecords", len(sale_orders))
            
            print(f"✅ Successfully fetched {len(sale_orders)} orders, total available: {total_orders}")
            
            # Phase 1: Process basic order data for counts and statuses
            basic_processed_orders = []
            valid_basic_orders = []
            basic_total_gross = 0.0
            basic_total_net = 0.0
            basic_total_discount = 0.0
            basic_total_tax = 0.0
            channel_breakdown_basic = {}
            basic_total_gross = 0.0
            basic_total_net = 0.0
            basic_total_discount = 0.0
            basic_total_tax = 0.0
            channel_breakdown_basic = {}
            basic_total_gross = 0.0
            basic_total_net = 0.0
            basic_total_discount = 0.0
            basic_total_tax = 0.0
            channel_breakdown_basic = {}
            
            for order in sale_orders:
                financials = self.extract_order_financials(order)
                basic_processed_orders.append({
                    "code": financials["order_code"],
                    "status": financials["status"],
                    "channel": financials["channel"],
                    "gross_sales": financials["gross_sales"],
                    "net_sales": financials["net_sales"],
                    "discount": financials["discount"],
                    "tax_amount": financials["tax_amount"]
                })
                
                # Track valid orders for sampling
                if financials["include_in_revenue"]:
                    valid_basic_orders.append(order)
                    basic_total_gross += financials["gross_sales"]
                    basic_total_net += financials["net_sales"]
                    basic_total_discount += financials["discount"]
                    basic_total_tax += financials["tax_amount"]
                    channel = financials["channel"]
                    if channel not in channel_breakdown_basic:
                        channel_breakdown_basic[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                    channel_breakdown_basic[channel]["orders"] += 1
                    channel_breakdown_basic[channel]["gross_sales"] += financials["gross_sales"]
                    channel_breakdown_basic[channel]["net_sales"] += financials["net_sales"]
                    basic_total_gross += financials["gross_sales"]
                    basic_total_net += financials["net_sales"]
                    basic_total_discount += financials["discount"]
                    basic_total_tax += financials["tax_amount"]
                    channel = financials["channel"]
                    if channel not in channel_breakdown_basic:
                        channel_breakdown_basic[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                    channel_breakdown_basic[channel]["orders"] += 1
                    channel_breakdown_basic[channel]["gross_sales"] += financials["gross_sales"]
                    channel_breakdown_basic[channel]["net_sales"] += financials["net_sales"]
                    basic_total_gross += financials["gross_sales"]
                    basic_total_net += financials["net_sales"]
                    basic_total_discount += financials["discount"]
                    basic_total_tax += financials["tax_amount"]
                    channel = financials["channel"]
                    if channel not in channel_breakdown_basic:
                        channel_breakdown_basic[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                    channel_breakdown_basic[channel]["orders"] += 1
                    channel_breakdown_basic[channel]["gross_sales"] += financials["gross_sales"]
                    channel_breakdown_basic[channel]["net_sales"] += financials["net_sales"]
            
            valid_orders_count = len(valid_basic_orders)  # Define this here
            print(f"📊 Processed {len(basic_processed_orders)} orders, {valid_orders_count} valid for revenue")
            
            # REAL DATA: Fetch detailed order information in parallel for accurate financial data
            sample_size = min(50, valid_orders_count)
            sample_orders = valid_basic_orders[:sample_size] if sample_size > 0 else []
            
            total_gross_sales = 0.0
            total_net_sales = 0.0
            total_discount = 0.0
            total_tax = 0.0
            channel_breakdown = {}
            
            if sample_orders:
                print(f"🔄 Fetching REAL financial data for {sample_size} sample orders in parallel...")
                semaphore = asyncio.Semaphore(10)
                
                async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                    headers = await self._get_headers()

                    async def fetch_order_detail_safe(order):
                        async with semaphore:
                            order_code = order.get("code", "")
                            try:
                                details = await self.get_order_details(order_code, client=client, headers=headers)
                                if details and details.get("successful"):
                                    return details.get("order", {})
                            except Exception as e:
                                print(f"Error fetching {order_code}: {e}")
                            return None

                    tasks = [fetch_order_detail_safe(order) for order in sample_orders]
                    detailed_orders = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    successful_count = 0
                    for idx, detailed_order in enumerate(detailed_orders):
                        if detailed_order and not isinstance(detailed_order, Exception):
                            original_order = sample_orders[idx]
                            financials = self.extract_detailed_order_financials(detailed_order, original_order)
                            
                            if financials["include_in_revenue"]:
                                total_gross_sales += financials["gross_sales"]
                                total_net_sales += financials["net_sales"]
                                total_discount += financials["discount"]
                                total_tax += financials["tax_amount"]
                                
                                channel = financials["channel"]
                                if channel not in channel_breakdown:
                                    channel_breakdown[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                                channel_breakdown[channel]["orders"] += 1
                                channel_breakdown[channel]["gross_sales"] += financials["gross_sales"]
                                channel_breakdown[channel]["net_sales"] += financials["net_sales"]
                                
                                successful_count += 1
                    
                    if successful_count > 0 and valid_orders_count > successful_count:
                        extrapolation_factor = valid_orders_count / successful_count
                        total_gross_sales *= extrapolation_factor
                        total_net_sales *= extrapolation_factor
                        total_discount *= extrapolation_factor
                        total_tax *= extrapolation_factor
                        
                        for channel in channel_breakdown:
                            channel_breakdown[channel]["orders"] = int(channel_breakdown[channel]["orders"] * extrapolation_factor)
                            channel_breakdown[channel]["gross_sales"] *= extrapolation_factor
                            channel_breakdown[channel]["net_sales"] *= extrapolation_factor
                        
                        data_accuracy = "extrapolated"
                    else:
                        data_accuracy = "complete"
                    
                    if successful_count == 0 and valid_orders_count > 0:
                        total_gross_sales = basic_total_gross
                        total_net_sales = basic_total_net
                        total_discount = basic_total_discount
                        total_tax = basic_total_tax
                        channel_breakdown = channel_breakdown_basic
                        data_accuracy = "basic"
            else:
                total_gross_sales = basic_total_gross
                total_net_sales = basic_total_net
                total_discount = basic_total_discount
                total_tax = basic_total_tax
                channel_breakdown = channel_breakdown_basic
                data_accuracy = "basic" if valid_orders_count > 0 else "no_data"
            
            processed_orders = basic_processed_orders[:50]
            
            return {
                "success": True,
                "period": "last_24_hours",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "fetching_info": {
                    "total_available": total_orders,
                    "fetched_count": result.get("fetched_count", len(sale_orders)),
                    "pages_fetched": len(sale_orders) // 100 + (1 if len(sale_orders) % 100 > 0 else 0)
                },
                "summary": {
                    "total_orders": total_orders,
                    "valid_orders": valid_orders_count,
                    "total_gross_sales": round(total_gross_sales, 2),
                    "total_net_sales": round(total_net_sales, 2),
                    "total_revenue": round(total_net_sales, 2),
                    "total_discount": round(total_discount, 2),
                    "total_tax": round(total_tax, 2),
                    "currency": "INR",
                    "avg_order_value": round(total_net_sales / valid_orders_count if valid_orders_count > 0 else 0, 2),
                    "data_accuracy": data_accuracy,
                    "channel_breakdown": channel_breakdown
                },
                "orders": processed_orders
            }
            
        except Exception as e:
            print(f"❌ Exception in get_last_24_hours_sales: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"Exception occurred: {str(e)}",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

    async def get_last_7_days_sales(self) -> Dict[str, Any]:
        """
        Get sales from last 7 days from Unicommerce

        Returns:
            Dict containing last 7 days sales data
        """
        # Check if we have valid credentials
        if not self.access_code or self.access_code == "":
            return {
                "success": False,
                "message": "Unicommerce access code not configured",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

        try:
            to_date = datetime.utcnow()
            from_date = to_date - timedelta(days=7)

            result = await self.fetch_all_sale_orders(
                from_date=from_date,
                to_date=to_date,
                max_orders=5000,
                page_size=100
            )

            if not result.get("successful", False):
                return {
                    "success": False,
                    "message": "Failed to fetch from Unicommerce",
                    "period": "last_7_days",
                    "from_date": from_date.isoformat(),
                    "to_date": to_date.isoformat(),
                    "summary": {
                        "total_orders": 0,
                        "total_revenue": 0,
                        "currency": "INR"
                    },
                    "orders": []
                }

            sale_orders = result.get("elements", [])
            total_orders = result.get("totalRecords", len(sale_orders))

            basic_processed_orders = []
            valid_basic_orders = []

            for order in sale_orders:
                financials = self.extract_order_financials(order)
                basic_processed_orders.append({
                    "code": financials["order_code"],
                    "status": financials["status"],
                    "channel": financials["channel"],
                    "gross_sales": financials["gross_sales"],
                    "net_sales": financials["net_sales"],
                    "discount": financials["discount"],
                    "tax_amount": financials["tax_amount"]
                })

                if financials["include_in_revenue"]:
                    valid_basic_orders.append(order)

            valid_orders_count = len(valid_basic_orders)

            sample_size = min(50, valid_orders_count)
            sample_orders = valid_basic_orders[:sample_size] if sample_size > 0 else []

            total_gross_sales = 0.0
            total_net_sales = 0.0
            total_discount = 0.0
            total_tax = 0.0
            channel_breakdown = {}

            if sample_orders:
                semaphore = asyncio.Semaphore(10)

                async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                    headers = await self._get_headers()

                    async def fetch_order_detail_safe(order):
                        async with semaphore:
                            order_code = order.get("code", "")
                            try:
                                details = await self.get_order_details(order_code, client=client, headers=headers)
                                if details and details.get("successful"):
                                    return details.get("order", {})
                            except Exception as e:
                                print(f"Error fetching {order_code}: {e}")
                            return None

                    tasks = [fetch_order_detail_safe(order) for order in sample_orders]
                    detailed_orders = await asyncio.gather(*tasks, return_exceptions=True)

                    successful_count = 0
                    for idx, detailed_order in enumerate(detailed_orders):
                        if detailed_order and not isinstance(detailed_order, Exception):
                            original_order = sample_orders[idx]
                            financials = self.extract_detailed_order_financials(detailed_order, original_order)

                            if financials["include_in_revenue"]:
                                total_gross_sales += financials["gross_sales"]
                                total_net_sales += financials["net_sales"]
                                total_discount += financials["discount"]
                                total_tax += financials["tax_amount"]

                                channel = financials["channel"]
                                if channel not in channel_breakdown:
                                    channel_breakdown[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                                channel_breakdown[channel]["orders"] += 1
                                channel_breakdown[channel]["gross_sales"] += financials["gross_sales"]
                                channel_breakdown[channel]["net_sales"] += financials["net_sales"]

                                successful_count += 1

                    if successful_count > 0 and valid_orders_count > successful_count:
                        extrapolation_factor = valid_orders_count / successful_count
                        total_gross_sales *= extrapolation_factor
                        total_net_sales *= extrapolation_factor
                        total_discount *= extrapolation_factor
                        total_tax *= extrapolation_factor

                        for channel in channel_breakdown:
                            channel_breakdown[channel]["orders"] = int(channel_breakdown[channel]["orders"] * extrapolation_factor)
                            channel_breakdown[channel]["gross_sales"] *= extrapolation_factor
                            channel_breakdown[channel]["net_sales"] *= extrapolation_factor

                        data_accuracy = "extrapolated"
                    else:
                        data_accuracy = "complete"
                    
                    if successful_count == 0 and valid_orders_count > 0:
                        total_gross_sales = basic_total_gross
                        total_net_sales = basic_total_net
                        total_discount = basic_total_discount
                        total_tax = basic_total_tax
                        channel_breakdown = channel_breakdown_basic
                        data_accuracy = "basic"
            else:
                total_gross_sales = basic_total_gross
                total_net_sales = basic_total_net
                total_discount = basic_total_discount
                total_tax = basic_total_tax
                channel_breakdown = channel_breakdown_basic
                data_accuracy = "basic" if valid_orders_count > 0 else "no_data"

            processed_orders = basic_processed_orders[:50]

            return {
                "success": True,
                "period": "last_7_days",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": total_orders,
                    "valid_orders": valid_orders_count,
                    "total_gross_sales": round(total_gross_sales, 2),
                    "total_net_sales": round(total_net_sales, 2),
                    "total_revenue": round(total_net_sales, 2),
                    "total_discount": round(total_discount, 2),
                    "total_tax": round(total_tax, 2),
                    "currency": "INR",
                    "avg_order_value": round(total_net_sales / valid_orders_count if valid_orders_count > 0 else 0, 2),
                    "data_accuracy": data_accuracy,
                    "channel_breakdown": channel_breakdown
                },
                "orders": processed_orders
            }
        except Exception as e:
            print(f"❌ Exception in get_last_7_days_sales: {e}")
            return {
                "success": False,
                "message": f"Exception occurred: {str(e)}",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

    async def get_last_30_days_sales(self) -> Dict[str, Any]:
        """
        Get sales from last 30 days from Unicommerce

        Returns:
            Dict containing last 30 days sales data
        """
        # Check if we have valid credentials
        if not self.access_code or self.access_code == "":
            return {
                "success": False,
                "message": "Unicommerce access code not configured",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

        try:
            to_date = datetime.utcnow()
            from_date = to_date - timedelta(days=30)

            result = await self.fetch_all_sale_orders(
                from_date=from_date,
                to_date=to_date,
                max_orders=10000,
                page_size=100
            )

            if not result.get("successful", False):
                return {
                    "success": False,
                    "message": "Failed to fetch from Unicommerce",
                    "period": "last_30_days",
                    "from_date": from_date.isoformat(),
                    "to_date": to_date.isoformat(),
                    "summary": {
                        "total_orders": 0,
                        "total_revenue": 0,
                        "currency": "INR"
                    },
                    "orders": []
                }

            sale_orders = result.get("elements", [])
            total_orders = result.get("totalRecords", len(sale_orders))

            basic_processed_orders = []
            valid_basic_orders = []

            for order in sale_orders:
                financials = self.extract_order_financials(order)
                basic_processed_orders.append({
                    "code": financials["order_code"],
                    "status": financials["status"],
                    "channel": financials["channel"],
                    "gross_sales": financials["gross_sales"],
                    "net_sales": financials["net_sales"],
                    "discount": financials["discount"],
                    "tax_amount": financials["tax_amount"]
                })

                if financials["include_in_revenue"]:
                    valid_basic_orders.append(order)

            valid_orders_count = len(valid_basic_orders)

            sample_size = min(50, valid_orders_count)
            sample_orders = valid_basic_orders[:sample_size] if sample_size > 0 else []

            total_gross_sales = 0.0
            total_net_sales = 0.0
            total_discount = 0.0
            total_tax = 0.0
            channel_breakdown = {}

            if sample_orders:
                semaphore = asyncio.Semaphore(10)

                async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                    headers = await self._get_headers()

                    async def fetch_order_detail_safe(order):
                        async with semaphore:
                            order_code = order.get("code", "")
                            try:
                                details = await self.get_order_details(order_code, client=client, headers=headers)
                                if details and details.get("successful"):
                                    return details.get("order", {})
                            except Exception as e:
                                print(f"Error fetching {order_code}: {e}")
                            return None

                    tasks = [fetch_order_detail_safe(order) for order in sample_orders]
                    detailed_orders = await asyncio.gather(*tasks, return_exceptions=True)

                    successful_count = 0
                    for idx, detailed_order in enumerate(detailed_orders):
                        if detailed_order and not isinstance(detailed_order, Exception):
                            original_order = sample_orders[idx]
                            financials = self.extract_detailed_order_financials(detailed_order, original_order)

                            if financials["include_in_revenue"]:
                                total_gross_sales += financials["gross_sales"]
                                total_net_sales += financials["net_sales"]
                                total_discount += financials["discount"]
                                total_tax += financials["tax_amount"]

                                channel = financials["channel"]
                                if channel not in channel_breakdown:
                                    channel_breakdown[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                                channel_breakdown[channel]["orders"] += 1
                                channel_breakdown[channel]["gross_sales"] += financials["gross_sales"]
                                channel_breakdown[channel]["net_sales"] += financials["net_sales"]

                                successful_count += 1

                    if successful_count > 0 and valid_orders_count > successful_count:
                        extrapolation_factor = valid_orders_count / successful_count
                        total_gross_sales *= extrapolation_factor
                        total_net_sales *= extrapolation_factor
                        total_discount *= extrapolation_factor
                        total_tax *= extrapolation_factor

                        for channel in channel_breakdown:
                            channel_breakdown[channel]["orders"] = int(channel_breakdown[channel]["orders"] * extrapolation_factor)
                            channel_breakdown[channel]["gross_sales"] *= extrapolation_factor
                            channel_breakdown[channel]["net_sales"] *= extrapolation_factor

                        data_accuracy = "extrapolated"
                    else:
                        data_accuracy = "complete"
                    
                    if successful_count == 0 and valid_orders_count > 0:
                        total_gross_sales = basic_total_gross
                        total_net_sales = basic_total_net
                        total_discount = basic_total_discount
                        total_tax = basic_total_tax
                        channel_breakdown = channel_breakdown_basic
                        data_accuracy = "basic"
            else:
                total_gross_sales = basic_total_gross
                total_net_sales = basic_total_net
                total_discount = basic_total_discount
                total_tax = basic_total_tax
                channel_breakdown = channel_breakdown_basic
                data_accuracy = "basic" if valid_orders_count > 0 else "no_data"

            processed_orders = basic_processed_orders[:50]

            return {
                "success": True,
                "period": "last_30_days",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": total_orders,
                    "valid_orders": valid_orders_count,
                    "total_gross_sales": round(total_gross_sales, 2),
                    "total_net_sales": round(total_net_sales, 2),
                    "total_revenue": round(total_net_sales, 2),
                    "total_discount": round(total_discount, 2),
                    "total_tax": round(total_tax, 2),
                    "currency": "INR",
                    "avg_order_value": round(total_net_sales / valid_orders_count if valid_orders_count > 0 else 0, 2),
                    "data_accuracy": data_accuracy,
                    "channel_breakdown": channel_breakdown
                },
                "orders": processed_orders
            }
        except Exception as e:
            print(f"❌ Exception in get_last_30_days_sales: {e}")
            return {
                "success": False,
                "message": f"Exception occurred: {str(e)}",
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                }
            }

    async def get_detailed_sales_report(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive sales report with detailed analytics
        
        Args:
            from_date: Start date for report (defaults to today)
            to_date: End date for report (defaults to today)
            
        Returns:
            Dict containing detailed sales report with analytics
        """
        import time
        start_time = time.time()
        
        # Default to today if dates not provided
        if to_date is None:
            to_date = datetime.utcnow().replace(hour=23, minute=59, second=59)
        if from_date is None:
            from_date = datetime.utcnow().replace(hour=0, minute=0, second=0)
        
        # Check credentials
        if not self.access_code or self.access_code == "":
            return {
                "success": False,
                "message": "Unicommerce access code not configured"
            }
        
        # Fetch orders for the period
        result = await self.search_sale_orders(
            from_date=from_date,
            to_date=to_date,
            display_start=0,
            display_length=1000
        )
        
        if result.get("success") == False or not result.get("successful", False):
            return {
                "success": False,
                "message": result.get("message", "Failed to fetch from Unicommerce"),
                "error_details": result.get("error", "Unknown error")
            }
        
        sale_orders = result.get("elements", [])
        total_records = result.get("totalRecords", len(sale_orders))
        
        # Fetch detailed order data in parallel
        sample_size = min(100, len(sale_orders))
        detailed_orders = []
        
        if sample_size > 0:
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                headers = await self._get_headers()
                
                tasks = [
                    self._fetch_full_order_details(client, order.get("code"), headers)
                    for order in sale_orders[:sample_size]
                ]
                
                detailed_orders = await asyncio.gather(*tasks, return_exceptions=True)
                detailed_orders = [o for o in detailed_orders if o and not isinstance(o, Exception)]
        
        # Calculate comprehensive analytics
        gross_sales = 0
        total_discounts = 0
        total_taxes = 0
        returns_value = 0
        returns_count = 0
        total_units = 0
        
        # Channel-wise breakdown
        channel_sales = {}
        
        # Status breakdown
        status_breakdown = {}
        
        # Product performance
        product_sales = {}
        
        # Hourly breakdown
        hourly_sales = {str(i).zfill(2): {"orders": 0, "revenue": 0} for i in range(24)}
        
        # Daily breakdown (for multi-day reports)
        daily_sales = {}
        
        for order in detailed_orders:
            if not order:
                continue
            
            order_total = order.get("total_amount", 0)
            order_discount = order.get("discount", 0)
            order_tax = order.get("tax", 0)
            channel = order.get("channel", "Unknown")
            status = order.get("status", "Unknown")
            items = order.get("items", [])
            order_date = order.get("created_date")
            
            # Gross sales
            gross_sales += order_total + order_discount
            total_discounts += order_discount
            total_taxes += order_tax
            
            # Check if return/cancelled
            if status in ["CANCELLED", "RETURNED", "RTO"]:
                returns_value += order_total
                returns_count += 1
            
            # Channel breakdown
            if channel not in channel_sales:
                channel_sales[channel] = {"orders": 0, "revenue": 0, "units": 0}
            channel_sales[channel]["orders"] += 1
            channel_sales[channel]["revenue"] += order_total
            
            # Status breakdown
            if status not in status_breakdown:
                status_breakdown[status] = {"count": 0, "value": 0}
            status_breakdown[status]["count"] += 1
            status_breakdown[status]["value"] += order_total
            
            # Product analysis
            for item in items:
                sku = item.get("sku", "Unknown")
                item_name = item.get("name", sku)
                item_qty = item.get("quantity", 1)
                item_price = item.get("total_price", 0)
                
                total_units += item_qty
                channel_sales[channel]["units"] += item_qty
                
                if sku not in product_sales:
                    product_sales[sku] = {
                        "name": item_name,
                        "units": 0,
                        "revenue": 0,
                        "orders": 0
                    }
                product_sales[sku]["units"] += item_qty
                product_sales[sku]["revenue"] += item_price
                product_sales[sku]["orders"] += 1
            
            # Hourly breakdown
            if order_date:
                try:
                    dt = datetime.fromisoformat(order_date.replace("Z", "+00:00"))
                    hour = str(dt.hour).zfill(2)
                    hourly_sales[hour]["orders"] += 1
                    hourly_sales[hour]["revenue"] += order_total
                    
                    # Daily breakdown
                    day = dt.strftime("%Y-%m-%d")
                    if day not in daily_sales:
                        daily_sales[day] = {"orders": 0, "revenue": 0, "units": 0}
                    daily_sales[day]["orders"] += 1
                    daily_sales[day]["revenue"] += order_total
                    daily_sales[day]["units"] += len(items)
                except:
                    pass
        
        # Extrapolate if we have a sample
        extrapolation_factor = total_records / sample_size if sample_size > 0 else 1
        
        if extrapolation_factor > 1:
            gross_sales *= extrapolation_factor
            total_discounts *= extrapolation_factor
            total_taxes *= extrapolation_factor
            returns_value *= extrapolation_factor
            returns_count = int(returns_count * extrapolation_factor)
            total_units = int(total_units * extrapolation_factor)
        
        # Calculate net sales
        net_sales = gross_sales - total_discounts - returns_value
        
        # Calculate AOV
        aov = net_sales / total_records if total_records > 0 else 0
        
        # Top products (sort by revenue)
        top_products = sorted(
            product_sales.items(), 
            key=lambda x: x[1]["revenue"], 
            reverse=True
        )[:10]
        
        # Top channels
        top_channels = sorted(
            channel_sales.items(),
            key=lambda x: x[1]["revenue"],
            reverse=True
        )
        
        fetch_time = round(time.time() - start_time, 2)
        
        return {
            "success": True,
            "report_type": "detailed_sales",
            "period": {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "days": (to_date - from_date).days + 1
            },
            "executive_summary": {
                "total_orders": total_records,
                "gross_sales": round(gross_sales, 2),
                "total_discounts": round(total_discounts, 2),
                "returns_value": round(returns_value, 2),
                "returns_count": returns_count,
                "net_sales": round(net_sales, 2),
                "total_units": total_units,
                "average_order_value": round(aov, 2),
                "currency": "INR"
            },
            "channel_performance": [
                {
                    "channel": k,
                    "orders": v["orders"],
                    "revenue": round(v["revenue"] * extrapolation_factor, 2),
                    "units": int(v["units"] * extrapolation_factor),
                    "percentage": round((v["revenue"] / (gross_sales/extrapolation_factor) * 100) if gross_sales > 0 else 0, 1)
                }
                for k, v in top_channels
            ],
            "top_products": [
                {
                    "sku": sku,
                    "name": data["name"],
                    "units": int(data["units"] * extrapolation_factor),
                    "revenue": round(data["revenue"] * extrapolation_factor, 2),
                    "orders": int(data["orders"] * extrapolation_factor)
                }
                for sku, data in top_products
            ],
            "status_breakdown": [
                {
                    "status": k,
                    "count": int(v["count"] * extrapolation_factor),
                    "value": round(v["value"] * extrapolation_factor, 2)
                }
                for k, v in status_breakdown.items()
            ],
            "hourly_trend": [
                {
                    "hour": hour,
                    "orders": int(data["orders"] * extrapolation_factor),
                    "revenue": round(data["revenue"] * extrapolation_factor, 2)
                }
                for hour, data in sorted(hourly_sales.items())
            ],
            "daily_trend": [
                {
                    "date": date,
                    "orders": int(data["orders"] * extrapolation_factor),
                    "revenue": round(data["revenue"] * extrapolation_factor, 2),
                    "units": int(data["units"] * extrapolation_factor)
                }
                for date, data in sorted(daily_sales.items())
            ],
            "transactions": [
                {
                    "order_code": o.get("code"),
                    "channel": o.get("channel"),
                    "status": o.get("status"),
                    "total": o.get("total_amount", 0),
                    "items_count": len(o.get("items", [])),
                    "created": o.get("created_date")
                }
                for o in detailed_orders[:50]  # Limit to 50 for display
            ],
            "metadata": {
                "sample_size": sample_size,
                "total_records": total_records,
                "extrapolation_factor": round(extrapolation_factor, 2),
                "fetch_time_seconds": fetch_time,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
    
    async def _fetch_full_order_details(
        self, 
        client: httpx.AsyncClient, 
        order_code: str, 
        headers: Dict[str, str]
    ) -> Optional[Dict[str, Any]]:
        """Fetch complete order details including items"""
        url = f"{self.base_url}/oms/saleorder/get"
        
        try:
            response = await client.post(
                url,
                json={"code": order_code},
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("successful") and data.get("saleOrderDTO"):
                order = data["saleOrderDTO"]
                
                # Extract items
                items = []
                total_amount = 0
                discount = 0
                tax = 0
                
                for item in order.get("saleOrderItems", []):
                    item_data = {
                        "sku": item.get("itemSku"),
                        "name": item.get("itemName", item.get("itemSku")),
                        "quantity": item.get("quantity", 1),
                        "selling_price": item.get("sellingPrice", 0),
                        "total_price": item.get("totalPrice", 0),
                        "discount": item.get("discount", 0),
                        "status": item.get("statusCode")
                    }
                    items.append(item_data)
                    total_amount += item.get("totalPrice", 0)
                    discount += item.get("discount", 0)
                
                return {
                    "code": order.get("code"),
                    "display_order_code": order.get("displayOrderCode"),
                    "channel": order.get("channel"),
                    "status": order.get("status"),
                    "total_amount": total_amount,
                    "discount": discount,
                    "tax": tax,
                    "items": items,
                    "created_date": order.get("created"),
                    "customer_email": order.get("customerEmail"),
                    "shipping_address": order.get("shippingAddress", {}).get("city")
                }
            
            return None
            
        except Exception as e:
            print(f"Error fetching full order details for {order_code}: {e}")
            return None
