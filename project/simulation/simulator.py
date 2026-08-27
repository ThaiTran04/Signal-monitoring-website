"""
Full ESP32 simulator for Signal-monitoring-website.

Modes:
  1) --history: seed 3 calendar days of minute-by-minute history directly into
     the backend SQLite database, then optionally continue in realtime.
  2) --realtime: continuously POST telemetry to /api/device/update.

The historical seed uses the same database used by FastAPI so the existing
Machine Detail / IO history / Connection History pages can immediately see it.
Realtime uses the real device endpoint, so it also exercises API + WebSocket.

Default state cycle:
  RUN 1 minute -> ERROR 1 minute -> STOP 1 minute -> repeat
with planned OFFLINE windows and reconnects.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests

STATUS_TO_DB = {
    "RUN": "run",
    "ERROR": "error",
    "STOP": "stop",
    "OFFLINE": "offline",
}

STATUS_TO_IO = {
    "RUN": {"input1": 0, "input2": 0, "input3": 1, "input4": 0},
    "ERROR": {"input1": 1, "input2": 0, "input3": 0, "input4": 0},
    "STOP": {"input1": 0, "input2": 1, "input3": 0, "input4": 0},
    "OFFLINE": {"input1": 0, "input2": 0, "input3": 0, "input4": 0},
}

# Deliberate offline windows. Minute-of-day ranges are [start, end).
# They repeat every day, giving predictable disconnect/reconnect events.
OFFLINE_WINDOWS = {
    1: [(8 * 60 + 17, 8 * 60 + 22), (13 * 60 + 41, 13 * 60 + 44), (20 * 60 + 5, 20 * 60 + 10)],
    2: [(9 * 60 + 12, 9 * 60 + 18), (15 * 60 + 27, 15 * 60 + 30), (21 * 60 + 7, 21 * 60 + 11)],
    3: [(7 * 60 + 35, 7 * 60 + 39), (12 * 60 + 50, 12 * 60 + 56), (18 * 60 + 23, 18 * 60 + 26)],
}

@dataclass(frozen=True)
class Device:
    machine: str
    mac: str
    ip: str
    index: int

DEVICES = [
    Device("SIM_MACHINE_01", "AA:BB:CC:DD:EE:01", "192.168.1.201", 1),
    Device("SIM_MACHINE_02", "AA:BB:CC:DD:EE:02", "192.168.1.202", 2),
    Device("SIM_MACHINE_03", "AA:BB:CC:DD:EE:03", "192.168.1.203", 3),
]


def backend_db_path() -> Path:
    # project/simulation/simulator.py -> project/backend/database/hmi.db
    return Path(__file__).resolve().parents[1] / "backend" / "database" / "hmi.db"


def status_for(device_index: int, when: datetime) -> str:
    minute = when.hour * 60 + when.minute
    for start, end in OFFLINE_WINDOWS[device_index]:
        if start <= minute < end:
            return "OFFLINE"

    # 1 minute each: RUN -> ERROR -> STOP -> repeat.
    # Offset machines so the dashboard is not always identical.
    cycle_minute = int((when - datetime(2000, 1, 1)).total_seconds() // 60)
    phase = (cycle_minute + (device_index - 1)) % 3
    return ("RUN", "ERROR", "STOP")[phase]


def rssi_for(device_index: int, when: datetime) -> Optional[int]:
    if status_for(device_index, when) == "OFFLINE":
        return None
    # Stable, realistic-looking variation without random jumps.
    minute = when.hour * 60 + when.minute
    return 58 + ((minute * 7 + device_index * 11) % 34)


def ensure_schema(conn: sqlite3.Connection) -> None:
    required = {"machines", "machine_status", "io_history", "connection_history"}
    found = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    missing = required - found
    if missing:
        raise RuntimeError(
            "Backend database is not initialized. Start FastAPI once first; "
            f"missing tables: {', '.join(sorted(missing))}"
        )


def ensure_devices(conn: sqlite3.Connection) -> dict[str, int]:
    ids: dict[str, int] = {}
    for d in DEVICES:
        row = conn.execute("SELECT id FROM machines WHERE mac_address = ?", (d.mac,)).fetchone()
        if row:
            machine_id = int(row[0])
            conn.execute(
                "UPDATE machines SET machine_name=?, ip_address=?, updated_at=? WHERE id=?",
                (d.machine, d.ip, datetime.now().isoformat(sep=" "), machine_id),
            )
        else:
            cur = conn.execute(
                """INSERT INTO machines
                   (machine_name, mac_address, ip_address, firmware_version, hmi_version, hmi_login, created_at, updated_at)
                   VALUES (?, ?, ?, 'simulation', 'simulation', 0, ?, ?)""",
                (d.machine, d.mac, d.ip, datetime.now().isoformat(sep=" "), datetime.now().isoformat(sep=" ")),
            )
            machine_id = int(cur.lastrowid)
        ids[d.machine] = machine_id
    return ids


def clear_simulation_data(conn: sqlite3.Connection, ids: dict[str, int]) -> None:
    machine_ids = tuple(ids.values())
    placeholders = ",".join("?" for _ in machine_ids)
    for table in ("machine_status", "io_history", "connection_history"):
        conn.execute(f"DELETE FROM {table} WHERE machine_id IN ({placeholders})", machine_ids)
    conn.commit()


def seed_history(days: int, reset: bool = True) -> tuple[int, int, int]:
    db = backend_db_path()
    if not db.exists():
        raise RuntimeError(f"Backend database not found: {db}. Start FastAPI first.")

    conn = sqlite3.connect(db)
    try:
        ensure_schema(conn)
        ids = ensure_devices(conn)
        if reset:
            clear_simulation_data(conn, ids)

        now = datetime.now().replace(second=0, microsecond=0)
        first_day = (now - timedelta(days=days - 1)).replace(hour=0, minute=0)
        end = now
        status_rows = 0
        io_rows = 0
        connection_rows = 0

        # We insert one row per minute. The frontend's IO endpoint converts each
        # row into a segment until the next row, exactly matching its timeline.
        for d in DEVICES:
            machine_id = ids[d.machine]
            previous = None
            offline_started: Optional[datetime] = None
            cursor = first_day
            while cursor <= end:
                status = status_for(d.index, cursor)
                db_status = STATUS_TO_DB[status]
                rssi = rssi_for(d.index, cursor)
                wifi = status != "OFFLINE"
                server = status != "OFFLINE"
                ts = cursor.isoformat(sep=" ")

                conn.execute(
                    """INSERT INTO machine_status
                       (machine_id, status, wifi_connected, server_connected, rssi, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (machine_id, db_status, int(wifi), int(server), rssi, ts),
                )
                conn.execute(
                    "INSERT INTO io_history (machine_id, state, timestamp) VALUES (?, ?, ?)",
                    (machine_id, db_status, ts),
                )
                status_rows += 1
                io_rows += 1

                if previous != "offline" and db_status == "offline":
                    offline_started = cursor
                    conn.execute(
                        """INSERT INTO connection_history
                           (machine_id, connected_at, disconnected_at, duration_min, reason)
                           VALUES (?, NULL, ?, NULL, ?)""",
                        (machine_id, ts, "simulation_planned_disconnect"),
                    )
                    connection_rows += 1
                elif previous == "offline" and db_status != "offline" and offline_started:
                    conn.execute(
                        """UPDATE connection_history
                           SET connected_at=?, duration_min=?
                           WHERE id=(
                               SELECT id FROM connection_history
                               WHERE machine_id=? AND connected_at IS NULL
                               ORDER BY disconnected_at DESC LIMIT 1
                           )""",
                        (ts, max(1, int((cursor - offline_started).total_seconds() // 60)), machine_id),
                    )
                    offline_started = None

                previous = db_status
                cursor += timedelta(minutes=1)

        conn.commit()
        return status_rows, io_rows, connection_rows
    finally:
        conn.close()


def payload(device: Device, when: datetime, status: str) -> dict:
    offline = status == "OFFLINE"
    return {
        "machine": device.machine,
        "mac": device.mac,
        "ip": device.ip,
        "rssi": rssi_for(device.index, when),
        "wifi_connected": not offline,
        "server_connected": not offline,
        "status": {"RUN": "RUNNING", "ERROR": "ERROR", "STOP": "STOPPED", "OFFLINE": "OFFLINE"}[status],
        "io": STATUS_TO_IO[status],
    }


def send_realtime(base_url: str, device: Device, timeout: float, when: datetime) -> None:
    status = status_for(device.index, when)
    url = f"{base_url.rstrip('/')}/api/device/update"
    try:
        r = requests.post(url, json=payload(device, when, status), timeout=timeout)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        print(
            f"[{datetime.now():%H:%M:%S}] {device.machine:<15} "
            f"{status:<8} RSSI={str(rssi_for(device.index, when) or '-'):>3} "
            f"HTTP={r.status_code} response={body}"
        )
    except requests.RequestException as exc:
        print(f"[{datetime.now():%H:%M:%S}] {device.machine:<15} BACKEND UNREACHABLE: {exc}")


def realtime(base_url: str, interval: float, timeout: float) -> None:
    print("\n=== REALTIME SIMULATION ===")
    print("Cycle: 1 min RUN -> 1 min ERROR -> 1 min STOP")
    print("Planned OFFLINE windows are active; Ctrl+C stops.\n")
    while True:
        now = datetime.now().replace(second=0, microsecond=0)
        for device in DEVICES:
            send_realtime(base_url, device, timeout, now)
        # Send once per simulated minute by default. A smaller interval can be
        # used for quicker visual testing, but the state still changes by minute.
        sleep_for = max(0.1, interval)
        time.sleep(sleep_for)


def main() -> None:
    parser = argparse.ArgumentParser(description="Full Signal Monitoring ESP32 simulator")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="FastAPI base URL")
    parser.add_argument("--history-days", type=int, default=3, help="Calendar days to seed (default 3)")
    parser.add_argument("--no-reset", action="store_true", help="Do not delete previous simulator rows before seeding")
    parser.add_argument("--skip-history", action="store_true", help="Skip DB history seeding")
    parser.add_argument("--realtime-only", action="store_true", help="Only run API realtime simulation")
    parser.add_argument("--interval", type=float, default=60.0, help="Realtime send interval in seconds (default 60)")
    parser.add_argument("--timeout", type=float, default=5.0, help="HTTP timeout in seconds")
    parser.add_argument("--no-realtime", action="store_true", help="Seed history and exit")
    args = parser.parse_args()

    print("============================================================")
    print(" Signal Monitoring - FULL ESP32 SIMULATOR")
    print("============================================================")
    print(f"Backend       : {args.url}")
    print(f"History days  : {args.history_days}")
    print(f"Realtime step : {args.interval}s")
    print(f"DB            : {backend_db_path()}")

    if not args.realtime_only and not args.skip_history:
        print("\n[1/2] Seeding historical data...")
        s, io, ch = seed_history(args.history_days, reset=not args.no_reset)
        print(f"Inserted MachineStatus : {s}")
        print(f"Inserted IoHistory     : {io}")
        print(f"Connection events      : {ch}")
        print("History is ready in the existing backend database.")

    if args.no_realtime:
        print("\nDone. Realtime was disabled.")
        return

    try:
        realtime(args.url, args.interval, args.timeout)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    main()
