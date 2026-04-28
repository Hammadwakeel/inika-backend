"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, Clock, RefreshCw, Play, CheckCircle, XCircle, Loader2, Utensils, CalendarCheck, Gift } from "lucide-react";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Guest {
  guest_id: string;
  gname: string;
  room: string;
  mobile: string;
  gstatus: string;
  cindate: string;
  coutdate: string;
  btype: string;
  welcome_sent: number;
  breakfast_sent: number;
  lunch_sent: number;
  dinner_sent: number;
  checkout_sent: number;
  amenity_sent: number;
  total_sent: number;
}

interface JourneySummary {
  tenant_id: string;
  total_guests: number;
  active_guests: number;
  checked_out: number;
  total_messages_sent: number;
  guests: Guest[];
}

export default function JourneyPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [journeyData, setJourneyData] = useState<JourneySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedTenant = window.localStorage.getItem("axiom_tenant_id");
    const storedToken = window.localStorage.getItem("axiom_token");
    if (storedTenant) {
      setTenantId(storedTenant);
      setToken(storedToken || "");
    }
  }, []);

  const fetchJourneySummary = async () => {
    if (!tenantId || !token) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/journey/summary?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`
      );
      if (response.ok) {
        const data = await response.json();
        setJourneyData(data);
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to fetch");
      }
    } catch (err) {
      console.error("Failed to fetch journey status:", err);
      setError("Network error");
    }
  };

  const runJourneyAgent = async () => {
    if (!tenantId || !token || running) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/journey/trigger?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}&dry_run=false`,
        { method: "POST" }
      );
      if (response.ok) {
        const data = await response.json();
        console.log("Journey agent result:", data);
        await fetchJourneySummary();
      } else {
        const err = await response.json();
        setError(err.detail || "Failed to run journey agent");
      }
    } catch (err) {
      setError("Error running journey agent");
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!tenantId || !token) return;
    setLoading(true);
    fetchJourneySummary().then(() => setLoading(false));
    const interval = setInterval(fetchJourneySummary, 30000);
    return () => clearInterval(interval);
  }, [tenantId, token]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return dateStr;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      "Arrived": "bg-green-100 text-green-800 border-green-300",
      "StayOver": "bg-blue-100 text-blue-800 border-blue-300",
      "Due In": "bg-amber-100 text-amber-800 border-amber-300",
      "Checked Out": "bg-gray-100 text-gray-600 border-gray-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getSentBadge = (sent: number) => {
    if (sent > 0) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <XCircle className="h-4 w-4 text-gray-300" />;
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-black selection:bg-black selection:text-white">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 border-y border-black bg-white px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">GUEST JOURNEY</h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                  // Proactive guest messaging system
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={runJourneyAgent}
                disabled={running || !tenantId}
                className="flex items-center gap-2 border border-black bg-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                RUN_JOURNEY_AGENT
              </button>
              <button
                onClick={fetchJourneySummary}
                className="flex items-center gap-2 border border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
                REFRESH
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 border border-red-500 bg-red-50 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-red-700">ERROR: {error}</p>
          </div>
        )}

        {loading ? (
          <JourneySkeleton />
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard label="TOTAL_GUESTS" value={journeyData?.total_guests ?? 0} />
              <StatCard label="ACTIVE_GUESTS" value={journeyData?.active_guests ?? 0} />
              <StatCard label="CHECKED_OUT" value={journeyData?.checked_out ?? 0} />
              <StatCard label="MESSAGES_SENT" value={journeyData?.total_messages_sent ?? 0} />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <JourneyMetric
                label="WELCOME"
                sent={journeyData?.guests?.reduce((acc, item) => acc + item.welcome_sent, 0) ?? 0}
                icon={MessageSquare}
              />
              <JourneyMetric
                label="MEAL_UPDATES"
                sent={
                  journeyData?.guests?.reduce(
                    (acc, item) => acc + item.breakfast_sent + item.lunch_sent + item.dinner_sent,
                    0
                  ) ?? 0
                }
                icon={Utensils}
              />
              <JourneyMetric
                label="CHECKOUT_AMENITY"
                sent={
                  journeyData?.guests?.reduce(
                    (acc, item) => acc + item.checkout_sent + item.amenity_sent,
                    0
                  ) ?? 0
                }
                icon={CalendarCheck}
              />
            </div>
          </>
        )}

        <footer className="mt-16 border-t border-black bg-black px-6 py-8">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            <span>GUEST_JOURNEY v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function JourneyMetric({
  label,
  sent,
  icon: Icon,
}: {
  label: string;
  sent: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border border-black bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight">{sent}</p>
    </div>
  );
}

function JourneySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SkeletonCard>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </SkeletonCard>
      </div>

      <SkeletonCard className="p-0 overflow-hidden">
        <div className="border-b border-black bg-black px-6 py-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-4 flex items-center gap-4 border-b border-gray-100 pb-4 last:border-0 last:mb-0 last:pb-0">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}