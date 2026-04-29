"use client";

import Link from "next/link";
import { Loader2, ChevronRight, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MarketingNav from "@/components/MarketingNav";
import AxiomInput from "@/components/AxiomInput";
import { getApiBaseUrl } from "@/lib/api";

const API_BASE_URL = getApiBaseUrl();

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    setMode(requestedMode === "signup" ? "signup" : "login");
  }, [searchParams]);

  useEffect(() => {
    const savedTenantId = window.localStorage.getItem("axiom_tenant_id");
    if (savedTenantId) {
      setTenantId(savedTenantId);
    } else {
      const generated = `tenant-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      setTenantId(generated);
      window.localStorage.setItem("axiom_tenant_id", generated);
    }
    setLoading(false);
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormLoading(true);
    setError(null);
    setNotice(null);

    try {
      console.log("API_BASE_URL:", API_BASE_URL);
      const body = JSON.stringify({ tenant_id: tenantId, username, password });
      console.log("Request body:", body);

      if (mode === "signup") {
        console.log("Calling bootstrap...");
        const signupResponse = await fetch(`${API_BASE_URL}/auth/bootstrap`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body,
        });
        console.log("Bootstrap status:", signupResponse.status);

        if (!signupResponse.ok) {
          const text = await signupResponse.text();
          console.error("Bootstrap error:", text);
          throw new Error(text || "Sign up failed.");
        }
        const signupDataText = await signupResponse.text();
        console.log("Bootstrap raw response:", signupDataText);
        let signupData: { message?: string; tenant_id?: string } = {};
        try {
          signupData = JSON.parse(signupDataText);
        } catch (e) {
          console.error("Failed to parse bootstrap response:", e);
        }
        console.log("Bootstrap response:", signupData);
        setNotice("Account created. Logging in...");
      }

      console.log("Calling login...");
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
      });
      console.log("Login status:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("Login error response:", text);
        throw new Error(text || (mode === "signup" ? "Sign up failed." : "Authentication failed."));
      }

      const dataText = await response.text();
      console.log("Login raw response:", dataText);
      let data: { access_token?: string } = {};
      try {
        data = JSON.parse(dataText);
      } catch (e) {
        console.error("Failed to parse login response:", e);
      }
      console.log("Login response:", data);
      window.localStorage.setItem("axiom_tenant_id", tenantId);
      window.localStorage.setItem("axiom_token", data.access_token || "");
      window.localStorage.setItem("axiom_username", username);
      router.push("/dashboard");
    } catch (submitError) {
      console.error("Submit error:", submitError);
      const message = submitError instanceof Error ? submitError.message : "Unexpected error.";
      console.error("Error message:", message);
      setError(message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <MarketingNav />
      <main className="relative mx-auto grid w-full max-w-7xl gap-px border border-black bg-black px-0 py-0 lg:grid-cols-2">
        <section className="bg-black p-8 text-white sm:p-12">
          <p className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/55">
            Inika Bot // Access Layer
          </p>
          <h1 className="text-5xl font-black uppercase leading-[0.86] tracking-tighter sm:text-6xl lg:text-7xl">
            {mode === "signup" ? "Create Hotel Access" : "Operator Login"}
          </h1>
          <p className="mt-6 max-w-md text-[11px] uppercase leading-relaxed tracking-[0.18em] text-white/70">
            Tenant-isolated authentication for digital hotel operations. Sign in to control WhatsApp,
            journeys, booking sync, and knowledge systems.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-px border border-white/30 bg-white/20 sm:grid-cols-2">
            <div className="bg-black px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Environment</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.08em]">Production Ready</p>
            </div>
            <div className="bg-black px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Session Mode</p>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.08em]">
                {mode === "signup" ? "Bootstrap" : "Authenticate"}
              </p>
            </div>
          </div>

          <div className="mt-6 border border-white/25 bg-white/5 p-4">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-white/90">System Status: Operational</span>
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              {loading ? "Loading tenant..." : `Tenant Context: ${tenantId}`}
            </p>
          </div>
        </section>

        <section className="bg-white p-8 text-black sm:p-12">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                Operator Credential Input
              </p>
            </div>

            <div className="grid grid-cols-2 border border-black">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                  mode === "login" ? "bg-black text-white" : "bg-white text-black hover:bg-zinc-100"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`border-l border-black py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                  mode === "signup" ? "bg-black text-white" : "bg-white text-black hover:bg-zinc-100"
                }`}
              >
                Sign Up
              </button>
            </div>

            <AxiomInput
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="operator_id"
              autoComplete="username"
              required
              disabled={formLoading}
            />
            <AxiomInput
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              disabled={formLoading}
            />
            <p className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700">
              Password must include lowercase, uppercase, number, and special symbol.
            </p>

            {error && (
              <div className="border border-red-500 bg-red-50 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="border border-green-500 bg-green-50 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-green-700">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={formLoading || loading}
              className="flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-4 text-[11px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  {mode === "signup" ? "Create Account" : "Sign In"}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
            <div className="border-t border-black pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-600">
                {mode === "signup" ? "Already have an account?" : "New to Inika Bot?"}{" "}
                <Link
                  href={mode === "signup" ? "/login?mode=login" : "/signup"}
                  className="font-black text-black hover:underline"
                >
                  {mode === "signup" ? "Switch to login" : "Create account"}
                </Link>
              </p>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}