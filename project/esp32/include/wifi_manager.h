#pragma once
// ============================================================
// wifi_manager — WiFi connect/reconnect + saved credentials + NTP.
// Split out of main.cpp on 2026-08-25. No logic changed, only moved.
// ============================================================
#include <Arduino.h>

// Raw text read from the HMI's WiFi/IP config screens (filled by screens.cpp
// via readASCII, consumed here by connectWiFi()).
extern char ssid[21], wifiPass[21];
extern char staticIP[17], gateway[17], subnet[21], dns[11];

void connectWiFi(bool useStatic);
void updateWiFiState(); // call every loop() — non-blocking connect state machine

// Detects a WiFi link that was up and then dropped (router hiccup, out of
// range, interference — common on a real factory floor, unlike a quiet dev
// LAN) and automatically retries connectWiFi() using the last-saved
// creds/mode. updateWiFiState() only babysits an in-flight connect attempt;
// without this, once the link drops there is nothing left in loop() that
// ever calls connectWiFi() again, so the device stays disconnected until
// someone manually re-enters WiFi on the HMI. Call every loop().
void watchdogWiFi();

void saveWifiCreds(const char *s, const char *p);
bool loadWifiCreds(char *s, char *p);

// Static IP config (IP/gateway/subnet/DNS), persisted only when the operator
// actually connects successfully using Static IP mode.
void saveStaticIpConfig();
bool loadStaticIpConfig();

// Writes ssid/wifiPass back into the HMI's WiFi-screen text fields (HR_SSID,
// HR_WIFI_PASS) so the operator sees the previously-saved values instead of
// a blank field next time they open that screen.
void restoreWifiFieldsToHmi();

// Writes staticIP/gateway/subnet/dns back into the HMI's Static IP screen
// fields so the operator sees the previously-saved values instead of blank.
void restoreStaticIpFieldsToHmi();

// Loads saved WiFi credentials (and Static IP config, if that was the mode
// last used successfully) from flash, pre-fills the corresponding HMI screen
// fields, and kicks off a non-blocking reconnect attempt. Call once from
// setup(). Does nothing if no WiFi credentials were ever saved.
void autoReconnectFromSavedConfig();

void ensureNtpConfigured(); // call every loop() — configures NTP once WiFi is up