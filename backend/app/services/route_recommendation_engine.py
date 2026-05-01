from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

UTC = timezone.utc
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data.india_locations import resolve_india_city
from app.models.entities import RouteModel, RouteReliabilityModel, ShipmentModel, WorkflowModel
from app.services.india_synthetic_routes import build_synthetic_routes, merge_db_and_synthetic
from app.services.road_routing import triple_road_profiles
from app.services.routing_geometry import densify_sparse_polyline


Mode = Literal["road", "rail", "air", "sea", "multimodal"]
Priority = Literal["Low", "Medium", "High", "Critical"]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _norm_minmax(value: float, min_v: float, max_v: float, invert: bool = False) -> float:
    if max_v <= min_v:
        return 1.0
    x = (value - min_v) / (max_v - min_v)
    x = _clamp(x, 0.0, 1.0)
    return 1.0 - x if invert else x


def _risk_to_prob(label: str) -> float:
    l = (label or "low").lower()
    if "critical" in l:
        return 0.7
    if "high" in l:
        return 0.45
    if "medium" in l:
        return 0.22
    return 0.08


@dataclass
class CandidateRoute:
    route_db: RouteModel
    mode: Mode
    carrier: str
    reliability: float  # 0..1
    delay_probability: float  # 0..1
    disruption_probability: float  # 0..1
    capacity_units: int


def _infer_mode(route_code: str) -> Mode:
    c = (route_code or "").upper()
    if "-AIR" in c:
        return "air"
    if "-RAIL" in c:
        return "rail"
    if "-SEA" in c:
        return "sea"
    if "-MM" in c:
        return "multimodal"
    return "road"


def _carrier_for(mode: Mode, disruption_risk: str) -> str:
    r = (disruption_risk or "low").lower()
    if mode == "air":
        return "SkyFreight Express"
    if mode == "rail":
        return "RailLink Logistics"
    if mode == "sea":
        return "BluePort Shipping"
    if mode == "multimodal":
        return "OmniChain 3PL"
    if "high" in r or "critical" in r:
        return "ShieldHaul Premium"
    return "PrimeRoad Carriers"


def _reliability_from_history(perf: RouteReliabilityModel | None) -> float:
    if not perf:
        return 0.78
    # Reward on-time, penalize disruptions, penalize high utilization (capacity tightness).
    util_penalty = _clamp((perf.capacity_utilization - 0.75) / 0.25, 0.0, 1.0) * 0.12
    rel = (0.72 * perf.on_time_rate) + (0.28 * (1.0 - perf.disruption_rate)) - util_penalty
    return float(round(_clamp(rel, 0.2, 0.98), 3))


def _delay_from_history(base_delay: float, perf: RouteReliabilityModel | None) -> float:
    if not perf:
        return base_delay
    # Better on-time reduces delay probability; tight capacity increases it.
    util_bump = _clamp((perf.capacity_utilization - 0.75) / 0.25, 0.0, 1.0) * 0.12
    adj = base_delay - (perf.on_time_rate - 0.8) * 0.22 + util_bump + (perf.disruption_rate * 0.15)
    return float(round(_clamp(adj, 0.04, 0.92), 3))


def _route_attrs(route: RouteModel, qty: int, priority: Priority, perf: RouteReliabilityModel | None) -> CandidateRoute:
    mode = _infer_mode(route.route_code)
    carrier = _carrier_for(mode, route.disruption_risk)

    # Reliability and probabilities are derived deterministically from DB fields.
    disruption_p = _risk_to_prob(route.disruption_risk)
    # Delay probability rises with time + cost complexity + priority sensitivity.
    time_factor = _clamp(route.expected_time_hours / 36.0, 0.0, 1.0)
    cost_factor = _clamp(route.route_cost / 6500.0, 0.0, 1.0)
    prio_factor = 0.05 if priority in ("Low", "Medium") else 0.12
    qty_factor = _clamp(qty / 1200.0, 0.0, 1.0) * 0.08
    base_delay = _clamp((0.10 + (0.18 * time_factor) + (0.10 * cost_factor) + prio_factor + qty_factor + (0.12 * disruption_p)), 0.05, 0.88)
    delay_p = _delay_from_history(base_delay, perf)

    reliability = _reliability_from_history(perf)

    # Capacity is a demo constraint: air has lower; rail/sea higher.
    capacity_units = 400 if mode == "air" else 900 if mode == "road" else 1400 if mode == "rail" else 1700 if mode == "sea" else 1200

    return CandidateRoute(
        route_db=route,
        mode=mode,
        carrier=carrier,
        reliability=float(round(reliability, 3)),
        delay_probability=float(round(delay_p, 3)),
        disruption_probability=float(round(disruption_p, 3)),
        capacity_units=int(capacity_units),
    )


def _ensure_route_persisted(db: Session, route: RouteModel) -> RouteModel:
    existing = db.scalar(select(RouteModel).where(RouteModel.route_code == route.route_code))
    if existing:
        return existing
    db.add(route)
    db.flush()
    has_rel = db.scalar(select(RouteReliabilityModel.id).where(RouteReliabilityModel.route_id == route.id).limit(1))
    if not has_rel:
        db.add(
            RouteReliabilityModel(
                route_id=route.id,
                carrier_name="PrimeRoad Carriers",
                on_time_rate=0.86,
                disruption_rate=0.08,
                capacity_utilization=0.74,
                sample_size=40,
            )
        )
    return route


def _db_routes_matching_od(db: Session, origin_display: str, dest_display: str) -> list[RouteModel]:
    o0 = origin_display.split()[0]
    d0 = dest_display.split()[0]
    q1 = list(
        db.scalars(
            select(RouteModel).where(
                RouteModel.active_status.is_(True),
                RouteModel.source_location.ilike(f"%{o0}%"),
                RouteModel.destination_location.ilike(f"%{d0}%"),
            )
        )
    )
    if q1:
        return list(q1)
    return list(
        db.scalars(
            select(RouteModel).where(
                RouteModel.active_status.is_(True),
                RouteModel.source_location.ilike(f"%{origin_display[:4]}%"),
                RouteModel.destination_location.ilike(f"%{dest_display[:4]}%"),
            )
        )
    )


def recommend_routes(
    db: Session,
    source_location: str,
    destination_location: str,
    shipment_quantity: int,
    priority: Priority,
    shipment_type: str,
    delivery_deadline_iso: str | None,
    preferred_mode: Mode | None,
    carrier_constraints: list[str] | None,
    co2_preference: float,
    cost_preference: float,
    disruption_override: bool = False,
) -> dict:
    qty = max(1, int(shipment_quantity or 1))
    carrier_constraints = carrier_constraints or []

    origin = resolve_india_city(source_location)
    dest = resolve_india_city(destination_location)
    if not origin or not dest:
        missing = []
        if not origin:
            missing.append("source")
        if not dest:
            missing.append("destination")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "unknown_india_location",
                "fields": missing,
                "message": "Use a known Indian city, state capital, or hub name (e.g. Mumbai, Bengaluru, Delhi, Kochi).",
            },
        )
    if origin.id == dest.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "same_origin_destination", "message": "Source and destination must be different places."},
        )

    db_routes = _db_routes_matching_od(db, origin.display_name, dest.display_name)
    synthetic = build_synthetic_routes(origin, dest)
    merged = merge_db_and_synthetic(db_routes, synthetic)
    routes = [_ensure_route_persisted(db, r) for r in merged]
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    route_ids = [r.id for r in routes]
    perf_rows = list(db.scalars(select(RouteReliabilityModel).where(RouteReliabilityModel.route_id.in_(route_ids))))
    perf_by_route: dict[int, RouteReliabilityModel] = {p.route_id: p for p in perf_rows}

    candidates = [_route_attrs(r, qty, priority, perf_by_route.get(r.id)) for r in routes]

    # Apply disruption override to trigger reroute behavior.
    if disruption_override:
        for c in candidates:
            c.disruption_probability = float(round(_clamp(c.disruption_probability + 0.15, 0.0, 0.95), 3))
            c.delay_probability = float(round(_clamp(c.delay_probability + 0.10, 0.0, 0.95), 3))
            c.reliability = float(round(_clamp(c.reliability - 0.08, 0.2, 0.98), 3))

    # Filter by capacity and preferred mode.
    feasible: list[CandidateRoute] = []
    for c in candidates:
        if qty > c.capacity_units:
            continue
        if preferred_mode and c.mode != preferred_mode:
            continue
        if carrier_constraints and c.carrier in carrier_constraints:
            continue
        feasible.append(c)
    if not feasible:
        feasible = candidates[:]

    times = [c.route_db.expected_time_hours for c in feasible]
    costs = [c.route_db.route_cost for c in feasible]
    co2s = [c.route_db.co2_estimate for c in feasible]
    delays = [c.delay_probability for c in feasible]
    disruptions = [c.disruption_probability for c in feasible]
    reliabilities = [c.reliability for c in feasible]

    min_t, max_t = min(times), max(times)
    min_c, max_c = min(costs), max(costs)
    min_co2, max_co2 = min(co2s), max(co2s)
    min_d, max_d = min(delays), max(delays)
    min_dr, max_dr = min(disruptions), max(disruptions)
    min_rel, max_rel = min(reliabilities), max(reliabilities)

    # Preference weights: (0..1) for cost and CO2; remaining emphasizes time + reliability.
    w_cost = _clamp(float(cost_preference or 0.5), 0.0, 1.0)
    w_co2 = _clamp(float(co2_preference or 0.5), 0.0, 1.0)
    w_time = 0.34
    w_risk = 0.22
    w_rel = 0.22

    scored: list[dict] = []
    for c in feasible:
        time_score = _norm_minmax(c.route_db.expected_time_hours, min_t, max_t, invert=True)
        cost_score = _norm_minmax(c.route_db.route_cost, min_c, max_c, invert=True)
        co2_score = _norm_minmax(c.route_db.co2_estimate, min_co2, max_co2, invert=True)
        delay_score = _norm_minmax(c.delay_probability, min_d, max_d, invert=True)
        disruption_score = _norm_minmax(c.disruption_probability, min_dr, max_dr, invert=True)
        rel_score = _norm_minmax(c.reliability, min_rel, max_rel, invert=False)

        risk_score = 0.6 * delay_score + 0.4 * disruption_score
        total = (
            (w_time * time_score)
            + (w_cost * cost_score)
            + (w_co2 * co2_score)
            + (w_risk * risk_score)
            + (w_rel * rel_score)
        )
        total = float(round(total, 4))

        explanation = []
        if time_score >= 0.7:
            explanation.append("This route is faster.")
        if cost_score >= 0.7:
            explanation.append("This route costs less.")
        if co2_score >= 0.7:
            explanation.append("Lower CO2 footprint")
        if risk_score >= 0.7:
            explanation.append("This route has lower delay risk.")
        if rel_score >= 0.7:
            explanation.append("Higher reliability based on risk profile")
        if not explanation:
            explanation.append("Balanced trade-off across time, cost, and risk")
        if priority in ("High", "Critical") and time_score >= 0.55 and "urgent" not in " ".join(explanation).lower():
            explanation.append("This route is better for urgent delivery")

        scored.append(
            {
                "route_code": c.route_db.route_code,
                "source_location": c.route_db.source_location,
                "destination_location": c.route_db.destination_location,
                "mode": c.mode,
                "carrier_suggestion": c.carrier,
                "eta_hours": float(c.route_db.expected_time_hours),
                "distance_km": float(c.route_db.distance_km),
                "cost_usd": float(c.route_db.route_cost),  # Indian Rupees (₹); key name kept for clients
                "co2_kg": float(c.route_db.co2_estimate),
                "delay_probability": float(c.delay_probability),
                "delay_risk": "high" if c.delay_probability >= 0.45 else "medium" if c.delay_probability >= 0.22 else "low",
                "disruption_probability": float(c.disruption_probability),
                "disruption_risk": "high" if c.disruption_probability >= 0.45 else "medium" if c.disruption_probability >= 0.22 else "low",
                "reliability": float(c.reliability),
                "capacity_units": int(c.capacity_units),
                "score": total,
                "explanation": "; ".join(explanation),
                "path_coordinates": densify_sparse_polyline(
                    list(c.route_db.path_coordinates),
                    variant=abs(hash(c.route_db.route_code)) % 17,
                ),
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    if not scored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No route candidates could be built for this origin–destination pair.",
        )

    # Real road geometries (Best / Fast / Eco): OpenRouteService → GraphHopper → Mapbox → curved demo.
    try:
        road_profiles = triple_road_profiles(float(origin.lat), float(origin.lon), float(dest.lat), float(dest.lon))
        lane_specs = (
            ("recommended", "balanced", "Best route suggestion"),
            ("fastest", "fast", "Fast route suggestion"),
            ("shortest", "eco", "Eco route (shortest distance)"),
        )
        for i, (ors_key, lane_slug, lane_label) in enumerate(lane_specs):
            if i >= len(scored):
                break
            coords, geo_km, geo_hrs = road_profiles[ors_key]
            scored[i]["path_coordinates"] = densify_sparse_polyline(coords, variant=i + 7, min_points=24)
            old_km = float(scored[i]["distance_km"])
            old_eta = float(scored[i]["eta_hours"])
            if geo_km:
                scored[i]["distance_km"] = float(geo_km)
                if geo_hrs is None:
                    scored[i]["eta_hours"] = round(old_eta * ((float(geo_km) / max(1e-6, old_km)) ** 0.9), 2)
            if geo_hrs is not None:
                scored[i]["eta_hours"] = float(geo_hrs)
            scored[i]["route_lane"] = lane_slug
            scored[i]["explanation"] = f"{lane_label}. {scored[i]['explanation']}"
    except Exception:
        pass

    best = scored[0]
    alternates = scored[1:4]

    # Deadline handling (demo): warn in explanation if ETA exceeds remaining time.
    if delivery_deadline_iso:
        try:
            deadline = datetime.fromisoformat(delivery_deadline_iso.replace("Z", "+00:00"))
            remaining_h = max(0.0, (deadline - datetime.now(UTC)).total_seconds() / 3600.0)
            if best["eta_hours"] > remaining_h:
                best["explanation"] = f"{best['explanation']}; Deadline risk: ETA exceeds remaining time"
        except Exception:
            pass

    return {
        "inputs": {
            "source_location": source_location,
            "destination_location": destination_location,
            "shipment_quantity": qty,
            "priority": priority,
            "shipment_type": shipment_type,
            "delivery_deadline": delivery_deadline_iso,
            "preferred_mode": preferred_mode,
            "carrier_constraints": carrier_constraints,
            "co2_preference": w_co2,
            "cost_preference": w_cost,
        },
        "best_route": best,
        "alternates": alternates,
    }


def select_route_for_workflow(db: Session, workflow_ref: str, route_code: str) -> dict:
    ref = (workflow_ref or "").strip()
    wf = db.scalar(select(WorkflowModel).where(WorkflowModel.item_name == ref))
    if wf is None:
        wf = db.scalar(select(WorkflowModel).where(WorkflowModel.workflow_id == ref))
    if not wf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    if not wf.user_entered:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    shipment = db.scalar(select(ShipmentModel).where(ShipmentModel.workflow_id == wf.id))
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found for workflow")
    route = db.scalar(select(RouteModel).where(RouteModel.route_code == route_code, RouteModel.active_status.is_(True)))
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    shipment.selected_route_id = route.id
    shipment.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(shipment)
    return {"item_name": wf.item_name, "shipment_id": shipment.shipment_id, "selected_route_code": route.route_code}

