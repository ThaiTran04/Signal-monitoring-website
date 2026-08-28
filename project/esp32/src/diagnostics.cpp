#include "diagnostics.h"
#include <Wire.h>
#include <WiFi.h>

static const unsigned long WIFI_DIAG_INTERVAL_MS = 5000;

void i2cScan()
{
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    Serial.println(">>> I2C SCAN START <<<");

    int found = 0;
    for (uint8_t addr = 1; addr < 127; addr++)
    {
        Wire.beginTransmission(addr);
        uint8_t err = Wire.endTransmission();
        if (err == 0)
        {
            Serial.printf("    I2C device found at 0x%02X\n", addr);
            found++;
        }
        else if (err == 4)
        {
            Serial.printf("    Unknown error at address 0x%02X\n", addr);
        }
    }

    if (found == 0)
        Serial.println("    No I2C devices found.");
    else
        Serial.printf(">>> I2C SCAN DONE: %d device(s) found <<<\n", found);
}

void printWifiDiagnostics()
{
    static unsigned long last = 0;
    if (millis() - last < WIFI_DIAG_INTERVAL_MS)
        return;
    last = millis();

    wl_status_t st = WiFi.status();
    Serial.println(">>> WIFI DIAGNOSTICS <<<");
    Serial.printf("    status   : %d (%s)\n", st, st == WL_CONNECTED ? "CONNECTED" : "NOT CONNECTED");
    Serial.printf("    mode     : %s\n", WiFi.getMode() == WIFI_STA ? "STA" : "OTHER");
    Serial.printf("    mac      : %s\n", WiFi.macAddress().c_str());
    if (st == WL_CONNECTED)
    {
        Serial.printf("    ssid     : %s\n", WiFi.SSID().c_str());
        Serial.printf("    ip       : %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("    gateway  : %s\n", WiFi.gatewayIP().toString().c_str());
        Serial.printf("    rssi     : %d dBm\n", WiFi.RSSI());
    }
}
