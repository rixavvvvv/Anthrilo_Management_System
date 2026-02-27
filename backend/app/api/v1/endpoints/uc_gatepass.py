"""Unicommerce gatepass endpoints."""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/scan-item")
async def scan_item(payload: Dict[str, Any] = Body(...)):
    """
    Scan an item for gatepass.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/scan/item", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/create")
async def create_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Create a gatepass.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/create", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/complete")
async def complete_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Complete a gatepass.
    Payload: { gatePassCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/complete", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/edit")
async def update_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Update a gatepass.
    Payload: { gatePassCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/edit", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/remove-item")
async def remove_item_in_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Remove item from gatepass.
    Payload: { gatePassCode, itemCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/item/remove", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/add-nontraceable-item")
async def add_nontraceable_item(payload: Dict[str, Any] = Body(...)):
    """
    Add non-traceable item to gatepass.
    Payload: { gatePassCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/nontraceable/addItem", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/discard")
async def discard_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Discard a gatepass.
    Payload: { gatePassCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/discard", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/search")
async def search_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Search gatepasses.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/search", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/get")
async def get_gatepass(payload: Dict[str, Any] = Body(...)):
    """
    Get gatepass details.
    Payload: { gatePassCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/gatepass/get", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
