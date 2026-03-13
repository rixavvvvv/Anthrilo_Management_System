"""
Auto-generates sequential document numbers per year.
Format: PREFIX-YYYY-NNNN  e.g. PO-2026-0001
"""
from sqlalchemy.orm import Session
from datetime import date


def _next_number(db: Session, model_class, number_field: str, prefix: str) -> str:
    year = date.today().year
    count = db.query(model_class).filter(
        getattr(model_class, number_field).like(f"{prefix}-{year}-%")
    ).count()
    return f"{prefix}-{year}-{str(count + 1).zfill(4)}"


def next_po_number(db: Session) -> str:
    from app.db.models import PurchaseOrder
    return _next_number(db, PurchaseOrder, "po_number", "PO")


def next_ge_number(db: Session) -> str:
    from app.db.models import GateEntry
    return _next_number(db, GateEntry, "gate_entry_number", "GE")


def next_mrn_number(db: Session) -> str:
    from app.db.models import MaterialsReceiptNote
    return _next_number(db, MaterialsReceiptNote, "mrn_number", "MRN")


def next_ko_number(db: Session) -> str:
    from app.db.models import KnitOrder
    return _next_number(db, KnitOrder, "knit_order_number", "KO")


def next_yi_number(db: Session) -> str:
    from app.db.models import YarnIssueToKnitter
    return _next_number(db, YarnIssueToKnitter, "issue_number", "YI")


def next_gfr_number(db: Session) -> str:
    from app.db.models import GreyFabricReceipt
    return _next_number(db, GreyFabricReceipt, "receipt_number", "GFR")


def next_do_number(db: Session) -> str:
    from app.db.models import ProcessingOrder
    return _next_number(db, ProcessingOrder, "order_number", "DO")


def next_gfi_number(db: Session) -> str:
    from app.db.models import GreyFabricIssue
    return _next_number(db, GreyFabricIssue, "issue_number", "GFI")


def next_ffr_number(db: Session) -> str:
    from app.db.models import FinishedFabricReceipt
    return _next_number(db, FinishedFabricReceipt, "receipt_number", "FFR")


def next_co_number(db: Session) -> str:
    from app.db.models import CuttingOrder
    return _next_number(db, CuttingOrder, "cutting_order_number", "CO")


def next_sto_number(db: Session) -> str:
    from app.db.models import StitchingOrder
    return _next_number(db, StitchingOrder, "stitching_order_number", "STO")
