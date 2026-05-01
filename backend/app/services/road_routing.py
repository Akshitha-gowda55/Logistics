"""Real road geometries via OpenRouteService (preferred), GraphHopper, Mapbox, then curved demo path."""

from __future__ import annotations

import logging
from typing import Literal

import httpx

from app.core.config import get_settings
from app.services.routing_geometry import build_simulated_road_polyline, try_mapbox_driving_polyline

log = logging.getLogger(__name__)

RoutePreference = Literal["recommended", "fastest", "shortest"]


def _decode_polyline(encoded: str, precision: int = 5) -> list[tuple[float, float]]:
    """Google encoded polyline decoder (GraphHopper). Returns (lat, lng) pairs."""
    index = 0
    lat = 0
    lng = 0
    coordinates: list[tuple[float, float]] = []
    factory = float(10 ** precision)

    while index < len(encoded):
        result = 1
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result += (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if result & 1 else result >> 1
        lat += dlat

        result = 1
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result += (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if result & 1 else result >> 1
        lng += dlng

        coordinates.append((lat / factory, lng / factory))

    return coordinates


def routing_geometry_distance_km(path: list[dict[str, float]]) -> float:
    """Sum of segments (haversine)."""
    from optimization_engine.routing.optimizer import Site, _haversine_km

    if len(path) < 2:
        return 0.0
    s = 0.0
    for i in range(len(path) - 1):
        a = Site("a", "a", path[i]["lat"], path[i]["lng"])
        b = Site("b", "b", path[i + 1]["lat"], path[i + 1]["lng"])
        s += _haversine_km(a, b)
    return round(s, 2)


def fetch_openrouteservice(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
    preference: RoutePreference,
) -> tuple[list[dict[str, float]], float | None, float | None] | None:
    settings = get_settings()
    key = (settings.openrouteservice_api_key or "").strip()
    if not key:
        return None

    body = {
        "coordinates": [[lng1, lat1], [lng2, lat2]],
        "preference": preference,
        "instructions": False,
    }
    url = "https://api.openrouteservice.org/v2/directions/driving-car"
    headers = {"Authorization": key, "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        log.debug("OpenRouteService failed: %s", e)
        return None

    routes = data.get("routes") or []
    if not routes:
        return None
    geom = routes[0].get("geometry")
    coords: list[list[float]] | None = None
    if isinstance(geom, dict) and geom.get("coordinates"):
        coords = geom["coordinates"]
    elif isinstance(geom, str):
        pts = _decode_polyline(geom)
        coords = [[p[1], p[0]] for p in pts]
    if not coords or len(coords) < 2:
        return None

    coords_latlng = [{"lat": float(c[1]), "lng": float(c[0])} for c in coords]

    summary = routes[0].get("summary") or {}
    dist_m = float(summary.get("distance") or 0)
    dur_s = float(summary.get("duration") or 0)

    km = round(dist_m / 1000.0, 2) if dist_m else None
    hours = round(dur_s / 3600.0, 2) if dur_s else None

    max_pts = 220
    if len(coords_latlng) > max_pts:
        step = max(1, len(coords_latlng) // max_pts)
        slim = coords_latlng[::step]
        if slim[-1] != coords_latlng[-1]:
            slim = slim + [coords_latlng[-1]]
        coords_latlng = slim

    return coords_latlng, km, hours


def fetch_graphhopper(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
    profile_preference: RoutePreference,
) -> tuple[list[dict[str, float]], float | None, float | None] | None:
    settings = get_settings()
    key = (settings.graphhopper_api_key or "").strip()
    if not key:
        return None

    weighting = "shortest" if profile_preference == "shortest" else "fastest"

    params = [
        ("point", f"{lat1},{lng1}"),
        ("point", f"{lat2},{lng2}"),
        ("vehicle", "car"),
        ("weighting", weighting),
        ("type", "json"),
        ("key", key),
        ("instructions", "false"),
    ]
    url = settings.graphhopper_base_url.rstrip("/") + "/route"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        log.debug("GraphHopper failed: %s", e)
        return None

    paths = data.get("paths") or []
    if not paths:
        return None
    p0 = paths[0]
    enc = p0.get("points")
    if not enc or not isinstance(enc, str):
        return None
    pts = _decode_polyline(enc)
    coords_latlng = [{"lat": float(a), "lng": float(b)} for a, b in pts]
    km = float(p0.get("distance") or 0) / 1000.0
    sec = float(p0.get("time") or 0) / 1000.0
    hours = round(sec / 3600.0, 2) if sec else None
    return coords_latlng, round(km, 2), hours


def road_geometry_between(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
    *,
    preference: RoutePreference = "recommended",
    variant_fallback: int = 0,
) -> tuple[list[dict[str, float]], float | None, float | None]:
    """Return road path coords and optional measured distance (km) and duration (hours)."""
    pref: RoutePreference = "recommended" if preference not in ("recommended", "fastest", "shortest") else preference

    ors_result = fetch_openrouteservice(lat1, lng1, lat2, lng2, pref)
    gh_result = fetch_graphhopper(lat1, lng1, lat2, lng2, pref) if ors_result is None else None

    tup = ors_result or gh_result

    if tup is None:
        mb_coords = try_mapbox_driving_polyline(lat1, lng1, lat2, lng2)
        if mb_coords and len(mb_coords) >= 2:
            km = routing_geometry_distance_km(mb_coords)
            tup = (mb_coords, km, None)
        else:
            sim = build_simulated_road_polyline(lat1, lng1, lat2, lng2, variant=variant_fallback % 17, num_points=96)
            km = routing_geometry_distance_km(sim)
            tup = (sim, km, None)

    return tup[0], tup[1], tup[2]


def triple_road_profiles(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> dict[str, tuple[list[dict[str, float]], float | None, float | None]]:
    """Recommended / fastest / shortest paths (falling back to curved corridor, never a 2-point line)."""
    base_fb = build_simulated_road_polyline(lat1, lng1, lat2, lng2, variant=3, num_points=100)
    out: dict[str, tuple[list[dict[str, float]], float | None, float | None]] = {}

    for key, pref, v in (
        ("recommended", "recommended", 1),
        ("fastest", "fastest", 2),
        ("shortest", "shortest", 4),
    ):
        path, km, hrs = road_geometry_between(lat1, lng1, lat2, lng2, preference=pref, variant_fallback=v)
        if not km:
            km = routing_geometry_distance_km(path)
        out[key] = (path if len(path) >= 2 else base_fb, km, hrs)

    return out
