import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribes to backend WebSocket at /api/ws/jobs?token=<JWT>
 * and updates the "jobs" query cache in-place for each tick.
 */
export function useJobStream(enabled: boolean) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("pp-token");
    if (!token) return;

    const base =
      (import.meta.env.REACT_APP_BACKEND_URL as string | undefined) ||
      (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
      "";
    const isHttps = base.startsWith("https://");
    const scheme = isHttps ? "wss" : "ws";
    const host = base.replace(/^https?:\/\//, "");
    const url = `${scheme}://${host}/api/ws/jobs?token=${encodeURIComponent(token)}`;

    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "snapshot" && Array.isArray(msg.jobs)) {
            qc.setQueryData(["jobs"], msg.jobs);
          } else if (msg.type === "job_update") {
            qc.setQueryData<any[]>(["jobs"], (prev) =>
              (prev ?? []).map((j) =>
                j.id === msg.job_id
                  ? {
                      ...j,
                      progress: msg.progress,
                      status: msg.status,
                      successCount: msg.successCount ?? j.successCount,
                    }
                  : j
              )
            );
            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, qc]);
}
