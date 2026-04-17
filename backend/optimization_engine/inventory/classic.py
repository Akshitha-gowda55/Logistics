"""Classic inventory formulas: safety stock, reorder point (ROP), economic order quantity (EOQ)."""

from __future__ import annotations

import math


def z_for_service_level(service_level: float) -> float:
    """Normal tail quantiles for common service targets (linear interp between anchors)."""
    sl = max(0.5, min(0.999, service_level))
    anchors = (
        (0.90, 1.282),
        (0.95, 1.645),
        (0.98, 2.054),
        (0.99, 2.326),
        (0.995, 2.576),
    )
    for (s0, z0), (s1, z1) in zip(anchors[:-1], anchors[1:]):
        if s0 <= sl <= s1:
            t = (sl - s0) / (s1 - s0) if s1 != s0 else 0.0
            return z0 + t * (z1 - z0)
    return anchors[-1][1] if sl > anchors[-1][0] else anchors[0][1]


def safety_stock_units(
    *,
    z: float,
    sigma_demand_per_period: float,
    lead_time_periods: float,
) -> float:
    """
    Safety stock under independent demand across periods:
    SS = z * sigma * sqrt(L)  (same time unit for sigma and L).
    """
    if sigma_demand_per_period < 0 or lead_time_periods <= 0:
        return 0.0
    return z * sigma_demand_per_period * math.sqrt(lead_time_periods)


def reorder_point_units(
    *,
    mean_demand_per_period: float,
    lead_time_periods: float,
    safety_stock: float,
) -> float:
    """ROP = expected demand during lead time + safety stock."""
    return max(0.0, mean_demand_per_period * lead_time_periods + safety_stock)


def economic_order_quantity(
    *,
    annual_demand: float,
    fixed_ordering_cost: float,
    holding_cost_per_unit_per_year: float,
) -> float:
    """EOQ = sqrt(2 * D * S / H). Returns 0 if inputs invalid."""
    if annual_demand <= 0 or fixed_ordering_cost <= 0 or holding_cost_per_unit_per_year <= 0:
        return 0.0
    return math.sqrt(2.0 * annual_demand * fixed_ordering_cost / holding_cost_per_unit_per_year)
