"""
Unicommerce Vendor & Purchase Order API Endpoints
===================================================
Covers:
- Create/Update Vendor Catalog
- Get Vendor Backorder Items
- Create, Search, Approve, Close Purchase Orders
- Get Purchase Order Details
"""

from fastapi import APIRouter, Body, Query
import logging
from typing import Any, Dict, List, Optional

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# VENDOR CATALOG
# =============================================================================

@router.post("/vendor-catalog/create-or-edit")
async def create_or_update_vendor_catalog(
    vendor_code: str = Body(...),
    item_type_sku_code: str = Body(...),
    unit_price: float = Body(...),
    vendor_sku_code: Optional[str] = Body(None),
    inventory: Optional[int] = Body(None),
    priority: Optional[int] = Body(None),
    enabled: Optional[bool] = Body(None),
    custom_field_values: Optional[List[Dict]] = Body(None),
    facility_code: str = Body(..., description="Facility code"),
):
    """Create or update vendor catalog item type."""
    try:
        svc = get_uc_api_service()
        vendor_item = {
            "vendorCode": vendor_code,
            "itemTypeSkuCode": item_type_sku_code,
            "unitPrice": unit_price,
        }
        if vendor_sku_code is not None:
            vendor_item["vendorSkuCode"] = vendor_sku_code
        if inventory is not None:
            vendor_item["inventory"] = inventory
        if priority is not None:
            vendor_item["priority"] = priority
        if enabled is not None:
            vendor_item["enabled"] = enabled
        if custom_field_values:
            vendor_item["customFieldValues"] = custom_field_values

        payload = {"vendorItemType": vendor_item}
        return await svc.post(
            "/purchase/vendorItemType/createOrEdit",
            payload,
            facility_code=facility_code,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/vendor-backorder-items")
async def get_vendor_backorder_items(payload: Dict[str, Any] = Body(...)):
    """
    Get vendor backorder items.
    Payload can include: vendorId, itemTypeName, categoryCode, noVendors, searchOptions
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/purchase/getVendorBackOrderItems", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# PURCHASE ORDERS
# =============================================================================

@router.post("/purchase-order/create")
async def create_purchase_order(
    payload: Dict[str, Any] = Body(...),
    facility_code: str = Body(..., embed=False),
):
    """
    Create a purchase order.
    Payload: { vendorCode, purchaseOrderItems: [...], purchaseOrderCode?, ... , facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", facility_code)
        return await svc.post(
            "/purchase/purchaseOrder/create", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/purchase-order/search")
async def search_purchase_orders(payload: Dict[str, Any] = Body(...)):
    """
    Search purchase orders.
    Payload: { approvedBetween: {start, end}, createdBetween: {start, end} }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/purchase/purchaseOrder/getPurchaseOrders", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/purchase-order/approve")
async def approve_purchase_order(payload: Dict[str, Any] = Body(...)):
    """
    Approve a purchase order.
    Payload: { purchaseOrderCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/purchaseOrder/approve", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/purchase-order/create-approved")
async def create_and_approve_purchase_order(payload: Dict[str, Any] = Body(...)):
    """
    Create a purchase order in approved status.
    Payload: { vendorCode, purchaseOrderItems: [...], facility_code, ... }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/purchaseOrder/createApproved", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/purchase-order/close")
async def close_purchase_order(payload: Dict[str, Any] = Body(...)):
    """
    Close a purchase order.
    Payload: { purchaseOrderCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/purchaseOrder/close", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/purchase-order/details")
async def get_purchase_order_details(payload: Dict[str, Any] = Body(...)):
    """
    Get purchase order details.
    Payload: { purchaseOrderCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/purchase/purchaseOrder/getPurchaseOrderDetails",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
