"""SQLite / Postgres: workflows.user_entered — user-created shipments only (demo purge)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_workflow_user_entered_column(engine: Engine) -> None:
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            rows = conn.execute(text("PRAGMA table_info(workflows)")).fetchall()
            col_names = {r[1] for r in rows}
            if "user_entered" not in col_names:
                conn.execute(text("ALTER TABLE workflows ADD COLUMN user_entered BOOLEAN NOT NULL DEFAULT 0"))
        return

    # PostgreSQL (and compatible): idempotent ALTER for existing deployments using create_all-less migrations.
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE workflows ADD COLUMN IF NOT EXISTS user_entered BOOLEAN NOT NULL DEFAULT false"))
