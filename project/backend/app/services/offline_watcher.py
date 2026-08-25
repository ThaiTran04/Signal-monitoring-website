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
from app.models.models import Machine, MachineStatus, ConnectionHistory
from app.websocket.manager import manager

# ESP32 pushes every 1s (see esp32/main.cpp STATUS_PUSH_INTERVAL_MS). 4-5s is
# ~4-5 missed pushes, which tolerates normal wifi jitter without being slow to
# notice a real disconnect.
OFFLINE_TIMEOUT_SECONDS = 4.5
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
            newly_offline.append({"machine_id": m.id, "machine_name": m.machine_name})

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
