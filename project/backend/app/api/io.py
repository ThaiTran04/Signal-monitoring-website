from datetime import datetime, timedelta, timezone, date as date_cls
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, IoHistory, User
from app.schemas.schemas import IoHistoryResponse, IoSegment, _as_utc_iso
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/machines", tags=["io"])

# Vietnam has no DST, so a fixed UTC+7 offset is safe/exact year-round.
# IoHistory.timestamp is always stored in UTC (device.py writes
# datetime.now(timezone.utc); SQLite then hands it back naive on read — see
# schemas.py's _as_utc_iso comment). The 24h timeline's `date` query param
# and its 00h-23h axis are both LOCAL (Vietnam) time, coming from the
# frontend's todayStr()/date input (browser-local). Without converting,
# every segment's start/end minute was computed straight from the UTC
# hour/minute, which silently shows every event 7 hours EARLIER on the
# chart than when it actually happened (e.g. a 14:24 local event rendered
# at the "07h" row) — and can shift a segment across the local day
# boundary entirely, making it look missing from "today".
VN_UTC_OFFSET = timedelta(hours=7)


def _to_local(dt: datetime) -> datetime:
    """Convert a UTC (naive or aware) DB timestamp to Vietnam local time."""
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt + VN_UTC_OFFSET


def _normalize_io_state(state: str | None) -> str:
    """IO-facing state is one of run/stop/error/unknown only. "offline" is a
    connection-status concept (see Setup/Connection + status.py) and must
    never leak into Dashboard IO / I/O Detail — anything else unexpected
    (missing row, legacy data, etc.) collapses to "unknown" instead."""
    if state in ("run", "stop", "error"):
        return state
    return "unknown"


@router.get("/{machine_id}/io")
def get_current_io(machine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Current snapshot for a machine: the aggregate run/stop/error/unknown
    `state` (derived purely from IN1-3, never "offline") PLUS the raw IN1-4
    digital-input readings from the ESP32's last `io` payload. `io_input*`
    is null when no `io` reading has ever been received for this machine —
    the frontend must treat that as Unknown/no-data, not as "off" (see
    MachineOut/device.py)."""
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    latest = (
        db.query(IoHistory)
        .filter(IoHistory.machine_id == machine_id)
        .order_by(IoHistory.timestamp.desc())
        .first()
    )
    return {
        "machine_id": machine_id,
        "state": _normalize_io_state(latest.state if latest else None),
        "timestamp": _as_utc_iso(latest.timestamp) if latest else None,
        "io_input1": m.io_input1,
        "io_input2": m.io_input2,
        "io_input3": m.io_input3,
        "io_input4": m.io_input4,
        "io_updated_at": _as_utc_iso(m.io_updated_at) if m.io_updated_at else None,
    }


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
        req_date = date_cls.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    # `date` is a LOCAL (Vietnam) calendar date. Translate local midnight ->
    # next local midnight into the matching UTC window before querying, since
    # IoHistory.timestamp is stored in UTC. Using the naive local boundaries
    # directly against UTC timestamps (the old code) shifted/dropped rows
    # near the day's edges by up to 7 hours.
    local_day_start = datetime.combine(req_date, datetime.min.time())
    day_start_utc = local_day_start - VN_UTC_OFFSET
    day_end_utc = day_start_utc + timedelta(days=1, seconds=-1)

    rows = (
        db.query(IoHistory)
        .filter(IoHistory.machine_id == machine_id,
                IoHistory.timestamp >= day_start_utc, IoHistory.timestamp <= day_end_utc)
        .order_by(IoHistory.timestamp.asc())
        .all()
    )

    if rows:
        segments = []
        now_local = _to_local(datetime.now(timezone.utc))
        is_today = req_date == now_local.date()
        for i, r in enumerate(rows):
            r_local = _to_local(r.timestamp)
            start_min = r_local.hour * 60 + r_local.minute
            if i + 1 < len(rows):
                nxt_local = _to_local(rows[i + 1].timestamp)
                end_min = nxt_local.hour * 60 + nxt_local.minute
                if end_min <= start_min:
                    # Next reading rolled into the next local day (row landed
                    # right at the local midnight edge) — clip to end-of-day
                    # instead of drawing a negative-length/wraparound segment.
                    end_min = 1440
            elif is_today:
                # Last known state for TODAY (local) — only draw up to "now",
                # not all the way to midnight. Time that hasn't happened yet
                # has no real reading and shouldn't be colored in.
                end_min = now_local.hour * 60 + now_local.minute
            else:
                # Last known state for a past (already-finished) local day —
                # that day is over, so it really did run out the clock.
                end_min = 1440
            if end_min > start_min:
                segments.append(
                    IoSegment(start_min=start_min, end_min=end_min, status=_normalize_io_state(r.state))
                )
    else:
        # No stored rows for this date — the device hasn't reported anything
        # for it (a day before the HMI started running, or a future date),
        # so there's nothing real to draw. Empty list -> chart stays blank
        # instead of fabricating a segment (not even an "unknown" one). Bars
        # only appear once real IN1/IN2/IN3 beacon readings come in from the
        # HMI via POST /api/device/update.
        segments = []

    return IoHistoryResponse(machine_id=machine_id, date=date, segments=segments)