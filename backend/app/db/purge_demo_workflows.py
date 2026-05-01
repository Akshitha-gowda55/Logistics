"""Remove seeded / scenario demo workflows; keep shipments created via raw-material POST only."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from app.models.entities import (
    AuditLogModel,
    NotificationModel,
    ShipmentModel,
    WorkflowModel,
    WorkflowStageUpdateModel,
    WorkflowTaskModel,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _timeline_marks_raw_request(wf: WorkflowModel) -> bool:
    raw = wf.timeline_events
    if isinstance(raw, str):
        if "Raw material request created" in raw:
            return True
        try:
            v = json.loads(raw)
            raw = v
        except json.JSONDecodeError:
            raw = []
    if not isinstance(raw, list):
        return False
    for ev in raw:
        if isinstance(ev, dict) and isinstance(ev.get("action"), str):
            if "raw material request created" in ev["action"].lower():
                return True
    return False


def tag_user_shipment_rows_before_purge(session: "Session") -> None:
    """Mark rows we should NOT delete so legacy seeded lines are safe if they reused similar fields."""
    rows = session.scalars(select(WorkflowModel)).all()
    for wf in rows:
        if wf.user_entered:
            continue
        if (wf.quantity is not None and float(wf.quantity) > 0) or (
            (wf.material_type or "").strip() or (wf.supplier_party_name or "").strip()
        ):
            wf.user_entered = True
        elif _timeline_marks_raw_request(wf):
            wf.user_entered = True
    session.commit()


def purge_demo_workflows(session: "Session") -> int:
    """Hard-delete workflows that are not marked user-created (clears seeded scenario lines)."""
    tag_user_shipment_rows_before_purge(session)
    demos = list(session.scalars(select(WorkflowModel).where(~WorkflowModel.user_entered)))
    deleted = 0
    for wf in demos:
        refs: set[str] = set()
        for cand in ((wf.workflow_id or "").strip(), (wf.item_name or "").strip()):
            if cand:
                refs.add(cand)
                refs.add(cand[:64])
        if refs:
            session.execute(delete(NotificationModel).where(NotificationModel.related_workflow_id.in_(refs)))

        session.execute(delete(WorkflowTaskModel).where(WorkflowTaskModel.workflow_id == wf.id))
        session.execute(delete(WorkflowStageUpdateModel).where(WorkflowStageUpdateModel.workflow_id == wf.id))
        session.execute(delete(ShipmentModel).where(ShipmentModel.workflow_id == wf.id))
        logs = session.scalars(select(AuditLogModel).where(AuditLogModel.workflow_id == wf.id)).all()
        for al in logs:
            al.workflow_id = None
        session.delete(wf)
        deleted += 1
    if deleted:
        session.commit()
    return deleted
