"""Add fabric_yarn_master table

Revision ID: 005_add_fabric_yarn_master
Revises: 003_add_product_master
Create Date: 2026-03-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_add_fabric_yarn_master'
down_revision = '003_add_product_master'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'fabric_yarn_master',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('yarn', sa.String(120), nullable=False),
        sa.Column('yarn_percentage', sa.Numeric(6, 2), nullable=False),
        sa.Column('yarn_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('fabric_type', sa.String(120), nullable=False),
        sa.Column('print', sa.String(120), nullable=False),
        sa.Column('fabric_ready_time', sa.String(120), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_index('ix_fabric_yarn_master_id', 'fabric_yarn_master', ['id'])
    op.create_index('ix_fabric_yarn_master_yarn', 'fabric_yarn_master', ['yarn'])
    op.create_index('ix_fabric_yarn_master_fabric_type', 'fabric_yarn_master', ['fabric_type'])
    op.create_index('ix_fabric_yarn_master_print', 'fabric_yarn_master', ['print'])


def downgrade() -> None:
    op.drop_index('ix_fabric_yarn_master_print', table_name='fabric_yarn_master')
    op.drop_index('ix_fabric_yarn_master_fabric_type', table_name='fabric_yarn_master')
    op.drop_index('ix_fabric_yarn_master_yarn', table_name='fabric_yarn_master')
    op.drop_index('ix_fabric_yarn_master_id', table_name='fabric_yarn_master')
    op.drop_table('fabric_yarn_master')
