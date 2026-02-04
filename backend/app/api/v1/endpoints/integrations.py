"""
External Integrations API Endpoints
Handles secure proxy endpoints for external services like Unicommerce
"""

from fastapi import APIRouter
import logging
from app.services.unicommerce import UnicommerceService
from app.core.token_manager import get_token_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/unicommerce/last-24-hours")
async def get_last_24_hours():
    """
    Get sales from last 24 hours from Unicommerce
    """
    try:
        logger.info("Fetching last 24 hours sales from Unicommerce")
        service = UnicommerceService()
        result = await service.get_last_24_hours_sales()

        logger.info(
            f"Unicommerce response success: {result.get('success', True)}")

        # Log sample order for debugging revenue field
        if result.get('orders') and len(result.get('orders', [])) > 0:
            sample_order = result['orders'][0]
            logger.info(f"Sample order fields: {list(sample_order.keys())}")
            logger.info(f"Sample order revenue-related fields: total={sample_order.get('total')}, "
                        f"orderAmount={sample_order.get('orderAmount')}, "
                        f"totalAmount={sample_order.get('totalAmount')}, "
                        f"totalPrice={sample_order.get('totalPrice')}")

        # Return result even if unsuccessful, let frontend handle it
        return result
    except Exception as e:
        logger.error(
            f"Error fetching Unicommerce data: {str(e)}", exc_info=True)
        # Return error details for debugging
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "message": "Failed to fetch last 24 hours sales from Unicommerce"
        }


@router.get("/unicommerce/last-7-days")
async def get_last_7_days():
    """
    Get sales from last 7 days from Unicommerce
    """
    try:
        logger.info("Fetching last 7 days sales from Unicommerce")
        service = UnicommerceService()
        result = await service.get_last_7_days_sales()

        logger.info(
            f"Unicommerce 7-day response success: {result.get('success', True)}")

        # Return result even if unsuccessful, let frontend handle it
        return result
    except Exception as e:
        logger.error(
            f"Error fetching Unicommerce 7-day data: {str(e)}", exc_info=True)
        # Return error details for debugging
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "message": "Failed to fetch last 7 days sales from Unicommerce"
        }


@router.get("/unicommerce/last-30-days")
async def get_last_30_days():
    """
    Get sales from last 30 days from Unicommerce
    """
    try:
        logger.info("Fetching last 30 days sales from Unicommerce")
        service = UnicommerceService()
        result = await service.get_last_30_days_sales()

        logger.info(
            f"Unicommerce 30-day response success: {result.get('success', True)}")

        # Return result even if unsuccessful, let frontend handle it
        return result
    except Exception as e:
        logger.error(
            f"Error fetching Unicommerce 30-day data: {str(e)}", exc_info=True)
        # Return error details for debugging
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "message": "Failed to fetch last 30 days sales from Unicommerce"
        }


@router.get("/unicommerce/search-orders")
async def search_orders(
    from_date: str,
    to_date: str,
    display_start: int = 0,
    display_length: int = 100
):
    """
    Search orders from Unicommerce with custom date range and pagination
    """
    try:
        from datetime import datetime
        logger.info(f"Searching orders from {from_date} to {to_date}")

        # Parse dates
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))

        service = UnicommerceService()
        result = await service.search_sale_orders(
            from_date=from_dt,
            to_date=to_dt,
            display_start=display_start,
            display_length=display_length
        )

        return result
    except Exception as e:
        logger.error(f"Error searching orders: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to search orders from Unicommerce"
        }


@router.get("/unicommerce/order-items/{order_code}")
async def get_order_items(order_code: str):
    """
    Get order items with SKU and price details for a specific order
    """
    try:
        logger.info(f"Fetching order items for {order_code}")
        service = UnicommerceService()
        result = await service.get_order_details(order_code)

        return result
    except Exception as e:
        logger.error(f"Error fetching order items: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to fetch order items"
        }


@router.get("/unicommerce/auth/status")
async def get_auth_status():
    """
    Get Unicommerce authentication status
    Shows token health and expiry times
    """
    try:
        token_manager = get_token_manager()
        status = token_manager.get_token_status()

        return {
            "success": True,
            "authentication_status": status,
            "message": "Token lifecycle is being automatically managed"
        }
    except Exception as e:
        logger.error(f"Error getting auth status: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to get authentication status"
        }


@router.post("/unicommerce/auth/refresh")
async def force_refresh_token():
    """
    Manually trigger token refresh (for testing)
    The system normally handles this automatically
    """
    try:
        token_manager = get_token_manager()
        token = await token_manager.get_valid_token()

        if token:
            return {
                "success": True,
                "message": "Token refreshed successfully",
                "status": token_manager.get_token_status()
            }
        else:
            return {
                "success": False,
                "message": "Failed to refresh token"
            }
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to refresh token"
        }


@router.get("/unicommerce/sales-report")
async def get_detailed_sales_report(
    from_date: str = None,
    to_date: str = None
):
    """
    Get comprehensive sales report from Unicommerce
    
    Args:
        from_date: Start date (YYYY-MM-DD format, defaults to today)
        to_date: End date (YYYY-MM-DD format, defaults to today)
    """
    from datetime import datetime
    
    try:
        logger.info(f"Fetching detailed sales report: {from_date} to {to_date}")
        
        # Parse dates
        parsed_from = None
        parsed_to = None
        
        if from_date:
            parsed_from = datetime.strptime(from_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0)
        if to_date:
            parsed_to = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        
        service = UnicommerceService()
        result = await service.get_detailed_sales_report(
            from_date=parsed_from,
            to_date=parsed_to
        )
        
        logger.info(f"Sales report generated: {result.get('success', False)}")
        return result
        
    except ValueError as e:
        logger.error(f"Invalid date format: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Invalid date format. Use YYYY-MM-DD"
        }
    except Exception as e:
        logger.error(f"Error generating sales report: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate sales report"
        }
