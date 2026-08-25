"""Pydantic schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


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
    offline_since: Optional[datetime] = None

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
    timestamp: datetime

    class Config:
        from_attributes = True


class StatusSummary(BaseModel):
    total: int
    run: int
    stop: int
    error: int
    offline: int


# ── IO ──
class IoSegment(BaseModel):
    start_min: int
    end_min: int
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
    connected_at: Optional[datetime]
    disconnected_at: Optional[datetime]
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
    login_at: datetime
    logout_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Device ingest ──
class DeviceIoPayload(BaseModel):
    input1: Optional[int] = 0
    input2: Optional[int] = 0
    input3: Optional[int] = 0
    input4: Optional[int] = 0


class DeviceUpdatePayload(BaseModel):
    machine: str
    mac: str
    ip: str
    rssi: Optional[int] = None
    wifi_connected: bool = True
    server_connected: bool = True
    status: str  # RUNNING | STOPPED | ERROR | OFFLINE
    io: Optional[DeviceIoPayload] = None
