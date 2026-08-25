"""
ESP32 simulator for Signal-monitoring-website.

This simulates the HTTP telemetry sent by project/esp32 to:
    POST /api/device/update

It intentionally does NOT modify the real ESP32 code.
"""

import argparse
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import requests


STATUS_TO_IO = {
    "RUNNING":  {"input1": 0, "input2": 0, "input3": 1, "input4": 0},
    "STOPPED":  {"input1": 0, "input2": 1, "input3": 0, "input4": 0},
    "ERROR":    {"input1": 1, "input2": 0, "input3": 0, "input4": 0},
    "OFFLINE":  {"input1": 0, "input2": 0, "input3": 0, "input4": 0},
}


@dataclass
class SimulatedESP32:
    machine: str
    mac: str
    ip: str
    rssi: int = 75
    status: str = "RUNNING"
    wifi_connected: bool = True
    server_connected: bool = True
    io: dict = field(default_factory=lambda: STATUS_TO_IO["RUNNING"].copy())

    def next_state(self):
        """Occasionally change the simulated machine state."""
        roll = random.random()

        if roll < 0.07:
            self.status = "ERROR"
        elif roll < 0.20:
            self.status = "STOPPED"
        elif roll < 0.92:
            self.status = "RUNNING"
        else:
            self.status = "OFFLINE"

        if self.status == "OFFLINE":
            self.wifi_connected = False
            self.server_connected = False
        else:
            self.wifi_connected = True
            self.server_connected = True
            self.rssi = max(35, min(100, self.rssi + random.randint(-5, 5)))

        self.io = STATUS_TO_IO[self.status].copy()

        # Keep spare input somewhat realistic.
        if self.status != "OFFLINE":
            self.io["input4"] = random.choice([0, 0, 0, 1])

    def payload(self):
        return {
            "machine": self.machine,
            "mac": self.mac,
            "ip": self.ip,
            "rssi": self.rssi,
            "wifi_connected": self.wifi_connected,
            "server_connected": self.server_connected,
            "status": self.status,
            "io": self.io,
        }


def post_update(base_url: str, device: SimulatedESP32, timeout: float):
    url = f"{base_url.rstrip('/')}/api/device/update"

    try:
        response = requests.post(url, json=device.payload(), timeout=timeout)

        if response.ok:
            try:
                body = response.json()
            except ValueError:
                body = response.text
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"{device.machine:<12} "
                f"{device.status:<8} "
                f"RSSI={device.rssi:3d} "
                f"HTTP={response.status_code} "
                f"response={body}"
            )
        else:
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"{device.machine:<12} "
                f"HTTP={response.status_code} "
                f"error={response.text}"
            )

    except requests.RequestException as exc:
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] "
            f"{device.machine:<12} BACKEND UNREACHABLE: {exc}"
        )


def make_devices():
    return [
        SimulatedESP32(
            machine="SIM_MACHINE_01",
            mac="AA:BB:CC:DD:EE:01",
            ip="192.168.1.201",
        ),
        SimulatedESP32(
            machine="SIM_MACHINE_02",
            mac="AA:BB:CC:DD:EE:02",
            ip="192.168.1.202",
            rssi=68,
            status="STOPPED",
            io=STATUS_TO_IO["STOPPED"].copy(),
        ),
        SimulatedESP32(
            machine="SIM_MACHINE_03",
            mac="AA:BB:CC:DD:EE:03",
            ip="192.168.1.203",
            rssi=82,
            status="RUNNING",
        ),
    ]


def main():
    parser = argparse.ArgumentParser(
        description="Simulate ESP32 devices for Signal-monitoring-website."
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000",
        help="Backend base URL (default: http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=1.0,
        help="Seconds between telemetry cycles (default: 1)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=3.0,
        help="HTTP timeout in seconds (default: 3)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Send one telemetry update for every simulated device and exit.",
    )
    args = parser.parse_args()

    devices = make_devices()

    print("==============================================")
    print(" Signal Monitoring - ESP32 Simulator")
    print("==============================================")
    print(f"Backend : {args.url}")
    print(f"Devices : {len(devices)}")
    print(f"Interval: {args.interval}s")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            for device in devices:
                device.next_state()
                post_update(args.url, device, args.timeout)

            if args.once:
                break

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\nSimulator stopped.")


if __name__ == "__main__":
    main()
