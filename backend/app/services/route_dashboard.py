"""Route dashboard: India network, dynamic OD polylines, ₹ costs; Mapbox optional."""

from __future__ import annotations

import math

import httpx

from app.core.config import get_settings
from app.data.india_locations import IndiaCity, all_india_sites, default_demo_corridor_cities, resolve_india_city
from app.schemas.route_dashboard import MapLocation, RouteDashboardResponse, RouteSuggestion
from app.services.routing_geometry import build_simulated_road_polyline
from optimization_engine.co2 import Co2Model, leg_emissions
from optimization_engine.cost import CostModel, minimize_transport_cost
from optimization_engine.routing.optimizer import Site, _haversine_km


def _dedupe_lonlat(seq: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for lng, lat in seq:
        if not out or (abs(out[-1][0] - lng) > 1e-6 or abs(out[-1][1] - lat) > 1e-6):
            out.append((lng, lat))
    return out


def _segment_coords(a: tuple[float, float], b: tuple[float, float], steps: int) -> list[list[float]]:
    lng1, lat1 = a
    lng2, lat2 = b
    out: list[list[float]] = []
    for i in range(steps):
        t = i / max(1, steps - 1)
        out.append([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t])
    return out


def _build_od_polyline_lonlat(origin: IndiaCity, dest: IndiaCity, variant: int = 0) -> list[list[float]]:
    raw = build_simulated_road_polyline(
        origin.lat, origin.lon, dest.lat, dest.lon, variant=variant, num_points=90, base_wiggle_km=42.0
    )
    return [[p["lng"], p["lat"]] for p in raw]


def _simplify_coords(coords: list[list[float]], max_points: int = 56) -> list[list[float]]:
    if len(coords) <= max_points:
        return coords
    step = max(1, len(coords) // max_points)
    slim = coords[::step]
    if slim[-1] != coords[-1]:
        slim.append(coords[-1])
    return slim


def _perturb(coords: list[list[float]], amplitude: float, phase: float) -> list[list[float]]:
    out: list[list[float]] = []
    for i, (lng, lat) in enumerate(coords):
        if i == 0 or i == len(coords) - 1:
            out.append([lng, lat])
            continue
        t = i / max(1, len(coords) - 1)
        out.append(
            [
                lng + amplitude * math.sin(phase + t * math.pi * 2),
                lat + amplitude * 0.55 * math.cos(phase + t * math.pi),
            ]
        )
    return out


def _total_distance_km(coords: list[list[float]]) -> float:
    sites = [Site(f"p{i}", "x", lat, lon) for i, (lon, lat) in enumerate(coords)]
    legs = list(zip(sites[:-1], sites[1:]))
    return round(sum(_haversine_km(a, b) for a, b in legs), 2)


def _pick_best(routes: list[RouteSuggestion]) -> str:
    if not routes:
        return ""
    times = [r.duration_hours for r in routes]
    costs = [r.cost_inr for r in routes]
    co2s = [r.co2_kg for r in routes]

    def norm(xs: list[float], x: float) -> float:
        lo, hi = min(xs), max(xs)
        if hi - lo < 1e-6:
            return 0.0
        return (x - lo) / (hi - lo)

    scores: list[tuple[float, str]] = []
    for r in routes:
        zt = norm(times, r.duration_hours)
        zc = norm(costs, r.cost_inr)
        ze = norm(co2s, r.co2_kg)
        score = 0.35 * zt + 0.35 * zc + 0.30 * ze
        scores.append((score, r.id))
    scores.sort(key=lambda x: x[0])
    return scores[0][1]


def _mapbox_directions_routes(waypoint_lonlat: list[tuple[float, float]]) -> list[tuple[list[list[float]], float, float]] | None:
    token = get_settings().mapbox_access_token
    if not token or len(waypoint_lonlat) < 2:
        return None
    coord_path = ";".join(f"{lng},{lat}" for lng, lat in waypoint_lonlat)
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coord_path}"
    params = {
        "access_token": token,
        "alternatives": "true",
        "geometries": "geojson",
        "overview": "simplified",
        "annotations": "duration,distance",
    }
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            body = r.json()
    except Exception:
        return None
    feats = body.get("routes") or []
    out: list[tuple[list[list[float]], float, float]] = []
    for rt in feats[:3]:
        geom = (rt.get("geometry") or {}).get("coordinates")
        if not geom:
            continue
        duration_s = float(rt.get("duration") or 0)
        distance_m = float(rt.get("distance") or 0)
        out.append((_simplify_coords(geom, 72), duration_s, distance_m))
    return out or None


def build_route_dashboard(source: str | None = None, destination: str | None = None) -> RouteDashboardResponse:
    settings = get_settings()
    locations = [
        MapLocation(
            id=s.id,
            name=s.map_label,
            location_type=s.location_type,
            longitude=s.lon,
            latitude=s.lat,
        )
        for s in all_india_sites()
    ]

    origin, dest = default_demo_corridor_cities()
    if source and destination:
        o = resolve_india_city(source)
        d = resolve_india_city(destination)
        if o and d and o.id != d.id:
            origin, dest = o, d

    waypoint_seq = _dedupe_lonlat([(origin.lon, origin.lat), (dest.lon, dest.lat)])
    routes: list[RouteSuggestion] = []
    mapbox_used = False

    if settings.use_mapbox_directions and settings.mapbox_access_token:
        mb = _mapbox_directions_routes(waypoint_seq)
        if mb:
            mapbox_used = True
            num_stops = max(0, len(waypoint_seq) - 1)
            cm = Co2Model()
            for i, (coords, duration_s, distance_m) in enumerate(mb, start=1):
                dist_km = distance_m / 1000.0
                hours = max(0.1, duration_s / 3600.0)
                cost, _ = minimize_transport_cost(dist_km, num_stops, CostModel())
                sites = [Site(f"p{j}", "x", lat, lon) for j, (lon, lat) in enumerate(coords)]
                legs = list(zip(sites[:-1], sites[1:]))
                co2 = sum(leg_emissions(_haversine_km(a, b), cm) for a, b in legs)
                routes.append(
                    RouteSuggestion(
                        id=f"route-{i}",
                        label=f"Route {i}",
                        coordinates=coords,
                        duration_hours=round(hours, 2),
                        cost_inr=float(round(cost, 2)),
                        co2_kg=round(co2, 2),
                        is_best=False,
                        distance_km=round(dist_km, 2),
                    )
                )

    routes = routes[:3]
    if not routes:
        base = _simplify_coords(_build_od_polyline_lonlat(origin, dest, variant=0))
        specs: list[tuple[str, str, list[list[float]]]] = [
            ("route-1", "Route 1", base),
            ("route-2", "Route 2", _simplify_coords(_build_od_polyline_lonlat(origin, dest, variant=2))),
            ("route-3", "Route 3", _simplify_coords(_perturb(_build_od_polyline_lonlat(origin, dest, variant=4), 0.12, 0.9))),
        ]
        cm = Co2Model()
        for idx, (rid, label, coords) in enumerate(specs):
            dist_km = _total_distance_km(coords)
            hours = max(2.0, round(dist_km / (48.0 + idx * 4.0), 2))
            cost, _ = minimize_transport_cost(dist_km, max(1, len(coords) // 8), CostModel())
            sites = [Site(f"p{j}", "x", lat, lon) for j, (lon, lat) in enumerate(coords)]
            legs = list(zip(sites[:-1], sites[1:]))
            co2v = round(sum(leg_emissions(_haversine_km(a, b), cm) for a, b in legs), 2)
            routes.append(
                RouteSuggestion(
                    id=rid,
                    label=label,
                    coordinates=coords,
                    duration_hours=hours,
                    cost_inr=float(round(cost * (1.0 + 0.06 * idx), 2)),
                    co2_kg=co2v,
                    is_best=False,
                    distance_km=round(dist_km, 2),
                )
            )

    routes = routes[:3]
    best_id = _pick_best(routes) if mapbox_used else "route-1"
    final_routes = [r.model_copy(update={"is_best": r.id == best_id}) for r in routes]

    return RouteDashboardResponse(
        locations=locations,
        routes=final_routes,
        best_route_id=best_id,
        mapbox_routes_used=mapbox_used,
    )
