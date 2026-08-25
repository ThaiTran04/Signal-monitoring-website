#pragma once
// ============================================================
// screens — login/logout flow and the SERVER config screen handler.
// Split out of main.cpp on 2026-08-25. No logic changed, only moved.
// ============================================================
#include <Arduino.h>

extern char username[21], password[21];

// Last IP-config screen the operator was on (SCREEN_DYNAMIC_IP or
// SCREEN_STATIC_IP) — remembered so the "Quay lại" button on the SERVER
// screen knows which screen to jump back to. Updated by main.cpp's loop()
// whenever the HMI's current screen changes.
extern uint16_t lastIpScreen;

void processLogin();     // call on HR_LOGIN_BIT rising edge
void checkLogout();      // call every loop()
void processServer();    // call on HR_SERVER_BIT bit0 rising edge (SERVER screen "Hoàn thành")
void goBackToIpConfigScreen(); // call on HR_SERVER_BIT bit1 rising edge ("Quay lại")
void processConfirmStop();     // call on HR_CONFIRM_STOP_BIT bit1 rising edge
void processTimeStopComplete();// call on HR_TIMESTOP_COMPLETE_BIT bit0 rising edge
