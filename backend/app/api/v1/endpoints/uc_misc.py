"""Unicommerce miscellaneous endpoints."""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Picklist
@router.post("/picklist/staging/create")
async def create_picklist_staging(payload: Dict[str, Any] = Body(...)):
    """
    Create picklist (staging to invoicing).
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/picker/picklist/staging/manual/create",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/picklist/direct/create")
async def create_picklist_direct(payload: Dict[str, Any] = Body(...)):
    """
    Create picklist (direct).
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/picker/picklist/manual/create",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Custom ui
@router.post("/custom-dropdown/create-or-update")
async def create_or_update_custom_dropdown(payload: Dict[str, Any] = Body(...)):
    """
    Enable custom reason dropdown (UI customization).
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/uiCustomList/createOrUpdate", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Shipment seal id
@router.post("/shipment-seal/update-multiple")
async def update_shipment_seal_id_multiple(payload: Dict[str, Any] = Body(...)):
    """
    Update shipment seal ID for multiple packages.
    Payload: { ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/package/updateMultiple", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/shipment-seal/update")
async def update_shipment_seal_id_single(payload: Dict[str, Any] = Body(...)):
    """
    Update shipment seal ID for a single package.
    Payload: { ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/package/update", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
