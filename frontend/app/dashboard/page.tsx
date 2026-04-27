"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import AppNav from "../../components/AppNav";
import LiveActivityFeed from "../../components/LiveActivityFeed";
import { MessageSquare, Brain, Activity, Database, Bot, Wifi, ChevronDown, User, MapPin, Calendar } from "lucide-react";
import gsap from "gsap";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ModuleStats {
  label: string;
  value: string;
}

interface ModuleData {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  stats: ModuleStats[];
}

interface DashboardStatus {
  whatsapp: { configured: boolean; ready: boolean; active: boolean; stats: Record<string, number> };
  knowledge: { configured: boolean; ready: boolean; active: boolean; stats: Record<string, number> };
  journey: { configured: boolean; ready: boolean; active: boolean; stats: Record<string, number> };
  booking: { configured: boolean; ready: boolean; active: boolean; stats: Record<string, number> };
  profile: { configured: boolean; ready: boolean; active: boolean; stats: Record<string, number> };
}

export default function DashboardPage() {
  const [tenantId, setTenantId] = useState("");
  const [token, setToken] = useState("");
  const [modules, setModules] = useState<ModuleData[]>([
    {
      icon: MessageSquare,
      title: "WHATSAPP_HUB",
      description: "Connect WhatsApp, manage conversations, send automated replies.",
      href: "/whatsapp",
      stats: [
        { label: "chats", value: "0" },
        { label: "messages", value: "0" },
        { label: "active", value: "false" },
      ],
    },
    {
      icon: Brain,
      title: "KNOWLEDGE_ENGINE",
      description: "Upload documents, build FAISS index, configure AI identity.",
      href: "/knowledge",
      stats: [
        { label: "documents", value: "0" },
        { label: "vectors", value: "0" },
        { label: "ready", value: "false" },
      ],
    },
    {
      icon: MapPin,
      title: "JOURNEY",
      description: "Create guest journeys, automate touchpoints, track progress.",
      href: "/journey",
      stats: [
        { label: "active", value: "0" },
        { label: "templates", value: "5" },
        { label: "msgs_sent", value: "0" },
      ],
    },
    {
      icon: Calendar,
      title: "BOOKING",
      description: "Manage reservations, sync availability, handle confirmations.",
      href: "/booking",
      stats: [
        { label: "today", value: "0" },
        { label: "upcoming", value: "0" },
        { label: "pending", value: "0" },
      ],
    },
    {
      icon: User,
      title: "PROFILE",
      description: "View account details, manage security settings, session info.",
      href: "/profile",
      stats: [
        { label: "account", value: "active" },
        { label: "tenant", value: "valid" },
        { label: "session", value: "ok" },
      ],
    },
  ]);
  const [systemStatus, setSystemStatus] = useState({ sys: "OPERATIONAL", api: "ONLINE", wa: "PENDING" });
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Refs for GSAP animations
  const headerRef = useRef<HTMLDivElement>(null);
  const modulesRef = useRef<HTMLDivElement>(null);
  const statsSectionRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const moduleRefs = useRef<(HTMLDivElement | HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const storedTenant = window.localStorage.getItem("axiom_tenant_id");
    const storedToken = window.localStorage.getItem("axiom_token");
    if (storedTenant) {
      setTenantId(storedTenant);
      setToken(storedToken || "");
    } else {
      // Try legacy key
      const legacyTenant = window.localStorage.getItem("tenant_id");
      if (legacyTenant) {
        setTenantId(legacyTenant);
        setToken(storedToken || "");
      }
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    const fetchDashboardStatus = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const params = `?tenant_id=${encodeURIComponent(tenantId)}`;

        const response = await fetch(`${API_BASE_URL}/api/dashboard/status${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardStatus(data);

          // Update WhatsApp status
          const waStatus = data.whatsapp;
          setSystemStatus({
            sys: "OPERATIONAL",
            api: "ONLINE",
            wa: waStatus.configured ? (waStatus.ready ? "CONNECTED" : "PENDING") : "DISCONNECTED",
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard status:", err);
      }
    };

    fetchDashboardStatus();
    const interval = setInterval(fetchDashboardStatus, 30000);
    return () => clearInterval(interval);
  }, [tenantId, token]);

  useEffect(() => {
    if (!tenantId) return;

    const fetchAllStats = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const baseParams = `?tenant_id=${encodeURIComponent(tenantId)}`;

        // Fetch all data in parallel
        const [waStream, journeyRes, bookingRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/whatsapp/stream${baseParams}&token=${encodeURIComponent(token)}`),
          fetch(`${API_BASE_URL}/journey/summary${baseParams}&token=${encodeURIComponent(token)}`),
          fetch(`${API_BASE_URL}/booking/sync${baseParams}&token=${encodeURIComponent(token)}`),
        ]);

        let whatsappStats = { chats: "0", messages: "0", linked: false };
        let journeyStats = { active: "0", templates: "5", running: "0", total_guests: 0, total_messages_sent: 0 };
        let bookingStats = { today: "0", upcoming: "0", pending: "0" };

        // WhatsApp
        if (waStream.status === "fulfilled") {
          const text = await waStream.value.text();
          try {
            const data = JSON.parse(text);
            whatsappStats = {
              chats: String(Array.isArray(data.chats) ? data.chats.length : 0),
              messages: "0",
              linked: Boolean(data.linked),
            };
          } catch {}
        }

        // Journey
        if (journeyRes.status === "fulfilled" && journeyRes.value.ok) {
          const data = await journeyRes.value.json();
          journeyStats = {
            active: String(data.active_guests || 0),
            templates: "5",
            running: String(data.total_guests || 0),
            total_guests: data.total_guests || 0,
            total_messages_sent: data.total_messages_sent || 0,
          };
        }

        // Booking
        if (bookingRes.status === "fulfilled" && bookingRes.value.ok) {
          const data = await bookingRes.value.json();
          bookingStats = {
            today: String(data.synced || 0),
            upcoming: String(data.total_received || 0),
            pending: "0",
          };
        }

        // Use dashboard status if available, otherwise fall back to individual fetches
        const waReady = dashboardStatus?.whatsapp.ready ?? whatsappStats.linked;
        const knowReady = dashboardStatus?.knowledge.ready ?? false;
        const knowConfigured = dashboardStatus?.knowledge.configured ?? false;

        // Update modules
        setModules([
          {
            icon: MessageSquare,
            title: "WHATSAPP_HUB",
            description: "Connect WhatsApp, manage conversations, send automated replies.",
            href: "/whatsapp",
            stats: [
              { label: "chats", value: dashboardStatus?.whatsapp.stats.chats?.toString() ?? whatsappStats.chats },
              { label: "messages", value: dashboardStatus?.whatsapp.stats.messages?.toString() ?? whatsappStats.messages },
              { label: "active", value: waReady ? "true" : "false" },
            ],
          },
          {
            icon: Brain,
            title: "KNOWLEDGE_ENGINE",
            description: "Upload documents, build FAISS index, configure AI identity.",
            href: "/knowledge",
            stats: [
              { label: "documents", value: String(dashboardStatus?.knowledge.stats.documents ?? 0) },
              { label: "vectors", value: String(dashboardStatus?.knowledge.stats.vectors ?? 0) },
              { label: "ready", value: knowReady ? "true" : "false" },
            ],
          },
          {
            icon: MapPin,
            title: "JOURNEY",
            description: "Create guest journeys, automate touchpoints, track progress.",
            href: "/journey",
            stats: [
              { label: "active", value: String(dashboardStatus?.journey.stats.active ?? journeyStats.active) },
              { label: "templates", value: String(dashboardStatus?.journey.stats.templates ?? journeyStats.templates) },
              { label: "msgs_sent", value: String(dashboardStatus?.journey.stats.running ?? journeyStats.total_messages_sent) },
            ],
          },
          {
            icon: Calendar,
            title: "BOOKING",
            description: "Manage reservations, sync availability, handle confirmations.",
            href: "/booking",
            stats: [
              { label: "today", value: String(dashboardStatus?.booking.stats.today ?? bookingStats.today) },
              { label: "upcoming", value: String(dashboardStatus?.booking.stats.upcoming ?? bookingStats.upcoming) },
              { label: "pending", value: String(dashboardStatus?.booking.stats.pending ?? bookingStats.pending) },
            ],
          },
          {
            icon: User,
            title: "PROFILE",
            description: "View account details, manage security settings, session info.",
            href: "/profile",
            stats: [
              { label: "account", value: "active" },
              { label: "tenant", value: "valid" },
              { label: "session", value: "ok" },
            ],
          },
        ]);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      }
    };

    fetchAllStats();
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, [tenantId, token, dashboardStatus]);

  // GSAP entrance animation
  useEffect(() => {
    if (loaded) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Header slides in with stagger
      tl.fromTo(headerRef.current, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });

      // Section title
      tl.fromTo(".section-title", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4 }, "-=0.3");

      // Module cards stagger in with bounce
      tl.fromTo(
        moduleRefs.current.filter(Boolean),
        { y: 60, opacity: 0, scale: 0.9, rotateX: 10 },
        { y: 0, opacity: 1, scale: 1, rotateX: 0, duration: 0.6, stagger: 0.08 },
        "-=0.2"
      );

      // Stats section slides in with scale
      tl.fromTo(statsSectionRef.current, { y: 40, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.5 }, "-=0.3");

      // Footer slides up
      tl.fromTo(footerRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, "-=0.2");

      // Enhanced hover animations for module cards with magnetic effect
      moduleRefs.current.forEach((card) => {
        if (card) {
          card.addEventListener("mouseenter", () => {
            gsap.to(card, {
              y: -10,
              scale: 1.03,
              duration: 0.35,
              ease: "power2.out",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)"
            });
            // Animate icon container
            const iconContainer = card.querySelector(".icon-container");
            if (iconContainer) {
              gsap.to(iconContainer, { scale: 1.1, duration: 0.3, ease: "back.out(1.5)" });
            }
            // Animate chevron
            const chevron = card.querySelector(".chevron-icon");
            if (chevron) {
              gsap.to(chevron, { y: 4, opacity: 1, duration: 0.2 });
            }
            // Animate stats
            gsap.to(card.querySelectorAll(".stat-value"), {
              y: -2,
              duration: 0.2,
              stagger: 0.05
            });
          });
          card.addEventListener("mouseleave", () => {
            gsap.to(card, {
              y: 0,
              scale: 1,
              duration: 0.35,
              ease: "power2.out",
              boxShadow: "0 0 0 rgba(0,0,0,0)"
            });
            const iconContainer = card.querySelector(".icon-container");
            if (iconContainer) {
              gsap.to(iconContainer, { scale: 1, duration: 0.3 });
            }
            const chevron = card.querySelector(".chevron-icon");
            if (chevron) {
              gsap.to(chevron, { y: 0, opacity: 0.5, duration: 0.2 });
            }
            gsap.to(card.querySelectorAll(".stat-value"), { y: 0, duration: 0.2, stagger: 0.05 });
          });
        }
      });

      // Add glow effect to header icon with pulse
      const headerIcon = headerRef.current?.querySelector(".header-icon") as HTMLElement | null;
      if (headerIcon) {
        gsap.to(headerIcon, {
          scale: 1.1,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        gsap.to(headerIcon, {
          boxShadow: "0 0 30px rgba(0,0,0,0.4)",
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      // Status badges animation with stagger
      gsap.fromTo(".status-badge",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, stagger: 0.1 }
      );

      // Add count-up animation to metrics with bounce
      const metricValues = document.querySelectorAll(".metric-value");
      metricValues.forEach((el, i) => {
        const finalValue = el.textContent || "0";
        const isNumeric = !isNaN(Number(finalValue));
        if (isNumeric) {
          el.setAttribute("data-final", finalValue);
          el.textContent = "0";
          gsap.to(el, {
            textContent: finalValue,
            duration: 1.2,
            delay: i * 0.1,
            ease: "power2.out",
            snap: { textContent: 1 },
          });
        }
      });

      // Animate metrics containers on hover
      document.querySelectorAll(".metric-container").forEach((container) => {
        container.addEventListener("mouseenter", () => {
          gsap.to(container, {
            scale: 1.02,
            borderColor: "#000",
            duration: 0.3,
            ease: "power2.out"
          });
        });
        container.addEventListener("mouseleave", () => {
          gsap.to(container, {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
          });
        });
      });

      // Add shimmer to loading states
      gsap.to(".shimmer-effect", {
        backgroundPosition: "200% 0",
        duration: 1.5,
        repeat: -1,
        ease: "power1.inOut",
      });
    }
  }, [loaded]);

  // Trigger animation when modules load
  useEffect(() => {
    if (modules.length > 0) {
      setLoaded(true);
    }
  }, [modules]);

  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-6xl px-8 py-12">
        <header ref={headerRef} className="mb-12 border-b border-black pb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="header-icon flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold tracking-tight">CONTROL_CENTER</h1>
                  <p className="font-mono text-xs text-gray-500">// multi-tenant ai concierge platform</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <StatusBadge label="SYS" value={systemStatus.sys} />
              <StatusBadge label="API" value={systemStatus.api} />
              <StatusBadge label="WA_GATEWAY" value={systemStatus.wa} />
            </div>
          </div>
        </header>

        <section ref={modulesRef} className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
              // available modules
            </h2>
            <span className="font-mono text-xs text-gray-400">5 modules</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {modules.length > 0 ? (
              modules.map((mod, index) => (
                <ModuleCard
                  key={mod.href}
                  index={index}
                  icon={mod.icon}
                  title={mod.title}
                  description={mod.description}
                  href={mod.href}
                  stats={mod.stats}
                />
              ))
            ) : (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border border-black p-6 animate-pulse">
                    <div className="mb-4 h-10 w-10 rounded bg-gray-200" />
                    <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
                    <div className="h-3 w-full rounded bg-gray-200" />
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        <section ref={statsSectionRef} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="border border-black">
            <div className="border-b border-black bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                  LIVE_ACTIVITY_FEED
                </h3>
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
              </div>
            </div>
            <div className="p-0">
              <LiveActivityFeed />
            </div>
          </div>

          <div className="border border-black">
            <div className="border-b border-black bg-black px-4 py-3">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                SYSTEM_METRICS
              </h3>
            </div>
            <div className="p-6">
              <MetricsGrid dashboardStatus={dashboardStatus} />
            </div>
          </div>
        </section>

        <footer ref={footerRef} className="mt-16 border-t border-black pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-gray-400">
            <span>AXIOM_PLATFORM v1.0.0</span>
            <span>MULTI-TENANT AI CONCIERGE</span>
            <span>© 2026</span>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .module-card {
          transform-style: preserve-3d;
          perspective: 1000px;
        }
        .shimmer-effect {
          background: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.05) 50%, transparent 100%);
          background-size: 200% 100%;
        }
        .status-dot {
          animation: none;
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
          }
          50% {
            box-shadow: 0 0 20px rgba(0,0,0,0.4);
          }
        }
        .header-icon {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const isOk = value !== "ERROR" && value !== "OFFLINE" && value !== "DISCONNECTED";
  return (
    <div className="status-badge flex cursor-pointer items-center gap-2 border border-black px-3 py-1.5 transition-all duration-300 hover:scale-105 hover:shadow-md">
      <span className={`status-dot h-2 w-2 ${isOk ? "bg-green-500" : "bg-red-500"}`}></span>
      <span className="font-mono text-xs font-medium text-black">{label}</span>
      <span className="font-mono text-xs text-gray-500">:</span>
      <span className={`font-mono text-xs font-semibold transition-colors duration-300 ${isOk ? "text-black" : "text-red-600"}`}>
        {value}
      </span>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  description,
  href,
  stats,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  stats: { label: string; value: string }[];
  index: number;
}) {
  return (
    <Link
      href={href}
      className="module-card group border border-black bg-white p-6 transition-all duration-300 hover:border-gray-400 hover:bg-gray-50"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="icon-container flex h-10 w-10 items-center justify-center border border-black bg-white text-black transition-all duration-300 group-hover:bg-black group-hover:text-white">
          <Icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
        </div>
        <ChevronDown className="chevron-icon h-4 w-4 text-gray-400 opacity-50 transition-all duration-300" />
      </div>

      <h3 className="mb-2 font-mono text-sm font-bold uppercase tracking-tight transition-all duration-300 group-hover:tracking-wide">{title}</h3>
      <p className="mb-4 font-mono text-xs leading-relaxed text-gray-500 transition-colors duration-300 group-hover:text-gray-700">{description}</p>

      <div className="border-t border-black pt-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`stat-value font-mono text-lg font-bold transition-all duration-300 ${stat.value === "false" ? "text-red-500" : ""}`}>
                {stat.value}
              </div>
              <div className="font-mono text-[10px] uppercase text-gray-400 transition-colors duration-300 group-hover:text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function MetricsGrid({ dashboardStatus }: { dashboardStatus: DashboardStatus | null }) {
  const knowledgeConfigured = dashboardStatus?.knowledge.configured ?? false;
  const whatsappMessages = dashboardStatus?.whatsapp.stats.messages ?? 0;
  const whatsappChats = dashboardStatus?.whatsapp.stats.chats ?? 1;

  const metrics = [
    { label: "uptime", value: "99.9%", icon: Activity },
    { label: "requests_today", value: String(whatsappMessages), icon: Database },
    { label: "active_sessions", value: String(whatsappChats), icon: Bot },
    { label: "webhook_status", value: knowledgeConfigured ? "OK" : "NOT_CONFIGURED", icon: Wifi },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isOk = metric.value !== "NOT_CONFIGURED";
        return (
          <div
            key={metric.label}
            className={`metric-container cursor-pointer border p-4 transition-all duration-300 ${
              isOk ? "border-gray-200 hover:border-black hover:shadow-md" : "border-amber-200 bg-amber-50 hover:border-amber-400"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-3 w-3 text-gray-400 transition-transform duration-300 hover:scale-125" />
              <span className="font-mono text-[10px] uppercase text-gray-400 transition-colors duration-300 group-hover:text-black">{metric.label}</span>
            </div>
            <div className={`metric-value font-mono text-xl font-bold transition-all duration-300 ${isOk ? "" : "text-amber-600"}`}>{metric.value}</div>
          </div>
        );
      })}
    </div>
  );
}