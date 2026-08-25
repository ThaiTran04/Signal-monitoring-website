"""Deterministic mock-data generator.

Mirrors the pseudo-random logic originally used in the Figma frontend
(sr() sine-based PRNG + getSegments()) so the simulated data has the same
statistical shape. This keeps behaviour identical while moving the
source of truth to the backend/DB.
"""
import math
from datetime import datetime, timedelta, timezone

STATUS_ORDER = ["run", "stop", "error", "offline"]


def sr(n: float) -> float:
    x = math.sin(n + 1.7) * 43758.5453
    return x - math.floor(x)


def status_for_machine(machine_id: int) -> str:
    v = sr(machine_id * 3)
    if v < 0.58:
        return "run"
    if v < 0.73:
        return "stop"
    if v < 0.87:
        return "error"
    return "offline"


def mac_for(machine_id: int) -> str:
    parts = [0x00, 0x1B, 0x44,
             int(sr(machine_id * 7) * 256),
             int(sr(machine_id * 11) * 256),
             int(sr(machine_id * 13) * 256)]
    return ":".join(f"{b:02X}" for b in parts)


def ip_for(i: int) -> str:
    return f"192.168.{i // 100 + 1}.{(i % 100) + 10}"


def firmware_for(machine_id: int) -> str:
    return f"v2.{int(sr(machine_id * 17) * 5) + 1}.{int(sr(machine_id * 19) * 10)}"


def hmi_version_for(machine_id: int) -> str:
    return f"HMI-{int(sr(machine_id * 23) * 3) + 1}.0"


def hmi_login_for(machine_id: int) -> bool:
    return sr(machine_id * 29) > 0.35


def get_segments(machine_id: int, date_str: str):
    """Generate a full day (0-1440 min) of run/stop/error/offline segments."""
    dh = sum((i + 1) * int(part) for i, part in enumerate(date_str.split("-")))
    base = machine_id * 1000 + dh
    segs = []
    t = 0
    i = 0
    while t < 1440:
        sv = sr(base + i * 17 + 1)
        if sv < 0.60:
            status = "run"
            dur = int(sr(base + i * 13) * 90) + 30
        elif sv < 0.78:
            status = "stop"
            dur = int(sr(base + i * 19) * 25) + 5
        elif sv < 0.90:
            status = "error"
            dur = int(sr(base + i * 23) * 13) + 2
        else:
            status = "offline"
            dur = int(sr(base + i * 29) * 45) + 15
        end = min(t + dur, 1440)
        segs.append({"start_min": t, "end_min": end, "status": status})
        t = end
        i += 1
    return segs


def rssi_for(machine_id: int) -> int:
    return int(-40 - sr(machine_id * 41) * 55)  # -40..-95
