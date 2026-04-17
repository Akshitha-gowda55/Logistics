from fastapi import APIRouter

from app.schemas.dashboard import DashboardSummary, KpiMetric

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary() -> DashboardSummary:
    return DashboardSummary(
        organization="India Logistics Network",
        kpis=[
            KpiMetric(
                label="Service level",
                value="96%",
                change_pct=0.4,
                trend="up",
                polarity="higher_is_better",
            ),
            KpiMetric(
                label="Total cost",
                value="₹1.2 Cr",
                change_pct=-2.1,
                trend="down",
                polarity="lower_is_better",
            ),
            KpiMetric(
                label="Late deliveries",
                value="8",
                change_pct=-12.0,
                trend="down",
                polarity="lower_is_better",
            ),
            KpiMetric(
                label="CO₂ emissions",
                value="18 tons",
                change_pct=-2.8,
                trend="down",
                polarity="lower_is_better",
            ),
        ],
        active_shipments=28,
        open_disruptions=2,
        forecast_accuracy_pct=90.2,
    )
