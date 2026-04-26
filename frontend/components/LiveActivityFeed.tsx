"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Zap, ArrowRight, RefreshCw } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ActivityItem = {
  timestamp: number;
  decision: string;
  detail: string;
};

function formatTime(ts: number) {
  if (!ts) return "--:--";
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function getDecisionType(decision: string) {
  if (decision.includes("SEARCH")) return { label: "Searching", color: "text-amber-600 bg-amber-50", icon: Zap };
  if (decision.includes("ROUTING")) return { label: "Routing", color: "text-cyan-600 bg-cyan-50", icon: RefreshCw };
  if (decision.includes("RESPONDING")) return { label: "Responding", color: "text-emerald-600 bg-emerald-50", icon: ArrowRight };
  return { label: "Processing", color: "text-surface-600 bg-surface-100", icon: Activity };
}

export default function LiveActivityFeed() {
  const [tenantId, setTenantId] = useState("");
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const tenant = window.localStorage.getItem("axiom_tenant_id");
    if (tenant) setTenantId(tenant);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    const token = window.localStorage.getItem("axiom_token") || '';
    const streamUrl = `${API_BASE_URL}/dispatcher/activity/stream?tenant_id=${encodeURIComponent(tenantId)}&limit=20&token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { items?: ActivityItem[] };
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
      }
    };

    source.onerror = () => {
    };

    return () => {
      source.close();
    };
  }, [tenantId]);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-surface-200 bg-surface-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Live Activity</h2>
            <p className="text-xs text-surface-500">Real-time agent decision log</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-surface-100">
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100">
              <Activity className="h-6 w-6 text-surface-400" />
            </div>
            <p className="text-sm text-surface-500">No live agent events yet</p>
            <p className="mt-1 text-xs text-surface-400">Events will appear here when the AI processes messages</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const decisionType = getDecisionType(item.decision);
            const DecisionIcon = decisionType.icon;
            return (
              <div key={`${item.timestamp}-${idx}`} className="flex items-start gap-4 p-4 hover:bg-surface-50 transition-colors">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${decisionType.color}`}>
                  <DecisionIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${decisionType.color}`}>{decisionType.label}</span>
                    <span className="flex items-center gap-1 text-xs text-surface-400">
                      <Clock className="h-3 w-3" />
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}