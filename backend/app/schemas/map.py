from pydantic import BaseModel


class MapSite(BaseModel):
    id: str
    name: str
    site_type: str
    latitude: float
    longitude: float
