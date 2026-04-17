"""Demand forecast HTTP API backed by LightGBM (see ai_modules.demand_forecasting.forecast_model)."""

from fastapi import APIRouter, Query

from ai_modules.demand_forecasting.forecast_model import train_predict_lightgbm
from app.schemas.forecast import ForecastChartResponse, ForecastPointOut, HistoryPoint

router = APIRouter()


@router.get("/chart", response_model=ForecastChartResponse)
def forecast_chart(
    plant: str = Query(default="FDH", description="Plant / site code"),
    part: str = Query(default="BRG-440C", description="Part / SKU code"),
    history_weeks: int = Query(default=80, ge=40, le=200),
    horizon_weeks: int = Query(default=8, ge=1, le=26),
) -> ForecastChartResponse:
    history, forecast, version = train_predict_lightgbm(
        plant,
        part,
        history_weeks=history_weeks,
        horizon_weeks=horizon_weeks,
        history_tail_for_chart=24,
    )
    return ForecastChartResponse(
        plant=plant,
        part=part,
        model_version=version,
        history=[HistoryPoint(week=h.week_label, demand=h.demand) for h in history],
        forecast=[
            ForecastPointOut(
                week=f.week_label,
                predicted_demand=f.predicted_demand,
                confidence=f.confidence,
                lower=f.lower,
                upper=f.upper,
            )
            for f in forecast
        ],
    )
