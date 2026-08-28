#pragma once
// ============================================================
// server_client — ALL HTTP communication with the FastAPI backend lives
// here (device.py /api/device/update + /api/health). Split out on
// 2026-08-25 so backend/network performance work can be done in this file
// only, without touching WiFi/Modbus/screen logic.
//
// 2026-08-28: added requestServerCheck()/updateServerCheck() — the SERVER
// screen's Save button used to call checkServerReachable() synchronously
// right after connectWiFi(), before WiFi had actually finished connecting,
// so the check was silently guaranteed to fail and the HMI showed
// LOGIN_NO_SERVER almost every time regardless of whether the IP/port were
// correct. The check now runs once WiFi is confirmed connected (or times
// out waiting for it). See requestServerCheck()'s doc comment below.
//
// KNOWN LIMITATION (mitigated, not fully solved): pushDeviceUpdate() is
// synchronous, so while an HTTP call to the backend is in flight, the whole
// ESP32 loop() stalls — Modbus, screen jumps, WiFi state machine, all of it.
// Its timeout was 3000ms; shortened to 1500ms (2026-08-28) to bound how bad
// that stall can get and stop it from compounding into the "several
// connection-refused attempts before it finally connects" symptom. A
// refused connection itself returns near-instantly (nothing to time out) —
// the slow case is a briefly-unresponsive-but-reachable backend, which is
// what the timeout actually governs. Full fix would move the HTTP call off
// the main loop (e.g. a dedicated FreeRTOS task on the ESP32's second core)
// so it can never block Modbus/HMI timing at all — not done here, since
// that's a real architecture change to code the HMI timing depends on, and
// out of scope for a network/LAN-configuration pass.
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
// Blocks until it gets an answer or times out (see checkServerReachable()'s
// own 3000ms budget) — safe to call only when WiFi is already confirmed
// connected. Do not call this directly from screens.cpp any more; use
// requestServerCheck() below instead (see why in the comment there).
bool checkServerReachable(const char *ip, uint16_t port);

// Queues a reachability check for (ip, port) to run once WiFi is actually
// connected, instead of checking immediately. processServer() in
// screens.cpp used to call checkServerReachable() synchronously right after
// connectWiFi() — but connectWiFi() only *starts* an async WiFi.begin() and
// returns immediately, so WiFi.status() was essentially never WL_CONNECTED
// yet at that point. checkServerReachable() bails out early in that case
// (see its own WiFi.status() guard), so the check was silently a
// guaranteed-false result: the HMI showed "server unreachable"
// (LOGIN_NO_SERVER) almost every time the operator saved the SERVER screen,
// even when the IP/port entered were completely correct. requestServerCheck()
// just remembers what to check; updateServerCheck() (called every loop()
// alongside updateWiFiState()) performs the actual check once WiFi finishes
// connecting, or gives up and reports NO_SERVER if WiFi itself never comes
// up within SERVER_CHECK_TIMEOUT_MS.
void requestServerCheck(const char *ip, uint16_t port);

// Services a pending requestServerCheck(), if any. Call once per loop() —
// no-op when there's nothing pending. See requestServerCheck() above.
void updateServerCheck();

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
