"""Road-style route polylines: Mapbox Directions when configured, else dense simulated geometry."""

from __future__ import annotations

import math
from typing import Any

import httpx

from app.core.config import get_settings
from optimization_engine.routing.optimizer import Site, _haversine_km


def _as_latlng_dicts(coords_lonlat: list[list[float]]) -> list[dict[str, float]]:
    return [{"lat": round(lat, 5), "lng": round(lon, 5)} for lon, lat in coords_lonlat]


def _extract_endpoints(path: list[Any]) -> tuple[float, float, float, float] | None:
    if not path or len(path) < 2:
        return None

    def one(p: Any) -> tuple[float, float]:
        if isinstance(p, dict):
            lat = float(p.get("lat", p.get("latitude", 0)))
            lng = float(p.get("lng", p.get("longitude", 0)))
            return lat, lng
        return float(getattr(p, "lat", 0)), float(getattr(p, "lng", 0))

    lat1, lng1 = one(path[0])
    lat2, lng2 = one(path[-1])
    return lat1, lng1, lat2, lng2


def densify_sparse_polyline(path: list[Any], *, variant: int = 0, min_points: int = 36) -> list[dict[str, float]]:
    """If path has few vertices, replace with a dense simulated road-style path between endpoints."""
    if not path:
        return []
    ends = _extract_endpoints(path)
    if not ends:
        return []
    lat1, lng1, lat2, lng2 = ends
    if len(path) >= min_points:
        out: list[dict[str, float]] = []
        for p in path:
            if isinstance(p, dict):
                out.append(
                    {
                        "lat": round(float(p.get("lat", p.get("latitude", 0))), 5),
                        "lng": round(float(p.get("lng", p.get("longitude", 0))), 5),
                    }
                )
        return out if len(out) >= min_points else build_simulated_road_polyline(lat1, lng1, lat2, lng2, variant=variant)
    return build_simulated_road_polyline(lat1, lng1, lat2, lng2, variant=variant)


def try_mapbox_driving_polyline(lat1: float, lon1: float, lat2: float, lon2: float) -> list[dict[str, float]] | None:
    settings = get_settings()
    token = settings.mapbox_access_token
    if not token or not settings.use_mapbox_directions:
        return None
    coord_path = f"{lon1},{lat1};{lon2},{lat2}"
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coord_path}"
    params = {
        "access_token": token,
        "alternatives": "false",
        "geometries": "geojson",
        "overview": "full",
        "annotations": "duration,distance",
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            body = r.json()
    except Exception:
        return None
    routes = body.get("routes") or []
    if not routes:
        return None
    geom = (routes[0].get("geometry") or {}).get("coordinates")
    if not geom or len(geom) < 2:
        return None
    coords = [[float(lon), float(lat)] for lon, lat in geom]
    max_pts = 180
    if len(coords) > max_pts:
        step = max(1, len(coords) // max_pts)
        slim = coords[::step]
        if slim[-1] != coords[-1]:
            slim = list(slim) + [coords[-1]]
        coords = slim
    return _as_latlng_dicts(coords)


def build_simulated_road_polyline(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    *,
    variant: int = 0,
    num_points: int = 80,
    base_wiggle_km: float = 38.0,
) -> list[dict[str, float]]:
    """
    Dense path that bends like a road corridor (not a two-point line).
    Uses great-circle-ish base + multi-harmonic lateral offset in a local frame.
    """
    dlat = lat2 - lat1
    dlng = lon2 - lon1
    norm = math.sqrt(dlat * dlat + dlng * dlng)
    if norm < 1e-9:
        return [{"lat": round(lat1, 5), "lng": round(lon1, 5)}]
    px = -dlng / norm
    py = dlat / norm
    mid_lat = math.radians((lat1 + lat2) / 2.0)
    km_to_lat = 1.0 / 111.0
    km_to_lng = 1.0 / max(25.0, 111.0 * math.cos(mid_lat))

    # Variant shifts second "lane" of oscillation
    ph0 = 0.9 + 0.35 * variant
    amp1 = base_wiggle_km * (0.85 + 0.08 * (variant % 3))
    amp2 = base_wiggle_km * (0.45 + 0.12 * ((variant + 1) % 4))

    pts: list[dict[str, float]] = []
    for i in range(num_points):
        t = i / max(1, num_points - 1)
        # smoothstep for gentler ends
        u = t * t * (3.0 - 2.0 * t)
        lat = lat1 + dlat * u
        lng = lon1 + dlng * u
        # hub-style jog: stronger mid-route bend
        w = (
            amp1 * math.sin(math.pi * t + ph0) * math.sin(math.pi * t)
            + amp2 * math.sin(2.0 * math.pi * t * (1.1 + 0.05 * variant) + ph0 * 1.2)
            + 0.25 * amp1 * math.sin(3.0 * math.pi * t + 0.4 * variant)
        )
        # taper offset near ends (stay near real endpoints)
        envelope = math.sin(math.pi * t) ** 1.15
        w *= envelope
        lat += py * w * km_to_lat
        lng += px * w * km_to_lng
        pts.append({"lat": round(lat, 5), "lng": round(lng, 5)})
    pts[0] = {"lat": round(lat1, 5), "lng": round(lon1, 5)}
    pts[-1] = {"lat": round(lat2, 5), "lng": round(lon2, 5)}
    return pts


def build_multileg_road_style(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    *,
    variant: int,
    mid_frac: float = 0.48,
    points_per_leg: int = 44,
) -> list[dict[str, float]]:
    """Two-segment path via an intermediate hub offset from the chord (rail / multimodal feel)."""
    u = mid_frac
    mlat = lat1 + (lat2 - lat1) * u
    mlng = lon1 + (lon2 - lon1) * u
    dlat = lat2 - lat1
    dlng = lon2 - lon1
    norm = math.sqrt(dlat * dlat + dlng * dlng) or 1.0
    px = -dlng / norm
    py = dlat / norm
    mid_lat = math.radians((lat1 + lat2) / 2.0)
    jog_km = 55.0 + (variant % 5) * 12.0
    mlat += py * (jog_km / 111.0)
    mlng += px * (jog_km / max(25.0, 111.0 * math.cos(mid_lat)))

    a = build_simulated_road_polyline(lat1, lon1, mlat, mlng, variant=variant, num_points=points_per_leg, base_wiggle_km=32.0)
    b = build_simulated_road_polyline(mlat, mlng, lat2, lon2, variant=variant + 3, num_points=points_per_leg, base_wiggle_km=34.0)
    return a[:-1] + b


def path_length_km(path: list[dict[str, float]]) -> float:
    if len(path) < 2:
        return 0.0
    s = 0.0
    for i in range(len(path) - 1):
        a = Site("a", "a", path[i]["lat"], path[i]["lng"])
        b = Site("b", "b", path[i + 1]["lat"], path[i + 1]["lng"])
        s += _haversine_km(a, b)
    return round(s, 2)
