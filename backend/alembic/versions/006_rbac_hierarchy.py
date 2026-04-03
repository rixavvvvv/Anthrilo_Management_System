"""Add production RBAC hierarchy tables and seed system roles

Revision ID: 006_rbac_hierarchy
Revises: 004_ads_module, 004_manufacturing, 005_add_fabric_yarn_master
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "006_rbac_hierarchy"
down_revision = ("004_ads_module", "004_manufacturing", "005_add_fabric_yarn_master")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_developer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_roles_id", "roles", ["id"], unique=False)
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)
    op.create_index("ix_roles_is_developer", "roles", ["is_developer"], unique=False)

    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("module", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("module", "action", name="uq_permissions_module_action"),
    )
    op.create_index("ix_permissions_id", "permissions", ["id"], unique=False)
    op.create_index("ix_permissions_module", "permissions", ["module"], unique=False)
    op.create_index("ix_permissions_action", "permissions", ["action"], unique=False)

    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_permission"),
    )
    op.create_index("ix_role_permissions_id", "role_permissions", ["id"], unique=False)
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"], unique=False)
    op.create_index("ix_role_permissions_permission_id", "role_permissions", ["permission_id"], unique=False)

    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),
    )
    op.create_index("ix_user_roles_id", "user_roles", ["id"], unique=False)
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"], unique=False)
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"], unique=False)

    op.create_table(
        "user_permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "permission_id", name="uq_user_permissions_user_permission"),
    )
    op.create_index("ix_user_permissions_id", "user_permissions", ["id"], unique=False)
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"], unique=False)
    op.create_index("ix_user_permissions_permission_id", "user_permissions", ["permission_id"], unique=False)

    conn = op.get_bind()

    # Seed system roles.
    conn.execute(sa.text(
        """
        INSERT INTO roles (name, priority, is_system, is_developer, description)
        VALUES
            ('developer', 100, true, true, 'Super admin role with full system control'),
            ('admin', 50, true, false, 'Administrative role for user operations'),
            ('user', 10, true, false, 'Default least-privileged role')
        ON CONFLICT (name) DO NOTHING
        """
    ))

    modules = [
        "dashboard",
        "reports",
        "garments",
        "sales",
        "financial",
        "procurement",
        "manufacturing",
        "user_management",
        "system_settings",
        "security",
        "hidden_modules",
    ]
    actions = ["view", "create", "update", "delete"]

    for module in modules:
        for action in actions:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO permissions (module, action, description)
                    VALUES (:module, :action, :description)
                    ON CONFLICT (module, action) DO NOTHING
                    """
                ),
                {
                    "module": module,
                    "action": action,
                    "description": f"{action.title()} access for {module.replace('_', ' ').title()}",
                },
            )

    role_rows = conn.execute(sa.text("SELECT id, lower(name) AS name FROM roles")).mappings().all()
    role_ids = {row["name"]: row["id"] for row in role_rows}

    perm_rows = conn.execute(sa.text("SELECT id, module, action FROM permissions")).mappings().all()
    perm_ids = {f"{row['module']}:{row['action']}": row["id"] for row in perm_rows}

    developer_codes = {f"{m}:{a}" for m in modules for a in actions}
    admin_codes = {f"{m}:{a}" for m in [
        "dashboard",
        "reports",
        "garments",
        "sales",
        "financial",
        "procurement",
        "manufacturing",
        "user_management",
    ] for a in actions}
    user_codes = set()

    default_role_permissions = {
        "developer": developer_codes,
        "admin": admin_codes,
        "user": user_codes,
    }

    for role_name, codes in default_role_permissions.items():
        role_id = role_ids.get(role_name)
        if role_id is None:
            continue
        for code in codes:
            perm_id = perm_ids.get(code)
            if perm_id is None:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                    """
                ),
                {"role_id": role_id, "permission_id": perm_id},
            )

    # Normalize legacy user roles.
    conn.execute(sa.text("UPDATE users SET role = lower(role) WHERE role IS NOT NULL"))
    conn.execute(sa.text("UPDATE users SET role = 'user' WHERE role IS NULL OR trim(role) = '' OR role IN ('staff', 'manager')"))

    users = conn.execute(sa.text("SELECT id, role FROM users ORDER BY id ASC")).mappings().all()

    if users:
        developer_ids = [row["id"] for row in users if row["role"] == "developer"]

        # Keep one developer only.
        if len(developer_ids) > 1:
            for extra_id in developer_ids[1:]:
                conn.execute(sa.text("UPDATE users SET role = 'admin' WHERE id = :id"), {"id": extra_id})
            developer_ids = developer_ids[:1]

        if not developer_ids:
            user_ids = [row["id"] for row in users]
            admin_ids = [row["id"] for row in users if row["role"] == "admin"]

            if 1 in user_ids:
                chosen_developer = 1
            elif admin_ids:
                chosen_developer = admin_ids[0]
            else:
                chosen_developer = user_ids[0]

            conn.execute(sa.text("UPDATE users SET role = 'developer' WHERE id = :id"), {"id": chosen_developer})

    # Strict mode: keep only the 3 system roles.
    conn.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE role_id IN (
                SELECT id FROM roles WHERE lower(name) NOT IN ('developer', 'admin', 'user')
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DELETE FROM user_roles
            WHERE role_id IN (
                SELECT id FROM roles WHERE lower(name) NOT IN ('developer', 'admin', 'user')
            )
            """
        )
    )
    conn.execute(sa.text("DELETE FROM roles WHERE lower(name) NOT IN ('developer', 'admin', 'user')"))

    conn.execute(
        sa.text(
            """
            UPDATE users
            SET is_superuser = CASE WHEN role IN ('developer', 'admin') THEN true ELSE false END
            """
        )
    )

    # Build user_roles from users.role for a single-role system.
    conn.execute(sa.text("DELETE FROM user_roles"))

    role_rows = conn.execute(sa.text("SELECT id, lower(name) AS name FROM roles")).mappings().all()
    role_ids = {row["name"]: row["id"] for row in role_rows}

    user_rows = conn.execute(sa.text("SELECT id, role FROM users")).mappings().all()
    for row in user_rows:
        role_id = role_ids.get(row["role"])
        if role_id is None:
            continue
        conn.execute(
            sa.text(
                """
                INSERT INTO user_roles (user_id, role_id, is_primary)
                VALUES (:user_id, :role_id, true)
                ON CONFLICT (user_id, role_id) DO NOTHING
                """
            ),
            {"user_id": row["id"], "role_id": role_id},
        )

    # Enforce single developer at database level.
    op.create_index(
        "uq_users_single_developer",
        "users",
        ["role"],
        unique=True,
        postgresql_where=sa.text("lower(role) = 'developer'"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_single_developer", table_name="users")

    op.drop_index("ix_user_permissions_permission_id", table_name="user_permissions")
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_index("ix_user_permissions_id", table_name="user_permissions")
    op.drop_table("user_permissions")

    op.drop_index("ix_user_roles_role_id", table_name="user_roles")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_index("ix_user_roles_id", table_name="user_roles")
    op.drop_table("user_roles")

    op.drop_index("ix_role_permissions_permission_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_id", table_name="role_permissions")
    op.drop_table("role_permissions")

    op.drop_index("ix_permissions_action", table_name="permissions")
    op.drop_index("ix_permissions_module", table_name="permissions")
    op.drop_index("ix_permissions_id", table_name="permissions")
    op.drop_table("permissions")

    op.drop_index("ix_roles_is_developer", table_name="roles")
    op.drop_index("ix_roles_name", table_name="roles")
    op.drop_index("ix_roles_id", table_name="roles")
    op.drop_table("roles")
