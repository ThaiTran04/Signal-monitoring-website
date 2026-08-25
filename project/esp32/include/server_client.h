#pragma once
// ============================================================
// server_client — ALL HTTP communication with the FastAPI backend lives
// here (device.py /api/device/update + /api/health). Split out on
// 2026-08-25 so backend/network performance work can be done in this file
// only, without touching WiFi/Modbus/screen logic.
//
// KNOWN ISSUE (not yet fixed, see HANDOFF): pushDeviceUpdate() below can
// block for up to 3s (http.setTimeout) if the backend is slow to answer.
// While it blocks, the whole ESP32 loop() stalls — Modbus, screen jumps,
// WiFi state machine, everything. This is the leading suspect for the
// HMI lag reported alongside the slow dashboard. Do not "fix" this by
// just lowering the timeout without discussing with the user first —
// see HANDOFF for the plan (moving the HTTP call off the blocking path).
// ============================================================
#include <Arduino.h>

// true after the most recent HTTP request to the backend succeeded
extern bool serverConfigured;

// Server address currently in use (loaded from flash at boot, or set via
// the HMI's SERVER screen through processServer() in screens.cpp)
extern char savedServerIP[17];
extern uint16_t savedServerPort;

// Scratch buffers screens.cpp reads the SERVER screen's fields into before
// handing them to saveServerConfig()/checkServerReachable() below.
extern char serverIP[17];
extern uint16_t serverPort;

// How often loop() should call pushDeviceUpdate(). Currently 1000ms per the
// user's request (was 5000ms) — this is the setting under review for the
// server-side slowness, see HANDOFF.
extern const unsigned long STATUS_PUSH_INTERVAL_MS;

void saveServerConfig(const char *ip, uint16_t port);
bool loadServerConfig(char *ip, uint16_t &port);

// Builds "http://<ip>:<port><path>" into buf. path must start with '/'.
void buildServerUrl(const char *path, char *buf, size_t bufLen);

// One-shot reachability check against the backend's health endpoint.
// Used when the operator saves new server IP/port on the HMI's SERVER screen.
bool checkServerReachable(const char *ip, uint16_t port);

// Reads the run/stop/error beacon and returns "RUNNING"/"STOPPED"/"ERROR".
const char *deriveMachineStatus();

// POSTs current machine status to /api/device/update. Call from loop() on
// the STATUS_PUSH_INTERVAL_MS cadence. See the blocking-call note above.
void pushDeviceUpdate();

// Writes savedServerIP/savedServerPort back into the HMI's SERVER-screen
// fields (HR_SERVER_IP, HR_SERVER_PORT) so the operator sees the
// previously-saved values instead of a blank field next time they open that
// screen. Call once in setup() right after a successful loadServerConfig().
void restoreServerFieldsToHmi();
