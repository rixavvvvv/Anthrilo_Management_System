"""
External Integrations API Endpoints
Handles secure proxy endpoints for external services like Unicommerce
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional
import logging
from app.services.unicommerce import UnicommerceService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/unicommerce/sale-orders")
async def get_sale_orders(
    from_date: Optional[str] = Query(
        None, description="Start date in ISO format"),
    to_date: Optional[str] = Query(None, description="End date in ISO format"),
    display_start: int = Query(0, description="Pagination start index"),
    display_length: int = Query(100, description="Number of records to fetch")
):
    """
    Proxy endpoint to fetch sale orders from Unicommerce
    Defaults to last 24 hours if dates not provided
    """
    service = UnicommerceService()

    # Parse dates if provided
    from_date_obj = None
    to_date_obj = None

    if from_date:
        try:
            from_date_obj = datetime.fromisoformat(
                from_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid from_date format")

    if to_date:
        try:
            to_date_obj = datetime.fromisoformat(
                to_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid to_date format")

    result = await service.search_sale_orders(
        from_date=from_date_obj,
        to_date=to_date_obj,
        display_start=display_start,
        display_length=display_length
    )

    if not result.get("success", True):
        raise HTTPException(
            status_code=500,
            detail=result.get("message", "Failed to fetch sale orders")
        )

    return result


@router.get("/unicommerce/today-sales")
async def get_today_sales():
    """
    Get today's sales summary from Unicommerce
    """
    service = UnicommerceService()
    result = await service.get_today_sales_summary()

    if not result.get("success", True):
        raise HTTPException(
            status_code=500,
            detail=result.get("message", "Failed to fetch today's sales")
        )

    return result


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
