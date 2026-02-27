"""Unicommerce order management endpoints."""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Customers
@router.post("/customer/create")
async def create_customer(payload: Dict[str, Any] = Body(...)):
    """
    Create a customer in Unicommerce.
    Payload: { code, name, phone?, email?, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/customer/create", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/customer/edit")
async def update_customer(payload: Dict[str, Any] = Body(...)):
    """
    Update a customer in Unicommerce.
    Payload: { code, name?, phone?, email?, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/customer/edit", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Sale order crud
@router.post("/create")
async def create_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Create a sale order.
    Payload: {
        saleOrder: {
            code, displayOrderCode?, channel, displayOrderDateTime,
            cashOnDelivery?, addresses: [...], billingAddress: {...},
            saleOrderItems: [...], customFieldValues?, ...
        }
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/create", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/get")
async def get_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Get sale order details.
    Payload: { code }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleorder/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/search")
async def search_sale_orders(payload: Dict[str, Any] = Body(...)):
    """
    Search sale orders with filters.
    Payload: { fromDate?, toDate?, channel?, statusCode?, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/search", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/edit")
async def update_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Update a sale order.
    Payload: { saleOrder: { code, ... } }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/edit", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/edit-metadata")
async def update_sale_order_metadata(payload: Dict[str, Any] = Body(...)):
    """
    Update sale order metadata.
    Payload: { saleOrderCode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/editSaleOrderMetadata", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Priority / verify

@router.post("/set-priority")
async def set_sale_order_priority(payload: Dict[str, Any] = Body(...)):
    """
    Set sale order priority.
    Payload: { saleOrderCode, priority, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/saleOrder/setPriority", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/verify")
async def verify_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Verify a sale order.
    Payload: { saleOrderCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/verify", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Hold / unhold

@router.post("/hold")
async def hold_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Hold a sale order.
    Payload: { saleOrderCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/hold", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/unhold")
async def unhold_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Unhold a sale order.
    Payload: { saleOrderCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/unhold", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/hold-items")
async def hold_sale_order_items(payload: Dict[str, Any] = Body(...)):
    """
    Hold specific sale order items.
    Payload: { saleOrderCode, saleOrderItemCodes: [...] }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/holdSaleOrderItems", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/unhold-items")
async def unhold_sale_order_items(payload: Dict[str, Any] = Body(...)):
    """
    Unhold specific sale order items.
    Payload: { saleOrderCode, saleOrderItemCodes: [...] }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/unholdSaleOrderItems", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Cancel
@router.post("/cancel")
async def cancel_sale_order(payload: Dict[str, Any] = Body(...)):
    """
    Cancel a sale order.
    Payload: { saleOrderCode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/cancel", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Facility switching
@router.post("/switch-facility")
async def switch_facility_sale_order_items(payload: Dict[str, Any] = Body(...)):
    """
    Switch facility for sale order items.
    Payload: { saleOrderCode, saleOrderItems: [...], targetFacilityCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleorder/facility/switch", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Item details update
@router.post("/item-detail/add")
async def update_item_details_single(payload: Dict[str, Any] = Body(...)):
    """
    Update item details for a single sale order item.
    Payload: { saleOrderItemCode, itemDetailDTO: { ... } }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/inflow/saleOrderItem/detail/add", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/item-detail/add/bulk")
async def update_item_details_multi(payload: Dict[str, Any] = Body(...)):
    """
    Update item details for multiple sale order items.
    Payload: { saleOrderItemDetailsEnvelope: [...] }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post(
            "/oms/inflow/saleOrderItem/detail/add/bulk", payload
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Alternate items
@router.post("/alternate-item/create")
async def create_alternate_item(payload: Dict[str, Any] = Body(...)):
    """
    Create alternate item for a sale order item.
    Payload: { saleOrderItemCode, alternateSkuCode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post(
            "/oms/saleOrder/createSaleOrderItemAlternate", payload
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/alternate-item/accept")
async def accept_alternate_item(payload: Dict[str, Any] = Body(...)):
    """
    Accept alternate item for a sale order item.
    Payload: { saleOrderItemCode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post(
            "/oms/saleOrder/acceptSaleOrderItemAlternate", payload
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Serviceability check
@router.post("/check-serviceability")
async def check_serviceability(payload: Dict[str, Any] = Body(...)):
    """
    Check serviceability for a sale order.
    Payload: { saleOrderCode? | pincode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/saleOrder/getServiceability", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
