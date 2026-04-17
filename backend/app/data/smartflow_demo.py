from __future__ import annotations

from datetime import datetime, timedelta, timezone

UTC = timezone.utc

from app.core.security import hash_password
from app.schemas.workflow_system import (
    AlertType,
    AuditLog,
    Notification,
    User,
    UserRole,
    WorkflowItem,
    WorkflowStage,
    WorkflowStageUpdate,
    WorkflowStatus,
)

NOW = datetime.now(UTC)

USERS: list[User] = [
    User(id=1, name="Aarav Mehta", email="executive@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.executive, created_at=NOW),
    User(id=2, name="Priya Sharma", email="operations@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.operations, created_at=NOW),
    User(id=3, name="Rohan Kapoor", email="inventory@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.inventory, created_at=NOW),
    User(id=4, name="Neha Iyer", email="supplier@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.supplier_risk, created_at=NOW),
]

WORKFLOWS: list[WorkflowItem] = [
    WorkflowItem(
        id=1,
        workflow_id="WF-102",
        shipment_id="SHP-221",
        title="North Zone Electronics Replenishment",
        description="Move priority electronics from Mumbai DC to Delhi mega warehouse",
        priority="High",
        source_location="Mumbai DC",
        destination_location="Delhi WH-01",
        current_stage=WorkflowStage.operations,
        current_role=UserRole.operations,
        assigned_user_id=2,
        assigned_role=UserRole.operations,
        status=WorkflowStatus.in_progress,
        progress_percent=35,
        due_date=NOW + timedelta(days=2),
        created_at=NOW - timedelta(days=2),
        updated_at=NOW - timedelta(hours=2),
    ),
    WorkflowItem(
        id=2,
        workflow_id="WF-118",
        shipment_id="SHP-305",
        title="FMCG Safety Stock Recovery",
        description="Urgent stock balancing after demand spike in South region",
        priority="Critical",
        source_location="Bengaluru WH-03",
        destination_location="Chennai WH-07",
        current_stage=WorkflowStage.inventory,
        current_role=UserRole.inventory,
        assigned_user_id=3,
        assigned_role=UserRole.inventory,
        status=WorkflowStatus.assigned,
        progress_percent=62,
        due_date=NOW + timedelta(days=1),
        created_at=NOW - timedelta(days=3),
        updated_at=NOW - timedelta(hours=8),
    ),
    WorkflowItem(
        id=3,
        workflow_id="WF-125",
        shipment_id="SHP-355",
        title="Supplier Delay Mitigation",
        description="High-value pharma shipment delayed by tier-1 supplier",
        priority="Critical",
        source_location="Hyderabad Supplier Hub",
        destination_location="Pune Pharma DC",
        current_stage=WorkflowStage.supplier_risk,
        current_role=UserRole.supplier_risk,
        assigned_user_id=4,
        assigned_role=UserRole.supplier_risk,
        status=WorkflowStatus.delayed,
        progress_percent=78,
        due_date=NOW + timedelta(days=1),
        created_at=NOW - timedelta(days=4),
        updated_at=NOW - timedelta(hours=6),
    ),
]

STAGE_UPDATES: list[WorkflowStageUpdate] = [
    WorkflowStageUpdate(
        id=1,
        workflow_id="WF-102",
        stage_name=WorkflowStage.planning,
        role=UserRole.executive,
        updated_by_user_id=1,
        previous_status=WorkflowStatus.pending,
        new_status=WorkflowStatus.completed,
        remark="Approved urgent replenishment cycle",
        started_at=NOW - timedelta(days=2, hours=6),
        completed_at=NOW - timedelta(days=2, hours=4),
        created_at=NOW - timedelta(days=2, hours=4),
    ),
    WorkflowStageUpdate(
        id=2,
        workflow_id="WF-118",
        stage_name=WorkflowStage.operations,
        role=UserRole.operations,
        updated_by_user_id=2,
        previous_status=WorkflowStatus.in_progress,
        new_status=WorkflowStatus.completed,
        remark="Shipment delivered to warehouse gate",
        started_at=NOW - timedelta(days=1, hours=10),
        completed_at=NOW - timedelta(days=1, hours=1),
        created_at=NOW - timedelta(days=1, hours=1),
    ),
]

NOTIFICATIONS: list[Notification] = [
    Notification(
        id=1,
        target_role=UserRole.inventory,
        message="Operations completed shipment SHP-305. Inventory action required.",
        type=AlertType.warning,
        related_workflow_id="WF-118",
        created_at=NOW - timedelta(hours=8),
    ),
    Notification(
        id=2,
        target_role=UserRole.supplier_risk,
        message="Inventory updated warehouse status for SHP-221. Supplier review pending.",
        type=AlertType.info,
        related_workflow_id="WF-102",
        created_at=NOW - timedelta(hours=2),
    ),
]

AUDIT_LOGS: list[AuditLog] = [
    AuditLog(
        id=1,
        user_id=1,
        workflow_id="WF-102",
        action_type="WORKFLOW_APPROVED",
        module_name="workflow_engine",
        details="Planning stage approved and moved to operations",
        created_at=NOW - timedelta(days=2, hours=4),
    )
]
