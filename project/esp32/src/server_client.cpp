#include "server_client.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include "pins.h" // IN1-4, MACHINE_NAME
#include "hmi_map.h"
#include "modbus_io.h"

static Preferences prefs;

bool serverConfigured = false;

char savedServerIP[17] = "";
uint16_t savedServerPort = 0;

char serverIP[17];
uint16_t serverPort = 0;

const unsigned long STATUS_PUSH_INTERVAL_MS = 1000;

void saveServerConfig(const char *ip, uint16_t port)
{
    prefs.begin("server", false);
    prefs.putString("ip", ip);
    prefs.putUShort("port", port);
    prefs.end();
}

bool loadServerConfig(char *ip, uint16_t &port)
{
    prefs.begin("server", true);
    String ss = prefs.getString("ip", "");
    port = prefs.getUShort("port", 0);
    prefs.end();
    if (ss.length() == 0) return false;
    strncpy(ip, ss.c_str(), 16);
    return true;
}

void buildServerUrl(const char *path, char *buf, size_t bufLen)
{
    snprintf(buf, bufLen, "http://%s:%u%s", savedServerIP, savedServerPort, path);
}

bool checkServerReachable(const char *ip, uint16_t port)
{
    if (strlen(ip) == 0 || port == 0) return false;
    if (WiFi.status() != WL_CONNECTED) return false;

    char url[64];
    snprintf(url, sizeof(url), "http://%s:%u/api/health", ip, port);

    HTTPClient http;
    http.setConnectTimeout(3000);
    http.setTimeout(3000);
    Serial.printf(">>> CHECK SERVER %s\n", url);

    bool ok = false;
    if (http.begin(url))
    {
        int code = http.GET();
        ok = (code == 200);
        Serial.printf(">>> SERVER CHECK %s (HTTP %d)\n", ok ? "OK" : "FAILED", code);
        http.end();
    }
    else
    {
        Serial.println(">>> SERVER CHECK FAILED (begin() error) <<<");
    }
    return ok;
}

// --- deferred check state (see requestServerCheck() in the header for why) ---
static bool pendingServerCheck = false;
static char pendingCheckIP[17] = "";
static uint16_t pendingCheckPort = 0;
static unsigned long pendingCheckStart = 0;
// If WiFi hasn't finished connecting within this window, stop waiting and
// report NO_SERVER rather than leaving the operator staring at a screen
// that never updates. Matches wifi_manager.cpp's own WIFI_TIMEOUT_MS so the
// two give up around the same time instead of one waiting much longer.
static const unsigned long SERVER_CHECK_TIMEOUT_MS = 20000;

void requestServerCheck(const char *ip, uint16_t port)
{
    strncpy(pendingCheckIP, ip, 16);
    pendingCheckIP[16] = '\0';
    pendingCheckPort = port;
    pendingCheckStart = millis();
    pendingServerCheck = true;
}

void updateServerCheck()
{
    if (!pendingServerCheck) return;

    if (WiFi.status() == WL_CONNECTED)
    {
        pendingServerCheck = false;
        serverConfigured = checkServerReachable(pendingCheckIP, pendingCheckPort);
        mb.Hreg(HR_LOGIN_RESULT, serverConfigured ? LOGIN_INPUT_USER : LOGIN_NO_SERVER);
    }
    else if (millis() - pendingCheckStart > SERVER_CHECK_TIMEOUT_MS)
    {
        Serial.println(">>> SERVER CHECK ABORTED (WiFi never connected) <<<");
        pendingServerCheck = false;
        serverConfigured = false;
        mb.Hreg(HR_LOGIN_RESULT, LOGIN_NO_SERVER);
    }
}

// Derive the machine's run status from the 3-light beacon wired to IN1/IN2/IN3
// (same signals updateIO() reads for the HMI's IO screen). Priority: error > stop > run.
void restoreServerFieldsToHmi()
{
    writeASCII(HR_SERVER_IP, 16, savedServerIP);
    mb.Hreg(HR_SERVER_PORT, savedServerPort);
}

const char *deriveMachineStatus()
{
    bool inRed    = !digitalRead(IN1); // LỖI
    bool inYellow = !digitalRead(IN2); // DỪNG
    bool inGreen  = !digitalRead(IN3); // CHẠY

    if (inRed)    return "ERROR";
    if (inYellow) return "STOPPED";
    if (inGreen)  return "RUNNING";
    return "UNKNOWN"; // no beacon active -> no reading yet, not "stopped"/offline
}

void pushDeviceUpdate()
{
    if (strlen(savedServerIP) == 0 || savedServerPort == 0) return;
    if (WiFi.status() != WL_CONNECTED) { serverConfigured = false; return; }

    bool inRed    = !digitalRead(IN1);
    bool inYellow = !digitalRead(IN2);
    bool inGreen  = !digitalRead(IN3);
    bool inSpare  = !digitalRead(IN4);

    int rssiPct = constrain(map(WiFi.RSSI(), -90, -30, 0, 100), 0, 100);
    String ip = WiFi.localIP().toString();
    String mac = WiFi.macAddress();

    char payload[300];
    snprintf(payload, sizeof(payload),
        "{"
        "\"machine\":\"%s\","
        "\"mac\":\"%s\","
        "\"ip\":\"%s\","
        "\"rssi\":%d,"
        "\"wifi_connected\":true,"
        "\"server_connected\":%s,"
        "\"status\":\"%s\","
        "\"io\":{\"input1\":%d,\"input2\":%d,\"input3\":%d,\"input4\":%d}"
        "}",
        MACHINE_NAME,
        mac.c_str(),
        ip.c_str(),
        rssiPct,
        serverConfigured ? "true" : "false",
        deriveMachineStatus(),
        inRed ? 1 : 0, inYellow ? 1 : 0, inGreen ? 1 : 0, inSpare ? 1 : 0
    );

    char url[64];
    buildServerUrl("/api/device/update", url, sizeof(url));

    HTTPClient http;
    // This call runs on every loop() cycle (STATUS_PUSH_INTERVAL_MS) and is
    // synchronous — while it's in flight, mb.task() (Modbus/HMI screen) and
    // updateWiFiState() are NOT serviced, because loop() is a single-threaded
    // sequence with nothing else pumping in the background. A refused
    // connection returns almost instantly (the OS sends RST as soon as it
    // sees nothing listening on that port), so that path was never the slow
    // one. The slow path is: backend reachable but briefly not answering
    // (e.g. still starting up / seeding, or busy with a SQLite write) — the
    // old 3000ms timeout let ONE stalled attempt freeze the whole board for
    // 3 full seconds, which then delays the WiFi state machine and the next
    // retry too, compounding into the "long wait before HTTP 200" symptom.
    // Shortened to bound the worst case while still being generous for a
    // LAN request (normal LAN round-trip is well under 100ms). The one-shot
    // checkServerReachable() above (triggered by the operator saving the
    // SERVER screen) intentionally keeps the longer 3000ms budget — that's
    // a deliberate user action, not something firing every second.
    http.setConnectTimeout(1500);
    http.setTimeout(1500);

    if (!http.begin(url))
    {
        Serial.println(">>> DEVICE UPDATE FAILED (begin() error) <<<");
        serverConfigured = false;
        return;
    }

    http.addHeader("Content-Type", "application/json");
    int code = http.POST((uint8_t *)payload, strlen(payload));
    serverConfigured = (code == 200);

    Serial.printf(">>> DEVICE UPDATE %s (HTTP %d)\n", serverConfigured ? "OK" : "FAILED", code);
    if (code < 0)
    {
        Serial.printf("    HTTPClient error: %s\n", http.errorToString(code).c_str());
    }

    http.end();
}
