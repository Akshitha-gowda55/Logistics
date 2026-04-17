"""Cost minimization — linear transport model in Indian Rupees (₹)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CostModel:
    inr_per_km: float = 48.0
    fixed_stop_cost_inr: float = 800.0


def minimize_transport_cost(
    distance_km: float,
    num_stops: int,
    model: CostModel | None = None,
) -> tuple[float, list[tuple[str, float]]]:
    m = model or CostModel()
    variable = distance_km * m.inr_per_km
    stops_cost = max(0, num_stops) * m.fixed_stop_cost_inr
    total = variable + stops_cost
    breakdown = [
        ("Linehaul (variable, ₹)", round(variable, 2)),
        ("Stop handling (fixed, ₹)", round(stops_cost, 2)),
    ]
    return round(total, 2), breakdown
