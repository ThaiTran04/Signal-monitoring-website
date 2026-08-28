import type {
  ApiMachine,
  ApiConnectionHistory,
  ApiIoSegment,
  HistoryEntry,
  Machine,
  TimeSegment,
} from "../types";

export function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
  return { startMin: s.start_min, endMin: s.end_min, status: s.status };
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
