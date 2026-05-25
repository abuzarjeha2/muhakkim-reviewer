import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../lib/i18n";

import FileUpload        from "../components/muhakkim/FileUpload";
import Proofreader       from "../components/muhakkim/Proofreader";
import QRGenerator       from "../components/muhakkim/QRGenerator";
import ReviewReport      from "../components/muhakkim/ReviewReport";
import About             from "../components/muhakkim/About";
import DiscussionPanel   from "../components/muhakkim/DiscussionPanel";
import AIDetector        from "../components/muhakkim/AIDetector";
import CitationPlagiarism from "../components/muhakkim/CitationPlagiarism";
import DataHub           from "../components/muhakkim/DataHub";
import ServicesPortal    from "../components/muhakkim/ServicesPortal";
import ResearchSearch    from "../components/muhakkim/ResearchSearch";
import ThesisRoles       from "../components/muhakkim/ThesisRoles";
import SmartReview       from "../components/muhakkim/SmartReview";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubTool { key: string; icon: string; ar: string; en: string; descAr: string; descEn: string; }
interface ToolGroup {
  groupKey: string; icon: string; ar: string; en: string;
  descAr: string; descEn: string; color: string; bg: string; border: string; tools: SubTool[];
}

// ─── Groups ───────────────────────────────────────────────────────────────────
const GROUPS: ToolGroup[] = [
  {
    groupKey: "review", icon: "⚖️", ar: "التحكيم الأكاديمي", en: "Peer Review",
    descAr: "رفع الأوراق وتقارير التحكيم والمناقشة",
    descEn: "Upload papers, review reports & discussion",
    color: "#b45309", bg: "#fffbeb", border: "#fde68a",
    tools: [
      { key: "smartreview", icon: "🚀", ar: "المراجعة الذكية الشاملة", en: "Smart Full Review",    descAr: "ارفع PDF واحصل على تقرير تحكيم أكاديمي متكامل",         descEn: "Upload PDF & get a full AI academic review report" },
      { key: "upload",     icon: "📂", ar: "رفع الملف",              en: "Upload File",          descAr: "رفع PDF أو Word لاستخراج النص",                         descEn: "Upload PDF or Word to extract text" },
      { key: "thesis",     icon: "🎓", ar: "تحليل حسب الدور",       en: "Role-Based Analysis",  descAr: "مشرف · مناقش داخلي · خارجي · باحث",                    descEn: "Supervisor · Internal · External · Researcher" },
      { key: "report",     icon: "📋", ar: "تقرير التحكيم",          en: "Review Report",        descAr: "إنشاء تقرير تحكيم منظّم ومفصّل",                        descEn: "Generate a structured review report" },
      { key: "discussion", icon: "💬", ar: "لوحة المناقشة",          en: "Discussion Panel",     descAr: "تدوين ملاحظات ونقاط النقاش",                            descEn: "Take discussion notes on the paper" },
    ],
  },
  {
    groupKey: "writing", icon: "✍️", ar: "اللغة والكتابة", en: "Language & Writing",
    descAr: "تدقيق لغوي ذكي وقاموس واقتباس",
    descEn: "AI proofreading, dictionary & citation",
    color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe",
    tools: [
      { key: "proofread", icon: "📝", ar: "التدقيق اللغوي", en: "Proofreader",           descAr: "تدقيق عميق بالذكاء الاصطناعي وقاموس وتلخيص", descEn: "Deep AI proofread, dictionary & summarise" },
      { key: "citation",  icon: "📖", ar: "اقتباس وانتحال", en: "Citation & Plagiarism", descAr: "تنسيق المراجع وكشف الانتحال",                 descEn: "Format references & detect plagiarism" },
    ],
  },
  {
    groupKey: "aidetect", icon: "🛡️", ar: "كشف الذكاء الاصطناعي", en: "AI Detection",
    descAr: "كشف النصوص المولّدة بالذكاء الاصطناعي",
    descEn: "Detect AI-generated content in papers",
    color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0",
    tools: [
      { key: "aidetect", icon: "🛡️", ar: "كشف AI", en: "AI Detector", descAr: "تحليل النص وتحديد نسبة الاصطناعي", descEn: "Analyse text and identify AI-written sections" },
    ],
  },
  {
    groupKey: "data", icon: "📊", ar: "تحليل البيانات والإحصاء", en: "Data & Statistics",
    descAr: "مختبر البيانات والخدمات الإحصائية",
    descEn: "Data lab & statistical services",
    color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd",
    tools: [
      { key: "datalab",  icon: "🔬", ar: "مختبر البيانات",    en: "Data Lab",     descAr: "تحليل ورسم البيانات وإنشاء الجداول",  descEn: "Analyse, chart and tabulate data" },
      { key: "services", icon: "🏢", ar: "خدماتنا الإحصائية", en: "Our Services", descAr: "خدمات التحليل الإحصائي الاحترافي",   descEn: "Professional statistical analysis services" },
    ],
  },
  {
    groupKey: "research", icon: "🔭", ar: "البحث العلمي والمكتبات", en: "Research & Libraries",
    descAr: "بحث في ملايين الأوراق و٢٦ مكتبة رقمية",
    descEn: "Search millions of papers & 26 libraries",
    color: "#5b21b6", bg: "#f5f3ff", border: "#ddd6fe",
    tools: [
      { key: "research", icon: "🔭", ar: "البحث والمكتبات", en: "Research & Libraries", descAr: "Semantic Scholar · OpenAlex · CrossRef · ٢٦ مكتبة", descEn: "Semantic Scholar · OpenAlex · CrossRef · 26 libs" },
    ],
  },
  {
    groupKey: "utilities", icon: "🛠️", ar: "أدوات متنوعة", en: "Utilities",
    descAr: "مولّد QR والسيرة الذاتية والتواصل",
    descEn: "QR generator, CV & social channels",
    color: "#86198f", bg: "#fdf4ff", border: "#f0abfc",
    tools: [
      { key: "qr",    icon: "📷", ar: "مولّد QR",        en: "QR Generator", descAr: "توليد رموز QR للروابط والنصوص",           descEn: "Generate QR codes for links & text" },
      { key: "about", icon: "👨‍🏫", ar: "من أنا | تواصل", en: "About Me",     descAr: "السيرة الذاتية وقنوات يوتيوب وتيك توك", descEn: "CV, YouTube & TikTok channels" },
    ],
  },
];

const findGroup = (key: string) => GROUPS.find(g => g.tools.some(t => t.key === key)) ?? null;

// ─── Dropdown ────────────────────────────────────────────────────────────────
function NavDropdown({ grp, isAr, onSelect }: { grp: ToolGroup; isAr: boolean; onSelect: (k: string) => void }) {
  return (
    <div className="mhk-dropdown">
      <div style={{ padding: "5px 10px 7px", marginBottom: 3, borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: grp.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {isAr ? grp.ar : grp.en}
        </span>
      </div>
      {grp.tools.map(t => (
        <button key={t.key} className="mhk-drop-item" onClick={() => onSelect(t.key)}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: grp.bg, border: `1px solid ${grp.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
          <div style={{ textAlign: isAr ? "right" : "left" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{isAr ? t.ar : t.en}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{isAr ? t.descAr : t.descEn}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Group Card (home grid) ───────────────────────────────────────────────────
function GroupCard({ grp, isAr, onClick }: { grp: ToolGroup; isAr: boolean; onClick: () => void }) {
  return (
    <button
      className="mhk-card"
      data-testid={`group-${grp.groupKey}`}
      onClick={onClick}
      style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties}
    >
      {/* Icon */}
      <div style={{ width: 44, height: 44, borderRadius: 12, background: grp.bg, border: `1.5px solid ${grp.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
        {grp.icon}
      </div>
      {/* Text */}
      <div>
        <div style={{ color: "#1e293b", fontWeight: 800, fontSize: 13, lineHeight: 1.35, marginBottom: 3 }}>
          {isAr ? grp.ar : grp.en}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
          {isAr ? grp.descAr : grp.descEn}
        </div>
      </div>
      {/* Badge */}
      {grp.tools.length > 1 && (
        <span style={{ display: "inline-block", background: grp.bg, border: `1px solid ${grp.border}`, borderRadius: 6, padding: "2px 8px", color: grp.color, fontSize: 10, fontWeight: 700, alignSelf: "flex-start" }}>
          {grp.tools.length} {isAr ? "أدوات" : "tools"}
        </span>
      )}
    </button>
  );
}

// ─── Sub-tool card (picker screen) ───────────────────────────────────────────
function ToolCard({ tool, grp, isAr, onClick, idx }: { tool: SubTool; grp: ToolGroup; isAr: boolean; onClick: () => void; idx: number }) {
  return (
    <button
      className="mhk-card"
      data-testid={`tab-${tool.key}`}
      onClick={onClick}
      style={{ padding: "16px 16px", display: "flex", alignItems: "center", gap: 14, animationDelay: `${idx * 0.05}s` } as React.CSSProperties}
    >
      <div style={{ width: 48, height: 48, borderRadius: 13, background: grp.bg, border: `1.5px solid ${grp.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
        {tool.icon}
      </div>
      <div style={{ flex: 1, textAlign: isAr ? "right" : "left" }}>
        <div style={{ color: "#1e293b", fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{isAr ? tool.ar : tool.en}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>{isAr ? tool.descAr : tool.descEn}</div>
      </div>
      <span style={{ color: grp.color, fontSize: 18, opacity: 0.5, flexShrink: 0 }}>{isAr ? "←" : "→"}</span>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Muhakkim() {
  const { lang, setLang } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo]           = useState<{ name: string; size: string } | null>(null);
  const [activeGroup, setActiveGroup]     = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<string | null>(null);
  const [openDrop, setOpenDrop]           = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const isAr   = lang === "ar";

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDrop(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const openGroup = (gk: string) => {
    setOpenDrop(null);
    const grp = GROUPS.find(g => g.groupKey === gk)!;
    if (grp.tools.length === 1) { setActiveGroup(gk); setActiveTab(grp.tools[0].key); }
    else { setActiveGroup(gk); setActiveTab(null); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openTool = (key: string) => {
    setOpenDrop(null);
    const grp = findGroup(key);
    if (grp) setActiveGroup(grp.groupKey);
    setActiveTab(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (activeTab) {
      const grp = findGroup(activeTab);
      if (grp && grp.tools.length > 1) setActiveTab(null);
      else { setActiveGroup(null); setActiveTab(null); }
    } else setActiveGroup(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => { setActiveGroup(null); setActiveTab(null); setOpenDrop(null); window.scrollTo({ top: 0 }); };

  const currentGroup = activeGroup ? GROUPS.find(g => g.groupKey === activeGroup) ?? null : null;
  const currentTool  = activeTab   ? findGroup(activeTab)?.tools.find(t => t.key === activeTab) ?? null : null;
  const showBack = !!(activeGroup || activeTab);

  // ── Colors ──
  const BG    = "#f5f7ff";
  const WHITE = "#ffffff";
  const GOLD  = "#b45309";
  const NAVY  = "#1e293b";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: BG, color: NAVY, fontFamily: isAr ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}
    >
      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <header
        ref={navRef}
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: WHITE,
          borderBottom: "1.5px solid #e8ecf4",
          boxShadow: "0 2px 12px rgba(30,64,175,0.06)",
        }}
      >
        <nav style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", height: 56, gap: 6 }}>

          {/* Logo */}
          <button onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", flexShrink: 0, padding: "4px 0" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 2px 8px #C9A84C44" }}>⚖️</div>
            <span style={{ fontWeight: 900, fontSize: 17, color: GOLD, letterSpacing: "-0.01em" }}>{isAr ? "محكّم" : "Muhakkim"}</span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Nav items (desktop) */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
            {GROUPS.map(grp => (
              <div key={grp.groupKey} style={{ position: "relative" }}>
                <button
                  onClick={() => setOpenDrop(openDrop === grp.groupKey ? null : grp.groupKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "6px 9px",
                    borderRadius: 9,
                    background: openDrop === grp.groupKey ? grp.bg : "transparent",
                    border: openDrop === grp.groupKey ? `1px solid ${grp.border}` : "1px solid transparent",
                    color: openDrop === grp.groupKey ? grp.color : "#64748b",
                    fontWeight: 600, fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>{grp.icon}</span>
                  <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis" }}>{isAr ? grp.ar : grp.en}</span>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.5, transition: "transform .12s", transform: openDrop === grp.groupKey ? "rotate(180deg)" : "none" }}>
                    <path d="M1 3l4 4 4-4" />
                  </svg>
                </button>
                {openDrop === grp.groupKey && <NavDropdown grp={grp} isAr={isAr} onSelect={openTool} />}
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Controls */}
          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
            {showBack && (
              <button onClick={goBack} style={{ background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 9, color: "#374151", padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", transform: isAr ? "none" : "scaleX(-1)" }}>→</span>
                {isAr ? "رجوع" : "Back"}
              </button>
            )}
            <button
              data-testid="button-toggle-lang"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 9, color: GOLD, padding: "5px 13px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              {lang === "ar" ? "EN" : "AR"}
            </button>
          </div>
        </nav>

        {/* Breadcrumb */}
        {showBack && (
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "4px 16px 5px", display: "flex", alignItems: "center", gap: 7, background: "#fafbff", borderTop: "1px solid #eef1f8" }}>
            <button onClick={goHome} style={{ color: "#94a3b8", fontSize: 11.5, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{isAr ? "الرئيسية" : "Home"}</button>
            {currentGroup && <>
              <span style={{ color: "#cbd5e1", fontSize: 10 }}>/</span>
              <span style={{ color: currentGroup.color, fontSize: 11.5, fontWeight: 600 }}>{isAr ? currentGroup.ar : currentGroup.en}</span>
            </>}
            {currentTool && <>
              <span style={{ color: "#cbd5e1", fontSize: 10 }}>/</span>
              <span style={{ color: "#475569", fontSize: 11.5 }}>{isAr ? currentTool.ar : currentTool.en}</span>
            </>}
          </div>
        )}
      </header>

      {/* ══ HOME ════════════════════════════════════════════════════════════ */}
      {!activeGroup && !activeTab && (
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "16px 14px 40px" }} className="mhk-fade">

          {/* Title strip */}
          <div style={{ background: WHITE, border: "1.5px solid #e8ecf4", borderRadius: 16, padding: "16px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(30,64,175,0.05)" }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 3px", lineHeight: 1.2 }}>
                {isAr ? "أدوات محكّم" : "Muhakkim Tools"}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>
                {isAr ? "اختر قسماً للبدء · عربي وإنجليزي" : "Choose a section · Arabic & English"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {[
                { v: "٦", l: isAr ? "أقسام" : "Sections", bg: "#fffbeb", c: "#b45309" },
                { v: "١٢+", l: isAr ? "أداة" : "Tools",   bg: "#eff6ff", c: "#1d4ed8" },
                { v: "٢٦", l: isAr ? "مكتبة" : "Libs",    bg: "#f5f3ff", c: "#5b21b6" },
              ].map(s => (
                <div key={s.l} style={{ background: s.bg, border: `1.5px solid ${s.c}22`, borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2-column grid — all 6 sections visible */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {GROUPS.map(grp => (
              <GroupCard key={grp.groupKey} grp={grp} isAr={isAr} onClick={() => openGroup(grp.groupKey)} />
            ))}
          </div>

          {/* Quick start */}
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              onClick={() => openGroup("review")}
              style={{ background: "linear-gradient(135deg,#C9A84C,#b45309)", border: "none", borderRadius: 12, color: "#fff", padding: "11px 28px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px #C9A84C33", display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              {isAr ? "ابدأ بالتحكيم الأكاديمي" : "Start with Peer Review"}
              <span style={{ transform: isAr ? "scaleX(-1)" : "none", display: "inline-block" }}>→</span>
            </button>
          </div>
        </main>
      )}

      {/* ══ SUB-TOOL PICKER ═════════════════════════════════════════════════ */}
      {activeGroup && !activeTab && currentGroup && (
        <main className="mhk-scale" key={`grp-${activeGroup}`} style={{ maxWidth: 680, margin: "0 auto", padding: "16px 14px 40px" }}>
          {/* Group header */}
          <div style={{ background: currentGroup.bg, border: `1.5px solid ${currentGroup.border}`, borderRadius: 16, padding: "18px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, background: WHITE, border: `1.5px solid ${currentGroup.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              {currentGroup.icon}
            </div>
            <div>
              <h2 style={{ color: currentGroup.color, fontWeight: 900, fontSize: 18, margin: "0 0 4px" }}>{isAr ? currentGroup.ar : currentGroup.en}</h2>
              <p style={{ color: "#64748b", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>{isAr ? currentGroup.descAr : currentGroup.descEn}</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {currentGroup.tools.map((t, i) => (
              <ToolCard key={t.key} tool={t} grp={currentGroup} isAr={isAr} onClick={() => openTool(t.key)} idx={i} />
            ))}
          </div>
        </main>
      )}

      {/* ══ TOOL VIEW ═══════════════════════════════════════════════════════ */}
      {activeTab && (
        <div key={activeTab} className="mhk-fade" style={{ maxWidth: 960, margin: "0 auto" }}>
          {activeTab === "smartreview" && <SmartReview />}
          {activeTab === "upload"     && <FileUpload onExtracted={setExtractedText} onFileInfo={setFileInfo} extractedText={extractedText} />}
          {activeTab === "thesis"     && <ThesisRoles text={extractedText} />}
          {activeTab === "proofread"  && <Proofreader text={extractedText} />}
          {activeTab === "datalab"    && <DataHub />}
          {activeTab === "aidetect"   && <AIDetector initialText={extractedText} />}
          {activeTab === "citation"   && <CitationPlagiarism initialText={extractedText} />}
          {activeTab === "qr"         && <div style={{ padding: "24px 16px" }}><QRGenerator /></div>}
          {activeTab === "report"     && <div style={{ padding: "24px 16px" }}><ReviewReport /></div>}
          {activeTab === "discussion" && <div style={{ padding: "24px 16px" }}><DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} /></div>}
          {activeTab === "research"   && <ResearchSearch />}
          {activeTab === "about"      && <div style={{ padding: "24px 16px" }}><About /></div>}
          {activeTab === "services"   && <div style={{ padding: "24px 16px" }}><ServicesPortal /></div>}
        </div>
      )}

      {/* ── FOOTER ── */}
      {!activeTab && (
        <footer className="no-print" style={{ borderTop: "1px solid #e8ecf4", padding: "16px", textAlign: "center", background: WHITE }}>
          <p style={{ color: "#cbd5e1", fontSize: 11.5, margin: 0 }}>
            {isAr ? "محكّم · منصة التدقيق الأكاديمي الذكي · مدعومة بـ GPT‑5 · © 2025" : "Muhakkim · Smart Academic Review Platform · Powered by GPT-5 · © 2025"}
          </p>
        </footer>
      )}
    </div>
  );
}
