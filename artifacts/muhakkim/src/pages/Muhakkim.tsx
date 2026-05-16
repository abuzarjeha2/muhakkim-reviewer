import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../lib/i18n";

import FileUpload from "../components/muhakkim/FileUpload";
import Proofreader from "../components/muhakkim/Proofreader";
import StatParser from "../components/muhakkim/StatParser";
import EquationChecker from "../components/muhakkim/EquationChecker";
import QRGenerator from "../components/muhakkim/QRGenerator";
import ReviewReport from "../components/muhakkim/ReviewReport";
import About from "../components/muhakkim/About";
import DiscussionPanel from "../components/muhakkim/DiscussionPanel";

// ─── Particle Field ────────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;

    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.6 + 0.4, opacity: Math.random() * 0.45 + 0.08,
    }));

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(201,168,76,${p.opacity})`;
        ctx!.fill();
      });
      particles.forEach((p, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(p.x - particles[j].x, p.y - particles[j].y);
          if (d < 90) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(201,168,76,${0.1 * (1 - d / 90)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
    }} />
  );
}

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS_AR = [
  { key: "upload",     icon: "📂", label: "رفع الملف" },
  { key: "proofread",  icon: "📝", label: "التدقيق اللغوي" },
  { key: "stats",      icon: "📊", label: "المخرجات الإحصائية" },
  { key: "equations",  icon: "🔢", label: "فاحص المعادلات" },
  { key: "qr",         icon: "📷", label: "مولّد QR" },
  { key: "report",     icon: "📋", label: "تقرير التحكيم" },
  { key: "discussion", icon: "💬", label: "لوحة المناقشة" },
  { key: "about",      icon: "ℹ️",  label: "عن البرنامج" },
];

const TABS_EN = [
  { key: "upload",     icon: "📂", label: "File Upload" },
  { key: "proofread",  icon: "📝", label: "Proofreader" },
  { key: "stats",      icon: "📊", label: "Stat Parser" },
  { key: "equations",  icon: "🔢", label: "Equations" },
  { key: "qr",         icon: "📷", label: "QR Code" },
  { key: "report",     icon: "📋", label: "Review Report" },
  { key: "discussion", icon: "💬", label: "Discussion" },
  { key: "about",      icon: "ℹ️",  label: "About" },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const tabs = lang === "ar" ? TABS_AR : TABS_EN;
  const isAr = lang === "ar";

  // ── Inline styles ──
  const S: Record<string, React.CSSProperties> = {
    root: {
      fontFamily: "'Tajawal', 'Inter', 'Segoe UI', sans-serif",
      direction: isAr ? "rtl" : "ltr",
      background: "linear-gradient(160deg, #080d1a 0%, #0c1526 55%, #080d18 100%)",
      minHeight: "100vh",
      color: "#e2e8f0",
    },
    hero: {
      position: "relative",
      overflow: "hidden",
      padding: "40px 32px 36px",
      background: "linear-gradient(180deg, #0f1b2d 0%, transparent 100%)",
      borderBottom: "1px solid #ffffff08",
    },
    heroInner: {
      maxWidth: 1100,
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      position: "relative",
      zIndex: 1,
    },
    logoBox: {
      width: 52, height: 52, borderRadius: 14,
      background: "linear-gradient(135deg, #C9A84C, #f5d78e)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 28, flexShrink: 0,
      boxShadow: "0 4px 24px #C9A84C44",
    },
    heroTitle: {
      fontSize: "clamp(26px, 4vw, 42px)",
      fontWeight: 900,
      background: "linear-gradient(135deg, #C9A84C 0%, #f5d78e 45%, #C9A84C 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      margin: 0,
      lineHeight: 1.1,
    },
    heroSub: {
      color: "#64748b",
      fontSize: 13,
      marginTop: 6,
      marginBottom: 0,
      letterSpacing: "0.02em",
    },
    tag: {
      background: "#C9A84C15",
      border: "1px solid #C9A84C33",
      color: "#C9A84C",
      borderRadius: 20,
      padding: "4px 14px",
      fontSize: 12,
      fontWeight: 700,
    },
    langBtn: {
      background: "linear-gradient(135deg, #C9A84C22, #f5d78e11)",
      border: "1px solid #C9A84C44",
      color: "#C9A84C",
      borderRadius: 10,
      padding: "9px 20px",
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all .2s",
      flexShrink: 0,
    },
    container: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "0 20px 60px",
    },
    tabBar: {
      display: "flex",
      gap: 4,
      marginTop: 24,
      background: "#060d1a",
      borderRadius: 14,
      padding: 6,
      border: "1px solid #ffffff08",
      flexWrap: "wrap",
    },
    content: {
      marginTop: 16,
      background: "linear-gradient(145deg, #0f1b2dcc, #0a1120cc)",
      backdropFilter: "blur(20px)",
      border: "1px solid #ffffff10",
      borderRadius: 20,
      overflow: "hidden",
    },
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "linear-gradient(135deg, #C9A84C22, #f5d78e11)" : "transparent",
    border: active ? "1px solid #C9A84C44" : "1px solid transparent",
    borderRadius: 10,
    padding: "9px 14px",
    color: active ? "#C9A84C" : "#64748b",
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    cursor: "pointer",
    transition: "all .2s",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        @keyframes mhk-main-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .mhk-main-fade { animation: mhk-main-fadeUp .45s ease both; }
        .mhk-lang-btn:hover { background: #C9A84C22 !important; }
        .mhk-tab:hover { color: #C9A84C !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #C9A84C44; border-radius: 4px; }
      `}</style>

      {/* ── Hero Header ── */}
      <header style={S.hero}>
        <ParticleField />
        <div style={S.heroInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={S.logoBox}>م</div>
            <div>
              <h1 style={S.heroTitle}>محكّم</h1>
              <p style={S.heroSub}>
                {isAr
                  ? "منصة التدقيق الأكاديمي الذكي · Muhakkim Al Proofreader"
                  : "Academic Peer Review Platform · منصة التحكيم الأكاديمي"}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {(isAr
                  ? ["تحليل لغوي", "بنية أكاديمية", "تقرير مفصّل", "ثنائي اللغة"]
                  : ["Language", "Structure", "Report", "Bilingual"]
                ).map(tag => (
                  <span key={tag} style={S.tag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <button
            className="mhk-lang-btn"
            style={S.langBtn}
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            data-testid="button-toggle-lang"
          >
            {lang === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={S.container}>

        {/* Tab Bar */}
        <nav style={S.tabBar}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className="mhk-tab"
              style={tabStyle(activeTab === tab.key)}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Panel */}
        <div style={S.content} className="mhk-main-fade" key={activeTab}>
          {activeTab === "upload" && (
            <FileUpload
              onExtracted={setExtractedText}
              onFileInfo={setFileInfo}
              extractedText={extractedText}
            />
          )}
          {activeTab === "proofread" && (
            <Proofreader text={extractedText} />
          )}
          {activeTab === "stats" && (
            <div style={{ padding: 28 }}>
              <StatParser />
            </div>
          )}
          {activeTab === "equations" && (
            <div style={{ padding: 28 }}>
              <EquationChecker />
            </div>
          )}
          {activeTab === "qr" && (
            <div style={{ padding: 28 }}>
              <QRGenerator />
            </div>
          )}
          {activeTab === "report" && (
            <div style={{ padding: 28 }}>
              <ReviewReport />
            </div>
          )}
          {activeTab === "discussion" && (
            <div style={{ padding: 28 }}>
              <DiscussionPanel
                text={extractedText}
                fileName={fileInfo?.name ?? ""}
              />
            </div>
          )}
          {activeTab === "about" && (
            <div style={{ padding: 28 }}>
              <About />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
