from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


if TYPE_CHECKING:
    from app.models.entities import WorkflowModel as WorkflowModelORM


class UserRole(str, Enum):
    executive = "executive"
    operations = "operations"
    inventory = "inventory"
    supplier_risk = "supplier_risk"


class AlertType(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"
    success = "success"


class WorkflowStage(str, Enum):
    planning = "planning"
    operations = "operations"
    inventory = "inventory"
    supplier_risk = "supplier_risk"
    closed = "closed"
    executive_planning = "executive_planning"
    operations_dispatch = "operations_dispatch"
    supplier_risk_check = "supplier_risk_check"
    inventory_allocation = "inventory_allocation"
    delivery_completion = "delivery_completion"
    executive_review = "executive_review"


class WorkflowStatus(str, Enum):
    pending = "Pending"
    assigned = "Assigned"
    in_progress = "In Progress"
    waiting_next = "Waiting for Next Team"
    delayed = "Delayed"
    escalated = "Escalated"
    completed = "Completed"
    closed = "Closed"


class User(BaseModel):
    id: int
    name: str
    email: EmailStr
    password_hash: str
    role: UserRole
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserPublic


class LogoutResponse(BaseModel):
    message: str


class TokenPayload(BaseModel):
    sub: str
    role: UserRole
    jti: str
    exp: int


class TimelineEntry(BaseModel):
    time: str
    role: str
    action: str
    remarks: str = ""
    sync_status: str = "synced"


class DecisionInsight(BaseModel):
    problem: str
    impact: str
    recommended_action: str
    priority: Literal["low", "medium", "high"]


class WorkflowItem(BaseModel):
    id: int
    item_name: str
    product_name: str | None = None
    route_name: str | None = None
    shipment_id: str
    title: str
    description: str
    priority: Literal["Low", "Medium", "High", "Critical"]
    source_location: str
    destination_location: str
    current_stage: WorkflowStage
    current_role: UserRole
    assigned_user_id: int | None
    assigned_role: UserRole
    status: WorkflowStatus
    progress_percent: int
    due_date: datetime | None = None
    remarks: str = ""
    final_outcome: str | None = None
    created_at: datetime
    updated_at: datetime
    supplier_status: str = "scheduled"
    route_status: str = "not_dispatched"
    inventory_status: str = "ok"
    executive_completed: bool = False
    supplier_completed: bool = False
    operations_completed: bool = False
    inventory_completed: bool = False
    material_type: str = ""
    quantity: float | None = None
    unit: str = ""
    supplier_party_name: str = ""
    supplier_party_location: str = ""
    sync_version: int = 0
    timeline: list[TimelineEntry] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SupplierDomainPatch(BaseModel):
    supplier_status: str = Field(..., description="e.g. shipped, delayed, unavailable")
    delay_reason: str = ""


class RouteDomainPatch(BaseModel):
    route_status: str = Field(..., description="e.g. dispatched, in_transit, delayed, delivered")
    remark: str = ""


class InventoryDomainPatch(BaseModel):
    inventory_status: str = Field(..., description="e.g. ok, low_stock, reorder_sent, critical")
    reorder_requested: bool = False
    remark: str = ""


def _normalize_priority_for_api(raw: object) -> Literal["Low", "Medium", "High", "Critical"]:
    s = str(raw or "Medium").strip()
    mapped = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}.get(s.lower())
    if mapped:
        return mapped  # type: ignore[return-value]
    if s in ("Low", "Medium", "High", "Critical"):
        return s  # type: ignore[return-value]
    return "Medium"


def workflow_item_from_model(wf: "WorkflowModelORM") -> WorkflowItem:
    """Maps ORM WorkflowModel.timeline_events JSON to API `timeline`."""
    raw = getattr(wf, "timeline_events", None)
    parsed: list[dict] = []
    if isinstance(raw, list):
        parsed = [x for x in raw if isinstance(x, dict)]
    elif isinstance(raw, str):
        import json

        try:
            v = json.loads(raw)
            if isinstance(v, list):
                parsed = [x for x in v if isinstance(x, dict)]
        except json.JSONDecodeError:
            parsed = []
    entries: list[TimelineEntry] = []
    for x in parsed:
        try:
            xc = dict(x)
            t = xc.get("time")
            if isinstance(t, datetime):
                xc["time"] = t.isoformat()
            elif t is not None and not isinstance(t, str):
                xc["time"] = str(t)
            if "sync_status" not in xc:
                xc["sync_status"] = "synced"
            entries.append(TimelineEntry.model_validate(xc))
        except Exception:
            continue
    return WorkflowItem(
        id=wf.id,
        item_name=(wf.item_name or "").strip() or wf.title,
        product_name=getattr(wf, "product_name", None),
        route_name=getattr(wf, "route_name", None),
        shipment_id=wf.shipment_id,
        title=wf.title,
        description=wf.description,
        priority=_normalize_priority_for_api(wf.priority),
        source_location=wf.source_location,
        destination_location=wf.destination_location,
        current_stage=wf.current_stage,
        current_role=wf.current_role,
        assigned_user_id=wf.assigned_user_id,
        assigned_role=wf.assigned_role,
        status=wf.status,
        progress_percent=wf.progress_percent,
        due_date=wf.due_date,
        remarks=wf.remarks,
        final_outcome=wf.final_outcome,
        created_at=wf.created_at,
        updated_at=wf.updated_at,
        supplier_status=getattr(wf, "supplier_status", None) or "scheduled",
        route_status=getattr(wf, "route_status", None) or "not_dispatched",
        inventory_status=getattr(wf, "inventory_status", None) or "ok",
        executive_completed=bool(getattr(wf, "executive_completed", False)),
        supplier_completed=bool(getattr(wf, "supplier_completed", False)),
        operations_completed=bool(getattr(wf, "operations_completed", False)),
        inventory_completed=bool(getattr(wf, "inventory_completed", False)),
        material_type=getattr(wf, "material_type", None) or "",
        quantity=float(wf.quantity) if getattr(wf, "quantity", None) is not None else None,
        unit=getattr(wf, "unit", None) or "",
        supplier_party_name=getattr(wf, "supplier_party_name", None) or "",
        supplier_party_location=getattr(wf, "supplier_party_location", None) or "",
        sync_version=int(getattr(wf, "sync_version", 0) or 0),
        timeline=entries,
    )


class WorkflowStageUpdate(BaseModel):
    id: int
    item_name: str
    stage_name: WorkflowStage
    role: UserRole
    updated_by_user_id: int
    previous_status: WorkflowStatus
    new_status: WorkflowStatus
    remark: str
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime


class AddRemarkRequest(BaseModel):
    remark: str = Field(min_length=1, max_length=2000)


class ShipmentRouteSummary(BaseModel):
    route_code: str
    distance_km: float
    eta_hours: float
    cost_usd: float = Field(..., description="Transport cost in Indian Rupees (₹); JSON key kept for compatibility.")
    co2_kg: float
    disruption_risk: str


class WorkflowShipmentDetails(BaseModel):
    shipment_id: str
    current_status: str
    progress_percent: int
    eta: str | None = None
    selected_route: ShipmentRouteSummary | None = None


class Notification(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int
    user_id: int | None = None
    target_role: UserRole | None = None
    message: str
    type: AlertType = AlertType.info
    related_item_name: str = Field(validation_alias="related_workflow_id")
    is_read: bool = False
    created_at: datetime


class AuditLog(BaseModel):
    id: int
    user_id: int
    item_name: str | None = None
    action_type: str
    module_name: str
    details: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditTrailItem(BaseModel):
    id: int
    user_id: int
    user_name: str | None = None
    user_role: UserRole | None = None
    item_name: str | None = None
    previous_status: str | None = None
    new_status: str | None = None
    action_type: str
    module_name: str
    remark: str | None = None
    details: str
    created_at: datetime


class WorkflowUpdateRequest(BaseModel):
    status: WorkflowStatus
    remark: str = ""


class MarkCompleteRequest(BaseModel):
    remark: str = ""


class WorkflowTaskItem(BaseModel):
    id: int
    task_key: str
    stage: WorkflowStage
    task_name: str
    sort_order: int
    is_completed: bool
    completed_at: datetime | None = None
    completed_by_user_id: int | None = None
    completed_by_name: str | None = None
    can_edit: bool


class WorkflowTasksResponse(BaseModel):
    item_name: str
    workflow_id: int = Field(description="Internal DB id — use for stable React keys with task id")
    current_stage: WorkflowStage
    current_role: UserRole
    sync_version: int = 0
    tasks: list[WorkflowTaskItem]


class WorkflowTaskUpdateRequest(BaseModel):
    completed: bool
    remarks: str = ""


class StageStatusRequest(BaseModel):
    """Update the active lane checkbox for one shipment (maps to the primary task for that stage)."""
    stage: str = Field(..., min_length=1, max_length=64, description="planning, supplier, supplier_risk, operations, or inventory")
    completed: bool
    remarks: str = ""


class CreateWorkflowRequest(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=255)
    product_name: str = ""
    route_name: str = ""
    shipment_id: str = ""
    title: str = ""
    description: str = ""
    material_type: str = ""
    quantity: float | None = None
    unit: str = ""
    supplier_name: str = ""
    supplier_location: str = ""
    priority: str = "Medium"
    source_location: str
    destination_location: str
    due_date: datetime | None = None
    required_date: datetime | None = None
    assigned_operations_user_id: int | None = None
    remark: str = ""
    remarks: str = ""


class ChecklistPatchRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=32)
    field: str = Field(..., min_length=1, max_length=80)
    completed: bool
    remarks: str = ""
    expected_sync_version: int | None = None


class ChecklistPatchResponse(BaseModel):
    success: bool
    workflow_id: str
    item_name: str
    updated_role: str
    field: str
    completed: bool
    next_team: str
    sync_version: int


class WorkflowSummary(BaseModel):
    total_workflows: int
    active_workflows: int
    completed_workflows: int
    delayed_workflows: int
    on_time_delivery_pct: float
    logistics_cost_musd: float = Field(
        ...,
        description="Network logistics cost in ₹ Crore (1.0 = ₹1 Cr); JSON key kept for compatibility.",
    )
    co2_tonnes: float
    workflow_completion_rate: float


class RouteRecommendationRequest(BaseModel):
    source_location: str
    destination_location: str
    shipment_quantity: int = 1
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    shipment_type: str = "general"
    delivery_deadline: str | None = None
    preferred_mode: Literal["road", "rail", "air", "sea", "multimodal"] | None = None
    carrier_constraints: list[str] = []
    co2_preference: float = 0.5
    cost_preference: float = 0.5


class RouteRecommendationItem(BaseModel):
    route_code: str
    source_location: str
    destination_location: str
    mode: str
    carrier_suggestion: str
    eta_hours: float
    distance_km: float
    cost_usd: float = Field(..., description="Route transport cost in Indian Rupees (₹); JSON key kept for compatibility.")
    co2_kg: float
    delay_probability: float
    delay_risk: str
    disruption_probability: float
    disruption_risk: str
    reliability: float
    capacity_units: int
    score: float
    explanation: str
    path_coordinates: list[dict] = []
    route_lane: str | None = Field(None, description="balanced | fast | eco when road API attached")


class RouteRecommendationResponse(BaseModel):
    inputs: dict
    best_route: RouteRecommendationItem
    alternates: list[RouteRecommendationItem]


class SelectRouteRequest(BaseModel):
    route_code: str


class SelectRouteResponse(BaseModel):
    item_name: str
    shipment_id: str
    selected_route_code: str


class RerouteRequest(BaseModel):
    disruption_event: str = "disruption_detected"
    force: bool = True


