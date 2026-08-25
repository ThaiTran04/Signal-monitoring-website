from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, ConnectionHistory, User
from app.schemas.schemas import ConnectionHistoryOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/connection-history", tags=["connection-history"])


@router.get("", response_model=list[ConnectionHistoryOut])
def list_connection_history(
    machine_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, description="Machine name search"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ConnectionHistory, Machine).join(Machine, Machine.id == ConnectionHistory.machine_id)
    if machine_id:
        q = q.filter(ConnectionHistory.machine_id == machine_id)
    if search:
        q = q.filter(Machine.machine_name.ilike(f"%{search}%"))
    if date:
        day_start = datetime.fromisoformat(date)
        day_end = day_start.replace(hour=23, minute=59, second=59)
        q = q.filter(
            ((ConnectionHistory.disconnected_at >= day_start) & (ConnectionHistory.disconnected_at <= day_end))
            | ((ConnectionHistory.connected_at >= day_start) & (ConnectionHistory.connected_at <= day_end))
        )
    rows = q.order_by(ConnectionHistory.disconnected_at.desc().nullslast()).limit(500).all()

    out = []
    for ch, m in rows:
        out.append(ConnectionHistoryOut(
            id=ch.id, machine_id=m.id, machine_name=m.machine_name,
            mac_address=m.mac_address, ip_address=m.ip_address,
            connected_at=ch.connected_at, disconnected_at=ch.disconnected_at,
            duration_min=ch.duration_min, reason=ch.reason,
        ))
    return out
