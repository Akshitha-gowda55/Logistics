from fastapi import APIRouter

from app.data.india_locations import all_india_sites
from app.schemas.map import MapSite

router = APIRouter()


@router.get("/sites", response_model=list[MapSite])
def map_sites() -> list[MapSite]:
    return [
        MapSite(
            id=s.id,
            name=s.map_label,
            site_type=s.location_type,
            latitude=s.lat,
            longitude=s.lon,
        )
        for s in all_india_sites()
    ]
