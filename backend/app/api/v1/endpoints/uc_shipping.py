"""Unicommerce shipping endpoints."""

from fastapi import APIRouter, Body, Query
from fastapi.responses import Response
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# Shipping packages
@router.post("/package/create")
async def create_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Create a shipping package.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/create", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/search")
async def search_shipping_packages(payload: Dict[str, Any] = Body(...)):
    """
    Search shipping packages.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/search", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/edit")
async def update_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Update a shipping package.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/edit", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/split")
async def split_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Split a shipping package.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/split", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/modify")
async def modify_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Modify a shipping package (Tenant level).
    Payload: { ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/shippingPackage/modify", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/get-packages")
async def get_shipping_packages(payload: Dict[str, Any] = Body(...)):
    """
    Get shipping packages.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/getShippingPackages",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/get-details")
async def get_shipping_package_details(payload: Dict[str, Any] = Body(...)):
    """
    Get shipping package details.
    Payload: { shippingPackageCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/getShippingPackageDetails",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Shipping provider
@router.post("/package/allocate-provider")
async def allocate_shipping_provider(payload: Dict[str, Any] = Body(...)):
    """
    Allocate shipping provider to a package.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/allocateShippingProvider",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/create-invoice-allocate-provider")
async def create_invoice_and_allocate_provider(payload: Dict[str, Any] = Body(...)):
    """
    Create invoice and allocate shipping provider in one call.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/createInvoiceAndAllocateShippingProvider",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Dispatch & delivery
@router.post("/package/dispatch")
async def dispatch_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Mark shipping package as dispatched.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/dispatch", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/force-dispatch")
async def force_dispatch_shipping_package(payload: Dict[str, Any] = Body(...)):
    """
    Force dispatch a shipping package.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/forceDispatch", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/package/create-and-dispatch")
async def create_and_dispatch_by_sale_order_item(payload: Dict[str, Any] = Body(...)):
    """
    Create shipment and mark dispatched by sale order item code.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/createAndDispatchBySaleOrderItemCode",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/tracking/update")
async def update_tracking_status(payload: Dict[str, Any] = Body(...)):
    """
    Update shipment tracking status.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/updateShipmentTrackingStatus", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/item/mark-delivered")
async def mark_item_delivered(payload: Dict[str, Any] = Body(...)):
    """
    Mark a sale order item as delivered.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/saleOrderItem/markDelivered", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Shipping manifests
@router.post("/manifest/create")
async def create_shipping_manifest(payload: Dict[str, Any] = Body(...)):
    """
    Create a shipping manifest.
    Payload: { ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/shippingManifest/create", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/manifest/add-package")
async def add_package_to_manifest(payload: Dict[str, Any] = Body(...)):
    """
    Add shipping package to manifest.
    Payload: { shippingManifestCode, shippingPackageCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post(
            "/oms/shippingManifest/addShippingPackage", payload
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/manifest/create-and-close")
async def create_and_complete_manifest(payload: Dict[str, Any] = Body(...)):
    """
    Create and complete (close) a manifest in one call.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingManifest/createclose", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/manifest/close")
async def close_shipping_manifest(payload: Dict[str, Any] = Body(...)):
    """
    Close a shipping manifest.
    Payload: { shippingManifestCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/shippingManifest/close", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/manifest/get")
async def get_shipping_manifest(payload: Dict[str, Any] = Body(...)):
    """
    Get shipping manifest details.
    Payload: { shippingManifestCode, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingManifest/get", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# Shipping label pdf
@router.get("/label/pdf")
async def get_shipping_label_pdf(
    shipping_package_code: str = Query(..., description="Shipping package code"),
    facility_code: str = Query(..., description="Facility code"),
):
    """
    Get shipping label PDF.
    Returns PDF binary data.
    """
    try:
        svc = get_uc_api_service()
        result = await svc.get(
            "/oms/shipment/show",
            params={"shippingPackageCode": shipping_package_code},
            facility_code=facility_code,
        )
        if isinstance(result, dict) and result.get("content_type") == "application/pdf":
            return Response(
                content=result["content"],
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=label_{shipping_package_code}.pdf"
                },
            )
        return result
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
