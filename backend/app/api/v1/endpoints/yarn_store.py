"""Yarn Store balance and ledger endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import User, Yarn, InventoryTransaction
from app.api.v1.endpoints.auth import get_current_user, require_manager_or_above
from app.schemas.procurement import InventoryTransactionSchema
from app.services.inventory_service import record_inventory_event
from pydantic import BaseModel

router = APIRouter()


class YarnBalance(BaseModel):
    id: int
    yarn_type: str
    yarn_count: str
    composition: str
    stock_quantity: float
    unit: str

    class Config:
        from_attributes = True


class ManualAdjustment(BaseModel):
    yarn_id: int
    quantity: float
    transaction_type: str  # IN | OUT
    remarks: str


@router.get("/balance", response_model=List[YarnBalance])
def get_yarn_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Yarn).order_by(Yarn.id).all()


@router.get("/balance/{yarn_id}")
def get_yarn_balance_detail(
    yarn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    yarn = db.query(Yarn).filter(Yarn.id == yarn_id).first()
    if not yarn:
        raise HTTPException(404, "Yarn not found")

    transactions = (
        db.query(InventoryTransaction)
        .filter(InventoryTransaction.product_id == yarn_id, InventoryTransaction.product_type == "YARN")
        .order_by(InventoryTransaction.id.desc())
        .limit(100)
        .all()
    )

    return {
        "yarn": YarnBalance.model_validate(yarn),
        "transactions": [InventoryTransactionSchema.model_validate(t) for t in transactions],
    }


@router.get("/ledger", response_model=List[InventoryTransactionSchema])
def get_yarn_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    yarn_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(InventoryTransaction).filter(InventoryTransaction.product_type == "YARN")
    if yarn_id:
        q = q.filter(InventoryTransaction.product_id == yarn_id)
    if date_from:
        q = q.filter(InventoryTransaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(InventoryTransaction.transaction_date <= date_to)
    return q.order_by(InventoryTransaction.id.desc()).offset(skip).limit(limit).all()


@router.post("/adjustment")
def manual_adjustment(
    data: ManualAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    if data.transaction_type not in ("IN", "OUT"):
        raise HTTPException(400, "transaction_type must be IN or OUT")

    record_inventory_event(
        db=db,
        product_id=data.yarn_id,
        product_type="YARN",
        transaction_type=data.transaction_type,
        reference_type="MANUAL",
        reference_id=0,
        reference_number=f"ADJ-{date.today().isoformat()}",
        quantity=data.quantity,
        remarks=data.remarks,
        user_id=current_user.id,
    )
    db.commit()
    return {"message": "Adjustment recorded"}
