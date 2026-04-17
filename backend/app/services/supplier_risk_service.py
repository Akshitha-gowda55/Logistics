from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

UTC = timezone.utc
from typing import Literal


RiskLevel = Literal["Low", "Medium", "High", "Critical"]


@dataclass
class SupplierMetrics:
    supplier: str
    region: str
    late_delivery_rate: float  # 0..1
    disruption_frequency: float  # events / quarter (0..6 demo)
    lead_time_days: int
    cost_volatility: float  # 0..1
    region_instability: float  # 0..1


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _risk_level(score: float) -> RiskLevel:
    if score >= 85:
        return "Critical"
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def _delay_probability(score: float) -> float:
    # Smooth, bounded mapping from score → probability.
    # Using a shallow logistic-like curve for demo determinism.
    p = 1 / (1 + (2.71828 ** (-(score - 55) / 12)))
    return round(_clamp(p, 0.03, 0.92), 2)


def _score(metrics: SupplierMetrics) -> float:
    # Weighted scoring (0..100) based on requested factors.
    late = metrics.late_delivery_rate * 100
    disruptions = _clamp(metrics.disruption_frequency / 6.0, 0.0, 1.0) * 100
    lead = _clamp((metrics.lead_time_days - 5) / 20.0, 0.0, 1.0) * 100
    cost = metrics.cost_volatility * 100
    instability = metrics.region_instability * 100

    score = (
        (0.32 * late)
        + (0.22 * disruptions)
        + (0.18 * lead)
        + (0.16 * cost)
        + (0.12 * instability)
    )
    return round(_clamp(score, 0, 100), 1)


def _recommendation(level: RiskLevel, delay_probability: float, metrics: SupplierMetrics) -> str:
    if level in ("Critical", "High"):
        if delay_probability >= 0.55:
            return (
                "Trigger mitigation playbook: reserve capacity, confirm production slots, and pre-position buffer stock for the next cycle. "
                "Negotiate expedited lanes and validate critical components against alternate sourcing."
            )
        return (
            "Escalate supplier check-in: validate lead time commitments, tighten OTIF tracking, and stage safety stock uplift for high-velocity SKUs."
        )
    if level == "Medium":
        if metrics.cost_volatility >= 0.45:
            return "Monitor cost volatility; lock pricing for the next 30–60 days and limit spot buys. Keep a secondary supplier warm."
        return "Increase monitoring frequency; keep a small buffer and confirm weekly delivery windows."
    return "No immediate action required. Continue standard scorecard monitoring and quarterly performance reviews."


def _trend_series(base_score: float, supplier: str, weeks: int = 8) -> list[dict]:
    # Deterministic mild volatility derived from supplier name length.
    seed = (sum(ord(c) for c in supplier) % 9) - 4  # -4..+4
    now = datetime.now(UTC)
    series: list[dict] = []
    for i in range(weeks):
        w = weeks - i
        drift = (seed * 0.35) + (i * 0.4)
        val = _clamp(base_score + drift, 0, 100)
        label = (now - timedelta(days=7 * w)).strftime("W-%d")
        series.append({"week": label, "score": round(val, 1)})
    series.append({"week": "W+0", "score": base_score})
    return series[-9:]


def _incidents(metrics: SupplierMetrics, score: float) -> list[dict]:
    # Demo incidents derived from severity bands.
    level = _risk_level(score)
    now = datetime.now(UTC)
    out: list[dict] = []
    if level in ("High", "Critical"):
        out.append(
            {
                "id": f"INC-{metrics.supplier[:2].upper()}-1",
                "supplier": metrics.supplier,
                "severity": "high" if level == "High" else "critical",
                "time": (now - timedelta(days=3)).strftime("%b %d"),
                "headline": "Lead time deviation detected",
                "detail": f"Rolling lead time +{max(2, metrics.lead_time_days // 6)} days vs baseline · expedite lane suggested",
            }
        )
    if metrics.disruption_frequency >= 2.0:
        out.append(
            {
                "id": f"INC-{metrics.supplier[:2].upper()}-2",
                "supplier": metrics.supplier,
                "severity": "medium",
                "time": (now - timedelta(days=9)).strftime("%b %d"),
                "headline": "Disruption signal elevated",
                "detail": "Regional capacity constraint reported · monitor next 2 shipments for slippage",
            }
        )
    if metrics.late_delivery_rate >= 0.18:
        out.append(
            {
                "id": f"INC-{metrics.supplier[:2].upper()}-3",
                "supplier": metrics.supplier,
                "severity": "medium" if level in ("Low", "Medium") else "high",
                "time": (now - timedelta(days=14)).strftime("%b %d"),
                "headline": "OTIF below target",
                "detail": f"Late delivery rate {int(metrics.late_delivery_rate * 100)}% · tighten ASN and dock appointment windows",
            }
        )
    return out[:4]


def build_supplier_risk() -> dict:
    # Demo supplier feature set (realistic ranges, deterministic).
    suppliers = [
        SupplierMetrics(
            supplier="Apex Components",
            region="South",
            late_delivery_rate=0.21,
            disruption_frequency=2.8,
            lead_time_days=16,
            cost_volatility=0.48,
            region_instability=0.42,
        ),
        SupplierMetrics(
            supplier="Nova Plastics",
            region="West",
            late_delivery_rate=0.12,
            disruption_frequency=1.4,
            lead_time_days=11,
            cost_volatility=0.32,
            region_instability=0.28,
        ),
        SupplierMetrics(
            supplier="GreenLine Metals",
            region="North",
            late_delivery_rate=0.06,
            disruption_frequency=0.9,
            lead_time_days=9,
            cost_volatility=0.22,
            region_instability=0.18,
        ),
        SupplierMetrics(
            supplier="Orchid Electronics",
            region="East",
            late_delivery_rate=0.17,
            disruption_frequency=2.0,
            lead_time_days=14,
            cost_volatility=0.41,
            region_instability=0.36,
        ),
    ]

    enriched: list[dict] = []
    incidents: list[dict] = []
    for s in suppliers:
        score = _score(s)
        level = _risk_level(score)
        delay_p = _delay_probability(score)
        rec = _recommendation(level, delay_p, s)
        trend = _trend_series(score, s.supplier)
        inc = _incidents(s, score)
        incidents.extend(inc)
        enriched.append(
            {
                "supplier": s.supplier,
                "region": s.region,
                "risk_score": score,
                "risk_level": level,
                "delay_probability": delay_p,
                "recommendation": rec,
                "metrics": {
                    "late_delivery_rate": s.late_delivery_rate,
                    "disruption_frequency": s.disruption_frequency,
                    "lead_time_days": s.lead_time_days,
                    "cost_volatility": s.cost_volatility,
                    "region_instability": s.region_instability,
                },
                "trend": trend,
            }
        )

    enriched.sort(key=lambda x: x["risk_score"], reverse=True)
    best_alternate = sorted(enriched, key=lambda x: x["risk_score"])[0] if enriched else None
    alternate = (
        {
            "supplier": best_alternate["supplier"],
            "reason": f"Lowest modeled risk score ({best_alternate['risk_score']}) with delay probability {int(best_alternate['delay_probability'] * 100)}%.",
        }
        if best_alternate
        else None
    )

    recommended_mitigation = (
        f"Prioritize mitigation for {enriched[0]['supplier']}: confirm production slotting, reserve transport capacity, and uplift safety stock in {enriched[0]['region']}."
        if enriched
        else "No supplier mitigation guidance available."
    )

    return {
        "suppliers": enriched,
        "recommended_mitigation": recommended_mitigation,
        "alternate_supplier": alternate,
        "incidents": incidents[:8],
    }

