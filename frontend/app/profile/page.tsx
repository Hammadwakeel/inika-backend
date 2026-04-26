"use client";

import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { User, Mail, Building, Shield, Clock, LogOut } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<{ username: string; tenant_id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const username = localStorage.getItem("axiom_username") || "Unknown";
    const tenantId = localStorage.getItem("axiom_tenant_id") || "Unknown";
    setUser({ username, tenant_id: tenantId });
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore errors
    }
    localStorage.removeItem("axiom_token");
    localStorage.removeItem("axiom_username");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <AppNav />
        <main className="mx-auto max-w-6xl px-8 py-12">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin border-2 border-black border-t-transparent"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-4xl px-8 py-12">
        <header className="mb-12 border-b border-black pb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight">PROFILE</h1>
              <p className="font-mono text-xs text-gray-500">// operator account details</p>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {/* Profile Card */}
          <div className="border border-black">
            <div className="border-b border-black bg-black px-6 py-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-white" />
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  Account Information
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-8 flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center border-2 border-black bg-gray-100">
                  <span className="font-mono text-2xl font-bold">
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <h3 className="font-mono text-xl font-bold">{user?.username || "Unknown"}</h3>
                  <p className="font-mono text-sm text-gray-500">Operator Account</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ProfileField
                  icon={User}
                  label="Username"
                  value={user?.username || "Unknown"}
                />
                <ProfileField
                  icon={Building}
                  label="Tenant ID"
                  value={user?.tenant_id || "Unknown"}
                />
                <ProfileField
                  icon={Shield}
                  label="Account Type"
                  value="Operator"
                />
                <ProfileField
                  icon={Clock}
                  label="Session Status"
                  value="Active"
                  status="online"
                />
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="border border-black">
            <div className="border-b border-black bg-black px-6 py-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white" />
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  Security
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center border border-black bg-gray-100">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">Password</p>
                      <p className="font-mono text-xs text-gray-500">Last changed: Never</p>
                    </div>
                  </div>
                  <button className="border border-black px-4 py-2 font-mono text-xs font-medium hover:bg-black hover:text-white">
                    CHANGE
                  </button>
                </div>

                <div className="flex items-center justify-between border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center border border-black bg-gray-100">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">Session Cookie</p>
                      <p className="font-mono text-xs text-gray-500">HTTPOnly, Secure</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-green-600">ENABLED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-300">
            <div className="border-b border-red-300 bg-red-50 px-6 py-4">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-red-600">
                Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">Sign Out</p>
                  <p className="font-mono text-xs text-gray-500">End your current session</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 border border-red-500 px-6 py-3 font-mono text-sm font-medium text-red-600 transition-all hover:bg-red-500 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  SIGN OUT
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 border-t border-black pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-gray-400">
            <span>PROFILE v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status?: "online" | "offline";
}) {
  return (
    <div className="flex items-center gap-4 border border-gray-200 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center border border-black bg-gray-100">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium">{value}</p>
          {status === "online" && (
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}