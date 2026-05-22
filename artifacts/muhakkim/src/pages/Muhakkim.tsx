import { useState } from "react";
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
// Tool definitions
// ─────────────────────────────────────────────────────────────────────────────
const TOOLS = [
  { key: "upload",     icon: "📂", ar: "رفع الملف",          en: "File Upload",           color: "#C9A84C", bg: "#C9A84C" },
  { key: "proofread",  icon: "📝", ar: "التدقيق اللغوي",     en: "Proofreader",           color: "#60a5fa", bg: "#60a5fa" },
  { key: "aidetect",   icon: "🛡️", ar: "كشف AI",             en: "AI Detector",           color: "#34d399", bg: "#34d399" },
  { key: "citation",   icon: "📖", ar: "اقتباس وانتحال",     en: "Citation & Plagiarism", color: "#f87171", bg: "#f87171" },
  { key: "datalab",    icon: "🔬", ar: "مختبر البيانات",     en: "Data Lab",              color: "#38bdf8", bg: "#38bdf8" },
  { key: "report",     icon: "📋", ar: "تقرير التحكيم",      en: "Review Report",         color: "#fb923c", bg: "#fb923c" },
  { key: "qr",         icon: "📷", ar: "مولّد QR",           en: "QR Generator",          color: "#e879f9", bg: "#e879f9" },
  { key: "discussion", icon: "💬", ar: "لوحة المناقشة",      en: "Discussion",            color: "#4ade80", bg: "#4ade80" },
  { key: "services",   icon: "🏢", ar: "خدماتنا الإحصائية",  en: "Our Services",          color: "#C9A84C", bg: "#C9A84C" },
  { key: "about",      icon: "ℹ️",  ar: "عن البرنامج",        en: "About",                 color: "#94a3b8", bg: "#94a3b8" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const isAr = lang === "ar";

  const openTool = (key: string) => setActiveTab(key);
  const closeTool = () => setActiveTab(null);

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#080e1c", color: "#e2e8f0", fontFamily: isAr ? "'Tajawal','IBM Plex Sans Arabic',sans-serif" : "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #050912; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 4px; }
        .mhk-tool-card {
          background: #0e1829;
          border: 1.5px solid #ffffff0e;
          border-radius: 18px;
          padding: 20px 16px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color .18s, box-shadow .18s, transform .14s;
          outline: none;
          text-align: start;
          width: 100%;
        }
        .mhk-tool-card:hover {
          transform: translateY(-2px);
        }
        .mhk-tool-card:active {
          transform: scale(0.96);
        }
        @keyframes mhk-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mhk-fade { animation: mhk-fadeUp .32s cubic-bezier(.22,.68,0,1.2) both; }
        .mhk-inner { padding: 24px 20px; }
        @media (max-width: 480px) {
          .mhk-inner { padding: 16px 14px; }
        }
      `}</style>

      {/* ── Sticky Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,14,28,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        {/* Back button (shown when a tool is open) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {activeTab && (
            <button
              onClick={closeTool}
              style={{
                background: "rgba(201,168,76,0.1)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 10, color: "#C9A84C",
                padding: "7px 13px", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
                flexShrink: 0,
              }}
            >
              <span style={{ display: "inline-block", transform: isAr ? "none" : "scaleX(-1)" }}>→</span>
              {isAr ? "رجوع" : "Back"}
            </button>
          )}
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#C9A84C,#a07830)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, boxShadow: "0 0 14px #C9A84C44",
            }}>⚖️</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#C9A84C", lineHeight: 1.2 }}>
                {isAr ? "محكّم" : "Muhakkim"}
              </div>
              {!activeTab && (
                <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isAr ? "منصة التدقيق الأكاديمي الذكي" : "Smart Academic Review Platform"}
                </div>
              )}
              {activeTab && (
                <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {TOOLS.find(t => t.key === activeTab)?.[isAr ? "ar" : "en"]}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          data-testid="button-toggle-lang"
          style={{
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 10, color: "#C9A84C",
            padding: "7px 16px", fontWeight: 800, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {lang === "ar" ? "EN" : "AR"}
        </button>
      </header>

      {/* ── Home Screen: Grid of tools ── */}
      {!activeTab && (
        <main style={{ padding: "24px 16px 120px", maxWidth: 700, margin: "0 auto" }} className="mhk-fade">
          {/* Page title */}
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", margin: "0 0 6px", lineHeight: 1.3 }}>
            {isAr ? "استكشف أدوات محكّم" : "Explore Muhakkim Tools"}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 24px", lineHeight: 1.7 }}>
            {isAr
              ? "اختر أداة للبدء · يدعم العربية والإنجليزية"
              : "Choose a tool to get started · Supports Arabic & English"}
          </p>

          {/* 2-column tool grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                className="mhk-tool-card"
                data-testid={`tab-${tool.key}`}
                onClick={() => openTool(tool.key)}
                style={{
                  borderColor: "#ffffff0e",
                  boxShadow: "none",
                } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = tool.color + "66";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px ${tool.color}18`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#ffffff0e";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                {/* Icon box */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: tool.bg + "18",
                  border: `1px solid ${tool.color}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {tool.icon}
                </div>
                {/* Label */}
                <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
                  {isAr ? tool.ar : tool.en}
                </div>
              </button>
            ))}
          </div>

          {/* Quick-start hint */}
          <div
            style={{ marginTop: 28, cursor: "pointer" }}
            onClick={() => openTool("upload")}
          >
            <span style={{
              color: "#C9A84C", fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {isAr ? "ابدأ برفع ملفك الأول" : "Start by uploading your first file"}
              <span style={{ display: "inline-block", transform: isAr ? "scaleX(-1)" : "none" }}>→</span>
            </span>
          </div>
        </main>
      )}

      {/* ── Tool Detail View ── */}
      {activeTab && (
        <div className="mhk-fade" key={activeTab} style={{ maxWidth: 900, margin: "0 auto" }}>
          {activeTab === "upload"     && <FileUpload onExtracted={setExtractedText} onFileInfo={setFileInfo} extractedText={extractedText} />}
          {activeTab === "proofread"  && <Proofreader text={extractedText} />}
          {activeTab === "datalab"    && <DataHub />}
          {activeTab === "aidetect"   && <AIDetector initialText={extractedText} />}
          {activeTab === "citation"   && <CitationPlagiarism initialText={extractedText} />}
          {activeTab === "qr"         && <div className="mhk-inner"><QRGenerator /></div>}
          {activeTab === "report"     && <div className="mhk-inner"><ReviewReport /></div>}
          {activeTab === "discussion" && <div className="mhk-inner"><DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} /></div>}
          {activeTab === "about"      && <div className="mhk-inner"><About /></div>}
          {activeTab === "services"   && <div className="mhk-inner"><ServicesPortal /></div>}
        </div>
      )}
    </div>
  );
}
