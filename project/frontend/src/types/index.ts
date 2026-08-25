// ─── Domain types ───────────────────────────────────────────────────────────

export type MachineStatus = "run" | "stop" | "error" | "offline";

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
}

export interface HistoryEntry {
  time: string;
  machine: string;
  event: "Connected" | "Disconnected";
}

export interface TimeSegment {
  startMin: number;
  endMin: number;
  status: MachineStatus;
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
  offline: number;
}

export interface ApiIoSegment {
  start_min: number;
  end_min: number;
  status: MachineStatus;
}

export interface ApiIoHistoryResponse {
  machine_id: number;
  date: string;
  segments: ApiIoSegment[];
}

export interface ApiOee {
  machine_id: number;
  production: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  timestamp: string;
}

export interface ApiOeeSummary {
  avg_production: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  avg_oee: number;
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

export interface WsMachineUpdate {
  type: "machine_update";
  machine_id: number;
  machine_name: string;
  status: MachineStatus;
  timestamp: string;
}
