"""SQLAlchemy ORM models for all tables in the spec."""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from app.database.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="admin")
    created_at = Column(DateTime, default=utcnow)


class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True, index=True)
    machine_name = Column(String(64), unique=True, nullable=False, index=True)
    mac_address = Column(String(32), unique=True, nullable=False)
    ip_address = Column(String(32), nullable=False)
    firmware_version = Column(String(32))
    hmi_version = Column(String(32))
    hmi_login = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    statuses = relationship("MachineStatus", back_populates="machine", cascade="all, delete-orphan")
    io_history = relationship("IoHistory", back_populates="machine", cascade="all, delete-orphan")
    connections = relationship("ConnectionHistory", back_populates="machine", cascade="all, delete-orphan")
    logins = relationship("HmiLoginHistory", back_populates="machine", cascade="all, delete-orphan")


class MachineStatus(Base):
    __tablename__ = "machine_status"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False, index=True)
    status = Column(String(16), nullable=False)  # run | stop | error | offline
    wifi_connected = Column(Boolean, default=False)
    server_connected = Column(Boolean, default=False)
    rssi = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=utcnow, index=True)

    machine = relationship("Machine", back_populates="statuses")


class IoHistory(Base):
    __tablename__ = "io_history"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False, index=True)
    state = Column(String(16), nullable=False)  # run | stop | error | offline
    timestamp = Column(DateTime, default=utcnow, index=True)

    machine = relationship("Machine", back_populates="io_history")


class ConnectionHistory(Base):
    __tablename__ = "connection_history"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False, index=True)
    connected_at = Column(DateTime, nullable=True)
    disconnected_at = Column(DateTime, nullable=True, index=True)
    duration_min = Column(Integer, nullable=True)
    reason = Column(String(128), nullable=True)

    machine = relationship("Machine", back_populates="connections")


class HmiLoginHistory(Base):
    __tablename__ = "hmi_login_history"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False, index=True)
    username = Column(String(64), nullable=False)
    login_at = Column(DateTime, default=utcnow)
    logout_at = Column(DateTime, nullable=True)

    machine = relationship("Machine", back_populates="logins")


Index("ix_status_machine_time", MachineStatus.machine_id, MachineStatus.timestamp)
Index("ix_io_machine_time", IoHistory.machine_id, IoHistory.timestamp)
