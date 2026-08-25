#include "modbus_io.h"
#include <WiFi.h>
#include "pins.h"
#include "hmi_map.h"
#include "server_client.h" // needs serverConfigured for the WiFi/server icon

ModbusRTU mb;

// ---------------- Screen navigation ----------------
uint16_t currentScreen() { return mb.Hreg(HR_CURRENT_SCREEN); }

static const unsigned long SCREEN_JUMP_SENTINEL_DELAY_MS = 300;
static uint16_t pendingScreenJump = 0;
static bool screenJumpPending = false;
static unsigned long screenJumpSentinelAt = 0;

void screenJumpTo(uint16_t screenId)
{
    uint16_t sentinel = currentScreen();
    if (sentinel == screenId)
        sentinel = (screenId == SCREEN_LOGIN) ? SCREEN_MENU : SCREEN_LOGIN;

    mb.Hreg(HR_SCREEN_JUMP, sentinel);
    pendingScreenJump = screenId;
    screenJumpPending = true;
    screenJumpSentinelAt = millis();
}

void updateScreenJump()
{
    if (screenJumpPending && millis() - screenJumpSentinelAt >= SCREEN_JUMP_SENTINEL_DELAY_MS)
    {
        mb.Hreg(HR_SCREEN_JUMP, pendingScreenJump);
        screenJumpPending = false;
    }
}

// ---------------- Raw register helpers ----------------
bool getBit(uint16_t reg, uint8_t bit) { return (mb.Hreg(reg) >> bit) & 1; }

void setBit(uint16_t reg, uint8_t bit, bool v)
{
    uint16_t r = mb.Hreg(reg);
    v ? r |= (1 << bit) : r &= ~(1 << bit);
    mb.Hreg(reg, r);
}

void clearBuffer(char *buf, int len) { memset(buf, 0, len); }

void readASCII(uint16_t startReg, uint8_t totalChar, char *buf)
{
    clearBuffer(buf, totalChar + 1);
    uint8_t regCount = (totalChar + 1) / 2;
    for (uint8_t i = 0; i < regCount; i++)
    {
        uint16_t v = mb.Hreg(startReg + i);
        buf[i * 2] = v & 0xFF;
        if (i * 2 + 1 < totalChar) buf[i * 2 + 1] = v >> 8;
    }
    for (int i = totalChar - 1; i >= 0; i--)
    {
        if (buf[i] == 0 || buf[i] == ' ') buf[i] = 0; else break;
    }
}

void writeASCII(uint16_t startReg, uint8_t totalChar, const char *buf)
{
    uint8_t regCount = (totalChar + 1) / 2;
    uint8_t len = strlen(buf);
    for (uint8_t i = 0; i < regCount; i++)
    {
        uint8_t lo = (i * 2 < len) ? buf[i * 2] : 0;
        uint8_t hi = (i * 2 + 1 < len) ? buf[i * 2 + 1] : 0;
        mb.Hreg(startReg + i, (uint16_t)lo | ((uint16_t)hi << 8));
    }
}

// ================== SCREEN 004 : IO (bản rút gọn) ==================
// Chỉ 3 tín hiệu: đỏ=IN00=LỖI, vàng=IN01=DỪNG, xanh=IN02=CHẠY
// Độc lập nhau, không ưu tiên - IN nào có tín hiệu thì đèn đó sáng, có thể sáng cùng lúc nhiều cái
void updateIO()
{
    bool inRed    = !digitalRead(IN1); // active LOW: kích = nối GND
    bool inYellow = !digitalRead(IN2);
    bool inGreen  = !digitalRead(IN3);

    uint16_t inReg = 0;
    bitWrite(inReg, IR_IN00_RED_BIT,    inRed);
    bitWrite(inReg, IR_IN01_YELLOW_BIT, inYellow);
    bitWrite(inReg, IR_IN02_GREEN_BIT,  inGreen);
    mb.Ireg(99, inReg);
}

void updateGlobalStatus()
{
    bool wifiUp = (WiFi.status() == WL_CONNECTED);

    int rssiPct = 0;
    if (wifiUp)
    {
        writeASCII(HR_WIFI_IP, 16, WiFi.localIP().toString().c_str());
        rssiPct = constrain(map(WiFi.RSSI(), -90, -30, 0, 100), 0, 100);
        mb.Hreg(HR_WIFI_RSSI, (uint16_t)rssiPct);
    }
    else
    {
        writeASCII(HR_WIFI_IP, 16, "");
        mb.Hreg(HR_WIFI_RSSI, 0);
    }

    uint16_t iconState;
    if (!wifiUp)                 iconState = 0;
    else if (!serverConfigured)  iconState = 1;
    else                          iconState = 2;
    mb.Ireg(IR_WIFI_DISCONNECTED, iconState);

    bool showBanner = (iconState != 2);
    mb.Ireg(IR_WIFI_DOWN_FLAG, showBanner ? 1 : 0);
}

void updateDateTimeDisplay()
{
    if (WiFi.status() != WL_CONNECTED) return;
    struct tm t;
    if (!getLocalTime(&t, 5)) return;
    char d[11], h[9];
    strftime(d, sizeof(d), "%d/%m/%Y", &t);
    strftime(h, sizeof(h), "%H:%M:%S", &t);
    writeASCII(HR_DATE, 10, d);
    writeASCII(HR_TIME, 8, h);
}

void updateLoginPasswordDisplay()
{
    char live[21];
    readASCII(HR_PASSWORD, 20, live);
    char masked[33];
    memset(masked, '*', strlen(live));
    masked[strlen(live)] = '\0';
    writeASCII(HR_LOGIN_TEXT, 32, masked);
}
