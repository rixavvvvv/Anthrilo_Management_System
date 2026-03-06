"""Add ads_data and ads_extra_metrics tables for universal ads module

Revision ID: 004_ads_module
"""
from alembic import op
import sqlalchemy as sa

revision = "004_ads_module"
down_revision = "003_auth_rbac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ads_data",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False, index=True),
        sa.Column("channel", sa.String(50), nullable=False, index=True),
        sa.Column("brand", sa.String(100), nullable=False, index=True),
        sa.Column("campaign_name", sa.String(255), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cpc", sa.Numeric(10, 2), nullable=True),
        sa.Column("spend", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("spend_with_tax", sa.Numeric(12, 2), nullable=True),
        sa.Column("ads_sale", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_sale", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("units_sold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("acos", sa.Numeric(8, 2), nullable=True),
        sa.Column("tacos", sa.Numeric(8, 2), nullable=True),
        sa.Column("roas", sa.Numeric(8, 2), nullable=True),
        sa.Column("roi", sa.Numeric(8, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "ads_extra_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "ads_data_id",
            sa.Integer(),
            sa.ForeignKey("ads_data.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("metric_name", sa.String(100), nullable=False),
        sa.Column("metric_value", sa.Numeric(14, 4), nullable=False),
    )


def downgrade():
    op.drop_table("ads_extra_metrics")
    op.drop_table("ads_data")
