import { useMemo } from "react";
import { StatCard } from "../components/shared/StatCard";
import { MONO, S } from "../utils/constants";
import type { Machine, MachineStatus } from "../types";

export interface DashboardPageProps {
  machines: Machine[];
  loading?: boolean;
  error?: string | null;
  onMachineClick: (m: Machine) => void;
}

export function DashboardPage({ machines, loading, error, onMachineClick }: DashboardPageProps) {
  const counts = useMemo(() => {
    const c = { run: 0, stop: 0, error: 0, offline: 0 };
    machines.forEach((m) => c[m.status]++);
    return c;
  }, [machines]);

  const offlineMachines = useMemo(
    () => machines.filter((m) => m.status === "offline"),
    [machines]
  );

  if (loading && machines.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">Loading machines…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        Failed to load machines: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        {(["run", "stop", "error", "offline"] as MachineStatus[]).map((s) => (
          <StatCard key={s} label={S[s].label} value={counts[s]} color={S[s].color} />
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
                {machines.length} units · click to inspect
              </span>
            </h2>
            <div className="flex items-center gap-5">
              {(["run", "stop", "error", "offline"] as MachineStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={
                      s === "offline"
                        ? { background: "#ffffff", border: "1px solid #d1d5db" }
                        : { background: S[s].color }
                    }
                  />
                  <span className="text-[11px] text-gray-500">{S[s].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(20, minmax(0, 1fr))",
              gap: "4px",
            }}
          >
            {machines.map((machine) => {
              const isOffline = machine.status === "offline";
              return (
                <button
                  key={machine.id}
                  onClick={() => onMachineClick(machine)}
                  title={`${machine.name} – ${S[machine.status].label}`}
                  className="aspect-square rounded-sm relative cursor-pointer transition-opacity hover:opacity-70 focus:outline-none"
                  style={
                    isOffline
                      ? {
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                        }
                      : { background: S[machine.status].color }
                  }
                >
                  <span
                    className="absolute inset-0 flex items-end justify-center leading-none"
                    style={{
                      paddingBottom: "2px",
                      fontSize: "7px",
                      fontFamily: MONO,
                      color: isOffline ? "rgba(107,114,128,0.8)" : "rgba(255,255,255,0.80)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {String(machine.id).padStart(3, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Offline list */}
        <div className="w-60 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Offline</h2>
            <span
              className="text-[11px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(107,114,128,0.12)", color: S.offline.color, fontFamily: MONO }}
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
                    <td className="px-4 py-2 font-semibold text-gray-700" style={{ fontFamily: MONO }}>
                      {m.name}
                    </td>
                    <td className="px-4 py-2 text-gray-500" style={{ fontFamily: MONO }}>
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
