import { memo, useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { ioApi } from "../services/api";
import { IoLights } from "../components/shared/IoLights";
import { MIN_TICKS, MONO, S } from "../utils/constants";
import { fmtDuration, fmtTime, ioStatusOf, mapSegment, todayStr } from "../utils/format";
import type { IoStatus, Machine, TimeSegment } from "../types";

export interface MachineDetailPageProps {
  machine: Machine;
}

/** Seconds-since-local-midnight for "right now", browser-local time. */
function nowSecLocal(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/**
 * `iso` (an ISO timestamp, e.g. from the websocket's `ioUpdatedAt`) as
 * seconds-since-local-midnight, but only if it actually falls on today
 * (browser-local calendar day) — otherwise null, since it can't be
 * meaningfully placed on today's timeline.
 */
function secOfDayIfToday(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  if (
    d.getFullYear() !== today.getFullYear() ||
    d.getMonth() !== today.getMonth() ||
    d.getDate() !== today.getDate()
  ) {
    return null;
  }
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

// How often to re-pull history from the backend while viewing today, so
// completed segments (state transitions the websocket may have missed —
// e.g. after a reconnect) show up without the user pressing F5.
const POLL_INTERVAL_MS = 5_000;

export function MachineDetailPage({ machine }: MachineDetailPageProps) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [allSegments, setAllSegments] = useState<TimeSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isToday = selectedDate === todayStr();

  // Initial load + reload whenever the machine or the selected date
  // changes. `showSpinner` is only true here (not on the background
  // polling refresh below) so live updates don't flash "Loading…".
  useEffect(() => {
    let cancelled = false;
    async function load(showSpinner: boolean) {
      if (showSpinner) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await ioApi.history(machine.id, selectedDate);
        if (!cancelled) setAllSegments(res.segments.map(mapSegment));
      } catch (err) {
        if (!cancelled && showSpinner) {
          setError(err instanceof Error ? err.message : "Failed to load IO history");
        }
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }
    load(true);

    // Only today's chart is still "live" — a past date is already
    // finished and never needs to be re-fetched.
    if (!isToday) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [machine.id, selectedDate, isToday]);

  // Ticks once a second (today only) so the current segment visibly grows
  // in real time between backend polls, instead of jumping every 5s.
  const [nowSec, setNowSec] = useState(nowSecLocal);
  useEffect(() => {
    if (!isToday) return;
    setNowSec(nowSecLocal());
    const id = setInterval(() => setNowSec(nowSecLocal()), 1_000);
    return () => clearInterval(id);
  }, [isToday]);

  // I/O Detail reflects ONLY the IN1/IN2/IN3 beacon (via ioStatusOf) — never
  // machine.status/"offline", which is a Setup/Connection-only concept.
  const ioStatus = ioStatusOf(machine);

  // The websocket already pushes `machine`'s live IO status roughly once a
  // second — far more often than we want to hit the history endpoint. Use
  // it to extend/append the "live" tail segment locally every tick, so the
  // bar visibly runs in real time; the periodic poll above then reconciles
  // against the backend's own record every few seconds to correct anything
  // the extension guessed wrong (e.g. exact transition time).
  const segments = useMemo(() => {
    // Defensive clip: never draw past the browser's real "now", regardless
    // of what the backend/device returned (clock drift on the ESP32 before
    // NTP syncs, a stale server clock, etc. can otherwise leak segments
    // into time that hasn't happened yet).
    const clipped = isToday
      ? allSegments.filter((s) => s.startSec < nowSec).map((s) => (s.endSec > nowSec ? { ...s, endSec: nowSec } : s))
      : allSegments;

    if (!isToday) return clipped;

    const last = clipped[clipped.length - 1];
    if (last && last.status === ioStatus) {
      // Live status hasn't changed since the last known segment — just
      // grow it up to "now" instead of waiting for the next poll.
      if (nowSec > last.endSec) {
        return [...clipped.slice(0, -1), { ...last, endSec: nowSec }];
      }
      return clipped;
    }

    // Live status differs from the last recorded segment (a transition the
    // next poll hasn't confirmed yet) — optimistically append a short live
    // tail so the chart reacts immediately. `machine.ioUpdatedAt` (from the
    // websocket) gives the real transition time when it's known and falls
    // on today; otherwise fall back to "now" (a near-zero-length sliver
    // that will grow on the next tick).
    const liveStart = secOfDayIfToday(machine.ioUpdatedAt) ?? nowSec;
    const start = Math.max(last?.endSec ?? 0, liveStart);
    if (nowSec <= start) return clipped;
    return [...clipped, { startSec: start, endSec: nowSec, status: ioStatus }];
  }, [allSegments, isToday, nowSec, ioStatus, machine.ioUpdatedAt]);

  // Clip each segment to its per-hour window
  const hourlyRows = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        const winStart = h * 3600;
        const winEnd = (h + 1) * 3600;
        return segments
          .filter((s) => s.startSec < winEnd && s.endSec > winStart)
          .map((s) => ({
            ...s,
            clippedStart: Math.max(s.startSec, winStart),
            clippedEnd: Math.min(s.endSec, winEnd),
          }));
      }),
    [segments]
  );

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Machine header */}
      <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 flex items-center gap-5">
        <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ background: S[ioStatus].color }} />
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none" style={{ fontFamily: MONO }}>
            {machine.name}
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            <span
              className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-white rounded-full"
              style={{ background: S[ioStatus].color }}
            >
              {S[ioStatus].label}
            </span>
          </div>
        </div>
        <div className="ml-auto pl-5 border-l border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Beacon Inputs
          </div>
          <IoLights machine={machine} />
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
          {isToday && !loading && !error && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "#16a34a", animation: "pulse 2s ease-in-out infinite" }}
              />
              Live · {fmtTime(nowSec)}
            </span>
          )}
        </div>

        <TimelineChart hourlyRows={hourlyRows} />

        {/* Legend */}
        <div className="flex items-center gap-8 mt-4 pt-4 border-t border-gray-100">
          {(["run", "stop", "error", "unknown"] as IoStatus[]).map((s) => (
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

type HourlySeg = TimeSegment & { clippedStart: number; clippedEnd: number };

/**
 * The expensive part of this page: 24 rows x N absolutely-positioned
 * segments (+ hover tooltips). Split out and memoized so it only
 * re-renders when the fetched/clipped `hourlyRows` actually change — not
 * on every unrelated realtime websocket tick from useMachines() (which
 * updates the `machine` prop up in MachineDetailPage roughly once a
 * second per device and was previously forcing this whole tree to
 * re-render, causing lag).
 */
const TimelineChart = memo(function TimelineChart({ hourlyRows }: { hourlyRows: HourlySeg[][] }) {
  return (
    <>
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
                const winStart = h * 3600;
                const left = ((seg.clippedStart - winStart) / 3600) * 100;
                const width = ((seg.clippedEnd - seg.clippedStart) / 3600) * 100;
                const startT = fmtTime(seg.startSec);
                const endT = fmtTime(seg.endSec);
                const durSec = seg.endSec - seg.startSec;
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
                      <div style={{ fontSize: "10px", color: "#94a3b8" }}>Duration: {fmtDuration(durSec)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
});
