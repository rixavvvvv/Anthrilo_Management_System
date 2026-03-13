"""Add manufacturing module tables

Revision ID: 004_manufacturing
Revises: 002_add_sync_tables
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004_manufacturing'
down_revision = '002_add_sync_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. suppliers
    op.create_table('suppliers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('supplier_code', sa.String(50), nullable=False),
        sa.Column('supplier_name', sa.String(255), nullable=False),
        sa.Column('supplier_type', sa.String(50), nullable=False),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('gstin', sa.String(20), nullable=True),
        sa.Column('pan', sa.String(20), nullable=True),
        sa.Column('payment_terms', sa.String(255), nullable=True),
        sa.Column('credit_days', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_suppliers_id', 'suppliers', ['id'])
    op.create_index('ix_suppliers_supplier_code', 'suppliers', ['supplier_code'], unique=True)

    # 2. purchase_orders
    op.create_table('purchase_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('po_number', sa.String(50), nullable=False),
        sa.Column('po_date', sa.Date(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('department', sa.String(50), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='OPEN'),
        sa.Column('delivery_terms', sa.String(255), nullable=True),
        sa.Column('payment_terms', sa.String(255), nullable=True),
        sa.Column('credit_days', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('extra_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('expiry_days', sa.Integer(), nullable=True, server_default='90'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('gross_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('freight_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_purchase_orders_id', 'purchase_orders', ['id'])
    op.create_index('ix_purchase_orders_po_number', 'purchase_orders', ['po_number'], unique=True)
    op.create_index('ix_purchase_orders_po_date', 'purchase_orders', ['po_date'])
    op.create_index('ix_purchase_orders_supplier_id', 'purchase_orders', ['supplier_id'])

    # 3. po_items
    op.create_table('po_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=False),
        sa.Column('item_type', sa.String(30), nullable=False),
        sa.Column('yarn_id', sa.Integer(), nullable=True),
        sa.Column('fabric_id', sa.Integer(), nullable=True),
        sa.Column('item_name', sa.String(255), nullable=False),
        sa.Column('item_code', sa.String(100), nullable=True),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('order_qty', sa.Numeric(12, 2), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False, server_default='KGS'),
        sa.Column('rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('net_rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('gst_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('gst_amount', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('received_qty', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('pending_qty', sa.Numeric(12, 2), nullable=False),
        sa.Column('delivery_date', sa.Date(), nullable=True),
        sa.Column('hsn_code', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['yarn_id'], ['yarns.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
    )
    op.create_index('ix_po_items_id', 'po_items', ['id'])
    op.create_index('ix_po_items_po_id', 'po_items', ['po_id'])

    # 4. gate_entries
    op.create_table('gate_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gate_entry_number', sa.String(50), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('entry_time', sa.String(10), nullable=True),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=True),
        sa.Column('vehicle_number', sa.String(50), nullable=True),
        sa.Column('driver_name', sa.String(100), nullable=True),
        sa.Column('supplier_challan_no', sa.String(100), nullable=True),
        sa.Column('supplier_challan_date', sa.Date(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='OPEN'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_gate_entries_id', 'gate_entries', ['id'])
    op.create_index('ix_gate_entries_gate_entry_number', 'gate_entries', ['gate_entry_number'], unique=True)
    op.create_index('ix_gate_entries_entry_date', 'gate_entries', ['entry_date'])
    op.create_index('ix_gate_entries_supplier_id', 'gate_entries', ['supplier_id'])

    # 5. mrns
    op.create_table('mrns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mrn_number', sa.String(50), nullable=False),
        sa.Column('mrn_date', sa.Date(), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('po_id', sa.Integer(), nullable=True),
        sa.Column('gate_entry_id', sa.Integer(), nullable=True),
        sa.Column('supplier_doc_no', sa.String(100), nullable=True),
        sa.Column('supplier_doc_date', sa.Date(), nullable=True),
        sa.Column('mrn_type', sa.String(30), nullable=True, server_default='Regular'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('gross_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('tax_type', sa.String(10), nullable=True, server_default='GST'),
        sa.Column('excise_duty_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('excise_duty_amount', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('tax_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('freight_amount', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('other_charges', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, server_default='DRAFT'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['gate_entry_id'], ['gate_entries.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_mrns_id', 'mrns', ['id'])
    op.create_index('ix_mrns_mrn_number', 'mrns', ['mrn_number'], unique=True)
    op.create_index('ix_mrns_mrn_date', 'mrns', ['mrn_date'])
    op.create_index('ix_mrns_supplier_id', 'mrns', ['supplier_id'])

    # 6. mrn_items
    op.create_table('mrn_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mrn_id', sa.Integer(), nullable=False),
        sa.Column('po_item_id', sa.Integer(), nullable=True),
        sa.Column('item_type', sa.String(30), nullable=False),
        sa.Column('yarn_id', sa.Integer(), nullable=True),
        sa.Column('fabric_id', sa.Integer(), nullable=True),
        sa.Column('item_name', sa.String(255), nullable=False),
        sa.Column('item_code', sa.String(100), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('bags', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('qty', sa.Numeric(12, 2), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False, server_default='KGS'),
        sa.Column('rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('disc_rate', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('gst_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('gst_amount', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('p_type', sa.String(30), nullable=True),
        sa.Column('geno', sa.String(50), nullable=True),
        sa.Column('gpo', sa.String(50), nullable=True),
        sa.Column('kpo', sa.String(50), nullable=True),
        sa.Column('pono', sa.String(50), nullable=True),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('mill', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['mrn_id'], ['mrns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['po_item_id'], ['po_items.id']),
        sa.ForeignKeyConstraint(['yarn_id'], ['yarns.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
    )
    op.create_index('ix_mrn_items_id', 'mrn_items', ['id'])
    op.create_index('ix_mrn_items_mrn_id', 'mrn_items', ['mrn_id'])

    # 7. inventory_transactions
    op.create_table('inventory_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('product_type', sa.String(20), nullable=False),
        sa.Column('transaction_type', sa.String(10), nullable=False),
        sa.Column('reference_type', sa.String(40), nullable=False),
        sa.Column('reference_id', sa.Integer(), nullable=False),
        sa.Column('reference_number', sa.String(50), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(12, 2), nullable=False),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_inventory_transactions_id', 'inventory_transactions', ['id'])
    op.create_index('ix_inventory_transactions_product_id', 'inventory_transactions', ['product_id'])
    op.create_index('ix_inventory_transactions_product_type', 'inventory_transactions', ['product_type'])
    op.create_index('ix_inventory_transactions_transaction_type', 'inventory_transactions', ['transaction_type'])
    op.create_index('ix_inventory_transactions_transaction_date', 'inventory_transactions', ['transaction_date'])

    # 8. knit_orders
    op.create_table('knit_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('knit_order_number', sa.String(50), nullable=False),
        sa.Column('order_date', sa.Date(), nullable=False),
        sa.Column('knitter_supplier_id', sa.Integer(), nullable=False),
        sa.Column('fabric_id', sa.Integer(), nullable=False),
        sa.Column('planned_qty_kg', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(30), nullable=True, server_default='OPEN'),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('gsm', sa.Integer(), nullable=True),
        sa.Column('fabric_type', sa.String(50), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['knitter_supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_knit_orders_id', 'knit_orders', ['id'])
    op.create_index('ix_knit_orders_knit_order_number', 'knit_orders', ['knit_order_number'], unique=True)
    op.create_index('ix_knit_orders_order_date', 'knit_orders', ['order_date'])

    # 9. yarn_issues_to_knitter
    op.create_table('yarn_issues_to_knitter',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('issue_number', sa.String(50), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('knit_order_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, server_default='ISSUED'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['knit_order_id'], ['knit_orders.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_yarn_issues_to_knitter_id', 'yarn_issues_to_knitter', ['id'])
    op.create_index('ix_yarn_issues_to_knitter_issue_number', 'yarn_issues_to_knitter', ['issue_number'], unique=True)
    op.create_index('ix_yarn_issues_to_knitter_issue_date', 'yarn_issues_to_knitter', ['issue_date'])
    op.create_index('ix_yarn_issues_to_knitter_knit_order_id', 'yarn_issues_to_knitter', ['knit_order_id'])

    # 10. yarn_issue_items
    op.create_table('yarn_issue_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('issue_id', sa.Integer(), nullable=False),
        sa.Column('yarn_id', sa.Integer(), nullable=False),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('qty', sa.Numeric(12, 2), nullable=False),
        sa.Column('unit', sa.String(20), nullable=True, server_default='KGS'),
        sa.Column('returned_qty', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['issue_id'], ['yarn_issues_to_knitter.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['yarn_id'], ['yarns.id']),
    )
    op.create_index('ix_yarn_issue_items_id', 'yarn_issue_items', ['id'])

    # 11. grey_fabric_receipts
    op.create_table('grey_fabric_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('receipt_number', sa.String(50), nullable=False),
        sa.Column('receipt_date', sa.Date(), nullable=False),
        sa.Column('knit_order_id', sa.Integer(), nullable=False),
        sa.Column('fabric_id', sa.Integer(), nullable=False),
        sa.Column('qty_received', sa.Numeric(12, 2), nullable=False),
        sa.Column('qty_rejected', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('gsm_actual', sa.Integer(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['knit_order_id'], ['knit_orders.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_grey_fabric_receipts_id', 'grey_fabric_receipts', ['id'])
    op.create_index('ix_grey_fabric_receipts_receipt_number', 'grey_fabric_receipts', ['receipt_number'], unique=True)
    op.create_index('ix_grey_fabric_receipts_receipt_date', 'grey_fabric_receipts', ['receipt_date'])
    op.create_index('ix_grey_fabric_receipts_knit_order_id', 'grey_fabric_receipts', ['knit_order_id'])

    # 12. processing_orders
    op.create_table('processing_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_number', sa.String(50), nullable=False),
        sa.Column('order_date', sa.Date(), nullable=False),
        sa.Column('processor_supplier_id', sa.Integer(), nullable=False),
        sa.Column('process_type', sa.String(30), nullable=False),
        sa.Column('status', sa.String(30), nullable=True, server_default='OPEN'),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['processor_supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_processing_orders_id', 'processing_orders', ['id'])
    op.create_index('ix_processing_orders_order_number', 'processing_orders', ['order_number'], unique=True)
    op.create_index('ix_processing_orders_order_date', 'processing_orders', ['order_date'])

    # 13. grey_fabric_issues
    op.create_table('grey_fabric_issues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('issue_number', sa.String(50), nullable=False),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('processing_order_id', sa.Integer(), nullable=False),
        sa.Column('fabric_id', sa.Integer(), nullable=False),
        sa.Column('qty_issued', sa.Numeric(12, 2), nullable=False),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['processing_order_id'], ['processing_orders.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_grey_fabric_issues_id', 'grey_fabric_issues', ['id'])
    op.create_index('ix_grey_fabric_issues_issue_number', 'grey_fabric_issues', ['issue_number'], unique=True)
    op.create_index('ix_grey_fabric_issues_issue_date', 'grey_fabric_issues', ['issue_date'])

    # 14. finished_fabric_receipts
    op.create_table('finished_fabric_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('receipt_number', sa.String(50), nullable=False),
        sa.Column('receipt_date', sa.Date(), nullable=False),
        sa.Column('processing_order_id', sa.Integer(), nullable=False),
        sa.Column('fabric_id', sa.Integer(), nullable=False),
        sa.Column('qty_received', sa.Numeric(12, 2), nullable=False),
        sa.Column('qty_rejected', sa.Numeric(12, 2), nullable=True, server_default='0'),
        sa.Column('lot_number', sa.String(50), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('shade_code', sa.String(50), nullable=True),
        sa.Column('gsm_actual', sa.Integer(), nullable=True),
        sa.Column('shrinkage_percent', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['processing_order_id'], ['processing_orders.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_finished_fabric_receipts_id', 'finished_fabric_receipts', ['id'])
    op.create_index('ix_finished_fabric_receipts_receipt_number', 'finished_fabric_receipts', ['receipt_number'], unique=True)
    op.create_index('ix_finished_fabric_receipts_receipt_date', 'finished_fabric_receipts', ['receipt_date'])

    # 15. cutting_orders
    op.create_table('cutting_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cutting_order_number', sa.String(50), nullable=False),
        sa.Column('order_date', sa.Date(), nullable=False),
        sa.Column('garment_id', sa.Integer(), nullable=False),
        sa.Column('production_plan_id', sa.Integer(), nullable=True),
        sa.Column('fabric_id', sa.Integer(), nullable=False),
        sa.Column('fabric_qty_issued', sa.Numeric(12, 2), nullable=False),
        sa.Column('planned_pieces', sa.Integer(), nullable=False),
        sa.Column('size_breakdown', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(30), nullable=True, server_default='OPEN'),
        sa.Column('marker_efficiency', sa.Numeric(5, 2), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['garment_id'], ['garments.id']),
        sa.ForeignKeyConstraint(['production_plan_id'], ['production_plans.id']),
        sa.ForeignKeyConstraint(['fabric_id'], ['fabrics.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_cutting_orders_id', 'cutting_orders', ['id'])
    op.create_index('ix_cutting_orders_cutting_order_number', 'cutting_orders', ['cutting_order_number'], unique=True)
    op.create_index('ix_cutting_orders_order_date', 'cutting_orders', ['order_date'])

    # 16. cutting_checks
    op.create_table('cutting_checks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cutting_order_id', sa.Integer(), nullable=False),
        sa.Column('check_date', sa.Date(), nullable=False),
        sa.Column('pieces_cut', sa.Integer(), nullable=False),
        sa.Column('pieces_ok', sa.Integer(), nullable=False),
        sa.Column('pieces_rejected', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('fabric_used_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('fabric_wastage_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('size_breakdown_actual', postgresql.JSONB(), nullable=True),
        sa.Column('checked_by', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cutting_order_id'], ['cutting_orders.id']),
    )
    op.create_index('ix_cutting_checks_id', 'cutting_checks', ['id'])

    # 17. stitching_orders
    op.create_table('stitching_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stitching_order_number', sa.String(50), nullable=False),
        sa.Column('order_date', sa.Date(), nullable=False),
        sa.Column('cutting_order_id', sa.Integer(), nullable=False),
        sa.Column('stitcher_supplier_id', sa.Integer(), nullable=True),
        sa.Column('pieces_issued', sa.Integer(), nullable=False),
        sa.Column('size_breakdown', postgresql.JSONB(), nullable=True),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(30), nullable=True, server_default='OPEN'),
        sa.Column('stitching_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cutting_order_id'], ['cutting_orders.id']),
        sa.ForeignKeyConstraint(['stitcher_supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('ix_stitching_orders_id', 'stitching_orders', ['id'])
    op.create_index('ix_stitching_orders_stitching_order_number', 'stitching_orders', ['stitching_order_number'], unique=True)
    op.create_index('ix_stitching_orders_order_date', 'stitching_orders', ['order_date'])

    # 18. garment_finishing
    op.create_table('garment_finishing',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stitching_order_id', sa.Integer(), nullable=False),
        sa.Column('garment_id', sa.Integer(), nullable=False),
        sa.Column('stage', sa.String(40), nullable=False),
        sa.Column('stage_date', sa.Date(), nullable=False),
        sa.Column('pieces_in', sa.Integer(), nullable=False),
        sa.Column('pieces_ok', sa.Integer(), nullable=False),
        sa.Column('pieces_rejected', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('size_breakdown', postgresql.JSONB(), nullable=True),
        sa.Column('operator', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['stitching_order_id'], ['stitching_orders.id']),
        sa.ForeignKeyConstraint(['garment_id'], ['garments.id']),
    )
    op.create_index('ix_garment_finishing_id', 'garment_finishing', ['id'])
    op.create_index('ix_garment_finishing_stage_date', 'garment_finishing', ['stage_date'])

    # 19. barcode_labels
    op.create_table('barcode_labels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('garment_finishing_id', sa.Integer(), nullable=False),
        sa.Column('garment_id', sa.Integer(), nullable=False),
        sa.Column('size', sa.String(20), nullable=False),
        sa.Column('barcode', sa.String(100), nullable=False),
        sa.Column('mrp', sa.Numeric(10, 2), nullable=False),
        sa.Column('batch_number', sa.String(50), nullable=True),
        sa.Column('printed_at', sa.DateTime(), nullable=True),
        sa.Column('is_printed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['garment_finishing_id'], ['garment_finishing.id']),
        sa.ForeignKeyConstraint(['garment_id'], ['garments.id']),
    )
    op.create_index('ix_barcode_labels_id', 'barcode_labels', ['id'])
    op.create_index('ix_barcode_labels_barcode', 'barcode_labels', ['barcode'], unique=True)


def downgrade() -> None:
    # Drop in reverse order
    op.drop_table('barcode_labels')
    op.drop_table('garment_finishing')
    op.drop_table('stitching_orders')
    op.drop_table('cutting_checks')
    op.drop_table('cutting_orders')
    op.drop_table('finished_fabric_receipts')
    op.drop_table('grey_fabric_issues')
    op.drop_table('processing_orders')
    op.drop_table('grey_fabric_receipts')
    op.drop_table('yarn_issue_items')
    op.drop_table('yarn_issues_to_knitter')
    op.drop_table('knit_orders')
    op.drop_table('inventory_transactions')
    op.drop_table('mrn_items')
    op.drop_table('mrns')
    op.drop_table('gate_entries')
    op.drop_table('po_items')
    op.drop_table('purchase_orders')
    op.drop_table('suppliers')
