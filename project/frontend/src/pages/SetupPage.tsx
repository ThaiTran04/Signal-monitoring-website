import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MONO, S } from "../utils/constants";
import type { Machine } from "../types";

export interface SetupPageProps {
  machines: Machine[];
  loading?: boolean;
  error?: string | null;
}

const PG = 15;

export function SetupPage({ machines, loading, error }: SetupPageProps) {
  const connected = useMemo(() => machines.filter((m) => m.status !== "offline").length, [machines]);
  const loggedIn = useMemo(() => machines.filter((m) => m.hmiLogin).length, [machines]);
  const [search, setSearch] = useState("");
  const [pg, setPg] = useState(1);

  const filtered = useMemo(
    () =>
      machines.filter((m) => {
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
    [search, machines]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PG));
  const rows = filtered.slice((pg - 1) * PG, pg * PG);
  const startPage = Math.max(1, Math.min(pg - 3, totalPages - 6));
  const endPage = Math.min(totalPages, startPage + 6);
  const pageButtons = Array.from({ length: Math.max(0, endPage - startPage + 1) }, (_, i) => startPage + i);

  if (loading && machines.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">Loading devices…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        Failed to load devices: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "Connected", value: connected, sub: "devices online now", color: S.run.color },
          { label: "Login", value: loggedIn, sub: "HMI sessions active", color: "#1A56DB" },
          { label: "Total", value: machines.length, sub: "registered devices", color: "#374151" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-lg px-6 py-5">
            <div className="text-4xl font-bold leading-none" style={{ fontFamily: MONO, color: card.color }}>
              {card.value}
            </div>
            <div className="text-sm font-semibold text-gray-800 mt-2.5">{card.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Device Management</h2>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                {["No.", "Machine", "MAC Address", "IP Address", "Code Ver.", "HMI Ver.", "Status", "Login"].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-xs text-gray-400">
                    No devices match the search
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const isConnected = m.status !== "offline";
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400" style={{ fontFamily: MONO }}>
                        {m.id}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800" style={{ fontFamily: MONO }}>
                        {m.name}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500" style={{ fontFamily: MONO }}>
                        {m.mac}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600" style={{ fontFamily: MONO }}>
                        {m.ip}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500" style={{ fontFamily: MONO }}>
                        {m.codeVersion}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500" style={{ fontFamily: MONO }}>
                        {m.hmiVersion}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isConnected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: isConnected ? S.run.color : S.offline.color }}
                          />
                          {isConnected ? "Connected" : "Disconnected"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            m.hmiLogin ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {m.hmiLogin ? "Login" : "Logout"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(pg - 1) * PG + 1}–{Math.min(pg * PG, filtered.length)} of {filtered.length} devices
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
                    pg === p ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 hover:bg-gray-50 text-gray-600"
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
