// ─── Domain types ───────────────────────────────────────────────────────────

export type MachineStatus = "run" | "stop" | "error" | "unknown" | "offline";

/**
 * IO-only state, used exclusively by Dashboard IO and Machine Detail → I/O
 * Detail (heatmap, beacon lights, I/O timeline chart/legend). Derived purely
 * from the raw beacon inputs IN1/IN2/IN3 — never from `MachineStatus`
 * ("offline" is a connection-tracking concept that belongs to Setup/
 * Connection only and must never appear here). No input set (or no `io`
 * reading received yet) => "unknown", not "offline". See utils/format.ts
 * (ioStatusOf) for how this is computed.
 */
export type IoStatus = "run" | "stop" | "error" | "unknown";

export type Page = "dashboard" | "setup" | "history" | "detail";

/** UI-facing machine shape (camelCase, matches what the original App.tsx used). */
export interface Machine {
  id: number;
  name: string;
  status: MachineStatus;
  mac: string;
  ip: string;
  codeVersion: string;
  hmiVersion: string;
  offlineSince?: string;
  hmiLogin: boolean;
  /**
   * Raw digital-input readings from the ESP32 (IN1=error/red, IN2=stop/yellow,
   * IN3=run/green — confirmed against esp32/include/hmi_map.h + server_client.cpp).
   * `undefined` = no `io` reading has ever been received for this machine yet;
   * do NOT treat that as "off" (see components/shared/IoLights.tsx).
   */
  ioInput1?: boolean;
  ioInput2?: boolean;
  ioInput3?: boolean;
  ioInput4?: boolean;
  ioUpdatedAt?: string;
}

export interface HistoryEntry {
  time: string;
  machine: string;
  event: "Connected" | "Disconnected";
}

export interface TimeSegment {
  startSec: number;
  endSec: number;
  status: IoStatus;
}

// ─── API (snake_case) response shapes, mirroring backend/app/schemas ────────

export interface ApiMachine {
  id: number;
  machine_name: string;
  mac_address: string;
  ip_address: string;
  firmware_version?: string | null;
  hmi_version?: string | null;
  hmi_login: boolean;
  status: MachineStatus;
  offline_since?: string | null;
  io_input1?: boolean | null;
  io_input2?: boolean | null;
  io_input3?: boolean | null;
  io_input4?: boolean | null;
  io_updated_at?: string | null;
}

export interface ApiMachineListResponse {
  items: ApiMachine[];
  total: number;
}

export interface ApiStatusSummary {
  total: number;
  run: number;
  stop: number;
  error: number;
  unknown: number;
  offline: number;
}

export interface ApiIoSegment {
  start_sec: number;
  end_sec: number;
  status: IoStatus;
}

export interface ApiIoHistoryResponse {
  machine_id: number;
  date: string;
  segments: ApiIoSegment[];
}

export interface ApiConnectionHistory {
  id: number;
  machine_id: number;
  machine_name: string;
  mac_address: string;
  ip_address: string;
  connected_at?: string | null;
  disconnected_at?: string | null;
  duration_min?: number | null;
  reason?: string | null;
}

export interface ApiHmiLoginHistory {
  id: number;
  machine_id: number;
  machine_name: string;
  username: string;
  login_at: string;
  logout_at?: string | null;
}

export interface ApiLoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: string;
}

export interface ApiMeResponse {
  username: string;
  role: string;
}

// ─── WebSocket realtime payload ──────────────────────────────────────────────

export interface WsMachineStatusUpdate {
  type: "machine_update";
  machine_id: number;
  machine_name: string;
  status: MachineStatus;
  io_input1?: boolean | null;
  io_input2?: boolean | null;
  io_input3?: boolean | null;
  io_input4?: boolean | null;
  timestamp: string;
}

/** Sent by the backend when the ESP32/HMI panel itself reports an operator
 * logging in or out on the physical touchscreen (see backend
 * app/api/device.py: /api/device/hmi-login, /api/device/hmi-logout).
 * Independent of the website's own admin/JWT session. */
export interface WsHmiLoginUpdate {
  type: "hmi_login_update";
  machine_id: number;
  machine_name: string;
  hmi_login: boolean;
  timestamp: string;
}

export type WsMachineUpdate = WsMachineStatusUpdate | WsHmiLoginUpdate;
