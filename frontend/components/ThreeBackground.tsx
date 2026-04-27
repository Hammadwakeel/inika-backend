"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

export default function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 20);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create floating geometric shapes
    const geometries: THREE.Mesh[] = [];
    const gridLines: THREE.Line[] = [];

    // Wireframe cubes
    const cubeGeometries = [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
    ];

    for (let i = 0; i < 15; i++) {
      const geo = cubeGeometries[Math.floor(Math.random() * cubeGeometries.length)];
      const wireframe = new THREE.EdgesGeometry(geo);
      const material = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.08 + Math.random() * 0.07,
      });
      const cube = new THREE.LineSegments(wireframe, material);
      cube.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20 - 5
      );
      cube.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      cube.userData = {
        rotSpeed: {
          x: (Math.random() - 0.5) * 0.005,
          y: (Math.random() - 0.5) * 0.005,
          z: (Math.random() - 0.5) * 0.005,
        },
        floatSpeed: 0.3 + Math.random() * 0.5,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: cube.position.y,
      };
      scene.add(cube);
      geometries.push(cube as unknown as THREE.Mesh);
    }

    // Wireframe spheres
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 16, 16);
      const wireframe = new THREE.EdgesGeometry(geo);
      const material = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.05 + Math.random() * 0.05,
      });
      const sphere = new THREE.LineSegments(wireframe, material);
      sphere.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 15 - 8
      );
      sphere.userData = {
        rotSpeed: {
          x: (Math.random() - 0.5) * 0.003,
          y: (Math.random() - 0.5) * 0.003,
          z: 0,
        },
        floatSpeed: 0.2 + Math.random() * 0.3,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: sphere.position.y,
      };
      scene.add(sphere);
      geometries.push(sphere as unknown as THREE.Mesh);
    }

    // Grid floor
    const gridSize = 60;
    const gridDivisions = 40;
    const gridGeometry = new THREE.BufferGeometry();
    const gridVertices: number[] = [];

    for (let i = -gridSize / 2; i <= gridSize / 2; i += gridSize / gridDivisions) {
      gridVertices.push(i, -15, -20, i, -15, 20);
      gridVertices.push(-gridSize / 2, -15, i + 10, gridSize / 2, -15, i + 10);
    }

    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridVertices, 3));
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.04,
    });
    const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(grid);

    // Floating particles
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 60;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x000000,
      size: 0.05,
      transparent: true,
      opacity: 0.3,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Rotate and float geometries
      geometries.forEach((geo) => {
        geo.rotation.x += geo.userData.rotSpeed.x;
        geo.rotation.y += geo.userData.rotSpeed.y;
        geo.rotation.z += geo.userData.rotSpeed.z;
        geo.position.y = geo.userData.baseY + Math.sin(time * geo.userData.floatSpeed + geo.userData.floatOffset) * 0.5;
      });

      // Rotate particles
      particles.rotation.y += 0.0003;

      // Camera follows mouse slightly
      camera.position.x += (mouseRef.current.x * 3 - camera.position.x) * 0.02;
      camera.position.y += (-mouseRef.current.y * 2 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="three-bg"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}