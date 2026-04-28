"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock } from "lucide-react";
import { getApiBaseUrl, getStoredToken, withTokenQuery } from "@/lib/api";

type ActivityItem = {
  timestamp: number;
  decision: string;
  detail: string;
};

const API_BASE_URL = getApiBaseUrl();

function formatTime(ts: number): string {
  if (!ts) return "--:--";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function DashboardRecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [tenantId, setTenantId] = useState("");

  const token = useMemo(() => getStoredToken(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tenant = window.localStorage.getItem("axiom_tenant_id") || "";
    setTenantId(tenant);
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const baseStream = `${API_BASE_URL}/dispatcher/activity/stream?tenant_id=${encodeURIComponent(tenantId)}&limit=20`;
    const streamUrl = withTokenQuery(baseStream);
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { items?: ActivityItem[] };
        if (Array.isArray(payload.items)) {
          setItems(payload.items);
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [tenantId, token]);

  return (
    <div className="border border-black bg-white p-8">
      <div className="mb-5 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          Dispatcher Activity (Live)
        </p>
      </div>

      {items.length === 0 ? (
        <div className="border border-black/15 px-4 py-6 text-sm text-zinc-500">
          No activity available yet for this tenant.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.timestamp}-${index}`}
              className="flex items-start justify-between gap-4 border border-black/15 px-4 py-3"
            >
              <div>
                <p className="text-sm font-black tracking-tight">{item.decision || "ACTIVITY"}</p>
                <p className="mt-1 text-sm text-zinc-700">{item.detail || "No detail available."}</p>
              </div>
              <p className="flex shrink-0 items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                <Clock className="h-3 w-3" />
                {formatTime(item.timestamp)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
