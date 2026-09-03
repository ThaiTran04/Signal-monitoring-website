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

// NOTE: declared in wifi_manager.h and called from connectWiFi() /
// updateWiFiState() / autoReconnectFromSavedConfig() below, but the bodies
// were missing from this file entirely (link error: undefined reference to
// loadWifiCreds/saveWifiCreds). Implemented the same way every other
// saved-setting in this file is: Preferences, same "wifi" namespace already
// used for the static-IP-mode flag above (different keys, no collision).
void saveWifiCreds(const char *s, const char *p)
{
    prefs.begin("wifi", false);
    prefs.putString("ssid", s);
    prefs.putString("pass", p);
    prefs.end();
}

bool loadWifiCreds(char *s, char *p)
{
    prefs.begin("wifi", true);
    String ss = prefs.getString("ssid", "");
    String pp = prefs.getString("pass", "");
    prefs.end();
    if (ss.length() == 0) return false; // never saved
    strncpy(s, ss.c_str(), 20);
    strncpy(p, pp.c_str(), 20);
    return true;
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

// --- Auto-reconnect watchdog ---
// updateWiFiState() only manages an in-flight connectWiFi() attempt; it does
// NOT notice a WiFi link that was UP and then drops later. Without this, a
// real dropped connection (router hiccup, weak signal, interference — very
// common on-site vs. a quiet dev LAN) leaves the ESP32 sitting disconnected
// forever: pushDeviceUpdate() fails every cycle, the dashboard flips the
// device offline, and it never recovers until someone manually re-enters
// WiFi creds on the HMI. This is also why status/ReadTimeout looked
// "flapping" on the real machine: every failed push during the drop shows
// up as a connect error, with nothing retrying the WiFi side of it.
static unsigned long lastReconnectAttempt = 0;
static const unsigned long RECONNECT_RETRY_INTERVAL_MS = 5000;

void watchdogWiFi()
{
    if (WiFi.status() == WL_CONNECTED) return; // healthy, nothing to do
    if (wifiState == WIFI_CONNECTING) return;   // already retrying — let updateWiFiState() own this attempt
    if (strlen(ssid) == 0) return;              // never configured — nothing to reconnect to

    if (millis() - lastReconnectAttempt < RECONNECT_RETRY_INTERVAL_MS) return;
    lastReconnectAttempt = millis();

    Serial.println(">>> WIFI DROPPED, AUTO-RECONNECTING <<<");
    connectWiFi(loadWifiModeFlag());
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