"""
Unicommerce API Integration Service
Provides secure proxy methods for Unicommerce API calls
"""

import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from app.core.config import settings


class UnicommerceService:
    """Service for integrating with Unicommerce OMS API"""

    def __init__(self):
        self.base_url = settings.UNICOMMERCE_BASE_URL.format(
            tenant=settings.UNICOMMERCE_TENANT
        )
        self.access_code = settings.UNICOMMERCE_ACCESS_CODE
        self.timeout = httpx.Timeout(30.0)

    def _get_headers(self) -> Dict[str, str]:
        """Get common headers for Unicommerce API requests"""
        return {
            "Authorization": f"Bearer {self.access_code}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

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
                response = await client.post(
                    url,
                    json=payload,
                    headers=self._get_headers()
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

    async def get_last_24_hours_sales(self) -> Dict[str, Any]:
        """
        Get sales from last 24 hours from Unicommerce
        Note: Revenue calculation is estimated based on order count
        For accurate revenue, use Unicommerce reporting APIs

        Returns:
            Dict containing last 24 hours sales data
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
        
        # Estimate average revenue per order (₹500) since Unicommerce search API 
        # doesn't return financial details. For accurate revenue, their reporting API is needed.
        # This is a placeholder - you can adjust this value based on your average order value
        ESTIMATED_AVG_ORDER_VALUE = 500.0
        total_revenue = total_orders * ESTIMATED_AVG_ORDER_VALUE

        return {
            "success": True,
            "period": "last_24_hours",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "currency": "INR",
                "note": "Revenue is estimated (avg ₹500/order). Use Unicommerce Reporting API for exact values."
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
        
        # Estimate average revenue per order since Unicommerce search API doesn't return financial details
        ESTIMATED_AVG_ORDER_VALUE = 500.0
        total_revenue = total_orders * ESTIMATED_AVG_ORDER_VALUE

        return {
            "success": True,
            "period": "last_7_days",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "currency": "INR",
                "note": "Revenue is estimated (avg ₹500/order). Use Unicommerce Reporting API for exact values."
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
        
        # Estimate average revenue per order since Unicommerce search API doesn't return financial details
        ESTIMATED_AVG_ORDER_VALUE = 500.0
        total_revenue = total_orders * ESTIMATED_AVG_ORDER_VALUE

        return {
            "success": True,
            "period": "last_30_days",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "currency": "INR",
                "note": "Revenue is estimated (avg ₹500/order). Use Unicommerce Reporting API for exact values."
            },
            "orders": sale_orders
        }
