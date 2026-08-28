#include <Arduino.h>
#include <WiFi.h>
#include "pins.h"
#include "hmi_map.h"
#include "modbus_io.h"
#include "wifi_manager.h"
#include "server_client.h"
#include "screens.h"

void setup()
{
    Serial.begin(115200);

    // Set STA mode up front (independent of whether WiFi creds exist yet) so
    // WiFi.macAddress() is valid immediately — pushDeviceUpdate() needs it to
    // identify the device to the backend.
    WiFi.mode(WIFI_STA);

    pinMode(IN1, INPUT); pinMode(IN2, INPUT); pinMode(IN3, INPUT); pinMode(IN4, INPUT);
    pinMode(OUT1, OUTPUT); pinMode(OUT2, OUTPUT); pinMode(OUT3, OUTPUT); pinMode(OUT4, OUTPUT);

    RS485.begin(MODBUS_BAUD, SERIAL_8N1, RXD2, TXD2);
    mb.begin(&RS485);
    mb.slave(MODBUS_SLAVE_ID);

    for (int i = 0; i <= HREG_MAX; i++) mb.addHreg(i);
    for (int i = 0; i <= IREG_MAX; i++) mb.addIreg(i);

    autoReconnectFromSavedConfig(); // restores WiFi + (if used) Static IP, pre-fills HMI fields, reconnects

    uint16_t savedPort;
    if (loadServerConfig(savedServerIP, savedPort))
    {
        savedServerPort = savedPort;
        Serial.printf(">>> LOADED SERVER: %s:%u\n", savedServerIP, savedServerPort);
        restoreServerFieldsToHmi(); // pre-fill SERVER screen so operator doesn't retype
    }

    Serial.println("\n===== ESP32 HMI READY =====");
}

void loop()
{
    mb.task();
    updateScreenJump();

    static uint16_t lastScreenSeen = SCREEN_LOGIN;
    uint16_t scrNow = currentScreen();
    if (scrNow != lastScreenSeen)
    {
        if (scrNow == SCREEN_DYNAMIC_IP || scrNow == SCREEN_STATIC_IP)
            lastIpScreen = scrNow;
        lastScreenSeen = scrNow;
    }

    static bool lastLoginEdge = false;
    bool login = getBit(HR_LOGIN_BIT, 0);
    if (login && !lastLoginEdge) processLogin();
    lastLoginEdge = login;

    checkLogout();
    updateWiFiState();
    updateServerCheck(); // services requestServerCheck() from processServer() once WiFi finishes connecting
    ensureNtpConfigured();

    static unsigned long lastStatusPush = 0;
    if (millis() - lastStatusPush > STATUS_PUSH_INTERVAL_MS)
    {
        pushDeviceUpdate();
        lastStatusPush = millis();
    }

    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 1000)
    {
        Serial.printf("[HB] scr=%u dhcpBitRaw=0x%04X loginBitRaw=0x%04X ssidLen=%d serverOk=%d\n",
                      currentScreen(),
                      mb.Hreg(HR_DHCP_BIT),
                      mb.Hreg(HR_LOGIN_BIT),
                      strlen(ssid),
                      serverConfigured);
        lastHeartbeat = millis();
    }

    static bool lastServerEdge = false;
    bool server = getBit(HR_SERVER_BIT, 0);
    if (server && !lastServerEdge) processServer();
    lastServerEdge = server;

    static bool lastServerBackEdge = false;
    bool serverBack = getBit(HR_SERVER_BIT, 1);
    if (serverBack && !lastServerBackEdge)
    {
        goBackToIpConfigScreen();
        setBit(HR_SERVER_BIT, 1, false);
    }
    lastServerBackEdge = serverBack;

    updateLoginPasswordDisplay();

    static unsigned long lastUpdate = 0;
    if (millis() - lastUpdate > 500)
    {
        updateGlobalStatus();
        updateDateTimeDisplay();
        lastUpdate = millis();
    }

    updateIO();

    static bool lastConfirmStopEdge = false;
    bool confirmStop = getBit(HR_CONFIRM_STOP_BIT, 1);
    if (confirmStop && !lastConfirmStopEdge) processConfirmStop();
    lastConfirmStopEdge = confirmStop;

    static bool lastTimeStopCompleteEdge = false;
    bool timeStopComplete = getBit(HR_TIMESTOP_COMPLETE_BIT, 0);
    if (timeStopComplete && !lastTimeStopCompleteEdge) processTimeStopComplete();
    lastTimeStopCompleteEdge = timeStopComplete;

    delay(5);
}