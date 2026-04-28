import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Code,
  MessageSquare,
  Brain,
  CalendarSync,
  Sparkles,
  Route,
} from "lucide-react";
import MarketingNav from "@/components/MarketingNav";

const PREVIEW_IMG =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2000&auto=format&fit=crop";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-black selection:bg-black selection:text-white">
      <MarketingNav />

      <header className="relative bg-black px-6 pb-28 pt-24 text-white sm:pb-40 sm:pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 inline-flex items-center gap-2 opacity-50 sm:mb-12">
            <Code className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-tighter">
              AI-Enhanced Concierge Platform
            </span>
          </div>

          <h1 className="text-5xl font-black leading-[0.85] tracking-tighter sm:text-7xl md:text-[9rem]">
            AI-ENHANCED <br />
            DIGITAL HOTEL <br />
            MANAGEMENT.
          </h1>

          <div className="mt-10 max-w-xl border-t border-white/20 pt-8 sm:mt-12">
            <p className="text-sm leading-relaxed text-zinc-300">
              Operate WhatsApp, journeys, booking sync, and RAG assistance from one control
              layer built for hospitality teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-2 border border-white bg-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-black transition hover:bg-zinc-200"
              >
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border border-white/40 px-6 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-white transition hover:border-white hover:bg-white hover:text-black"
              >
                View Features
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="border-y border-black px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center gap-4">
            <h2 className="whitespace-nowrap text-xs font-black uppercase tracking-[0.4em]">
              System Core Capabilities
            </h2>
            <div className="h-px flex-grow bg-black" />
          </div>

          <div className="grid grid-cols-1 gap-px border border-black bg-black md:grid-cols-12">
            <Card
              className="md:col-span-8"
              icon={MessageSquare}
              title="WhatsApp Hub"
              body="Stream conversations, respond from dashboard, and keep one inbox for operators."
            />
            <Card
              className="md:col-span-4"
              icon={CalendarSync}
              title="Booking Sync"
              body="Sync reservations with external systems and trigger guest workflows automatically."
            />
            <Card
              className="md:col-span-4"
              icon={Route}
              title="Journey Engine"
              body="Run prebuilt touchpoint templates from check-in to post-stay follow-ups."
            />
            <Card
              className="md:col-span-4"
              icon={Brain}
              title="Knowledge + RAG"
              body="Upload docs, index FAISS vectors, and answer with contextual retrieval."
            />
            <Card
              className="md:col-span-4"
              icon={Sparkles}
              title="Live Intelligence"
              body="Observe status and activity streams with real-time module health signals."
            />
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                Preview Mode
              </p>
              <h3 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">INTELLIGENCE</h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              AXIOM-01 TERMINAL
            </span>
          </div>

          <div className="overflow-hidden border border-black bg-black p-2">
            <div className="relative h-[320px] w-full md:h-[460px]">
              <Image
                src={PREVIEW_IMG}
                alt="Digital operations preview"
                fill
                priority
                className="object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black bg-black px-6 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500 md:flex-row">
          <span>// Secure_Channel_Active //</span>
          <span>Inika Bot Platform</span>
          <span>Session: Operational</span>
        </div>
      </footer>
    </div>
  );
}

function Card({
  className,
  icon: Icon,
  title,
  body,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className={`bg-white p-8 transition hover:bg-zinc-100 ${className || ""}`}>
      <Icon className="mb-5 h-5 w-5" />
      <h4 className="text-xl font-black tracking-tight">{title}</h4>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">{body}</p>
    </article>
  );
}
