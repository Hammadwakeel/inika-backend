"use client";

import { ShieldCheck, Loader2, ChevronRight } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const savedTenantId = window.localStorage.getItem("axiom_tenant_id");
    if (savedTenantId) {
      setTenantId(savedTenantId);
      return;
    }

    const generated = `tenant-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    setTenantId(generated);
    window.localStorage.setItem("axiom_tenant_id", generated);
  }, []);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "signup") {
      setMode("signup");
    } else {
      setMode("login");
    }
  }, [searchParams]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const body = JSON.stringify({
        tenant_id: tenantId,
        username,
        password,
      });

      if (mode === "signup") {
        const signupResponse = await fetch(`${API_BASE_URL}/auth/bootstrap`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        });

        if (!signupResponse.ok) {
          const data = (await signupResponse.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(data?.detail ?? "Sign up failed.");
        }
        setNotice("Account created. Logging in...");
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? (mode === "signup" ? "Sign up failed." : "Authentication failed."));
      }

      const data = await response.json();
      window.localStorage.setItem("axiom_tenant_id", tenantId);
      window.localStorage.setItem("axiom_token", data.access_token || "");
      window.localStorage.setItem("axiom_username", username);
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-black px-8 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-black bg-black text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-mono text-lg font-semibold tracking-tight">AXIOM</span>
          </div>
          <span className="font-mono text-xs text-gray-500">v1.0.0</span>
        </div>
      </nav>

      <main className="mx-auto max-w-lg px-8 py-20">
        <div className="border border-black">
          <div className="border-b border-black bg-black px-8 py-6">
            <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
              {mode === "signup" ? "CREATE_ACCOUNT" : "AUTHENTICATE"}
            </h1>
            <p className="mt-1 font-mono text-xs text-gray-400">
              {mode === "signup"
                ? "// operator registration"
                : "// tenant authentication"}
            </p>
          </div>

          <div className="bg-white p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="flex border border-black">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 py-3 px-4 font-mono text-sm font-medium transition-all ${
                    mode === "login"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-50"
                  }`}
                >
                  LOGIN
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 border-l border-black py-3 px-4 font-mono text-sm font-medium transition-all ${
                    mode === "signup"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-50"
                  }`}
                >
                  REGISTER
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs font-medium uppercase tracking-wider text-gray-500">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="operator_id"
                  autoComplete="username"
                  required
                  className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs font-medium uppercase tracking-wider text-gray-500">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full border border-black px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0"
                />
              </div>

              {error && (
                <div className="border border-red-500 bg-red-50 px-4 py-3">
                  <p className="font-mono text-xs text-red-600">ERROR: {error}</p>
                </div>
              )}
              {notice && (
                <div className="border border-green-500 bg-green-50 px-4 py-3">
                  <p className="font-mono text-xs text-green-600">SUCCESS: {notice}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center border border-black bg-black py-3 px-4 font-mono text-sm font-medium text-white transition-all hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    PROCESSING...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "signup" ? "CREATE_ACCOUNT" : "AUTHENTICATE"}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-black pt-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-gray-400">
                  {mode === "signup" ? "account.exists" : "no.account"}
                </span>
                <a
                  href={mode === "signup" ? "/login?mode=login" : "/signup"}
                  className="font-mono text-sm font-medium text-black underline underline-offset-4 hover:text-gray-600"
                >
                  {mode === "signup" ? "[ SWITCH_TO_LOGIN ]" : "[ CREATE_NEW ]"}
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-black bg-gray-50 px-8 py-4">
            <div className="flex items-center justify-between font-mono text-xs text-gray-400">
              <span>AXIOM_AUTH_GATEWAY</span>
              <span>SYS:OPERATIONAL</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border border-dashed border-gray-300 p-6">
          <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-gray-400">
            // password requirements
          </h3>
          <ul className="space-y-1 font-mono text-xs text-gray-500">
            <li className="flex items-center gap-2">
              <span className="text-gray-300">›</span>
              Minimum 8 characters
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-300">›</span>
              At least 1 uppercase letter
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-300">›</span>
              At least 1 number
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-300">›</span>
              At least 1 special character
            </li>
          </ul>
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 border-t border-black px-8 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between font-mono text-xs text-gray-400">
          <span>© 2026 AXIOM SYSTEMS</span>
          <span>MULTI-TENANT AI CONCIERGE</span>
        </div>
      </footer>
    </div>
  );
}