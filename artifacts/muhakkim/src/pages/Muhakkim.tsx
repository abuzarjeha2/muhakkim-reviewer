import { useState } from "react";
import { useLanguage } from "../lib/i18n";

import FileUpload     from "../components/muhakkim/FileUpload";
import Proofreader    from "../components/muhakkim/Proofreader";
import QRGenerator    from "../components/muhakkim/QRGenerator";
import ReviewReport   from "../components/muhakkim/ReviewReport";
import About          from "../components/muhakkim/About";
import DiscussionPanel from "../components/muhakkim/DiscussionPanel";
import AIDetector     from "../components/muhakkim/AIDetector";
import CitationPlagiarism from "../components/muhakkim/CitationPlagiarism";
import DataHub        from "../components/muhakkim/DataHub";
import ServicesPortal from "../components/muhakkim/ServicesPortal";
import ResearchSearch from "../components/muhakkim/ResearchSearch";
import ThesisRoles    from "../components/muhakkim/ThesisRoles";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SubTool {
  key: string;
  icon: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}

interface ToolGroup {
  groupKey: string;
  icon: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  color: string;
  tools: SubTool[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Group + sub-tool definitions
// ─────────────────────────────────────────────────────────────────────────────
const GROUPS: ToolGroup[] = [
  {
    groupKey: "review",
    icon: "⚖️",
    ar: "التحكيم الأكاديمي",
    en: "Peer Review",
    descAr: "رفع الأوراق البحثية وكتابة تقارير التحكيم والمناقشة",
    descEn: "Upload papers, write review reports and discussion notes",
    color: "#C9A84C",
    tools: [
      { key: "upload",     icon: "📂", ar: "رفع الملف",             en: "Upload File",       descAr: "رفع PDF أو Word لاستخراج النص",                       descEn: "Upload PDF or Word to extract text" },
      { key: "thesis",     icon: "🎓", ar: "تحليل حسب الدور",      en: "Role-Based Analysis", descAr: "مشرف · مناقش داخلي · خارجي · باحث — تحليل وحلول عملية", descEn: "Supervisor · Internal · External · Researcher — analysis & solutions" },
      { key: "report",     icon: "📋", ar: "تقرير التحكيم",         en: "Review Report",     descAr: "إنشاء تقرير تحكيم منظّم ومفصّل",                      descEn: "Generate a structured review report" },
      { key: "discussion", icon: "💬", ar: "لوحة المناقشة",         en: "Discussion",        descAr: "تدوين ملاحظات ونقاط النقاش",                          descEn: "Take discussion notes on the paper" },
    ],
  },
  {
    groupKey: "writing",
    icon: "✍️",
    ar: "اللغة والكتابة",
    en: "Language & Writing",
    descAr: "تدقيق لغوي بالذكاء الاصطناعي، قاموس، تلخيص، واقتباس وانتحال",
    descEn: "AI proofreading, dictionary, summarisation, citation & plagiarism",
    color: "#60a5fa",
    tools: [
      { key: "proofread", icon: "📝", ar: "التدقيق اللغوي",  en: "Proofreader",          descAr: "تدقيق عميق بالذكاء الاصطناعي وقاموس وتلخيص", descEn: "Deep AI proofread, dictionary & summarise" },
      { key: "citation",  icon: "📖", ar: "اقتباس وانتحال",  en: "Citation & Plagiarism", descAr: "تنسيق المراجع وكشف الانتحال",                 descEn: "Format references & detect plagiarism" },
    ],
  },
  {
    groupKey: "aidetect",
    icon: "🛡️",
    ar: "كشف الذكاء الاصطناعي",
    en: "AI Detection",
    descAr: "كشف النصوص المولّدة بالذكاء الاصطناعي في الأوراق البحثية",
    descEn: "Detect AI-generated content in research papers",
    color: "#34d399",
    tools: [
      { key: "aidetect", icon: "🛡️", ar: "كشف AI", en: "AI Detector", descAr: "تحليل النص وتحديد نسبة الاصطناعي", descEn: "Analyse text and identify AI-written sections" },
    ],
  },
  {
    groupKey: "data",
    icon: "📊",
    ar: "تحليل البيانات والإحصاء",
    en: "Data & Statistics",
    descAr: "مختبر البيانات التفاعلي والخدمات الإحصائية المتخصصة",
    descEn: "Interactive data lab and specialised statistical services",
    color: "#38bdf8",
    tools: [
      { key: "datalab",  icon: "🔬", ar: "مختبر البيانات",     en: "Data Lab",     descAr: "تحليل ورسم البيانات وإنشاء الجداول",    descEn: "Analyse, chart and tabulate data" },
      { key: "services", icon: "🏢", ar: "خدماتنا الإحصائية",  en: "Our Services", descAr: "خدمات التحليل الإحصائي الاحترافي",      descEn: "Professional statistical analysis services" },
    ],
  },
  {
    groupKey: "research",
    icon: "🔭",
    ar: "البحث العلمي والمكتبات",
    en: "Research & Libraries",
    descAr: "بحث في ملايين الأوراق البحثية و٢٦ مكتبة رقمية عربية ودولية",
    descEn: "Search millions of papers and 26 Arabic & international digital libraries",
    color: "#a78bfa",
    tools: [
      { key: "research", icon: "🔭", ar: "البحث والمكتبات", en: "Research & Libraries", descAr: "Semantic Scholar · OpenAlex · CrossRef · ٢٦ مكتبة", descEn: "Semantic Scholar · OpenAlex · CrossRef · 26 libraries" },
    ],
  },
  {
    groupKey: "utilities",
    icon: "🛠️",
    ar: "أدوات متنوعة",
    en: "Utilities",
    descAr: "مولّد رمز QR ومعلومات عن البرنامج",
    descEn: "QR code generator and app information",
    color: "#e879f9",
    tools: [
      { key: "qr",    icon: "📷", ar: "مولّد QR",    en: "QR Generator", descAr: "توليد رموز QR للروابط والنصوص", descEn: "Generate QR codes for links & text" },
      { key: "about", icon: "ℹ️",  ar: "عن البرنامج", en: "About",         descAr: "معلومات ومميزات منصة محكّم",    descEn: "About the Muhakkim platform" },
    ],
  },
];

// Helper: find which group owns a tool key
const findGroup = (toolKey: string) =>
  GROUPS.find(g => g.tools.some(t => t.key === toolKey)) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo]           = useState<{ name: string; size: string } | null>(null);

  // Navigation state
  // null = home groups grid
  // activeGroup + no activeTab = sub-tool picker
  // activeTab = tool is open
  const [activeGroup, setActiveGroup]   = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<string | null>(null);

  const isAr = lang === "ar";

  const openGroup = (gk: string) => {
    const grp = GROUPS.find(g => g.groupKey === gk)!;
    if (grp.tools.length === 1) {
      // single-tool group → open directly
      setActiveGroup(gk);
      setActiveTab(grp.tools[0].key);
    } else {
      setActiveGroup(gk);
      setActiveTab(null);
    }
  };

  const openTool = (key: string) => setActiveTab(key);

  const goBack = () => {
    if (activeTab) {
      const grp = findGroup(activeTab);
      if (grp && grp.tools.length > 1) {
        // back to sub-picker
        setActiveTab(null);
      } else {
        // single-tool group → back to home
        setActiveGroup(null);
        setActiveTab(null);
      }
    } else {
      // in sub-picker → back to home
      setActiveGroup(null);
    }
  };

  const currentGroup  = activeGroup ? GROUPS.find(g => g.groupKey === activeGroup) ?? null : null;
  const currentTool   = activeTab   ? findGroup(activeTab)?.tools.find(t => t.key === activeTab) ?? null : null;

  // Header sub-label
  const headerSub = (() => {
    if (activeTab && currentGroup && currentTool)
      return `${currentGroup[isAr ? "ar" : "en"]} › ${currentTool[isAr ? "ar" : "en"]}`;
    if (activeGroup && currentGroup && !activeTab)
      return currentGroup[isAr ? "ar" : "en"];
    return isAr ? "منصة التدقيق الأكاديمي الذكي" : "Smart Academic Review Platform";
  })();

  const showBack = !!(activeGroup || activeTab);

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "#080e1c", color: "#e2e8f0", fontFamily: isAr ? "'Tajawal','IBM Plex Sans Arabic',sans-serif" : "'Inter','Segoe UI',sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #050912; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 4px; }

        .mhk-card {
          background: #0e1829;
          border: 1.5px solid #ffffff0e;
          border-radius: 18px;
          cursor: pointer;
          transition: border-color .18s, box-shadow .18s, transform .14s;
          outline: none;
          text-align: start;
          width: 100%;
        }
        .mhk-card:hover  { transform: translateY(-2px); }
        .mhk-card:active { transform: scale(0.96); }

        @keyframes mhk-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mhk-fade { animation: mhk-fadeUp .3s cubic-bezier(.22,.68,0,1.2) both; }
        .mhk-inner { padding: 24px 20px; }
        @media (max-width: 480px) { .mhk-inner { padding: 16px 14px; } }
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {showBack && (
            <button
              onClick={goBack}
              style={{
                background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 10, color: "#C9A84C", padding: "7px 13px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              }}
            >
              <span style={{ display: "inline-block", transform: isAr ? "none" : "scaleX(-1)" }}>→</span>
              {isAr ? "رجوع" : "Back"}
            </button>
          )}
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
              <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {headerSub}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          data-testid="button-toggle-lang"
          style={{
            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 10, color: "#C9A84C", padding: "7px 16px",
            fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {lang === "ar" ? "EN" : "AR"}
        </button>
      </header>

      {/* ══════════════════ HOME — Groups grid ══════════════════ */}
      {!activeGroup && !activeTab && (
        <main style={{ padding: "24px 16px 120px", maxWidth: 700, margin: "0 auto" }} className="mhk-fade">
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", margin: "0 0 6px", lineHeight: 1.3 }}>
            {isAr ? "استكشف أدوات محكّم" : "Explore Muhakkim Tools"}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 24px", lineHeight: 1.7 }}>
            {isAr ? "اختر قسماً للبدء · يدعم العربية والإنجليزية" : "Choose a section to get started · Supports Arabic & English"}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {GROUPS.map((grp) => (
              <button
                key={grp.groupKey}
                className="mhk-card"
                data-testid={`group-${grp.groupKey}`}
                onClick={() => openGroup(grp.groupKey)}
                style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = grp.color + "66";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px ${grp.color}18`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#ffffff0e";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 46, height: 46, borderRadius: 13,
                  background: grp.color + "18", border: `1px solid ${grp.color}33`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}>
                  {grp.icon}
                </div>
                {/* Label + desc */}
                <div>
                  <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
                    {isAr ? grp.ar : grp.en}
                  </div>
                  <div style={{ color: "#475569", fontSize: 11, lineHeight: 1.6 }}>
                    {isAr ? grp.descAr : grp.descEn}
                  </div>
                </div>
                {/* Tool count badge */}
                {grp.tools.length > 1 && (
                  <div style={{
                    background: grp.color + "15", border: `1px solid ${grp.color}22`,
                    borderRadius: 6, padding: "3px 8px",
                    color: grp.color, fontSize: 10, fontWeight: 700,
                    alignSelf: "flex-start",
                  }}>
                    {grp.tools.length} {isAr ? "أدوات" : "tools"}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Quick-start hint */}
          <div style={{ marginTop: 28, cursor: "pointer" }} onClick={() => openGroup("review")}>
            <span style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {isAr ? "ابدأ برفع ملفك الأول" : "Start by uploading your first file"}
              <span style={{ display: "inline-block", transform: isAr ? "scaleX(-1)" : "none" }}>→</span>
            </span>
          </div>
        </main>
      )}

      {/* ══════════════════ SUB-TOOL PICKER ══════════════════ */}
      {activeGroup && !activeTab && currentGroup && (
        <main style={{ padding: "24px 16px 120px", maxWidth: 700, margin: "0 auto" }} className="mhk-fade" key={`grp-${activeGroup}`}>
          {/* Group header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 15,
              background: currentGroup.color + "18", border: `1px solid ${currentGroup.color}33`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0,
            }}>
              {currentGroup.icon}
            </div>
            <div>
              <h2 style={{ color: currentGroup.color, fontWeight: 900, fontSize: 20, margin: "0 0 4px" }}>
                {isAr ? currentGroup.ar : currentGroup.en}
              </h2>
              <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
                {isAr ? currentGroup.descAr : currentGroup.descEn}
              </p>
            </div>
          </div>

          {/* Sub-tools grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentGroup.tools.map((tool, idx) => (
              <button
                key={tool.key}
                className="mhk-card"
                data-testid={`tab-${tool.key}`}
                onClick={() => openTool(tool.key)}
                style={{
                  padding: "18px 18px",
                  display: "flex", alignItems: "center", gap: 16,
                  animationDelay: `${idx * 0.06}s`,
                } as React.CSSProperties}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = currentGroup.color + "55";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${currentGroup.color}14`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#ffffff0e";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: currentGroup.color + "15", border: `1px solid ${currentGroup.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                }}>
                  {tool.icon}
                </div>
                <div style={{ flex: 1, textAlign: isAr ? "right" : "left" }}>
                  <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 14, marginBottom: 3 }}>
                    {isAr ? tool.ar : tool.en}
                  </div>
                  <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.6 }}>
                    {isAr ? tool.descAr : tool.descEn}
                  </div>
                </div>
                <span style={{ color: currentGroup.color, fontSize: 18, opacity: 0.6, flexShrink: 0 }}>
                  {isAr ? "←" : "→"}
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ══════════════════ TOOL VIEW ══════════════════ */}
      {activeTab && (
        <div className="mhk-fade" key={activeTab} style={{ maxWidth: 900, margin: "0 auto" }}>
          {activeTab === "upload"     && <FileUpload onExtracted={setExtractedText} onFileInfo={setFileInfo} extractedText={extractedText} />}
          {activeTab === "thesis"     && <ThesisRoles text={extractedText} />}
          {activeTab === "proofread"  && <Proofreader text={extractedText} />}
          {activeTab === "datalab"    && <DataHub />}
          {activeTab === "aidetect"   && <AIDetector initialText={extractedText} />}
          {activeTab === "citation"   && <CitationPlagiarism initialText={extractedText} />}
          {activeTab === "qr"         && <div className="mhk-inner"><QRGenerator /></div>}
          {activeTab === "report"     && <div className="mhk-inner"><ReviewReport /></div>}
          {activeTab === "discussion" && <div className="mhk-inner"><DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} /></div>}
          {activeTab === "research"   && <ResearchSearch />}
          {activeTab === "about"      && <div className="mhk-inner"><About /></div>}
          {activeTab === "services"   && <div className="mhk-inner"><ServicesPortal /></div>}
        </div>
      )}
    </div>
  );
}
