"""SQLite-only: add Control Tower columns to `workflows` (idempotent ALTER)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_workflow_control_tower_columns(engine: Engine) -> None:
    """Add supplier/route/inventory status + unified timeline JSON without breaking existing rows."""
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(workflows)")).fetchall()
        col_names = {r[1] for r in rows}

        alters: list[str] = []
        if "supplier_status" not in col_names:
            alters.append(
                "ALTER TABLE workflows ADD COLUMN supplier_status VARCHAR(64) NOT NULL DEFAULT 'scheduled'"
            )
        if "route_status" not in col_names:
            alters.append(
                "ALTER TABLE workflows ADD COLUMN route_status VARCHAR(64) NOT NULL DEFAULT 'not_dispatched'"
            )
        if "inventory_status" not in col_names:
            alters.append(
                "ALTER TABLE workflows ADD COLUMN inventory_status VARCHAR(64) NOT NULL DEFAULT 'ok'"
            )
        if "timeline_events" not in col_names:
            alters.append(
                "ALTER TABLE workflows ADD COLUMN timeline_events TEXT NOT NULL DEFAULT '[]'"
            )
        if "executive_completed" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN executive_completed BOOLEAN NOT NULL DEFAULT 0")
        if "supplier_completed" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN supplier_completed BOOLEAN NOT NULL DEFAULT 0")
        if "operations_completed" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN operations_completed BOOLEAN NOT NULL DEFAULT 0")
        if "inventory_completed" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN inventory_completed BOOLEAN NOT NULL DEFAULT 0")

        for stmt in alters:
            conn.execute(text(stmt))

        # Backfill lane flags from workflow_tasks (per-workflow, idempotent).
        conn.execute(
            text(
                """
                UPDATE workflows SET executive_completed = 1
                WHERE id IN (
                    SELECT workflow_id FROM workflow_tasks
                    WHERE task_key = 'exec_approved' AND is_completed = 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE workflows SET supplier_completed = 1
                WHERE id IN (
                    SELECT workflow_id FROM workflow_tasks
                    WHERE task_key = 'parts_shipped' AND is_completed = 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE workflows SET operations_completed = 1
                WHERE id IN (
                    SELECT workflow_id FROM workflow_tasks
                    WHERE task_key = 'dispatched' AND is_completed = 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE workflows SET inventory_completed = 1
                WHERE id IN (
                    SELECT workflow_id FROM workflow_tasks
                    WHERE task_key = 'stock_received' AND is_completed = 1
                )
                """
            )
        )
