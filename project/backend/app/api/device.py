from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.database.db import get_db
from app.models.models import Machine, MachineStatus, IoHistory, ConnectionHistory, HmiLoginHistory
from app.schemas.schemas import DeviceUpdatePayload, DeviceHmiLoginPayload, DeviceHmiLogoutPayload
from app.websocket.manager import manager

router = APIRouter(prefix="/api/device", tags=["device"])

STATUS_MAP = {"RUNNING": "run", "STOPPED": "stop", "ERROR": "error", "UNKNOWN": "unknown", "OFFLINE": "offline"}


def _io_state_from_bits(in1, in2, in3) -> str:
    """IO-only state, derived strictly from the raw beacon inputs IN1-3 —
    completely independent of the connection-tracking `status`/"offline"
    concept above (that stays in MachineStatus/ConnectionHistory for
    Setup/Connection, untouched). Priority matches the physical beacon:
    IN1 (error/red) > IN2 (stop/yellow) > IN3 (run/green). No input set
    (or no reading at all, i.e. None) -> "unknown", never "offline"."""
    if in1:
        return "error"
    if in2:
        return "stop"
    if in3:
        return "run"
    return "unknown"


def _write_device_update(db: Session, payload: DeviceUpdatePayload, now: datetime) -> dict:
    """All the blocking DB work for a device update. Runs off the event loop
    (see device_update() below) so one slow/locked SQLite write can't stall
    every other request the server is handling at the same time."""
    status = STATUS_MAP.get(payload.status.upper(), "offline")

    m = db.query(Machine).filter(Machine.mac_address == payload.mac).first()
    if not m:
        m = Machine(
            machine_name=payload.machine, mac_address=payload.mac, ip_address=payload.ip,
            firmware_version="unknown", hmi_version="unknown", hmi_login=False,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
    else:
        m.ip_address = payload.ip
        m.updated_at = now

    # Persist the raw digital-input readings (IN1-4) if this push included
    # them. If `io` was omitted, leave the previous reading in place rather
    # than overwriting it with a guess — absence of data isn't the same as
    # "all inputs off". See DeviceIoPayload/MachineOut in schemas.py.
    if payload.io is not None:
        m.io_input1 = bool(payload.io.input1)
        m.io_input2 = bool(payload.io.input2)
        m.io_input3 = bool(payload.io.input3)
        m.io_input4 = bool(payload.io.input4)
        m.io_updated_at = now

    prev_status_row = (
        db.query(MachineStatus)
        .filter(MachineStatus.machine_id == m.id)
        .order_by(MachineStatus.timestamp.desc())
        .first()
    )
    prev_status = prev_status_row.status if prev_status_row else None

    db.add(MachineStatus(
        machine_id=m.id, status=status,
        wifi_connected=payload.wifi_connected, server_connected=payload.server_connected,
        rssi=payload.rssi, timestamp=now,
    ))
    # IoHistory (the Dashboard IO / Machine Detail I/O chart) never uses the
    # connection "status"/"offline" value above — it's keyed purely off
    # IN1/IN2/IN3, so an "offline" reading can never appear there.
    io_state = _io_state_from_bits(m.io_input1, m.io_input2, m.io_input3)
    db.add(IoHistory(machine_id=m.id, state=io_state, timestamp=now))

    # Track connect/disconnect transitions
    if prev_status != "offline" and status == "offline":
        db.add(ConnectionHistory(machine_id=m.id, connected_at=None, disconnected_at=now, duration_min=None, reason="device_reported_offline"))
    elif prev_status == "offline" and status != "offline":
        open_row = (
            db.query(ConnectionHistory)
            .filter(ConnectionHistory.machine_id == m.id, ConnectionHistory.connected_at.is_(None))
            .order_by(ConnectionHistory.disconnected_at.desc())
            .first()
        )
        if open_row and open_row.disconnected_at:
            disc_at = open_row.disconnected_at
            if disc_at.tzinfo is None:  # SQLite can hand back naive datetimes
                disc_at = disc_at.replace(tzinfo=timezone.utc)
            open_row.connected_at = now
            open_row.duration_min = int((now - disc_at).total_seconds() // 60)

    db.commit()

    return {
        "machine_id": m.id,
        "machine_name": m.machine_name,
        "status": status,
        "io_input1": m.io_input1,
        "io_input2": m.io_input2,
        "io_input3": m.io_input3,
        "io_input4": m.io_input4,
    }


@router.post("/update")
async def device_update(payload: DeviceUpdatePayload, db: Session = Depends(get_db)):
    """Endpoint ESP32/HMI devices push telemetry to. No user-auth: devices
    authenticate implicitly via their known MAC address (extend with an
    API key/device token here for production deployments).

    The actual DB reads/writes happen in _write_device_update(), executed via
    run_in_threadpool() so this async endpoint never blocks the server's main
    event loop while SQLite is queried/locked-for-write. That was the #1
    cause of the slow dashboard / laggy HMI: every other request (including
    page loads) had to wait behind this endpoint's synchronous DB calls."""
    now = datetime.now(timezone.utc)
    result = await run_in_threadpool(_write_device_update, db, payload, now)

    await manager.broadcast({
        "type": "machine_update",
        "machine_id": result["machine_id"],
        "machine_name": result["machine_name"],
        "status": result["status"],
        "io_input1": result["io_input1"],
        "io_input2": result["io_input2"],
        "io_input3": result["io_input3"],
        "io_input4": result["io_input4"],
        "timestamp": now.isoformat(),
    })

    return {"ok": True, "machine_id": result["machine_id"], "status": result["status"]}


@router.post("/hmi-login")
async def device_hmi_login(payload: DeviceHmiLoginPayload, db: Session = Depends(get_db)):
    """Called by the ESP32/HMI firmware the moment an operator successfully
    logs in on the physical touchscreen (screens.cpp::processLogin() ->
    SCREEN_MENU). This is completely separate from the website's own
    admin/JWT login — it tracks whether *that machine's HMI panel* currently
    has an operator session open, which is what the Setup page's
    "Login"/"Logout" badge and the "Login: HMI sessions active" summary
    card reflect (Machine.hmi_login)."""
    now = datetime.now(timezone.utc)

    def _write():
        m = db.query(Machine).filter(Machine.mac_address == payload.mac).first()
        if not m:
            return None
        open_row = (
            db.query(HmiLoginHistory)
            .filter(HmiLoginHistory.machine_id == m.id, HmiLoginHistory.logout_at.is_(None))
            .first()
        )
        if not open_row:
            db.add(HmiLoginHistory(machine_id=m.id, username=payload.username, login_at=now))
        m.hmi_login = True
        db.commit()
        return {"machine_id": m.id, "machine_name": m.machine_name}

    result = await run_in_threadpool(_write)
    if not result:
        return {"ok": False, "error": "unknown machine (mac not registered)"}

    await manager.broadcast({
        "type": "hmi_login_update",
        "machine_id": result["machine_id"],
        "machine_name": result["machine_name"],
        "hmi_login": True,
        "timestamp": now.isoformat(),
    })
    return {"ok": True, "machine_id": result["machine_id"]}


@router.post("/hmi-logout")
async def device_hmi_logout(payload: DeviceHmiLogoutPayload, db: Session = Depends(get_db)):
    """Called by the ESP32/HMI firmware when the operator logs out on the
    touchscreen (screens.cpp::checkLogout() -> back to SCREEN_LOGIN), or
    whenever the panel returns to the login screen for any reason. Mirrors
    device_hmi_login() above."""
    now = datetime.now(timezone.utc)

    def _write():
        m = db.query(Machine).filter(Machine.mac_address == payload.mac).first()
        if not m:
            return None
        open_rows = (
            db.query(HmiLoginHistory)
            .filter(HmiLoginHistory.machine_id == m.id, HmiLoginHistory.logout_at.is_(None))
            .all()
        )
        for row in open_rows:
            row.logout_at = now
        m.hmi_login = False
        db.commit()
        return {"machine_id": m.id, "machine_name": m.machine_name}

    result = await run_in_threadpool(_write)
    if not result:
        return {"ok": False, "error": "unknown machine (mac not registered)"}

    await manager.broadcast({
        "type": "hmi_login_update",
        "machine_id": result["machine_id"],
        "machine_name": result["machine_name"],
        "hmi_login": False,
        "timestamp": now.isoformat(),
    })
    return {"ok": True, "machine_id": result["machine_id"]}
