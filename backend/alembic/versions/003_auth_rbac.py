"""Add login_history, activity_logs tables and last_login to users

Revision ID: 003
"""
from alembic import op
import sqlalchemy as sa

revision = "003_auth_rbac"
down_revision = "002_add_sync_tables"
branch_labels = None
depends_on = None


def upgrade():
    # Add last_login column to users
    op.add_column("users", sa.Column("last_login", sa.DateTime(), nullable=True))

    # Login history table
    op.create_table(
        "login_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Activity logs table
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("activity_logs")
    op.drop_table("login_history")
    op.drop_column("users", "last_login")
