"""
Unicommerce Facility API Endpoints
====================================
Covers:
- Search Facility
- Get Facility Details
"""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/search")
async def search_facilities(payload: Dict[str, Any] = Body(...)):
    """
    Search facilities.
    Payload: { ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/facility/search", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/get")
async def get_facility_details(payload: Dict[str, Any] = Body(...)):
    """
    Get facility details.
    Payload: { facilityCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/facility/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
