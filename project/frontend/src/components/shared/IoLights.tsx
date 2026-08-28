import { MONO } from "../../utils/constants";
import type { Machine } from "../../types";

export interface IoLightsProps {
  machine: Machine;
  size?: number;
}

/**
 * Shows the machine's 3 physical beacon inputs as colored dots, using the
 * REAL last-reported IN1-3 readings from ESP32 (io_input1/2/3) — not the
 * derived run/stop/error `status` field. Mapping confirmed against
 * esp32/include/hmi_map.h + esp32/src/server_client.cpp:
 *   IN1 (io_input1) = ĐỎ / LỖI  (error)
 *   IN2 (io_input2) = VÀNG / DỪNG (stop)
 *   IN3 (io_input3) = XANH / CHẠY (run)
 *
 * If the machine is offline, or no `io` reading has ever been received for
 * it, all three dots render as unlit/gray "no data" — never guessed as on.
 */
export function IoLights({ machine, size = 10 }: IoLightsProps) {
  const offline = machine.status === "offline";
  const hasReading =
    machine.ioInput1 !== undefined ||
    machine.ioInput2 !== undefined ||
    machine.ioInput3 !== undefined;

  const lights: { label: string; on?: boolean; color: string }[] = [
    { label: "IN1 · Error", on: machine.ioInput1, color: "#dc2626" },
    { label: "IN2 · Stop", on: machine.ioInput2, color: "#eab308" },
    { label: "IN3 · Run", on: machine.ioInput3, color: "#16a34a" },
  ];

  return (
    <div className="flex items-center gap-2.5">
      {lights.map((l) => {
        const lit = !offline && hasReading && l.on === true;
        return (
          <div key={l.label} className="flex items-center gap-1.5" title={l.label}>
            <span
              className="rounded-full flex-shrink-0"
              style={{
                width: size,
                height: size,
                background: lit ? l.color : "#e5e7eb",
                boxShadow: lit ? `0 0 6px ${l.color}` : "none",
                border: lit ? "none" : "1px solid #d1d5db",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            />
            <span
              className="text-[10px]"
              style={{ fontFamily: MONO, color: lit ? "#374151" : "#9ca3af" }}
            >
              {l.label.split(" · ")[1]}
            </span>
          </div>
        );
      })}
      {!offline && !hasReading && (
        <span className="text-[10px] text-gray-400 ml-1">No IO data yet</span>
      )}
      {offline && <span className="text-[10px] text-gray-400 ml-1">Offline</span>}
    </div>
  );
}
