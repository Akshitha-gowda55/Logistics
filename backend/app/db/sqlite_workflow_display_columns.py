"""SQLite-only: add business-facing labels (item_name, product_name, route_name) and backfill."""

from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.entities import WorkflowModel


def ensure_workflow_display_columns(engine: Engine) -> None:
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(workflows)")).fetchall()
        col_names = {r[1] for r in rows}
        alters: list[str] = []
        if "item_name" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN item_name VARCHAR(255) NOT NULL DEFAULT ''")
        if "product_name" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN product_name VARCHAR(255)")
        if "route_name" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN route_name VARCHAR(255)")
        for stmt in alters:
            conn.execute(text(stmt))


def backfill_workflow_item_names(SessionFactory: sessionmaker[Session]) -> None:
    """Ensure every row has a human-readable item_name; align notification foreign strings."""
    with SessionFactory() as db:
        db.execute(text("UPDATE workflows SET item_name = trim(title) WHERE trim(coalesce(item_name, '')) = ''"))
        db.commit()

    with SessionFactory() as db:
        seen: dict[str, list[WorkflowModel]] = {}
        for wf in db.scalars(select(WorkflowModel)):
            key = (wf.item_name or "").strip().lower()
            seen.setdefault(key, []).append(wf)
        for _k, group in seen.items():
            if len(group) <= 1:
                continue
            for wf in group:
                wf.item_name = f"{(wf.title or 'Shipment').strip()} ({wf.workflow_id})"
        db.commit()

    with SessionFactory() as db:
        db.execute(
            text(
                """
                UPDATE notifications
                SET related_workflow_id = (
                    SELECT w.item_name FROM workflows w
                    WHERE w.workflow_id = notifications.related_workflow_id
                )
                WHERE EXISTS (
                    SELECT 1 FROM workflows w2 WHERE w2.workflow_id = notifications.related_workflow_id
                )
                """
            )
        )
        db.commit()
