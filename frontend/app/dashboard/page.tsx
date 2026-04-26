import Link from "next/link";
import AppNav from "../../components/AppNav";
import LiveActivityFeed from "../../components/LiveActivityFeed";
import { MessageSquare, Brain, ArrowRight, Activity, Database, Bot, Wifi, ChevronDown, User } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-6xl px-8 py-12">
        <header className="mb-12 border-b border-black pb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold tracking-tight">CONTROL_CENTER</h1>
                  <p className="font-mono text-xs text-gray-500">// multi-tenant ai concierge platform</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <StatusBadge label="SYS" value="OPERATIONAL" />
              <StatusBadge label="API" value="ONLINE" />
              <StatusBadge label="WA_GATEWAY" value="CONNECTED" />
            </div>
          </div>
        </header>

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
              // available modules
            </h2>
            <span className="font-mono text-xs text-gray-400">3 modules</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ModuleCard
              icon={MessageSquare}
              title="WHATSAPP_HUB"
              description="Connect WhatsApp, manage conversations, send automated replies."
              href="/whatsapp"
              stats={[
                { label: "chats", value: "0" },
                { label: "messages", value: "0" },
                { label: "active", value: "false" },
              ]}
            />
            <ModuleCard
              icon={Brain}
              title="KNOWLEDGE_ENGINE"
              description="Upload documents, build FAISS index, configure AI identity."
              href="/knowledge"
              stats={[
                { label: "documents", value: "0" },
                { label: "vectors", value: "0" },
                { label: "ready", value: "false" },
              ]}
            />
            <ModuleCard
              icon={User}
              title="PROFILE"
              description="View account details, manage security settings, session info."
              href="/profile"
              stats={[
                { label: "account", value: "active" },
                { label: "tenant", value: "valid" },
                { label: "session", value: "ok" },
              ]}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
              <MetricsGrid />
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-black pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-gray-400">
            <span>AXIOM_PLATFORM v1.0.0</span>
            <span>MULTI-TENANT AI CONCIERGE</span>
            <span>© 2026</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const isOk = value !== "ERROR" && value !== "OFFLINE" && value !== "DISCONNECTED";
  return (
    <div className="flex items-center gap-2 border border-black px-3 py-1.5">
      <span className={`h-2 w-2 ${isOk ? "bg-green-500" : "bg-red-500"}`}></span>
      <span className="font-mono text-xs font-medium text-black">{label}</span>
      <span className="font-mono text-xs text-gray-500">:</span>
      <span className={`font-mono text-xs font-semibold ${isOk ? "text-black" : "text-red-600"}`}>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <Link
      href={href}
      className="group border border-black bg-white p-6 transition-all hover:border-gray-400 hover:bg-gray-50"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center border border-black bg-white text-black group-hover:bg-black group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-y-1" />
      </div>

      <h3 className="mb-2 font-mono text-sm font-bold uppercase tracking-tight">{title}</h3>
      <p className="mb-4 font-mono text-xs text-gray-500 leading-relaxed">{description}</p>

      <div className="border-t border-black pt-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-mono text-lg font-bold">{stat.value}</div>
              <div className="font-mono text-[10px] uppercase text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function MetricsGrid() {
  const metrics = [
    { label: "uptime", value: "99.9%", icon: Activity },
    { label: "requests_today", value: "0", icon: Database },
    { label: "active_sessions", value: "1", icon: Bot },
    { label: "webhook_status", value: "OK", icon: Wifi },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="border border-gray-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-3 w-3 text-gray-400" />
              <span className="font-mono text-[10px] uppercase text-gray-400">{metric.label}</span>
            </div>
            <div className="font-mono text-xl font-bold">{metric.value}</div>
          </div>
        );
      })}
    </div>
  );
}
