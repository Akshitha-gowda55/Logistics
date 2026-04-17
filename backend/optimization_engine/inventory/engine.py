"""Assemble inventory optimization rows from SKU parameters + classic formulas (₹ India)."""

from __future__ import annotations

from dataclasses import dataclass

from optimization_engine.inventory.classic import (
    economic_order_quantity,
    reorder_point_units,
    safety_stock_units,
    z_for_service_level,
)


@dataclass(frozen=True)
class _SkuParams:
    sku_code: str
    site_name: str
    current_stock: float
    mean_weekly_demand: float
    sigma_weekly_demand: float
    lead_time_weeks: float
    service_level: float
    unit_cost_inr: float
    fixed_order_cost_inr: float
    annual_holding_rate: float


def _demo_skus() -> list[_SkuParams]:
    return [
        _SkuParams(
            sku_code="BRG-440C",
            site_name="Bengaluru Plant",
            current_stock=820.0,
            mean_weekly_demand=118.0,
            sigma_weekly_demand=22.0,
            lead_time_weeks=3.0,
            service_level=0.98,
            unit_cost_inr=3850.0,
            fixed_order_cost_inr=14500.0,
            annual_holding_rate=0.22,
        ),
        _SkuParams(
            sku_code="GEA-9HP",
            site_name="Mumbai Warehouse",
            current_stock=2400.0,
            mean_weekly_demand=310.0,
            sigma_weekly_demand=48.0,
            lead_time_weeks=2.0,
            service_level=0.95,
            unit_cost_inr=1650.0,
            fixed_order_cost_inr=8200.0,
            annual_holding_rate=0.20,
        ),
        _SkuParams(
            sku_code="CVJ-12K",
            site_name="Delhi Warehouse",
            current_stock=410.0,
            mean_weekly_demand=95.0,
            sigma_weekly_demand=31.0,
            lead_time_weeks=4.0,
            service_level=0.98,
            unit_cost_inr=5800.0,
            fixed_order_cost_inr=18500.0,
            annual_holding_rate=0.24,
        ),
        _SkuParams(
            sku_code="SHF-A1",
            site_name="Chennai Plant",
            current_stock=1560.0,
            mean_weekly_demand=205.0,
            sigma_weekly_demand=35.0,
            lead_time_weeks=2.5,
            service_level=0.95,
            unit_cost_inr=890.0,
            fixed_order_cost_inr=5200.0,
            annual_holding_rate=0.18,
        ),
    ]


def _recommendation(
    *,
    on_hand: float,
    rop: float,
    eoq: float,
    safety_stock: float,
) -> str:
    if on_hand <= safety_stock:
        return (
            f"Critical: on-hand at or below safety stock ({safety_stock:.0f}). "
            f"Expedite inbound and place EOQ order (~{eoq:.0f} units)."
        )
    if on_hand <= rop:
        return (
            f"Reorder: on-hand at or below reorder point ({rop:.0f}). "
            f"Place EOQ order of ~{eoq:.0f} units to restore cycle stock."
        )
    if on_hand <= rop + 0.35 * eoq:
        return f"Monitor: within reorder band (ROP {rop:.0f}). Plan next EOQ (~{eoq:.0f}) before crossing ROP."
    return f"OK: above ROP; target cycle stock near EOQ ({eoq:.0f}). Consider deferring orders to reduce holding cost."


@dataclass(frozen=True)
class InventoryDashboardRow:
    sku_code: str
    site_name: str
    current_stock: float
    forecast_demand_weekly: float
    forecast_demand_annual: float
    safety_stock: float
    reorder_point: float
    eoq: float
    lead_time_weeks: float
    service_level: float
    recommendation: str


def build_inventory_dashboard_rows() -> list[InventoryDashboardRow]:
    rows: list[InventoryDashboardRow] = []
    for p in _demo_skus():
        z = z_for_service_level(p.service_level)
        ss = safety_stock_units(
            z=z,
            sigma_demand_per_period=p.sigma_weekly_demand,
            lead_time_periods=p.lead_time_weeks,
        )
        rop = reorder_point_units(
            mean_demand_per_period=p.mean_weekly_demand,
            lead_time_periods=p.lead_time_weeks,
            safety_stock=ss,
        )
        d_annual = p.mean_weekly_demand * 52.0
        h = p.unit_cost_inr * p.annual_holding_rate
        eoq = economic_order_quantity(
            annual_demand=d_annual,
            fixed_ordering_cost=p.fixed_order_cost_inr,
            holding_cost_per_unit_per_year=h,
        )
        rec = _recommendation(on_hand=p.current_stock, rop=rop, eoq=eoq, safety_stock=ss)
        rows.append(
            InventoryDashboardRow(
                sku_code=p.sku_code,
                site_name=p.site_name,
                current_stock=round(p.current_stock, 2),
                forecast_demand_weekly=round(p.mean_weekly_demand, 2),
                forecast_demand_annual=round(d_annual, 2),
                safety_stock=round(ss, 2),
                reorder_point=round(rop, 2),
                eoq=round(eoq, 2),
                lead_time_weeks=p.lead_time_weeks,
                service_level=p.service_level,
                recommendation=rec,
            )
        )
    return rows
