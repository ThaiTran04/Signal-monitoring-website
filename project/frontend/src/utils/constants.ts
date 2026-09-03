import { LayoutGrid, Settings, History } from "lucide-react";
import type { IoStatus, MachineStatus, Page } from "../types";

export const S: Record<MachineStatus | IoStatus, { color: string; label: string }> = {
  run: { color: "#16a34a", label: "Run" }, // xanh (green)
  stop: { color: "#eab308", label: "Stop" }, // vàng (yellow) — was amber/orange (#d97706)
  error: { color: "#dc2626", label: "Error" }, // đỏ (red)
  offline: { color: "#9ca3af", label: "Offline" }, // xám trung tính — Setup/Connection only, never used by Dashboard IO / I/O Detail
  unknown: { color: "#9ca3af", label: "Unknown" }, // xám — no IN1/IN2/IN3 reading (Dashboard IO / I/O Detail only, not "Offline")
};

export const MONO = "'JetBrains Mono', monospace";

export const NAV: Array<{ p: Page; Icon: typeof LayoutGrid; label: string }> = [
  { p: "dashboard", Icon: LayoutGrid, label: "Dashboard IO" },
  { p: "setup", Icon: Settings, label: "Setup" },
  { p: "history", Icon: History, label: "Conn. History" },
];

export const MIN_TICKS = [0, 10, 20, 30, 40, 50];
