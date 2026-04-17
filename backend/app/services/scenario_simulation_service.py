from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ScenarioId = Literal[
    "supplier_delay",
    "warehouse_shutdown",
    "route_blockage",
    "port_closure",
    "demand_spike",
    "regional_disruption",
]


@dataclass
class ScenarioKpis:
    logistics_cost_musd: float  # Displayed as ₹ Crore (1.0 = ₹1 Cr); field name kept for API compatibility.
    eta_impact_hours: float
    service_level_pct: float
    inventory_shortage_units: int
    supplier_risk_index: float  # 0..100


BASELINE = ScenarioKpis(
    logistics_cost_musd=2.48,
    eta_impact_hours=0.0,
    service_level_pct=96.2,
    inventory_shortage_units=120,
    supplier_risk_index=38.0,
)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def simulate_scenario(scenario: ScenarioId) -> dict:
    # Multipliers / deltas chosen to look realistic for demos.
    impacts: dict[ScenarioId, dict] = {
        "supplier_delay": {
            "cost_mult": 1.082,
            "eta_add": 16.0,
            "service_drop": 4.1,
            "shortage_add": 220,
            "supplier_risk_add": 18.0,
            "playbook": [
                "Confirm supplier production slotting and commit ETAs for critical POs.",
                "Reserve expedited lanes for top 20% SKUs; shift to alternate suppliers for next 2 cycles.",
                "Uplift safety stock in impacted regions and re-sequence outbound allocation to protect service level.",
            ],
        },
        "warehouse_shutdown": {
            "cost_mult": 1.124,
            "eta_add": 23.0,
            "service_drop": 7.6,
            "shortage_add": 460,
            "supplier_risk_add": 6.0,
            "playbook": [
                "Activate overflow warehouse and cross-dock plan; reroute inbound to nearest hubs.",
                "Prioritize customer allocation using ABC segmentation; pause low-margin lanes temporarily.",
                "Trigger emergency labor + carrier capacity; switch to dynamic slotting for outbound.",
            ],
        },
        "route_blockage": {
            "cost_mult": 1.067,
            "eta_add": 14.0,
            "service_drop": 3.3,
            "shortage_add": 140,
            "supplier_risk_add": 3.0,
            "playbook": [
                "Switch to alternate route plan and re-tender carriers with updated ETAs.",
                "Rebalance inventory closer to demand nodes to reduce last-mile exposure.",
                "Enable proactive notifications for at-risk shipments and tighten exception handling SLAs.",
            ],
        },
        "port_closure": {
            "cost_mult": 1.152,
            "eta_add": 32.0,
            "service_drop": 9.2,
            "shortage_add": 620,
            "supplier_risk_add": 11.0,
            "playbook": [
                "Divert inbound containers to secondary port; secure priority berthing if available.",
                "Convert critical imports to air for a narrow SKU subset; renegotiate demurrage terms.",
                "Increase regional buffer stock and re-sequence replenishment to protect top customers.",
            ],
        },
        "demand_spike": {
            "cost_mult": 1.055,
            "eta_add": 10.0,
            "service_drop": 5.8,
            "shortage_add": 780,
            "supplier_risk_add": 8.0,
            "playbook": [
                "Raise reorder quantities for high-velocity SKUs; uplift safety stock by 10–15% temporarily.",
                "Throttle low-priority orders and protect service level for premium customers.",
                "Confirm supplier capacity and lock transport capacity for next 14 days.",
            ],
        },
        "regional_disruption": {
            "cost_mult": 1.098,
            "eta_add": 19.0,
            "service_drop": 6.4,
            "shortage_add": 340,
            "supplier_risk_add": 9.0,
            "playbook": [
                "Shift sourcing away from affected region; validate alternate suppliers and lanes.",
                "Rebalance inventory between regions; expedite replenishment into safe hubs.",
                "Increase monitoring: disruption signals, carrier performance, and supplier OTIF daily.",
            ],
        },
    }

    if scenario not in impacts:
        scenario = "supplier_delay"

    conf = impacts[scenario]
    after = ScenarioKpis(
        logistics_cost_musd=round(BASELINE.logistics_cost_musd * conf["cost_mult"], 2),
        eta_impact_hours=round(conf["eta_add"], 1),
        service_level_pct=round(_clamp(BASELINE.service_level_pct - conf["service_drop"], 70, 99.9), 1),
        inventory_shortage_units=int(BASELINE.inventory_shortage_units + conf["shortage_add"]),
        supplier_risk_index=round(_clamp(BASELINE.supplier_risk_index + conf["supplier_risk_add"], 0, 100), 1),
    )

    delta = {
        "logistics_cost_musd": round(after.logistics_cost_musd - BASELINE.logistics_cost_musd, 2),
        "eta_impact_hours": round(after.eta_impact_hours - BASELINE.eta_impact_hours, 1),
        "service_level_pct": round(after.service_level_pct - BASELINE.service_level_pct, 1),
        "inventory_shortage_units": int(after.inventory_shortage_units - BASELINE.inventory_shortage_units),
        "supplier_risk_index": round(after.supplier_risk_index - BASELINE.supplier_risk_index, 1),
    }

    chart = [
        {"metric": "Cost (₹ Cr)", "baseline": BASELINE.logistics_cost_musd, "after": after.logistics_cost_musd},
        {"metric": "ETA impact (h)", "baseline": BASELINE.eta_impact_hours, "after": after.eta_impact_hours},
        {"metric": "Service level (%)", "baseline": BASELINE.service_level_pct, "after": after.service_level_pct},
        {"metric": "Shortage (units)", "baseline": BASELINE.inventory_shortage_units, "after": after.inventory_shortage_units},
        {"metric": "Supplier risk", "baseline": BASELINE.supplier_risk_index, "after": after.supplier_risk_index},
    ]

    display_names: dict[ScenarioId, str] = {
        "supplier_delay": "Supplier delay",
        "warehouse_shutdown": "Warehouse shutdown",
        "route_blockage": "Route blockage",
        "port_closure": "Port closure",
        "demand_spike": "Sudden demand spike",
        "regional_disruption": "Regional disruption",
    }

    actions = conf["playbook"]
    return {
        "scenario": scenario,
        "scenario_name": display_names[scenario],
        "baseline": BASELINE.__dict__,
        "after": after.__dict__,
        "delta": delta,
        "chart": chart,
        "playbook": " · ".join(actions),
        "recommended_actions": actions,
    }

