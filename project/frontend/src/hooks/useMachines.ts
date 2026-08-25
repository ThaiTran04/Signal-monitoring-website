import { useCallback, useEffect, useState } from "react";
import { machinesApi } from "../services/api";
import { mapMachine } from "../utils/format";
import { useWebSocket } from "./useWebSocket";
import type { Machine } from "../types";

export interface UseMachinesResult {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  wsConnected: boolean;
}

/**
 * Loads the full machine list (all 200 units, in one page) and applies
 * incoming `machine_update` websocket frames in place, so the dashboard
 * heatmap / device table / stat cards stay current without polling.
 */
export function useMachines(enabled: boolean = true): UseMachinesResult {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    // Don't fetch until the caller says auth is settled (logged in). Without
    // this gate, this effect fires on the very first render — before the
    // login/session-restore flow has had a chance to store a token — fails
    // with 401, and (since the deps below don't include auth state) never
    // retries, leaving a stale "Not authenticated" error on screen even
    // after the user successfully logs in.
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await machinesApi.list({ page: 1, page_size: 500 });
        if (!cancelled) setMachines(res.items.map(mapMachine));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load machines");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick, enabled]);

  const { connected: wsConnected } = useWebSocket((msg) => {
    setMachines((prev) =>
      prev.map((m) => (m.id === msg.machine_id ? { ...m, status: msg.status } : m))
    );
  });

  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  return { machines, loading, error, refresh, wsConnected };
}
