import Link from "next/link";

/**
 * Top bar used on public routes (landing, auth) — matches digital-billboard style.
 */
export default function MarketingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="flex max-w-7xl mx-auto items-center justify-between p-6">
        <Link href="/landing" className="text-[10px] font-bold tracking-[0.3em] uppercase flex items-center gap-3">
          <span className="w-5 h-5 bg-black rounded-full flex items-center justify-center shrink-0">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
          </span>
          <span className="hidden sm:inline">Inika Bot · Hotel AI Concierge</span>
          <span className="sm:hidden">Inika Bot</span>
        </Link>
        <div className="flex gap-6 sm:gap-8 items-center">
          <Link
            href="/login"
            className="text-[11px] font-black uppercase tracking-widest hover:line-through transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-[11px] font-black bg-black text-white px-5 sm:px-6 py-3 uppercase tracking-widest hover:bg-zinc-800 transition shadow-2xl"
          >
            Open Console
          </Link>
        </div>
      </div>
    </nav>
  );
}
