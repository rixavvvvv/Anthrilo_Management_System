"""Gate Entry CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.db.models import User, GateEntry, Supplier
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.procurement import GateEntryCreate, GateEntryUpdate, GateEntrySchema
from app.core.numbering import next_ge_number

router = APIRouter()


@router.get("/", response_model=List[GateEntrySchema])
def list_gate_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(GateEntry).options(joinedload(GateEntry.supplier))
    if supplier_id:
        q = q.filter(GateEntry.supplier_id == supplier_id)
    if status:
        q = q.filter(GateEntry.status == status)
    if date_from:
        q = q.filter(GateEntry.entry_date >= date_from)
    if date_to:
        q = q.filter(GateEntry.entry_date <= date_to)
    return q.order_by(GateEntry.id.desc()).offset(skip).limit(limit).all()


@router.get("/{ge_id}", response_model=GateEntrySchema)
def get_gate_entry(
    ge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ge = db.query(GateEntry).options(joinedload(GateEntry.supplier)).filter(GateEntry.id == ge_id).first()
    if not ge:
        raise HTTPException(404, "Gate Entry not found")
    return ge


@router.post("/", response_model=GateEntrySchema, status_code=201)
def create_gate_entry(
    data: GateEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    ge = GateEntry(**data.model_dump())
    ge.gate_entry_number = next_ge_number(db)
    ge.status = "OPEN"
    ge.created_by = current_user.id
    db.add(ge)
    db.commit()
    db.refresh(ge)
    return ge


@router.put("/{ge_id}", response_model=GateEntrySchema)
def update_gate_entry(
    ge_id: int,
    data: GateEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    ge = db.query(GateEntry).filter(GateEntry.id == ge_id).first()
    if not ge:
        raise HTTPException(404, "Gate Entry not found")
    if ge.status != "OPEN":
        raise HTTPException(400, "Can only edit OPEN gate entries")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ge, field, value)
    db.commit()
    db.refresh(ge)
    return ge


@router.post("/{ge_id}/close")
def close_gate_entry(
    ge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    ge = db.query(GateEntry).filter(GateEntry.id == ge_id).first()
    if not ge:
        raise HTTPException(404, "Gate Entry not found")
    ge.status = "CLOSED"
    db.commit()
    return {"message": f"Gate Entry {ge.gate_entry_number} closed"}
