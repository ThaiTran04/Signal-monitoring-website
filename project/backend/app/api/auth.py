from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import User
from app.schemas.schemas import LoginRequest, LoginResponse, MeResponse
from app.services.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(user.username)
    return LoginResponse(access_token=token, username=user.username, role=user.role)


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    # Stateless JWT: logout is handled client-side by discarding the token.
    return {"ok": True}


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(username=user.username, role=user.role)
