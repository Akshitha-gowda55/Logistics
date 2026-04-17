from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, decode_access_token, verify_password
from app.db.session import get_db
from app.schemas.workflow_system import LoginRequest, LoginResponse, LogoutResponse, UserPublic
from app.services.workflow_engine import engine

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = engine.find_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        user=UserPublic(id=user.id, name=user.name, email=user.email, role=user.role),
    )


@router.get("/me", response_model=UserPublic)
def me(user=Depends(get_current_user)) -> UserPublic:
    return UserPublic(id=user.id, name=user.name, email=user.email, role=user.role)


@router.post("/logout", response_model=LogoutResponse)
def logout(authorization: str = Header(default=""), user=Depends(get_current_user)) -> LogoutResponse:
    _ = user
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.replace("Bearer ", "", 1).strip()
    payload = decode_access_token(token)
    jti = payload.get("jti")
    if jti:
        engine.revoked_token_jti.add(jti)
    return LogoutResponse(message="Logged out successfully")
