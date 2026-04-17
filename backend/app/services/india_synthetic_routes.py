"""Dynamic demo route geometry and metrics between any two resolved India cities."""

from __future__ import annotations

import math
import re
from typing import Literal

from app.data.india_locations import IndiaCity
from app.models.entities import RouteModel
from app.services.routing_geometry import (
    build_multileg_road_style,
    build_simulated_road_polyline,
    path_length_km,
    try_mapbox_driving_polyline,
)
from optimization_engine.co2 import Co2Model, leg_emissions
from optimization_engine.cost import CostModel, minimize_transport_cost
from optimization_engine.routing.optimizer import Site, _haversine_km

Mode = Literal["road", "rail", "air", "multimodal"]


def _site(lat: float, lon: float, label: str = "p") -> Site:
    return Site(label, label, lat, lon)


def _linear_latlng(
    o_lat: float,
    o_lng: float,
    d_lat: float,
    d_lng: float,
    steps: int,
    lateral_km: float = 0.0,
) -> list[dict[str, float]]:
    """Kept for legacy callers; prefer build_simulated_road_polyline for map display."""
    pts: list[dict[str, float]] = []
    dlat = d_lat - o_lat
    dlng = d_lng - o_lng
    perp_lat = -dlng * 0.00001 * lateral_km
    perp_lng = dlat * 0.00001 * lateral_km
    for i in range(steps):
        t = i / max(1, steps - 1)
        lat = o_lat + dlat * t + perp_lat * math.sin(t * math.pi)
        lng = o_lng + dlng * t + perp_lng * math.sin(t * math.pi)
        pts.append({"lat": round(lat, 5), "lng": round(lng, 5)})
    return pts


def _co2_along_path(path: list[dict[str, float]]) -> float:
    if len(path) < 2:
        return 10.0
    cm = Co2Model()
    sites = [_site(p["lat"], p["lng"], f"p{i}") for i, p in enumerate(path)]
    legs = list(zip(sites[:-1], sites[1:]))
    return round(sum(leg_emissions(_haversine_km(a, b), cm) for a, b in legs), 2)


def _route_code(origin: IndiaCity, dest: IndiaCity, mode: Mode, variant: str) -> str:
    """Deterministic code; mode segment allows merge with DB routes per mode."""
    slug = f"{mode.upper()}-{origin.id}-{dest.id}-{variant}"
    slug = re.sub(r"[^A-Za-z0-9-]", "", slug)
    return f"IND-{slug}"[:64]


def build_synthetic_routes(origin: IndiaCity, dest: IndiaCity) -> list[RouteModel]:
    """Up to four alternate routes with dense, road-like polylines (Mapbox when enabled)."""
    gc = max(50.0, round(_haversine_km(_site(origin.lat, origin.lon), _site(dest.lat, dest.lon)), 2))

    mb = try_mapbox_driving_polyline(origin.lat, origin.lon, dest.lat, dest.lon)
    road_path = mb if mb else build_simulated_road_polyline(origin.lat, origin.lon, dest.lat, dest.lon, variant=0, num_points=96)
    rail_path = build_multileg_road_style(origin.lat, origin.lon, dest.lat, dest.lon, variant=1, mid_frac=0.42, points_per_leg=50)
    air_path = build_simulated_road_polyline(
        origin.lat, origin.lon, dest.lat, dest.lon, variant=3, num_points=64, base_wiggle_km=10.0
    )
    mm_path = build_multileg_road_style(origin.lat, origin.lon, dest.lat, dest.lon, variant=5, mid_frac=0.55, points_per_leg=52)

    specs: list[tuple[Mode, float, float, float, float, str, list[dict[str, float]]]] = []

    road_km = round(max(gc * 1.12, path_length_km(road_path)), 2)
    road_h = max(2.0, round(road_km / 52.0, 2))
    specs.append(("road", road_km, road_h, 1.0, 0.0, "R1", road_path))

    rail_km = round(max(gc * 1.10, path_length_km(rail_path)), 2)
    rail_h = max(3.0, round(rail_km / 42.0, 2))
    specs.append(("rail", rail_km, rail_h, 0.88, 0.15, "R2", rail_path))

    air_km = round(max(gc * 1.02, path_length_km(air_path)), 2)
    air_h = max(2.5, round(2.0 + air_km / 520.0, 2))
    specs.append(("air", air_km, air_h, 1.45, -0.1, "R3", air_path))

    mm_km = round(max(gc * 1.14, path_length_km(mm_path)), 2)
    mm_h = max(2.5, round(mm_km / 48.0, 2))
    specs.append(("multimodal", mm_km, mm_h, 1.05, 0.05, "R4", mm_path))

    routes: list[RouteModel] = []
    for mode, dist_km, hours, cost_mult, risk_adj, tag, path in specs:
        stops = max(1, min(12, len(path) // 8))
        cost_val, _ = minimize_transport_cost(dist_km, stops, CostModel())
        cost_val = round(float(cost_val) * cost_mult, 2)
        co2 = _co2_along_path(path)
        disruption = "low"
        if risk_adj > 0.12:
            disruption = "medium"
        elif risk_adj < -0.05:
            disruption = "low"
        if mode == "rail":
            disruption = "medium"
        code = _route_code(origin, dest, mode, tag)
        routes.append(
            RouteModel(
                route_code=code,
                source_location=origin.display_name,
                destination_location=dest.display_name,
                distance_km=dist_km,
                expected_time_hours=hours,
                route_cost=cost_val,
                co2_estimate=co2,
                disruption_risk=disruption,
                active_status=True,
                path_coordinates=path,
            )
        )
    return routes


def infer_route_mode_from_code(route_code: str) -> str:
    """Align with route_recommendation_engine mode inference + IND-{MODE}-* synthetic pattern."""
    c = (route_code or "").upper()
    if c.startswith("IND-"):
        rest = c[4:]
        for m in ("MULTIMODAL", "RAIL", "ROAD", "AIR", "SEA"):
            if rest.startswith(m + "-"):
                return m.lower() if m != "MULTIMODAL" else "multimodal"
        if rest.startswith("AIR-"):
            return "air"
    if "-AIR" in c or c.endswith("AIR"):
        return "air"
    if "-RAIL" in c or "RAIL" in c:
        return "rail"
    if "-SEA" in c:
        return "sea"
    if "-MM" in c:
        return "multimodal"
    return "road"


def merge_db_and_synthetic(db_routes: list[RouteModel], synthetic: list[RouteModel]) -> list[RouteModel]:
    """Prefer one seeded DB route per mode; fill remaining modes from synthetic variants."""
    by_mode_db: dict[str, RouteModel] = {}
    for r in db_routes:
        m = infer_route_mode_from_code(r.route_code)
        if m not in by_mode_db:
            by_mode_db[m] = r
    deduped_db = list(by_mode_db.values())
    modes = set(by_mode_db.keys())
    out = deduped_db
    for r in synthetic:
        m = infer_route_mode_from_code(r.route_code)
        if m not in modes:
            out.append(r)
            modes.add(m)
    return out[:8]
