import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../lib/i18n";

import FileUpload from "../components/muhakkim/FileUpload";
import Proofreader from "../components/muhakkim/Proofreader";
import QRGenerator from "../components/muhakkim/QRGenerator";
import ReviewReport from "../components/muhakkim/ReviewReport";
import About from "../components/muhakkim/About";
import DiscussionPanel from "../components/muhakkim/DiscussionPanel";
import AIDetector from "../components/muhakkim/AIDetector";
import CitationPlagiarism from "../components/muhakkim/CitationPlagiarism";
import DataHub from "../components/muhakkim/DataHub";
import ServicesPortal from "../components/muhakkim/ServicesPortal";

// ─────────────────────────────────────────────────────────────────────────────
// 3D Wireframe Sphere (canvas)
// ─────────────────────────────────────────────────────────────────────────────
function Orb3D({ size = 140 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.width = size * 2; canvas.height = size * 2;
    const ctx = canvas.getContext("2d")!;
    const cx = size, cy = size, R = size * 0.82;

    // Build icosphere vertices
    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVerts: [number,number,number][] = [
      [-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],
      [0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],
      [phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1],
    ];
    const norm = Math.sqrt(1 + phi*phi);
    const verts = rawVerts.map(([x,y,z]) => [x/norm, y/norm, z/norm] as [number,number,number]);

    const edges: [number,number][] = [
      [0,1],[0,5],[0,7],[0,10],[0,11],
      [1,5],[1,7],[1,8],[1,9],
      [2,3],[2,4],[2,6],[2,10],[2,11],
      [3,4],[3,6],[3,8],[3,9],
      [4,5],[4,9],[4,11],
      [5,9],[5,11],
      [6,7],[6,8],[6,10],
      [7,8],[7,10],
      [8,9],[10,11],
    ];

    // Extra latitude rings
    const rings: [number,number,number][][] = [];
    for (let lat = -75; lat <= 75; lat += 30) {
      const ring: [number,number,number][] = [];
      for (let lon = 0; lon < 360; lon += 12) {
        const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
        ring.push([Math.cos(a)*Math.cos(b), Math.sin(a), Math.cos(a)*Math.sin(b)]);
      }
      rings.push(ring);
    }

    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, size*2, size*2);
      t += 0.006;
      const sinT = Math.sin(t), cosT = Math.cos(t);
      const sinP = Math.sin(0.3), cosP = Math.cos(0.3);

      const project = ([x,y,z]: [number,number,number]) => {
        // Y-rotation
        const x1 = x*cosT - z*sinT, z1 = x*sinT + z*cosT;
        // X-tilt
        const y2 = y*cosP - z1*sinP, z2 = y*sinP + z1*cosP;
        const fov = 3.5; const scale = R * fov / (fov + z2);
        return { px: cx + x1*scale, py: cy + y2*scale, depth: z2 };
      };

      // Draw icosahedron edges
      edges.forEach(([a,b]) => {
        const A = project(verts[a]), B = project(verts[b]);
        const alpha = 0.18 + 0.22 * ((A.depth + B.depth) / 2 + 1);
        ctx.beginPath();
        ctx.moveTo(A.px, A.py);
        ctx.lineTo(B.px, B.py);
        ctx.strokeStyle = `rgba(201,168,76,${Math.max(0.05, alpha)})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });

      // Draw latitude rings
      rings.forEach(ring => {
        const pts = ring.map(v => project(v));
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
        ctx.closePath();
        ctx.strokeStyle = "rgba(201,168,76,0.09)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });

      // Vertex dots
      verts.forEach(v => {
        const { px, py, depth } = project(v);
        const alpha = 0.4 + 0.55 * ((depth + 1) / 2);
        const r = 1.5 + ((depth + 1) / 2) * 2;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(245,215,142,${alpha})`);
        g.addColorStop(1, `rgba(201,168,76,0)`);
        ctx.fillStyle = g;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, opacity: 0.9 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Particle Field with Z-depth
// ─────────────────────────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const isMobile = window.innerWidth < 640;
    const count = isMobile ? 30 : 65;

    const pts = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(),
      z: Math.random(),                          // depth 0..1
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
    }));

    // colour palette: gold + blue-white
    const colors = ["201,168,76", "245,215,142", "147,197,253", "196,181,253"];
    const cvs = canvas;

    function draw() {
      const W = cvs.width, H = cvs.height;
      ctx.clearRect(0, 0, W, H);

      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      });

      // connections
      pts.forEach((a, i) => {
        for (let j = i+1; j < pts.length; j++) {
          const b = pts[j];
          const dx = (a.x - b.x)*W, dy = (a.y - b.y)*H;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const maxD = isMobile ? 80 : 120;
          if (dist < maxD) {
            const alpha = 0.12 * (1 - dist/maxD) * ((a.z + b.z)/2 + 0.2);
            ctx.beginPath();
            ctx.moveTo(a.x*W, a.y*H);
            ctx.lineTo(b.x*W, b.y*H);
            ctx.strokeStyle = `rgba(201,168,76,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      });

      // dots
      pts.forEach((p, i) => {
        const px = p.x * W, py = p.y * H;
        const r  = 0.5 + p.z * 2.2;
        const alpha = 0.15 + p.z * 0.6;
        const col = colors[i % colors.length];
        const g = ctx.createRadialGradient(px, py, 0, px, py, r*2);
        g.addColorStop(0, `rgba(${col},${alpha})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
const TABS_AR = [
  { key:"upload",     icon:"📂", label:"رفع الملف",          shortLabel:"رفع" },
  { key:"proofread",  icon:"📝", label:"التدقيق اللغوي",      shortLabel:"تدقيق" },
  { key:"datalab",    icon:"🔬", label:"مختبر البيانات",       shortLabel:"بيانات" },
  { key:"aidetect",   icon:"🛡️", label:"كشف AI",              shortLabel:"كشف AI" },
  { key:"citation",   icon:"📖", label:"اقتباس وانتحال",      shortLabel:"اقتباس" },
  { key:"qr",         icon:"📷", label:"مولّد QR",            shortLabel:"QR" },
  { key:"report",     icon:"📋", label:"تقرير التحكيم",       shortLabel:"تقرير" },
  { key:"discussion", icon:"💬", label:"لوحة المناقشة",       shortLabel:"مناقشة" },
  { key:"about",      icon:"ℹ️",  label:"عن البرنامج",         shortLabel:"عن" },
  { key:"services",   icon:"🏢", label:"خدماتنا الإحصائية",   shortLabel:"خدمات" },
];
const TABS_EN = [
  { key:"upload",     icon:"📂", label:"File Upload",    shortLabel:"Upload" },
  { key:"proofread",  icon:"📝", label:"Proofreader",    shortLabel:"Proof" },
  { key:"datalab",    icon:"🔬", label:"Data Lab",        shortLabel:"DataLab" },
  { key:"aidetect",   icon:"🛡️", label:"AI Detector",    shortLabel:"AI Det." },
  { key:"citation",   icon:"📖", label:"Citation & Plagiarism", shortLabel:"Cite" },
  { key:"qr",         icon:"📷", label:"QR Code",        shortLabel:"QR" },
  { key:"report",     icon:"📋", label:"Review Report",  shortLabel:"Report" },
  { key:"discussion", icon:"💬", label:"Discussion",     shortLabel:"Chat" },
  { key:"about",      icon:"ℹ️",  label:"About",          shortLabel:"About" },
  { key:"services",   icon:"🏢", label:"Our Services",   shortLabel:"Services" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo]   = useState<{ name: string; size: string } | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const tabs = lang === "ar" ? TABS_AR : TABS_EN;
  const isAr = lang === "ar";

  return (
    <div className="mhk-root" dir={isAr ? "rtl" : "ltr"}>
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mhk-root {
          font-family: 'Tajawal','Inter','Segoe UI',sans-serif;
          background: linear-gradient(145deg,#05091a 0%,#080f22 40%,#060c1c 100%);
          min-height: 100vh;
          color: #e2e8f0;
          overflow-x: hidden;
        }

        /* ═══ AMBIENT GLOW ORBS ═══ */
        .mhk-orbs {
          position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
        }
        .mhk-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.18;
          animation: mhk-drift 18s ease-in-out infinite alternate;
        }
        .mhk-orb-1 {
          width: 380px; height: 380px;
          background: radial-gradient(circle,#C9A84C,transparent 70%);
          top: -120px; right: 5%;
          animation-duration: 14s;
        }
        .mhk-orb-2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle,#3b82f6,transparent 70%);
          bottom: -80px; left: 8%;
          animation-duration: 20s; animation-delay: -7s;
        }
        .mhk-orb-3 {
          width: 220px; height: 220px;
          background: radial-gradient(circle,#a855f7,transparent 70%);
          top: 40%; left: 45%;
          animation-duration: 24s; animation-delay: -12s;
        }
        @keyframes mhk-drift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(40px,30px) scale(1.15); }
        }

        /* ═══ 3D FLOATING SHAPES ═══ */
        .mhk-shapes { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }

        /* rotating cube */
        .mhk-cube-wrap {
          position: absolute; top: 18%; right: 3%;
          width: 60px; height: 60px;
          perspective: 400px;
          animation: mhk-float1 7s ease-in-out infinite;
        }
        .mhk-cube {
          width: 100%; height: 100%;
          transform-style: preserve-3d;
          animation: mhk-spin-cube 9s linear infinite;
        }
        .mhk-face {
          position: absolute; width: 60px; height: 60px;
          border: 1.5px solid rgba(201,168,76,0.35);
          background: rgba(201,168,76,0.04);
          backdrop-filter: blur(2px);
        }
        .mhk-f-front  { transform: translateZ(30px); }
        .mhk-f-back   { transform: rotateY(180deg) translateZ(30px); }
        .mhk-f-left   { transform: rotateY(-90deg) translateZ(30px); }
        .mhk-f-right  { transform: rotateY(90deg)  translateZ(30px); }
        .mhk-f-top    { transform: rotateX(90deg)  translateZ(30px); }
        .mhk-f-bottom { transform: rotateX(-90deg) translateZ(30px); }

        @keyframes mhk-spin-cube {
          from { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
          to   { transform: rotateX(360deg) rotateY(240deg) rotateZ(120deg); }
        }
        @keyframes mhk-float1 {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-18px); }
        }

        /* diamond */
        .mhk-diamond-wrap {
          position: absolute; top: 55%; left: 2.5%;
          animation: mhk-float2 9s ease-in-out infinite;
        }
        .mhk-diamond {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, rgba(147,197,253,0.2), rgba(147,197,253,0.05));
          border: 1.5px solid rgba(147,197,253,0.4);
          transform: rotate(45deg);
          animation: mhk-spin-d 12s linear infinite;
          box-shadow: 0 0 18px rgba(147,197,253,0.15) inset;
        }
        @keyframes mhk-spin-d {
          from { transform: rotate(45deg); }
          to   { transform: rotate(405deg); }
        }
        @keyframes mhk-float2 {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(16px); }
        }

        /* triangle */
        .mhk-tri-wrap {
          position: absolute; bottom: 12%; right: 6%;
          animation: mhk-float3 11s ease-in-out infinite;
        }
        .mhk-tri {
          width: 0; height: 0;
          border-left: 28px solid transparent;
          border-right: 28px solid transparent;
          border-bottom: 48px solid rgba(168,85,247,0.22);
          filter: drop-shadow(0 0 8px rgba(168,85,247,0.4));
          animation: mhk-spin-t 16s linear infinite;
        }
        @keyframes mhk-spin-t {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes mhk-float3 {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-22px); }
        }

        /* ring */
        .mhk-ring-wrap {
          position: absolute; top: 25%; left: 5%;
          animation: mhk-float4 13s ease-in-out infinite;
        }
        .mhk-ring {
          width: 52px; height: 52px;
          border-radius: 50%;
          border: 2px solid rgba(201,168,76,0.3);
          box-shadow: 0 0 12px rgba(201,168,76,0.2), inset 0 0 12px rgba(201,168,76,0.05);
          animation: mhk-spin-r 20s linear infinite;
        }
        .mhk-ring::before {
          content: '';
          position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px;
          border-radius: 50%;
          border: 1px solid rgba(201,168,76,0.15);
        }
        @keyframes mhk-spin-r {
          from { transform: rotateX(70deg) rotateZ(0deg); }
          to   { transform: rotateX(70deg) rotateZ(360deg); }
        }
        @keyframes mhk-float4 {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(14px); }
        }

        /* ═══ HERO ═══ */
        .mhk-hero {
          position: relative; overflow: hidden;
          border-bottom: 1px solid rgba(201,168,76,0.12);
          padding: 38px 48px 36px;
          background: linear-gradient(180deg,rgba(15,27,45,0.7) 0%,transparent 100%);
        }
        .mhk-hero-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; position: relative; z-index: 2; flex-wrap: wrap;
        }
        .mhk-logo-row {
          display: flex; align-items: center; gap: 20px; flex: 1; min-width: 0;
        }
        .mhk-orb-wrap {
          flex-shrink: 0;
          filter: drop-shadow(0 0 18px rgba(201,168,76,0.35));
        }
        .mhk-logo-text { min-width: 0; }
        .mhk-hero-title {
          font-size: clamp(28px,5vw,46px); font-weight: 900;
          background: linear-gradient(120deg,#C9A84C 0%,#f5d78e 40%,#fbbf24 65%,#C9A84C 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: mhk-shimmer 4s linear infinite;
          line-height: 1.1;
        }
        @keyframes mhk-shimmer {
          from { background-position: 0% center; }
          to   { background-position: 200% center; }
        }
        .mhk-hero-sub {
          color: #64748b; font-size: clamp(11px,1.4vw,13px);
          margin-top: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mhk-tags {
          display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
        }
        .mhk-tag {
          border-radius: 20px; padding: 5px 13px;
          font-size: 11px; font-weight: 700; font-family: inherit; white-space: nowrap;
          transition: all .2s;
        }
        .mhk-tag-gold {
          background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3);
          color: #C9A84C;
          box-shadow: 0 0 10px rgba(201,168,76,0.1);
        }
        .mhk-tag-blue {
          background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd;
        }
        .mhk-tag-purple {
          background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3);
          color: #c4b5fd;
        }
        .mhk-tag-teal {
          background: rgba(20,184,166,0.1); border: 1px solid rgba(20,184,166,0.3);
          color: #5eead4;
        }
        .mhk-tag:hover { transform: translateY(-2px) scale(1.05); }
        .mhk-lang-btn {
          background: linear-gradient(135deg,rgba(201,168,76,0.15),rgba(245,215,142,0.06));
          border: 1px solid rgba(201,168,76,0.4);
          color: #C9A84C; border-radius: 12px;
          padding: 10px 24px; font-weight: 800; font-size: 14px;
          cursor: pointer; font-family: inherit; flex-shrink: 0;
          transition: all .25s;
          box-shadow: 0 0 20px rgba(201,168,76,0.1);
        }
        .mhk-lang-btn:hover {
          background: rgba(201,168,76,0.22);
          box-shadow: 0 0 28px rgba(201,168,76,0.25);
          transform: translateY(-1px);
        }

        /* ═══ CONTAINER ═══ */
        .mhk-container {
          max-width: 1100px; margin: 0 auto; padding: 0 24px 64px;
        }

        /* ═══ TAB BAR ═══ */
        .mhk-tabbar {
          display: flex; gap: 4px; margin-top: 22px;
          background: rgba(4,9,24,0.8);
          border-radius: 16px; padding: 6px;
          border: 1px solid rgba(255,255,255,0.06);
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .mhk-tabbar::-webkit-scrollbar { display: none; }
        .mhk-tab {
          background: transparent; border: 1px solid transparent;
          border-radius: 11px; padding: 9px 15px;
          color: #475569; font-weight: 500; font-size: 12px;
          cursor: pointer; transition: all .2s; font-family: inherit;
          display: flex; align-items: center; gap: 6px;
          white-space: nowrap; flex-shrink: 0;
        }
        .mhk-tab:hover { color: #C9A84C; background: rgba(201,168,76,0.06); }
        .mhk-tab.active {
          background: linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.08));
          border-color: rgba(201,168,76,0.4);
          color: #f5d78e; font-weight: 700;
          box-shadow: 0 2px 16px rgba(201,168,76,0.15), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .mhk-tab-label-short { display: none; }
        .mhk-tab-label-full  { display: inline; }

        /* ═══ CONTENT CARD ═══ */
        .mhk-content {
          margin-top: 16px;
          background: linear-gradient(145deg,rgba(13,23,45,0.85),rgba(8,14,32,0.9));
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.08);
          border-top: 1px solid rgba(201,168,76,0.15);
          border-radius: 22px; overflow: hidden;
          box-shadow: 0 8px 48px rgba(0,0,0,0.5), 0 1px 0 rgba(201,168,76,0.1) inset;
          transition: box-shadow .3s;
        }
        .mhk-inner { padding: 30px; }

        /* ═══ ANIMATION ═══ */
        @keyframes mhk-fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .mhk-fade { animation: mhk-fadeUp .4s cubic-bezier(.22,.68,0,1.2) both; }

        /* ═══ SCROLLBAR ═══ */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #050912; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.35); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(201,168,76,0.55); }

        /* ═══ TABLET ≤ 900px ═══ */
        @media (max-width:900px) {
          .mhk-hero { padding: 28px 28px 24px; }
          .mhk-tab-label-full  { display: none; }
          .mhk-tab-label-short { display: inline; }
          .mhk-tab { padding: 9px 12px; font-size: 11px; }
          .mhk-orb-wrap canvas { width: 100px !important; height: 100px !important; }
        }

        /* ═══ MOBILE ≤ 600px ═══ */
        @media (max-width:600px) {
          .mhk-hero { padding: 20px 16px 18px; }
          .mhk-hero-inner { flex-direction: column; align-items: flex-start; gap: 14px; }
          .mhk-logo-row { gap: 14px; }
          .mhk-hero-sub { white-space: normal; }
          .mhk-lang-btn { align-self: flex-end; }
          .mhk-orb-wrap canvas { width: 72px !important; height: 72px !important; }
          .mhk-orb-wrap { display: none; }
          .mhk-container { padding: 0 12px 48px; }
          .mhk-tabbar { border-radius: 12px; padding: 5px; margin-top: 14px; }
          .mhk-tab { padding: 8px 10px; font-size: 10px; gap: 4px; }
          .mhk-content { border-radius: 16px; margin-top: 12px; }
          .mhk-inner { padding: 16px; }
          .mhk-shapes .mhk-cube-wrap { display: none; }
          .mhk-shapes .mhk-ring-wrap { display: none; }
          .mhk-tag { font-size: 10px; padding: 4px 10px; }
        }
        @media (max-width:380px) {
          .mhk-tab-icon { display: none; }
          .mhk-tab { padding: 8px 9px; }
        }
      `}</style>

      {/* ── Hero Section ── */}
      <header className="mhk-hero">

        {/* Ambient orbs (blur blobs) */}
        <div className="mhk-orbs">
          <div className="mhk-orb mhk-orb-1" />
          <div className="mhk-orb mhk-orb-2" />
          <div className="mhk-orb mhk-orb-3" />
        </div>

        {/* 3D floating geometric shapes */}
        <div className="mhk-shapes" aria-hidden>
          <div className="mhk-cube-wrap">
            <div className="mhk-cube">
              <div className="mhk-face mhk-f-front"  />
              <div className="mhk-face mhk-f-back"   />
              <div className="mhk-face mhk-f-left"   />
              <div className="mhk-face mhk-f-right"  />
              <div className="mhk-face mhk-f-top"    />
              <div className="mhk-face mhk-f-bottom" />
            </div>
          </div>
          <div className="mhk-diamond-wrap"><div className="mhk-diamond" /></div>
          <div className="mhk-tri-wrap"><div className="mhk-tri" /></div>
          <div className="mhk-ring-wrap"><div className="mhk-ring" /></div>
        </div>

        {/* Particle network */}
        <ParticleField />

        {/* Hero content */}
        <div className="mhk-hero-inner">
          <div className="mhk-logo-row">

            {/* 3D sphere orb */}
            <div className="mhk-orb-wrap">
              <Orb3D size={120} />
            </div>

            <div className="mhk-logo-text">
              <h1 className="mhk-hero-title">محكّم</h1>
              <p className="mhk-hero-sub">
                {isAr
                  ? "منصة التدقيق الأكاديمي الذكي · Muhakkim Al Proofreader"
                  : "Academic Peer Review Platform · منصة التحكيم الأكاديمي"}
              </p>
              <div className="mhk-tags">
                {isAr ? (
                  <>
                    <span className="mhk-tag mhk-tag-gold">تحليل لغوي</span>
                    <span className="mhk-tag mhk-tag-blue">بنية أكاديمية</span>
                    <span className="mhk-tag mhk-tag-purple">تقرير مفصّل</span>
                    <span className="mhk-tag mhk-tag-teal">ثنائي اللغة</span>
                  </>
                ) : (
                  <>
                    <span className="mhk-tag mhk-tag-gold">Language Analysis</span>
                    <span className="mhk-tag mhk-tag-blue">Academic Structure</span>
                    <span className="mhk-tag mhk-tag-purple">Detailed Report</span>
                    <span className="mhk-tag mhk-tag-teal">Bilingual</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button className="mhk-lang-btn" onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            data-testid="button-toggle-lang">
            {lang === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="mhk-container">

        {/* Tab bar */}
        <nav className="mhk-tabbar">
          {tabs.map(tab => (
            <button key={tab.key}
              className={`mhk-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
            >
              <span className="mhk-tab-icon">{tab.icon}</span>
              <span className="mhk-tab-label-full">{tab.label}</span>
              <span className="mhk-tab-label-short">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="mhk-content mhk-fade" key={activeTab}>
          {activeTab === "upload"     && <FileUpload onExtracted={setExtractedText} onFileInfo={setFileInfo} extractedText={extractedText} />}
          {activeTab === "datalab"    && <DataHub />}
          {activeTab === "aidetect"   && <AIDetector initialText={extractedText} />}
          {activeTab === "citation"   && <CitationPlagiarism initialText={extractedText} />}
          {activeTab === "proofread"  && <Proofreader text={extractedText} />}

          {activeTab === "qr"         && <div className="mhk-inner"><QRGenerator /></div>}
          {activeTab === "report"     && <div className="mhk-inner"><ReviewReport /></div>}
          {activeTab === "discussion" && <div className="mhk-inner"><DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} /></div>}
          {activeTab === "about"      && <div className="mhk-inner"><About /></div>}
          {activeTab === "services"   && <div className="mhk-inner"><ServicesPortal /></div>}
        </div>
      </div>
    </div>
  );
}
