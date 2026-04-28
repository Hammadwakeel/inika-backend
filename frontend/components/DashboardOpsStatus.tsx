"use client";

import { useEffect, useState } from "react";
import { Activity, Wifi } from "lucide-react";
import { getApiBaseUrl, getStoredToken } from "@/lib/api";

type ModuleStatus = {
  active: boolean;
  ready: boolean;
  configured: boolean;
  stats: Record<string, string | number>;
};

type DashboardStatus = {
  timestamp?: number;
  uptime?: string | number;
  uptime_seconds?: number;
  webhook_status?: string;
  webhook?: { connected?: boolean; status?: string };
  whatsapp?: { linked?: boolean };
  knowledge?: ModuleStatus;
  journey?: ModuleStatus;
  booking?: ModuleStatus;
};

const API_BASE_URL = getApiBaseUrl();

function formatUptime(value: string | number | undefined, seconds?: number): string {
  if (typeof value === "string" && value.trim()) return value;
  const total = typeof value === "number" ? value : seconds;
  if (!total || total < 1) return "N/A";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function DashboardOpsStatus() {
  const [uptime, setUptime] = useState("N/A");
  const [webhook, setWebhook] = useState("Unknown");
  const [apiState, setApiState] = useState("Unknown");
  const [knowledgeInfo, setKnowledgeInfo] = useState("0 docs / 0 vectors");
  const [journeyInfo, setJourneyInfo] = useState("0 active");
  const [bookingInfo, setBookingInfo] = useState("0 today / 0 upcoming");

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const token = getStoredToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/dashboard/status`, {
          headers,
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as DashboardStatus;
        if (!mounted) return;

        const computedUptime =
          formatUptime(data.uptime, data.uptime_seconds) !== "N/A"
            ? formatUptime(data.uptime, data.uptime_seconds)
            : data.timestamp
              ? "Live"
              : "N/A";
        setUptime(computedUptime);
        setApiState(data.timestamp ? "Connected" : "Unknown");

        const webhookState =
          data.webhook_status ||
          data.webhook?.status ||
          (data.webhook?.connected ? "Connected" : undefined) ||
          (data.whatsapp?.linked ? "Connected" : "Disconnected");
        setWebhook(webhookState || "Unknown");

        const docs = Number(data.knowledge?.stats?.documents ?? 0);
        const vectors = Number(data.knowledge?.stats?.vectors ?? 0);
        setKnowledgeInfo(`${docs} docs / ${vectors} vectors`);

        const activeJourneys = Number(data.journey?.stats?.active ?? 0);
        setJourneyInfo(`${activeJourneys} active`);

        const today = Number(data.booking?.stats?.today ?? 0);
        const upcoming = Number(data.booking?.stats?.upcoming ?? 0);
        setBookingInfo(`${today} today / ${upcoming} upcoming`);
      } catch {
        // keep previous values if request fails
      }
    };

    fetchStatus();
    const timer = window.setInterval(fetchStatus, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="border border-black bg-white p-8">
      <div className="mb-5 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
          System Health
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="text-sm font-black tracking-tight">Uptime</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{uptime}</p>
        </div>

        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="text-sm font-black tracking-tight">API</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{apiState}</p>
        </div>

        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-black tracking-tight">
            <Wifi className="h-4 w-4" />
            Webhook
          </p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{webhook}</p>
        </div>

        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="text-sm font-black tracking-tight">Knowledge</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{knowledgeInfo}</p>
        </div>

        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="text-sm font-black tracking-tight">Journey</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{journeyInfo}</p>
        </div>

        <div className="flex items-center justify-between border border-black/15 px-4 py-3">
          <p className="text-sm font-black tracking-tight">Booking</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-700">{bookingInfo}</p>
        </div>
      </div>
    </div>
  );
}
