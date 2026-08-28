from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.models import Machine, MachineStatus, User, ConnectionHistory
from app.schemas.schemas import MachineCreate, MachineUpdate, MachineOut, MachineListResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/machines", tags=["machines"])


def _latest_status(db: Session, machine_id: int) -> MachineStatus | None:
    return (
        db.query(MachineStatus)
        .filter(MachineStatus.machine_id == machine_id)
        .order_by(MachineStatus.timestamp.desc())
        .first()
    )


def _to_out(db: Session, m: Machine) -> MachineOut:
    st = _latest_status(db, m.id)
    status = st.status if st else "offline"
    offline_since = None
    if status == "offline":
        last_conn = (
            db.query(ConnectionHistory)
            .filter(ConnectionHistory.machine_id == m.id, ConnectionHistory.disconnected_at.isnot(None))
            .order_by(ConnectionHistory.disconnected_at.desc())
            .first()
        )
        offline_since = last_conn.disconnected_at if last_conn else None
    return MachineOut(
        id=m.id, machine_name=m.machine_name, mac_address=m.mac_address,
        ip_address=m.ip_address, firmware_version=m.firmware_version,
        hmi_version=m.hmi_version, hmi_login=m.hmi_login,
        status=status, offline_since=offline_since,
        io_input1=m.io_input1, io_input2=m.io_input2,
        io_input3=m.io_input3, io_input4=m.io_input4,
        io_updated_at=m.io_updated_at,
    )


@router.get("", response_model=MachineListResponse)
def list_machines(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Machine)
    if search:
        like = f"%{search}%"
        q = q.filter(Machine.machine_name.ilike(like))
    machines = q.order_by(Machine.id.asc()).all()

    outs = [_to_out(db, m) for m in machines]
    if status_filter:
        outs = [o for o in outs if o.status == status_filter]

    total = len(outs)
    start = (page - 1) * page_size
    outs = outs[start:start + page_size]
    return MachineListResponse(items=outs, total=total)


@router.get("/{machine_id}", response_model=MachineOut)
def get_machine(machine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    return _to_out(db, m)


@router.post("", response_model=MachineOut, status_code=201)
def create_machine(payload: MachineCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.query(Machine).filter(Machine.machine_name == payload.machine_name).first():
        raise HTTPException(status_code=400, detail="machine_name already exists")
    m = Machine(**payload.dict())
    db.add(m)
    db.commit()
    db.refresh(m)
    db.add(MachineStatus(machine_id=m.id, status="offline", wifi_connected=False, server_connected=False))
    db.commit()
    return _to_out(db, m)


@router.put("/{machine_id}", response_model=MachineOut)
def update_machine(machine_id: int, payload: MachineUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _to_out(db, m)


@router.delete("/{machine_id}", status_code=204)
def delete_machine(machine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(Machine).filter(Machine.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")
    db.delete(m)
    db.commit()
    return None
