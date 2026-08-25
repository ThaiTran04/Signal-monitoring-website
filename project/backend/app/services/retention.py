"""Background task that trims old telemetry rows out of MachineStatus and
IoHistory so those tables (written to roughly once per second per machine)
don't grow forever and slow every query down more and more over time.

Default retention is RETENTION_DAYS (7 days) — override with the
RETENTION_DAYS env var if you want to keep more/less history. ConnectionHistory
and HmiLoginHistory are left alone since they're low-volume (one row per
connect/disconnect or login/logout, not one per second).
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool

from app.database.db import SessionLocal
from app.models.models import MachineStatus, IoHistory

RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "7"))
CLEANUP_INTERVAL_SECONDS = 60 * 60  # once an hour is plenty for a daily-scale retention window


def _prune_old_rows() -> tuple[int, int]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    db = SessionLocal()
    try:
        status_deleted = (
            db.query(MachineStatus)
            .filter(MachineStatus.timestamp < cutoff)
            .delete(synchronize_session=False)
        )
        io_deleted = (
            db.query(IoHistory)
            .filter(IoHistory.timestamp < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        return status_deleted, io_deleted
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def prune_old_history():
    while True:
        try:
            status_deleted, io_deleted = await run_in_threadpool(_prune_old_rows)
            if status_deleted or io_deleted:
                print(f">>> RETENTION CLEANUP: removed {status_deleted} machine_status rows, "
                      f"{io_deleted} io_history rows older than {RETENTION_DAYS}d")
        except Exception as e:
            print(f">>> RETENTION CLEANUP FAILED: {e}")
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
