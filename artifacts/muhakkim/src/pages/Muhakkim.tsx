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

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const count = window.innerWidth < 640 ? 22 : 45;
    const particles = () => Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.6 + 0.4, opacity: Math.random() * 0.45 + 0.08,
    }));
    let pts = particles();

    function draw() {
      const W = canvas!.width, H = canvas!.height;
      ctx!.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(201,168,76,${p.opacity})`;
        ctx!.fill();
      });
      pts.forEach((p, i) => {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(p.x - pts[j].x, p.y - pts[j].y);
          if (d < 90) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(pts[j].x, pts[j].y);
            ctx!.strokeStyle = `rgba(201,168,76,${0.1 * (1 - d / 90)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
    }} />
  );
}

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS_AR = [
  { key: "upload",     icon: "📂", label: "رفع الملف",           shortLabel: "رفع" },
  { key: "proofread",  icon: "📝", label: "التدقيق اللغوي",       shortLabel: "تدقيق" },
  { key: "stats",      icon: "📊", label: "المخرجات الإحصائية",   shortLabel: "إحصاء" },
  { key: "equations",  icon: "🔢", label: "فاحص المعادلات",       shortLabel: "معادلات" },
  { key: "qr",         icon: "📷", label: "مولّد QR",             shortLabel: "QR" },
  { key: "report",     icon: "📋", label: "تقرير التحكيم",        shortLabel: "تقرير" },
  { key: "discussion", icon: "💬", label: "لوحة المناقشة",        shortLabel: "مناقشة" },
  { key: "about",      icon: "ℹ️",  label: "عن البرنامج",          shortLabel: "عن" },
];

const TABS_EN = [
  { key: "upload",     icon: "📂", label: "File Upload",    shortLabel: "Upload" },
  { key: "proofread",  icon: "📝", label: "Proofreader",    shortLabel: "Proof" },
  { key: "stats",      icon: "📊", label: "Stat Parser",    shortLabel: "Stats" },
  { key: "equations",  icon: "🔢", label: "Equations",      shortLabel: "Eq" },
  { key: "qr",         icon: "📷", label: "QR Code",        shortLabel: "QR" },
  { key: "report",     icon: "📋", label: "Review Report",  shortLabel: "Report" },
  { key: "discussion", icon: "💬", label: "Discussion",     shortLabel: "Chat" },
  { key: "about",      icon: "ℹ️",  label: "About",          shortLabel: "About" },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const tabs = lang === "ar" ? TABS_AR : TABS_EN;
  const isAr = lang === "ar";

  return (
    <div className="mhk-root" dir={isAr ? "rtl" : "ltr"}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .mhk-root {
          font-family: 'Tajawal', 'Inter', 'Segoe UI', sans-serif;
          background: linear-gradient(160deg, #080d1a 0%, #0c1526 55%, #080d18 100%);
          min-height: 100vh;
          color: #e2e8f0;
        }

        /* ── Hero ── */
        .mhk-hero {
          position: relative;
          overflow: hidden;
          border-bottom: 1px solid #ffffff08;
          background: linear-gradient(180deg, #0f1b2d 0%, transparent 100%);
          padding: 36px 40px 32px;
        }
        .mhk-hero-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          position: relative;
          z-index: 1;
          flex-wrap: wrap;
        }
        .mhk-logo-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }
        .mhk-logo-box {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #C9A84C, #f5d78e);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; font-weight: 900;
          color: #080d1a;
          box-shadow: 0 4px 24px #C9A84C44;
          flex-shrink: 0;
        }
        .mhk-hero-title {
          font-size: clamp(24px, 5vw, 42px);
          font-weight: 900;
          background: linear-gradient(135deg, #C9A84C 0%, #f5d78e 45%, #C9A84C 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          line-height: 1.1;
        }
        .mhk-hero-sub {
          color: #64748b;
          font-size: clamp(11px, 1.5vw, 13px);
          margin-top: 6px;
          margin-bottom: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mhk-tags {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .mhk-tag {
          background: #C9A84C15;
          border: 1px solid #C9A84C33;
          color: #C9A84C;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 700;
          font-family: inherit;
          white-space: nowrap;
        }
        .mhk-lang-btn {
          background: linear-gradient(135deg, #C9A84C22, #f5d78e11);
          border: 1px solid #C9A84C44;
          color: #C9A84C;
          border-radius: 10px;
          padding: 9px 22px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all .2s;
          flex-shrink: 0;
        }
        .mhk-lang-btn:hover { background: #C9A84C22; }

        /* ── Container ── */
        .mhk-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }

        /* ── Tab Bar ── */
        .mhk-tabbar {
          display: flex;
          gap: 4px;
          margin-top: 20px;
          background: #060d1a;
          border-radius: 14px;
          padding: 6px;
          border: 1px solid #ffffff08;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .mhk-tabbar::-webkit-scrollbar { display: none; }
        .mhk-tab {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 9px 14px;
          color: #64748b;
          font-weight: 500;
          font-size: 12px;
          cursor: pointer;
          transition: all .2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .mhk-tab:hover { color: #C9A84C; }
        .mhk-tab.active {
          background: linear-gradient(135deg, #C9A84C22, #f5d78e11);
          border-color: #C9A84C44;
          color: #C9A84C;
          font-weight: 700;
        }
        .mhk-tab-label-short { display: none; }
        .mhk-tab-label-full  { display: inline; }

        /* ── Content Panel ── */
        .mhk-content {
          margin-top: 16px;
          background: linear-gradient(145deg, #0f1b2dcc, #0a1120cc);
          backdrop-filter: blur(20px);
          border: 1px solid #ffffff10;
          border-radius: 20px;
          overflow: hidden;
        }
        .mhk-inner { padding: 28px; }

        /* ── Animation ── */
        @keyframes mhk-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mhk-fade { animation: mhk-fadeUp .4s ease both; }

        /* scrollbar */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #C9A84C44; border-radius: 4px; }

        /* ═══════════════════════════════
           TABLET  (≤ 900px)
           ═══════════════════════════════ */
        @media (max-width: 900px) {
          .mhk-hero { padding: 28px 24px 24px; }
          .mhk-logo-box { width: 44px; height: 44px; font-size: 22px; border-radius: 11px; }
          .mhk-tab-label-full  { display: none; }
          .mhk-tab-label-short { display: inline; }
          .mhk-tab { padding: 9px 12px; font-size: 11px; }
        }

        /* ═══════════════════════════════
           MOBILE  (≤ 600px)
           ═══════════════════════════════ */
        @media (max-width: 600px) {
          .mhk-hero { padding: 20px 16px 18px; }
          .mhk-hero-inner {
            flex-direction: column;
            align-items: flex-start;
            gap: 14px;
          }
          .mhk-logo-row { gap: 12px; }
          .mhk-logo-box { width: 40px; height: 40px; font-size: 20px; border-radius: 10px; }
          .mhk-hero-sub { white-space: normal; }
          .mhk-lang-btn { align-self: flex-end; padding: 8px 18px; font-size: 13px; }
          .mhk-tags { gap: 6px; margin-top: 8px; }
          .mhk-tag { font-size: 10px; padding: 3px 10px; }
          .mhk-container { padding: 0 12px 48px; }
          .mhk-tabbar { border-radius: 12px; padding: 5px; margin-top: 14px; }
          .mhk-tab { padding: 8px 10px; font-size: 10px; gap: 4px; }
          .mhk-content { border-radius: 16px; margin-top: 12px; }
          .mhk-inner { padding: 16px; }
        }

        /* ═══════════════════════════════
           SMALL MOBILE  (≤ 380px)
           ═══════════════════════════════ */
        @media (max-width: 380px) {
          .mhk-tab-icon { display: none; }
          .mhk-tab { padding: 8px 9px; }
        }
      `}</style>

      {/* ── Hero Header ── */}
      <header className="mhk-hero">
        <ParticleField />
        <div className="mhk-hero-inner">
          <div className="mhk-logo-row">
            <div className="mhk-logo-box">م</div>
            <div style={{ minWidth: 0 }}>
              <h1 className="mhk-hero-title">محكّم</h1>
              <p className="mhk-hero-sub">
                {isAr
                  ? "منصة التدقيق الأكاديمي الذكي · Muhakkim Al Proofreader"
                  : "Academic Peer Review Platform · منصة التحكيم الأكاديمي"}
              </p>
              <div className="mhk-tags">
                {(isAr
                  ? ["تحليل لغوي", "بنية أكاديمية", "تقرير مفصّل", "ثنائي اللغة"]
                  : ["Language", "Structure", "Report", "Bilingual"]
                ).map(tag => (
                  <span key={tag} className="mhk-tag">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <button
            className="mhk-lang-btn"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            data-testid="button-toggle-lang"
          >
            {lang === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="mhk-container">

        {/* Tab Bar */}
        <nav className="mhk-tabbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
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

        {/* Content Panel */}
        <div className="mhk-content mhk-fade" key={activeTab}>
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
            <div className="mhk-inner"><StatParser /></div>
          )}
          {activeTab === "equations" && (
            <div className="mhk-inner"><EquationChecker /></div>
          )}
          {activeTab === "qr" && (
            <div className="mhk-inner"><QRGenerator /></div>
          )}
          {activeTab === "report" && (
            <div className="mhk-inner"><ReviewReport /></div>
          )}
          {activeTab === "discussion" && (
            <div className="mhk-inner">
              <DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} />
            </div>
          )}
          {activeTab === "about" && (
            <div className="mhk-inner"><About /></div>
          )}
        </div>
      </div>
    </div>
  );
}
