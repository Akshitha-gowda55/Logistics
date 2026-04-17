from enum import Enum

from pydantic import BaseModel, Field


class ScenarioId(str, Enum):
    port_closure = "port_closure"
    supplier_shutdown = "supplier_shutdown"
    demand_spike = "demand_spike"
    transport_delay = "transport_delay"


class KPISnapshot(BaseModel):
    service_level_pct: float = Field(..., description="On-time / fill-rate proxy %")
    cost_crore_inr: float = Field(..., description="Network logistics cost in ₹ Crore (1.0 = ₹1 Cr)")
    delay_shipments: int = Field(..., description="Late or at-risk shipment count")
    co2_tonnes: float = Field(..., description="Period CO₂ t CO₂e")


class ScenarioSimulationResponse(BaseModel):
    scenario_id: str
    scenario_label: str
    description: str
    baseline: KPISnapshot
    simulated: KPISnapshot
