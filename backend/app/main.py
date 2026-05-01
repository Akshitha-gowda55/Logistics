from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.migrate_simple_pipeline import migrate_workflows_to_simple_pipeline
from app.db.seed import ensure_demo_accounts, seed_demo_data
from app.db.sqlite_control_tower_columns import ensure_workflow_control_tower_columns
from app.db.sqlite_shipment_entry_columns import ensure_workflow_shipment_entry_columns
from app.db.sqlite_user_entered_column import ensure_workflow_user_entered_column
from app.db.sqlite_workflow_display_columns import backfill_workflow_item_names, ensure_workflow_display_columns
from app.db.purge_demo_workflows import purge_demo_workflows
from app.db.session import SessionLocal, engine
from app.models import entities  # noqa: F401

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_workflow_control_tower_columns(engine)
    ensure_workflow_shipment_entry_columns(engine)
    ensure_workflow_user_entered_column(engine)
    ensure_workflow_display_columns(engine)
    migrate_workflows_to_simple_pipeline(engine)
    with SessionLocal() as db:
        purge_demo_workflows(db)
        seed_demo_data(db)
        ensure_demo_accounts(db)
    backfill_workflow_item_names(SessionLocal)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": settings.app_name, "docs": "/docs", "api": settings.api_v1_prefix}
