#include "screens.h"
#include "hmi_map.h"
#include "auth.h"
#include "modbus_io.h"
#include "wifi_manager.h"
#include "server_client.h"

char username[21], password[21];
uint16_t lastIpScreen = SCREEN_DYNAMIC_IP;

void processLogin()
{
    readASCII(HR_USERNAME, 20, username);
    readASCII(HR_PASSWORD, 20, password);

    if      (strlen(username) == 0)              mb.Hreg(HR_LOGIN_RESULT, LOGIN_INPUT_USER);
    else if (strlen(password) == 0)               mb.Hreg(HR_LOGIN_RESULT, LOGIN_INPUT_PASS);
    else if (strcmp(username, USER_ADMIN) != 0)   mb.Hreg(HR_LOGIN_RESULT, LOGIN_WRONG);
    else if (strcmp(password, PASS_MENU) == 0)    screenJumpTo(SCREEN_MENU);
    else if (strcmp(password, PASS_WIFI) == 0)    screenJumpTo(SCREEN_DYNAMIC_IP);
    else                                            mb.Hreg(HR_LOGIN_RESULT, LOGIN_WRONG);

    setBit(HR_LOGIN_BIT, 0, false);
}

static uint16_t lastLogoutValue = 0;
void checkLogout()
{
    uint16_t v = mb.Hreg(HR_LOGOUT);
    if (v == 32 && lastLogoutValue != 32)
    {
        clearBuffer(username, sizeof(username));
        clearBuffer(password, sizeof(password));
        mb.Hreg(HR_LOGIN_RESULT, LOGIN_INPUT_USER);
        mb.Hreg(HR_LOGOUT, 0);
        screenJumpTo(SCREEN_LOGIN);
    }
    lastLogoutValue = v;
}

void goBackToIpConfigScreen() { screenJumpTo(lastIpScreen); }

void processServer()
{
    // staticIP/gateway/subnet/dns/ssid/wifiPass are declared extern in
    // wifi_manager.h (included above) — screens.cpp fills them from the HMI
    // before asking wifi_manager to connect.
    if (lastIpScreen == SCREEN_STATIC_IP)
    {
        readASCII(HR_STATIC_IP, 16, staticIP);
        readASCII(HR_GATEWAY, 16, gateway);
        readASCII(HR_SUBNET, 20, subnet);
        readASCII(HR_DNS, 10, dns);
        connectWiFi(true);
    }
    else
    {
        readASCII(HR_SSID, 20, ssid);
        readASCII(HR_WIFI_PASS, 20, wifiPass);
        connectWiFi(false);
    }

    readASCII(HR_SERVER_IP, 16, serverIP);
    serverPort = mb.Hreg(HR_SERVER_PORT);

    // Save whatever the operator entered so pushDeviceUpdate() can use it right
    // away; the screen still proceeds to Login either way (matching the
    // original permissive behavior) — but now shows LOGIN_NO_SERVER on the
    // physical HMI screen if the reachability check fails, instead of
    // silently saving a bad IP/port with zero on-screen indication. This
    // enum value already existed in hmi_map.h's LoginState (presumably
    // wired up on the HMI-project side as a "server unreachable" banner)
    // but nothing in the firmware ever set it before this.
    if (strlen(serverIP) > 0 && serverPort != 0)
    {
        strncpy(savedServerIP, serverIP, 16);
        savedServerPort = serverPort;
        saveServerConfig(serverIP, serverPort);
        serverConfigured = checkServerReachable(serverIP, serverPort);

        mb.Hreg(HR_LOGIN_RESULT, serverConfigured ? LOGIN_INPUT_USER : LOGIN_NO_SERVER);
        screenJumpTo(SCREEN_LOGIN);
    }
    setBit(HR_SERVER_BIT, 0, false);
}

// ================== Window 122 -> Screen 011 (bản rút gọn) ==================
// 008 -> 122 : HMI tự Screen Jump (đã cấu hình sẵn trong nút của Designer) -> ESP không cần làm gì
// 122 -> 011 : HMI tự Screen Jump -> ESP chỉ cần reset bit Set Coil về 0 để lần sau còn bắt được
// 011 -> 008 : HMI CHƯA tự nhảy -> ESP phải chủ động screenJumpTo(8) + reset bit Set Coil

void processConfirmStop()
{
    setBit(HR_CONFIRM_STOP_BIT, 1, false); // chỉ reset bit, HMI đã tự nhảy 122->011 rồi
}

void processTimeStopComplete()
{
    screenJumpTo(SCREEN_STOP_CONTENT); // Hoàn Thành ở 011 -> quay lại 008
    setBit(HR_TIMESTOP_COMPLETE_BIT, 0, false);
}
