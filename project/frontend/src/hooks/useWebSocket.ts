import { useEffect, useState } from "react";
import { realtimeSocket } from "../services/websocket";
import type { WsMachineUpdate } from "../types";

export interface UseWebSocketResult {
  connected: boolean;
  lastMessage: WsMachineUpdate | null;
}

/**
 * Subscribes to the shared realtime socket for the lifetime of the calling
 * component. Multiple components can call this concurrently — the
 * underlying connection is a singleton (see services/websocket.ts).
 */
export function useWebSocket(
  onMessage?: (msg: WsMachineUpdate) => void
): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMachineUpdate | null>(null);

  useEffect(() => {
    realtimeSocket.connect();
    const offStatus = realtimeSocket.onStatusChange(setConnected);
    const offMessage = realtimeSocket.onMessage((msg) => {
      setLastMessage(msg);
      onMessage?.(msg);
    });
    return () => {
      offStatus();
      offMessage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected, lastMessage };
}
