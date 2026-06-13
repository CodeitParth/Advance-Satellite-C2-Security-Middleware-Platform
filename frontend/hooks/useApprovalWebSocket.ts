"use client";
// useApprovalWebSocket — WS connection with 3s polling fallback. T-023
import { useState, useEffect, useCallback, useRef } from "react";
import { getStoredToken, isStoredTokenValid } from "../lib/api";
import type { WSMessage, PendingCommand } from "../lib/types";
import { api } from "../lib/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const POLL_INTERVAL = 3_000;

interface UseApprovalWebSocketOptions {
  onMessage?: (msg: WSMessage) => void;
  enabled?: boolean;
}

export function useApprovalWebSocket(options: UseApprovalWebSocketOptions = {}) {
  const { onMessage, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setIsPolling(true);
    const poll = async () => {
      try {
        const cmds = await api.getPendingCommands();
        setPendingCommands(cmds);
      } catch {
        // silent — polling is a fallback
      }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
  }, []);

  const connect = useCallback(() => {
    const token = getStoredToken();
    if (!token || !enabled) return;

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/approvals?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        stopPolling();
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as WSMessage;
          if (msg.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG" }));
            return;
          }
          setLastMessage(msg);
          onMessageRef.current?.(msg);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = (evt) => {
        setIsConnected(false);
        wsRef.current = null;
        if (evt.code === 4001) {
          // Token expired on server side — reconnect only if proactive refresh provided a fresh token
          if (isStoredTokenValid()) {
            reconnectRef.current = setTimeout(connect, 2_000);
          }
          // Otherwise stop; next REST 401 will trigger redirect to /login via api.ts
          return;
        }
        // Fall back to polling, retry WS after 5s
        startPolling();
        reconnectRef.current = setTimeout(connect, 5_000);
      };

      ws.onerror = () => {
        // onclose fires after onerror — handle there
        setIsConnected(false);
      };
    } catch {
      // WebSocket not available — go straight to polling
      startPolling();
    }
  }, [enabled, startPolling, stopPolling]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
      stopPolling();
    };
  }, [connect, enabled, stopPolling]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, isPolling, lastMessage, pendingCommands, send };
}
