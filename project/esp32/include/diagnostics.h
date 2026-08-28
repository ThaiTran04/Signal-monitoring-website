#pragma once
// ============================================================
// diagnostics.h / diagnostics.cpp — OPTIONAL, STANDALONE hardware bring-up
// helpers (I2C bus scan + WiFi status dump over Serial).
//
// Kept fully separate on purpose: no other file in this project (main.cpp,
// pins.h, wifi_manager.*, server_client.*, modbus_io.*, screens.*) includes
// or calls into this pair of files. That means you can delete
// include/diagnostics.h + src/diagnostics.cpp at any time — for any reason,
// whenever you don't need them anymore — without editing or breaking
// anything else in the project.
//
// Not wired into setup()/loop() by default. To actually use it, add ONE
// line yourself where you want it, e.g. in main.cpp's setup() after
// Serial.begin(...):
//
//     i2cScan();               // one-shot I2C bus scan, prints results
//
// and/or in loop():
//
//     printWifiDiagnostics();  // throttled Serial dump of WiFi status
//
// NOTE: this project's pins.h does not currently define/use any I2C
// peripheral — i2cScan() is a generic bring-up tool for whenever an I2C
// sensor/display/RTC gets added later, not tied to any specific device.
// Default pins below (21/22) don't conflict with anything already defined
// in pins.h (IN1-4, OUT1-4, RXD2/TXD2) — double check against your own
// wiring if that ever changes.
// ============================================================
#include <Arduino.h>

#ifndef I2C_SDA_PIN
#define I2C_SDA_PIN 21
#endif
#ifndef I2C_SCL_PIN
#define I2C_SCL_PIN 22
#endif

// Scans all 7-bit I2C addresses (1-126) on I2C_SDA_PIN/I2C_SCL_PIN and
// prints every address that acknowledges to Serial. One-shot — call it
// once (e.g. from setup()), not from loop().
void i2cScan();

// Prints WiFi status/mode/MAC/SSID/IP/gateway/RSSI to Serial. Safe to call
// every loop() iteration — internally throttled to once every
// WIFI_DIAG_INTERVAL_MS so it doesn't flood the Serial console.
void printWifiDiagnostics();
