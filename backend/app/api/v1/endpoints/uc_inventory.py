"""Unicommerce inventory endpoints."""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Inventory snapshot
@router.post("/snapshot")
async def get_inventory_snapshot(payload: Dict[str, Any] = Body(...)):
    """
    Get inventory snapshot for SKU(s).
    Payload: {
        itemTypeSKUs?: ["SKU1", "SKU2"],
        updatedSinceInMinutes?: 480,
        facility_code
    }
    Max 10,000 SKUs per call. updatedSinceInMinutes max 1440 (24h).
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/inventory/inventorySnapshot/get", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Adjust inventory (single)
@router.post("/adjust")
async def adjust_inventory_single(payload: Dict[str, Any] = Body(...)):
    """
    Adjust inventory for a single SKU.
    Payload: {
        inventoryAdjustment: {
            itemSKU, quantity, shelfCode, adjustmentType (ADD|REMOVE|REPLACE|TRANSFER),
            inventoryType? (GOOD_INVENTORY|BAD_INVENTORY|QC_REJECTED|VIRTUAL_INVENTORY),
            transferToShelfCode?, remarks?
        },
        facility_code
    }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post("/inventory/adjust", payload, facility_code=fc)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Adjust inventory (bulk)

@router.post("/adjust/bulk")
async def adjust_inventory_bulk(payload: Dict[str, Any] = Body(...)):
    """
    Adjust inventory for multiple SKUs (across facilities).
    Payload: {
        inventoryAdjustments: [
            {
                itemSKU, quantity, shelfCode, adjustmentType,
                inventoryType?, facilityCode, remarks?,
                transferToShelfCode?
            }, ...
        ],
        forceAllocate?: false
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/inventory/adjust/bulk", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Adjust batchwise inventory (multiple)
@router.post("/adjust/bulk/batchwise")
async def adjust_batchwise_inventory_bulk(payload: Dict[str, Any] = Body(...)):
    """
    Adjust batchwise inventory for multiple SKUs.
    Payload: {
        inventoryAdjustments: [
            {
                itemSKU, quantity, shelfCode, adjustmentType,
                inventoryType?, facilityCode, remarks?,
                batchCode?, batchDetails?: { mrp, mfd, vendorCode, ... }
            }, ...
        ],
        forceAllocate?: false
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/inventory/adjust/bulk", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Mark inventory found
@router.post("/mark-found")
async def mark_inventory_found(payload: Dict[str, Any] = Body(...)):
    """
    Mark item(s) as found in inventory.
    Payload: { itemSku, shelfCode, quantityFound, ageingStartDate?, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/inventory/markQuantityFound", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Nearby store inventory
@router.post("/nearby-store")
async def get_nearby_store_inventory(payload: Dict[str, Any] = Body(...)):
    """
    Get proximity-based inventory overview at warehouses/stores.
    Payload: { skuCode, pincode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/nearbyInventory/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
