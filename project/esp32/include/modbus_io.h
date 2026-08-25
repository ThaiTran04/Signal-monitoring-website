#pragma once
// ============================================================
// modbus_io — RS485/Modbus register access + HMI screen helpers.
// Split out of main.cpp on 2026-08-25. No logic changed, only moved.
// ============================================================
#include <Arduino.h>
#include <ModbusRTU.h>

extern ModbusRTU mb;

// ---- Screen navigation ----
uint16_t currentScreen();
void screenJumpTo(uint16_t screenId);
void updateScreenJump(); // call every loop() — finishes any pending screen jump

// ---- Raw register bit/ASCII helpers ----
bool getBit(uint16_t reg, uint8_t bit);
void setBit(uint16_t reg, uint8_t bit, bool v);
void clearBuffer(char *buf, int len);
void readASCII(uint16_t startReg, uint8_t totalChar, char *buf);
void writeASCII(uint16_t startReg, uint8_t totalChar, const char *buf);

// ---- Periodic HMI updates (call from loop()) ----
void updateIO();               // reads IN1-3 beacon lights into input register 99
void updateGlobalStatus();     // WiFi/server icon + banner on HMI
void updateDateTimeDisplay();  // pushes current date/time to HMI
void updateLoginPasswordDisplay(); // mirrors typed password as ****
