from enum import Enum


class UserRole(str, Enum):
    executive = "executive"
    operations = "operations"
    inventory = "inventory"
    supplier_risk = "supplier_risk"


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


class AlertType(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"
    success = "success"
