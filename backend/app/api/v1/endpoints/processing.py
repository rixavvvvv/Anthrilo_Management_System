"""Dyeing & Processing Job Work: Processing Orders, Grey Fabric Issue, Finished Fabric Receipt."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import (
    User, ProcessingOrder, GreyFabricIssue, FinishedFabricReceipt,
    Supplier, Fabric, InventoryTransaction,
)
from app.api.v1.endpoints.auth import get_current_user, require_manager_or_above
from app.schemas.manufacturing import (
    ProcessingOrderCreate, ProcessingOrderUpdate, ProcessingOrderSchema,
    GreyFabricIssueCreate, GreyFabricIssueSchema,
    FinishedFabricReceiptCreate, FinishedFabricReceiptSchema,
)
from app.schemas.procurement import InventoryTransactionSchema
from app.core.numbering import next_do_number, next_gfi_number, next_ffr_number
from app.services.inventory_service import record_inventory_event
from pydantic import BaseModel

router = APIRouter()


# ── Processing Orders ──

@router.get("/orders", response_model=List[ProcessingOrderSchema])
def list_processing_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    process_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ProcessingOrder)
    if status:
        q = q.filter(ProcessingOrder.status == status)
    if process_type:
        q = q.filter(ProcessingOrder.process_type == process_type)
    return q.order_by(ProcessingOrder.id.desc()).offset(skip).limit(limit).all()


@router.get("/orders/{order_id}", response_model=ProcessingOrderSchema)
def get_processing_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(ProcessingOrder).filter(ProcessingOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Processing Order not found")
    return order


@router.post("/orders", response_model=ProcessingOrderSchema, status_code=201)
def create_processing_order(
    data: ProcessingOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    supplier = db.query(Supplier).filter(Supplier.id == data.processor_supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Processor supplier not found")

    order = ProcessingOrder(**data.model_dump())
    order.order_number = next_do_number(db)
    order.status = "OPEN"
    order.created_by = current_user.id
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/orders/{order_id}", response_model=ProcessingOrderSchema)
def update_processing_order(
    order_id: int,
    data: ProcessingOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(ProcessingOrder).filter(ProcessingOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Processing Order not found")
    if order.status not in ("OPEN", "FABRIC_ISSUED"):
        raise HTTPException(400, f"Cannot edit order in status {order.status}")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


# ── Grey Fabric Issue ──

@router.post("/grey-fabric-issue", response_model=GreyFabricIssueSchema, status_code=201)
def create_grey_fabric_issue(
    data: GreyFabricIssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(ProcessingOrder).filter(ProcessingOrder.id == data.processing_order_id).first()
    if not order:
        raise HTTPException(404, "Processing Order not found")

    issue = GreyFabricIssue(**data.model_dump())
    issue.issue_number = next_gfi_number(db)
    issue.created_by = current_user.id

    record_inventory_event(
        db=db,
        product_id=data.fabric_id,
        product_type="FABRIC",
        transaction_type="OUT",
        reference_type="PROCESSING_ISSUE",
        reference_id=order.id,
        reference_number=issue.issue_number,
        quantity=float(data.qty_issued),
        lot_number=data.lot_number,
        user_id=current_user.id,
    )

    order.status = "FABRIC_ISSUED"
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


# ── Finished Fabric Receipt ──

@router.post("/finished-fabric-receipt", response_model=FinishedFabricReceiptSchema, status_code=201)
def create_finished_fabric_receipt(
    data: FinishedFabricReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(ProcessingOrder).filter(ProcessingOrder.id == data.processing_order_id).first()
    if not order:
        raise HTTPException(404, "Processing Order not found")

    receipt = FinishedFabricReceipt(**data.model_dump())
    receipt.receipt_number = next_ffr_number(db)
    receipt.created_by = current_user.id

    record_inventory_event(
        db=db,
        product_id=data.fabric_id,
        product_type="FABRIC",
        transaction_type="IN",
        reference_type="PROCESSING_RECEIPT",
        reference_id=order.id,
        reference_number=receipt.receipt_number,
        quantity=float(data.qty_received),
        lot_number=data.lot_number,
        user_id=current_user.id,
    )

    order.status = "COMPLETED"
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


# ── Fabric Store Balance ──

class FabricBalance(BaseModel):
    id: int
    fabric_type: str
    subtype: str
    gsm: int
    composition: str
    color: Optional[str] = None
    stock_quantity: float
    unit: str

    class Config:
        from_attributes = True


@router.get("/grey-fabric-store", response_model=List[FabricBalance])
def get_grey_fabric_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grey fabrics — fabrics with stock that have KNIT_RECEIPT transactions."""
    return db.query(Fabric).filter(Fabric.stock_quantity > 0).order_by(Fabric.id).all()


@router.get("/finished-fabric-store", response_model=List[FabricBalance])
def get_finished_fabric_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All fabrics with positive stock."""
    return db.query(Fabric).filter(Fabric.stock_quantity > 0).order_by(Fabric.id).all()


@router.get("/fabric-ledger", response_model=List[InventoryTransactionSchema])
def get_fabric_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fabric_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InventoryTransaction).filter(InventoryTransaction.product_type == "FABRIC")
    if fabric_id:
        q = q.filter(InventoryTransaction.product_id == fabric_id)
    if date_from:
        q = q.filter(InventoryTransaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(InventoryTransaction.transaction_date <= date_to)
    return q.order_by(InventoryTransaction.id.desc()).offset(skip).limit(limit).all()
