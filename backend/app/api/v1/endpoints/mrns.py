"""MRN (Materials Receipt Note) CRUD + Confirm with atomic inventory updates."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import (
    User, MaterialsReceiptNote, MRNItem, PurchaseOrder,
    PurchaseOrderItem, GateEntry, Supplier,
)
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.procurement import MRNCreate, MRNUpdate, MRNSchema
from app.core.numbering import next_mrn_number
from app.services.inventory_service import record_inventory_event

router = APIRouter()


@router.get("/", response_model=List[MRNSchema])
def list_mrns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    supplier_id: Optional[int] = Query(None),
    po_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MaterialsReceiptNote).options(
        joinedload(MaterialsReceiptNote.items),
        joinedload(MaterialsReceiptNote.supplier),
    )
    if supplier_id:
        q = q.filter(MaterialsReceiptNote.supplier_id == supplier_id)
    if po_id:
        q = q.filter(MaterialsReceiptNote.po_id == po_id)
    if status:
        q = q.filter(MaterialsReceiptNote.status == status)
    if date_from:
        q = q.filter(MaterialsReceiptNote.mrn_date >= date_from)
    if date_to:
        q = q.filter(MaterialsReceiptNote.mrn_date <= date_to)
    return q.order_by(MaterialsReceiptNote.id.desc()).offset(skip).limit(limit).all()


@router.get("/by-po/{po_id}", response_model=List[MRNSchema])
def get_mrns_by_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(MaterialsReceiptNote)
        .options(joinedload(MaterialsReceiptNote.items))
        .filter(MaterialsReceiptNote.po_id == po_id)
        .all()
    )


@router.get("/{mrn_id}", response_model=MRNSchema)
def get_mrn(
    mrn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mrn = (
        db.query(MaterialsReceiptNote)
        .options(
            joinedload(MaterialsReceiptNote.items),
            joinedload(MaterialsReceiptNote.supplier),
        )
        .filter(MaterialsReceiptNote.id == mrn_id)
        .first()
    )
    if not mrn:
        raise HTTPException(404, "MRN not found")
    return mrn


@router.post("/", response_model=MRNSchema, status_code=201)
def create_mrn(
    data: MRNCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    mrn_data = data.model_dump(exclude={"items"})
    mrn = MaterialsReceiptNote(**mrn_data)
    mrn.mrn_number = next_mrn_number(db)
    mrn.status = "DRAFT"
    mrn.created_by = current_user.id

    for item_data in data.items:
        item = MRNItem(**item_data.model_dump())
        mrn.items.append(item)

    db.add(mrn)
    db.commit()
    db.refresh(mrn)
    return mrn


@router.put("/{mrn_id}", response_model=MRNSchema)
def update_mrn(
    mrn_id: int,
    data: MRNUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    mrn = db.query(MaterialsReceiptNote).options(joinedload(MaterialsReceiptNote.items)).filter(
        MaterialsReceiptNote.id == mrn_id
    ).first()
    if not mrn:
        raise HTTPException(404, "MRN not found")
    if mrn.status != "DRAFT":
        raise HTTPException(400, "Can only edit DRAFT MRNs")

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(mrn, field, value)

    if data.items is not None:
        for old_item in mrn.items:
            db.delete(old_item)
        mrn.items = []
        for item_data in data.items:
            item = MRNItem(**item_data.model_dump())
            mrn.items.append(item)

    db.commit()
    db.refresh(mrn)
    return mrn


@router.post("/{mrn_id}/confirm")
def confirm_mrn(
    mrn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    CRITICAL: Atomic confirmation of MRN.
    1. Record inventory IN for each item
    2. Update PO received_qty / pending_qty
    3. Update PO status
    4. Update GateEntry status
    5. Single db.commit()
    """
    mrn = (
        db.query(MaterialsReceiptNote)
        .options(joinedload(MaterialsReceiptNote.items))
        .filter(MaterialsReceiptNote.id == mrn_id)
        .first()
    )
    if not mrn:
        raise HTTPException(404, "MRN not found")
    if mrn.status == "CONFIRMED":
        raise HTTPException(400, "MRN already confirmed")

    # 1. Record inventory IN for each item
    for item in mrn.items:
        product_id = item.yarn_id or item.fabric_id
        product_type = "YARN" if item.yarn_id else "FABRIC"
        if not product_id:
            continue  # accessory items — skip inventory tracking for now

        record_inventory_event(
            db=db,
            product_id=product_id,
            product_type=product_type,
            transaction_type="IN",
            reference_type="MRN",
            reference_id=mrn.id,
            reference_number=mrn.mrn_number,
            quantity=float(item.qty),
            lot_number=item.lot_number,
            user_id=current_user.id,
        )

        # 2. Update PO item received/pending if linked
        if item.po_item_id:
            po_item = db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.id == item.po_item_id
            ).with_for_update().first()
            if po_item:
                po_item.received_qty = float(po_item.received_qty or 0) + float(item.qty)
                po_item.pending_qty = float(po_item.order_qty) - float(po_item.received_qty)

    # 3. Update PO status
    if mrn.po_id:
        po = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).filter(
            PurchaseOrder.id == mrn.po_id
        ).first()
        if po:
            all_received = all(float(i.pending_qty) <= 0 for i in po.items)
            po.status = "RECEIVED" if all_received else "PARTIAL"

    # 4. Update GateEntry status
    if mrn.gate_entry_id:
        ge = db.query(GateEntry).filter(GateEntry.id == mrn.gate_entry_id).first()
        if ge:
            ge.status = "MRN_CREATED"

    # 5. Mark MRN confirmed
    mrn.status = "CONFIRMED"

    # Single atomic commit
    db.commit()
    return {"message": f"MRN {mrn.mrn_number} confirmed. Inventory updated."}
