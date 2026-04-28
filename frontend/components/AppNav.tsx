"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { LayoutDashboard, MessageSquare, Brain, User, LogOut, MapPin, Calendar } from "lucide-react";
import { logout } from "@/lib/api";

const LINKS = [
  { href: "/dashboard", label: "DASHBOARD", icon: LayoutDashboard },
  { href: "/journey", label: "JOURNEY", icon: MapPin },
  { href: "/booking", label: "BOOKING", icon: Calendar },
  { href: "/whatsapp", label: "WHATSAPP", icon: MessageSquare },
  { href: "/knowledge", label: "KNOWLEDGE", icon: Brain },
  { href: "/profile", label: "PROFILE", icon: User },
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-black/20 bg-transparent text-black backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 p-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="hidden sm:inline">Inika Bot Console</span>
          <span className="sm:hidden">Inika</span>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <div key={link.href} className="flex items-center">
                <Link
                  href={link.href}
                  className={`
                    flex items-center gap-2 border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all
                    ${active
                      ? "border-black bg-black text-white"
                      : "border-black/20 text-black hover:border-black hover:bg-zinc-100"
                    }
                  `}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleLogout}
          className="ml-auto flex items-center gap-2 border border-red-300 bg-red-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-400"
        >
          <LogOut className="h-3 w-3" />
          <span className="hidden md:inline">LOGOUT</span>
        </button>
      </div>
    </nav>
  );
}