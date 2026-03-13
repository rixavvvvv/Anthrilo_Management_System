"""Garment Production: Cutting Orders, Cutting Check, Stitching, Finishing, Barcoding."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.db.session import get_db
from app.db.models import (
    User, CuttingOrder, CuttingCheck, StitchingOrder,
    GarmentFinishing, BarcodeLabel, Garment, Fabric,
)
from app.api.v1.endpoints.auth import get_current_user, require_admin, require_manager_or_above
from app.schemas.manufacturing import (
    CuttingOrderCreate, CuttingOrderUpdate, CuttingOrderSchema,
    CuttingCheckCreate, CuttingCheckSchema,
    StitchingOrderCreate, StitchingOrderUpdate, StitchingOrderSchema,
    GarmentFinishingCreate, GarmentFinishingSchema,
    BarcodeLabelSchema, BarcodeBatchCreate,
)
from app.core.numbering import next_co_number, next_sto_number
from app.services.inventory_service import record_inventory_event

router = APIRouter()

FINISHING_STAGES = [
    "THREAD_CUTTING", "RAW_CHECKING", "PRESSING",
    "FINAL_CHECKING", "PACKING", "BARCODING",
]


# ── Cutting Orders ──

@router.get("/cutting-orders", response_model=List[CuttingOrderSchema])
def list_cutting_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    garment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CuttingOrder)
    if status:
        q = q.filter(CuttingOrder.status == status)
    if garment_id:
        q = q.filter(CuttingOrder.garment_id == garment_id)
    return q.order_by(CuttingOrder.id.desc()).offset(skip).limit(limit).all()


@router.get("/cutting-orders/{order_id}", response_model=CuttingOrderSchema)
def get_cutting_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(CuttingOrder).filter(CuttingOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Cutting Order not found")
    return order


@router.post("/cutting-orders", response_model=CuttingOrderSchema, status_code=201)
def create_cutting_order(
    data: CuttingOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    garment = db.query(Garment).filter(Garment.id == data.garment_id).first()
    if not garment:
        raise HTTPException(404, "Garment not found")
    fabric = db.query(Fabric).filter(Fabric.id == data.fabric_id).first()
    if not fabric:
        raise HTTPException(404, "Fabric not found")

    order = CuttingOrder(**data.model_dump())
    order.cutting_order_number = next_co_number(db)
    order.status = "OPEN"
    order.created_by = current_user.id

    # Issue finished fabric for cutting
    record_inventory_event(
        db=db,
        product_id=data.fabric_id,
        product_type="FABRIC",
        transaction_type="OUT",
        reference_type="CUTTING_ISSUE",
        reference_id=0,  # will update after commit
        reference_number=order.cutting_order_number,
        quantity=float(data.fabric_qty_issued),
        user_id=current_user.id,
    )

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/cutting-orders/{order_id}", response_model=CuttingOrderSchema)
def update_cutting_order(
    order_id: int,
    data: CuttingOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(CuttingOrder).filter(CuttingOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Cutting Order not found")
    if order.status not in ("OPEN", "CUTTING"):
        raise HTTPException(400, f"Cannot edit order in status {order.status}")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


# ── Cutting Check ──

@router.post("/cutting-check", response_model=CuttingCheckSchema, status_code=201)
def create_cutting_check(
    data: CuttingCheckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(CuttingOrder).filter(CuttingOrder.id == data.cutting_order_id).first()
    if not order:
        raise HTTPException(404, "Cutting Order not found")

    check = CuttingCheck(**data.model_dump())
    order.status = "CHECKING"
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.get("/cutting-checks/{order_id}", response_model=List[CuttingCheckSchema])
def list_cutting_checks(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(CuttingCheck).filter(CuttingCheck.cutting_order_id == order_id).all()


# ── Stitching Orders ──

@router.get("/stitching-orders", response_model=List[StitchingOrderSchema])
def list_stitching_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(StitchingOrder)
    if status:
        q = q.filter(StitchingOrder.status == status)
    return q.order_by(StitchingOrder.id.desc()).offset(skip).limit(limit).all()


@router.post("/stitching-orders", response_model=StitchingOrderSchema, status_code=201)
def create_stitching_order(
    data: StitchingOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    cutting_order = db.query(CuttingOrder).filter(CuttingOrder.id == data.cutting_order_id).first()
    if not cutting_order:
        raise HTTPException(404, "Cutting Order not found")

    order = StitchingOrder(**data.model_dump())
    order.stitching_order_number = next_sto_number(db)
    order.status = "OPEN"
    order.created_by = current_user.id

    cutting_order.status = "STITCHING"
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/stitching-orders/{order_id}", response_model=StitchingOrderSchema)
def update_stitching_order(
    order_id: int,
    data: StitchingOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    order = db.query(StitchingOrder).filter(StitchingOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Stitching Order not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


# ── Garment Finishing ──

@router.get("/finishing/{stitching_order_id}", response_model=List[GarmentFinishingSchema])
def list_finishing_stages(
    stitching_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(GarmentFinishing)
        .filter(GarmentFinishing.stitching_order_id == stitching_order_id)
        .order_by(GarmentFinishing.id)
        .all()
    )


@router.get("/finishing/active")
def get_active_finishing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of stitching orders with active finishing stages (not yet BARCODING complete)."""
    count = (
        db.query(StitchingOrder)
        .filter(StitchingOrder.status == "IN_PROGRESS")
        .count()
    )
    return {"active_count": count}


@router.post("/finishing", response_model=GarmentFinishingSchema, status_code=201)
def record_finishing_stage(
    data: GarmentFinishingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    stitching = db.query(StitchingOrder).filter(StitchingOrder.id == data.stitching_order_id).first()
    if not stitching:
        raise HTTPException(404, "Stitching Order not found")
    if data.stage not in FINISHING_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {FINISHING_STAGES}")

    stage = GarmentFinishing(**data.model_dump())
    stitching.status = "IN_PROGRESS"

    if data.stage == "BARCODING":
        stitching.status = "COMPLETED"
        # Also mark cutting order completed
        cutting = db.query(CuttingOrder).filter(CuttingOrder.id == stitching.cutting_order_id).first()
        if cutting:
            cutting.status = "COMPLETED"

    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


# ── Barcoding ──

@router.post("/barcodes/batch", response_model=List[BarcodeLabelSchema])
def generate_barcode_batch(
    data: BarcodeBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    """Generate a batch of unique barcodes for given sizes."""
    garment = db.query(Garment).filter(Garment.id == data.garment_id).first()
    if not garment:
        raise HTTPException(404, "Garment not found")

    labels = []
    for size, qty in data.sizes.items():
        for _ in range(qty):
            barcode = f"AN-{garment.style_sku}-{size}-{uuid.uuid4().hex[:8].upper()}"
            label = BarcodeLabel(
                garment_finishing_id=data.garment_finishing_id,
                garment_id=data.garment_id,
                size=size,
                barcode=barcode,
                mrp=data.mrp,
                batch_number=data.batch_number,
            )
            db.add(label)
            labels.append(label)

    db.commit()
    for label in labels:
        db.refresh(label)
    return labels


@router.get("/barcodes", response_model=List[BarcodeLabelSchema])
def list_barcodes(
    garment_id: Optional[int] = Query(None),
    batch_number: Optional[str] = Query(None),
    is_printed: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(BarcodeLabel)
    if garment_id:
        q = q.filter(BarcodeLabel.garment_id == garment_id)
    if batch_number:
        q = q.filter(BarcodeLabel.batch_number == batch_number)
    if is_printed is not None:
        q = q.filter(BarcodeLabel.is_printed == is_printed)
    return q.order_by(BarcodeLabel.id.desc()).offset(skip).limit(limit).all()


@router.post("/barcodes/mark-printed")
def mark_barcodes_printed(
    barcode_ids: List[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_above),
):
    """Mark a list of barcode labels as printed."""
    updated = 0
    for bid in barcode_ids:
        label = db.query(BarcodeLabel).filter(BarcodeLabel.id == bid).first()
        if label and not label.is_printed:
            label.is_printed = True
            label.printed_at = datetime.utcnow()
            updated += 1
    db.commit()
    return {"message": f"{updated} barcodes marked as printed"}
