"""Operation identities, evidence quota and assignment guards. No history removed."""

from alembic import op
import sqlalchemy as sa

revision = "007_request_integrity"
down_revision = "006_car_brands"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "request_replays" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "request_replays",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "userId",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column("scope", sa.String(200), nullable=False),
            sa.Column("key", sa.String(128), nullable=False),
            sa.Column("requestHash", sa.String(64), nullable=False),
            sa.Column("response", sa.JSON()),
            sa.Column("statusCode", sa.Integer()),
            sa.Column(
                "createdAt", sa.DateTime(), nullable=False, server_default=sa.func.now()
            ),
            sa.UniqueConstraint("userId", "scope", "key", name="uq_request_identity"),
            sa.CheckConstraint(
                '("response" IS NULL) = ("statusCode" IS NULL)',
                name="replay_complete_pair",
            ),
            sa.CheckConstraint(
                '"statusCode" BETWEEN 200 AND 299', name="replay_success_status"
            ),
        )
        op.create_table(
            "request_budgets",
            sa.Column("identifier", sa.String(100), primary_key=True),
            sa.Column("windowStart", sa.DateTime(), primary_key=True),
            sa.Column("count", sa.Integer(), nullable=False),
            sa.CheckConstraint("count > 0", name="request_budget_positive"),
        )
    if "slot" not in {
        c["name"] for c in sa.inspect(bind).get_columns("repair_evidence")
    }:
        op.add_column("repair_evidence", sa.Column("slot", sa.Integer()))
        # Keep all old photos, including any historical rows beyond the old quota.
        bind.execute(
            sa.text("""WITH ranked AS (
            SELECT id, row_number() OVER (PARTITION BY "itemId", round ORDER BY id) AS n
            FROM repair_evidence)
            UPDATE repair_evidence e SET slot = CASE WHEN r.n <= 12 THEN r.n END
            FROM ranked r WHERE r.id = e.id""")
        )
        op.create_unique_constraint(
            "uq_evidence_slot", "repair_evidence", ["itemId", "round", "slot"]
        )
        op.create_check_constraint(
            "evidence_slot_range", "repair_evidence", "slot BETWEEN 1 AND 12"
        )
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION evidence_slot_required() RETURNS trigger AS $$
        BEGIN
            IF NEW.slot IS NULL THEN
                RAISE EXCEPTION 'New evidence needs a quota slot' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    bind.exec_driver_sql(
        "DROP TRIGGER IF EXISTS evidence_slot_guard ON repair_evidence"
    )
    bind.exec_driver_sql("""CREATE TRIGGER evidence_slot_guard BEFORE INSERT ON repair_evidence
        FOR EACH ROW EXECUTE FUNCTION evidence_slot_required()""")
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION check_workshop_assignment() RETURNS trigger AS $$
        DECLARE linked integer; active boolean; role_name text; disabled jsonb; mechanic_status text;
        BEGIN
            IF NEW."mechanicId" IS NULL THEN RETURN NEW; END IF;
            SELECT "userId", status INTO linked, mechanic_status FROM mechanics
                WHERE id = NEW."mechanicId" FOR SHARE;
            IF mechanic_status IS DISTINCT FROM 'active' THEN
                RAISE EXCEPTION 'Mechanic is inactive' USING ERRCODE = '23514';
            END IF;
            IF linked IS NOT NULL THEN
                SELECT "isActive", role, "disabledPermissions"::jsonb INTO active, role_name, disabled
                    FROM users WHERE id = linked FOR SHARE;
                IF active IS DISTINCT FROM true OR role_name IS DISTINCT FROM 'mechanic'
                    OR coalesce(disabled, '[]'::jsonb) ? 'workshop' THEN
                    RAISE EXCEPTION 'Mechanic cannot access workshop' USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    for table in ("repair_tickets", "service_visits"):
        bind.exec_driver_sql(f"DROP TRIGGER IF EXISTS assignment_guard ON {table}")
        bind.exec_driver_sql(f"""CREATE TRIGGER assignment_guard BEFORE INSERT OR UPDATE OF "mechanicId" ON {table}
            FOR EACH ROW EXECUTE FUNCTION check_workshop_assignment()""")
    bind.exec_driver_sql("""CREATE UNIQUE INDEX IF NOT EXISTS uq_open_ticket_vehicle
        ON repair_tickets ("vehicleId") WHERE status <> 'paid' """)
    bind.exec_driver_sql("""CREATE UNIQUE INDEX IF NOT EXISTS uq_open_visit_vehicle
        ON service_visits ("vehicleId") WHERE status <> 'closed' """)
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION immutable_operation_result() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Operation identities must be retained' USING ERRCODE='23514'; END IF;
            IF OLD.response IS NOT NULL OR (NEW."userId", NEW.scope, NEW.key, NEW."requestHash")
                IS DISTINCT FROM (OLD."userId", OLD.scope, OLD.key, OLD."requestHash") THEN
                RAISE EXCEPTION 'Operation identity/result is immutable' USING ERRCODE='23514';
            END IF;
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    bind.exec_driver_sql(
        "DROP TRIGGER IF EXISTS immutable_operation ON request_replays"
    )
    bind.exec_driver_sql("""CREATE TRIGGER immutable_operation BEFORE UPDATE OR DELETE ON request_replays
        FOR EACH ROW EXECUTE FUNCTION immutable_operation_result()""")


def downgrade():
    raise RuntimeError(
        "Restore a verified backup; operation identities and evidence history must not be dropped."
    )
