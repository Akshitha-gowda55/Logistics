from fastapi import APIRouter

from app.api.routes import (
    ai,
    auth,
    dashboard,
    forecast_api,
    health,
    inventory_api,
    map as map_routes,
    optimization,
    route_dashboard,
    scenario_api,
    workflow_system,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(map_routes.router, prefix="/map", tags=["map"])
api_router.include_router(route_dashboard.router, prefix="/routes", tags=["routes"])
api_router.include_router(forecast_api.router, prefix="/forecast", tags=["forecast"])
api_router.include_router(inventory_api.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(scenario_api.router, prefix="/scenarios", tags=["scenarios"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(optimization.router, prefix="/optimization", tags=["optimization"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workflow_system.router, tags=["workflow-system"])
