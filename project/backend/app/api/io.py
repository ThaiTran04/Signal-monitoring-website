from datetime import datetime, timezone, date as date_cls
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, IoHistory, User
from app.schemas.schemas import IoHistoryResponse, IoSegment
from app.services.auth import get_current_user

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
            elif date == datetime.now(timezone.utc).date().isoformat():
                # Last known state for TODAY — only draw up to "now", not all
                # the way to midnight. Time that hasn't happened yet has no
                # real reading and shouldn't be colored in. UTC to match how
                # timestamps are written in device.py (datetime.now(timezone.utc)).
                now_utc = datetime.now(timezone.utc)
                end_min = now_utc.hour * 60 + now_utc.minute
            else:
                # Last known state for a past (already-finished) day — that
                # day is over, so it really did run out the clock.
                end_min = 1440
            if end_min > start_min:
                segments.append(IoSegment(start_min=start_min, end_min=end_min, status=r.state))
    else:
        # No stored rows for this date — the device hasn't reported anything
        # for it (a day before the HMI started running, or a future date),
        # so there's nothing real to draw. Empty list -> chart stays blank
        # instead of fabricating a segment (even an "offline" one). Bars only
        # appear once real IN1/IN2/IN3 beacon readings come in from the HMI
        # via POST /api/device/update.
        segments = []

    return IoHistoryResponse(machine_id=machine_id, date=date, segments=segments)