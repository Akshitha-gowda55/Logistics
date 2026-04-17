from pydantic import BaseModel, Field


class SupplyDisruptionAlertOut(BaseModel):
    detection_type: str = Field(
        ...,
        description="supplier_delay | shipment_delay | inventory_shortage",
    )
    headline: str
    severity: str
    probability: float
    detail: str
    horizon_days: int | None = None


class ForecastPoint(BaseModel):
    period: str
    value: float


class DemandForecastResponse(BaseModel):
    sku_code: str
    horizon_days: int
    points: list[ForecastPoint] = Field(default_factory=list)
    model_version: str


class DisruptionRisk(BaseModel):
    title: str
    category: str
    severity: str
    probability: float
    affected_site: str | None = None


class DisruptionPredictionResponse(BaseModel):
    organization_id: str
    risks: list[DisruptionRisk] = Field(default_factory=list)
    supply_alerts: list[SupplyDisruptionAlertOut] = Field(
        default_factory=list,
        description="Supply disruption prediction: supplier delay, shipment delay, inventory shortage",
    )


class InventoryRecommendation(BaseModel):
    sku_code: str
    site_name: str
    current_qty: float
    target_qty: float
    rationale: str


class InventoryOptimizationResponse(BaseModel):
    recommendations: list[InventoryRecommendation] = Field(default_factory=list)
