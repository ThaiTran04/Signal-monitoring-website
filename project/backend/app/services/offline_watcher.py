"""Background watcher that marks a machine 'offline' if it stops sending
telemetry, instead of forever showing its last-reported status.

Devices (ESP32) push a status update roughly every 5s (STATUS_PUSH_INTERVAL_MS
in the firmware). If a device is powered off or loses network mid-run, it has
no chance to report "I'm offline" — so without this watcher the dashboard
would keep showing its last known status (e.g. "run") indefinitely.

This loop runs continuously in the background and, every CHECK_INTERVAL_SECONDS,
looks for machines whose latest MachineStatus row is older than
OFFLINE_TIMEOUT_SECONDS and flips them to "offline", recording a
ConnectionHistory row and broadcasting the change over the websocket so the
dashboard updates without a page refresh.
"""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import func, and_
from starlette.concurrency import run_in_threadpool

from app.database.db import SessionLocal
from app.models.models import Machine, MachineStatus, ConnectionHistory, HmiLoginHistory
from app.websocket.manager import manager

# ESP32 pushes every 1s (see esp32/main.cpp STATUS_PUSH_INTERVAL_MS). Was
# 4.5s (~4-5 missed pushes); bumped to 8s after real on-site WiFi (weaker/
# more contested than the dev LAN this was tuned on) caused brief multi-
# second drops to flip devices offline/online repeatedly ("flapping") even
# though esp32/wifi_manager.cpp's watchdogWiFi() usually reconnects within
# ~5s on its own. Still notices a real disconnect well within a few missed
# heartbeats, just without over-reacting to a single bad Wi-Fi moment.
OFFLINE_TIMEOUT_SECONDS = 8.0
CHECK_INTERVAL_SECONDS = 1


def _aware(dt: datetime) -> datetime:
    """SQLite can hand back naive datetimes; treat them as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _find_newly_offline(now: datetime) -> list[dict]:
    """One pass over all machines, done with 2 queries total instead of the
    old 1-query-per-machine loop (was 10-20 queries/sec with 10-20 machines).
    Also runs inside run_in_threadpool() (see watch_offline_machines()) so
    this blocking DB pass doesn't stall the event loop once a second."""
    db = SessionLocal()
    newly_offline = []
    try:
        machines = db.query(Machine).all()
        if not machines:
            return []

        # Latest MachineStatus row per machine, in a single query.
        latest_ts_subq = (
            db.query(
                MachineStatus.machine_id.label("machine_id"),
                func.max(MachineStatus.timestamp).label("max_ts"),
            )
            .group_by(MachineStatus.machine_id)
            .subquery()
        )
        latest_rows = (
            db.query(MachineStatus)
            .join(
                latest_ts_subq,
                and_(
                    MachineStatus.machine_id == latest_ts_subq.c.machine_id,
                    MachineStatus.timestamp == latest_ts_subq.c.max_ts,
                ),
            )
            .all()
        )
        latest_by_machine = {row.machine_id: row for row in latest_rows}

        for m in machines:
            latest = latest_by_machine.get(m.id)
            if not latest or latest.status == "offline":
                continue  # never reported yet, or already marked offline

            age = (now - _aware(latest.timestamp)).total_seconds()
            if age < OFFLINE_TIMEOUT_SECONDS:
                continue  # still within the expected heartbeat window

            db.add(MachineStatus(
                machine_id=m.id, status="offline",
                wifi_connected=False, server_connected=False,
                rssi=None, timestamp=now,
            ))
            db.add(ConnectionHistory(
                machine_id=m.id, connected_at=None, disconnected_at=now,
                duration_min=None, reason="heartbeat_timeout",
            ))

            # A disconnected panel can't have an operator "logged in" on it
            # any more — if it comes back online later, the ESP32 boots
            # straight to the LOGIN screen anyway (see esp32/main.cpp), so
            # the badge would be lying in the meantime otherwise. Close out
            # any open HMI session the same way device_hmi_logout() does.
            hmi_login_changed = False
            if m.hmi_login:
                open_rows = (
                    db.query(HmiLoginHistory)
                    .filter(HmiLoginHistory.machine_id == m.id, HmiLoginHistory.logout_at.is_(None))
                    .all()
                )
                for row in open_rows:
                    row.logout_at = now
                m.hmi_login = False
                hmi_login_changed = True

            newly_offline.append({
                "machine_id": m.id,
                "machine_name": m.machine_name,
                "hmi_login_changed": hmi_login_changed,
            })

        if newly_offline:
            db.commit()
        return newly_offline
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def watch_offline_machines():
    while True:
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        now = datetime.now(timezone.utc)
        try:
            newly_offline = await run_in_threadpool(_find_newly_offline, now)
        except Exception:
            continue  # logged inside _find_newly_offline's rollback path; keep the loop alive

        for entry in newly_offline:
            await manager.broadcast({
                "type": "machine_update",
                "machine_id": entry["machine_id"],
                "machine_name": entry["machine_name"],
                "status": "offline",
                "timestamp": now.isoformat(),
            })
            if entry["hmi_login_changed"]:
                await manager.broadcast({
                    "type": "hmi_login_update",
                    "machine_id": entry["machine_id"],
                    "machine_name": entry["machine_name"],
                    "hmi_login": False,
                    "timestamp": now.isoformat(),
                })
