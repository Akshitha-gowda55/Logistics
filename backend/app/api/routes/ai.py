from fastapi import APIRouter, Query

from ai_modules.demand_forecasting import DemandForecastingService
from ai_modules.disruption_prediction import DisruptionPredictionService
from ai_modules.inventory_optimization import InventoryOptimizationService
from app.data.demo_sites import DEMO_ORG_ID
from app.schemas.ai import (
    DemandForecastResponse,
    DisruptionPredictionResponse,
    DisruptionRisk,
    ForecastPoint,
    InventoryOptimizationResponse,
    InventoryRecommendation,
    SupplyDisruptionAlertOut,
)

router = APIRouter()

_forecast = DemandForecastingService()
_disruption = DisruptionPredictionService()
_inventory = InventoryOptimizationService()


@router.get("/demand-forecast", response_model=DemandForecastResponse)
def demand_forecast(sku_code: str = "BRG-440C", horizon_days: int = Query(default=14, ge=1, le=90)) -> DemandForecastResponse:
    pts = _forecast.forecast(sku_code, horizon_days)
    return DemandForecastResponse(
        sku_code=sku_code,
        horizon_days=horizon_days,
        points=[ForecastPoint(period=p.period, value=round(p.value, 2)) for p in pts],
        model_version=_forecast.model_version,
    )


@router.get("/disruption-prediction", response_model=DisruptionPredictionResponse)
def disruption_prediction(organization_id: str = DEMO_ORG_ID) -> DisruptionPredictionResponse:
    risks = _disruption.predict(organization_id)
    supply = _disruption.supply_alerts(organization_id)
    return DisruptionPredictionResponse(
        organization_id=organization_id,
        risks=[
            DisruptionRisk(
                title=r.title,
                category=r.category,
                severity=r.severity,
                probability=r.probability,
                affected_site=r.affected_site,
            )
            for r in risks
        ],
        supply_alerts=[
            SupplyDisruptionAlertOut(
                detection_type=a.detection_type,
                headline=a.headline,
                severity=a.severity,
                probability=a.probability,
                detail=a.detail,
                horizon_days=a.horizon_days,
            )
            for a in supply
        ],
    )


@router.get("/inventory-optimization", response_model=InventoryOptimizationResponse)
def inventory_optimization() -> InventoryOptimizationResponse:
    recs = _inventory.recommend()
    return InventoryOptimizationResponse(
        recommendations=[
            InventoryRecommendation(
                sku_code=r.sku_code,
                site_name=r.site_name,
                current_qty=r.current_qty,
                target_qty=r.target_qty,
                rationale=r.rationale,
            )
            for r in recs
        ]
    )
