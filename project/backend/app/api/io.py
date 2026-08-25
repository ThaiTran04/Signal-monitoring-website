from datetime import datetime, date as date_cls
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, IoHistory, User
from app.schemas.schemas import IoHistoryResponse, IoSegment
from app.services.auth import get_current_user
from app.services import mock_data as md

router = APIRouter(prefix="/api/machines", tags=["io"])


@router.get("/{machine_id}/io")
def get_current_io(machine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    latest = (
        db.query(IoHistory)
        .filter(IoHistory.machine_id == machine_id)
        .order_by(IoHistory.timestamp.desc())
        .first()
    )
    return {"machine_id": machine_id, "state": latest.state if latest else "offline",
            "timestamp": latest.timestamp if latest else None}


@router.get("/{machine_id}/io/history", response_model=IoHistoryResponse)
def get_io_history(
    machine_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    try:
        date_cls.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    day_start = datetime.fromisoformat(date)
    day_end = day_start.replace(hour=23, minute=59, second=59)

    rows = (
        db.query(IoHistory)
        .filter(IoHistory.machine_id == machine_id,
                IoHistory.timestamp >= day_start, IoHistory.timestamp <= day_end)
        .order_by(IoHistory.timestamp.asc())
        .all()
    )

    if rows:
        segments = []
        for i, r in enumerate(rows):
            start_min = r.timestamp.hour * 60 + r.timestamp.minute
            if i + 1 < len(rows):
                nxt = rows[i + 1]
                end_min = nxt.timestamp.hour * 60 + nxt.timestamp.minute
            else:
                end_min = 1440
            segments.append(IoSegment(start_min=start_min, end_min=end_min, status=r.state))
    else:
        # No stored rows for this date (e.g. historical/mock date) -> deterministic mock fallback
        segments = [IoSegment(**s) for s in md.get_segments(machine_id, date)]

    return IoHistoryResponse(machine_id=machine_id, date=date, segments=segments)
