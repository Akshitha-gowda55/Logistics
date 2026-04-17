from pydantic import BaseModel, Field


class Waypoint(BaseModel):
    site_id: str
    name: str
    lat: float
    lon: float
    sequence: int


class RouteOptimizationResponse(BaseModel):
    route_name: str
    total_distance_km: float
    total_duration_minutes: int
    total_cost: float = Field(..., description="Total transport cost in Indian Rupees (₹)")
    total_co2_kg: float
    waypoints: list[Waypoint] = Field(default_factory=list)


class CostBreakdown(BaseModel):
    line_item: str
    amount: float = Field(..., description="Amount in Indian Rupees (₹)")


class CostMinimizationResponse(BaseModel):
    baseline_cost: float = Field(..., description="Baseline cost in Indian Rupees (₹)")
    optimized_cost: float = Field(..., description="Optimized cost in Indian Rupees (₹)")
    savings_pct: float
    breakdown: list[CostBreakdown] = Field(default_factory=list)


class Co2Leg(BaseModel):
    from_site: str
    to_site: str
    distance_km: float
    co2_kg: float


class Co2CalculationResponse(BaseModel):
    total_co2_kg: float
    intensity_kg_per_tonne_km: float
    legs: list[Co2Leg] = Field(default_factory=list)
