# Full ESP32 Simulation

This simulator is designed for the current `Signal-monitoring-website` backend/frontend.

## What it does

- Creates 3 simulated ESP32 machines.
- Seeds 3 calendar days of minute-by-minute `MachineStatus` and `IoHistory` into the existing backend SQLite database.
- Uses the exact state cycle expected by the timeline:
  - 1 minute `RUN` (green)
  - 1 minute `ERROR` (red)
  - 1 minute `STOP` (orange/yellow)
  - repeat
- Adds planned `OFFLINE` windows and reconnects on each day for each simulated machine.
- Stores connection-history disconnect/reconnect events.
- After history seeding, continues in realtime through the real `POST /api/device/update` endpoint, so the frontend/WebSocket path is exercised too.
- Does not modify the real ESP32 firmware.

## Run on Windows

Start FastAPI first so `project/backend/database/hmi.db` exists.

From `project\simulation`:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe simulator.py
```

This seeds the last 3 calendar days and then continues realtime with one API update per minute.

## Useful test modes

Seed history only:

```powershell
.venv\Scripts\python.exe simulator.py --no-realtime
```

Realtime only:

```powershell
.venv\Scripts\python.exe simulator.py --realtime-only
```

Faster realtime visual test (10 seconds per API cycle; the state still follows the minute-based virtual clock):

```powershell
.venv\Scripts\python.exe simulator.py --interval 10
```

Use another backend address:

```powershell
.venv\Scripts\python.exe simulator.py --url http://192.168.1.100:8000
```

Do not duplicate historical rows from a previous simulation run:

```powershell
.venv\Scripts\python.exe simulator.py
```

The default run clears only rows belonging to `SIM_MACHINE_01..03` before reseeding. It does not delete other machines.

## Expected flow

```text
3-day history -> SQLite backend -> Machine Detail timeline
                              -> Connection History
                              -> Dashboard summary

then realtime -> POST /api/device/update -> FastAPI -> SQLite + WebSocket -> Frontend
```
