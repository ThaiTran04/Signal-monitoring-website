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
    return "STOPPED"; // no beacon active -> treat as stopped, not offline
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
    http.setConnectTimeout(3000);
    http.setTimeout(3000);

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
