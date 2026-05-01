from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

UTC = timezone.utc
import json

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import (
    AuditLogModel,
    NotificationModel,
    RouteModel,
    ShipmentModel,
    UserModel,
    WorkflowModel,
    WorkflowStageUpdateModel,
    WorkflowTaskModel,
)
from app.schemas.workflow_system import (
    AlertType,
    AuditLog,
    InventoryDomainPatch,
    MarkCompleteRequest,
    Notification,
    RouteDomainPatch,
    SupplierDomainPatch,
    User,
    UserRole,
    WorkflowStage,
    WorkflowStageUpdate,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowUpdateRequest,
    CreateWorkflowRequest,
)
from app.services import sms_service

# Simple tower: Supplier → Operations → Warehouse (inventory) → done. Executive creates work items only; no planning stage.
CONTROL_TOWER_PIPELINE: list[WorkflowStage] = [
    WorkflowStage.supplier_risk,
    WorkflowStage.operations,
    WorkflowStage.inventory,
    WorkflowStage.closed,
]

STAGE_NEXT: dict[WorkflowStage, WorkflowStage] = {
    WorkflowStage.supplier_risk: WorkflowStage.operations,
    WorkflowStage.operations: WorkflowStage.inventory,
    WorkflowStage.inventory: WorkflowStage.closed,
    WorkflowStage.closed: WorkflowStage.closed,
}

STAGE_TO_ROLE: dict[WorkflowStage, UserRole] = {
    WorkflowStage.supplier_risk: UserRole.supplier_risk,
    WorkflowStage.operations: UserRole.operations,
    WorkflowStage.inventory: UserRole.inventory,
    WorkflowStage.closed: UserRole.executive,
    # Legacy enums (migration maps rows; still used for orphaned tasks reads)
    WorkflowStage.planning: UserRole.supplier_risk,
    WorkflowStage.executive_planning: UserRole.executive,
    WorkflowStage.operations_dispatch: UserRole.operations,
    WorkflowStage.supplier_risk_check: UserRole.supplier_risk,
    WorkflowStage.inventory_allocation: UserRole.inventory,
    WorkflowStage.delivery_completion: UserRole.operations,
    WorkflowStage.executive_review: UserRole.executive,
}

ROLE_CHECKLIST_KEYS: dict[UserRole, frozenset[str]] = {
    UserRole.supplier_risk: frozenset(
        {
            "order_accepted",
            "material_packed",
            "ready_for_pickup",
            "supplier_delay_reported",
            "handed_to_operations",
        }
    ),
    UserRole.operations: frozenset(
        {
            "vehicle_assigned",
            "route_selected",
            "shipment_picked_up",
            "in_transit",
            "delivery_delayed",
            "reached_warehouse",
        }
    ),
    UserRole.inventory: frozenset(
        {
            "shipment_received",
            "quantity_verified",
            "quality_checked",
            "stock_updated",
            "issue_reported",
            "workflow_completed",
        }
    ),
}


def _role_for_checklist_task_key(task_key: str) -> UserRole | None:
    for role, keys in ROLE_CHECKLIST_KEYS.items():
        if task_key in keys:
            return role
    return None


def checklist_row_owner(task: WorkflowTaskModel) -> UserRole | None:
    """Owning team for a checklist row — trust task_key if legacy task.stage disagrees."""
    by_key = _role_for_checklist_task_key(task.task_key)
    by_stage = STAGE_TO_ROLE.get(task.stage)
    if by_key is not None:
        if by_stage is not None and by_stage != by_key:
            return by_key
        return by_key
    return by_stage


STAGE_TASK_DEFINITIONS: dict[WorkflowStage, list[tuple[str, str]]] = {
    WorkflowStage.supplier_risk: [
        ("order_accepted", "Order accepted"),
        ("material_packed", "Raw material packed"),
        ("ready_for_pickup", "Ready for pickup"),
        ("supplier_delay_reported", "Supplier delay reported"),
        ("handed_to_operations", "Handed over to operations"),
    ],
    WorkflowStage.operations: [
        ("vehicle_assigned", "Vehicle assigned"),
        ("route_selected", "Route selected"),
        ("shipment_picked_up", "Shipment picked up"),
        ("in_transit", "In transit"),
        ("delivery_delayed", "Delivery delayed"),
        ("reached_warehouse", "Reached warehouse/plant"),
    ],
    WorkflowStage.inventory: [
        ("shipment_received", "Shipment received"),
        ("quantity_verified", "Quantity verified"),
        ("quality_checked", "Quality checked"),
        ("stock_updated", "Stock updated"),
        ("issue_reported", "Issue reported"),
        ("workflow_completed", "Workflow completed"),
    ],
}

STAGE_PRIMARY_TASK_KEY: dict[WorkflowStage, str] = {
    WorkflowStage.supplier_risk: "order_accepted",
    WorkflowStage.operations: "vehicle_assigned",
    WorkflowStage.inventory: "shipment_received",
}

TASK_KEY_TO_WORKFLOW_BOOLEAN: dict[str, str] = {
    "handed_to_operations": "supplier_completed",
    "reached_warehouse": "operations_completed",
    "workflow_completed": "inventory_completed",
}

# Checkbox that hands the shipment to the next team (advance current_stage when checked true → true).
TASK_KEY_ADVANCES_FROM_STAGE: dict[str, WorkflowStage] = {
    "handed_to_operations": WorkflowStage.supplier_risk,
    "reached_warehouse": WorkflowStage.operations,
    "workflow_completed": WorkflowStage.inventory,
}

HANDOFF_MESSAGES: dict[tuple[WorkflowStage, WorkflowStage], str] = {
    (WorkflowStage.supplier_risk, WorkflowStage.operations): "Supplier finished their step. Operations: pick up and move the load.",
    (WorkflowStage.operations, WorkflowStage.inventory): "Shipment reached the warehouse. Inventory: receive and update stock.",
    (WorkflowStage.inventory, WorkflowStage.closed): "Warehouse finished. This shipment / work item is complete.",
}


_LEGACY_TO_CONTROL_TOWER_LANE: dict[WorkflowStage, WorkflowStage] = {
    WorkflowStage.planning: WorkflowStage.supplier_risk,
    WorkflowStage.executive_planning: WorkflowStage.supplier_risk,
    WorkflowStage.supplier_risk_check: WorkflowStage.supplier_risk,
    WorkflowStage.operations_dispatch: WorkflowStage.operations,
    WorkflowStage.delivery_completion: WorkflowStage.operations,
    WorkflowStage.inventory_allocation: WorkflowStage.inventory,
    WorkflowStage.executive_review: WorkflowStage.inventory,
}


def canonical_control_tower_lane(stage: WorkflowStage) -> WorkflowStage:
    if stage in CONTROL_TOWER_PIPELINE:
        return stage
    return _LEGACY_TO_CONTROL_TOWER_LANE.get(stage, WorkflowStage.supplier_risk)


def control_tower_lane_index(stage: WorkflowStage) -> int:
    lane = canonical_control_tower_lane(stage)
    try:
        return CONTROL_TOWER_PIPELINE.index(lane)
    except ValueError:
        return 999


def _workflow_pipeline_for(wf: WorkflowModel) -> list[WorkflowStage]:
    del wf
    return CONTROL_TOWER_PIPELINE


ALLOWED_STATUS_TRANSITIONS: dict[WorkflowStatus, set[WorkflowStatus]] = {
    WorkflowStatus.pending: {WorkflowStatus.assigned, WorkflowStatus.in_progress, WorkflowStatus.delayed, WorkflowStatus.escalated},
    WorkflowStatus.assigned: {WorkflowStatus.in_progress, WorkflowStatus.delayed, WorkflowStatus.escalated},
    WorkflowStatus.in_progress: {WorkflowStatus.waiting_next, WorkflowStatus.delayed, WorkflowStatus.escalated, WorkflowStatus.completed},
    WorkflowStatus.waiting_next: {WorkflowStatus.assigned, WorkflowStatus.in_progress, WorkflowStatus.delayed},
    WorkflowStatus.delayed: {WorkflowStatus.in_progress, WorkflowStatus.escalated},
    WorkflowStatus.escalated: {WorkflowStatus.in_progress, WorkflowStatus.assigned},
    WorkflowStatus.completed: {WorkflowStatus.closed},
    WorkflowStatus.closed: set(),
}


class WorkflowEngine:
    def __init__(self) -> None:
        self.revoked_token_jti: set[str] = set()

    def list_users(self, db: Session) -> list[UserModel]:
        return list(db.scalars(select(UserModel)))

    def find_user_by_email(self, db: Session, email: str) -> UserModel | None:
        e = (email or "").strip().lower()
        if not e:
            return None
        return db.scalar(
            select(UserModel).where(func.lower(UserModel.email) == e, UserModel.is_active.is_(True))
        )

    def user_by_id(self, db: Session, user_id: int) -> UserModel:
        user = db.scalar(select(UserModel).where(UserModel.id == user_id, UserModel.is_active.is_(True)))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def workflows_for_role(self, db: Session, role: UserRole) -> list[WorkflowModel]:
        """All open shipments for every dashboard so teams see shared progress (edits gated by ``current_role``)."""
        _ = role
        return list(
            db.scalars(
                select(WorkflowModel)
                .where(
                    WorkflowModel.user_entered.is_(True),
                    WorkflowModel.status != WorkflowStatus.closed,
                    WorkflowModel.current_stage != WorkflowStage.closed,
                )
                .order_by(WorkflowModel.updated_at.desc())
            )
        )

    def pending_for_user(self, db: Session, user: User) -> list[WorkflowModel]:
        return list(
            db.scalars(
                select(WorkflowModel).where(
                    WorkflowModel.user_entered.is_(True),
                    WorkflowModel.current_role == user.role,
                    WorkflowModel.status != WorkflowStatus.closed,
                    (WorkflowModel.assigned_user_id == user.id) | (WorkflowModel.assigned_user_id.is_(None)),
                )
            )
        )

    def get_workflow(self, db: Session, workflow_ref: str) -> WorkflowModel:
        """Resolve by business-facing item_name first, then legacy internal workflow_id (backward compatible)."""
        raw = (workflow_ref or "").strip()
        if not raw:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

        def variants(s: str) -> list[str]:
            out: list[str] = []
            for v in (s, " ".join(s.split())):
                if v and v not in out:
                    out.append(v)
            return out

        wf: WorkflowModel | None = None
        for ref in variants(raw):
            wf = db.scalar(select(WorkflowModel).where(WorkflowModel.item_name == ref))
            if wf is not None:
                break
        if wf is None:
            for ref in variants(raw):
                wf = db.scalar(select(WorkflowModel).where(WorkflowModel.workflow_id == ref))
                if wf is not None:
                    break
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        if not wf.user_entered:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment / work item not found.")
        return wf

    def _repair_current_holder_alignment(self, db: Session, wf: WorkflowModel) -> None:
        """Keep current_role / assignee aligned with current_stage (fixes legacy bad rows so planning→exec can edit)."""
        if wf.current_stage == WorkflowStage.closed:
            return
        expected = STAGE_TO_ROLE.get(wf.current_stage)
        if expected is None:
            return
        if wf.current_role == expected and wf.assigned_role == expected:
            return
        wf.current_role = expected
        wf.assigned_role = expected
        uid = db.scalar(select(UserModel.id).where(UserModel.role == expected).limit(1))
        if uid is not None:
            wf.assigned_user_id = uid
        wf.updated_at = datetime.now(UTC)

    def _notify_watchers_task_progress(
        self,
        db: Session,
        wf: WorkflowModel,
        actor: User,
        task: WorkflowTaskModel,
    ) -> None:
        """Let other roles see checklist activity in notifications (hands-off SMS stays in mark_complete)."""
        ref = ((wf.workflow_id or wf.item_name or "WF")[:64]).strip()
        label = ((wf.item_name or wf.title)[:140]).strip()
        actor_role_label = actor.role.value.replace("_", " ").title()
        msg = f"«{label}»: {actor_role_label} checked «{task.task_name}» (step {wf.current_stage.value})."
        for role in (
            UserRole.executive,
            UserRole.operations,
            UserRole.inventory,
            UserRole.supplier_risk,
        ):
            if role == actor.role:
                continue
            self._add_notification(db, message=msg, related_workflow_id=ref, target_role=role, alert_type=AlertType.info)

    def user_can_edit_task(self, wf: WorkflowModel, task: WorkflowTaskModel, user: User) -> bool:
        """Executive is view-only. Each team edits only its own checklist rows (check / uncheck any time until the workflow closes)."""
        if wf.current_stage == WorkflowStage.closed:
            return False
        if user.role == UserRole.executive:
            return False
        owner = checklist_row_owner(task)
        return owner is not None and user.role == owner

    def _mirror_checkbox_boolean_columns(self, wf: WorkflowModel, task: WorkflowTaskModel) -> None:
        """Denormalized flags — one shipment row."""
        attr = TASK_KEY_TO_WORKFLOW_BOOLEAN.get(task.task_key)
        if not attr or not hasattr(wf, attr):
            return
        setattr(wf, attr, bool(task.is_completed))

    def _advance_workflow_when_handoff_checked(
        self,
        db: Session,
        wf: WorkflowModel,
        task: WorkflowTaskModel,
        user: User,
        *,
        was_completed: bool,
        now_completed: bool,
    ) -> None:
        """Move Supplier → Operations → Warehouse → Done when the hand-off row is newly checked."""
        if not now_completed or was_completed:
            return
        lane = TASK_KEY_ADVANCES_FROM_STAGE.get(task.task_key)
        if lane is None:
            return
        if canonical_control_tower_lane(wf.current_stage) != lane:
            return
        if wf.current_stage == WorkflowStage.closed:
            return
        next_stage = self._next_stage(lane)
        next_role = STAGE_TO_ROLE.get(next_stage)
        if next_role is None:
            return
        now = datetime.now(UTC)
        prev_stage = wf.current_stage
        wf.current_stage = next_stage
        wf.current_role = next_role
        wf.assigned_role = next_role
        uid = db.scalar(select(UserModel.id).where(UserModel.role == next_role).limit(1))
        if uid is not None:
            wf.assigned_user_id = uid
        if next_stage == WorkflowStage.closed:
            wf.status = WorkflowStatus.closed
            wf.final_outcome = wf.final_outcome or "Shipment / work item finished."
        else:
            wf.status = WorkflowStatus.assigned
        wf.updated_at = now
        label = ((wf.item_name or wf.title or "Shipment")[:160]).strip()
        rn = next_role.value.replace("_", " ").title()
        self._append_timeline(
            wf,
            user=user,
            role_label=user.role.value,
            action=f"«{label}»: Handed off to {rn}",
            remarks="",
            sync_status="synced",
        )
        if next_stage != WorkflowStage.closed:
            msg = HANDOFF_MESSAGES.get((prev_stage, next_stage)) or (
                f"{prev_stage.value} finished for «{wf.item_name}». {rn} can start."
            )
            self._add_notification(
                db,
                message=msg,
                related_workflow_id=wf.item_name,
                target_role=next_role,
                alert_type=AlertType.success,
            )
        else:
            self._add_notification(
                db,
                message=HANDOFF_MESSAGES.get((prev_stage, next_stage)) or "Shipment / work item complete.",
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.success,
            )

    @staticmethod
    def normalize_requested_lane(stage_raw: str) -> WorkflowStage | None:
        s = (stage_raw or "").strip().lower().replace("-", "_")
        aliases = {
            "planning": WorkflowStage.planning,
            "executive": WorkflowStage.planning,
            "supplier": WorkflowStage.supplier_risk,
            "risk": WorkflowStage.supplier_risk,
            "supplier_risk": WorkflowStage.supplier_risk,
            "operations": WorkflowStage.operations,
            "inventory": WorkflowStage.inventory,
        }
        r = aliases.get(s)
        if r is not None:
            return r
        try:
            return WorkflowStage(s)
        except ValueError:
            return None

    def set_lane_stage_status(
        self,
        db: Session,
        workflow_ref: str,
        stage_raw: str,
        user: User,
        *,
        completed: bool,
        remarks: str = "",
    ) -> WorkflowTaskModel:
        wf = self.get_workflow(db, workflow_ref)
        self._repair_current_holder_alignment(db, wf)
        lane = self.normalize_requested_lane(stage_raw)
        if lane is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown stage.")
        if wf.current_stage == WorkflowStage.closed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow is closed.")
        key = STAGE_PRIMARY_TASK_KEY.get(lane)
        if key is None:
            defs = STAGE_TASK_DEFINITIONS.get(lane) or []
            if not defs:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No checkbox for this lane.")
            key = defs[0][0]
        return self.set_workflow_task_completed(db, workflow_ref, key, user, completed, remarks=remarks)

    def get_timeline(self, db: Session, wf: WorkflowModel) -> list[WorkflowStageUpdateModel]:
        return list(
            db.scalars(
                select(WorkflowStageUpdateModel).where(WorkflowStageUpdateModel.workflow_id == wf.id).order_by(WorkflowStageUpdateModel.created_at)
            )
        )

    def ensure_tasks_for_workflow(self, db: Session, wf: WorkflowModel) -> bool:
        """Create checklist rows for all stages (except closed). Returns True if any new rows were inserted."""
        pipeline = _workflow_pipeline_for(wf)
        expected_keys: set[str] = set()
        for stage in pipeline[:-1]:
            for k, _ in STAGE_TASK_DEFINITIONS.get(stage) or []:
                expected_keys.add(k)
        if expected_keys:
            db.execute(
                delete(WorkflowTaskModel).where(
                    WorkflowTaskModel.workflow_id == wf.id,
                    ~WorkflowTaskModel.task_key.in_(expected_keys),
                )
            )
        created = False
        for stage in pipeline[:-1]:
            defs = STAGE_TASK_DEFINITIONS.get(stage)
            if not defs:
                continue
            for order, (task_key, task_name) in enumerate(defs):
                exists = db.scalar(
                    select(WorkflowTaskModel.id).where(
                        WorkflowTaskModel.workflow_id == wf.id,
                        WorkflowTaskModel.task_key == task_key,
                    )
                )
                if exists:
                    continue
                db.add(
                    WorkflowTaskModel(
                        workflow_id=wf.id,
                        task_key=task_key,
                        stage=stage,
                        task_name=task_name,
                        sort_order=order,
                        is_completed=False,
                    )
                )
                created = True
        if created:
            try:
                db.flush()
                self._recompute_workflow_progress_from_tasks(db, wf)
                db.commit()
                db.refresh(wf)
            except IntegrityError:
                # Concurrent requests (e.g. parallel checklist loads) may insert the same rows.
                db.rollback()
                return False
        return created

    def _recompute_workflow_progress_from_tasks(self, db: Session, wf: WorkflowModel) -> None:
        total = (
            db.scalar(
                select(func.count(WorkflowTaskModel.id)).where(WorkflowTaskModel.workflow_id == wf.id)
            )
            or 0
        )
        if total == 0:
            return
        done = (
            db.scalar(
                select(func.count(WorkflowTaskModel.id)).where(
                    WorkflowTaskModel.workflow_id == wf.id,
                    WorkflowTaskModel.is_completed.is_(True),
                )
            )
            or 0
        )
        wf.progress_percent = min(100, int(round(100 * done / total)))
        wf.updated_at = datetime.now(UTC)

    def _current_stage_tasks_all_done(self, db: Session, wf: WorkflowModel) -> bool:
        tasks = list(
            db.scalars(
                select(WorkflowTaskModel).where(
                    WorkflowTaskModel.workflow_id == wf.id,
                    WorkflowTaskModel.stage == wf.current_stage,
                )
            )
        )
        if not tasks:
            return True
        return all(t.is_completed for t in tasks)

    def list_workflow_tasks_for_user(self, db: Session, workflow_id: str, user: User) -> tuple[WorkflowModel, list[WorkflowTaskModel]]:
        wf = self.get_workflow(db, workflow_id)
        self.ensure_tasks_for_workflow(db, wf)
        wf = self.sync_workflow_holder_with_stage(db, workflow_id)
        tasks = list(
            db.scalars(
                select(WorkflowTaskModel).where(WorkflowTaskModel.workflow_id == wf.id),
            )
        )
        pipeline = _workflow_pipeline_for(wf)

        def _stage_order(st: WorkflowStage) -> int:
            try:
                return pipeline.index(st)
            except ValueError:
                return 999

        tasks.sort(key=lambda t: (_stage_order(t.stage), t.sort_order))
        return wf, tasks

    def sync_workflow_holder_with_stage(self, db: Session, workflow_ref: str) -> WorkflowModel:
        """Load workflow and fix current_role/assignee drift so UI and checklists match pipeline stage."""
        wf = self.get_workflow(db, workflow_ref)
        self._repair_current_holder_alignment(db, wf)
        db.flush()
        db.refresh(wf)
        # Persist fixes: session does not auto-commit; without this, rollback drops alignment on read-only GETs.
        db.commit()
        db.refresh(wf)
        return wf

    def reconcile_workflows_list(self, db: Session, workflows: list[WorkflowModel]) -> None:
        """Align current_role with current_stage for each row and commit (dashboard list must show who can edit)."""
        for wf in workflows:
            self._repair_current_holder_alignment(db, wf)
        db.commit()

    def set_workflow_task_completed(
        self,
        db: Session,
        workflow_id: str,
        task_key: str,
        user: User,
        completed: bool,
        remarks: str | None = None,
    ) -> WorkflowTaskModel:
        wf = self.get_workflow(db, workflow_id)
        self._repair_current_holder_alignment(db, wf)
        if wf.current_stage == WorkflowStage.closed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow is closed.")
        if user.role == UserRole.executive:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executive cannot edit checklists.")
        task = db.scalar(
            select(WorkflowTaskModel).where(
                WorkflowTaskModel.workflow_id == wf.id,
                WorkflowTaskModel.task_key == task_key,
            )
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        was_completed = task.is_completed
        if not self.user_can_edit_task(wf, task, user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the team that owns this lane can toggle this checkbox.",
            )
        now = datetime.now(UTC)
        task.is_completed = completed
        task.completed_by_user_id = user.id if completed else None
        task.completed_at = now if completed else None
        self._mirror_checkbox_boolean_columns(wf, task)
        if completed:
            self._notify_watchers_task_progress(db, wf, user, task)
        self._advance_workflow_when_handoff_checked(db, wf, task, user, was_completed=was_completed, now_completed=completed)
        self._recompute_workflow_progress_from_tasks(db, wf)

        label = ((wf.item_name or wf.title or "Shipment")[:160]).strip()
        role_n = user.role.value.replace("_", " ").title()
        if completed:
            timeline_action = f"«{label}»: {role_n} marked «{task.task_name}»"
        else:
            timeline_action = f"«{label}»: {role_n} unchecked «{task.task_name}»"

        tl_remarks = (remarks or "").strip()

        self._append_timeline(wf, user=user, role_label=user.role.value, action=timeline_action, remarks=tl_remarks, sync_status="synced")

        sms_service.send_checklist_handoff_sms(item_name=wf.item_name, task_key=task.task_key, was_completed=was_completed, now_completed=completed)

        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_TASK_UPDATED",
            {
                "item_name": wf.item_name,
                "task_key": task_key,
                "task_name": task.task_name,
                "stage": task.stage.value,
                "completed": completed,
                "progress_percent_after": wf.progress_percent,
                "detail": f"Shipment progress '{task.task_name}' set to {'done' if completed else 'not done'}.",
                "remarks": tl_remarks,
            },
        )
        wf.sync_version = int(getattr(wf, "sync_version", 0) or 0) + 1
        wf.updated_at = now
        db.commit()
        db.refresh(task)
        db.refresh(wf)
        return task

    def add_remark(self, db: Session, workflow_id: str, user: User, remark: str) -> WorkflowStageUpdateModel:
        wf = self.get_workflow(db, workflow_id)
        if wf.current_role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot add remarks to this workflow stage.")
        now = datetime.now(UTC)
        update = WorkflowStageUpdateModel(
            workflow_id=wf.id,
            stage_name=wf.current_stage,
            role=user.role,
            updated_by_user_id=user.id,
            previous_status=wf.status,
            new_status=wf.status,
            remark=remark,
            started_at=wf.created_at,
            created_at=now,
        )
        db.add(update)
        wf.remarks = remark or wf.remarks
        wf.updated_at = now
        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_REMARK_ADDED",
            {"role": user.role.value, "item_name": wf.item_name, "remark": remark, "previous_status": wf.status.value, "new_status": wf.status.value},
        )
        db.commit()
        db.refresh(update)
        return update

    def audit_logs_for_workflow(self, db: Session, workflow_id: str, limit: int = 20) -> list[AuditLogModel]:
        wf = self.get_workflow(db, workflow_id)
        return list(
            db.scalars(
                select(AuditLogModel)
                .where(AuditLogModel.workflow_id == wf.id)
                .order_by(AuditLogModel.created_at.desc())
                .limit(limit)
            )
        )

    def shipment_details_for_workflow(self, db: Session, workflow_id: str) -> dict:
        wf = self.get_workflow(db, workflow_id)
        shipment = db.scalar(select(ShipmentModel).where(ShipmentModel.workflow_id == wf.id))
        if not shipment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found for workflow")
        selected_route = None
        if shipment.selected_route_id:
            route = db.scalar(select(RouteModel).where(RouteModel.id == shipment.selected_route_id))
            if route:
                selected_route = {
                    "route_code": route.route_code,
                    "distance_km": route.distance_km,
                    "eta_hours": route.expected_time_hours,
                    "cost_usd": route.route_cost,  # Indian Rupees (₹); key name kept for clients
                    "co2_kg": route.co2_estimate,
                    "disruption_risk": route.disruption_risk,
                }
        return {
            "shipment_id": shipment.shipment_id,
            "current_status": shipment.current_status,
            "progress_percent": shipment.progress_percent,
            "eta": shipment.eta.isoformat() if shipment.eta else None,
            "selected_route": selected_route,
        }

    def _next_stage(self, stage: WorkflowStage) -> WorkflowStage:
        return STAGE_NEXT.get(stage, WorkflowStage.closed)

    def _add_notification(
        self,
        db: Session,
        message: str,
        related_workflow_id: str,
        target_role: UserRole,
        alert_type: AlertType = AlertType.info,
    ) -> None:
        db.add(
            NotificationModel(
                target_role=target_role,
                message=message,
                type=alert_type,
                related_workflow_id=related_workflow_id,
                created_at=datetime.now(UTC),
            )
        )

    def _audit(
        self,
        db: Session,
        user_id: int,
        workflow_db_id: int | None,
        action_type: str,
        details: str | dict,
        module_name: str = "workflow_engine",
    ) -> None:
        if isinstance(details, dict):
            details_str = json.dumps(details, ensure_ascii=False)
        else:
            details_str = details
        db.add(
            AuditLogModel(
                user_id=user_id,
                workflow_id=workflow_db_id,
                action_type=action_type,
                module_name=module_name,
                details=details_str,
                created_at=datetime.now(UTC),
            )
        )

    def log_audit_event(
        self,
        db: Session,
        *,
        user: User,
        workflow_ref: str | None,
        action_type: str,
        module_name: str,
        payload: dict,
    ) -> None:
        wf_db_id: int | None = None
        wf_label: str | None = None
        if workflow_ref:
            wf = self.get_workflow(db, workflow_ref)
            wf_db_id = wf.id
            wf_label = wf.item_name
        self._audit(
            db,
            user.id,
            wf_db_id,
            action_type,
            {"role": user.role.value, "item_name": wf_label or workflow_ref, **payload},
            module_name=module_name,
        )

    def update_status(self, db: Session, workflow_id: str, user: User, payload: WorkflowUpdateRequest) -> WorkflowModel:
        wf = self.get_workflow(db, workflow_id)
        if wf.current_role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot edit this workflow stage.")
        if payload.status not in ALLOWED_STATUS_TRANSITIONS.get(wf.status, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid transition from '{wf.status.value}' to '{payload.status.value}'.",
            )
        previous_status = wf.status
        wf.status = payload.status
        wf.remarks = payload.remark or wf.remarks
        wf.updated_at = datetime.now(UTC)
        db.add(
            WorkflowStageUpdateModel(
                workflow_id=wf.id,
                stage_name=wf.current_stage,
                role=user.role,
                updated_by_user_id=user.id,
                previous_status=previous_status,
                new_status=payload.status,
                remark=payload.remark,
                started_at=wf.created_at,
                created_at=datetime.now(UTC),
            )
        )

        # Alerts for delay / escalation status changes.
        if payload.status == WorkflowStatus.delayed:
            self._add_notification(
                db,
                message=f"{wf.item_name} is delayed for shipment {wf.shipment_id}. Please review ETA and mitigation.",
                related_workflow_id=wf.item_name,
                target_role=wf.current_role,
                alert_type=AlertType.warning,
            )
        elif payload.status == WorkflowStatus.escalated:
            self._add_notification(
                db,
                message=f"{wf.item_name} for shipment {wf.shipment_id} has been escalated. Leadership attention required.",
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.critical,
            )

        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_STATUS_UPDATED",
            {
                "role": user.role.value,
                "item_name": wf.item_name,
                "previous_status": previous_status.value,
                "new_status": payload.status.value,
                "remark": payload.remark,
            },
        )
        db.commit()
        db.refresh(wf)
        return wf

    def patch_team_checklist(
        self,
        db: Session,
        workflow_ref: str,
        user: User,
        *,
        role_token: str,
        field: str,
        completed: bool,
        remarks: str = "",
        expected_sync_version: int | None = None,
    ) -> dict:
        if user.role == UserRole.executive:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Executive cannot edit checklists.",
            )
        s = (role_token or "").strip().lower().replace("-", "_")
        rr = UserRole.supplier_risk if s == "supplier" else None
        if rr is None:
            try:
                rr = UserRole(s)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role.")
        if user.role != rr:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own team's checklist.",
            )
        allowed = ROLE_CHECKLIST_KEYS.get(user.role, frozenset())
        if field not in allowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown checklist field for this team.")
        wf = self.get_workflow(db, workflow_ref)
        if expected_sync_version is not None and int(getattr(wf, "sync_version", 0) or 0) != int(expected_sync_version):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This item was updated elsewhere. Please review the latest status.",
            )
        task = db.scalar(
            select(WorkflowTaskModel).where(WorkflowTaskModel.workflow_id == wf.id, WorkflowTaskModel.task_key == field)
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist row not found for this item.")
        if checklist_row_owner(task) != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This checklist row belongs to another team.")
        self.set_workflow_task_completed(db, workflow_ref, field, user, completed, remarks=remarks or None)
        wf2 = self.get_workflow(db, workflow_ref)
        nxt = self._next_stage(wf2.current_stage)
        next_team = "Done"
        if nxt != WorkflowStage.closed:
            nr = STAGE_TO_ROLE.get(nxt)
            if nr:
                next_team = nr.value.replace("_", " ").title()
        return {
            "success": True,
            "workflow_id": wf2.workflow_id,
            "item_name": wf2.item_name,
            "updated_role": user.role.value,
            "field": field,
            "completed": completed,
            "next_team": next_team,
            "sync_version": int(getattr(wf2, "sync_version", 0) or 0),
        }

    def _allocate_internal_workflow_id(self, db: Session) -> str:
        for _ in range(200):
            cand = "WF-" + uuid.uuid4().hex[:8].upper()
            if db.scalar(select(WorkflowModel.id).where(WorkflowModel.workflow_id == cand)) is None:
                return cand
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not allocate workflow id.")

    def create_workflow(self, db: Session, user: User, payload: CreateWorkflowRequest) -> WorkflowModel:
        if user.role != UserRole.executive:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only executive can create workflows.")
        name = payload.item_name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_name is required.")
        exists = db.scalar(select(WorkflowModel.id).where(WorkflowModel.item_name == name))
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An item with this name already exists.")

        title = (payload.title or "").strip() or name
        product_name = (payload.product_name or "").strip() or payload.material_type.strip() or None
        route_name = (payload.route_name or "").strip() or None

        ship = (payload.shipment_id or "").strip() or f"SHP-{uuid.uuid4().hex[:10].upper()}"

        qty = payload.quantity
        unit = (payload.unit or "").strip()
        mat = (payload.material_type or "").strip()
        vendor = (payload.supplier_name or "").strip()
        vendor_loc = (payload.supplier_location or "").strip()

        desc_parts = [payload.description or ""]
        if mat or qty is not None or unit:
            desc_parts.append(f"Material: {mat}; Qty: {qty} {unit}".strip())
        if vendor:
            desc_parts.append(f"Supplier: {vendor}" + (f" ({vendor_loc})" if vendor_loc else ""))
        merged_desc = "\n".join(p for p in desc_parts if p).strip()

        pr = payload.priority if isinstance(payload.priority, str) else "Medium"
        pr_low = pr.strip().lower()
        prio_map: dict[str, str] = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
        priority_api = prio_map.get(pr_low, "Medium")

        supplier_uid = db.scalar(select(UserModel.id).where(UserModel.role == UserRole.supplier_risk).limit(1))

        wf = WorkflowModel(
            workflow_id=self._allocate_internal_workflow_id(db),
            item_name=name,
            user_entered=True,
            product_name=product_name or mat or None,
            route_name=route_name,
            shipment_id=ship,
            material_type=mat,
            quantity=float(qty) if qty is not None else None,
            unit=unit,
            supplier_party_name=vendor,
            supplier_party_location=vendor_loc,
            sync_version=0,
            title=title,
            description=merged_desc or (payload.remark or f"Shipment / work item for «{name}»"),
            priority=priority_api,
            source_location=payload.source_location.strip(),
            destination_location=payload.destination_location.strip(),
            current_stage=WorkflowStage.supplier_risk,
            current_role=UserRole.supplier_risk,
            assigned_user_id=supplier_uid,
            assigned_role=UserRole.supplier_risk,
            status=WorkflowStatus.assigned,
            progress_percent=0,
            due_date=payload.required_date or payload.due_date,
            remarks=(payload.remark or payload.remarks or "").strip(),
        )
        db.add(wf)
        db.flush()

        now_c = datetime.now(UTC)
        db.add(
            WorkflowStageUpdateModel(
                workflow_id=wf.id,
                stage_name=WorkflowStage.supplier_risk,
                role=user.role,
                updated_by_user_id=user.id,
                previous_status=WorkflowStatus.pending,
                new_status=WorkflowStatus.assigned,
                remark=payload.remark or "Raw material / shipment added",
                started_at=now_c,
                created_at=now_c,
            )
        )
        self._append_timeline(
            wf,
            user=user,
            role_label=user.role.value,
            action="Raw material request created",
            remarks=(payload.remark or payload.remarks or "").strip(),
            sync_status="synced",
        )
        self._add_notification(
            db,
            message=f"New «{wf.item_name}» — Supplier: open your checklist and confirm the rows.",
            related_workflow_id=wf.item_name,
            target_role=UserRole.supplier_risk,
            alert_type=AlertType.info,
        )
        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_CREATED",
            {
                "role": user.role.value,
                "item_name": wf.item_name,
                "previous_status": WorkflowStatus.pending.value,
                "new_status": WorkflowStatus.assigned.value,
                "remark": payload.remark,
                "details": f"Created «{name}» — starts with Supplier",
            },
        )
        db.commit()
        db.refresh(wf)
        self.ensure_tasks_for_workflow(db, wf)
        db.commit()
        db.refresh(wf)
        return wf

    def mark_complete(self, db: Session, workflow_id: str, user: User, payload: MarkCompleteRequest) -> WorkflowModel:
        wf = self.get_workflow(db, workflow_id)
        if wf.current_role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only current stage role can complete this stage.")
        self.ensure_tasks_for_workflow(db, wf)
        wf = self.get_workflow(db, workflow_id)
        if not self._current_stage_tasks_all_done(db, wf):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Complete all checklist items for this stage before marking the stage complete.",
            )
        completed_stage = wf.current_stage
        next_stage = self._next_stage(completed_stage)
        next_role = STAGE_TO_ROLE[next_stage]
        now = datetime.now(UTC)
        previous_status = wf.status
        wf.status = WorkflowStatus.closed if next_stage == WorkflowStage.closed else WorkflowStatus.assigned
        wf.current_stage = next_stage
        wf.current_role = next_role
        wf.assigned_role = next_role
        wf.assigned_user_id = db.scalar(select(UserModel.id).where(UserModel.role == next_role).limit(1))
        self._recompute_workflow_progress_from_tasks(db, wf)
        wf.remarks = payload.remark or wf.remarks
        wf.final_outcome = "Workflow closed successfully" if next_stage == WorkflowStage.closed else wf.final_outcome
        wf.updated_at = now

        db.add(
            WorkflowStageUpdateModel(
                workflow_id=wf.id,
                stage_name=completed_stage,
                role=user.role,
                updated_by_user_id=user.id,
                previous_status=previous_status,
                new_status=WorkflowStatus.completed,
                remark=payload.remark or f"{completed_stage.value} completed",
                started_at=wf.created_at,
                completed_at=now,
                created_at=now,
            )
        )

        if next_stage != WorkflowStage.closed:
            handoff = HANDOFF_MESSAGES.get((completed_stage, next_stage))
            self._add_notification(
                db,
                message=handoff
                or f"{completed_stage.value} completed for «{wf.item_name}». {next_role.value.replace('_', ' ').title()} team can start now.",
                related_workflow_id=wf.item_name,
                target_role=next_role,
                alert_type=AlertType.success,
            )
        else:
            self._add_notification(
                db,
                message=HANDOFF_MESSAGES.get((completed_stage, next_stage), "Workflow completed."),
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.success,
            )

        sms_service.send_handoff_sms(wf.item_name, completed_stage, next_stage)

        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_STAGE_COMPLETED",
            {
                "role": user.role.value,
                "item_name": wf.item_name,
                "previous_status": previous_status.value,
                "new_status": WorkflowStatus.completed.value,
                "remark": payload.remark,
                "details": f"Completed {completed_stage.value}; moved to {next_stage.value}",
            },
        )
        db.commit()
        db.refresh(wf)
        return wf

    def notifications_for_user(self, db: Session, user: User) -> list[NotificationModel]:
        # Generate simple "due alerts" for overdue workflows that do not yet have a due notification.
        now = datetime.now(UTC)
        overdue = list(
            db.scalars(
                select(WorkflowModel).where(
                    WorkflowModel.user_entered.is_(True),
                    WorkflowModel.current_role == user.role,
                    WorkflowModel.status != WorkflowStatus.closed,
                    WorkflowModel.due_date.is_not(None),
                    WorkflowModel.due_date < now,
                )
            )
        )
        for wf in overdue:
            exists = db.scalar(
                select(NotificationModel.id).where(
                    and_(
                        NotificationModel.related_workflow_id == wf.item_name,
                        NotificationModel.type == AlertType.warning,
                        NotificationModel.message.ilike("%Due date reached%"),
                    )
                )
            )
            if not exists:
                self._add_notification(
                    db,
                    message=f"Due date reached for «{wf.item_name}» (shipment {wf.shipment_id}). Please update status or escalate.",
                    related_workflow_id=wf.item_name,
                    target_role=user.role,
                    alert_type=AlertType.warning,
                )
        if overdue:
            db.commit()

        return list(
            db.scalars(
                select(NotificationModel)
                .where((NotificationModel.user_id == user.id) | (NotificationModel.target_role == user.role))
                .order_by(NotificationModel.created_at.desc())
            )
        )

    def unread_notification_count(self, db: Session, user: User) -> int:
        return (
            db.scalar(
                select(func.count(NotificationModel.id)).where(
                    ((NotificationModel.user_id == user.id) | (NotificationModel.target_role == user.role)),
                    NotificationModel.is_read.is_(False),
                )
            )
            or 0
        )

    def mark_notification_read(self, db: Session, notification_id: int, user: User) -> NotificationModel:
        notif = db.scalar(select(NotificationModel).where(NotificationModel.id == notification_id))
        if not notif:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        if notif.user_id not in (None, user.id) and notif.target_role != user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this notification")
        notif.is_read = True
        db.commit()
        db.refresh(notif)
        return notif

    def mark_all_notifications_read(self, db: Session, user: User) -> int:
        """Mark all notifications visible to this user as read. Returns affected count."""
        q = select(NotificationModel).where(
            (NotificationModel.user_id == user.id) | (NotificationModel.target_role == user.role)
        )
        items = list(db.scalars(q))
        for n in items:
            n.is_read = True
        if items:
            db.commit()
        return len(items)

    def workflow_summary(self, db: Session) -> WorkflowSummary:
        user_only = WorkflowModel.user_entered.is_(True)
        total = db.scalar(select(func.count(WorkflowModel.id)).where(user_only)) or 0
        completed = (
            db.scalar(select(func.count(WorkflowModel.id)).where(user_only, WorkflowModel.current_stage == WorkflowStage.closed)) or 0
        )
        delayed = db.scalar(select(func.count(WorkflowModel.id)).where(user_only, WorkflowModel.status == WorkflowStatus.delayed)) or 0
        active = total - completed
        return WorkflowSummary(
            total_workflows=total,
            active_workflows=active,
            completed_workflows=completed,
            delayed_workflows=delayed,
            on_time_delivery_pct=91.3,
            logistics_cost_musd=2.48,
            co2_tonnes=72.4,
            workflow_completion_rate=round((completed / total) * 100, 2) if total else 0,
        )

    def audit_logs(self, db: Session) -> list[AuditLogModel]:
        return list(db.scalars(select(AuditLogModel).order_by(AuditLogModel.created_at.desc())))

    def audit_trail_query(
        self,
        db: Session,
        role: UserRole | None = None,
        workflow_public_id: str | None = None,
        start_iso: str | None = None,
        end_iso: str | None = None,
        action_type: str | None = None,
        module_name: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[dict]:
        q = (
            select(AuditLogModel, UserModel, WorkflowModel)
            .join(UserModel, UserModel.id == AuditLogModel.user_id)
            .join(WorkflowModel, WorkflowModel.id == AuditLogModel.workflow_id, isouter=True)
            .order_by(AuditLogModel.created_at.desc())
            .limit(min(max(limit, 1), 500))
            .offset(max(offset, 0))
        )
        if role:
            q = q.where(UserModel.role == role)
        if workflow_public_id:
            q = q.where(
                or_(
                    WorkflowModel.item_name == workflow_public_id,
                    WorkflowModel.workflow_id == workflow_public_id,
                )
            )
        if action_type:
            q = q.where(AuditLogModel.action_type == action_type)
        if module_name:
            q = q.where(AuditLogModel.module_name == module_name)
        if start_iso:
            try:
                start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
                q = q.where(AuditLogModel.created_at >= start_dt)
            except Exception:
                pass
        if end_iso:
            try:
                end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
                q = q.where(AuditLogModel.created_at <= end_dt)
            except Exception:
                pass

        rows = db.execute(q).all()
        out: list[dict] = []
        for audit, usr, wf in rows:
            parsed = {}
            try:
                parsed = json.loads(audit.details) if audit.details and audit.details.strip().startswith("{") else {}
            except Exception:
                parsed = {}
            out.append(
                {
                    "id": audit.id,
                    "user_id": audit.user_id,
                    "user_name": usr.name if usr else None,
                    "user_role": usr.role.value if usr else None,
                    "item_name": wf.item_name if wf else None,
                    "previous_status": parsed.get("previous_status"),
                    "new_status": parsed.get("new_status"),
                    "remark": parsed.get("remark"),
                    "action_type": audit.action_type,
                    "module_name": audit.module_name,
                    "details": parsed.get("details") or audit.details,
                    "created_at": audit.created_at,
                }
            )
        return out


    def _forbid_executive_control_mutations(self, user: User) -> None:
        if user.role == UserRole.executive:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Executive role is view-only for workflow updates (Control Tower policy).",
            )

    def _append_timeline(
        self,
        wf: WorkflowModel,
        *,
        user: User | None,
        role_label: str,
        action: str,
        remarks: str = "",
        sync_status: str = "synced",
    ) -> None:
        events: list[dict] = []
        raw = wf.timeline_events
        if isinstance(raw, list):
            events = [x for x in raw if isinstance(x, dict)]
        elif isinstance(raw, str):
            try:
                v = json.loads(raw)
                if isinstance(v, list):
                    events = [x for x in v if isinstance(x, dict)]
            except json.JSONDecodeError:
                events = []
        entry = {
            "time": datetime.now(UTC).isoformat(),
            "role": role_label or (user.role.value if user else "system"),
            "action": action,
            "remarks": remarks or "",
            "sync_status": sync_status,
        }
        events.append(entry)
        wf.timeline_events = events

    def patch_supplier_domain(
        self,
        db: Session,
        workflow_id: str,
        user: User,
        payload: SupplierDomainPatch,
    ) -> WorkflowModel:
        self._forbid_executive_control_mutations(user)
        if user.role != UserRole.supplier_risk:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supplier accounts can edit supplier fields.")
        wf = self.get_workflow(db, workflow_id)
        wf.supplier_status = payload.supplier_status
        wf.updated_at = datetime.now(UTC)
        remark = ""
        if payload.delay_reason.strip():
            remark = payload.delay_reason.strip()
        action = f"Supplier status set to {payload.supplier_status}"
        self._append_timeline(wf, user=user, role_label=user.role.value, action=action, remarks=remark)
        if payload.supplier_status.lower() in ("delayed", "unavailable"):
            self._add_notification(
                db,
                message=f"[Supplier] «{wf.item_name}»: status {payload.supplier_status}"
                + (f" ({remark})" if remark else ""),
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.warning,
            )
        self._audit(
            db,
            user.id,
            wf.id,
            "CONTROL_SUPPLIER_UPDATED",
            {"item_name": wf.item_name, "supplier_status": payload.supplier_status},
        )
        db.commit()
        db.refresh(wf)
        return wf

    def patch_route_domain(self, db: Session, workflow_id: str, user: User, payload: RouteDomainPatch) -> WorkflowModel:
        self._forbid_executive_control_mutations(user)
        if user.role != UserRole.operations:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only operations can edit route fields.")
        wf = self.get_workflow(db, workflow_id)
        wf.route_status = payload.route_status
        wf.updated_at = datetime.now(UTC)
        self._append_timeline(
            wf,
            user=user,
            role_label=user.role.value,
            action=f"Route status set to {payload.route_status}",
            remarks=payload.remark,
        )
        if payload.route_status.lower() in ("delayed",):
            self._add_notification(
                db,
                message=f"[Route] «{wf.item_name}»: movement {payload.route_status}",
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.warning,
            )
        self._audit(
            db,
            user.id,
            wf.id,
            "CONTROL_ROUTE_UPDATED",
            {"item_name": wf.item_name, "route_status": payload.route_status},
        )
        db.commit()
        db.refresh(wf)
        return wf

    def patch_inventory_domain(self, db: Session, workflow_id: str, user: User, payload: InventoryDomainPatch) -> WorkflowModel:
        self._forbid_executive_control_mutations(user)
        if user.role != UserRole.inventory:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only inventory can edit stock fields.")
        wf = self.get_workflow(db, workflow_id)
        wf.inventory_status = payload.inventory_status
        wf.updated_at = datetime.now(UTC)
        remarks = payload.remark
        if payload.reorder_requested:
            remarks = (remarks + " · reorder requested").strip()
        self._append_timeline(
            wf,
            user=user,
            role_label=user.role.value,
            action=f"Inventory status set to {payload.inventory_status}",
            remarks=remarks or "",
        )
        low = payload.inventory_status.lower() in ("low_stock", "critical", "reorder_sent")
        if low or payload.reorder_requested:
            self._add_notification(
                db,
                message=f"[Stock] «{wf.item_name}»: {payload.inventory_status}" + (" — reorder flagged" if payload.reorder_requested else ""),
                related_workflow_id=wf.item_name,
                target_role=UserRole.executive,
                alert_type=AlertType.warning,
            )
        self._audit(
            db,
            user.id,
            wf.id,
            "CONTROL_INVENTORY_UPDATED",
            {"item_name": wf.item_name, "inventory_status": payload.inventory_status},
        )
        db.commit()
        db.refresh(wf)
        return wf

    def get_unified_timeline(self, db: Session, wf: WorkflowModel) -> list[dict]:
        out: list[dict] = []
        for stage in self.get_timeline(db, wf):
            ts = getattr(stage, "completed_at", None) or stage.created_at
            out.append(
                {
                    "time": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                    "role": stage.role.value,
                    "action": stage.remark.strip() if (stage.remark or "").strip() else "Shipment status updated",
                    "remarks": "",
                    "source": "stage_update",
                }
            )
        for ev in wf.timeline_events or []:
            if not isinstance(ev, dict):
                continue
            out.append(
                {
                    "time": ev.get("time", ""),
                    "role": ev.get("role", ""),
                    "action": ev.get("action", ""),
                    "remarks": ev.get("remarks", ""),
                    "source": "domain",
                }
            )
        try:
            out.sort(key=lambda r: r.get("time") or "")
        except Exception:
            pass
        return out


engine = WorkflowEngine()
