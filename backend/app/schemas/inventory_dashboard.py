from pydantic import BaseModel, Field


class InventoryOptimizationLine(BaseModel):
    sku_code: str
    site_name: str
    current_stock: float = Field(..., description="On-hand inventory (units)")
    forecast_demand_weekly: float = Field(..., description="Mean forecast demand per week")
    forecast_demand_annual: float = Field(..., description="Annualized mean demand (weekly × 52)")
    safety_stock: float
    reorder_point: float
    eoq: float = Field(..., description="Economic order quantity (units)")
    lead_time_weeks: float
    service_level: float
    recommendation: str


class InventoryDashboardResponse(BaseModel):
    items: list[InventoryOptimizationLine] = Field(default_factory=list)
    model_version: str = "classic-ss-rop-eoq-v1"
