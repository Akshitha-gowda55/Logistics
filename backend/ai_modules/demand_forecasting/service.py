"""Demand forecasting — pluggable models; baseline uses damped trend on synthetic series."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class ForecastPoint:
    period: str
    value: float


class DemandForecastingService:
    model_version = "baseline-v0.1"

    def forecast(self, sku_code: str, horizon_days: int = 14) -> list[ForecastPoint]:
        horizon_days = max(1, min(horizon_days, 90))
        base = 120.0 + (abs(hash(sku_code)) % 50)
        points: list[ForecastPoint] = []
        today = date.today()
        for i in range(horizon_days):
            d = today + timedelta(days=i)
            seasonal = 8 * (1 if i % 7 < 5 else -1)
            trend = i * 0.6
            noise = (abs(hash(sku_code + str(i))) % 17) - 8
            points.append(ForecastPoint(period=d.isoformat(), value=max(0, base + seasonal + trend + noise)))
        return points
