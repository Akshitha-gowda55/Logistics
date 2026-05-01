"""Normalize legacy SmartFlow stages onto the 3-lane simple pipeline (supplier → operations → inventory).

Idempotent string updates for SQLite; safe to run each startup.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def migrate_workflows_to_simple_pipeline(engine: Engine) -> None:
    with engine.begin() as conn:
        # Map legacy stages onto supplier / operations / inventory lanes.
        conn.execute(
            text(
                """
                UPDATE workflows SET current_stage = 'supplier_risk', current_role = 'supplier_risk'
                WHERE current_stage IN ('planning', 'executive_planning', 'supplier_risk_check')
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE workflows SET current_stage = 'operations', current_role = 'operations'
                WHERE current_stage IN ('operations_dispatch', 'delivery_completion')
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE workflows SET current_stage = 'inventory', current_role = 'inventory'
                WHERE current_stage IN ('inventory_allocation', 'executive_review')
                """
            )
        )
