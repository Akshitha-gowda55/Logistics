"""Aggregate supplier, route, inventory, forecast, and risk signals into prioritized guidance."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import WorkflowModel
from app.schemas.workflow_system import DecisionInsight
from app.services.forecast_service import build_demo_forecast
from app.services.inventory_intelligence import build_inventory_insights
from app.services.supplier_risk_service import build_supplier_risk


def _priority_for(
    *,
    supplier_status: str,
    inventory_status: str,
    route_status: str,
    low_stock_hints: bool,
    high_route_risk: bool,
    supplier_delayed: bool,
) -> str:
    critical = supplier_delayed and (inventory_status.lower() in ("low_stock", "critical", "reorder_sent") or low_stock_hints)
    if critical or (high_route_risk and low_stock_hints):
        return "high"
    if supplier_delayed or inventory_status.lower() in ("low_stock", "critical") or route_status.lower() == "delayed":
        return "medium"
    return "low"


def evaluate_for_workflow(db: Session | None, wf: WorkflowModel) -> DecisionInsight:
    fc = build_demo_forecast(horizon_days=14)
    inv = build_inventory_insights(fc)
    risk = build_supplier_risk()

    low_stock = False
    if inv.get("summary") and isinstance(inv["summary"], dict):
        low_stock = int(inv["summary"].get("low_stock_count") or 0) > 0
    warehouses = inv.get("warehouses") or []
    for w in warehouses:
        if (w.get("status") or "").lower() in ("shortage", "critical"):
            low_stock = True
            break

    supplier_delayed = wf.supplier_status.lower() in ("delayed", "unavailable")
    route_delayed = wf.route_status.lower() in ("delayed",)
    high_route_risk = route_delayed or wf.route_status.lower() == "delayed"

    best_supplier = ""
    delay_prob = 0.0
    suppliers = risk.get("suppliers") or []
    if suppliers:
        best_supplier = str(suppliers[0].get("supplier") or "")
        delay_prob = float(suppliers[0].get("delay_probability") or 0)

    problem = []
    impact = []

    if supplier_delayed:
        problem.append(f"Supplier leg is {wf.supplier_status}.")
        impact.append("Downstream ETA and replenishment timing are at risk.")

    inv_s = wf.inventory_status.lower()
    if inv_s in ("low_stock", "critical", "reorder_sent") or low_stock:
        problem.append(f"Stock signal: {wf.inventory_status} (network shortages: {inv.get('summary', {}).get('low_stock_count', 0)}).")
        impact.append("Service level drops if demand spikes before refill.")

    if route_delayed:
        problem.append(f"Movement is {wf.route_status}.")
        impact.append("Customer promise dates may slip unless mode or route changes.")

    if not problem:
        problem.append("No critical cross-signal on this workflow right now.")
        impact.append("Maintain normal monitoring cadence.")

    priority = _priority_for(
        supplier_status=wf.supplier_status,
        inventory_status=wf.inventory_status,
        route_status=wf.route_status,
        low_stock_hints=low_stock,
        high_route_risk=high_route_risk,
        supplier_delayed=supplier_delayed,
    )

    if priority == "high":
        rec = (
            "Switch to the fastest reliable route for this lane, raise the PO or transfer stock immediately, "
            "and page executive + operations with a single war-room thread."
        )
    elif priority == "medium":
        rec = (
            f"Confirm supplier recovery date for {best_supplier or 'primary supplier'}, "
            "book buffer capacity on the next dispatch window, and prep a rebalance if shortage persists."
        )
    else:
        rec = "Keep weekly rhythm: track forecast drift, confirm inbound dates, and refresh route risk after weather or corridor news."

    return DecisionInsight(
        problem=" ".join(problem),
        impact=" ".join(impact),
        recommended_action=rec,
        priority=priority,  # type: ignore[arg-type]
    )


def evaluate_global_snapshot(db: Session | None = None) -> DecisionInsight:
    """Network-level decision when no single workflow is selected."""
    fc = build_demo_forecast(horizon_days=14)
    inv = build_inventory_insights(fc)
    risk = build_supplier_risk()
    low = int((inv.get("summary") or {}).get("low_stock_count") or 0)
    top = (risk.get("suppliers") or [{}])[0]
    score = float(top.get("risk_score") or 0)
    if low > 0 and score >= 65:
        return DecisionInsight(
            problem="Network shows low stock at one or more warehouses while top supplier risk is elevated.",
            impact="Combined exposure can cause missed OTIF on high-mix SKUs within the forecast window.",
            recommended_action="Prioritize rebalances from surplus nodes, dual-source top SKUs, and refresh transport plans for affected lanes.",
            priority="high",
        )
    if low > 0:
        return DecisionInsight(
            problem="Inventory nodes are below target in at least one region.",
            impact="Shortages may appear if inbound shipments slip even slightly.",
            recommended_action="Trigger replenishment review and align supplier promise dates with warehouse dock capacity.",
            priority="medium",
        )
    return DecisionInsight(
        problem="No acute cross-domain conflict detected in the demo snapshot.",
        impact="Baseline service and cost targets remain achievable with standard cadence.",
        recommended_action="Continue monitoring demand drift and corridor risk; run a scenario if a supplier slip is rumored.",
        priority="low",
    )
