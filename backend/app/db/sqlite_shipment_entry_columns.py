"""SQLite: user-entered shipment / raw material fields + sync_version."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_workflow_shipment_entry_columns(engine: Engine) -> None:
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(workflows)")).fetchall()
        col_names = {r[1] for r in rows}

        alters: list[str] = []
        if "material_type" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN material_type VARCHAR(255) NOT NULL DEFAULT ''")
        if "quantity" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN quantity REAL NULL")
        if "unit" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN unit VARCHAR(64) NOT NULL DEFAULT ''")
        if "supplier_party_name" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN supplier_party_name VARCHAR(255) NOT NULL DEFAULT ''")
        if "supplier_party_location" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN supplier_party_location VARCHAR(255) NOT NULL DEFAULT ''")
        if "sync_version" not in col_names:
            alters.append("ALTER TABLE workflows ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0")

        for stmt in alters:
            conn.execute(text(stmt))
