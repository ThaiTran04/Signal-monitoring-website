from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, HmiLoginHistory, User
from app.schemas.schemas import HmiLoginHistoryOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/hmi-login-history", tags=["hmi-login-history"])


@router.get("", response_model=list[HmiLoginHistoryOut])
def list_hmi_login_history(
    machine_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(HmiLoginHistory, Machine).join(Machine, Machine.id == HmiLoginHistory.machine_id)
    if machine_id:
        q = q.filter(HmiLoginHistory.machine_id == machine_id)
    rows = q.order_by(HmiLoginHistory.login_at.desc()).limit(500).all()
    return [
        HmiLoginHistoryOut(
            id=h.id, machine_id=m.id, machine_name=m.machine_name,
            username=h.username, login_at=h.login_at, logout_at=h.logout_at,
        )
        for h, m in rows
    ]
