import { apiFetch } from "./apiClient";
import type {
  ApiConnectionHistory,
  ApiHmiLoginHistory,
  ApiIoHistoryResponse,
  ApiLoginResponse,
  ApiMachine,
  ApiMachineListResponse,
  ApiMeResponse,
  ApiOee,
  ApiOeeSummary,
  ApiStatusSummary,
} from "../types";

// ─── Auth ─────────────────────────────────────────────────────────────────

export const authApi = {
  login(username: string, password: string) {
    return apiFetch<ApiLoginResponse>("/api/login", {
      method: "POST",
      body: { username, password },
      skipAuth: true,
    });
  },
  logout() {
    return apiFetch<{ detail?: string }>("/api/logout", { method: "POST" });
  },
  me() {
    return apiFetch<ApiMeResponse>("/api/me");
  },
};

// ─── Machines ─────────────────────────────────────────────────────────────

export interface ListMachinesParams {
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export const machinesApi = {
  list(params: ListMachinesParams = {}) {
    return apiFetch<ApiMachineListResponse>("/api/machines", { query: params });
  },
  get(id: number) {
    return apiFetch<ApiMachine>(`/api/machines/${id}`);
  },
  create(payload: {
    machine_name: string;
    mac_address: string;
    ip_address: string;
    firmware_version?: string;
    hmi_version?: string;
  }) {
    return apiFetch<ApiMachine>("/api/machines", { method: "POST", body: payload });
  },
  update(id: number, payload: Partial<{
    machine_name: string;
    mac_address: string;
    ip_address: string;
    firmware_version: string;
    hmi_version: string;
  }>) {
    return apiFetch<ApiMachine>(`/api/machines/${id}`, { method: "PUT", body: payload });
  },
  remove(id: number) {
    return apiFetch<void>(`/api/machines/${id}`, { method: "DELETE" });
  },
};

// ─── Status ───────────────────────────────────────────────────────────────

export const statusApi = {
  summary() {
    return apiFetch<ApiStatusSummary>("/api/machines/status/summary");
  },
  get(machineId: number) {
    return apiFetch(`/api/machines/${machineId}/status`);
  },
};

// ─── IO ───────────────────────────────────────────────────────────────────

export const ioApi = {
  history(machineId: number, date: string) {
    return apiFetch<ApiIoHistoryResponse>(`/api/machines/${machineId}/io/history`, {
      query: { date },
    });
  },
  current(machineId: number) {
    return apiFetch(`/api/machines/${machineId}/io`);
  },
};

// ─── OEE ──────────────────────────────────────────────────────────────────

export const oeeApi = {
  get(machineId: number) {
    return apiFetch<ApiOee>(`/api/machines/${machineId}/oee`);
  },
  summary() {
    return apiFetch<ApiOeeSummary>("/api/oee/summary");
  },
};

// ─── Connection history ───────────────────────────────────────────────────

export interface ListConnectionHistoryParams {
  machine_id?: number;
  search?: string;
  date?: string;
}

export const connectionHistoryApi = {
  list(params: ListConnectionHistoryParams = {}) {
    return apiFetch<ApiConnectionHistory[]>("/api/connection-history", { query: params });
  },
};

// ─── HMI login history ────────────────────────────────────────────────────

export const hmiLoginHistoryApi = {
  list(params: { machine_id?: number } = {}) {
    return apiFetch<ApiHmiLoginHistory[]>("/api/hmi-login-history", { query: params });
  },
};
