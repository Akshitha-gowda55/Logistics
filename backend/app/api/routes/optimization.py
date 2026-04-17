from fastapi import APIRouter

from app.data.demo_sites import DEMO_SITES, PLANT
from app.schemas.optimization import (
    Co2CalculationResponse,
    Co2Leg,
    CostBreakdown,
    CostMinimizationResponse,
    RouteOptimizationResponse,
    Waypoint,
)
from optimization_engine.co2 import Co2Model, leg_emissions
from optimization_engine.cost import CostModel, minimize_transport_cost
from optimization_engine.routing import RouteOptimizer, optimize_route
from optimization_engine.routing.optimizer import _haversine_km

router = APIRouter()
_optimizer = RouteOptimizer()


@router.get("/route", response_model=RouteOptimizationResponse)
def route_optimization() -> RouteOptimizationResponse:
    stops = [s for s in DEMO_SITES if s.id != PLANT.id]
    ordered = optimize_route(PLANT, stops)
    sequence = [PLANT, *ordered]
    legs: list[tuple] = list(zip(sequence[:-1], sequence[1:]))
    distance_km = _optimizer.total_distance_km(legs)
    duration = _optimizer.duration_minutes(distance_km)
    cost_total, _ = minimize_transport_cost(distance_km, num_stops=len(stops), model=CostModel())
    co2_model = Co2Model()
    total_co2 = sum(leg_emissions(_haversine_km(a, b), co2_model) for a, b in legs)

    waypoints = [
        Waypoint(site_id=s.id, name=s.name, lat=s.lat, lon=s.lon, sequence=i) for i, s in enumerate(sequence)
    ]
    return RouteOptimizationResponse(
        route_name="Daily outbound — optimized stop order",
        total_distance_km=round(distance_km, 2),
        total_duration_minutes=duration,
        total_cost=cost_total,
        total_co2_kg=round(total_co2, 4),
        waypoints=waypoints,
    )


@router.get("/cost", response_model=CostMinimizationResponse)
def cost_minimization() -> CostMinimizationResponse:
    stops = [s for s in DEMO_SITES if s.id != PLANT.id]
    ordered = optimize_route(PLANT, stops)
    sequence = [PLANT, *ordered]
    legs = list(zip(sequence[:-1], sequence[1:]))
    opt_distance = _optimizer.total_distance_km(legs)
    naive_sequence = [PLANT, *stops]
    naive_legs = list(zip(naive_sequence[:-1], naive_sequence[1:]))
    baseline_distance = _optimizer.total_distance_km(naive_legs)
    model = CostModel()
    opt_cost, opt_break = minimize_transport_cost(opt_distance, len(stops), model)
    baseline_cost, _ = minimize_transport_cost(baseline_distance, len(stops), model)
    savings_pct = 0.0 if baseline_cost <= 0 else round((baseline_cost - opt_cost) / baseline_cost * 100, 2)
    return CostMinimizationResponse(
        baseline_cost=baseline_cost,
        optimized_cost=opt_cost,
        savings_pct=savings_pct,
        breakdown=[CostBreakdown(line_item=k, amount=v) for k, v in opt_break],
    )


@router.get("/co2", response_model=Co2CalculationResponse)
def co2_calculation() -> Co2CalculationResponse:
    stops = [s for s in DEMO_SITES if s.id != PLANT.id]
    ordered = optimize_route(PLANT, stops)
    sequence = [PLANT, *ordered]
    legs = list(zip(sequence[:-1], sequence[1:]))
    model = Co2Model()
    leg_rows: list[Co2Leg] = []
    total = 0.0
    total_tkm = 0.0
    for a, b in legs:
        d = _haversine_km(a, b)
        co2 = leg_emissions(d, model)
        total += co2
        total_tkm += model.load_tonnes * d
        leg_rows.append(Co2Leg(from_site=a.name, to_site=b.name, distance_km=round(d, 2), co2_kg=co2))
    denom = total_tkm if total_tkm > 0 else 1.0
    intensity = round(total / denom, 6)
    return Co2CalculationResponse(total_co2_kg=round(total, 4), intensity_kg_per_tonne_km=intensity, legs=leg_rows)
