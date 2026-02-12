"""
Unicommerce GRN (Goods Receipt Note) API Endpoints
====================================================
Covers:
- Create GRN
- Add Item in GRN
- Add Item SKU in GRN
- Get GRN
- Search GRNs
"""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/grn/create")
async def create_grn(payload: Dict[str, Any] = Body(...)):
    """
    Create GRN.
    Payload: {
        wsGRN: { vendorInvoiceNumber, vendorInvoiceDate, customFieldValues?, currencyCode? },
        purchaseOrderCode,
        vendorInvoiceDateCheckDisable?,
        facility_code
    }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/inflowReceipt/create", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/grn/add-item")
async def add_item_in_grn(payload: Dict[str, Any] = Body(...)):
    """
    Add item in GRN.
    Payload: { inflowReceiptCode, itemCode, manufacturingDate?, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/inflowReceipt/addItem", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/grn/add-item-sku")
async def add_item_sku_in_grn(payload: Dict[str, Any] = Body(...)):
    """
    Add item SKU in GRN (supports batching & traceability).
    Payload: {
        inflowReceiptCode,
        inflowReceiptItem: { quantity, unitPrice?, skuCode?, wsBatchDetail?, itemDTOs?, ... },
        facility_code
    }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/inflowReceipt/addItemSKU", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/grn/get")
async def get_grn(payload: Dict[str, Any] = Body(...)):
    """
    Get GRN details.
    Payload: { inflowReceiptCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/inflowReceipt/getInflowReceipt",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/grn/search")
async def search_grns(payload: Dict[str, Any] = Body(...)):
    """
    Search GRNs.
    Payload: { purchaseOrderCode?, createdBetween?: { start, end, textRange }, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/inflowReceipt/getInflowReceipts",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
