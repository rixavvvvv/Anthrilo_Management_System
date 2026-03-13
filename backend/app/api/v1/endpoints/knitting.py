"""Knitting module: Knit Orders, Yarn Issue, Grey Fabric Receipt, Yarn Return."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import (
    User, KnitOrder, YarnIssueToKnitter, YarnIssueItem,
    GreyFabricReceipt, Supplier, Fabric,
)
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.manufacturing import (
    KnitOrderCreate, KnitOrderUpdate, KnitOrderSchema,
    YarnIssueCreate, YarnIssueSchema,
    GreyFabricReceiptCreate, GreyFabricReceiptSchema,
    YarnReturnCreate,
)
from app.core.numbering import next_ko_number, next_yi_number, next_gfr_number
from app.services.inventory_service import record_inventory_event

router = APIRouter()


# ── Knit Orders ──

@router.get("/orders", response_model=List[KnitOrderSchema])
def list_knit_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    knitter_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(KnitOrder)
    if status:
        q = q.filter(KnitOrder.status == status)
    if knitter_id:
        q = q.filter(KnitOrder.knitter_supplier_id == knitter_id)
    return q.order_by(KnitOrder.id.desc()).offset(skip).limit(limit).all()


@router.get("/orders/{order_id}", response_model=KnitOrderSchema)
def get_knit_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(KnitOrder).filter(KnitOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Knit Order not found")
    return order


@router.post("/orders", response_model=KnitOrderSchema, status_code=201)
def create_knit_order(
    data: KnitOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    supplier = db.query(Supplier).filter(Supplier.id == data.knitter_supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Knitter supplier not found")
    fabric = db.query(Fabric).filter(Fabric.id == data.fabric_id).first()
    if not fabric:
        raise HTTPException(404, "Fabric not found")

    order = KnitOrder(**data.model_dump())
    order.knit_order_number = next_ko_number(db)
    order.status = "OPEN"
    order.created_by = current_user.id
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/orders/{order_id}", response_model=KnitOrderSchema)
def update_knit_order(
    order_id: int,
    data: KnitOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(KnitOrder).filter(KnitOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Knit Order not found")
    if order.status not in ("OPEN", "YARN_ISSUED"):
        raise HTTPException(400, f"Cannot edit order in status {order.status}")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


# ── Yarn Issue ──

@router.get("/yarn-issues", response_model=List[YarnIssueSchema])
def list_yarn_issues(
    knit_order_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(YarnIssueToKnitter).options(joinedload(YarnIssueToKnitter.items))
    if knit_order_id:
        q = q.filter(YarnIssueToKnitter.knit_order_id == knit_order_id)
    return q.order_by(YarnIssueToKnitter.id.desc()).all()


@router.post("/yarn-issues", response_model=YarnIssueSchema, status_code=201)
def create_yarn_issue(
    data: YarnIssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    knit_order = db.query(KnitOrder).filter(KnitOrder.id == data.knit_order_id).first()
    if not knit_order:
        raise HTTPException(404, "Knit Order not found")

    issue_data = data.model_dump(exclude={"items"})
    issue = YarnIssueToKnitter(**issue_data)
    issue.issue_number = next_yi_number(db)
    issue.status = "ISSUED"
    issue.created_by = current_user.id

    for item_data in data.items:
        item = YarnIssueItem(**item_data.model_dump())
        issue.items.append(item)

        # Record inventory OUT
        record_inventory_event(
            db=db,
            product_id=item.yarn_id,
            product_type="YARN",
            transaction_type="OUT",
            reference_type="KNIT_ISSUE",
            reference_id=knit_order.id,
            reference_number=issue.issue_number,
            quantity=float(item.qty),
            lot_number=item.lot_number,
            user_id=current_user.id,
        )

    # Update knit order status
    knit_order.status = "YARN_ISSUED"

    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


# ── Grey Fabric Receipt ──

@router.get("/grey-fabric-receipts", response_model=List[GreyFabricReceiptSchema])
def list_grey_fabric_receipts(
    knit_order_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(GreyFabricReceipt)
    if knit_order_id:
        q = q.filter(GreyFabricReceipt.knit_order_id == knit_order_id)
    return q.order_by(GreyFabricReceipt.id.desc()).all()


@router.post("/grey-fabric-receipt", response_model=GreyFabricReceiptSchema, status_code=201)
def create_grey_fabric_receipt(
    data: GreyFabricReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    knit_order = db.query(KnitOrder).filter(KnitOrder.id == data.knit_order_id).first()
    if not knit_order:
        raise HTTPException(404, "Knit Order not found")

    receipt = GreyFabricReceipt(**data.model_dump())
    receipt.receipt_number = next_gfr_number(db)
    receipt.created_by = current_user.id

    # Record inventory IN for grey fabric
    record_inventory_event(
        db=db,
        product_id=data.fabric_id,
        product_type="FABRIC",
        transaction_type="IN",
        reference_type="KNIT_RECEIPT",
        reference_id=knit_order.id,
        reference_number=receipt.receipt_number,
        quantity=float(data.qty_received),
        lot_number=data.lot_number,
        user_id=current_user.id,
    )

    # Update knit order status
    knit_order.status = "COMPLETED"

    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


# ── Yarn Return ──

@router.post("/yarn-return/{issue_id}")
def return_yarn(
    issue_id: int,
    data: YarnReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    issue = (
        db.query(YarnIssueToKnitter)
        .options(joinedload(YarnIssueToKnitter.items))
        .filter(YarnIssueToKnitter.id == issue_id)
        .first()
    )
    if not issue:
        raise HTTPException(404, "Yarn Issue not found")

    for return_item in data.items:
        yarn_item = next(
            (i for i in issue.items if i.id == return_item.yarn_issue_item_id), None
        )
        if not yarn_item:
            raise HTTPException(404, f"Yarn issue item {return_item.yarn_issue_item_id} not found")

        max_returnable = float(yarn_item.qty) - float(yarn_item.returned_qty)
        if return_item.qty > max_returnable:
            raise HTTPException(400, f"Cannot return more than {max_returnable} for item {yarn_item.id}")

        yarn_item.returned_qty = float(yarn_item.returned_qty) + return_item.qty

        record_inventory_event(
            db=db,
            product_id=yarn_item.yarn_id,
            product_type="YARN",
            transaction_type="IN",
            reference_type="KNIT_RETURN",
            reference_id=issue.id,
            reference_number=issue.issue_number,
            quantity=return_item.qty,
            lot_number=yarn_item.lot_number,
            user_id=current_user.id,
        )

    issue.status = "PARTIALLY_RETURNED"
    db.commit()
    return {"message": "Yarn return recorded"}
