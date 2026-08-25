# ESP32 Simulation

This folder simulates the ESP32 telemetry layer of `Signal-monitoring-website`.

The real ESP32 firmware sends a JSON payload every second to:

```text
POST /api/device/update
```

The simulator sends the same payload structure expected by the current FastAPI
`DeviceUpdatePayload` schema.

## Project integration

Place this folder here:

```text
project/
├── backend/
├── frontend/
├── esp32/
└── simulation/
    ├── simulator.py
    ├── requirements.txt
    └── README.md
```

The simulator does not change the real ESP32 firmware.

## 1. Start Backend

From the backend directory, start FastAPI using the command already used by
this project. The default simulator URL is:

```text
http://127.0.0.1:8000
```

If your backend uses another host/port, pass it with `--url`.

## 2. Install simulator dependency

Windows:

```powershell
cd project\simulation
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Linux/macOS:

```bash
cd project/simulation
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Run continuously

```bash
python simulator.py
```

Three simulated ESP32 devices will send telemetry once per second.

## 4. Run once

Useful for checking whether the backend endpoint accepts the payload:

```bash
python simulator.py --once
```

## 5. Use another backend address

Example:

```bash
python simulator.py --url http://192.168.1.100:8000
```

## Simulated devices

The default simulator creates:

- `SIM_MACHINE_01`
- `SIM_MACHINE_02`
- `SIM_MACHINE_03`

Each device has a unique MAC and IP.

## Simulated machine states

The simulator randomly changes states between:

- `RUNNING`
- `STOPPED`
- `ERROR`
- `OFFLINE`

The IO values follow the same three-light logic used by the current ESP32:

```text
RUNNING -> input3 = 1
STOPPED -> input2 = 1
ERROR   -> input1 = 1
OFFLINE -> all inputs = 0
```

RSSI also changes slightly while the simulated device is online.

## Payload

The simulator sends this structure:

```json
{
  "machine": "SIM_MACHINE_01",
  "mac": "AA:BB:CC:DD:EE:01",
  "ip": "192.168.1.201",
  "rssi": 75,
  "wifi_connected": true,
  "server_connected": true,
  "status": "RUNNING",
  "io": {
    "input1": 0,
    "input2": 0,
    "input3": 1,
    "input4": 0
  }
}
```

This matches the current ESP32 `pushDeviceUpdate()` field names and the
backend `DeviceUpdatePayload` schema.

## Why this is useful

The simulator lets the complete web system be tested without an ESP32:

```text
simulation
    |
    | POST /api/device/update
    v
FastAPI backend
    |
    +--> SQLite
    |
    +--> WebSocket broadcast
             |
             v
         Frontend
```

When the physical ESP32 is available, stop the simulator and run the real
firmware. The backend API does not need a separate simulation endpoint.
