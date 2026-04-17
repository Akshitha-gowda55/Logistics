from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AlertType, UserRole, WorkflowStage, WorkflowStatus


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class WorkflowModel(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    shipment_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="Medium", index=True, nullable=False)
    source_location: Mapped[str] = mapped_column(String(120), nullable=False)
    destination_location: Mapped[str] = mapped_column(String(120), nullable=False)
    current_stage: Mapped[WorkflowStage] = mapped_column(Enum(WorkflowStage), default=WorkflowStage.planning, index=True, nullable=False)
    current_role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.executive, index=True, nullable=False)
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.executive, index=True, nullable=False)
    status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), default=WorkflowStatus.pending, index=True, nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    remarks: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_user: Mapped[UserModel | None] = relationship("UserModel", foreign_keys=[assigned_user_id])
    tasks: Mapped[list["WorkflowTaskModel"]] = relationship(
        "WorkflowTaskModel",
        back_populates="workflow",
        order_by="WorkflowTaskModel.sort_order",
    )


class WorkflowTaskModel(Base):
    """Per-stage checklist items for checkbox-based execution (SmartFlow workflow)."""

    __tablename__ = "workflow_tasks"
    __table_args__ = (UniqueConstraint("workflow_id", "task_key", name="uq_workflow_task_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), index=True, nullable=False)
    task_key: Mapped[str] = mapped_column(String(80), nullable=False)
    stage: Mapped[WorkflowStage] = mapped_column(Enum(WorkflowStage), index=True, nullable=False)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    workflow: Mapped["WorkflowModel"] = relationship("WorkflowModel", back_populates="tasks")
    completed_by: Mapped[UserModel | None] = relationship("UserModel", foreign_keys=[completed_by_user_id])


class WorkflowStageUpdateModel(Base):
    __tablename__ = "workflow_stage_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), index=True, nullable=False)
    stage_name: Mapped[WorkflowStage] = mapped_column(Enum(WorkflowStage), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    updated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    previous_status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), nullable=False)
    new_status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), nullable=False)
    remark: Mapped[str] = mapped_column(Text, default="", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    workflow: Mapped[WorkflowModel] = relationship("WorkflowModel")


class NotificationModel(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    target_role: Mapped[UserRole | None] = mapped_column(Enum(UserRole), index=True, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[AlertType] = mapped_column(Enum(AlertType), default=AlertType.info, nullable=False)
    related_workflow_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SupplierModel(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str] = mapped_column(String(80), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    average_delay_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    disruption_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False)


class InventoryModel(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    warehouse_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    warehouse_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_code: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stock_level: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    reorder_point: Mapped[int] = mapped_column(Integer, nullable=False)
    excess_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shortage_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class RouteModel(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    route_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    source_location: Mapped[str] = mapped_column(String(120), nullable=False)
    destination_location: Mapped[str] = mapped_column(String(120), nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    expected_time_hours: Mapped[float] = mapped_column(Float, nullable=False)
    route_cost: Mapped[float] = mapped_column(Float, nullable=False)
    co2_estimate: Mapped[float] = mapped_column(Float, nullable=False)
    disruption_risk: Mapped[str] = mapped_column(String(20), default="low", nullable=False)
    active_status: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    path_coordinates: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)


class RouteReliabilityModel(Base):
    __tablename__ = "route_reliability_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True, nullable=False)
    carrier_name: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    on_time_rate: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1
    disruption_rate: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1
    capacity_utilization: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1
    sample_size: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    route: Mapped[RouteModel] = relationship("RouteModel")


class ShipmentModel(Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shipment_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    workflow_id: Mapped[int] = mapped_column(ForeignKey("workflows.id"), nullable=False)
    source_location: Mapped[str] = mapped_column(String(120), nullable=False)
    destination_location: Mapped[str] = mapped_column(String(120), nullable=False)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_status: Mapped[str] = mapped_column(String(40), default="not_started", nullable=False)
    eta: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    selected_route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), nullable=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    workflow_id: Mapped[int | None] = mapped_column(ForeignKey("workflows.id"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    module_name: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
