"""Immutable receipts, normalized document registry and stock actors.

Existing duplicate documents are retained and share one reserved identity.
Backfilled snapshots are explicitly labelled as observations during migration.
"""

from alembic import op
import sqlalchemy as sa

revision = "008_financial_audit"
down_revision = "007_request_integrity"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if "expense_documents" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "expense_documents",
            sa.Column("normalized", sa.String(100), primary_key=True),
            sa.Column(
                "expenseId",
                sa.Integer(),
                sa.ForeignKey("expenses.id", ondelete="RESTRICT"),
                nullable=False,
                unique=True,
            ),
        )
    bind.execute(
        sa.text("""INSERT INTO expense_documents(normalized, "expenseId")
        SELECT lower(btrim("documentNumber")), min(id) FROM expenses
        WHERE length(btrim("documentNumber")) > 0 GROUP BY lower(btrim("documentNumber"))
        ON CONFLICT DO NOTHING""")
    )
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION reserve_expense_document() RETURNS trigger AS $$
        BEGIN
            IF length(btrim(NEW."documentNumber")) = 0 THEN
                RAISE EXCEPTION 'Blank document number' USING ERRCODE = '23514';
            END IF;
            INSERT INTO expense_documents(normalized, "expenseId")
                VALUES (lower(btrim(NEW."documentNumber")), NEW.id);
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    bind.exec_driver_sql("DROP TRIGGER IF EXISTS expense_document_guard ON expenses")
    bind.exec_driver_sql("""CREATE TRIGGER expense_document_guard AFTER INSERT ON expenses
        FOR EACH ROW EXECUTE FUNCTION reserve_expense_document()""")
    if "snapshot" not in {
        c["name"] for c in sa.inspect(bind).get_columns("payment_receipts")
    }:
        op.add_column(
            "payment_receipts",
            sa.Column(
                "snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")
            ),
        )
    for column in (
        sa.Column(
            "actorId", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT")
        ),
        sa.Column("requestId", sa.String(128)),
        sa.Column("detail", sa.String(2000)),
    ):
        if column.name not in {
            c["name"] for c in sa.inspect(bind).get_columns("inventory_movements")
        }:
            op.add_column("inventory_movements", column)
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION receipt_snapshot(ticket_id integer, legacy boolean) RETURNS json AS $$
        SELECT json_build_object('version', 1, 'legacy', legacy,
            'vehicle', json_build_object('customerId', v."customerId", 'customerName', v."customerName",
                'licensePlate', v."licensePlate", 'phone', v.phone, 'carBrand', v."carBrand", 'carModel', v."carModel"),
            'items', coalesce((SELECT json_agg(json_build_object('taskName', i."taskName", 'partName', i."partName",
                'partCode', i."partCode", 'quantity', i.quantity, 'partPrice', i."partPrice", 'laborPrice', i."laborPrice",
                'totalPrice', i."totalPrice") ORDER BY i.id) FROM repair_items i WHERE i."repairTicketId"=r.id), '[]'::json),
            'totalAmount', r."totalAmount")
        FROM repair_tickets r JOIN vehicles v ON v.id=r."vehicleId" WHERE r.id=ticket_id
        $$ LANGUAGE sql STABLE""")
    # Do this before installing immutability triggers; a rerun leaves snapshots alone.
    bind.execute(
        sa.text("""UPDATE payment_receipts SET snapshot=receipt_snapshot("ticketId", true)
        WHERE snapshot::jsonb = '{}'::jsonb""")
    )
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION set_receipt_snapshot() RETURNS trigger AS $$
        BEGIN
            NEW.snapshot := receipt_snapshot(NEW."ticketId", false);
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    bind.exec_driver_sql(
        "DROP TRIGGER IF EXISTS receipt_snapshot_guard ON payment_receipts"
    )
    bind.exec_driver_sql("""CREATE TRIGGER receipt_snapshot_guard BEFORE INSERT ON payment_receipts
        FOR EACH ROW EXECUTE FUNCTION set_receipt_snapshot()""")
    bind.exec_driver_sql("""CREATE OR REPLACE FUNCTION immutable_audit_row() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE = '23514'; END
        $$ LANGUAGE plpgsql""")
    for table in (
        "payment_receipts",
        "inventory_movements",
        "repair_evidence",
        "expense_documents",
    ):
        bind.exec_driver_sql(f"DROP TRIGGER IF EXISTS immutable_history ON {table}")
        bind.exec_driver_sql(f"""CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION immutable_audit_row()""")
    # A document identity must never be rewritten after its approval/history exists.
    bind.exec_driver_sql("DROP TRIGGER IF EXISTS immutable_document ON expenses")
    bind.exec_driver_sql("""CREATE TRIGGER immutable_document BEFORE UPDATE OF "documentNumber" OR DELETE ON expenses
        FOR EACH ROW EXECUTE FUNCTION immutable_audit_row()""")


def downgrade():
    raise RuntimeError(
        "Restore a verified backup; financial and stock history must be retained."
    )
