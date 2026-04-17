from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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


class WorkflowItem(BaseModel):
    id: int
    workflow_id: str
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

    model_config = {"from_attributes": True}


class WorkflowStageUpdate(BaseModel):
    id: int
    workflow_id: str
    stage_name: WorkflowStage
    role: UserRole
    updated_by_user_id: int
    previous_status: WorkflowStatus
    new_status: WorkflowStatus
    remark: str
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


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
    id: int
    user_id: int | None = None
    target_role: UserRole | None = None
    message: str
    type: AlertType = AlertType.info
    related_workflow_id: str
    is_read: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLog(BaseModel):
    id: int
    user_id: int
    workflow_id: str | None = None
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
    workflow_id: str | None = None
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
    workflow_id: str
    current_stage: WorkflowStage
    current_role: UserRole
    tasks: list[WorkflowTaskItem]


class WorkflowTaskUpdateRequest(BaseModel):
    completed: bool


class CreateWorkflowRequest(BaseModel):
    workflow_id: str
    shipment_id: str
    title: str
    description: str = ""
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    source_location: str
    destination_location: str
    due_date: datetime | None = None
    assigned_operations_user_id: int | None = None
    remark: str = ""


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


class RouteRecommendationResponse(BaseModel):
    inputs: dict
    best_route: RouteRecommendationItem
    alternates: list[RouteRecommendationItem]


class SelectRouteRequest(BaseModel):
    route_code: str


class SelectRouteResponse(BaseModel):
    workflow_id: str
    shipment_id: str
    selected_route_code: str


class RerouteRequest(BaseModel):
    disruption_event: str = "disruption_detected"
    force: bool = True


