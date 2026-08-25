import { Activity, LogOut } from "lucide-react";
import { MONO, NAV } from "../../utils/constants";
import type { Page } from "../../types";

export interface SidebarProps {
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  wsConnected?: boolean;
  lastSync?: string;
}

export function Sidebar({ page, onNavigate, onLogout, wsConnected, lastSync }: SidebarProps) {
  const active = page === "detail" ? "dashboard" : page;

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full" style={{ background: "#1C2B42" }}>
      <div className="px-5 py-4 flex-shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Activity size={14} className="text-white" />
          </div>
          <span className="text-white text-sm font-bold tracking-tight">HMI Monitor</span>
        </div>
        <div className="mt-1 text-[10px]" style={{ color: "#6A8099", fontFamily: MONO }}>
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

      <div className="px-5 py-4 flex-shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected === false ? "bg-gray-500" : "bg-green-400"}`}
            style={wsConnected === false ? undefined : { boxShadow: "0 0 5px #4ade80" }}
          />
          <span className="text-[11px]" style={{ color: "#6A8099" }}>
            {wsConnected === false ? "Reconnecting…" : "System Online"}
          </span>
        </div>
        <div className="text-[10px] mb-3" style={{ color: "#415261", fontFamily: MONO }}>
          Last sync: {lastSync ?? "—"}
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
