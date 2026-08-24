import { useState, useMemo } from "react";
import {
  LayoutGrid,
  Settings,
  History,
  Search,
  LogOut,
  Download,
  Calendar,
  ChevronLeft,
  User,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MachineStatus = "run" | "stop" | "error" | "offline";
type Page = "dashboard" | "setup" | "history" | "detail";

interface Machine {
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

interface HistoryEntry {
  time: string;
  machine: string;
  event: "Connected" | "Disconnected";
}

interface TimeSegment {
  startMin: number;
  endMin: number;
  status: MachineStatus;
}

// ─── Data generation ──────────────────────────────────────────────────────────

function sr(n: number): number {
  const x = Math.sin(n + 1.7) * 43758.5453;
  return x - Math.floor(x);
}

const MACHINES: Machine[] = Array.from({ length: 200 }, (_, i) => {
  const id = i + 1;
  const v = sr(id * 3);
  const status: MachineStatus =
    v < 0.58 ? "run" : v < 0.73 ? "stop" : v < 0.87 ? "error" : "offline";
  return {
    id,
    name: `M-${String(id).padStart(3, "0")}`,
    status,
    mac: [
      0x00, 0x1b, 0x44,
      Math.floor(sr(id * 7) * 256),
      Math.floor(sr(id * 11) * 256),
      Math.floor(sr(id * 13) * 256),
    ]
      .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
      .join(":"),
    ip: `192.168.${Math.floor(i / 100) + 1}.${(i % 100) + 10}`,
    codeVersion: `v2.${Math.floor(sr(id * 17) * 5) + 1}.${Math.floor(sr(id * 19) * 10)}`,
    hmiVersion: `HMI-${Math.floor(sr(id * 23) * 3) + 1}.0`,
    offlineSince:
      status === "offline"
        ? `2025-01-15 ${String(8 + Math.floor(sr(id * 31) * 12)).padStart(2, "0")}:${String(
            Math.floor(sr(id * 37) * 60)
          ).padStart(2, "0")}`
        : undefined,
    hmiLogin: sr(id * 29) > 0.35,
  };
});

function getSegments(machineId: number, dateStr: string): TimeSegment[] {
  const dh = dateStr
    .split("-")
    .reduce((a, s, i) => a + parseInt(s) * (i + 1), 0);
  const base = machineId * 1000 + dh;
  const segs: TimeSegment[] = [];
  let t = 0;
  let i = 0;

  while (t < 1440) {
    const sv = sr(base + i * 17 + 1);
    let status: MachineStatus;
    let dur: number;

    if (sv < 0.60) {
      status = "run";
      dur = Math.floor(sr(base + i * 13) * 90) + 30;
    } else if (sv < 0.78) {
      status = "stop";
      dur = Math.floor(sr(base + i * 19) * 25) + 5;
    } else if (sv < 0.90) {
      status = "error";
      dur = Math.floor(sr(base + i * 23) * 13) + 2;
    } else {
      status = "offline";
      dur = Math.floor(sr(base + i * 29) * 45) + 15;
    }

    const end = Math.min(t + dur, 1440);
    segs.push({ startMin: t, endMin: end, status });
    t = end;
    i++;
  }

  return segs;
}

const HISTORY_DATA: HistoryEntry[] = [
  { time: "2025-01-15 14:32:10", machine: "M-023", event: "Disconnected" },
  { time: "2025-01-15 14:28:44", machine: "M-117", event: "Connected" },
  { time: "2025-01-15 13:55:02", machine: "M-088", event: "Disconnected" },
  { time: "2025-01-15 13:50:18", machine: "M-088", event: "Connected" },
  { time: "2025-01-15 12:41:30", machine: "M-145", event: "Disconnected" },
  { time: "2025-01-15 11:22:07", machine: "M-062", event: "Connected" },
  { time: "2025-01-15 10:15:55", machine: "M-199", event: "Disconnected" },
  { time: "2025-01-15 09:44:12", machine: "M-037", event: "Connected" },
  { time: "2025-01-15 08:30:00", machine: "M-056", event: "Disconnected" },
  { time: "2025-01-15 07:18:22", machine: "M-112", event: "Connected" },
  { time: "2025-01-14 22:05:10", machine: "M-023", event: "Connected" },
  { time: "2025-01-14 18:33:44", machine: "M-145", event: "Connected" },
  { time: "2025-01-14 16:20:08", machine: "M-199", event: "Connected" },
  { time: "2025-01-14 15:12:55", machine: "M-078", event: "Disconnected" },
  { time: "2025-01-14 14:01:33", machine: "M-078", event: "Connected" },
  { time: "2025-01-14 11:45:09", machine: "M-041", event: "Disconnected" },
];

// ─── Config ────────────────────────────────────────────────────────────────────

const S: Record<MachineStatus, { color: string; label: string }> = {
  run:     { color: "#16a34a", label: "Run"     },
  stop:    { color: "#d97706", label: "Stop"    },
  error:   { color: "#dc2626", label: "Error"   },
  offline: { color: "#6b7280", label: "Offline" },
};

const MONO = "'JetBrains Mono', monospace";

const NAV: Array<{ p: Page; Icon: typeof LayoutGrid; label: string }> = [
  { p: "dashboard", Icon: LayoutGrid, label: "Dashboard IO"  },
  { p: "setup",     Icon: Settings,   label: "Setup"         },
  { p: "history",   Icon: History,    label: "Conn. History" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (u === "admin" && p === "admin") {
      onLogin();
    } else {
      setErr(true);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F1F3F7", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-80 p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-tight">
              HMI Monitor
            </div>
            <div
              className="text-[10px] text-gray-400 leading-tight"
              style={{ fontFamily: MONO }}
            >
              v2.4.1 · ESP32 System
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-0.5">Sign in</h2>
        <p className="text-xs text-gray-500 mb-6">Industrial monitoring access</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={u}
              onChange={(e) => { setU(e.target.value); setErr(false); }}
              placeholder="Enter username"
              autoComplete="username"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={p}
              onChange={(e) => { setP(e.target.value); setErr(false); }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          {err && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} />
              Invalid username or password
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Login
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-5">
          Demo:{" "}
          <span style={{ fontFamily: MONO }} className="text-gray-600">
            admin
          </span>{" "}
          /{" "}
          <span style={{ fontFamily: MONO }} className="text-gray-600">
            admin
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  page,
  onNavigate,
  onLogout,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
}) {
  const active = page === "detail" ? "dashboard" : page;

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-full"
      style={{ background: "#1C2B42" }}
    >
      <div
        className="px-5 py-4 flex-shrink-0 border-b"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Activity size={14} className="text-white" />
          </div>
          <span className="text-white text-sm font-bold tracking-tight">
            HMI Monitor
          </span>
        </div>
        <div
          className="mt-1 text-[10px]"
          style={{ color: "#6A8099", fontFamily: MONO }}
        >
          v2.4.1 · ESP32
        </div>
      </div>

      <nav className="flex-1 py-3">
        {NAV.map(({ p, Icon, label }) => {
          const isActive = active === p;
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-[13px] font-medium transition-colors text-left ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-[#8EA8C0] hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </nav>

      <div
        className="px-5 py-4 flex-shrink-0 border-t"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
            style={{ boxShadow: "0 0 5px #4ade80" }}
          />
          <span className="text-[11px]" style={{ color: "#6A8099" }}>
            System Online
          </span>
        </div>
        <div
          className="text-[10px] mb-3"
          style={{ color: "#415261", fontFamily: MONO }}
        >
          Last sync: 14:32:10
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-[12px] transition-colors"
          style={{ color: "#6A8099" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6A8099")}
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  page,
  selectedMachine,
  onBack,
  onSelect,
}: {
  page: Page;
  selectedMachine: Machine | null;
  onBack: () => void;
  onSelect: (m: Machine) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return MACHINES.filter((m) =>
      m.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6);
  }, [q]);

  function pick(m: Machine) {
    onSelect(m);
    setQ("");
    setOpen(false);
  }

  const pageTitles: Record<Page, string> = {
    dashboard: "Dashboard IO",
    setup: "Device Setup",
    history: "Connection History",
    detail: "Machine Detail",
  };
  const title = pageTitles[page];

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex-shrink-0 flex items-center px-6 gap-4">
      <div className="flex items-center gap-2 min-w-0">
        {page === "detail" && (
          <button
            onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
        )}
        <h1
          className="text-[15px] font-semibold text-gray-800 truncate"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Machine search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search machine..."
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white w-44 transition-all"
            style={{ fontFamily: MONO }}
          />
          {open && results.length > 0 && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {results.map((m) => (
                <button
                  key={m.id}
                  onMouseDown={() => pick(m)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-left transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: S[m.status].color }}
                  />
                  <span
                    style={{ fontFamily: MONO }}
                    className="flex-1 text-gray-800"
                  >
                    {m.name}
                  </span>
                  <span className="text-gray-400">{S[m.status].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User badge */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <User size={13} className="text-blue-600" />
          </div>
          <span className="text-[13px] font-medium text-gray-700">admin</span>
        </div>
      </div>
    </header>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3.5">
      <div
        className="w-1 h-10 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div>
        <div
          className="text-[26px] font-bold leading-none"
          style={{ color, fontFamily: MONO }}
        >
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mt-1.5">
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

function DashboardPage({
  onMachineClick,
}: {
  onMachineClick: (m: Machine) => void;
}) {
  const counts = useMemo(() => {
    const c = { run: 0, stop: 0, error: 0, offline: 0 };
    MACHINES.forEach((m) => c[m.status]++);
    return c;
  }, []);

  const offlineMachines = useMemo(
    () => MACHINES.filter((m) => m.status === "offline"),
    []
  );

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        {(["run", "stop", "error", "offline"] as MachineStatus[]).map((s) => (
          <StatCard
            key={s}
            label={S[s].label}
            value={counts[s]}
            color={S[s].color}
          />
        ))}
      </div>

      {/* Heatmap + Offline list */}
      <div className="flex gap-4 items-start">
        {/* Heatmap card */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Machine Status Overview
              <span className="ml-2 text-xs font-normal text-gray-400">
                200 units · click to inspect
              </span>
            </h2>
            <div className="flex items-center gap-5">
              {(["run", "stop", "error", "offline"] as MachineStatus[]).map(
                (s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: S[s].color }}
                    />
                    <span className="text-[11px] text-gray-500">
                      {S[s].label}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(20, minmax(0, 1fr))",
              gap: "4px",
            }}
          >
            {MACHINES.map((machine) => (
              <button
                key={machine.id}
                onClick={() => onMachineClick(machine)}
                title={`${machine.name} – ${S[machine.status].label}`}
                className="aspect-square rounded-sm relative cursor-pointer transition-opacity hover:opacity-70 focus:outline-none"
                style={{ background: S[machine.status].color }}
              >
                <span
                  className="absolute inset-0 flex items-end justify-center leading-none"
                  style={{
                    paddingBottom: "2px",
                    fontSize: "7px",
                    fontFamily: MONO,
                    color: "rgba(255,255,255,0.80)",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {String(machine.id).padStart(3, "0")}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Offline list — single "Offline" column showing time range */}
        <div className="w-60 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Offline</h2>
            <span
              className="text-[11px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(107,114,128,0.12)",
                color: S.offline.color,
                fontFamily: MONO,
              }}
            >
              {offlineMachines.length}
            </span>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    Machine
                  </th>
                  <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    Offline
                  </th>
                </tr>
              </thead>
              <tbody>
                {offlineMachines.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onMachineClick(m)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-4 py-2 font-semibold text-gray-700"
                      style={{ fontFamily: MONO }}
                    >
                      {m.name}
                    </td>
                    <td
                      className="px-4 py-2 text-gray-500"
                      style={{ fontFamily: MONO }}
                    >
                      {m.offlineSince?.split(" ")[1] ?? "—"} — Now
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SetupPage ────────────────────────────────────────────────────────────────

function SetupPage() {
  const connected = useMemo(
    () => MACHINES.filter((m) => m.status !== "offline").length,
    []
  );
  const loggedIn = useMemo(
    () => MACHINES.filter((m) => m.hmiLogin).length,
    []
  );
  const [search, setSearch] = useState("");
  const [pg, setPg] = useState(1);
  const PG = 15;

  const filtered = useMemo(
    () =>
      MACHINES.filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.ip.includes(q) ||
          m.mac.toLowerCase().includes(q) ||
          m.codeVersion.toLowerCase().includes(q) ||
          m.hmiVersion.toLowerCase().includes(q) ||
          (m.hmiLogin ? "login" : "logout").includes(q)
        );
      }),
    [search]
  );

  const totalPages = Math.ceil(filtered.length / PG);
  const rows = filtered.slice((pg - 1) * PG, pg * PG);
  const startPage = Math.max(1, Math.min(pg - 3, totalPages - 6));
  const endPage = Math.min(totalPages, startPage + 6);
  const pageButtons = Array.from(
    { length: Math.max(0, endPage - startPage + 1) },
    (_, i) => startPage + i
  );

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          {
            label: "Connected",
            value: connected,
            sub: "devices online now",
            color: S.run.color,
          },
          {
            label: "Login",
            value: loggedIn,
            sub: "HMI sessions active",
            color: "#1A56DB",
          },
          {
            label: "Total",
            value: 200,
            sub: "registered devices",
            color: "#374151",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-lg px-6 py-5"
          >
            <div
              className="text-4xl font-bold leading-none"
              style={{ fontFamily: MONO, color: card.color }}
            >
              {card.value}
            </div>
            <div className="text-sm font-semibold text-gray-800 mt-2.5">
              {card.label}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Device Management
          </h2>
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Name, IP, MAC, version, login..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPg(1);
              }}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 w-60"
              style={{ fontFamily: MONO }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "No.",
                  "Machine",
                  "MAC Address",
                  "IP Address",
                  "Code Ver.",
                  "HMI Ver.",
                  "Status",
                  "Login",
                ].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-xs text-gray-400"
                  >
                    No devices match the search
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td
                      className="px-4 py-2.5 text-gray-400"
                      style={{ fontFamily: MONO }}
                    >
                      {m.id}
                    </td>
                    <td
                      className="px-4 py-2.5 font-semibold text-gray-800"
                      style={{ fontFamily: MONO }}
                    >
                      {m.name}
                    </td>
                    <td
                      className="px-4 py-2.5 text-gray-500"
                      style={{ fontFamily: MONO }}
                    >
                      {m.mac}
                    </td>
                    <td
                      className="px-4 py-2.5 text-gray-600"
                      style={{ fontFamily: MONO }}
                    >
                      {m.ip}
                    </td>
                    <td
                      className="px-4 py-2.5 text-gray-500"
                      style={{ fontFamily: MONO }}
                    >
                      {m.codeVersion}
                    </td>
                    <td
                      className="px-4 py-2.5 text-gray-500"
                      style={{ fontFamily: MONO }}
                    >
                      {m.hmiVersion}
                    </td>
                    {/* Status: colored dot only, no text */}
                    <td className="px-4 py-2.5">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ background: S[m.status].color }}
                        title={S[m.status].label}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          m.hmiLogin
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {m.hmiLogin ? "Login" : "Logout"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(pg - 1) * PG + 1}–{Math.min(pg * PG, filtered.length)} of{" "}
              {filtered.length} devices
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPg((p) => Math.max(1, p - 1))}
                disabled={pg === 1}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              {pageButtons.map((p) => (
                <button
                  key={p}
                  onClick={() => setPg(p)}
                  className={`px-2.5 py-1 text-xs border rounded transition-colors ${
                    pg === p
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 hover:bg-gray-50 text-gray-600"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPg((p) => Math.min(totalPages, p + 1))}
                disabled={pg === totalPages}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ConnectionHistoryPage ────────────────────────────────────────────────────

function ConnectionHistoryPage() {
  const [dateFilter, setDateFilter] = useState("2025-01-15");
  const [searchFilter, setSearchFilter] = useState("");

  const rows = useMemo(
    () =>
      HISTORY_DATA.filter(
        (e) =>
          (!dateFilter || e.time.startsWith(dateFilter)) &&
          (!searchFilter ||
            e.machine.toLowerCase().includes(searchFilter.toLowerCase()) ||
            e.event.toLowerCase().includes(searchFilter.toLowerCase()))
      ),
    [dateFilter, searchFilter]
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-3.5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 transition-all"
            style={{ fontFamily: MONO }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Machine or event (Connected / Disconnected)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 w-72"
            style={{ fontFamily: MONO }}
          />
        </div>

        <div className="ml-auto">
          <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <Download size={13} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Connection Log
          </h2>
          <span className="text-xs text-gray-400">{rows.length} records</span>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["Time", "Machine", "Event"].map((col) => (
                <th
                  key={col}
                  className="text-left px-5 py-2.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-10 text-center text-xs text-gray-400"
                >
                  No records match the current filters
                </td>
              </tr>
            ) : (
              rows.map((entry, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td
                    className="px-5 py-3 text-gray-600"
                    style={{ fontFamily: MONO }}
                  >
                    {entry.time}
                  </td>
                  <td
                    className="px-5 py-3 font-semibold text-gray-800"
                    style={{ fontFamily: MONO }}
                  >
                    {entry.machine}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        entry.event === "Connected"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {entry.event === "Connected" ? (
                        <Wifi size={11} />
                      ) : (
                        <WifiOff size={11} />
                      )}
                      {entry.event}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MachineDetailPage ────────────────────────────────────────────────────────

const MIN_TICKS = [0, 10, 20, 30, 40, 50];

function MachineDetailPage({ machine }: { machine: Machine }) {
  const [selectedDate, setSelectedDate] = useState("2025-01-15");

  const allSegments = useMemo(
    () => getSegments(machine.id, selectedDate),
    [machine.id, selectedDate]
  );

  // Clip each segment to its per-hour window
  const hourlyRows = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        const winStart = h * 60;
        const winEnd = (h + 1) * 60;
        return allSegments
          .filter((s) => s.startMin < winEnd && s.endMin > winStart)
          .map((s) => ({
            ...s,
            clippedStart: Math.max(s.startMin, winStart),
            clippedEnd: Math.min(s.endMin, winEnd),
          }));
      }),
    [allSegments]
  );

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Machine header */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 flex items-center gap-5">
        <div
          className="w-1.5 h-14 rounded-full flex-shrink-0"
          style={{ background: S[machine.status].color }}
        />
        <div>
          <div
            className="text-2xl font-bold text-gray-900 leading-none"
            style={{ fontFamily: MONO }}
          >
            {machine.name}
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <span
              className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-white rounded-full"
              style={{ background: S[machine.status].color }}
            >
              {S[machine.status].label}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline card */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5">
        {/* Date picker */}
        <div className="flex items-center gap-2 mb-5">
          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 transition-all"
            style={{ fontFamily: MONO }}
          />
        </div>

        {/* Minute header row */}
        <div className="flex mb-1">
          <div className="flex-shrink-0" style={{ width: "46px" }} />
          <div className="flex-1 relative" style={{ height: "16px" }}>
            {MIN_TICKS.map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2 select-none"
                style={{
                  left: `${(m / 60) * 100}%`,
                  top: 0,
                  fontSize: "9px",
                  fontFamily: MONO,
                  color: "#9ca3af",
                  letterSpacing: "-0.02em",
                }}
              >
                {String(m).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {/* 24 rows — 00h through 23h */}
        {Array.from({ length: 24 }, (_, h) => {
          const segs = hourlyRows[h];
          return (
            <div
              key={h}
              className="flex items-center"
              style={{
                height: "26px",
                borderTop: h === 0 ? "1px solid #e5e7eb" : "1px solid #f3f4f6",
              }}
            >
              {/* Hour label */}
              <div
                className="flex-shrink-0 text-right pr-2 select-none"
                style={{
                  width: "46px",
                  fontFamily: MONO,
                  fontSize: "10px",
                  color: h % 6 === 0 ? "#4b5563" : "#9ca3af",
                  fontWeight: h % 6 === 0 ? 600 : 400,
                }}
              >
                {String(h).padStart(2, "0")}h
              </div>

              {/* Timeline track */}
              <div
                className="flex-1 relative"
                style={{ height: "100%", overflow: "visible" }}
              >
                {/* Background */}
                <div
                  className="absolute inset-0"
                  style={{ background: "#f9fafb", borderRadius: "2px" }}
                />
                {/* 10-minute vertical tick lines */}
                {MIN_TICKS.slice(1).map((m) => (
                  <div
                    key={m}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${(m / 60) * 100}%`,
                      width: "1px",
                      background: "rgba(0,0,0,0.06)",
                      zIndex: 0,
                    }}
                  />
                ))}
                {/* Segments */}
                {segs.map((seg, i) => {
                  const winStart = h * 60;
                  const left = ((seg.clippedStart - winStart) / 60) * 100;
                  const width = ((seg.clippedEnd - seg.clippedStart) / 60) * 100;
                  const startT = fmtTime(seg.startMin);
                  const endT = fmtTime(seg.endMin);
                  const durMins = seg.endMin - seg.startMin;
                  return (
                    <div
                      key={i}
                      className="absolute group cursor-default"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 0.4)}%`,
                        top: "3px",
                        bottom: "3px",
                        background: S[seg.status].color,
                        borderRadius: "2px",
                        zIndex: 1,
                      }}
                    >
                      {/* Hover tooltip */}
                      <div
                        className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        style={{
                          bottom: "calc(100% + 7px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "rgba(15,23,42,0.93)",
                          borderRadius: "6px",
                          padding: "7px 11px",
                          fontFamily: MONO,
                          lineHeight: "1.65",
                          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                          zIndex: 50,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                            style={{ background: S[seg.status].color }}
                          />
                          <span
                            className="font-semibold text-white"
                            style={{ fontSize: "11px" }}
                          >
                            {S[seg.status].label}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          Start: {startT}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          End: {endT}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          Duration: {fmtDuration(durMins)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex items-center gap-8 mt-4 pt-4 border-t border-gray-100">
          {(["run", "stop", "error", "offline"] as MachineStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-sm flex-shrink-0"
                style={{ background: S[s].color }}
              />
              <span className="text-xs text-gray-600 font-medium">
                {S[s].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [machine, setMachine] = useState<Machine | null>(null);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  function go(p: Page) {
    setPage(p);
    if (p !== "detail") setMachine(null);
  }

  function openMachine(m: Machine) {
    setMachine(m);
    setPage("detail");
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F1F3F7", fontFamily: "'Inter', sans-serif" }}
    >
      <Sidebar page={page} onNavigate={go} onLogout={() => setLoggedIn(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          page={page}
          selectedMachine={machine}
          onBack={() => go("dashboard")}
          onSelect={openMachine}
        />
        <main className="flex-1 overflow-auto p-6">
          {page === "dashboard" && (
            <DashboardPage onMachineClick={openMachine} />
          )}
          {page === "setup" && <SetupPage />}
          {page === "history" && <ConnectionHistoryPage />}
          {page === "detail" && machine && (
            <MachineDetailPage machine={machine} />
          )}
        </main>
      </div>
    </div>
  );
}
