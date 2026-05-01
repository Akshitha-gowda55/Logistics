from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Logistics AI Platform API"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional: enables Mapbox Directions multi-route geometries on /route-dashboard
    mapbox_access_token: str | None = None
    # Default off: India demo uses static lightweight polylines for fast API + predictable ₹ metrics
    use_mapbox_directions: bool = False
    # Preferred: OpenRouteService (driving-car) or GraphHopper for real road geometry
    openrouteservice_api_key: str | None = None
    graphhopper_api_key: str | None = None
    graphhopper_base_url: str = "https://graphhopper.com/api/1"
    # Twilio SMS (optional)
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None
    sms_phone_operations: str | None = None
    sms_phone_inventory: str | None = None
    sms_phone_supplier: str | None = None
    sms_phone_executive: str | None = None
    auth_secret_key: str = "change-this-in-production"
    auth_algorithm: str = "HS256"
    auth_access_token_expire_minutes: int = 120
    database_url: str = "sqlite:///./smartflow_ai.db"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
