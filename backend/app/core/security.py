from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

UTC = timezone.utc
from collections.abc import Iterable
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.schemas.workflow_system import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: int, role: UserRole) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.auth_access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "jti": str(uuid4()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm=settings.auth_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.auth_secret_key, algorithms=[settings.auth_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def require_role(user_role: UserRole, allowed_roles: Iterable[UserRole]) -> None:
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this resource.",
        )
