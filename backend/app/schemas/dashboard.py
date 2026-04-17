from pydantic import BaseModel, Field


class KpiMetric(BaseModel):
    label: str
    value: str
    change_pct: float | None = None
    trend: str = "neutral"  # up | down | neutral (informational)
    polarity: str = "higher_is_better"  # lower_is_better for cost, late deliveries, emissions


class DashboardSummary(BaseModel):
    organization: str
    kpis: list[KpiMetric] = Field(default_factory=list)
    active_shipments: int = 0
    open_disruptions: int = 0
    forecast_accuracy_pct: float | None = None
