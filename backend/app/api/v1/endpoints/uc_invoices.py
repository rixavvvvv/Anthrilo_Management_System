"""Unicommerce invoice endpoints."""

from fastapi import APIRouter, Body, Query
from fastapi.responses import Response
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/create")
async def create_invoice(payload: Dict[str, Any] = Body(...)):
    """
    Create invoice for a shipping package.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/createInvoice", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/create-by-sale-order")
async def create_invoice_by_sale_order_code(payload: Dict[str, Any] = Body(...)):
    """
    Create invoice with sale order code.
    Payload: { saleOrderCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/invoice/createInvoiceBySaleOrderCode", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/create-and-generate-label")
async def create_invoice_and_generate_label(payload: Dict[str, Any] = Body(...)):
    """
    Create invoice and generate label by shipping package code.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/createInvoiceAndGenerateLabel",
            payload,
            facility_code=fc,
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/create-with-details")
async def create_invoice_with_details(payload: Dict[str, Any] = Body(...)):
    """
    Create invoice with full details.
    Payload: { ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/createInvoiceWithDetails", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/details")
async def get_invoice_details(payload: Dict[str, Any] = Body(...)):
    """
    Get invoice details.
    Payload: { invoiceCode }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/invoice/details/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.get("/pdf")
async def get_invoice_pdf(
    invoice_code: str = Query(..., description="Invoice code"),
    facility_code: str = Query(..., description="Facility code"),
):
    """
    Get invoice PDF by invoice code.
    Returns PDF binary data.
    """
    try:
        svc = get_uc_api_service()
        result = await svc.get(
            "/oms/invoice/show",
            params={"invoiceCode": invoice_code},
            facility_code=facility_code,
        )
        if isinstance(result, dict) and result.get("content_type") == "application/pdf":
            return Response(
                content=result["content"],
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=invoice_{invoice_code}.pdf"
                },
            )
        return result
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/label")
async def get_invoice_label(payload: Dict[str, Any] = Body(...)):
    """
    Get invoice label for a shipping package.
    Payload: { shippingPackageCode, ..., facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/oms/shippingPackage/getInvoiceLabel", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
