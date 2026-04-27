"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Brain, User, LogOut, MapPin, Calendar, MessageCircle } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "DASHBOARD", icon: LayoutDashboard },
  { href: "/journey", label: "JOURNEY", icon: MapPin },
  { href: "/booking", label: "BOOKING", icon: Calendar },
  { href: "/whatsapp", label: "WHATSAPP", icon: MessageSquare },
  { href: "/rag", label: "RAG", icon: MessageCircle },
  { href: "/knowledge", label: "KNOWLEDGE", icon: Brain },
  { href: "/profile", label: "PROFILE", icon: User },
];

async function handleLogout() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: "POST" });
    if (res.ok) {
      localStorage.removeItem("axiom_token");
      localStorage.removeItem("axiom_username");
      window.location.href = "/login";
    }
  } catch {
    localStorage.removeItem("axiom_token");
    localStorage.removeItem("axiom_username");
    window.location.href = "/login";
  }
}

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-black">
      <div className="mx-auto flex max-w-7xl items-center justify-center">
        <div className="flex items-center">
          {LINKS.map((link, idx) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            const isLast = idx === LINKS.length - 1;
            return (
              <div key={link.href} className="flex items-center">
                <Link
                  href={link.href}
                  className={`
                    flex items-center gap-2 border-b-2 px-6 py-4 font-mono text-xs font-semibold uppercase tracking-wider transition-all
                    ${active
                      ? "border-black bg-black text-white"
                      : "border-transparent text-black hover:border-gray-300 hover:bg-gray-50"
                    }
                  `}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
                {!isLast && <div className="h-6 w-px bg-gray-200" />}
              </div>
            );
          })}
          <div className="h-6 w-px bg-gray-200" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-4 font-mono text-xs font-semibold uppercase tracking-wider text-red-600 transition-all hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            LOGOUT
          </button>
        </div>
      </div>
    </nav>
  );
}