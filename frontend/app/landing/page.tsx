"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Activity, MessageSquare, Brain, MapPin, Calendar, Zap, Globe, CheckCircle, ArrowRight, ChevronDown, Star } from "lucide-react";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Three.js Futuristic Background
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create starfield background
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 3000;
    const starsPositions = new Float32Array(starsCount * 3);
    const starsSizes = new Float32Array(starsCount);

    for (let i = 0; i < starsCount * 3; i++) {
      starsPositions[i] = (Math.random() - 0.5) * 100;
    }
    for (let i = 0; i < starsCount; i++) {
      starsSizes[i] = Math.random() * 2;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));

    const starsMaterial = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const starsMesh = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starsMesh);

    // Create grid floor (futuristic)
    const gridHelper = new THREE.GridHelper(100, 50, 0xffffff, 0x888888);
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Create glowing particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 40;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.15,
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Create energy lines
    const linesGroup = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const points = [];
      const startX = (Math.random() - 0.5) * 30;
      const startY = (Math.random() - 0.5) * 20;
      const startZ = (Math.random() - 0.5) * 30;

      for (let j = 0; j < 20; j++) {
        points.push(new THREE.Vector3(
          startX + (Math.random() - 0.5) * 5,
          startY + (Math.random() - 0.5) * 5,
          startZ + j * 2
        ));
      }

      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      linesGroup.add(line);
    }
    scene.add(linesGroup);

    // Create geometric shapes (tech artifacts)
    const shapes: THREE.Mesh[] = [];
    const geometries = [
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.TetrahedronGeometry(0.3, 0),
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
    ];

    for (let i = 0; i < 30; i++) {
      const geometry = geometries[Math.floor(Math.random() * geometries.length)];
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25
      );
      mesh.userData = {
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.02,
          z: (Math.random() - 0.5) * 0.01,
        },
        floatSpeed: Math.random() * 0.5 + 0.5,
        floatOffset: Math.random() * Math.PI * 2,
      };
      shapes.push(mesh);
      scene.add(mesh);
    }

    camera.position.z = 15;

    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.01;

      starsMesh.rotation.y += 0.0001;
      starsMesh.rotation.x += 0.00005;

      particlesMesh.rotation.y += 0.0008;
      const positions = particlesMesh.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time + i) * 0.002;
      }
      particlesMesh.geometry.attributes.position.needsUpdate = true;

      shapes.forEach((shape) => {
        shape.rotation.x += shape.userData.rotationSpeed.x;
        shape.rotation.y += shape.userData.rotationSpeed.y;
        shape.rotation.z += shape.userData.rotationSpeed.z;

        const floatY = Math.sin(time * shape.userData.floatSpeed + shape.userData.floatOffset) * 0.5;
        const baseY = shape.position.y;
        shape.position.y = baseY + floatY * 0.1;
      });

      linesGroup.children.forEach((line, i) => {
        const l = line as THREE.Line;
        const mat = l.material as THREE.LineBasicMaterial;
        mat.opacity = 0.3 + Math.sin(time * 2 + i) * 0.2;
      });

      camera.position.x += (mouseX * 3 - camera.position.x) * 0.02;
      camera.position.y += (mouseY * 2 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      gridHelper.position.z = (gridHelper.position.z + 0.05) % 2;

      renderer.render(scene, camera);
    };
    animate();

    // GSAP Animations
    const tl = gsap.timeline();

    tl.from('header', { y: -100, opacity: 0, duration: 1, ease: 'power3.out' });
    tl.from('.hero-badge', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
    tl.from('.hero-title span', { y: 80, opacity: 0, duration: 1, stagger: 0.2, ease: 'power3.out' }, '-=0.4');
    tl.from('.hero-description', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4');
    tl.from('.hero-cta .btn-primary', { x: -50, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3');
    tl.from('.hero-cta .btn-secondary', { x: 50, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4');
    tl.from('.hero-terminal', { y: 60, opacity: 0, scale: 0.9, duration: 0.8, ease: 'power2.out' }, '-=0.5');

    gsap.from('.stat-item', {
      scrollTrigger: { trigger: statsRef.current, start: 'top 80%', toggleActions: 'play none none reverse' },
      y: 60, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out'
    });

    gsap.from('.feature-card', {
      scrollTrigger: { trigger: featuresRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
      y: 100, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out'
    });

    gsap.from('.step-number', {
      scrollTrigger: { trigger: '.steps-container', start: 'top 70%', toggleActions: 'play none none reverse' },
      scale: 0, rotation: -180, opacity: 0, duration: 1, stagger: 0.2, ease: 'back.out(1.7)'
    });

    gsap.from('.step-content', {
      scrollTrigger: { trigger: '.steps-container', start: 'top 70%', toggleActions: 'play none none reverse' },
      y: 50, opacity: 0, duration: 0.7, stagger: 0.15, ease: 'power2.out'
    });

    gsap.from('.testimonial-card', {
      scrollTrigger: { trigger: '.testimonials-container', start: 'top 70%', toggleActions: 'play none none reverse' },
      y: 80, opacity: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out'
    });

    gsap.from('.pricing-card', {
      scrollTrigger: { trigger: '.pricing-container', start: 'top 70%', toggleActions: 'play none none reverse' },
      y: 100, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out'
    });

    gsap.from('.faq-item', {
      scrollTrigger: { trigger: '.faq-container', start: 'top 70%', toggleActions: 'play none none reverse' },
      y: 40, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out'
    });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      ScrollTrigger.getAll().forEach(st => st.kill());
    };
  }, []);

  return (
    <div className="min-h-screen bg-black font-mono relative overflow-x-hidden text-white">
      {/* Futuristic Three.js Canvas Background */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" />

      {/* Overlay gradient for better content visibility */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none z-[1]" />

      {/* Scanline effect */}
      <div className="fixed inset-0 pointer-events-none z-[2] opacity-[0.02]"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)' }}
      />

      {/* Header */}
      <header className="border-b-2 border-white/30 relative z-20 backdrop-blur-md bg-black/60">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center border-2 border-white bg-black group hover:bg-white group-hover:text-black transition-all duration-300">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-wider text-white">AXIOM_AI</h1>
                <p className="text-[10px] text-white/50 tracking-widest">// guest engagement platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {mounted ? (
                <>
                  <Link href="/login" className="border-2 border-white px-6 py-2.5 text-xs font-bold tracking-wider text-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all duration-300">
                    SIGN_IN
                  </Link>
                  <Link href="/login?mode=signup" className="border-2 border-white bg-white px-6 py-2.5 text-xs font-bold tracking-wider text-black hover:bg-gray-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300">
                    GET_STARTED
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-28 bg-white/10" />
                  <Skeleton className="h-10 w-36 bg-white/10" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="border-b border-white/20 py-24 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              {mounted ? (
                <>
                  <div className="hero-badge mb-8 inline-block border border-white/50 bg-black px-6 py-3">
                    <span className="text-sm text-white font-bold tracking-widest">v1.0.0 // PUBLIC_BETA</span>
                  </div>
                  <h2 className="hero-title text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-none mb-8 text-white">
                    <span className="block">AUTOMATE</span>
                    <span className="block">GUEST</span>
                    <span className="block">ENGAGEMENT</span>
                  </h2>
                  <p className="text-base text-white/70 mb-10 max-w-lg leading-relaxed">
                    Transform hotel operations with intelligent automation.
                    From check-in to checkout, deliver personalized guest journeys at scale.
                  </p>
                  <div className="hero-cta flex items-center gap-6">
                    <Link href="/login?mode=signup" className="group flex items-center gap-3 border-2 border-white bg-white px-10 py-5 text-sm font-bold tracking-wider text-black hover:bg-gray-200 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-110 transition-all duration-300">
                      START_FREE
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-300" />
                    </Link>
                    <Link href="/login" className="flex items-center gap-3 border-2 border-white/50 px-10 py-5 text-sm font-bold tracking-wider text-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all duration-300">
                      VIEW_DEMO
                    </Link>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <Skeleton className="h-8 w-40 bg-white/10" />
                  <Skeleton className="h-24 w-full bg-white/10" />
                  <Skeleton className="h-6 w-full max-w-sm bg-white/10" />
                  <div className="flex gap-6">
                    <Skeleton className="h-14 w-36 bg-white/10" />
                    <Skeleton className="h-14 w-32 bg-white/10" />
                  </div>
                </div>
              )}
            </div>
            <div>
              {mounted ? (
                <div className="hero-terminal border-2 border-white/50 p-8 bg-black/60 backdrop-blur-md hover:border-white/80 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:-translate-y-1 transition-all duration-500 group">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      {['SYS', 'API', 'WA'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2 border border-white/50 px-4 py-3 group-hover:border-white group-hover:scale-105 group-hover:bg-white/10 transition-all duration-300">
                          <div className={`h-3 w-3 ${i === 2 ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></div>
                          <span className="text-xs font-bold text-white group-hover:text-white/90 transition-colors">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'WHATSAPP_HUB', value: 'CONNECTED', status: true },
                      { label: 'JOURNEY_ENGINE', value: 'ACTIVE', status: true },
                      { label: 'BOOKING_SYNC', value: 'SYNCED', status: true },
                      { label: 'KNOWLEDGE_RAG', value: 'READY', status: true },
                    ].map((item, idx) => (
                      <div key={item.label} className="flex items-center justify-between border border-white/30 px-5 py-4 hover:border-white/60 hover:bg-white/5 hover:translate-x-2 transition-all duration-300 group-hover:scale-[1.02]" style={{ transitionDelay: `${idx * 100}ms` }}>
                        <span className="text-sm font-bold text-white hover:tracking-wider transition-all duration-300">{item.label}</span>
                        <span className={`text-sm font-bold ${item.status ? 'text-green-400' : 'text-amber-400'}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <Skeleton className="h-96 w-full bg-white/10" />}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badge */}
      <section className="border-b border-white/20 bg-black/40 py-10 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          {mounted ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60 font-bold tracking-widest">TRUSTED BY 500+ HOSPITALITY BUSINESSES</span>
              <div className="flex items-center gap-12">
                {['MARRIOTT', 'HILTON', 'HYATT', 'SHERATON', 'FOUR SEASONS'].map((brand) => (
                  <span key={brand} className="text-xs text-white/40 tracking-[0.3em] hover:text-white transition-colors cursor-pointer">{brand}</span>
                ))}
              </div>
            </div>
          ) : <Skeleton className="h-6 w-full bg-white/10" />}
        </div>
      </section>

      {/* Stats */}
      <section ref={statsRef} className="border-b border-white/20 py-20 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {mounted ? (
              <>
                <div className="stat-item text-center group cursor-default hover:scale-105 transition-all duration-300"><div className="text-4xl md:text-5xl font-black mb-3 text-white group-hover:tracking-widest transition-all duration-300">99.9%</div><div className="text-[10px] uppercase tracking-[0.3em] text-white/50 group-hover:text-white/70 transition-colors">UPTIME</div></div>
                <div className="stat-item text-center group cursor-default hover:scale-105 transition-all duration-300"><div className="text-4xl md:text-5xl font-black mb-3 text-white group-hover:tracking-widest transition-all duration-300">10M+</div><div className="text-[10px] uppercase tracking-[0.3em] text-white/50 group-hover:text-white/70 transition-colors">MESSAGES_SENT</div></div>
                <div className="stat-item text-center group cursor-default hover:scale-105 transition-all duration-300"><div className="text-4xl md:text-5xl font-black mb-3 text-white group-hover:tracking-widest transition-all duration-300">50K+</div><div className="text-[10px] uppercase tracking-[0.3em] text-white/50 group-hover:text-white/70 transition-colors">GUESTS_REACHED</div></div>
                <div className="stat-item text-center group cursor-default hover:scale-105 transition-all duration-300"><div className="text-4xl md:text-5xl font-black mb-3 text-white group-hover:tracking-widest transition-all duration-300">&lt;2s</div><div className="text-[10px] uppercase tracking-[0.3em] text-white/50 group-hover:text-white/70 transition-colors">RESPONSE_TIME</div></div>
              </>
            ) : Array.from({ length: 4 }).map((_, i) => (<div key={i} className="text-center"><Skeleton className="mx-auto h-14 w-28 mb-4 bg-white/10" /><Skeleton className="mx-auto h-4 w-24 bg-white/10" /></div>))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="border-b border-white/20 py-24 bg-black/40 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-16 border-b border-white/20 pb-6">
            {mounted ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">// platform capabilities</h3>
            ) : (
              <Skeleton className="h-5 w-56 bg-white/10" />
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mounted ? (
              <>
                <div className="feature-card"><FeatureCard icon={MessageSquare} title="WHATSAPP_HUB" description="Connect multi-device WhatsApp, manage all conversations in one place, send automated replies." tag="COMMUNICATION" /></div>
                <div className="feature-card"><FeatureCard icon={MapPin} title="JOURNEY_ENGINE" description="Automate guest touchpoints from check-in to checkout with personalized messages." tag="AUTOMATION" /></div>
                <div className="feature-card"><FeatureCard icon={Calendar} title="BOOKING_SYNC" description="Real-time sync with Property Management Systems. Keep guest data always up to date." tag="INTEGRATION" /></div>
                <div className="feature-card"><FeatureCard icon={Brain} title="KNOWLEDGE_RAG" description="Upload documents, build FAISS index, configure AI persona for contextual responses." tag="AI" /></div>
                <div className="feature-card"><FeatureCard icon={Zap} title="PROACTIVE_ENGINE" description="AI-powered suggestions and automated triggers based on guest behavior." tag="INTELLIGENCE" /></div>
                <div className="feature-card"><FeatureCard icon={Globe} title="MULTI_TENANT" description="Manage multiple properties from single dashboard with isolated data." tag="MANAGEMENT" /></div>
              </>
            ) : Array.from({ length: 6 }).map((_, i) => (<SkeletonCard key={i} className="bg-black border-white/20"><Skeleton className="h-10 w-10 mb-6 bg-white/10" /><Skeleton className="h-6 w-36 mb-4 bg-white/10" /><Skeleton className="h-4 w-full mb-2 bg-white/10" /><Skeleton className="h-4 w-3/4 bg-white/10" /></SkeletonCard>))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-white/20 py-24 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-16 border-b border-white/20 pb-6">
            {mounted ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">// how it works</h3>
            ) : (
              <Skeleton className="h-5 w-40 bg-white/10" />
            )}
          </div>

          <div className="steps-container grid md:grid-cols-3 gap-16">
            {mounted ? (
              <>
                <HowItWorksStep number="01" title="CONNECT" description="Link your WhatsApp Business account and sync your booking system in minutes." />
                <HowItWorksStep number="02" title="CONFIGURE" description="Set up your AI persona, message templates, and automation rules." />
                <HowItWorksStep number="03" title="AUTOMATE" description="Let AI handle guest communications while you focus on what matters." />
              </>
            ) : Array.from({ length: 3 }).map((_, i) => (<div key={i}><Skeleton className="h-20 w-24 mb-6 bg-white/10" /><Skeleton className="h-6 w-24 mb-4 bg-white/10" /><Skeleton className="h-4 w-full mb-2 bg-white/10" /><Skeleton className="h-4 w-3/4 bg-white/10" /></div>))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-container border-b border-white/20 bg-black/60 py-24 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-16 border-b border-white/20 pb-6">
            {mounted ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/50">// testimonials</h3>
            ) : (
              <Skeleton className="h-5 w-32 bg-white/10" />
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {mounted ? (
              <>
                <div className="testimonial-card"><TestimonialCard quote="Axiom has transformed how we handle guest communications. Response times down 80%." author="Sarah Chen" role="GM, Grand Plaza Hotel" /></div>
                <div className="testimonial-card"><TestimonialCard quote="The journey automation is incredible. Guests love the personalized touch, saves 15 hours/week." author="Michael Torres" role="Operations, Beach Resort" /></div>
                <div className="testimonial-card"><TestimonialCard quote="Best investment this year. Setup was quick, support is amazing, ROI within weeks." author="Emma Wilson" role="Guest Relations, City Inn" /></div>
              </>
            ) : Array.from({ length: 3 }).map((_, i) => (<div key={i} className="border border-white/20 bg-black/50 p-8"><Skeleton className="h-4 w-full mb-6 bg-white/10" /><Skeleton className="h-4 w-3/4 mb-6 bg-white/10" /><Skeleton className="h-4 w-28 mb-2 bg-white/10" /><Skeleton className="h-3 w-36 bg-white/10" /></div>))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing-container border-b border-white/20 py-24 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="mb-16 border-b border-white/20 pb-6">
            {mounted ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">// pricing</h3>
            ) : (
              <Skeleton className="h-5 w-20 bg-white/10" />
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {mounted ? (
              <>
                <div className="pricing-card"><PricingCard name="STARTER" price="$0" description="Perfect for small properties" features={["WhatsApp Hub", "Basic Journey", "100 guests/mo", "Email Support"]} cta="GET_STARTED" highlighted={false} /></div>
                <div className="pricing-card"><PricingCard name="PROFESSIONAL" price="$79" description="For growing hotels" features={["Everything in Starter", "Advanced Journey", "Unlimited guests", "Knowledge RAG", "Priority Support"]} cta="START_TRIAL" highlighted={true} /></div>
                <div className="pricing-card"><PricingCard name="ENTERPRISE" price="CUSTOM" description="For large chains" features={["Everything in Pro", "Multi-property", "Dedicated Manager", "Custom SLA", "On-premise"]} cta="CONTACT" highlighted={false} /></div>
              </>
            ) : Array.from({ length: 3 }).map((_, i) => (<SkeletonCard key={i} className="bg-black border-white/20"><Skeleton className="h-6 w-28 mb-4 bg-white/10" /><Skeleton className="h-14 w-24 mb-4 bg-white/10" /><Skeleton className="h-4 w-36 mb-6 bg-white/10" /><div className="space-y-3">{Array.from({ length: 4 }).map((_, j) => (<Skeleton key={j} className="h-5 w-full bg-white/10" />))}</div></SkeletonCard>))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-container border-b border-white/20 py-24 bg-black/50 relative z-10">
        <div className="mx-auto max-w-3xl px-8">
          <div className="mb-16 border-b border-white/20 pb-6">
            {mounted ? (
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">// faq</h3>
            ) : (
              <Skeleton className="h-5 w-16 bg-white/10" />
            )}
          </div>

          <div className="space-y-5">
            {mounted ? (
              <>
                <FAQItem question="How long does it take to set up?" answer="Most properties are up and running within 15 minutes. Our onboarding wizard guides you through each step." />
                <FAQItem question="Do I need technical knowledge?" answer="Not at all! Axiom is designed for hospitality professionals, not developers." />
                <FAQItem question="Is my guest data secure?" answer="Absolutely. We use bank-level encryption, are GDPR compliant, and offer data isolation per tenant." />
                <FAQItem question="Can I integrate with my existing PMS?" answer="Yes! We support integrations with major Property Management Systems including Opera, Cloudbeds, and Mews." />
                <FAQItem question="What happens after the free trial?" answer="You can continue with a paid plan or downgrade to free. No credit card required, cancel anytime." />
              </>
            ) : Array.from({ length: 5 }).map((_, i) => (<SkeletonCard key={i} className="bg-black/50 border-white/20 p-5"><Skeleton className="h-6 w-full mb-3 bg-white/10" /><Skeleton className="h-4 w-3/4 bg-white/10" /></SkeletonCard>))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section border-b border-white/20 py-24 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5"></div>
        <div className="mx-auto max-w-7xl px-8 text-center relative">
          {mounted ? (
            <>
              <h3 className="cta-title text-4xl md:text-5xl font-black tracking-tight mb-6 text-white group-hover:tracking-wider transition-all duration-500">READY TO AUTOMATE?</h3>
              <p className="text-sm text-white/50 mb-10 max-w-lg mx-auto group-hover:text-white/70 transition-colors">Join thousands of hospitality businesses already using Axiom AI to delight their guests.</p>
              <Link href="/login?mode=signup" className="group inline-flex items-center gap-3 border-2 border-white bg-white px-14 py-6 text-sm font-black tracking-wider text-black hover:bg-gray-200 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:scale-110 transition-all duration-300">
                GET_STARTED_NOW
                <ArrowRight className="h-5 w-5 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-300" />
              </Link>
            </>
          ) : <div className="space-y-6"><Skeleton className="mx-auto h-16 w-80 bg-white/10" /><Skeleton className="mx-auto h-6 w-96 bg-white/10" /><Skeleton className="mx-auto h-16 w-52 bg-white/10" /></div>}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/30 py-12 relative z-10">
        <div className="mx-auto max-w-7xl px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <Activity className="h-6 w-6 text-white" />
              <span className="text-lg font-bold text-white tracking-wider">AXIOM_AI</span>
            </div>
            {mounted ? (
              <div className="flex items-center gap-10 text-sm">
                <a href="#" className="text-white/50 hover:text-white transition-colors tracking-wider hover:tracking-widest">FEATURES</a>
                <a href="#" className="text-white/50 hover:text-white transition-colors tracking-wider hover:tracking-widest">PRICING</a>
                <a href="#" className="text-white/50 hover:text-white transition-colors tracking-wider hover:tracking-widest">ABOUT</a>
                <a href="#" className="text-white/50 hover:text-white transition-colors tracking-wider hover:tracking-widest">CONTACT</a>
              </div>
            ) : <div className="flex gap-10">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-5 w-20 bg-white/10" />))}</div>}
            <span className="text-xs text-white/40 tracking-wider">© 2026 // ALL RIGHTS RESERVED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, tag }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; tag: string }) {
  return (
    <div className="feature-card border border-white/20 bg-black/60 p-8 hover:border-white/60 hover:bg-white/5 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:-translate-y-1 transition-all duration-500 group">
      <div className="flex items-center justify-between mb-6">
        <div className="flex h-12 w-12 items-center justify-center border border-white/50 group-hover:border-white group-hover:bg-white/10 transition-all duration-300">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 group-hover:text-white/70 transition-colors">{tag}</span>
      </div>
      <h3 className="text-base font-bold uppercase tracking-wider mb-3 text-white group-hover:tracking-widest transition-all duration-300">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">{description}</p>
    </div>
  );
}

function HowItWorksStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="relative group">
      <div className="step-number text-6xl md:text-8xl font-black text-white/20 mb-6 group-hover:text-white/40 group-hover:scale-110 transition-all duration-500">{number}</div>
      <div className="step-content">
        <h3 className="text-xl font-bold uppercase tracking-wider mb-3 text-white group-hover:text-white transition-colors">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/70 transition-colors">{description}</p>
      </div>
      <div className="absolute -bottom-8 left-0 w-full h-px bg-gradient-to-r from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string; author: string; role: string }) {
  return (
    <div className="testimonial-card border border-white/20 bg-black/60 p-8 hover:border-white/50 hover:bg-white/5 hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:-translate-y-2 transition-all duration-500 group">
      <div className="mb-5 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (<Star key={i} className="h-5 w-5 fill-white text-white group-hover:scale-110 group-hover:translate-y-0.5 transition-all duration-300" style={{ transitionDelay: `${i * 0.05}s` }} />))}
      </div>
      <p className="text-sm text-white/70 mb-6 leading-relaxed group-hover:text-white/90 transition-colors">"{quote}"</p>
      <div><div className="text-sm font-bold text-white group-hover:translate-x-2 transition-all duration-300">{author}</div><div className="text-xs text-white/50 group-hover:text-white/70 transition-colors">{role}</div></div>
    </div>
  );
}

function PricingCard({ name, price, description, features, cta, highlighted }: { name: string; price: string; description: string; features: string[]; cta: string; highlighted: boolean }) {
  return (
    <div className={`pricing-card border-2 ${highlighted ? 'border-white bg-white/10' : 'border-white/30 bg-black/60'} p-8 flex flex-col hover:border-white hover:shadow-[0_0_50px_rgba(255,255,255,0.15)] hover:-translate-y-2 transition-all duration-500 group`}>
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-3 text-white group-hover:tracking-widest transition-all duration-300">{name}</h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-4xl font-black text-white group-hover:scale-110 transition-all duration-300 ${highlighted ? '' : ''}`}>{price}</span>
          {price !== "CUSTOM" && <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">/mo</span>}
        </div>
        <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors">{description}</p>
      </div>
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm group-hover:translate-x-2 transition-all duration-300" style={{ transitionDelay: `${i * 50}ms` }}>
            <CheckCircle className="h-5 w-5 text-white/70 group-hover:text-white group-hover:scale-110 transition-all" />
            <span className="text-white/70 group-hover:text-white transition-colors">{feature}</span>
          </li>
        ))}
      </ul>
      <Link href={name === "ENTERPRISE" ? "/contact" : "/login?mode=signup"} className={`text-center py-4 text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] ${highlighted ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white hover:bg-white hover:text-black'}`}>{cta}</Link>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item border border-white/30 hover:border-white/60 hover:bg-white/5 transition-all duration-300 group cursor-pointer" onClick={() => setOpen(!open)}>
      <div className="w-full flex items-center justify-between p-5">
        <span className="text-sm font-bold text-white group-hover:text-white/90 transition-colors">{question}</span>
        <ChevronDown className={`h-5 w-5 text-white/50 group-hover:text-white group-hover:rotate-180 transition-all duration-300 ${open ? 'rotate-180 text-white' : ''}`} />
      </div>
      {open && <div className="px-5 pb-5 animate-fade-in"><p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">{answer}</p></div>}
    </div>
  );
}