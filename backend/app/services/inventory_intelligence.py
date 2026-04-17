from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.services.forecast_service import DemandForecastResult

StockStatus = Literal["normal", "shortage", "overstock"]


@dataclass
class WarehouseInventoryInsight:
    name: str
    region: str
    stock_level: int
    avg_daily_demand: int
    projected_daily_demand: int
    demand_variability: int
    lead_time_days: int
    safety_stock: int
    reorder_point: int
    shortage_qty: int
    excess_qty: int
    status: StockStatus


def build_inventory_insights(forecast: DemandForecastResult | None = None) -> dict:
    seed = [
        {"name": "Delhi WH-01", "region": "North", "stock_level": 1240, "avg_daily_demand": 96, "demand_variability": 21, "lead_time_days": 8},
        {"name": "Chennai WH-07", "region": "South", "stock_level": 620, "avg_daily_demand": 88, "demand_variability": 24, "lead_time_days": 7},
        {"name": "Pune WH-02", "region": "West", "stock_level": 1660, "avg_daily_demand": 72, "demand_variability": 18, "lead_time_days": 6},
        {"name": "Kolkata WH-04", "region": "East", "stock_level": 780, "avg_daily_demand": 69, "demand_variability": 16, "lead_time_days": 7},
    ]

    horizon_days = forecast.horizon_days if forecast else 14
    network_daily_forecast = 0.0
    if forecast and forecast.predicted_demand:
        network_daily_forecast = sum(forecast.predicted_demand) / len(forecast.predicted_demand)
    else:
        network_daily_forecast = sum(row["avg_daily_demand"] for row in seed) / len(seed)

    # Region-aware multipliers: simulate demand shifting by region based on forecast signals.
    # These are intentionally simple, deterministic, and demo-friendly.
    base_region_weights: dict[str, float] = {"North": 1.0, "South": 1.0, "West": 1.0, "East": 1.0}
    trend = getattr(forecast, "trend", "flat") if forecast else "flat"
    spike = bool(getattr(forecast, "spike_detected", False)) if forecast else False
    change_pct = float(getattr(forecast, "change_pct", 0.0)) if forecast else 0.0

    region_multipliers: dict[str, float] = dict(base_region_weights)
    if trend == "upward":
        region_multipliers["South"] = 1.07
        region_multipliers["West"] = 1.04
        region_multipliers["North"] = 1.01
        region_multipliers["East"] = 0.98
    elif trend == "downward":
        region_multipliers["South"] = 0.96
        region_multipliers["West"] = 0.98
        region_multipliers["North"] = 0.99
        region_multipliers["East"] = 1.01

    # Spike amplifies the highest-growth regions a bit more.
    if spike:
        region_multipliers["South"] = round(region_multipliers["South"] * 1.04, 3)
        region_multipliers["West"] = round(region_multipliers["West"] * 1.02, 3)

    # If the change is strong, modestly scale multipliers further.
    if abs(change_pct) >= 7:
        scale = 1.02 if change_pct > 0 else 0.98
        region_multipliers = {k: round(v * scale, 3) for k, v in region_multipliers.items()}

    # Weighted total now includes region multipliers so allocation shifts by region.
    weighted_demands = [row["avg_daily_demand"] * region_multipliers.get(row["region"], 1.0) for row in seed]
    weight_total = sum(weighted_demands) or 1.0

    warehouses: list[WarehouseInventoryInsight] = []
    for row in seed:
        region_weight = region_multipliers.get(row["region"], 1.0)
        weighted = row["avg_daily_demand"] * region_weight
        weight = weighted / weight_total
        # Scale by number of warehouses to keep magnitude comparable to previous demo values.
        projected_daily_demand = int(round(network_daily_forecast * len(seed) * weight))

        safety_stock = int(round(row["demand_variability"] * row["lead_time_days"] * 1.65))
        reorder_point = int(round((projected_daily_demand * row["lead_time_days"]) + safety_stock))
        shortage_qty = max(0, reorder_point - row["stock_level"])
        excess_qty = max(0, row["stock_level"] - int(round(reorder_point * 1.35)))

        status: StockStatus
        if row["stock_level"] < reorder_point:
            status = "shortage"
        elif excess_qty > 0:
            status = "overstock"
        else:
            status = "normal"

        warehouses.append(
            WarehouseInventoryInsight(
                name=row["name"],
                region=row["region"],
                stock_level=row["stock_level"],
                avg_daily_demand=row["avg_daily_demand"],
                projected_daily_demand=projected_daily_demand,
                demand_variability=row["demand_variability"],
                lead_time_days=row["lead_time_days"],
                safety_stock=safety_stock,
                reorder_point=reorder_point,
                shortage_qty=shortage_qty,
                excess_qty=excess_qty,
                status=status,
            )
        )

    shortages = [w for w in warehouses if w.status == "shortage"]
    overstocks = [w for w in warehouses if w.status == "overstock"]

    transfer = None
    if shortages and overstocks:
        shortage = sorted(shortages, key=lambda x: x.shortage_qty, reverse=True)[0]
        over = sorted(overstocks, key=lambda x: x.excess_qty, reverse=True)[0]
        transfer_qty = min(shortage.shortage_qty, over.excess_qty)
        if transfer_qty > 0:
            transfer = {
                "from_warehouse": over.name,
                "to_warehouse": shortage.name,
                "quantity": transfer_qty,
                "reason": f"Rebalance excess stock from {over.region} to support shortage risk in {shortage.region}.",
            }

    return {
        "warehouses": [w.__dict__ for w in warehouses],
        "summary": {
            "warehouse_count": len(warehouses),
            "low_stock_count": len(shortages),
            "excess_stock_count": len(overstocks),
            "network_stock": sum(w.stock_level for w in warehouses),
            "network_safety_stock": sum(w.safety_stock for w in warehouses),
            "network_reorder_point": sum(w.reorder_point for w in warehouses),
            "forecast_horizon_days": horizon_days,
            "network_projected_daily_demand": int(round(network_daily_forecast)),
            "region_multipliers": region_multipliers,
        },
        "rebalancing_recommendation": (
            f"Transfer {transfer['quantity']} units from {transfer['from_warehouse']} to {transfer['to_warehouse']}."
            if transfer
            else "No stock rebalance recommended for the current network state."
        ),
        "suggested_transfer": transfer,
    }

