import { useMemo, useState } from "react";
import { ChevronLeft, Search, User } from "lucide-react";
import { MONO, S } from "../../utils/constants";
import type { Machine, Page } from "../../types";

export interface HeaderProps {
  page: Page;
  machines: Machine[];
  username?: string | null;
  onBack: () => void;
  onSelect: (m: Machine) => void;
}

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard IO",
  setup: "Device Setup",
  history: "Connection History",
  detail: "Machine Detail",
};

export function Header({ page, machines, username, onBack, onSelect }: HeaderProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return machines.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  }, [q, machines]);

  function pick(m: Machine) {
    onSelect(m);
    setQ("");
    setOpen(false);
  }

  const title = PAGE_TITLES[page];

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
        <h1 className="text-[15px] font-semibold text-gray-800 truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Machine search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: S[m.status].color }} />
                  <span style={{ fontFamily: MONO }} className="flex-1 text-gray-800">
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
          <span className="text-[13px] font-medium text-gray-700">{username ?? "admin"}</span>
        </div>
      </div>
    </header>
  );
}
