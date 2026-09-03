"""Pydantic schemas."""
from datetime import datetime, timezone
from typing import Optional, List, Annotated
from pydantic import BaseModel, PlainSerializer


def _as_utc_iso(dt: datetime) -> str:
    """SQLite hands back naive datetimes even though every value we write is
    UTC (see database/db.py, device.py, offline_watcher.py). If we let
    Pydantic serialize a naive datetime as-is, the JSON has no 'Z'/offset —
    e.g. "2026-08-27T05:00:26" instead of "2026-08-27T05:00:26+00:00" — and
    the frontend's `new Date(iso)` then parses it as browser-LOCAL time
    instead of UTC. For a user in Vietnam (UTC+7) that silently shifts every
    timestamp shown in the UI by 7 hours. Attaching UTC tzinfo before
    serializing (when it's missing) fixes this at the source for every
    response that uses UtcDatetime below, regardless of whether the value
    came from `Model.model_validate(orm_obj)` or a manual schema(...) call.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# Use this instead of a bare `datetime` for any field that echoes a
# DB-sourced timestamp back to the frontend.
UtcDatetime = Annotated[datetime, PlainSerializer(_as_utc_iso, return_type=str)]


# ── Auth ──
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class MeResponse(BaseModel):
    username: str
    role: str


# ── Machines ──
class MachineBase(BaseModel):
    machine_name: str
    mac_address: str
    ip_address: str
    firmware_version: Optional[str] = None
    hmi_version: Optional[str] = None


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    machine_name: Optional[str] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = None
    hmi_version: Optional[str] = None


class MachineOut(MachineBase):
    id: int
    hmi_login: bool
    status: str
    offline_since: Optional[UtcDatetime] = None
    io_input1: Optional[bool] = None
    io_input2: Optional[bool] = None
    io_input3: Optional[bool] = None
    io_input4: Optional[bool] = None
    io_updated_at: Optional[UtcDatetime] = None

    class Config:
        from_attributes = True


class MachineListResponse(BaseModel):
    items: List[MachineOut]
    total: int


# ── Status ──
class StatusOut(BaseModel):
    machine_id: int
    machine_name: str
    status: str
    wifi_connected: bool
    server_connected: bool
    rssi: Optional[int]
    timestamp: UtcDatetime

    class Config:
        from_attributes = True


class StatusSummary(BaseModel):
    total: int
    run: int
    stop: int
    error: int
    unknown: int
    offline: int


# ── IO ──
class IoSegment(BaseModel):
    # Seconds since local midnight (0-86400), not minutes — the I/O timeline
    # chart shows/tooltips down to the second and live-extends in real time,
    # so minute-only resolution isn't enough.
    start_sec: int
    end_sec: int
    status: str


class IoHistoryResponse(BaseModel):
    machine_id: int
    date: str
    segments: List[IoSegment]


# ── Connection history ──
class ConnectionHistoryOut(BaseModel):
    id: int
    machine_id: int
    machine_name: str
    mac_address: str
    ip_address: str
    connected_at: Optional[UtcDatetime]
    disconnected_at: Optional[UtcDatetime]
    duration_min: Optional[int]
    reason: Optional[str]

    class Config:
        from_attributes = True


# ── HMI login history ──
class HmiLoginHistoryOut(BaseModel):
    id: int
    machine_id: int
    machine_name: str
    username: str
    login_at: UtcDatetime
    logout_at: Optional[UtcDatetime]

    class Config:
        from_attributes = True


# ── Device ingest ──
class DeviceIoPayload(BaseModel):
    input1: Optional[int] = 0
    input2: Optional[int] = 0
    input3: Optional[int] = 0
    input4: Optional[int] = 0


class DeviceHmiLoginPayload(BaseModel):
    mac: str
    username: str


class DeviceHmiLogoutPayload(BaseModel):
    mac: str


class DeviceUpdatePayload(BaseModel):
    machine: str
    mac: str
    ip: str
    rssi: Optional[int] = None
    wifi_connected: bool = True
    server_connected: bool = True
    status: str  # RUNNING | STOPPED | ERROR | UNKNOWN | OFFLINE
    io: Optional[DeviceIoPayload] = None
