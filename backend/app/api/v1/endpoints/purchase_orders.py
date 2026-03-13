"""Purchase Order CRUD endpoints with auto-numbering and total recalculation."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import User, PurchaseOrder, PurchaseOrderItem, Supplier
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.procurement import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderSchema
from app.core.numbering import next_po_number

router = APIRouter()


def _recalc_totals(po: PurchaseOrder):
    """Recalculate PO header totals from line items."""
    gross = sum(float(i.amount) for i in po.items)
    tax = sum(float(i.gst_amount) for i in po.items)
    po.gross_amount = gross
    po.tax_amount = tax
    po.net_amount = gross + tax + float(po.freight_amount or 0)


@router.get("/", response_model=List[PurchaseOrderSchema])
def list_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items), joinedload(PurchaseOrder.supplier))
    if status:
        q = q.filter(PurchaseOrder.status == status)
    if department:
        q = q.filter(PurchaseOrder.department == department)
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    if date_from:
        q = q.filter(PurchaseOrder.po_date >= date_from)
    if date_to:
        q = q.filter(PurchaseOrder.po_date <= date_to)
    return q.order_by(PurchaseOrder.id.desc()).offset(skip).limit(limit).all()


@router.get("/pending", response_model=List[PurchaseOrderSchema])
def list_pending_pos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items), joinedload(PurchaseOrder.supplier))
        .filter(PurchaseOrder.status.in_(["OPEN", "PARTIAL"]))
        .order_by(PurchaseOrder.po_date.desc())
        .all()
    )


@router.get("/{po_id}", response_model=PurchaseOrderSchema)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items), joinedload(PurchaseOrder.supplier))
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    return po


@router.post("/", response_model=PurchaseOrderSchema, status_code=201)
def create_purchase_order(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    # Validate supplier
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    po_data = data.model_dump(exclude={"items"})
    po = PurchaseOrder(**po_data)
    po.po_number = next_po_number(db)
    po.status = "OPEN"
    po.created_by = current_user.id

    for item_data in data.items:
        item = PurchaseOrderItem(**item_data.model_dump())
        item.pending_qty = item.order_qty
        po.items.append(item)

    _recalc_totals(po)
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.put("/{po_id}", response_model=PurchaseOrderSchema)
def update_purchase_order(
    po_id: int,
    data: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    po = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    if po.status != "OPEN":
        raise HTTPException(400, "Can only edit OPEN purchase orders")

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(po, field, value)

    if data.items is not None:
        # Replace all items
        for old_item in po.items:
            db.delete(old_item)
        po.items = []
        for item_data in data.items:
            item = PurchaseOrderItem(**item_data.model_dump())
            item.pending_qty = item.order_qty
            po.items.append(item)

    _recalc_totals(po)
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/cancel")
def cancel_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    if po.status == "CANCELLED":
        raise HTTPException(400, "Already cancelled")
    po.status = "CANCELLED"
    db.commit()
    return {"message": f"PO {po.po_number} cancelled"}
