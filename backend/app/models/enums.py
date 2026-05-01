from enum import Enum


class UserRole(str, Enum):
    executive = "executive"
    operations = "operations"
    inventory = "inventory"
    supplier_risk = "supplier_risk"


class WorkflowStage(str, Enum):
    """Include legacy short names and expanded SmartFlow stage strings stored in older SQLite DBs."""

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


class AlertType(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"
    success = "success"
