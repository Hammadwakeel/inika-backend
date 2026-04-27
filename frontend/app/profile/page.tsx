"use client";

import { useEffect, useState, useRef } from "react";
import AppNav from "@/components/AppNav";
import { User, Mail, Building, Shield, Clock, LogOut, Database } from "lucide-react";
import gsap from "gsap";
import * as THREE from "three";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ProfilePage() {
  const [user, setUser] = useState<{ username: string; tenant_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [particles, setParticles] = useState<Array<{ left: string; top: string; delay: string; duration: string; size: string }>>([]);

  const headerRef = useRef<HTMLDivElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const securityCardRef = useRef<HTMLDivElement>(null);
  const dangerCardRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const username = localStorage.getItem("axiom_username") || "Unknown";
    const tenantId = localStorage.getItem("axiom_tenant_id") || "Unknown";
    setUser({ username, tenant_id: tenantId });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      setParticles(
        Array.from({ length: 30 }, () => ({
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          delay: `${Math.random() * 3}s`,
          duration: `${4 + Math.random() * 4}s`,
          size: `${1 + Math.random() * 2}px`,
        }))
      );
    }
  }, [loading]);

  // Three.js Background
  useEffect(() => {
    if (!loading && canvasRef.current) {
      const canvas = canvasRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Create particles
      const particleCount = 100;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = (Math.random() - 0.5) * 10;
        positions[i + 2] = (Math.random() - 0.5) * 10;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05,
        transparent: true,
        opacity: 0.6,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Create connecting lines
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(particleCount * 3);
      lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1,
      });
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lines);

      camera.position.z = 5;

      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        particles.rotation.x += 0.0005;
        particles.rotation.y += 0.0005;

        // Animate particles
        const posArray = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount * 3; i += 3) {
          posArray[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.001;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animationId);
        renderer.dispose();
      };
    }
  }, [loading]);

  // GSAP Entrance Animations
  useEffect(() => {
    if (!loading) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(headerRef.current, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });

      tl.fromTo(
        cardRefs.current.filter(Boolean),
        { y: 60, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.15 },
        "-=0.3"
      );

      tl.fromTo(footerRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, "-=0.2");

      // Hover effects for cards
      cardRefs.current.forEach((card, index) => {
        if (card) {
          card.addEventListener("mouseenter", () => {
            gsap.to(card, {
              y: -8,
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4), 0 0 30px rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.4)",
              duration: 0.3,
              ease: "power2.out",
            });
          });
          card.addEventListener("mouseleave", () => {
            gsap.to(card, {
              y: 0,
              boxShadow: "none",
              borderColor: index === 2 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)",
              duration: 0.3,
              ease: "power2.out",
            });
          });
        }
      });

      // Header icon pulse
      const headerIcon = headerRef.current?.querySelector(".header-icon") as HTMLElement | null;
      if (headerIcon) {
        gsap.to(headerIcon, {
          boxShadow: "0 0 30px rgba(255,255,255,0.3)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }
  }, [loading]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore errors
    }

    // Animate out
    const tl = gsap.timeline();
    tl.to(".logout-btn", { scale: 0.95, duration: 0.1 });
    tl.to("main", { opacity: 0, y: -20, duration: 0.3 });
    tl.call(() => {
      localStorage.removeItem("axiom_token");
      localStorage.removeItem("axiom_username");
      window.location.href = "/login";
    });
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin border-2 border-white border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Three.js Canvas Background */}
      <canvas ref={canvasRef} className="absolute inset-0 -z-10" />

      {/* Gradient Background Overlay */}
      <div
        ref={bgRef}
        className="absolute inset-0 -z-10 bg-gradient-to-br from-gray-900 via-black to-gray-900"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Particles */}
      <div className="particles absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={i}
            className="particle absolute rounded-full bg-white/20"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animation: `float ${p.duration} ease-in-out infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      <AppNav />

      <main className="relative mx-auto max-w-4xl px-8 py-12">
        <header ref={headerRef} className="mb-12 border-b border-white/10 pb-8">
          <div className="flex items-center gap-3">
            <div className="header-icon relative flex h-12 w-12 items-center justify-center border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm">
              <User className="h-5 w-5 text-white" />
              <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-white">PROFILE</h1>
              <p className="font-mono text-xs text-white/40">// operator account details</p>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {/* Profile Card */}
          <div
            ref={(el) => { cardRefs.current[0] = el; }}
            className="card-profile border border-white/20 bg-white/5 backdrop-blur-xl transition-all"
          >
            <div className="border-b border-white/10 bg-gradient-to-r from-gray-900/80 via-black/80 to-gray-900/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-white/70" />
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  Account Information
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-8 flex items-center gap-6">
                <div className="profile-avatar relative flex h-20 w-20 items-center justify-center border-2 border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm">
                  <span className="font-mono text-2xl font-bold text-white">
                    {user?.username?.[0]?.toUpperCase() || "?"}
                  </span>
                  <div className="absolute inset-0 animate-pulse rounded-full bg-white/5" />
                </div>
                <div>
                  <h3 className="font-mono text-xl font-bold text-white">{user?.username || "Unknown"}</h3>
                  <p className="font-mono text-sm text-white/40">Operator Account</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ProfileField icon={User} label="Username" value={user?.username || "Unknown"} />
                <ProfileField icon={Building} label="Tenant ID" value={user?.tenant_id || "Unknown"} />
                <ProfileField icon={Shield} label="Account Type" value="Operator" />
                <ProfileField icon={Clock} label="Session Status" value="Active" status="online" />
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div
            ref={(el) => { cardRefs.current[1] = el; }}
            className="card-security border border-white/20 bg-white/5 backdrop-blur-xl transition-all"
          >
            <div className="border-b border-white/10 bg-gradient-to-r from-gray-900/80 via-black/80 to-gray-900/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white/70" />
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-white">
                  Security
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="security-row flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/5 backdrop-blur-sm">
                      <Shield className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium text-white">Password</p>
                      <p className="font-mono text-xs text-white/40">Last changed: Never</p>
                    </div>
                  </div>
                  <button className="change-btn border border-white/20 px-4 py-2 font-mono text-xs font-medium text-white transition-all hover:bg-white/20 hover:border-white/40">
                    CHANGE
                  </button>
                </div>

                <div className="security-row flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/5 backdrop-blur-sm">
                      <Mail className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium text-white">Session Cookie</p>
                      <p className="font-mono text-xs text-white/40">HTTPOnly, Secure</p>
                    </div>
                  </div>
                  <span className="status-badge font-mono text-xs text-green-400">ENABLED</span>
                </div>

                <div className="security-row flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/5 backdrop-blur-sm">
                      <Database className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium text-white">Tenant ID</p>
                      <p className="font-mono text-xs text-white/40">Multi-tenant identifier</p>
                    </div>
                  </div>
                  <span className="status-badge font-mono text-xs text-blue-400">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div
            ref={(el) => { cardRefs.current[2] = el; }}
            className="card-danger border border-red-500/30 bg-red-500/5 backdrop-blur-xl transition-all"
          >
            <div className="border-b border-red-500/30 bg-gradient-to-r from-red-900/20 to-transparent px-6 py-4">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-red-400">
                Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-white">Sign Out</p>
                  <p className="font-mono text-xs text-white/40">End your current session</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="logout-btn flex items-center gap-2 border border-red-500/50 px-6 py-3 font-mono text-sm font-medium text-red-400 transition-all hover:bg-red-500 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  SIGN OUT
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer ref={footerRef} className="mt-16 border-t border-white/10 pt-8">
          <div className="flex items-center justify-between font-mono text-xs text-white/30">
            <span>PROFILE v1.0.0</span>
            <span>AXIOM_PLATFORM</span>
          </div>
        </footer>
      </main>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.6;
          }
        }
      `}</style>
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
    <div className="profile-field flex items-center gap-4 border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20">
      <div className="flex h-10 w-10 items-center justify-center border border-white/20 bg-white/5 backdrop-blur-sm">
        <Icon className="h-4 w-4 text-white/50" />
      </div>
      <div className="flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">{label}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium text-white">{value}</p>
          {status === "online" && (
            <span className="status-dot relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/50 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}