import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { ioApi } from "../services/api";
import { MIN_TICKS, MONO, S } from "../utils/constants";
import { fmtDuration, fmtTime, mapSegment, todayStr } from "../utils/format";
import type { Machine, MachineStatus, TimeSegment } from "../types";

export interface MachineDetailPageProps {
  machine: Machine;
}

export function MachineDetailPage({ machine }: MachineDetailPageProps) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [allSegments, setAllSegments] = useState<TimeSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await ioApi.history(machine.id, selectedDate);
        if (!cancelled) setAllSegments(res.segments.map(mapSegment));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load IO history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [machine.id, selectedDate]);

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
        <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ background: S[machine.status].color }} />
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none" style={{ fontFamily: MONO }}>
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
          {loading && <span className="text-xs text-gray-400">Loading…</span>}
          {error && <span className="text-xs text-red-600">Failed to load: {error}</span>}
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
              <div className="flex-1 relative" style={{ height: "100%", overflow: "visible" }}>
                <div className="absolute inset-0" style={{ background: "#f9fafb", borderRadius: "2px" }} />
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
                          <span className="font-semibold text-white" style={{ fontSize: "11px" }}>
                            {S[seg.status].label}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>Start: {startT}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>End: {endT}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>Duration: {fmtDuration(durMins)}</div>
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
              <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: S[s].color }} />
              <span className="text-xs text-gray-600 font-medium">{S[s].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
