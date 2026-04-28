"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Calendar, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle, Users, Clock, Bed } from "lucide-react";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BookingGuest {
  id: string;
  tid: string;
  rid: string;
  room: string;
  gname: string;
  mobile: string;
  gstatus: string;
  cindate?: string;
  coutdate?: string;
}

interface BookingData {
  status: string;
  message: string;
  count: number;
  guests: BookingGuest[];
}

export default function BookingPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [bookings, setBookings] = useState<BookingGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [apiMessage, setApiMessage] = useState<string>("");

  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedTenant = window.localStorage.getItem("axiom_tenant_id");
    const storedToken = window.localStorage.getItem("axiom_token");
    if (storedTenant) {
      setTenantId(storedTenant);
      setToken(storedToken || "");
    }
  }, []);

  // GSAP Entrance Animations
  useEffect(() => {
    if (!pageRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Header animation
      tl.fromTo(headerRef.current, {
        y: -40,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 0.7,
      });

      // Stats cards stagger
      if (statsRef.current) {
        tl.fromTo(statsRef.current.children, {
          y: 40,
          opacity: 0,
          scale: 0.95,
        }, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          stagger: 0.1,
        }, "-=0.3");
      }

      // Table section
      if (tableRef.current) {
        tl.fromTo(tableRef.current, {
          y: 50,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 0.6,
        }, "-=0.3");
      }

      // Footer
      if (footerRef.current) {
        tl.fromTo(footerRef.current, {
          y: 20,
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          duration: 0.4,
        }, "-=0.2");
      }
    }, pageRef);

    return () => ctx.revert();
  }, [loading]);

  // Setup hover animations for booking rows
  const setupRowAnimations = useCallback(() => {
    const rows = pageRef.current?.querySelectorAll(".booking-row");

    rows?.forEach((row) => {
      row.addEventListener("mouseenter", () => {
        gsap.to(row, {
          x: 8,
          backgroundColor: "#f9fafb",
          borderColor: "#000",
          duration: 0.2,
          ease: "power2.out",
        });
      });

      row.addEventListener("mouseleave", () => {
        gsap.to(row, {
          x: 0,
          backgroundColor: "#fff",
          borderColor: "#e5e7eb",
          duration: 0.2,
          ease: "power2.out",
        });
      });
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(setupRowAnimations, 100);
    return () => clearTimeout(timer);
  }, [bookings, setupRowAnimations]);

  const fetchTodaysBookings = async () => {
    if (!tenantId || !token) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/todays?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`
      );

      if (response.ok) {
        const data: BookingData = await response.json();
        if (data.status === "ok") {
          setBookings(data.guests || []);
          setApiMessage(data.message || "");
          setLastSync(new Date().toLocaleTimeString());
        } else {
          setError(data.message || "Failed to fetch bookings");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || "Failed to fetch booking data");
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      setError("Failed to fetch booking data");
    } finally {
      setLoading(false);
    }
  };

  const syncBookings = async () => {
    if (!tenantId || !token || syncing) return;
    setSyncing(true);
    setError(null);

    // Button animation
    const syncBtn = document.querySelector(".sync-btn");
    if (syncBtn) {
      gsap.to(syncBtn, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
      });
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/sync?tenant_id=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === "ok") {
          await fetchTodaysBookings();
        } else {
          setError(data.message || "Sync failed");
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Failed to sync bookings");
      }
    } catch (err) {
      setError("Error syncing bookings");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const refreshBookings = async () => {
    // Refresh button animation
    const refreshBtn = document.querySelector(".refresh-btn");
    if (refreshBtn) {
      gsap.to(refreshBtn, {
        rotate: 360,
        duration: 0.5,
        ease: "power2.out",
      });
    }
    await fetchTodaysBookings();
  };

  useEffect(() => {
    if (!tenantId || !token) return;
    fetchTodaysBookings();
    const interval = setInterval(fetchTodaysBookings, 60000);
    return () => clearInterval(interval);
  }, [tenantId, token]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      "Arrived": "bg-green-100 text-green-800 border-green-300",
      "StayOver": "bg-blue-100 text-blue-800 border-blue-300",
      "Confirmed": "bg-blue-100 text-blue-800 border-blue-300",
      "Due In": "bg-amber-100 text-amber-800 border-amber-300",
      "Checked Out": "bg-gray-100 text-gray-600 border-gray-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getStatusIcon = (status: string) => {
    if (status === "Arrived" || status === "StayOver") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (status === "Checked Out") {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  const arrivedCount = bookings.filter(b => b.gstatus === "Arrived" || b.gstatus === "StayOver").length;
  const checkedOutCount = bookings.filter(b => b.gstatus === "Checked Out").length;
  const dueInCount = bookings.filter(b => b.gstatus === "Due In" || b.gstatus === "Confirmed").length;

  return (
    <div
      ref={pageRef}
      className="relative min-h-screen overflow-x-hidden bg-white font-sans text-black selection:bg-black selection:text-white"
    >
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <header ref={headerRef} className="mb-10 border-y border-black bg-white px-6 py-8 opacity-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="header-icon flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">BOOKING HUB</h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                  // Real-time guest reservations from Inika API
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {lastSync && (
                <div className="sync-time text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
                  Last sync: {lastSync}
                </div>
              )}
              <button
                onClick={syncBookings}
                disabled={syncing || !tenantId}
                className="sync-btn flex items-center gap-2 border border-black bg-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                SYNC_FROM_INIKA
              </button>
              <button
                onClick={refreshBookings}
                className="refresh-btn flex items-center gap-2 border border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
                REFRESH
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="error-banner mb-6 border border-red-500 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="font-mono text-xs text-red-600">ERROR: {error}</p>
            </div>
          </div>
        )}

        {apiMessage && (
          <div className="success-banner mb-6 border border-green-500 bg-green-50 px-4 py-3">
            <p className="font-mono text-xs text-green-700">API: {apiMessage}</p>
          </div>
        )}

        {loading ? (
          <BookingSkeleton />
        ) : (
          <>
            <div ref={statsRef} className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                label="TOTAL_GUESTS"
                value={bookings.length}
                icon={Users}
                color="black"
              />
              <StatCard
                label="CHECKED_IN"
                value={arrivedCount}
                icon={CheckCircle}
                color="green"
              />
              <StatCard
                label="DUE_IN"
                value={dueInCount}
                icon={Clock}
                color="amber"
              />
              <StatCard
                label="CHECKED_OUT"
                value={checkedOutCount}
                icon={XCircle}
                color="gray"
              />
            </div>

            <div ref={tableRef} className="booking-table border border-black opacity-0">
              <div className="border-b border-black bg-black px-6 py-4">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  TODAY&apos;S_RESERVATIONS
                </h2>
              </div>
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase text-gray-500">GUEST</th>
                      <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase text-gray-500">ROOM</th>
                      <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase text-gray-500">CHECK_IN</th>
                      <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase text-gray-500">CHECK_OUT</th>
                      <th className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase text-gray-500">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Bed className="h-8 w-8 text-gray-300" />
                            <p className="font-mono text-sm text-gray-500">No bookings found</p>
                            <p className="font-mono text-xs text-gray-400">Sync from Inika to load reservations</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking, index) => (
                        <tr
                          key={`${booking.id}-${booking.tid}-${index}`}
                          className="booking-row border-b border-gray-100 transition-all duration-200"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center border border-black bg-gray-100 font-mono text-sm font-bold">
                                {booking.gname?.charAt(0) || "?"}
                              </div>
                              <div>
                                <p className="font-mono text-sm font-medium">{booking.gname}</p>
                                <p className="font-mono text-xs text-gray-400">{booking.mobile}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-sm font-medium">{booking.room}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-sm">{booking.cindate || "-"}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-mono text-sm">{booking.coutdate || "-"}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className={`inline-flex items-center gap-1.5 border px-2 py-1 ${getStatusBadge(booking.gstatus)}`}>
                              {getStatusIcon(booking.gstatus)}
                              <span className="font-mono text-xs font-medium">{booking.gstatus}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <footer ref={footerRef} className="mt-16 border-t border-black bg-black px-6 py-8">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            <span>BOOKING_HUB v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
            <span>INIKA_API</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const colorClasses: Record<string, string> = {
    black: "bg-black text-white border-black",
    green: "bg-green-100 text-green-800 border-green-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
    gray: "bg-gray-100 text-gray-600 border-gray-300",
  };

  return (
    <div className={`stat-card border p-4 ${colorClasses[color]}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="stat-value font-mono text-2xl font-bold">{value}</div>
    </div>
  );
}

function BookingSkeleton() {
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
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-4 flex items-center gap-6 border-b border-gray-100 pb-4 last:border-0 last:mb-0 last:pb-0">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}