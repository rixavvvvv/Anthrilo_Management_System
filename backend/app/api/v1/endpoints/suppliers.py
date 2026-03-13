"""Supplier Master CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import User, Supplier
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.procurement import SupplierCreate, SupplierUpdate, SupplierSchema

router = APIRouter()


@router.get("/", response_model=List[SupplierSchema])
def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    supplier_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Supplier)
    if search:
        q = q.filter(
            (Supplier.supplier_name.ilike(f"%{search}%")) |
            (Supplier.supplier_code.ilike(f"%{search}%"))
        )
    if supplier_type:
        q = q.filter(Supplier.supplier_type == supplier_type)
    if is_active is not None:
        q = q.filter(Supplier.is_active == is_active)
    return q.order_by(Supplier.id.desc()).offset(skip).limit(limit).all()


@router.get("/{supplier_id}", response_model=SupplierSchema)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    return supplier


@router.post("/", response_model=SupplierSchema, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    existing = db.query(Supplier).filter(Supplier.supplier_code == data.supplier_code).first()
    if existing:
        raise HTTPException(400, f"Supplier code '{data.supplier_code}' already exists")
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierSchema)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    supplier.is_active = False
    db.commit()
    return {"message": "Supplier deactivated"}
