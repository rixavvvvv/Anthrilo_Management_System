"""Pydantic schemas for the Procurement module: Suppliers, PO, Gate Entry, MRN."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# ── Supplier ──

class SupplierBase(BaseModel):
    supplier_code: str
    supplier_name: str
    supplier_type: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_days: int = 0
    is_active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    supplier_name: Optional[str] = None
    supplier_type: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_days: Optional[int] = None
    is_active: Optional[bool] = None


class SupplierSchema(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Purchase Order ──

class POItemBase(BaseModel):
    item_type: str
    yarn_id: Optional[int] = None
    fabric_id: Optional[int] = None
    item_name: str
    item_code: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order_qty: float
    unit: str = "KGS"
    rate: float
    discount_percent: float = 0
    net_rate: float
    amount: float
    gst_percent: float = 0
    gst_amount: float = 0
    net_amount: float
    delivery_date: Optional[date] = None
    hsn_code: Optional[str] = None


class POItemCreate(POItemBase):
    pass


class POItemSchema(POItemBase):
    id: int
    po_id: int
    received_qty: float = 0
    pending_qty: float
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderBase(BaseModel):
    po_date: date
    supplier_id: int
    department: str
    delivery_terms: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_days: int = 0
    extra_percent: float = 0
    expiry_days: int = 90
    remarks: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[POItemCreate]


class PurchaseOrderUpdate(BaseModel):
    po_date: Optional[date] = None
    supplier_id: Optional[int] = None
    department: Optional[str] = None
    delivery_terms: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_days: Optional[int] = None
    extra_percent: Optional[float] = None
    expiry_days: Optional[int] = None
    remarks: Optional[str] = None
    items: Optional[List[POItemCreate]] = None


class PurchaseOrderSchema(PurchaseOrderBase):
    id: int
    po_number: str
    status: str
    gross_amount: float
    tax_amount: float
    freight_amount: float
    net_amount: float
    items: List[POItemSchema] = []
    supplier: Optional[SupplierSchema] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Gate Entry ──

class GateEntryBase(BaseModel):
    entry_date: date
    entry_time: Optional[str] = None
    supplier_id: int
    po_id: Optional[int] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    supplier_challan_no: Optional[str] = None
    supplier_challan_date: Optional[date] = None
    remarks: Optional[str] = None


class GateEntryCreate(GateEntryBase):
    pass


class GateEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    entry_time: Optional[str] = None
    supplier_id: Optional[int] = None
    po_id: Optional[int] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    supplier_challan_no: Optional[str] = None
    supplier_challan_date: Optional[date] = None
    remarks: Optional[str] = None


class GateEntrySchema(GateEntryBase):
    id: int
    gate_entry_number: str
    status: str
    supplier: Optional[SupplierSchema] = None
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── MRN ──

class MRNItemBase(BaseModel):
    po_item_id: Optional[int] = None
    item_type: str
    yarn_id: Optional[int] = None
    fabric_id: Optional[int] = None
    item_name: str
    item_code: Optional[str] = None
    color: Optional[str] = None
    bags: int = 0
    qty: float
    unit: str = "KGS"
    rate: float
    discount_percent: float = 0
    disc_rate: float = 0
    amount: float
    gst_percent: float = 0
    gst_amount: float = 0
    net_amount: float
    lot_number: Optional[str] = None
    p_type: Optional[str] = None
    geno: Optional[str] = None
    gpo: Optional[str] = None
    kpo: Optional[str] = None
    pono: Optional[str] = None
    location: Optional[str] = None
    mill: Optional[str] = None
    remarks: Optional[str] = None


class MRNItemCreate(MRNItemBase):
    pass


class MRNItemSchema(MRNItemBase):
    id: int
    mrn_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MRNBase(BaseModel):
    mrn_date: date
    supplier_id: int
    po_id: Optional[int] = None
    gate_entry_id: Optional[int] = None
    supplier_doc_no: Optional[str] = None
    supplier_doc_date: Optional[date] = None
    mrn_type: str = "Regular"
    remarks: Optional[str] = None
    gross_amount: float = 0
    tax_type: str = "GST"
    excise_duty_percent: float = 0
    excise_duty_amount: float = 0
    tax_percent: float = 0
    tax_amount: float = 0
    freight_amount: float = 0
    other_charges: float = 0
    net_amount: float


class MRNCreate(MRNBase):
    items: List[MRNItemCreate]


class MRNUpdate(BaseModel):
    mrn_date: Optional[date] = None
    supplier_id: Optional[int] = None
    po_id: Optional[int] = None
    gate_entry_id: Optional[int] = None
    supplier_doc_no: Optional[str] = None
    supplier_doc_date: Optional[date] = None
    mrn_type: Optional[str] = None
    remarks: Optional[str] = None
    gross_amount: Optional[float] = None
    tax_type: Optional[str] = None
    excise_duty_percent: Optional[float] = None
    excise_duty_amount: Optional[float] = None
    tax_percent: Optional[float] = None
    tax_amount: Optional[float] = None
    freight_amount: Optional[float] = None
    other_charges: Optional[float] = None
    net_amount: Optional[float] = None
    items: Optional[List[MRNItemCreate]] = None


class MRNSchema(MRNBase):
    id: int
    mrn_number: str
    status: str
    items: List[MRNItemSchema] = []
    supplier: Optional[SupplierSchema] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Inventory Transaction ──

class InventoryTransactionSchema(BaseModel):
    id: int
    product_id: int
    product_type: str
    transaction_type: str
    reference_type: str
    reference_id: int
    reference_number: str
    quantity: float
    balance_after: float
    lot_number: Optional[str] = None
    transaction_date: date
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
