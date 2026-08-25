#pragma once

// Modbus Memory Map - Samkoon HMI
// Holding Register (4x) : mb.Hreg()
// Input Register   (3x) : mb.Ireg()

//--
// GLOBAL (dùng chung cho mọi SCREEN)

// Holding Registers (4x)
#define HR_CURRENT_SCREEN 0 // 4x0 - Số màn hình hiện tại
#define HR_SCREEN_JUMP    1 // 4x1 - Yêu cầu chuyển màn hình

//Date & Time
#define HR_DATE           1009 // ngày / tháng /năm (4x1009)
#define HR_TIME           1014 // Giờ / Phút / Giây (4x1014)

// wifi
#define HR_WIFI_IP             799 // Địa chỉ IP WiFi (4x799)
#define HR_WIFI_RSSI           809 // Cường độ tín hiệu WiFi RSSI (%) (4x809)
#define HR_WIFI_ICON           810 // WiFi Icon 4x_Bit810.0
#define IR_WIFI_DISCONNECTED   0   // 3x0 - đen: mất WiFi, vàng: có WiFi nhưng chưa kết nối server, xanh: có WiFi và kết nối server
#define IR_WIFI_DOWN_FLAG      1   // 3x1 - chỉ dùng để ẩn/hiện banner
//--

//--
// SCREEN
// SCREEN 000 : LOGIN
#define HR_USERNAME        149 // Username (TE0000)
#define HR_PASSWORD        159 // Password (TE0001)
#define HR_LOGIN_RESULT    170 // Login Banner Result (ML0000)
#define HR_LOGIN_TEXT      171 // Login Message (AS0060) display password as ****
#define HR_LOGIN_BIT       169 // Login Button (BB0000 bit0) 4x_Bit169.0

// SCREEN 001 : MENU
#define HR_LOGOUT          179 // Logout (MF5) 4x179

// SCREEN 100 : DYNAMIC IP
#define HR_SSID             9  // WiFi SSID (TE0)
#define HR_WIFI_PASS        19 // WiFi Password (TE1)
#define HR_DHCP_BIT         29 // Xác nhận info WiFi DYNAMIC/STATIC IP  (MF0 bit0) -4x_Bit29.0

// SCREEN 101 : STATIC IP
#define HR_STATIC_IP        30 // Static IP (TE2)
#define HR_GATEWAY          39 // Gateway (TE4)
#define HR_SUBNET           49 // Subnet (TE3)
#define HR_DNS              59 // DNS (TE5)

// SCREEN 102 : SERVER
#define HR_SERVER_IP        69 // Server IP (TE0)
#define HR_SERVER_PORT      78 // Server Port (NE0)

// Server Button
// bit0 = Hoàn thành
// bit1 = Quay lại
#define HR_SERVER_BIT       98

// SCREEN 002 : MAIN

// Numeric Display (Hiển thị số)
#define HR_PRODUCTION_STAGE      229 // AS0004 -> Công Đoạn
#define HR_LOT_NUMBER            259 // AS0003 -> Lot No
#define HR_PRODUCTION_ORDER      244 // AS0002 -> Số KHSX
#define HR_CHARGE                214 // AS0001 -> Charge
#define HR_MAIN_TITLE            199 // AS0000 -> Tiêu đề

#define HR_QUALITY               282 // ND5 -> Chất Lượng (%)
#define HR_PERFORMANCE           280 // ND4 -> Lao Động (%)
#define HR_AVAILABILITY          278 // ND3 -> Khả Dụng (%)
#define HR_SP_PER_MACHINE        276 // ND2 -> SP/1MC
#define HR_PRODUCTION_COUNT_2    275 // ND1 -> Sản Lượng (phải)
#define HR_PRODUCTION_COUNT_1    274 // ND0 -> Sản Lượng (trái)

//Button Bits
#define HR_BUTTON_REGISTER       285 // 4x_BIT285.x

#define HR_BTN_LEFT_BIT           0  // BB0 -> Sang Trái
#define HR_BTN_RIGHT_BIT          1  // BB1 -> Sang Phải
#define HR_BTN_START_BIT          2  // BB2 -> BẮT ĐẦU
#define HR_BTN_STOP_BIT           3  // BB3 -> DỪNG
#define HR_BTN_END_BIT            4  // BB4 -> Kết Thúc

// Status
#define HR_MAIN_STATUS           284 // ML0 -> Trạng thái sản xuất

//Progress Gauge (đổng hồ tiến độ)
#define HR_GAUGE_AVAILABILITY    278 // PG0000 -> Đồng hồ Khả Dụng
#define HR_GAUGE_PERFORMANCE     280 // PG0001 -> Đồng hồ Lao Động
#define HR_GAUGE_QUALITY         282 // PG0002 -> Đồng hồ Chất Lượng

// SCREEN 004 : IO

//Machine Signals (3x101 Bit4~0)
#define IR_MACHINE_END_BIT        4  // BL00029 (3x Bit101.4) -> KẾT THÚC
#define IR_MACHINE_ERROR_BIT      3  // BL00028 (3x Bit101.3) -> LỖI
#define IR_MACHINE_STOP_BIT       2  // BL00027 (3x Bit101.2) -> DỪNG
#define IR_MACHINE_RUN_BIT        1  // BL00026 (3x Bit101.1) -> CHẠY
#define IR_MACHINE_START_BIT      0  // BL00025 (3x Bit101.0) -> KHỞI ĐỘNG

//IoT Outputs (3x100 Bit3~0)
#define IR_OUT03_SPARE_BIT        3  // BL00024 (3x Bit100.3) -> OUT03 (SPARE 03)
#define IR_OUT02_SPARE_BIT        2  // BL00023 (3x Bit100.2) -> OUT02 (SPARE 02)
#define IR_OUT01_SPARE_BIT        1  // BL00022 (3x Bit100.1) -> OUT01 (SPARE 01)
#define IR_OUT00_BUZZER_BIT       0  // BL00021 (3x Bit100.0) -> OUT00 (ĐÈN CÒI)

//IoT Inputs (3x99 Bit3~0)
#define IR_IN03_DOOR_BIT          3  // BL00020 (3x Bit99.3) -> IN03 (MỞ CỬA)
#define IR_IN02_GREEN_BIT         2  // BL00019 (3x Bit99.2) -> IN02 (XANH)
#define IR_IN01_YELLOW_BIT        1  // BL00018 (3x Bit99.1) -> IN01 (VÀNG)
#define IR_IN00_RED_BIT           0  // BL0     (3x Bit99.0) -> IN00 (ĐỎ)

// SCREEN 006 : PRODUCT QUANTITY (Chất Lượng Sản Phẩm)
#define HR_QUALITY_CHARGE        79  // AS0005 (4x79) -> CHARGE (text)
#define HR_QUALITY_NG_TOTAL      464 // ND0   (4x464) -> Tổng Số Lượng NG (chỉ đọc)
#define HR_QUALITY_NG_INPUT      465 // NE2   (4x465) -> Nhập Số Lượng NG (nhập tay)
#define HR_QUALITY_PRODUCED      466 // ND1   (4x466) -> Số Lượng Sản Xuất (chỉ đọc)
#define HR_QUALITY_SAVE_BIT      470 // BB0 bit0 (4x_Bit470.0) -> nút Lưu
// TODO: chưa xử lý màn này trong code - để làm sau

// SCREEN 008 : STOP CONTENT (Nội Dung Dừng)
#define HR_STOP_REASON            314 // MF0,MF1,MF0002,MF0003,MF0008 (4x314)
// -> giá trị 1~5 tương ứng 5 nút lý do dừng, HMI tự ghi + tự Screen Jump sang 122, không cần ESP xử lý

// Window 122 : CONFIRM STOP
#define HR_CONFIRM_STOP_BIT       319 // MF0004 bit1 (4x_Bit319.1) -> nút XÁC NHẬN
// HMI tự Set Coil + Screen Jump sang 011, ESP chỉ cần reset bit về 0 sau khi xử lý

// SCREEN 011 : TIME STOP (Thời Gian Dừng)
#define IR_TIMESTOP_HH            159 // ND0 (3x159) -> Giờ dừng (HH) - CHƯA code (để sau)
#define IR_TIMESTOP_MM            160 // ND1 (3x160) -> Phút dừng (MM) - CHƯA code (để sau)
#define IR_TIMESTOP_SS            161 // ND2 (3x161) -> Giây dừng (SS) - CHƯA code (để sau)
#define HR_TIMESTOP_COMPLETE_BIT  500 // BB0 bit0 (4x_Bit500.0) -> nút HOÀN THÀNH: ESP tự Screen Jump về 008 + reset bit

// Ghi chú: "Sản Phẩm" (AS0,4x199) và "Số Lot No" (AS1,4x259) ở màn 011
// TRÙNG với HR_MAIN_TITLE(199) / HR_LOT_NUMBER(259) ở Screen 002 -> dùng lại, không define riêng.

//--

// ScreenID
enum ScreenID
{
    SCREEN_LOGIN        = 0,
    SCREEN_MENU         = 1,
    SCREEN_MAIN         = 2,
    SCREEN_IO           = 4,
    SCREEN_PRODUCT_QTY  = 6,
    SCREEN_STOP_CONTENT = 8,
    SCREEN_TIME_STOP    = 11,
    SCREEN_DYNAMIC_IP   = 100,
    SCREEN_STATIC_IP    = 101,
    SCREEN_SERVER       = 102,
    WINDOW_CONFIRM_STOP = 122
};

// LOGIN STATE - 4x170
enum LoginState
{
    LOGIN_INPUT_USER = 1,
    LOGIN_INPUT_PASS = 2,
    LOGIN_WRONG      = 3,
    LOGIN_NO_SERVER  = 4,
    LOGIN_NOT_REG    = 5
};

// Lý do dừng - STOP_REASON (4x314)
enum StopReason
{
    STOP_WAIT_TOOL_ADJUST   = 1, // MF0002 -> Dừng chờ thay công cụ điều chỉnh
    STOP_LACK_OPERATOR      = 2, // MF0003 -> Dừng thiếu người chạy máy
    STOP_ADJUSTING          = 3, // MF0008 -> Dừng căn chỉnh
    STOP_WAIT_ADJUST        = 4, // MF0    -> Dừng chờ căn chỉnh
    STOP_CHECK_ADJUST       = 5  // MF1    -> Dừng kiểm tra căn chỉnh
};

// Modbus vùng nhớ cần khởi tạo
#define HREG_MAX 1100
#define IREG_MAX 1000