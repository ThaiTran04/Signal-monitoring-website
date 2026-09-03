import { API_BASE_URL } from "./apiClient";
import type { WsMachineUpdate } from "../types";

type Listener = (msg: WsMachineUpdate) => void;

/**
 * Thin wrapper around the backend's realtime `/ws` endpoint with automatic
 * reconnect (simple fixed-delay backoff). Devices/backend push
 * `{ type: "machine_update", ... }` frames whenever a machine's status
 * changes; the dashboard subscribes to update rows in place instead of
 * polling.
 */
class RealtimeSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.shouldReconnect = true;
    const wsUrl = API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";

    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.statusListeners.forEach((cb) => cb(true));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMachineUpdate;
        if (msg?.type === "machine_update" || msg?.type === "hmi_login_update") {
          this.listeners.forEach((cb) => cb(msg));
        }
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this.statusListeners.forEach((cb) => cb(false));
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) this.connect();
    }, 3000);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  onMessage(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onStatusChange(cb: (connected: boolean) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }
}

export const realtimeSocket = new RealtimeSocket();
