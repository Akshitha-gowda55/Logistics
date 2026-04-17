"""Route optimization — greedy nearest-neighbor on haversine distances (MVP)."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Site:
    id: str
    name: str
    lat: float
    lon: float


def _haversine_km(a: Site, b: Site) -> float:
    r = 6371.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dphi = math.radians(b.lat - a.lat)
    dlmb = math.radians(b.lon - a.lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def optimize_route(start: Site, stops: list[Site]) -> list[Site]:
    """Order stops by greedy nearest neighbor from current position."""
    remaining = list(stops)
    ordered: list[Site] = []
    current = start
    while remaining:
        nxt = min(remaining, key=lambda s: _haversine_km(current, s))
        ordered.append(nxt)
        remaining.remove(nxt)
        current = nxt
    return ordered


class RouteOptimizer:
    def __init__(self, avg_speed_kmh: float = 65.0) -> None:
        self.avg_speed_kmh = avg_speed_kmh

    def total_distance_km(self, legs: list[tuple[Site, Site]]) -> float:
        return sum(_haversine_km(a, b) for a, b in legs)

    def duration_minutes(self, distance_km: float) -> int:
        if self.avg_speed_kmh <= 0:
            return 0
        return int(round((distance_km / self.avg_speed_kmh) * 60))
