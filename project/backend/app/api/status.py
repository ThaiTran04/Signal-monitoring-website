from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, MachineStatus, User
from app.schemas.schemas import StatusOut, StatusSummary
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/machines", tags=["status"])


@router.get("/{machine_id}/status", response_model=StatusOut)
def get_status(machine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    st = (
        db.query(MachineStatus)
        .filter(MachineStatus.machine_id == machine_id)
        .order_by(MachineStatus.timestamp.desc())
        .first()
    )
    if not st:
        raise HTTPException(status_code=404, detail="No status recorded")
    return StatusOut(
        machine_id=m.id, machine_name=m.machine_name, status=st.status,
        wifi_connected=st.wifi_connected, server_connected=st.server_connected,
        rssi=st.rssi, timestamp=st.timestamp,
    )


@router.get("/status/summary", response_model=StatusSummary)
def status_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    machines = db.query(Machine).all()
    counts = {"run": 0, "stop": 0, "error": 0, "unknown": 0, "offline": 0}
    for m in machines:
        st = (
            db.query(MachineStatus)
            .filter(MachineStatus.machine_id == m.id)
            .order_by(MachineStatus.timestamp.desc())
            .first()
        )
        status = st.status if st else "offline"
        counts[status] = counts.get(status, 0) + 1
    return StatusSummary(total=len(machines), **counts)
