from pydantic import BaseModel, Field


class HistoryPoint(BaseModel):
    week: str
    demand: float


class ForecastPointOut(BaseModel):
    week: str
    predicted_demand: float
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score")
    lower: float
    upper: float


class ForecastChartResponse(BaseModel):
    plant: str
    part: str
    model_version: str
    history: list[HistoryPoint] = Field(default_factory=list)
    forecast: list[ForecastPointOut] = Field(default_factory=list)
