"""
External Integrations API Endpoints
Handles secure proxy endpoints for external services like Unicommerce
"""

from fastapi import APIRouter
import logging
from app.services.unicommerce import UnicommerceService

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
