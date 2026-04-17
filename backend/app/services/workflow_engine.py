from __future__ import annotations

from datetime import datetime, timedelta, timezone

UTC = timezone.utc
import json

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, select
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
    MarkCompleteRequest,
    Notification,
    User,
    UserRole,
    WorkflowItem,
    WorkflowStage,
    WorkflowStageUpdate,
    WorkflowStatus,
    WorkflowSummary,
    WorkflowUpdateRequest,
    CreateWorkflowRequest,
)

STAGE_SEQUENCE: list[WorkflowStage] = [
    WorkflowStage.planning,
    WorkflowStage.operations,
    WorkflowStage.inventory,
    WorkflowStage.supplier_risk,
    WorkflowStage.closed,
]

STAGE_TO_ROLE: dict[WorkflowStage, UserRole] = {
    WorkflowStage.planning: UserRole.executive,
    WorkflowStage.operations: UserRole.operations,
    WorkflowStage.inventory: UserRole.inventory,
    WorkflowStage.supplier_risk: UserRole.supplier_risk,
    WorkflowStage.closed: UserRole.executive,
}

# Checkbox tasks per stage — cross-dashboard sync uses these keys + labels everywhere.
STAGE_TASK_DEFINITIONS: dict[WorkflowStage, list[tuple[str, str]]] = {
    WorkflowStage.planning: [
        ("plan_approved", "Planning Approved"),
    ],
    WorkflowStage.operations: [
        ("dispatch_started", "Dispatch Started"),
        ("dispatch_completed", "Dispatch Completed"),
        ("reached_checkpoint", "Reached Checkpoint"),
        ("delivered_to_wh", "Delivered to Warehouse"),
    ],
    WorkflowStage.inventory: [
        ("stock_received", "Stock Received"),
        ("stock_packed", "Stock Packed"),
        ("stock_transferred", "Stock Transferred"),
    ],
    WorkflowStage.supplier_risk: [
        ("supplier_contacted", "Supplier Contacted"),
        ("risk_mitigation_started", "Risk Mitigation Started"),
        ("issue_closed", "Issue Closed"),
    ],
}

HANDOFF_MESSAGES: dict[tuple[WorkflowStage, WorkflowStage], str] = {
    (WorkflowStage.planning, WorkflowStage.operations): "Executive work completed. Operations team can start now.",
    (WorkflowStage.operations, WorkflowStage.inventory): "Operations work completed. Inventory team can start now.",
    (WorkflowStage.inventory, WorkflowStage.supplier_risk): "Inventory work completed. Supplier & Risk team needs to act.",
    (WorkflowStage.supplier_risk, WorkflowStage.closed): "Supplier & Risk work completed. Workflow closed.",
}

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
        return db.scalar(select(UserModel).where(UserModel.email == email, UserModel.is_active.is_(True)))

    def user_by_id(self, db: Session, user_id: int) -> UserModel:
        user = db.scalar(select(UserModel).where(UserModel.id == user_id, UserModel.is_active.is_(True)))
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def workflows_for_role(self, db: Session, role: UserRole) -> list[WorkflowModel]:
        if role == UserRole.executive:
            return list(db.scalars(select(WorkflowModel).order_by(WorkflowModel.updated_at.desc())))
        return list(
            db.scalars(
                select(WorkflowModel).where(WorkflowModel.current_role == role).order_by(WorkflowModel.updated_at.desc())
            )
        )

    def pending_for_user(self, db: Session, user: User) -> list[WorkflowModel]:
        return list(
            db.scalars(
                select(WorkflowModel).where(
                    WorkflowModel.current_role == user.role,
                    WorkflowModel.status != WorkflowStatus.closed,
                    (WorkflowModel.assigned_user_id == user.id) | (WorkflowModel.assigned_user_id.is_(None)),
                )
            )
        )

    def get_workflow(self, db: Session, workflow_id: str) -> WorkflowModel:
        wf = db.scalar(select(WorkflowModel).where(WorkflowModel.workflow_id == workflow_id))
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        return wf

    def get_timeline(self, db: Session, workflow_id: str) -> list[WorkflowStageUpdateModel]:
        wf = self.get_workflow(db, workflow_id)
        return list(
            db.scalars(
                select(WorkflowStageUpdateModel).where(WorkflowStageUpdateModel.workflow_id == wf.id).order_by(WorkflowStageUpdateModel.created_at)
            )
        )

    def ensure_tasks_for_workflow(self, db: Session, wf: WorkflowModel) -> bool:
        """Create checklist rows for all stages (except closed). Returns True if any new rows were inserted."""
        expected_keys: set[str] = set()
        for stage in STAGE_SEQUENCE[:-1]:
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
        for stage in STAGE_SEQUENCE[:-1]:
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
                self._sync_prior_stage_tasks_completion(db, wf)
                self._recompute_workflow_progress_from_tasks(db, wf)
                db.commit()
                db.refresh(wf)
            except IntegrityError:
                # Concurrent requests (e.g. parallel checklist loads) may insert the same rows.
                db.rollback()
                return False
        return created

    def _sync_prior_stage_tasks_completion(self, db: Session, wf: WorkflowModel) -> None:
        """Mark tasks for stages before the current stage as done (migration / demo alignment)."""
        try:
            cur_idx = STAGE_SEQUENCE.index(wf.current_stage)
        except ValueError:
            return
        now = datetime.now(UTC)
        for i in range(cur_idx):
            st = STAGE_SEQUENCE[i]
            tasks = list(
                db.scalars(
                    select(WorkflowTaskModel).where(
                        WorkflowTaskModel.workflow_id == wf.id,
                        WorkflowTaskModel.stage == st,
                    )
                )
            )
            for t in tasks:
                if not t.is_completed:
                    t.is_completed = True
                    t.completed_at = now

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
        wf = self.get_workflow(db, workflow_id)
        tasks = list(
            db.scalars(
                select(WorkflowTaskModel).where(WorkflowTaskModel.workflow_id == wf.id),
            )
        )
        def _stage_order(st: WorkflowStage) -> int:
            try:
                return STAGE_SEQUENCE.index(st)
            except ValueError:
                return 99

        tasks.sort(key=lambda t: (_stage_order(t.stage), t.sort_order))
        return wf, tasks

    def set_workflow_task_completed(
        self,
        db: Session,
        workflow_id: str,
        task_key: str,
        user: User,
        completed: bool,
    ) -> WorkflowTaskModel:
        wf = self.get_workflow(db, workflow_id)
        if wf.current_stage == WorkflowStage.closed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workflow is closed.")
        task = db.scalar(
            select(WorkflowTaskModel).where(
                WorkflowTaskModel.workflow_id == wf.id,
                WorkflowTaskModel.task_key == task_key,
            )
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        if task.stage != wf.current_stage:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only tasks in the current stage can be changed.",
            )
        if user.role != wf.current_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the team assigned to this stage can update checklist items.",
            )
        now = datetime.now(UTC)
        task.is_completed = completed
        task.completed_by_user_id = user.id if completed else None
        task.completed_at = now if completed else None
        self._recompute_workflow_progress_from_tasks(db, wf)
        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_TASK_UPDATED",
            {
                "workflow_id": wf.workflow_id,
                "task_key": task_key,
                "task_name": task.task_name,
                "stage": task.stage.value,
                "completed": completed,
                "progress_percent_after": wf.progress_percent,
                "detail": f"Checklist '{task.task_name}' set to {'done' if completed else 'not done'} (cross-dashboard sync).",
            },
        )
        if completed:
            remaining = (
                db.scalar(
                    select(func.count(WorkflowTaskModel.id)).where(
                        WorkflowTaskModel.workflow_id == wf.id,
                        WorkflowTaskModel.stage == wf.current_stage,
                        WorkflowTaskModel.is_completed.is_(False),
                    )
                )
                or 0
            )
            if remaining == 0:
                self._add_notification(
                    db,
                    message=f"All checklist items for {wf.current_stage.value} are done on {wf.workflow_id}. Use Mark Stage Complete to hand off to the next team.",
                    related_workflow_id=wf.workflow_id,
                    target_role=wf.current_role,
                    alert_type=AlertType.success,
                )
        db.commit()
        db.refresh(task)
        db.refresh(wf)
        return task

    def add_remark(self, db: Session, workflow_id: str, user: User, remark: str) -> WorkflowStageUpdateModel:
        wf = self.get_workflow(db, workflow_id)
        if user.role != UserRole.executive and wf.current_role != user.role:
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
            {"role": user.role.value, "workflow_id": wf.workflow_id, "remark": remark, "previous_status": wf.status.value, "new_status": wf.status.value},
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
        current_index = STAGE_SEQUENCE.index(stage)
        if current_index >= len(STAGE_SEQUENCE) - 1:
            return WorkflowStage.closed
        return STAGE_SEQUENCE[current_index + 1]

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
        workflow_id: str | None,
        action_type: str,
        module_name: str,
        payload: dict,
    ) -> None:
        wf_db_id: int | None = None
        wf_public_id: str | None = None
        if workflow_id:
            wf = self.get_workflow(db, workflow_id)
            wf_db_id = wf.id
            wf_public_id = wf.workflow_id
        self._audit(
            db,
            user.id,
            wf_db_id,
            action_type,
            {"role": user.role.value, "workflow_id": wf_public_id or workflow_id, **payload},
            module_name=module_name,
        )

    def update_status(self, db: Session, workflow_id: str, user: User, payload: WorkflowUpdateRequest) -> WorkflowModel:
        wf = self.get_workflow(db, workflow_id)
        if user.role != UserRole.executive and wf.current_role != user.role:
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
                message=f"Workflow {wf.workflow_id} is delayed for shipment {wf.shipment_id}. Please review ETA and mitigation.",
                related_workflow_id=wf.workflow_id,
                target_role=wf.current_role,
                alert_type=AlertType.warning,
            )
        elif payload.status == WorkflowStatus.escalated:
            self._add_notification(
                db,
                message=f"Workflow {wf.workflow_id} for shipment {wf.shipment_id} has been escalated. Leadership attention required.",
                related_workflow_id=wf.workflow_id,
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
                "workflow_id": wf.workflow_id,
                "previous_status": previous_status.value,
                "new_status": payload.status.value,
                "remark": payload.remark,
            },
        )
        db.commit()
        db.refresh(wf)
        return wf

    def create_workflow(self, db: Session, user: User, payload: CreateWorkflowRequest) -> WorkflowModel:
        if user.role != UserRole.executive:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only executive can create workflows.")
        exists = db.scalar(select(WorkflowModel.id).where(WorkflowModel.workflow_id == payload.workflow_id))
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Workflow ID already exists.")

        operations_user_id = payload.assigned_operations_user_id
        if not operations_user_id:
            operations_user_id = db.scalar(select(UserModel.id).where(UserModel.role == UserRole.operations).limit(1))

        wf = WorkflowModel(
            workflow_id=payload.workflow_id,
            shipment_id=payload.shipment_id,
            title=payload.title,
            description=payload.description,
            priority=payload.priority,
            source_location=payload.source_location,
            destination_location=payload.destination_location,
            current_stage=WorkflowStage.operations,
            current_role=UserRole.operations,
            assigned_user_id=operations_user_id,
            assigned_role=UserRole.operations,
            status=WorkflowStatus.assigned,
            progress_percent=20,
            due_date=payload.due_date,
            remarks=payload.remark,
        )
        db.add(wf)
        db.flush()

        db.add(
            WorkflowStageUpdateModel(
                workflow_id=wf.id,
                stage_name=WorkflowStage.planning,
                role=UserRole.executive,
                updated_by_user_id=user.id,
                previous_status=WorkflowStatus.pending,
                new_status=WorkflowStatus.completed,
                remark=payload.remark or "Workflow approved and assigned to operations.",
                started_at=datetime.now(UTC),
                completed_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
            )
        )
        self._add_notification(
            db,
            message=f"Executive approved workflow {wf.workflow_id}. Operations action required.",
            related_workflow_id=wf.workflow_id,
            target_role=UserRole.operations,
            alert_type=AlertType.info,
        )
        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_CREATED",
            {
                "role": user.role.value,
                "workflow_id": wf.workflow_id,
                "previous_status": WorkflowStatus.pending.value,
                "new_status": WorkflowStatus.assigned.value,
                "remark": payload.remark,
                "details": f"Created workflow {wf.workflow_id} and assigned to operations",
            },
        )
        db.commit()
        db.refresh(wf)
        self.ensure_tasks_for_workflow(db, wf)
        db.refresh(wf)
        return wf

    def mark_complete(self, db: Session, workflow_id: str, user: User, payload: MarkCompleteRequest) -> WorkflowModel:
        wf = self.get_workflow(db, workflow_id)
        if wf.current_role != user.role and user.role != UserRole.executive:
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
                or f"{completed_stage.value} completed for {wf.workflow_id}. {next_role.value.replace('_', ' ').title()} team can start now.",
                related_workflow_id=wf.workflow_id,
                target_role=next_role,
                alert_type=AlertType.success,
            )
        else:
            self._add_notification(
                db,
                message=HANDOFF_MESSAGES.get((completed_stage, next_stage), "Workflow completed."),
                related_workflow_id=wf.workflow_id,
                target_role=UserRole.executive,
                alert_type=AlertType.success,
            )
        self._audit(
            db,
            user.id,
            wf.id,
            "WORKFLOW_STAGE_COMPLETED",
            {
                "role": user.role.value,
                "workflow_id": wf.workflow_id,
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
                        NotificationModel.related_workflow_id == wf.workflow_id,
                        NotificationModel.type == AlertType.warning,
                        NotificationModel.message.ilike("%Due date reached%"),
                    )
                )
            )
            if not exists:
                self._add_notification(
                    db,
                    message=f"Due date reached for workflow {wf.workflow_id} (shipment {wf.shipment_id}). Please update status or escalate.",
                    related_workflow_id=wf.workflow_id,
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
        total = db.scalar(select(func.count(WorkflowModel.id))) or 0
        completed = db.scalar(select(func.count(WorkflowModel.id)).where(WorkflowModel.current_stage == WorkflowStage.closed)) or 0
        delayed = db.scalar(select(func.count(WorkflowModel.id)).where(WorkflowModel.status == WorkflowStatus.delayed)) or 0
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
            q = q.where(WorkflowModel.workflow_id == workflow_public_id)
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
                    "workflow_id": wf.workflow_id if wf else None,
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


engine = WorkflowEngine()
