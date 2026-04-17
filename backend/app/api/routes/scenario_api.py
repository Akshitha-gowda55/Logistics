from fastapi import APIRouter, Query

from app.schemas.scenario import ScenarioId, ScenarioSimulationResponse
from app.services.scenario_simulation import list_scenarios, run_simulation

router = APIRouter()


@router.get("/simulation", response_model=ScenarioSimulationResponse)
def scenario_simulation(
    scenario: ScenarioId = Query(default=ScenarioId.port_closure, description="What-if scenario"),
) -> ScenarioSimulationResponse:
    return run_simulation(scenario)


@router.get("/types")
def scenario_types() -> list[dict[str, str]]:
    return [{"id": i, "label": lab} for i, lab in list_scenarios()]
