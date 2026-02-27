"""Unicommerce returns endpoints."""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Returns
@router.post("/mark-returned")
async def mark_sale_order_returned(payload: Dict[str, Any] = Body(...)):
    """
    Mark sale order as returned.
    Payload: { saleOrderCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/saleOrder/markReturned", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/complete")
async def mark_returned_with_inventory_type(payload: Dict[str, Any] = Body(...)):
    """
    Mark sale order returned with inventory type specification.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/returns/complete", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/get")
async def get_return(payload: Dict[str, Any] = Body(...)):
    """
    Get return details.
    Payload: { returnCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post("/oms/return/get", payload, facility_code=fc)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/search")
async def search_returns(payload: Dict[str, Any] = Body(...)):
    """
    Search returns.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post("/oms/return/search", payload, facility_code=fc)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Reverse pickup
@router.post("/reverse-pickup/create")
async def create_reverse_pickup(payload: Dict[str, Any] = Body(...)):
    """
    Create a reverse pick-up request.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/reversePickup/create", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/reverse-pickup/edit")
async def update_reverse_pickup(payload: Dict[str, Any] = Body(...)):
    """
    Update a reverse pick-up request.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/reversePickup/edit", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/reverse-pickup/approve")
async def approve_reverse_pickup(payload: Dict[str, Any] = Body(...)):
    """
    Approve a reverse pick-up request.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/reversePickup/approve", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/reverse-pickup/cancel")
async def cancel_reverse_pickup(payload: Dict[str, Any] = Body(...)):
    """
    Cancel a reverse pick-up request.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/reversePickup/cancel", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/reverse-pickup/allocate-courier")
async def allocate_courier_for_reverse_pickup(payload: Dict[str, Any] = Body(...)):
    """
    Allocate courier for reverse pick-up.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/reversePickup/assignReverseProvider", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
