"""Pydantic schemas for Manufacturing: Knitting, Processing, Garment Production."""
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, date


# ── Knit Order ──

class KnitOrderBase(BaseModel):
    order_date: date
    knitter_supplier_id: int
    fabric_id: int
    planned_qty_kg: float
    target_date: Optional[date] = None
    gsm: Optional[int] = None
    fabric_type: Optional[str] = None
    remarks: Optional[str] = None


class KnitOrderCreate(KnitOrderBase):
    pass


class KnitOrderUpdate(BaseModel):
    knitter_supplier_id: Optional[int] = None
    fabric_id: Optional[int] = None
    planned_qty_kg: Optional[float] = None
    target_date: Optional[date] = None
    gsm: Optional[int] = None
    fabric_type: Optional[str] = None
    remarks: Optional[str] = None


class KnitOrderSchema(KnitOrderBase):
    id: int
    knit_order_number: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Yarn Issue ──

class YarnIssueItemBase(BaseModel):
    yarn_id: int
    lot_number: Optional[str] = None
    qty: float
    unit: str = "KGS"


class YarnIssueItemCreate(YarnIssueItemBase):
    pass


class YarnIssueItemSchema(YarnIssueItemBase):
    id: int
    issue_id: int
    returned_qty: float = 0

    class Config:
        from_attributes = True


class YarnIssueBase(BaseModel):
    issue_date: date
    knit_order_id: int
    remarks: Optional[str] = None


class YarnIssueCreate(YarnIssueBase):
    items: List[YarnIssueItemCreate]


class YarnIssueSchema(YarnIssueBase):
    id: int
    issue_number: str
    status: str
    items: List[YarnIssueItemSchema] = []
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Grey Fabric Receipt ──

class GreyFabricReceiptBase(BaseModel):
    receipt_date: date
    knit_order_id: int
    fabric_id: int
    qty_received: float
    qty_rejected: float = 0
    lot_number: Optional[str] = None
    gsm_actual: Optional[int] = None
    remarks: Optional[str] = None


class GreyFabricReceiptCreate(GreyFabricReceiptBase):
    pass


class GreyFabricReceiptSchema(GreyFabricReceiptBase):
    id: int
    receipt_number: str
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Yarn Return ──

class YarnReturnItem(BaseModel):
    yarn_issue_item_id: int
    qty: float


class YarnReturnCreate(BaseModel):
    items: List[YarnReturnItem]


# ── Processing Order ──

class ProcessingOrderBase(BaseModel):
    order_date: date
    processor_supplier_id: int
    process_type: str
    target_date: Optional[date] = None
    remarks: Optional[str] = None


class ProcessingOrderCreate(ProcessingOrderBase):
    pass


class ProcessingOrderUpdate(BaseModel):
    processor_supplier_id: Optional[int] = None
    process_type: Optional[str] = None
    target_date: Optional[date] = None
    remarks: Optional[str] = None


class ProcessingOrderSchema(ProcessingOrderBase):
    id: int
    order_number: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Grey Fabric Issue ──

class GreyFabricIssueBase(BaseModel):
    issue_date: date
    processing_order_id: int
    fabric_id: int
    qty_issued: float
    lot_number: Optional[str] = None
    color: Optional[str] = None
    remarks: Optional[str] = None


class GreyFabricIssueCreate(GreyFabricIssueBase):
    pass


class GreyFabricIssueSchema(GreyFabricIssueBase):
    id: int
    issue_number: str
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Finished Fabric Receipt ──

class FinishedFabricReceiptBase(BaseModel):
    receipt_date: date
    processing_order_id: int
    fabric_id: int
    qty_received: float
    qty_rejected: float = 0
    lot_number: Optional[str] = None
    color: Optional[str] = None
    shade_code: Optional[str] = None
    gsm_actual: Optional[int] = None
    shrinkage_percent: float = 0
    remarks: Optional[str] = None


class FinishedFabricReceiptCreate(FinishedFabricReceiptBase):
    pass


class FinishedFabricReceiptSchema(FinishedFabricReceiptBase):
    id: int
    receipt_number: str
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Cutting Order ──

class CuttingOrderBase(BaseModel):
    order_date: date
    garment_id: int
    production_plan_id: Optional[int] = None
    fabric_id: int
    fabric_qty_issued: float
    planned_pieces: int
    size_breakdown: Optional[Dict[str, int]] = None
    marker_efficiency: Optional[float] = None
    remarks: Optional[str] = None


class CuttingOrderCreate(CuttingOrderBase):
    pass


class CuttingOrderUpdate(BaseModel):
    garment_id: Optional[int] = None
    fabric_id: Optional[int] = None
    fabric_qty_issued: Optional[float] = None
    planned_pieces: Optional[int] = None
    size_breakdown: Optional[Dict[str, int]] = None
    marker_efficiency: Optional[float] = None
    remarks: Optional[str] = None


class CuttingOrderSchema(CuttingOrderBase):
    id: int
    cutting_order_number: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Cutting Check ──

class CuttingCheckBase(BaseModel):
    cutting_order_id: int
    check_date: date
    pieces_cut: int
    pieces_ok: int
    pieces_rejected: int = 0
    fabric_used_kg: Optional[float] = None
    fabric_wastage_kg: Optional[float] = None
    size_breakdown_actual: Optional[Dict[str, int]] = None
    checked_by: Optional[str] = None
    remarks: Optional[str] = None


class CuttingCheckCreate(CuttingCheckBase):
    pass


class CuttingCheckSchema(CuttingCheckBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Stitching Order ──

class StitchingOrderBase(BaseModel):
    order_date: date
    cutting_order_id: int
    stitcher_supplier_id: Optional[int] = None
    pieces_issued: int
    size_breakdown: Optional[Dict[str, int]] = None
    target_date: Optional[date] = None
    stitching_rate: Optional[float] = None
    remarks: Optional[str] = None


class StitchingOrderCreate(StitchingOrderBase):
    pass


class StitchingOrderUpdate(BaseModel):
    stitcher_supplier_id: Optional[int] = None
    pieces_issued: Optional[int] = None
    size_breakdown: Optional[Dict[str, int]] = None
    target_date: Optional[date] = None
    stitching_rate: Optional[float] = None
    remarks: Optional[str] = None


class StitchingOrderSchema(StitchingOrderBase):
    id: int
    stitching_order_number: str
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Garment Finishing ──

class GarmentFinishingBase(BaseModel):
    stitching_order_id: int
    garment_id: int
    stage: str
    stage_date: date
    pieces_in: int
    pieces_ok: int
    pieces_rejected: int = 0
    size_breakdown: Optional[Dict[str, int]] = None
    operator: Optional[str] = None
    remarks: Optional[str] = None


class GarmentFinishingCreate(GarmentFinishingBase):
    pass


class GarmentFinishingSchema(GarmentFinishingBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Barcode Label ──

class BarcodeLabelBase(BaseModel):
    garment_finishing_id: int
    garment_id: int
    size: str
    barcode: str
    mrp: float
    batch_number: Optional[str] = None


class BarcodeLabelCreate(BarcodeLabelBase):
    pass


class BarcodeLabelSchema(BarcodeLabelBase):
    id: int
    printed_at: Optional[datetime] = None
    is_printed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class BarcodeBatchCreate(BaseModel):
    """Generate batch of barcodes for a finishing stage."""
    garment_finishing_id: int
    garment_id: int
    mrp: float
    batch_number: Optional[str] = None
    sizes: Dict[str, int]  # {"S": 100, "M": 200}
