from fastapi import APIRouter, Query

from app.schemas.route_dashboard import RouteDashboardResponse
from app.services.route_dashboard import build_route_dashboard

router = APIRouter()


@router.get("/route-dashboard", response_model=RouteDashboardResponse)
def route_dashboard(
    source: str | None = Query(None, description="Origin city or hub name (India)"),
    destination: str | None = Query(None, description="Destination city or hub name (India)"),
) -> RouteDashboardResponse:
    """Multi-route optimization context for the Mapbox dashboard (Mapbox geometries optional)."""
    return build_route_dashboard(source=source, destination=destination)
