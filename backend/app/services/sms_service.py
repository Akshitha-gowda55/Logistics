"""SMS notifications: Twilio when configured, otherwise structured logging (demo-safe)."""

from __future__ import annotations

import logging

from app.core.config import get_settings
from app.models.enums import UserRole, WorkflowStage

log = logging.getLogger(__name__)


def send_sms(phone: str | None, message: str) -> None:
    """Deliver SMS or log clearly for demos when no provider is configured."""
    settings = get_settings()
    recipient = (phone or "").strip() or "+18005550100"

    sid = settings.twilio_account_sid
    token = settings.twilio_auth_token
    from_no = settings.twilio_from_number
    if sid and token and from_no:
        try:
            from twilio.rest import Client  # type: ignore import-not-found

            client = Client(sid, token)
            client.messages.create(body=message[:1530], from_=from_no, to=recipient)
            log.info("SMS queued to %s", recipient[:6] + "…")
            return
        except Exception as e:
            log.warning("Twilio SMS failed (%s); falling back to log.", e)

    log.warning("SMS (demo mode) to %s: %s", recipient, message)


def phone_for_role(role: UserRole) -> str | None:
    settings = get_settings()
    mapping = {
        UserRole.operations: settings.sms_phone_operations,
        UserRole.inventory: settings.sms_phone_inventory,
        UserRole.supplier_risk: settings.sms_phone_supplier,
        UserRole.executive: settings.sms_phone_executive,
    }
    p = mapping.get(role)
    return (p or "").strip() or None


def send_sms_for_role(role: UserRole, message: str) -> None:
    send_sms(phone_for_role(role), message)


def send_checklist_handoff_sms(item_name: str, task_key: str, was_completed: bool, now_completed: bool) -> None:
    """Notify the next team only on selected hand-offs (false → true). No duplicates on reload or uncheck."""
    if not now_completed or was_completed:
        return
    nm = (item_name or "").strip() or "(shipment)"
    if task_key == "handed_to_operations":
        send_sms_for_role(UserRole.operations, f"{nm}: Supplier handed the load to you. Open Operations.")
    elif task_key == "reached_warehouse":
        send_sms_for_role(UserRole.inventory, f"{nm}: Delivery reached your site. Open Warehouse.")
    elif task_key == "workflow_completed":
        send_sms_for_role(UserRole.executive, f"{nm}: Warehouse marked the shipment finished. Review in Executive.")


def send_checkbox_transition_sms(item_name: str, task_key: str, was_completed: bool, now_completed: bool) -> None:
    """Deprecated for generic pings; kept for callers that still rely on demo logging."""
    send_checklist_handoff_sms(item_name, task_key, was_completed, now_completed)


def send_handoff_sms(item_name: str, completed_stage: WorkflowStage, next_stage: WorkflowStage) -> None:
    """Notify the next team when a step is handed off (single checkbox / mark complete)."""
    nm = (item_name or "").strip() or "(unnamed shipment)"

    if completed_stage == WorkflowStage.planning and next_stage != WorkflowStage.closed:
        send_sms_for_role(
            UserRole.supplier_risk,
            f"{nm}: Executive approved. Please confirm when parts ship.",
        )
        return

    if next_stage == WorkflowStage.closed:
        if completed_stage in (WorkflowStage.inventory, WorkflowStage.inventory_allocation):
            send_sms_for_role(
                UserRole.executive,
                f"{nm}: Stock received. Shipment completed.",
            )
        else:
            send_sms_for_role(
                UserRole.executive,
                f"{nm}: Shipment closed in the system.",
            )
        return

    if completed_stage in (WorkflowStage.supplier_risk, WorkflowStage.supplier_risk_check):
        send_sms_for_role(
            UserRole.operations,
            f"{nm}: Parts shipped. Please plan route and dispatch.",
        )
        return

    if completed_stage in (WorkflowStage.operations, WorkflowStage.operations_dispatch):
        send_sms_for_role(
            UserRole.inventory,
            f"{nm}: Shipment dispatched. Prepare warehouse receiving.",
        )
        return

    if completed_stage in (WorkflowStage.inventory, WorkflowStage.inventory_allocation):
        send_sms_for_role(
            UserRole.executive,
            f"{nm}: Stock received. Please confirm closure.",
        )


def log_startup_sms_mode() -> None:
    settings = get_settings()
    if settings.twilio_account_sid and settings.twilio_auth_token:
        log.info("SMS: Twilio is configured.")
    else:
        log.info("SMS: demo/logging mode — set TWILIO_* and SMS_PHONE_* in .env to send live texts.")
