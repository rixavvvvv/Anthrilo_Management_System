"""Add product_master table

Revision ID: 003
Revises: 002
Create Date: 2026-03-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '003_add_product_master'
down_revision = '002_add_sync_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'product_master',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('sku', sa.String(100), nullable=False, unique=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('size', sa.String(50), nullable=True),
        sa.Column('collection', sa.String(100), nullable=True),
        sa.Column('type', sa.String(100), nullable=True),
        sa.Column('season', sa.String(50), nullable=True),
        sa.Column('fabric_type', sa.String(100), nullable=True),
        sa.Column('print', sa.String(100), nullable=True),
        sa.Column('net_weight', sa.Numeric(10, 3), nullable=True),
        sa.Column('production_time', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_index('ix_product_master_id', 'product_master', ['id'])
    op.create_index('ix_product_master_sku', 'product_master', ['sku'], unique=True)
    op.create_index('ix_product_master_collection', 'product_master', ['collection'])
    op.create_index('ix_product_master_season', 'product_master', ['season'])
    op.create_index('ix_product_master_type', 'product_master', ['type'])


def downgrade() -> None:
    op.drop_index('ix_product_master_type')
    op.drop_index('ix_product_master_season')
    op.drop_index('ix_product_master_collection')
    op.drop_index('ix_product_master_sku')
    op.drop_index('ix_product_master_id')
    op.drop_table('product_master')
