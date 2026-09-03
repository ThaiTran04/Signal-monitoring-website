import type {
  ApiMachine,
  ApiConnectionHistory,
  ApiIoSegment,
  HistoryEntry,
  IoStatus,
  Machine,
  TimeSegment,
} from "../types";

/**
 * Derives the IO status for Dashboard IO / Machine Detail → I/O Detail
 * purely from the raw beacon inputs IN1/IN2/IN3 (ioInput1/2/3). This is
 * intentionally independent of `machine.status` (which can be "offline" —
 * a connection-tracking concept used only by Setup/Connection). No input
 * set, or no `io` reading ever received, maps to "unknown" — never
 * "offline". Priority matches the physical beacon: IN1 (error) > IN2
 * (stop) > IN3 (run).
 */
export function ioStatusOf(m: Pick<Machine, "ioInput1" | "ioInput2" | "ioInput3">): IoStatus {
  if (m.ioInput1) return "error";
  if (m.ioInput2) return "stop";
  if (m.ioInput3) return "run";
  return "unknown";
}

/** Defensive normalization: an IO status coming from the API should only
 * ever be run/stop/error/unknown, but this guards against any unexpected
 * value (e.g. legacy data) leaking through as something else. */
function normalizeIoStatus(status: string): IoStatus {
  return status === "run" || status === "stop" || status === "error" ? status : "unknown";
}

/** Formats seconds-since-local-midnight as "HH:MM:SS". */
export function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Formats a duration given in seconds, e.g. "45s", "3m 12s", "1h 05m". */
export function fmtDuration(totalSec: number): string {
  if (totalSec < 60) return `${Math.round(totalSec)}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Returns today's date as YYYY-MM-DD (local time). */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2025-01-15T14:32:10.000Z" -> "2025-01-15 14:32:10" (local time, space-separated). */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
}

/** Maps a backend ApiMachine (snake_case) to the UI-facing Machine shape. */
export function mapMachine(m: ApiMachine): Machine {
  return {
    id: m.id,
    name: m.machine_name,
    status: m.status,
    mac: m.mac_address,
    ip: m.ip_address,
    codeVersion: m.firmware_version ?? "—",
    hmiVersion: m.hmi_version ?? "—",
    offlineSince: m.offline_since ? fmtDateTime(m.offline_since) : undefined,
    hmiLogin: m.hmi_login,
    ioInput1: m.io_input1 ?? undefined,
    ioInput2: m.io_input2 ?? undefined,
    ioInput3: m.io_input3 ?? undefined,
    ioInput4: m.io_input4 ?? undefined,
    ioUpdatedAt: m.io_updated_at ?? undefined,
  };
}

export function mapSegment(s: ApiIoSegment): TimeSegment {
  return { startSec: s.start_sec, endSec: s.end_sec, status: normalizeIoStatus(s.status) };
}

/**
 * A connection-history row can carry both a connect and a disconnect
 * timestamp. Expand each row into up to two flat log entries (one per
 * event) for the connection-history table.
 */
export function mapConnectionHistoryRows(
  rows: ApiConnectionHistory[]
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const r of rows) {
    if (r.connected_at) {
      out.push({
        time: fmtDateTime(r.connected_at),
        machine: r.machine_name,
        event: "Connected",
      });
    }
    if (r.disconnected_at) {
      out.push({
        time: fmtDateTime(r.disconnected_at),
        machine: r.machine_name,
        event: "Disconnected",
      });
    }
  }
  out.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  return out;
}
