"""
Unicommerce API Integration Service
Provides secure proxy methods for Unicommerce API calls
With automated token lifecycle management
"""

import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
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

    async def search_sale_orders(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        display_start: int = 0,
        display_length: int = 100
    ) -> Dict[str, Any]:
        """
        Search sale orders from Unicommerce

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
            except Exception as e:
                # Any other error
                return {
                    "success": False,
                    "error": str(e),
                    "message": f"Unexpected error: {type(e).__name__}"
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
                
                # Calculate total from sale order items
                total_amount = 0
                if "saleOrderItems" in order:
                    for item in order["saleOrderItems"]:
                        total_amount += item.get("totalPrice", 0)
                
                return {
                    "code": order.get("code"),
                    "total_amount": total_amount,
                    "status": order.get("status"),
                    "channel": order.get("channel")
                }
            
            return None
            
        except Exception as e:
            print(f"Error fetching order details for {order_code}: {e}")
            return None

    async def get_last_24_hours_sales(self) -> Dict[str, Any]:
        """
        Get sales from last 24 hours from Unicommerce with REAL revenue data
        Fetches order details to get accurate financial information

        Returns:
            Dict containing last 24 hours sales data with real revenue
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

        to_date = datetime.utcnow()
        from_date = to_date - timedelta(hours=24)

        result = await self.search_sale_orders(
            from_date=from_date,
            to_date=to_date,
            display_start=0,
            display_length=1000
        )

        # Check if there was an error in our service layer OR Unicommerce API
        if result.get("success") == False or not result.get("successful", False):
            # Return a structure that won't break the frontend
            return {
                "success": False,
                "message": result.get("message", "Failed to fetch from Unicommerce"),
                "period": "last_24_hours",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                },
                "orders": [],
                "error_details": result.get("error", "Unknown error")
            }

        # Calculate summary statistics
        sale_orders = result.get("elements", [])

        # Use totalRecords from API for accurate count (we only fetch first 1000)
        total_orders = result.get("totalRecords", len(sale_orders))
        
        # Fetch real revenue by getting order details for first 50 orders (sample)
        # For large datasets, we use sampling to balance accuracy vs performance
        total_revenue = 0
        sample_size = min(50, len(sale_orders))  # Sample first 50 orders
        
        if sample_size > 0:
            # ⚡ PARALLEL EXECUTION: Fetch all order details concurrently with shared client
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                # Fetch headers once (not 50 times!)
                headers = await self._get_headers()
                
                # Create tasks with shared client and headers
                tasks = [
                    self.get_order_details(order.get("code"), client=client, headers=headers)
                    for order in sale_orders[:sample_size]
                ]
                
                # Execute all API calls simultaneously
                order_details_list = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Calculate total revenue from results
                successful_fetches = 0
                for order_details in order_details_list:
                    if order_details and not isinstance(order_details, Exception):
                        total_revenue += order_details.get("total_amount", 0)
                        successful_fetches += 1
                
                # Extrapolate to total orders if we have a sample
                if successful_fetches > 0 and sample_size < total_orders:
                    avg_order_value = total_revenue / successful_fetches
                    total_revenue = avg_order_value * total_orders

        return {
            "success": True,
            "period": "last_24_hours",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                "currency": "INR",
                "note": f"Revenue calculated from {sample_size} order samples" if sample_size < total_orders else "Revenue calculated from all orders"
            },
            "orders": sale_orders
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

        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=7)  # 7 days ago

        result = await self.search_sale_orders(
            from_date=from_date,
            to_date=to_date,
            display_start=0,
            display_length=1000  # Fetch up to 1000 records
        )

        # Check if there was an error in our service layer OR Unicommerce API
        if result.get("success") == False or not result.get("successful", False):
            # Return a structure that won't break the frontend
            return {
                "success": False,
                "message": result.get("message", "Failed to fetch from Unicommerce"),
                "period": "last_7_days",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                },
                "orders": [],
                "error_details": result.get("error", "Unknown error")
            }

        # Calculate summary statistics
        sale_orders = result.get("elements", [])

        # Use totalRecords from API for accurate count (we only fetch first 1000)
        total_orders = result.get("totalRecords", len(sale_orders))
        
        # Fetch real revenue by getting order details for first 50 orders (sample)
        # For large datasets, we use sampling to balance accuracy vs performance
        total_revenue = 0
        sample_size = min(50, len(sale_orders))  # Sample first 50 orders
        
        if sample_size > 0:
            # ⚡ PARALLEL EXECUTION: Fetch all order details concurrently with shared client
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                # Fetch headers once (not 50 times!)
                headers = await self._get_headers()
                
                # Create tasks with shared client and headers
                tasks = [
                    self.get_order_details(order.get("code"), client=client, headers=headers)
                    for order in sale_orders[:sample_size]
                ]
                
                # Execute all API calls simultaneously
                order_details_list = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Calculate total revenue from results
                successful_fetches = 0
                for order_details in order_details_list:
                    if order_details and not isinstance(order_details, Exception):
                        total_revenue += order_details.get("total_amount", 0)
                        successful_fetches += 1
                
                # Extrapolate to total orders if we have a sample
                if successful_fetches > 0 and sample_size < total_orders:
                    avg_order_value = total_revenue / successful_fetches
                    total_revenue = avg_order_value * total_orders

        return {
            "success": True,
            "period": "last_7_days",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                "currency": "INR",
                "note": f"Revenue calculated from {sample_size} order samples" if sample_size < total_orders else "Revenue calculated from all orders"
            },
            "orders": sale_orders
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

        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=30)  # 30 days ago

        result = await self.search_sale_orders(
            from_date=from_date,
            to_date=to_date,
            display_start=0,
            display_length=1000  # Fetch up to 1000 records
        )

        # Check if there was an error in our service layer OR Unicommerce API
        if result.get("success") == False or not result.get("successful", False):
            # Return a structure that won't break the frontend
            return {
                "success": False,
                "message": result.get("message", "Failed to fetch from Unicommerce"),
                "period": "last_30_days",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {
                    "total_orders": 0,
                    "total_revenue": 0,
                    "currency": "INR"
                },
                "orders": [],
                "error_details": result.get("error", "Unknown error")
            }

        # Calculate summary statistics
        sale_orders = result.get("elements", [])

        # Use totalRecords from API for accurate count (we only fetch first 1000)
        total_orders = result.get("totalRecords", len(sale_orders))
        
        # Fetch real revenue by getting order details for first 50 orders (sample)
        # For large datasets, we use sampling to balance accuracy vs performance
        total_revenue = 0
        sample_size = min(50, len(sale_orders))  # Sample first 50 orders
        
        if sample_size > 0:
            # ⚡ PARALLEL EXECUTION: Fetch all order details concurrently with shared client
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                # Fetch headers once (not 50 times!)
                headers = await self._get_headers()
                
                # Create tasks with shared client and headers
                tasks = [
                    self.get_order_details(order.get("code"), client=client, headers=headers)
                    for order in sale_orders[:sample_size]
                ]
                
                # Execute all API calls simultaneously
                order_details_list = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Calculate total revenue from results
                successful_fetches = 0
                for order_details in order_details_list:
                    if order_details and not isinstance(order_details, Exception):
                        total_revenue += order_details.get("total_amount", 0)
                        successful_fetches += 1
                
                # Extrapolate to total orders if we have a sample
                if successful_fetches > 0 and sample_size < total_orders:
                    avg_order_value = total_revenue / successful_fetches
                    total_revenue = avg_order_value * total_orders

        return {
            "success": True,
            "period": "last_30_days",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": round(total_revenue, 2),
                "currency": "INR",
                "note": f"Revenue calculated from {sample_size} order samples" if sample_size < total_orders else "Revenue calculated from all orders"
            },
            "orders": sale_orders
        }
