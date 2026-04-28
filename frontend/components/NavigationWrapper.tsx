"use client";

import { usePathname } from "next/navigation";
import AppNav from "@/components/AppNav";

/**
 * Global chrome: white background. Marketing landing page has no app navbar.
 */
const NO_APP_NAV = new Set(["/landing", "/", "/login", "/signup"]);

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const showNav = !NO_APP_NAV.has(pathname);

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-black">
      {showNav && <AppNav />}
      {children}
    </div>
  );
}
