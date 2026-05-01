from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

UTC = timezone.utc

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.security import require_role
from app.data.india_locations import default_demo_corridor_cities, india_cities_reference, resolve_india_city
from app.db.session import get_db
from app.models.entities import RouteModel, ShipmentModel, UserModel
from app.services.routing_geometry import build_simulated_road_polyline, densify_sparse_polyline, try_mapbox_driving_polyline
from app.schemas.workflow_system import (
    AuditLog,
    AuditTrailItem,
    AddRemarkRequest,
    ChecklistPatchRequest,
    ChecklistPatchResponse,
    CreateWorkflowRequest,
    DecisionInsight,
    InventoryDomainPatch,
    MarkCompleteRequest,
    Notification,
    RouteDomainPatch,
    StageStatusRequest,
    SupplierDomainPatch,
    User,
    UserRole,
    WorkflowItem,
    WorkflowShipmentDetails,
    WorkflowStageUpdate,
    WorkflowUpdateRequest,
    RouteRecommendationRequest,
    RouteRecommendationResponse,
    SelectRouteRequest,
    SelectRouteResponse,
    RerouteRequest,
    WorkflowTaskItem,
    WorkflowTasksResponse,
    WorkflowTaskUpdateRequest,
    workflow_item_from_model,
)
from app.services.workflow_engine import engine
from app.services.scenario_simulation_service import simulate_scenario
from app.services.forecast_service import build_demo_forecast
from app.services.inventory_intelligence import build_inventory_insights
from app.services.supplier_risk_service import build_supplier_risk
from app.services.decision_engine import evaluate_for_workflow, evaluate_global_snapshot
from app.services.route_recommendation_engine import recommend_routes, select_route_for_workflow

router = APIRouter()


def _timeline_pub(wf_label: str, stages: list) -> list[WorkflowStageUpdate]:
    return [
        WorkflowStageUpdate(
            id=s.id,
            item_name=wf_label,
            stage_name=s.stage_name,
            role=s.role,
            updated_by_user_id=s.updated_by_user_id,
            previous_status=s.previous_status,
            new_status=s.new_status,
            remark=s.remark,
            started_at=s.started_at,
            completed_at=s.completed_at,
            created_at=s.created_at,
        )
        for s in stages
    ]


def _latlng_along_path(path: list, progress_pct: float) -> tuple[float, float]:
    pts: list[tuple[float, float]] = []
    for c in path:
        if isinstance(c, dict):
            lat = float(c.get("lat", c.get("latitude", 0)))
            lng = float(c.get("lng", c.get("longitude", 0)))
        else:
            lat = float(getattr(c, "lat", 0))
            lng = float(getattr(c, "lng", 0))
        pts.append((lat, lng))
    if len(pts) < 2:
        return pts[0] if pts else (20.5937, 78.9629)
    n = len(pts)
    f = max(0.0, min(100.0, float(progress_pct))) / 100.0 * (n - 1)
    i = int(math.floor(f))
    t = f - i
    if i >= n - 1:
        return pts[-1]
    la, ln = pts[i]
    lb, lc = pts[i + 1]
    return la + (lb - la) * t, ln + (lc - ln) * t


def _path_for_shipment(db: Session, shipment: ShipmentModel) -> list[dict[str, float]]:
    if shipment.selected_route_id:
        route = db.scalar(select(RouteModel).where(RouteModel.id == shipment.selected_route_id))
        if route and route.path_coordinates and len(route.path_coordinates) >= 2:
            return densify_sparse_polyline(
                list(route.path_coordinates),
                variant=abs(hash(route.route_code)) % 13,
            )
    a = resolve_india_city(shipment.source_location)
    b = resolve_india_city(shipment.destination_location)
    if a and b:
        mb = try_mapbox_driving_polyline(a.lat, a.lon, b.lat, b.lon)
        if mb:
            return mb
        return build_simulated_road_polyline(
            a.lat,
            a.lon,
            b.lat,
            b.lon,
            variant=abs(hash(shipment.shipment_id)) % 11,
            num_points=88,
        )
    o, d = default_demo_corridor_cities()
    mb = try_mapbox_driving_polyline(o.lat, o.lon, d.lat, d.lon)
    if mb:
        return mb
    return build_simulated_road_polyline(o.lat, o.lon, d.lat, d.lon, variant=3, num_points=88)


def _checkpoints_for_shipment(path: list, src_label: str, dst_label: str) -> list[dict[str, str]]:
    if len(path) >= 6:
        return [
            {"name": f"{src_label} — start", "status": "passed"},
            {"name": "Corridor mid-point", "status": "current"},
            {"name": f"{dst_label} — arrival", "status": "upcoming"},
        ]
    return [
        {"name": f"{src_label}", "status": "passed"},
        {"name": "In transit", "status": "current"},
        {"name": f"{dst_label}", "status": "upcoming"},
    ]


@router.get("/reference/india-cities")
def india_cities_list(user=Depends(get_current_user)) -> list[dict]:
    _ = user
    return india_cities_reference()


@router.get("/workflows", response_model=list[WorkflowItem])
def workflows(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
) -> list[WorkflowItem]:
    items = engine.workflows_for_role(db, user.role)
    needle = (q or "").strip().lower()
    if needle:

        def _matches_row(w):
            pn = (getattr(w, "product_name", None) or "").lower()
            rn = (getattr(w, "route_name", None) or "").lower()
            return (
                needle in (w.item_name or "").lower()
                or needle in pn
                or needle in rn
                or needle in w.source_location.lower()
                or needle in w.destination_location.lower()
            )

        items = [w for w in items if _matches_row(w)]

    engine.reconcile_workflows_list(db, items)

    return [workflow_item_from_model(w) for w in items]


@router.get("/workflows/pending", response_model=list[WorkflowItem])
def pending_tasks(user=Depends(get_current_user), db: Session = Depends(get_db)) -> list[WorkflowItem]:
    pend = engine.pending_for_user(db, user)
    engine.reconcile_workflows_list(db, pend)
    return [workflow_item_from_model(w) for w in pend]


def _can_view_workflow(user: User, wf) -> None:
    """Coordinated control tower: any signed-in team may load shared checklist/view state."""
    del user, wf


@router.get("/workflows/{item_name}/tasks", response_model=WorkflowTasksResponse)
def get_workflow_tasks(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)) -> WorkflowTasksResponse:
    wf = engine.get_workflow(db, item_name)
    _can_view_workflow(user, wf)
    wf, tasks = engine.list_workflow_tasks_for_user(db, item_name, user)
    name_by_id: dict[int, str] = {}
    ids = {t.completed_by_user_id for t in tasks if t.completed_by_user_id}
    if ids:
        for u in db.scalars(select(UserModel).where(UserModel.id.in_(ids))):
            name_by_id[u.id] = u.name
    out: list[WorkflowTaskItem] = []
    for t in tasks:
        can_edit = engine.user_can_edit_task(wf, t, user)
        out.append(
            WorkflowTaskItem(
                id=t.id,
                task_key=t.task_key,
                stage=t.stage,
                task_name=t.task_name,
                sort_order=t.sort_order,
                is_completed=t.is_completed,
                completed_at=t.completed_at,
                completed_by_user_id=t.completed_by_user_id,
                completed_by_name=name_by_id.get(t.completed_by_user_id) if t.completed_by_user_id else None,
                can_edit=can_edit,
            )
        )
    return WorkflowTasksResponse(
        item_name=wf.item_name,
        workflow_id=wf.id,
        current_stage=wf.current_stage,
        current_role=wf.current_role,
        sync_version=int(getattr(wf, "sync_version", 0) or 0),
        tasks=out,
    )


@router.patch("/workflows/{item_name}/tasks/{task_key}", response_model=WorkflowTaskItem)
def update_workflow_task(
    item_name: str,
    task_key: str,
    payload: WorkflowTaskUpdateRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowTaskItem:
    task = engine.set_workflow_task_completed(db, item_name, task_key, user, payload.completed, remarks=payload.remarks or None)
    wf = engine.get_workflow(db, item_name)
    name = None
    if task.completed_by_user_id:
        u = db.scalar(select(UserModel).where(UserModel.id == task.completed_by_user_id))
        name = u.name if u else None
    return WorkflowTaskItem(
        id=task.id,
        task_key=task.task_key,
        stage=task.stage,
        task_name=task.task_name,
        sort_order=task.sort_order,
        is_completed=task.is_completed,
        completed_at=task.completed_at,
        completed_by_user_id=task.completed_by_user_id,
        completed_by_name=name,
        can_edit=engine.user_can_edit_task(wf, task, user),
    )


@router.patch("/workflows/{workflow_ref}/stage-status", response_model=WorkflowItem)
def patch_workflow_stage_status(
    workflow_ref: str,
    payload: StageStatusRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowItem:
    wf0 = engine.get_workflow(db, workflow_ref)
    _can_view_workflow(user, wf0)
    engine.set_lane_stage_status(db, workflow_ref, payload.stage, user, completed=payload.completed, remarks=payload.remarks)
    wf = engine.sync_workflow_holder_with_stage(db, workflow_ref)
    return workflow_item_from_model(wf)


@router.get("/workflows/{item_name}", response_model=WorkflowItem)
def workflow_by_identifier(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)) -> WorkflowItem:
    wf = engine.sync_workflow_holder_with_stage(db, item_name)
    _can_view_workflow(user, wf)
    return workflow_item_from_model(wf)


@router.get("/decision", response_model=DecisionInsight)
def decision_aggregate(
    item_name: str | None = Query(default=None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DecisionInsight:
    """Control Tower: synthesized guidance from workflows + forecasts + signals."""
    if item_name:
        wf = engine.get_workflow(db, item_name)
        _can_view_workflow(user, wf)
        return evaluate_for_workflow(db, wf)
    return evaluate_global_snapshot(db)


@router.patch("/workflows/{item_name}/control/supplier", response_model=WorkflowItem)
def patch_supplier_control(
    item_name: str,
    payload: SupplierDomainPatch,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowItem:
    wf = engine.patch_supplier_domain(db, item_name, user, payload)
    return workflow_item_from_model(wf)


@router.patch("/workflows/{item_name}/control/route", response_model=WorkflowItem)
def patch_route_control(
    item_name: str,
    payload: RouteDomainPatch,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowItem:
    wf = engine.patch_route_domain(db, item_name, user, payload)
    return workflow_item_from_model(wf)


@router.patch("/workflows/{item_name}/control/inventory", response_model=WorkflowItem)
def patch_inventory_control(
    item_name: str,
    payload: InventoryDomainPatch,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowItem:
    wf = engine.patch_inventory_domain(db, item_name, user, payload)
    return workflow_item_from_model(wf)


@router.get("/workflows/{item_name}/timeline", response_model=list[WorkflowStageUpdate])
def workflow_timeline_legacy(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)) -> list[WorkflowStageUpdate]:
    wf = engine.get_workflow(db, item_name)
    _can_view_workflow(user, wf)
    stages = engine.get_timeline(db, wf)
    return _timeline_pub(wf.item_name, stages)


@router.get("/workflows/{item_name}/control-timeline")
def workflow_timeline_control_tower(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    wf = engine.get_workflow(db, item_name)
    _can_view_workflow(user, wf)
    return engine.get_unified_timeline(db, wf)


@router.post("/workflows/{item_name}/remark")
def add_workflow_remark(
    item_name: str, payload: AddRemarkRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    return engine.add_remark(db, item_name, user, payload.remark)


@router.get("/workflows/{item_name}/shipment", response_model=WorkflowShipmentDetails)
def workflow_shipment_details(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)) -> WorkflowShipmentDetails:
    wf = engine.get_workflow(db, item_name)
    _can_view_workflow(user, wf)
    return engine.shipment_details_for_workflow(db, item_name)


@router.get("/workflows/{item_name}/audit", response_model=list[AuditLog])
def workflow_audit_preview(item_name: str, user=Depends(get_current_user), db: Session = Depends(get_db)) -> list[AuditLog]:
    wf = engine.get_workflow(db, item_name)
    if user.role != UserRole.executive and wf.current_role != user.role and wf.assigned_role != user.role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot view this workflow audit trail.")
    rows = engine.audit_logs_for_workflow(db, item_name, limit=20)
    return [
        AuditLog(
            id=log.id,
            user_id=log.user_id,
            item_name=wf.item_name,
            action_type=log.action_type,
            module_name=log.module_name,
            details=log.details,
            created_at=log.created_at,
        )
        for log in rows
    ]


@router.post("/workflows", response_model=WorkflowItem)
@router.post("/workflow/create", response_model=WorkflowItem)
def workflow_create(payload: CreateWorkflowRequest, user=Depends(get_current_user), db: Session = Depends(get_db)) -> WorkflowItem:
    wf = engine.create_workflow(db, user, payload)
    return workflow_item_from_model(wf)


@router.patch("/workflows/{workflow_ref}/checklist", response_model=ChecklistPatchResponse)
def patch_workflow_checklist(
    workflow_ref: str,
    payload: ChecklistPatchRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChecklistPatchResponse:
    out = engine.patch_team_checklist(
        db,
        workflow_ref,
        user,
        role_token=payload.role,
        field=payload.field,
        completed=payload.completed,
        remarks=payload.remarks,
        expected_sync_version=payload.expected_sync_version,
    )
    return ChecklistPatchResponse(**out)


@router.patch("/workflows/{item_name}/status", response_model=WorkflowItem)
def update_workflow_status(
    item_name: str, payload: WorkflowUpdateRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
) -> WorkflowItem:
    wf = engine.update_status(db, item_name, user, payload)
    return workflow_item_from_model(wf)


@router.post("/workflows/{item_name}/complete", response_model=WorkflowItem)
def mark_stage_complete(
    item_name: str, payload: MarkCompleteRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
) -> WorkflowItem:
    wf = engine.mark_complete(db, item_name, user, payload)
    return workflow_item_from_model(wf)


@router.get("/notifications", response_model=list[Notification])
def notifications(user=Depends(get_current_user), db: Session = Depends(get_db)) -> list[Notification]:
    return engine.notifications_for_user(db, user)


@router.get("/notifications/unread-count")
def notifications_unread_count(user=Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, int]:
    count = engine.unread_notification_count(db, user)
    return {"unread": count}

@router.post("/notifications/{notification_id}/read", response_model=Notification)
def mark_notification_read(notification_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)) -> Notification:
    return engine.mark_notification_read(db, notification_id, user)


@router.post("/notifications/read-all")
def mark_all_notifications_read(user=Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, int]:
    count = engine.mark_all_notifications_read(db, user)
    return {"updated": count}

@router.get("/audit-trail", response_model=list[AuditTrailItem])
def audit_trail(
    role: UserRole | None = None,
    item_name: str | None = None,
    start: str | None = None,
    end: str | None = None,
    action_type: str | None = None,
    module_name: str | None = None,
    limit: int = 200,
    offset: int = 0,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AuditTrailItem]:
    require_role(user.role, [UserRole.executive, UserRole.operations, UserRole.inventory, UserRole.supplier_risk])
    return engine.audit_trail_query(
        db=db,
        role=role,
        workflow_public_id=item_name,
        start_iso=start,
        end_iso=end,
        action_type=action_type,
        module_name=module_name,
        limit=limit,
        offset=offset,
    )


@router.get("/dashboard/summary")
def role_dashboard_summary(user=Depends(get_current_user), db: Session = Depends(get_db)):
    summary = engine.workflow_summary(db)
    role_kpi = {
        UserRole.executive: ["On-time delivery", "Cost", "CO2", "Completion Rate"],
        UserRole.operations: ["Transit ETA", "Dispatch Compliance", "Delay Ratio", "Route Risk"],
        UserRole.inventory: ["Fill Rate", "Low Stock Alerts", "Rebalance Speed", "Stockout Risk"],
        UserRole.supplier_risk: ["Risk Score", "Delay Probability", "Mitigation SLA", "Escalation Count"],
    }
    return {"role": user.role, "summary": summary, "role_kpis": role_kpi[user.role]}


@router.get("/dashboards/{role}/summary")
def dashboard_summary_by_role(role: UserRole, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.executive and user.role != role:
        require_role(user.role, [role])
    summary = engine.workflow_summary(db)
    role_kpi = {
        UserRole.executive: ["On-time delivery", "Cost", "CO2", "Completion Rate"],
        UserRole.operations: ["Transit ETA", "Dispatch Compliance", "Delay Ratio", "Route Risk"],
        UserRole.inventory: ["Fill Rate", "Low Stock Alerts", "Rebalance Speed", "Stockout Risk"],
        UserRole.supplier_risk: ["Risk Score", "Delay Probability", "Mitigation SLA", "Escalation Count"],
    }
    return {"role": role, "summary": summary, "role_kpis": role_kpi[role]}


@router.get("/forecast")
def forecast_data(user=Depends(get_current_user)):
    _ = user
    result = build_demo_forecast(horizon_days=14)
    return {
        "horizon_days": result.horizon_days,
        "predicted_demand": result.predicted_demand,
        "confidence": result.confidence,
        "trend": result.trend,
        "recommended_action": result.recommended_action,
        "baseline_window": result.baseline_window,
        "spike_detected": result.spike_detected,
        "change_pct": result.change_pct,
    }


@router.get("/inventory-insights")
def inventory_insights(user=Depends(get_current_user)):
    _ = user
    fc = build_demo_forecast(horizon_days=14)
    return build_inventory_insights(fc)


@router.get("/supplier-risk")
def supplier_risk(user=Depends(get_current_user)):
    _ = user
    return build_supplier_risk()


@router.post("/scenario-simulation")
def scenario_simulation(payload: dict, user=Depends(get_current_user)):
    _ = user
    scenario = payload.get("scenario", "supplier_delay")
    return simulate_scenario(scenario)


@router.post("/route-recommendations", response_model=RouteRecommendationResponse)
def route_recommendations(payload: dict, user=Depends(require_roles([UserRole.executive, UserRole.operations])), db: Session = Depends(get_db)):
    source = payload.get("source_location") or payload.get("source") or "Bengaluru"
    destination = payload.get("destination_location") or payload.get("destination") or "Chennai"
    req = RouteRecommendationRequest(
        source_location=source,
        destination_location=destination,
        shipment_quantity=payload.get("shipment_quantity", 1),
        priority=payload.get("priority", "Medium"),
        shipment_type=payload.get("shipment_type", "general"),
        delivery_deadline=payload.get("delivery_deadline"),
        preferred_mode=payload.get("preferred_mode"),
        carrier_constraints=payload.get("carrier_constraints") or [],
        co2_preference=payload.get("co2_preference", 0.5),
        cost_preference=payload.get("cost_preference", 0.5),
    )
    return recommend_routes(
        db=db,
        source_location=req.source_location,
        destination_location=req.destination_location,
        shipment_quantity=req.shipment_quantity,
        priority=req.priority,
        shipment_type=req.shipment_type,
        delivery_deadline_iso=req.delivery_deadline,
        preferred_mode=req.preferred_mode,
        carrier_constraints=req.carrier_constraints,
        co2_preference=req.co2_preference,
        cost_preference=req.cost_preference,
    )


@router.post("/workflows/{item_name}/routes/select", response_model=SelectRouteResponse)
def select_route(item_name: str, payload: SelectRouteRequest, user=Depends(get_current_user), db: Session = Depends(get_db)) -> SelectRouteResponse:
    if user.role == UserRole.executive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executive is view-only; operations selects routes.")
    wf = engine.get_workflow(db, item_name)
    if user.role != UserRole.executive and wf.current_role != user.role and wf.assigned_role != user.role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot select a route for this workflow.")
    res = select_route_for_workflow(db, item_name, payload.route_code)
    engine.log_audit_event(
        db,
        user=user,
        workflow_ref=item_name,
        action_type="ROUTE_SELECTED",
        module_name="route_recommendation",
        payload={"selected_route_code": payload.route_code},
    )
    db.commit()
    return res


@router.post("/workflows/{item_name}/routes/reroute", response_model=RouteRecommendationResponse)
def reroute_recommendation(
    item_name: str, payload: RerouteRequest, user=Depends(get_current_user), db: Session = Depends(get_db)
) -> RouteRecommendationResponse:
    if user.role == UserRole.executive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Executive is view-only; operations requests reroutes.")
    wf = engine.get_workflow(db, item_name)
    if user.role != UserRole.executive and wf.current_role != user.role and wf.assigned_role != user.role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role cannot request reroute for this workflow.")
    engine.log_audit_event(
        db,
        user=user,
        workflow_ref=item_name,
        action_type="REROUTE_RECOMMENDED",
        module_name="route_recommendation",
        payload={"disruption_event": payload.disruption_event, "force": payload.force},
    )
    db.commit()
    shipment = db.scalar(select(ShipmentModel).where(ShipmentModel.workflow_id == wf.id))
    qty = max(120, min(2000, int((hash(shipment.shipment_id) % 1600) + 200))) if shipment else 800
    # Disruption mode: increase risk estimates and re-rank.
    return recommend_routes(
        db=db,
        source_location=wf.source_location,
        destination_location=wf.destination_location,
        shipment_quantity=qty,
        priority=wf.priority,
        shipment_type="reroute",
        delivery_deadline_iso=wf.due_date.isoformat() if wf.due_date else None,
        preferred_mode=None,
        carrier_constraints=[],
        co2_preference=0.5,
        cost_preference=0.5,
        disruption_override=True,
    )


@router.get("/shipments/live-tracking/{shipment_id}")
def live_tracking(shipment_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _ = user
    now = datetime.now(UTC)
    shipment = db.scalar(select(ShipmentModel).where(ShipmentModel.shipment_id == shipment_id))
    if shipment:
        path = _path_for_shipment(db, shipment)
        lat, lng = _latlng_along_path(path, float(shipment.progress_percent))
        src = resolve_india_city(shipment.source_location)
        dst = resolve_india_city(shipment.destination_location)
        src_l = src.display_name if src else shipment.source_location
        dst_l = dst.display_name if dst else shipment.destination_location
        checkpoints = _checkpoints_for_shipment(path, src_l, dst_l)
        return {
            "shipment_id": shipment.shipment_id,
            "status": shipment.current_status,
            "progress_percent": shipment.progress_percent,
            "eta": shipment.eta.isoformat() if shipment.eta else (now + timedelta(hours=7)).isoformat(),
            "current_position": {"lat": lat, "lng": lng},
            "checkpoints": checkpoints,
        }
    o, d = default_demo_corridor_cities()
    demo_path = build_simulated_road_polyline(o.lat, o.lon, d.lat, d.lon, variant=1, num_points=80)
    lat, lng = _latlng_along_path(demo_path, 58.0)
    return {
        "shipment_id": shipment_id,
        "status": "in transit",
        "progress_percent": 58,
        "eta": (now + timedelta(hours=7)).isoformat(),
        "current_position": {"lat": lat, "lng": lng},
        "checkpoints": _checkpoints_for_shipment(demo_path, o.display_name, d.display_name),
    }


# --- Clean URL aliases (same handlers; easier for integrations) ---
@router.get("/kpi/{role}/summary")
def kpi_summary_alias(role: UserRole, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_summary_by_role(role, user, db)


@router.get("/workflow", response_model=list[WorkflowItem])
def workflow_list_alias(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
) -> list[WorkflowItem]:
    items = engine.workflows_for_role(db, user.role)
    needle = (q or "").strip().lower()
    if needle:

        def _matches_row(w):
            pn = (getattr(w, "product_name", None) or "").lower()
            rn = (getattr(w, "route_name", None) or "").lower()
            return (
                needle in (w.item_name or "").lower()
                or needle in pn
                or needle in rn
                or needle in w.source_location.lower()
                or needle in w.destination_location.lower()
            )

        items = [w for w in items if _matches_row(w)]

    return [workflow_item_from_model(w) for w in items]
