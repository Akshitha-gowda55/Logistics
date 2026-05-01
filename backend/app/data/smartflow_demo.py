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

# Four canonical auto-part lines (mirrors fresh DB seed when present).
WORKFLOWS: list[WorkflowItem] = [
    WorkflowItem(
        id=1,
        item_name="Brakes",
        product_name="Auto parts — brakes",
        route_name="Pune Hub–Delhi Assembly",
        shipment_id="SHP-PART-01",
        title="Brakes — replenishment lane",
        description="Friction and hydraulic brake assemblies for final assembly.",
        priority="High",
        source_location="Pune Supplier Hub",
        destination_location="Delhi Assembly WH",
        current_stage=WorkflowStage.planning,
        current_role=UserRole.executive,
        assigned_user_id=1,
        assigned_role=UserRole.executive,
        status=WorkflowStatus.assigned,
        progress_percent=12,
        due_date=NOW + timedelta(days=3),
        remarks="Executive approval pending.",
        created_at=NOW - timedelta(days=1),
        updated_at=NOW - timedelta(hours=2),
    ),
    WorkflowItem(
        id=2,
        item_name="Tires",
        product_name="Auto parts — tires",
        route_name="Chennai–Mumbai",
        shipment_id="SHP-PART-02",
        title="Tires — outbound confirmation",
        description="Radial tire sets; supplier confirms outbound.",
        priority="Medium",
        source_location="Chennai Tire DC",
        destination_location="Mumbai Regional WH",
        current_stage=WorkflowStage.supplier_risk,
        current_role=UserRole.supplier_risk,
        assigned_user_id=4,
        assigned_role=UserRole.supplier_risk,
        status=WorkflowStatus.assigned,
        progress_percent=35,
        due_date=NOW + timedelta(days=2),
        remarks="Supplier ships when ready.",
        created_at=NOW - timedelta(days=2),
        updated_at=NOW - timedelta(hours=8),
    ),
    WorkflowItem(
        id=3,
        item_name="Steering wheel",
        product_name="Auto parts — steering",
        route_name="Hyderabad–Pune",
        shipment_id="SHP-PART-03",
        title="Steering wheels — dispatch leg",
        description="Steering assemblies in operations dispatch.",
        priority="Critical",
        source_location="Hyderabad Tier-2 Hub",
        destination_location="Pune Assembly Plant",
        current_stage=WorkflowStage.operations,
        current_role=UserRole.operations,
        assigned_user_id=2,
        assigned_role=UserRole.operations,
        status=WorkflowStatus.in_progress,
        progress_percent=52,
        due_date=NOW + timedelta(days=1),
        remarks="Route planning active.",
        created_at=NOW - timedelta(days=3),
        updated_at=NOW - timedelta(hours=3),
    ),
    WorkflowItem(
        id=4,
        item_name="Seats",
        product_name="Auto parts — seating",
        route_name="Bengaluru–Chennai",
        shipment_id="SHP-PART-04",
        title="Seats — warehouse receiving",
        description="Bench and seat trims for receiving.",
        priority="Medium",
        source_location="Bengaluru WH-07",
        destination_location="Chennai Assembly WH",
        current_stage=WorkflowStage.inventory,
        current_role=UserRole.inventory,
        assigned_user_id=3,
        assigned_role=UserRole.inventory,
        status=WorkflowStatus.assigned,
        progress_percent=68,
        due_date=NOW + timedelta(hours=20),
        remarks="Confirm stock when received.",
        created_at=NOW - timedelta(days=4),
        updated_at=NOW - timedelta(hours=12),
    ),
]

STAGE_UPDATES: list[WorkflowStageUpdate] = [
    WorkflowStageUpdate(
        id=1,
        item_name="Steering wheel",
        stage_name=WorkflowStage.planning,
        role=UserRole.executive,
        updated_by_user_id=1,
        previous_status=WorkflowStatus.pending,
        new_status=WorkflowStatus.completed,
        remark="Executive released steering-wheel line",
        started_at=NOW - timedelta(days=3, hours=4),
        completed_at=NOW - timedelta(days=3),
        created_at=NOW - timedelta(days=3),
    ),
    WorkflowStageUpdate(
        id=2,
        item_name="Seats",
        stage_name=WorkflowStage.operations,
        role=UserRole.operations,
        updated_by_user_id=2,
        previous_status=WorkflowStatus.in_progress,
        new_status=WorkflowStatus.completed,
        remark="Seats shipped toward Chennai dock",
        started_at=NOW - timedelta(hours=18),
        completed_at=NOW - timedelta(hours=8),
        created_at=NOW - timedelta(hours=8),
    ),
]

NOTIFICATIONS: list[Notification] = [
    Notification(
        id=1,
        target_role=UserRole.supplier_risk,
        message="Tires SHP-PART-02 awaiting outbound confirmation.",
        type=AlertType.info,
        related_workflow_id="WF-TIRE-01",
        created_at=NOW - timedelta(hours=4),
    ),
    Notification(
        id=2,
        target_role=UserRole.inventory,
        message="Seats SHP-PART-04 arriving — prepare receiving lane.",
        type=AlertType.warning,
        related_workflow_id="WF-SEAT-01",
        created_at=NOW - timedelta(hours=6),
    ),
]

AUDIT_LOGS: list[AuditLog] = [
    AuditLog(
        id=1,
        user_id=1,
        item_name="Brakes",
        action_type="WORKFLOW_CREATED",
        module_name="workflow_engine",
        details="Demo audit: brakes line seeded",
        created_at=NOW - timedelta(days=1),
    ),
]
