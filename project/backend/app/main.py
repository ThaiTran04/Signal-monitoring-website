import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import Base, engine, SessionLocal
from app.services.seed import seed_if_empty
from app.services.offline_watcher import watch_offline_machines
from app.services.retention import prune_old_history
from app.api import auth, machines, status, io, connection_history, hmi_login_history, device, ws

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Industrial HMI Monitoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(machines.router)
app.include_router(status.router)
app.include_router(io.router)
app.include_router(connection_history.router)
app.include_router(hmi_login_history.router)
app.include_router(device.router)
app.include_router(ws.router)


@app.on_event("startup")
async def on_startup():
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    # Runs forever in the background: flips a machine to "offline" if it
    # stops sending updates (device powered off / lost network without a
    # chance to report it). See app/services/offline_watcher.py.
    asyncio.create_task(watch_offline_machines())
    # Runs forever in the background: prunes MachineStatus/IoHistory rows
    # older than RETENTION_DAYS (default 7) so those tables don't grow
    # unbounded. See app/services/retention.py.
    asyncio.create_task(prune_old_history())


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    # Safety net: the documented/normal way to run this is
    #   uvicorn app.main:app --host 0.0.0.0 --port 8000
    # (see backend/README.md). But if someone runs this file directly with
    # `python app/main.py` (or `python -m app.main`), uvicorn's own default
    # host is 127.0.0.1 — which means the ESP32 and phones/laptops on the
    # LAN get "connection refused" even though the server "looks" up because
    # it answers fine from the same PC. Default HOST here to 0.0.0.0 so a
    # forgotten `--host` flag can never silently break LAN access. Both are
    # still overridable via environment variables for anyone who *does* want
    # to restrict it (e.g. HOST=127.0.0.1 for a loopback-only debug run).
    import os
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
