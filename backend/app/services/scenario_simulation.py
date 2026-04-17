"""Deterministic what-if deltas vs India baseline (₹ Cr, tons CO₂)."""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.scenario import KPISnapshot, ScenarioId, ScenarioSimulationResponse


@dataclass(frozen=True)
class _Baseline:
    service_level_pct: float = 96.0
    cost_crore_inr: float = 1.2
    delay_shipments: int = 8
    co2_tonnes: float = 18.0


BASELINE = _Baseline()


@dataclass(frozen=True)
class _ScenarioDef:
    label: str
    description: str
    d_service_level_pp: float
    cost_factor: float
    d_delay: int
    co2_factor: float


SCENARIOS: dict[ScenarioId, _ScenarioDef] = {
    ScenarioId.port_closure: _ScenarioDef(
        label="Port closure",
        description="Gateway congestion (e.g. Nhava Sheva window); reroutes and feeder delays.",
        d_service_level_pp=-3.9,
        cost_factor=1.14,
        d_delay=5,
        co2_factor=1.09,
    ),
    ScenarioId.supplier_shutdown: _ScenarioDef(
        label="Supplier shutdown",
        description="Single-source supplier halt; emergency buy + premium freight to protect lines.",
        d_service_level_pp=-5.1,
        cost_factor=1.23,
        d_delay=7,
        co2_factor=1.05,
    ),
    ScenarioId.demand_spike: _ScenarioDef(
        label="Demand spike",
        description="+18% demand vs plan for 4 weeks; overtime lanes and partial air uplift.",
        d_service_level_pp=-1.6,
        cost_factor=1.19,
        d_delay=4,
        co2_factor=1.14,
    ),
    ScenarioId.transport_delay: _ScenarioDef(
        label="Transport delay",
        description="Network-wide dwell +12h avg; carrier capacity binding on NH corridors.",
        d_service_level_pp=-2.8,
        cost_factor=1.06,
        d_delay=6,
        co2_factor=1.03,
    ),
}


def _clamp_sl(v: float) -> float:
    return max(72.0, min(99.7, round(v, 2)))


def _apply(definition: _ScenarioDef) -> KPISnapshot:
    b = BASELINE
    sl = _clamp_sl(b.service_level_pct + definition.d_service_level_pp)
    cost = round(b.cost_crore_inr * definition.cost_factor, 2)
    delay = max(0, b.delay_shipments + definition.d_delay)
    co2 = round(b.co2_tonnes * definition.co2_factor, 1)
    return KPISnapshot(
        service_level_pct=sl,
        cost_crore_inr=cost,
        delay_shipments=delay,
        co2_tonnes=co2,
    )


def run_simulation(scenario_id: ScenarioId) -> ScenarioSimulationResponse:
    definition = SCENARIOS[scenario_id]
    b = BASELINE
    baseline = KPISnapshot(
        service_level_pct=b.service_level_pct,
        cost_crore_inr=b.cost_crore_inr,
        delay_shipments=b.delay_shipments,
        co2_tonnes=b.co2_tonnes,
    )
    simulated = _apply(definition)
    return ScenarioSimulationResponse(
        scenario_id=scenario_id.value,
        scenario_label=definition.label,
        description=definition.description,
        baseline=baseline,
        simulated=simulated,
    )


def list_scenarios() -> list[tuple[str, str]]:
    return [(sid.value, SCENARIOS[sid].label) for sid in ScenarioId]
