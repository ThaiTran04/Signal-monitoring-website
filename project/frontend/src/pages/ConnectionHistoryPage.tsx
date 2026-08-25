import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, Search, Wifi, WifiOff } from "lucide-react";
import { connectionHistoryApi } from "../services/api";
import { MONO } from "../utils/constants";
import { mapConnectionHistoryRows, todayStr } from "../utils/format";
import type { HistoryEntry } from "../types";

export function ConnectionHistoryPage() {
  const [dateFilter, setDateFilter] = useState(todayStr());
  const [searchFilter, setSearchFilter] = useState("");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await connectionHistoryApi.list({
          date: dateFilter || undefined,
          search: searchFilter || undefined,
        });
        if (!cancelled) setEntries(mapConnectionHistoryRows(rows));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250); // debounce search/date typing
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [dateFilter, searchFilter]);

  const rows = useMemo(
    () =>
      entries.filter(
        (e) =>
          !searchFilter ||
          e.machine.toLowerCase().includes(searchFilter.toLowerCase()) ||
          e.event.toLowerCase().includes(searchFilter.toLowerCase())
      ),
    [entries, searchFilter]
  );

  function exportExcel() {
    const header = "Time,Machine,Event\n";
    const body = rows.map((r) => `${r.time},${r.machine},${r.event}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `connection-history-${dateFilter || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <button
            onClick={exportExcel}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Connection Log</h2>
          <span className="text-xs text-gray-400">{loading ? "Loading…" : `${rows.length} records`}</span>
        </div>

        {error ? (
          <div className="px-5 py-8 text-center text-xs text-red-600">Failed to load history: {error}</div>
        ) : (
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
                  <td colSpan={3} className="px-5 py-10 text-center text-xs text-gray-400">
                    {loading ? "Loading records…" : "No records match the current filters"}
                  </td>
                </tr>
              ) : (
                rows.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-600" style={{ fontFamily: MONO }}>
                      {entry.time}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-800" style={{ fontFamily: MONO }}>
                      {entry.machine}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          entry.event === "Connected" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {entry.event === "Connected" ? <Wifi size={11} /> : <WifiOff size={11} />}
                        {entry.event}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
