#include "wifi_manager.h"
#include <WiFi.h>
#include <Preferences.h>
#include "hmi_map.h"
#include "modbus_io.h"

static Preferences prefs;

char ssid[21], wifiPass[21];
char staticIP[17], gateway[17], subnet[21], dns[11];

enum WifiConnState { WIFI_IDLE, WIFI_CONNECTING };
static WifiConnState wifiState = WIFI_IDLE;
static unsigned long wifiAttemptStart = 0;
static const unsigned long WIFI_TIMEOUT_MS = 20000;

// Tracks whether the in-flight connectWiFi() call actually applied a valid
// Static IP config (not just what the caller asked for — connectWiFi()
// silently falls back to DHCP if the entered IP/gateway/subnet are invalid).
// updateWiFiState() reads this on success to decide what to persist.
static bool pendingConnectIsStatic = false;

static void saveWifiModeFlag(bool isStatic)
{
    prefs.begin("wifi", false);
    prefs.putBool("static", isStatic);
    prefs.end();
}

static bool loadWifiModeFlag()
{
    prefs.begin("wifi", true);
    bool v = prefs.getBool("static", false);
    prefs.end();
    return v;
}

void saveStaticIpConfig()
{
    prefs.begin("staticip", false);
    prefs.putString("ip", staticIP);
    prefs.putString("gw", gateway);
    prefs.putString("mask", subnet);
    prefs.putString("dns", dns);
    prefs.end();
}

bool loadStaticIpConfig()
{
    prefs.begin("staticip", true);
    String ip = prefs.getString("ip", "");
    String gw = prefs.getString("gw", "");
    String mask = prefs.getString("mask", "");
    String d = prefs.getString("dns", "");
    prefs.end();
    if (ip.length() == 0) return false;
    strncpy(staticIP, ip.c_str(), 16);
    strncpy(gateway, gw.c_str(), 16);
    strncpy(subnet, mask.c_str(), 20);
    strncpy(dns, d.c_str(), 10);
    return true;
}

void connectWiFi(bool useStatic)
{
    if (strlen(ssid) == 0) loadWifiCreds(ssid, wifiPass);

    if (strlen(ssid) == 0)
    {
        Serial.println(">>> Chua co SSID, bo qua <<<");
        return;
    }

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.disconnect(true, true);

    bool staticApplied = false;
    if (useStatic)
    {
        IPAddress ip, gw, mask, dnsAddr;
        if (ip.fromString(staticIP) && gw.fromString(gateway) && mask.fromString(subnet))
        {
            dnsAddr.fromString(dns);
            WiFi.config(ip, gw, mask, dnsAddr);
            staticApplied = true;
        }
        else
        {
            Serial.println(">>> STATIC IP DATA INVALID, fallback DHCP <<<");
        }
    }
    pendingConnectIsStatic = staticApplied;

    WiFi.begin(ssid, wifiPass);
    wifiState = WIFI_CONNECTING;
    wifiAttemptStart = millis();

    Serial.printf(">>> CONNECTING SSID: %s\n", ssid);
}

void updateWiFiState()
{
    if (wifiState != WIFI_CONNECTING) return;

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.print(">>> WIFI CONNECTED: "); Serial.println(WiFi.localIP());
        saveWifiCreds(ssid, wifiPass);
        saveWifiModeFlag(pendingConnectIsStatic);
        if (pendingConnectIsStatic) saveStaticIpConfig();
        wifiState = WIFI_IDLE;
    }
    else if (millis() - wifiAttemptStart > WIFI_TIMEOUT_MS)
    {
        Serial.println(">>> WIFI TIMEOUT <<<");
        wifiState = WIFI_IDLE;
    }
}

void restoreWifiFieldsToHmi()
{
    writeASCII(HR_SSID, 20, ssid);
    writeASCII(HR_WIFI_PASS, 20, wifiPass);
}

void restoreStaticIpFieldsToHmi()
{
    writeASCII(HR_STATIC_IP, 16, staticIP);
    writeASCII(HR_GATEWAY, 16, gateway);
    writeASCII(HR_SUBNET, 20, subnet);
    writeASCII(HR_DNS, 10, dns);
}

void autoReconnectFromSavedConfig()
{
    if (!loadWifiCreds(ssid, wifiPass)) return; // never configured — nothing to restore

    bool wasStatic = loadWifiModeFlag();
    if (wasStatic && loadStaticIpConfig())
    {
        restoreStaticIpFieldsToHmi();
        Serial.printf(">>> AUTO-RECONNECT SSID: %s (STATIC IP %s)\n", ssid, staticIP);
        connectWiFi(true);
    }
    else
    {
        Serial.printf(">>> AUTO-RECONNECT SSID: %s (DHCP)\n", ssid);
        connectWiFi(false);
    }
    restoreWifiFieldsToHmi();
}

static bool ntpConfigured = false;
void ensureNtpConfigured()
{
    bool up = (WiFi.status() == WL_CONNECTED);
    if (!ntpConfigured && up)
    {
        configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
        ntpConfigured = true;
    }
    else if (ntpConfigured && !up) ntpConfigured = false;
}