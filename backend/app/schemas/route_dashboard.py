from pydantic import BaseModel, Field


class MapLocation(BaseModel):
    id: str
    name: str
    location_type: str
    longitude: float
    latitude: float


class RouteSuggestion(BaseModel):
    id: str
    label: str
    coordinates: list[list[float]] = Field(
        ...,
        description="GeoJSON-style positions [longitude, latitude] along the path",
    )
    duration_hours: float
    cost_inr: float = Field(..., description="Transport cost in ₹")
    co2_kg: float
    is_best: bool = False
    distance_km: float = 0.0


class RouteDashboardResponse(BaseModel):
    locations: list[MapLocation]
    routes: list[RouteSuggestion]
    best_route_id: str
    mapbox_routes_used: bool = Field(
        default=False,
        description="True when geometries came from Mapbox Directions API",
    )
