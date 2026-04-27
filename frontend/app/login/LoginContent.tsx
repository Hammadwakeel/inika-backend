"use client";

import { ShieldCheck, Loader2, ChevronRight } from "lucide-react";
import { FormEvent, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton, FormSkeleton } from "../../components/Skeleton";
import gsap from "gsap";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  const navRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const requirementsRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const bgRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([]);

  const handleInputFocus = (index: number) => {
    gsap.to(inputRefs.current[index], {
      scale: 1.02,
      boxShadow: "0 0 20px rgba(0,0,0,0.1)",
      duration: 0.2,
      ease: "power2.out",
    });
  };

  const handleInputBlur = (index: number) => {
    gsap.to(inputRefs.current[index], {
      scale: 1,
      boxShadow: "none",
      duration: 0.2,
      ease: "power2.out",
    });
  };

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

  useEffect(() => {
    if (!loading) {
      setParticles(
        Array.from({ length: 20 }, () => ({
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          delay: `${Math.random() * 2}s`,
          duration: `${3 + Math.random() * 4}s`,
        }))
      );
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && bgRef.current) {
      // Animate background grid
      gsap.to(bgRef.current, {
        backgroundPosition: "50px 50px",
        duration: 20,
        repeat: -1,
        ease: "none",
      });
    }
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(navRef.current, { y: -100, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });
      tl.fromTo(
        containerRef.current,
        { scale: 0.95, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.7 },
        "-=0.3"
      );
      tl.fromTo(headerRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.4");

      const titleEl = headerRef.current?.querySelector(".title-text");
      if (titleEl) {
        const originalText = titleEl.textContent || "";
        titleEl.textContent = "";
        tl.to(titleEl, { duration: 0 }, "-=0.2");
        for (let i = 0; i <= originalText.length; i++) {
          tl.to(
            titleEl,
            {
              textContent: originalText.substring(0, i),
              duration: 0.03,
              ease: "none",
            },
            i === 0 ? "<" : ">-0.0"
          );
        }
      }

      tl.fromTo(
        formRef.current?.querySelectorAll(".form-field") ?? [],
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 },
        "-=0.2"
      );

      tl.fromTo(
        formRef.current?.querySelector(".submit-btn") ?? [],
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        "-=0.2"
      );

      tl.fromTo(footerRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, "-=0.3");
      tl.fromTo(
        requirementsRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        "-=0.2"
      );

      const logoIcon = navRef.current?.querySelector(".logo-icon") as HTMLElement | null;
      if (logoIcon) {
        gsap.to(logoIcon, {
          y: -4,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1.5,
        });
      }

      const submitBtn = formRef.current?.querySelector(".submit-btn");
      if (submitBtn) {
        submitBtn.addEventListener("mouseenter", () => {
          gsap.to(submitBtn, { scale: 1.02, boxShadow: "0 0 20px rgba(0,0,0,0.3)", duration: 0.2 });
        });
        submitBtn.addEventListener("mouseleave", () => {
          gsap.to(submitBtn, { scale: 1, boxShadow: "none", duration: 0.2 });
        });
      }

      // Card hover animation
      if (cardRef.current) {
        cardRef.current.addEventListener("mouseenter", () => {
          gsap.to(cardRef.current, {
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.3)",
            duration: 0.3,
            ease: "power2.out"
          });
        });
        cardRef.current.addEventListener("mouseleave", () => {
          gsap.to(cardRef.current, {
            boxShadow: "none",
            borderColor: "rgba(255,255,255,0.2)",
            duration: 0.3,
            ease: "power2.out"
          });
        });
      }

      // Requirements card hover
      if (requirementsRef.current) {
        requirementsRef.current.addEventListener("mouseenter", () => {
          gsap.to(requirementsRef.current, {
            y: -4,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.05)",
            duration: 0.3,
            ease: "power2.out"
          });
        });
        requirementsRef.current.addEventListener("mouseleave", () => {
          gsap.to(requirementsRef.current, {
            y: 0,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            duration: 0.3,
            ease: "power2.out"
          });
        });
      }

      gsap.to(headerRef.current, {
        boxShadow: "0 0 40px rgba(0,0,0,0.15)",
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1,
      });
    }
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      const titleEl = headerRef.current?.querySelector(".title-text");
      if (titleEl) {
        gsap.to(titleEl, {
          opacity: 0,
          y: -10,
          duration: 0.2,
          onComplete: () => {
            gsap.to(titleEl, { opacity: 1, y: 0, duration: 0.3 });
          },
        });
      }
    }
  }, [mode, loading]);

  const handleModeSwitch = (newMode: "login" | "signup") => {
    if (newMode === mode) return;

    const tl = gsap.timeline();
    tl.to(formRef.current, { opacity: 0, y: -10, duration: 0.2 });
    tl.call(() => setMode(newMode));
    tl.to(formRef.current, { opacity: 1, y: 0, duration: 0.3 });
  };

  useEffect(() => {
    if (error || notice) {
      const msgEl = document.querySelector(".message-animate");
      if (msgEl) {
        gsap.fromTo(
          msgEl,
          { opacity: 0, y: -10, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" }
        );
      }
    }
  }, [error, notice]);

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
    setFormLoading(true);
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
      setFormLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Futuristic Background */}
      <div
        ref={bgRef}
        className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      >
        {/* Radial glow effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
      </div>

      {/* Animated particles */}
      <div className="particles absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={i}
            className="particle absolute h-1 w-1 rounded-full bg-white/20"
            style={{
              left: p.left,
              top: p.top,
              animation: `float ${p.duration} ease-in-out infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Accent lines */}
      <div className="accent-line absolute left-0 top-1/4 h-px w-32 bg-gradient-to-r from-white/20 to-transparent" />
      <div className="accent-line absolute bottom-1/4 right-0 h-px w-48 bg-gradient-to-l from-white/20 to-transparent" />

      {loading ? (
        <div className="relative flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md border border-white/20 bg-white/5 p-8 backdrop-blur-sm">
            <div className="mb-6 border-b border-white/20 pb-6">
              <Skeleton className="mb-2 h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <FormSkeleton fields={2} />
            <Skeleton className="mt-4 h-12 w-full" />
          </div>
        </div>
      ) : (
        <>
          <nav
            ref={navRef}
            className="relative border-b border-white/10 bg-black/50 px-8 py-4 backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="logo-icon hover-logo relative flex h-10 w-10 cursor-pointer items-center justify-center border border-white/20 bg-gradient-to-br from-white/10 to-transparent text-white transition-all duration-300 hover:scale-110 hover:border-white/40 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <ShieldCheck className="h-5 w-5 transition-transform duration-300 hover:scale-110" />
                  <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" />
                </div>
                <span className="logo-text font-mono text-lg font-semibold tracking-tight text-white transition-all duration-300 hover:tracking-wider">AXIOM</span>
              </div>
              <span className="font-mono text-xs text-white/40">v1.0.0</span>
            </div>
          </nav>

          <main ref={containerRef} className="relative mx-auto max-w-md px-8 py-20">
            {/* Glow behind card */}
            <div className="absolute inset-0 -z-10 m-8 rounded-lg bg-gradient-to-r from-white/5 via-transparent to-white/5 blur-xl" />

            <div ref={cardRef} className="main-card border border-white/20 bg-black/80 backdrop-blur-xl transition-all duration-300 hover:border-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <div
                ref={headerRef}
                className="relative border-b border-white/10 bg-gradient-to-r from-gray-900 via-black to-gray-900 px-8 py-6"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="relative">
                  <h1 className="title-text font-mono text-2xl font-bold tracking-tight text-white">
                    {mode === "signup" ? "CREATE_ACCOUNT" : "AUTHENTICATE"}
                  </h1>
                  <p className="mt-1 font-mono text-xs text-white/50">
                    {mode === "signup" ? "// operator registration" : "// tenant authentication"}
                  </p>
                </div>
              </div>

              <div ref={formRef} className="bg-white/5 p-8">
                <form onSubmit={onSubmit} className="space-y-6">
                  {/* Login/Register Toggle - Improved symmetry */}
                  <div className="form-field relative flex overflow-hidden rounded border border-white/20">
                    {/* Sliding indicator */}
                    <div
                      className="absolute inset-0 z-10 bg-gradient-to-r from-white/20 to-white/10 transition-all duration-300"
                      style={{
                        transform: mode === "signup" ? "translateX(50%)" : "translateX(0%)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleModeSwitch("login")}
                      className={`toggle-btn relative z-20 flex-1 py-3 px-4 font-mono text-sm font-medium transition-all duration-300 hover:brightness-110 ${
                        mode === "login" ? "text-black" : "text-white/70 hover:text-white"
                      }`}
                    >
                      LOGIN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch("signup")}
                      className={`toggle-btn relative z-20 flex-1 py-3 px-4 font-mono text-sm font-medium transition-all duration-300 hover:brightness-110 ${
                        mode === "signup" ? "text-black" : "text-white/70 hover:text-white"
                      }`}
                    >
                      REGISTER
                    </button>
                  </div>

                  <div className="form-field space-y-1">
                    <label className="input-label font-mono text-xs font-medium uppercase tracking-wider text-white/50 transition-all duration-300">
                      Username
                    </label>
                    <input
                      ref={(el) => {
                        inputRefs.current[0] = el;
                      }}
                      onFocus={() => handleInputFocus(0)}
                      onBlur={() => handleInputBlur(0)}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="operator_id"
                      autoComplete="username"
                      required
                      className="form-input w-full border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 transition-all duration-300 hover:border-white/30 hover:bg-white/10 focus:border-white/40 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>

                  <div className="form-field space-y-1">
                    <label className="input-label font-mono text-xs font-medium uppercase tracking-wider text-white/50 transition-all duration-300">
                      Password
                    </label>
                    <input
                      ref={(el) => {
                        inputRefs.current[1] = el;
                      }}
                      onFocus={() => handleInputFocus(1)}
                      onBlur={() => handleInputBlur(1)}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                      className="form-input w-full border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 transition-all duration-300 hover:border-white/30 hover:bg-white/10 focus:border-white/40 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>

                  {error && (
                    <div className="message-animate border border-red-500/50 bg-red-500/10 px-4 py-3 backdrop-blur-sm">
                      <p className="font-mono text-xs text-red-400">ERROR: {error}</p>
                    </div>
                  )}
                  {notice && (
                    <div className="message-animate border border-green-500/50 bg-green-500/10 px-4 py-3 backdrop-blur-sm">
                      <p className="font-mono text-xs text-green-400">SUCCESS: {notice}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="submit-btn hover-btn group relative flex w-full items-center justify-center border border-white/20 bg-white/10 py-3 px-4 font-mono text-sm font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:border-white/40 hover:bg-white/20 hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="relative z-10">
                      {formLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          PROCESSING...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {mode === "signup" ? "CREATE_ACCOUNT" : "AUTHENTICATE"}
                          <ChevronRight className="btn-arrow h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      )}
                    </span>
                    {/* Shine effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </button>
                </form>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white/40">
                      {mode === "signup" ? "account.exists" : "no.account"}
                    </span>
                    <a
                      href={mode === "signup" ? "/login?mode=login" : "/signup"}
                      className="hover-link font-mono text-sm font-medium text-white/70 transition-all duration-300 hover:text-white hover:tracking-wider"
                    >
                      {mode === "signup" ? "[ SWITCH_TO_LOGIN ]" : "[ CREATE_NEW ]"}
                    </a>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/5 px-8 py-4">
                <div className="flex items-center justify-between font-mono text-xs text-white/30">
                  <span>AXIOM_AUTH_GATEWAY</span>
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/50 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                    SYS:OPERATIONAL
                  </span>
                </div>
              </div>
            </div>

            <div ref={requirementsRef} className="requirements-card hover-card mt-8 border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10">
              <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-white/40 transition-colors duration-300 group-hover:text-white/50">
                // password requirements
              </h3>
              <ul className="space-y-1 font-mono text-xs text-white/30">
                <li className="req-item flex items-center gap-2 transition-all duration-300 hover:translate-x-1 hover:text-white/50">
                  <span className="text-white/20 transition-colors duration-300 group-hover:text-white/40">›</span>
                  Minimum 8 characters
                </li>
                <li className="req-item flex items-center gap-2 transition-all duration-300 hover:translate-x-1 hover:text-white/50">
                  <span className="text-white/20 transition-colors duration-300 group-hover:text-white/40">›</span>
                  At least 1 uppercase letter
                </li>
                <li className="req-item flex items-center gap-2 transition-all duration-300 hover:translate-x-1 hover:text-white/50">
                  <span className="text-white/20 transition-colors duration-300 group-hover:text-white/40">›</span>
                  At least 1 number
                </li>
                <li className="req-item flex items-center gap-2 transition-all duration-300 hover:translate-x-1 hover:text-white/50">
                  <span className="text-white/20 transition-colors duration-300 group-hover:text-white/40">›</span>
                  At least 1 special character
                </li>
              </ul>
            </div>
          </main>

          <footer
            ref={footerRef}
            className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/50 px-8 py-4 backdrop-blur-md"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between font-mono text-xs text-white/30">
              <span>© 2026 AXIOM SYSTEMS</span>
              <span>MULTI-TENANT AI CONCIERGE</span>
            </div>
          </footer>
        </>
      )}

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.5;
          }
        }
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
        .hover-btn {
          position: relative;
          overflow: hidden;
        }
        .hover-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transition: left 0.5s ease;
        }
        .hover-btn:hover::before {
          left: 100%;
        }
        .hover-link {
          display: inline-block;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-link:hover {
          text-shadow: 0 0 10px rgba(255,255,255,0.5);
        }
        .hover-card {
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }
        .hover-card:hover {
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.05);
        }
        .toggle-btn {
          cursor: pointer;
        }
        .form-input:focus {
          box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
        }
        .hover-logo {
          animation: none;
        }
        .req-item:hover span {
          color: rgba(255,255,255,0.6);
        }
        .particle {
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .particle:hover {
          opacity: 0.8;
          transform: scale(1.5);
        }
        .accent-line {
          transition: width 0.5s ease, opacity 0.3s ease;
        }
        .accent-line:hover {
          width: 48;
          opacity: 0.4;
        }
        .main-card {
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
      `}</style>
    </div>
  );
}