from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import UserModel
from app.models.enums import UserRole

# Canonical demo logins (password for all: demo1234). Re-synced on every API startup so local DBs always work.
_DEMO_ACCOUNTS: tuple[tuple[str, str, UserRole], ...] = (
    ("executive@smartflow.ai", "Aarav Mehta", UserRole.executive),
    ("operations@smartflow.ai", "Priya Sharma", UserRole.operations),
    ("inventory@smartflow.ai", "Rohan Kapoor", UserRole.inventory),
    ("supplier@smartflow.ai", "Neha Iyer", UserRole.supplier_risk),
)


def ensure_demo_accounts(db: Session) -> None:
    """Create or repair demo users so login always works (password demo1234)."""
    demo_pw = hash_password("demo1234")
    for email, name, role in _DEMO_ACCOUNTS:
        u = db.scalar(select(UserModel).where(func.lower(UserModel.email) == email.lower()))
        if u is None:
            db.add(
                UserModel(
                    name=name,
                    email=email,
                    password_hash=demo_pw,
                    role=role,
                    is_active=True,
                )
            )
        else:
            u.password_hash = demo_pw
            u.is_active = True
            u.role = role
            u.name = name
    db.commit()


def seed_demo_data(db: Session) -> None:
    """Do not seed shipments, routes, or sample parts — only ensure_demo_accounts creates logins."""
    _ = db
