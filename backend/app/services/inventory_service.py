"""Universal inventory event recorder — SAP-style transactional ledger."""
from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.db.models import Yarn, Fabric, InventoryTransaction


def record_inventory_event(
    db: Session,
    product_id: int,
    product_type: str,
    transaction_type: str,
    reference_type: str,
    reference_id: int,
    reference_number: str,
    quantity: float,
    lot_number: str = None,
    remarks: str = None,
    user_id: int = None,
):
    """
    Called for EVERY stock movement. Locks the row, validates,
    updates balance, and writes a ledger record.
    Caller must call db.commit() after this function.
    """
    if product_type == "YARN":
        item = db.query(Yarn).filter(Yarn.id == product_id).with_for_update().first()
    elif product_type == "FABRIC":
        item = db.query(Fabric).filter(Fabric.id == product_id).with_for_update().first()
    else:
        raise HTTPException(400, f"Unknown product_type: {product_type}")

    if not item:
        raise HTTPException(404, f"{product_type} id={product_id} not found")

    current_stock = float(item.stock_quantity)

    if transaction_type == "OUT" and current_stock < quantity:
        raise HTTPException(
            400,
            f"Insufficient stock for {product_type} id={product_id}. "
            f"Available: {current_stock}, Requested: {quantity}"
        )

    if transaction_type == "IN":
        item.stock_quantity = current_stock + quantity
    else:
        item.stock_quantity = current_stock - quantity

    ledger = InventoryTransaction(
        product_id=product_id,
        product_type=product_type,
        transaction_type=transaction_type,
        reference_type=reference_type,
        reference_id=reference_id,
        reference_number=reference_number,
        quantity=quantity,
        balance_after=float(item.stock_quantity),
        lot_number=lot_number,
        transaction_date=date.today(),
        created_by=user_id,
    )
    db.add(ledger)
