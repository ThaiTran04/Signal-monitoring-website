from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import User, Machine, HmiLoginHistory
from app.schemas.schemas import LoginRequest, LoginResponse, MeResponse
from app.services.auth import verify_password, create_access_token, get_current_user
from app.websocket.manager import manager

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(user.username)

    # Mark every registered machine's HMI session as logged-in for this admin
    # user, and open a HmiLoginHistory row per machine (skipped for machines
    # that already have an open row for this user, so re-logging-in from a
    # second tab doesn't spam duplicate history entries). This is what
    # drives the "Login"/"Logout" badge in Setup > Device Management and the
    # "Login" summary card — both simply read Machine.hmi_login.
    now = datetime.now(timezone.utc)
    machines = db.query(Machine).all()
    for m in machines:
        open_row = (
            db.query(HmiLoginHistory)
            .filter(HmiLoginHistory.machine_id == m.id, HmiLoginHistory.logout_at.is_(None))
            .first()
        )
        if not open_row:
            db.add(HmiLoginHistory(machine_id=m.id, username=user.username, login_at=now))
        m.hmi_login = True
    db.commit()

    for m in machines:
        await manager.broadcast({
            "type": "hmi_login_update",
            "machine_id": m.id,
            "machine_name": m.machine_name,
            "hmi_login": True,
            "timestamp": now.isoformat(),
        })

    return LoginResponse(access_token=token, username=user.username, role=user.role)


@router.post("/logout")
async def logout(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Close out every open HMI session for this user and flip Machine.hmi_login
    # back to False, so Setup > Device Management reflects "Logout" again as
    # soon as the admin signs out.
    now = datetime.now(timezone.utc)
    open_rows = (
        db.query(HmiLoginHistory)
        .filter(HmiLoginHistory.username == user.username, HmiLoginHistory.logout_at.is_(None))
        .all()
    )
    machine_ids = {row.machine_id for row in open_rows}
    for row in open_rows:
        row.logout_at = now
    if machine_ids:
        db.query(Machine).filter(Machine.id.in_(machine_ids)).update(
            {Machine.hmi_login: False}, synchronize_session=False
        )
    db.commit()

    for machine_id in machine_ids:
        m = db.query(Machine).filter(Machine.id == machine_id).first()
        await manager.broadcast({
            "type": "hmi_login_update",
            "machine_id": machine_id,
            "machine_name": m.machine_name if m else None,
            "hmi_login": False,
            "timestamp": now.isoformat(),
        })

    return {"ok": True}


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(username=user.username, role=user.role)
