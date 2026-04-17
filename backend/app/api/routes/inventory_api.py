from fastapi import APIRouter

from app.schemas.inventory_dashboard import InventoryDashboardResponse, InventoryOptimizationLine
from optimization_engine.inventory.engine import build_inventory_dashboard_rows

router = APIRouter()


@router.get("/dashboard", response_model=InventoryDashboardResponse)
def inventory_dashboard() -> InventoryDashboardResponse:
    """Safety stock, reorder point (ROP), EOQ, and recommendations per SKU/site."""
    rows = build_inventory_dashboard_rows()
    return InventoryDashboardResponse(
        items=[
            InventoryOptimizationLine(
                sku_code=r.sku_code,
                site_name=r.site_name,
                current_stock=r.current_stock,
                forecast_demand_weekly=r.forecast_demand_weekly,
                forecast_demand_annual=r.forecast_demand_annual,
                safety_stock=r.safety_stock,
                reorder_point=r.reorder_point,
                eoq=r.eoq,
                lead_time_weeks=r.lead_time_weeks,
                service_level=r.service_level,
                recommendation=r.recommendation,
            )
            for r in rows
        ],
    )
