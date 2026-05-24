import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "../lib/i18n";

import FileUpload       from "../components/muhakkim/FileUpload";
import Proofreader      from "../components/muhakkim/Proofreader";
import QRGenerator      from "../components/muhakkim/QRGenerator";
import ReviewReport     from "../components/muhakkim/ReviewReport";
import About            from "../components/muhakkim/About";
import DiscussionPanel  from "../components/muhakkim/DiscussionPanel";
import AIDetector       from "../components/muhakkim/AIDetector";
import CitationPlagiarism from "../components/muhakkim/CitationPlagiarism";
import DataHub          from "../components/muhakkim/DataHub";
import ServicesPortal   from "../components/muhakkim/ServicesPortal";
import ResearchSearch   from "../components/muhakkim/ResearchSearch";
import ThesisRoles      from "../components/muhakkim/ThesisRoles";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubTool { key: string; icon: string; ar: string; en: string; descAr: string; descEn: string; }
interface ToolGroup {
  groupKey: string; icon: string; ar: string; en: string;
  descAr: string; descEn: string; color: string; gradient: string; tools: SubTool[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const GROUPS: ToolGroup[] = [
  {
    groupKey: "review", icon: "⚖️", ar: "التحكيم الأكاديمي", en: "Peer Review",
    descAr: "رفع الأوراق البحثية وكتابة تقارير التحكيم والمناقشة",
    descEn: "Upload papers, write review reports and discussion notes",
    color: "#C9A84C", gradient: "135deg,#C9A84C22,#a0783018",
    tools: [
      { key: "upload",     icon: "📂", ar: "رفع الملف",          en: "Upload File",        descAr: "رفع PDF أو Word لاستخراج النص",                         descEn: "Upload PDF or Word to extract text" },
      { key: "thesis",     icon: "🎓", ar: "تحليل حسب الدور",   en: "Role-Based Analysis", descAr: "مشرف · مناقش داخلي · خارجي · باحث — تحليل وحلول عملية", descEn: "Supervisor · Internal · External · Researcher" },
      { key: "report",     icon: "📋", ar: "تقرير التحكيم",      en: "Review Report",       descAr: "إنشاء تقرير تحكيم منظّم ومفصّل",                        descEn: "Generate a structured review report" },
      { key: "discussion", icon: "💬", ar: "لوحة المناقشة",      en: "Discussion Panel",    descAr: "تدوين ملاحظات ونقاط النقاش",                            descEn: "Take discussion notes on the paper" },
    ],
  },
  {
    groupKey: "writing", icon: "✍️", ar: "اللغة والكتابة", en: "Language & Writing",
    descAr: "تدقيق لغوي بالذكاء الاصطناعي، قاموس، تلخيص، واقتباس وانتحال",
    descEn: "AI proofreading, dictionary, summarisation, citation & plagiarism",
    color: "#60a5fa", gradient: "135deg,#60a5fa20,#3b82f618",
    tools: [
      { key: "proofread", icon: "📝", ar: "التدقيق اللغوي", en: "Proofreader",           descAr: "تدقيق عميق بالذكاء الاصطناعي وقاموس وتلخيص", descEn: "Deep AI proofread, dictionary & summarise" },
      { key: "citation",  icon: "📖", ar: "اقتباس وانتحال", en: "Citation & Plagiarism", descAr: "تنسيق المراجع وكشف الانتحال",                 descEn: "Format references & detect plagiarism" },
    ],
  },
  {
    groupKey: "aidetect", icon: "🛡️", ar: "كشف الذكاء الاصطناعي", en: "AI Detection",
    descAr: "كشف النصوص المولّدة بالذكاء الاصطناعي في الأوراق البحثية",
    descEn: "Detect AI-generated content in research papers",
    color: "#34d399", gradient: "135deg,#34d39920,#10b98118",
    tools: [
      { key: "aidetect", icon: "🛡️", ar: "كشف AI", en: "AI Detector", descAr: "تحليل النص وتحديد نسبة الاصطناعي", descEn: "Analyse text and identify AI-written sections" },
    ],
  },
  {
    groupKey: "data", icon: "📊", ar: "تحليل البيانات والإحصاء", en: "Data & Statistics",
    descAr: "مختبر البيانات التفاعلي والخدمات الإحصائية المتخصصة",
    descEn: "Interactive data lab and specialised statistical services",
    color: "#38bdf8", gradient: "135deg,#38bdf820,#0ea5e918",
    tools: [
      { key: "datalab",  icon: "🔬", ar: "مختبر البيانات",    en: "Data Lab",      descAr: "تحليل ورسم البيانات وإنشاء الجداول",  descEn: "Analyse, chart and tabulate data" },
      { key: "services", icon: "🏢", ar: "خدماتنا الإحصائية", en: "Our Services",  descAr: "خدمات التحليل الإحصائي الاحترافي",   descEn: "Professional statistical analysis services" },
    ],
  },
  {
    groupKey: "research", icon: "🔭", ar: "البحث العلمي والمكتبات", en: "Research & Libraries",
    descAr: "بحث في ملايين الأوراق البحثية و٢٦ مكتبة رقمية عربية ودولية",
    descEn: "Search millions of papers and 26 Arabic & international digital libraries",
    color: "#a78bfa", gradient: "135deg,#a78bfa20,#7c3aed18",
    tools: [
      { key: "research", icon: "🔭", ar: "البحث والمكتبات", en: "Research & Libraries", descAr: "Semantic Scholar · OpenAlex · CrossRef · ٢٦ مكتبة", descEn: "Semantic Scholar · OpenAlex · CrossRef · 26 libraries" },
    ],
  },
  {
    groupKey: "utilities", icon: "🛠️", ar: "أدوات متنوعة", en: "Utilities",
    descAr: "مولّد رمز QR ومعلومات عن البرنامج",
    descEn: "QR code generator and app information",
    color: "#e879f9", gradient: "135deg,#e879f920,#a855f718",
    tools: [
      { key: "qr",    icon: "📷", ar: "مولّد QR",    en: "QR Generator", descAr: "توليد رموز QR للروابط والنصوص", descEn: "Generate QR codes for links & text" },
      { key: "about", icon: "ℹ️",  ar: "عن البرنامج", en: "About",         descAr: "معلومات ومميزات منصة محكّم",    descEn: "About the Muhakkim platform" },
    ],
  },
];

const findGroup = (toolKey: string) => GROUPS.find(g => g.tools.some(t => t.key === toolKey)) ?? null;

// ─── 3D card tilt ────────────────────────────────────────────────────────────
function useTilt(strength = 10) {
  const ref = useRef<HTMLDivElement | HTMLButtonElement>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    const rotY = ((x - cx) / cx) * strength;
    const rotX = -((y - cy) / cy) * strength;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(10px)`;
  }, [strength]);
  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
  }, []);
  return { ref, onMove, onLeave };
}

// ─── Animated background orbs ────────────────────────────────────────────────
function BgOrbs() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "8%",  left: "12%",  width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,#C9A84C22 0%,transparent 70%)", animation: "orb1 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "55%", right: "8%",  width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,#a78bfa1a 0%,transparent 70%)", animation: "orb2 22s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "30%", left: "55%",  width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,#38bdf81a 0%,transparent 70%)", animation: "orb3 16s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 60%,#050913 100%)" }} />
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ icon, val, label }: { icon: string; val: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, backdropFilter: "blur(10px)" }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 20, fontWeight: 900, color: "#C9A84C", lineHeight: 1 }}>{val}</span>
      <span style={{ fontSize: 10, color: "#475569", fontWeight: 600, textAlign: "center" }}>{label}</span>
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ grp, isAr, onClick, delay }: { grp: ToolGroup; isAr: boolean; onClick: () => void; delay: number }) {
  const { ref, onMove, onLeave } = useTilt(7);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      className="card-3d"
      data-testid={`group-${grp.groupKey}`}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={() => { onLeave(); setHovered(false); }}
      onMouseEnter={() => setHovered(true)}
      style={{
        background: hovered ? `linear-gradient(${grp.gradient})` : "rgba(14,24,41,0.85)",
        border: `1.5px solid ${hovered ? grp.color + "55" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 20,
        padding: "24px 20px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 14,
        boxShadow: hovered ? `0 20px 60px ${grp.color}18, 0 0 0 1px ${grp.color}22 inset` : "0 4px 20px rgba(0,0,0,0.3)",
        backdropFilter: "blur(12px)",
        textAlign: "start",
        outline: "none",
        width: "100%",
        animationDelay: `${delay}s`,
      } as React.CSSProperties}
    >
      {/* Icon with glow ring */}
      <div style={{ position: "relative", width: 54, height: 54 }}>
        <div style={{
          position: "absolute", inset: -4, borderRadius: "50%",
          background: grp.color + "18",
          opacity: hovered ? 1 : 0,
          transition: "opacity .2s",
          animation: hovered ? "pulse-ring 1.4s ease-out infinite" : "none",
        }} />
        <div style={{
          width: 54, height: 54, borderRadius: 15,
          background: `linear-gradient(135deg,${grp.color}28,${grp.color}10)`,
          border: `1.5px solid ${grp.color}35`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
          boxShadow: hovered ? `0 0 20px ${grp.color}30` : "none",
          transition: "box-shadow .2s",
        }}>
          {grp.icon}
        </div>
      </div>

      {/* Label */}
      <div>
        <div style={{ color: hovered ? grp.color : "#e2e8f0", fontWeight: 800, fontSize: 14, lineHeight: 1.4, marginBottom: 5, transition: "color .15s" }}>
          {isAr ? grp.ar : grp.en}
        </div>
        <div style={{ color: "#475569", fontSize: 11.5, lineHeight: 1.65 }}>
          {isAr ? grp.descAr : grp.descEn}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        {grp.tools.length > 1 ? (
          <span style={{ background: grp.color + "15", border: `1px solid ${grp.color}25`, borderRadius: 7, padding: "3px 9px", color: grp.color, fontSize: 10, fontWeight: 700 }}>
            {grp.tools.length} {isAr ? "أدوات" : "tools"}
          </span>
        ) : <span />}
        <span style={{ color: hovered ? grp.color : "#334155", fontSize: 16, transition: "color .15s, transform .15s", display: "inline-block", transform: `translateX(${hovered ? (isAr ? -4 : 4) : 0}px)` }}>
          {isAr ? "←" : "→"}
        </span>
      </div>
    </button>
  );
}

// ─── Navbar dropdown ──────────────────────────────────────────────────────────
function NavDropdown({ grp, isAr, onSelect }: { grp: ToolGroup; isAr: boolean; onSelect: (key: string) => void }) {
  return (
    <div className="mhk-dropdown" style={{ minWidth: 240 }}>
      <div style={{ padding: "6px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: grp.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {isAr ? grp.ar : grp.en}
        </span>
      </div>
      {grp.tools.map(t => (
        <button key={t.key} className="mhk-drop-item" onClick={() => onSelect(t.key)}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: grp.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
          <div style={{ textAlign: isAr ? "right" : "left" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{isAr ? t.ar : t.en}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{isAr ? t.descAr : t.descEn}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Tool Card (sub-picker) ───────────────────────────────────────────────────
function ToolCard({ tool, group, isAr, idx, onClick }: { tool: SubTool; group: ToolGroup; isAr: boolean; idx: number; onClick: () => void }) {
  const { ref, onMove, onLeave } = useTilt(4);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      className="card-3d"
      data-testid={`tab-${tool.key}`}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { onLeave(); setHovered(false); }}
      style={{
        background: hovered ? `rgba(14,24,41,0.98)` : "rgba(14,24,41,0.85)",
        border: `1.5px solid ${hovered ? group.color + "55" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 16, padding: "18px 20px",
        display: "flex", alignItems: "center", gap: 16,
        cursor: "pointer", outline: "none",
        backdropFilter: "blur(10px)",
        width: "100%", textAlign: "start",
        boxShadow: hovered ? `0 8px 32px ${group.color}14` : "none",
        animationDelay: `${idx * 0.06}s`,
        transition: "border-color .15s, box-shadow .15s, background .15s",
        fontFamily: "inherit",
      } as React.CSSProperties}
    >
      <div style={{ width: 50, height: 50, borderRadius: 14, background: group.color + "18", border: `1px solid ${group.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: hovered ? `0 0 16px ${group.color}22` : "none", transition: "box-shadow .15s" }}>
        {tool.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: hovered ? group.color : "#e2e8f0", fontWeight: 800, fontSize: 15, marginBottom: 4, transition: "color .15s" }}>{isAr ? tool.ar : tool.en}</div>
        <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.65 }}>{isAr ? tool.descAr : tool.descEn}</div>
      </div>
      <span style={{ color: group.color, fontSize: 20, opacity: hovered ? 0.9 : 0.4, flexShrink: 0, transition: "opacity .15s, transform .15s", display: "inline-block", transform: `translateX(${hovered ? (isAr ? -4 : 4) : 0}px)` }}>
        {isAr ? "←" : "→"}
      </span>
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
  const [scrolled, setScrolled]           = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const isAr = lang === "ar";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDrop(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
      if (grp && grp.tools.length > 1) { setActiveTab(null); }
      else { setActiveGroup(null); setActiveTab(null); }
    } else { setActiveGroup(null); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => { setActiveGroup(null); setActiveTab(null); setOpenDrop(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const currentGroup = activeGroup ? GROUPS.find(g => g.groupKey === activeGroup) ?? null : null;
  const currentTool  = activeTab   ? findGroup(activeTab)?.tools.find(t => t.key === activeTab) ?? null : null;
  const showBack = !!(activeGroup || activeTab);

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#050913", color: "#e2e8f0", fontFamily: isAr ? "'Tajawal',sans-serif" : "'Inter',sans-serif", position: "relative" }}>
      <BgOrbs />

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <header
        ref={navRef}
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: scrolled ? "rgba(5,9,19,0.95)" : "rgba(5,9,19,0.7)",
          backdropFilter: "blur(24px) saturate(1.4)",
          borderBottom: `1px solid ${scrolled ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)"}`,
          transition: "background .2s, border-color .2s",
          padding: "0 24px",
        }}
      >
        <nav style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", height: 64, gap: 8 }}>

          {/* Logo */}
          <button onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "none", border: "none", color: "inherit", fontFamily: "inherit", flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: "linear-gradient(135deg,#C9A84C,#a07830)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: "0 0 16px #C9A84C44",
            }}>⚖️</div>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#C9A84C", letterSpacing: "-0.02em" }}>
              {isAr ? "محكّم" : "Muhakkim"}
            </span>
          </button>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Nav links (desktop) */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {GROUPS.map(grp => (
              <div key={grp.groupKey} style={{ position: "relative" }}>
                <button
                  onClick={() => setOpenDrop(openDrop === grp.groupKey ? null : grp.groupKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: openDrop === grp.groupKey ? grp.color + "12" : "transparent",
                    border: "none", cursor: "pointer",
                    color: openDrop === grp.groupKey ? grp.color : "#64748b",
                    fontWeight: 600, fontSize: 13,
                    fontFamily: "inherit", transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = grp.color + "10"; e.currentTarget.style.color = grp.color; }}
                  onMouseLeave={e => { if (openDrop !== grp.groupKey) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
                >
                  <span style={{ fontSize: 15 }}>{grp.icon}</span>
                  <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isAr ? grp.ar : grp.en}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5, transition: "transform .15s", transform: openDrop === grp.groupKey ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
                {openDrop === grp.groupKey && (
                  <NavDropdown grp={grp} isAr={isAr} onSelect={openTool} />
                )}
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {showBack && (
              <button onClick={goBack} style={{
                background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 10, color: "#C9A84C", padding: "7px 14px",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ display: "inline-block", transform: isAr ? "none" : "scaleX(-1)" }}>→</span>
                {isAr ? "رجوع" : "Back"}
              </button>
            )}
            <button
              data-testid="button-toggle-lang"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              style={{
                background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.22)",
                borderRadius: 10, color: "#C9A84C", padding: "7px 16px",
                fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {lang === "ar" ? "EN" : "AR"}
            </button>
          </div>
        </nav>

        {/* Breadcrumb bar */}
        {showBack && (
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={goHome} style={{ color: "#334155", fontSize: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {isAr ? "الرئيسية" : "Home"}
            </button>
            {currentGroup && <>
              <span style={{ color: "#1e2d40", fontSize: 11 }}>/</span>
              <button onClick={() => currentGroup.tools.length > 1 ? (() => { setActiveTab(null); window.scrollTo({ top:0 }); })() : undefined}
                style={{ color: currentGroup.color + "99", fontSize: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {isAr ? currentGroup.ar : currentGroup.en}
              </button>
            </>}
            {currentTool && <>
              <span style={{ color: "#1e2d40", fontSize: 11 }}>/</span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{isAr ? currentTool.ar : currentTool.en}</span>
            </>}
          </div>
        )}
      </header>

      {/* ══ HOME ═══════════════════════════════════════════════════════════════ */}
      {!activeGroup && !activeTab && (
        <main style={{ position: "relative", zIndex: 1 }}>

          {/* ── HERO ── */}
          <section style={{ padding: isAr ? "80px 24px 60px" : "80px 24px 60px", maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
            {/* Badge */}
            <div className="mhk-fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C9A84C", display: "inline-block", boxShadow: "0 0 8px #C9A84C" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.06em" }}>
                {isAr ? "منصة التحكيم الأكاديمي الذكي" : "SMART ACADEMIC REVIEW PLATFORM"}
              </span>
            </div>

            {/* Headline */}
            <h1 className="mhk-fade-up" style={{ fontSize: "clamp(32px,6vw,64px)", fontWeight: 900, lineHeight: 1.15, marginBottom: 22, letterSpacing: "-0.03em", animationDelay: ".05s" }}>
              <span style={{ color: "#f1f5f9" }}>{isAr ? "ارتقِ ببحثك مع " : "Elevate your research\nwith "}</span>
              <span className="grad-text">{isAr ? "محكّم" : "Muhakkim"}</span>
            </h1>

            <p className="mhk-fade-up" style={{ fontSize: 17, color: "#64748b", maxWidth: 620, margin: "0 auto 44px", lineHeight: 1.8, animationDelay: ".1s" }}>
              {isAr
                ? "ستة أقسام متكاملة — تحكيم أكاديمي، تدقيق لغوي، كشف AI، تحليل بيانات، بحث علمي، وأدوات ذكية — مدعومة بأحدث نماذج الذكاء الاصطناعي"
                : "Six integrated modules — peer review, proofreading, AI detection, data analysis, research search, and smart tools — powered by the latest AI models"}
            </p>

            {/* CTA row */}
            <div className="mhk-fade-up" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 60, animationDelay: ".15s" }}>
              <button onClick={() => openGroup("review")}
                style={{
                  padding: "14px 32px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: "linear-gradient(135deg,#C9A84C,#a07830)",
                  color: "#050913", fontWeight: 800, fontSize: 15,
                  boxShadow: "0 8px 32px #C9A84C33",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                {isAr ? "ابدأ الآن" : "Get Started"} →
              </button>
              <button onClick={() => openGroup("research")}
                style={{
                  padding: "14px 32px", borderRadius: 14,
                  border: "1.5px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(10px)",
                  color: "#94a3b8", fontWeight: 700, fontSize: 15,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                {isAr ? "استكشف المكتبات" : "Explore Libraries"}
              </button>
            </div>

            {/* Stats row */}
            <div className="mhk-fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 10, maxWidth: 640, margin: "0 auto", animationDelay: ".2s" }}>
              <StatPill icon="🎓" val="6" label={isAr ? "أقسام رئيسية" : "Main Sections"} />
              <StatPill icon="🛠️" val="12+" label={isAr ? "أداة ذكية" : "Smart Tools"} />
              <StatPill icon="📚" val="26" label={isAr ? "مكتبة رقمية" : "Digital Libraries"} />
              <StatPill icon="🤖" val="GPT‑5" label={isAr ? "نموذج AI" : "AI Model"} />
              <StatPill icon="🌐" val="2" label={isAr ? "لغة (عربي/إنجليزي)" : "Languages"} />
            </div>
          </section>

          {/* ── SECTION TITLE ── */}
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ color: "#e2e8f0", fontWeight: 900, fontSize: 22, margin: "0 0 4px" }}>
                {isAr ? "الأقسام والأدوات" : "Sections & Tools"}
              </h2>
              <p style={{ color: "#334155", fontSize: 13, margin: 0 }}>
                {isAr ? "اختر قسماً أو استخدم القائمة في الأعلى" : "Select a section or use the top navigation"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {GROUPS.map(g => (
                <div key={g.groupKey} style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, opacity: 0.6 }} />
              ))}
            </div>
          </div>

          {/* ── CARDS GRID ── */}
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 100px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
              {GROUPS.map((grp, idx) => (
                <div key={grp.groupKey} className="mhk-fade-up" style={{ animationDelay: `${0.08 + idx * 0.07}s` }}>
                  <GroupCard grp={grp} isAr={isAr} onClick={() => openGroup(grp.groupKey)} delay={0} />
                </div>
              ))}
            </div>

            {/* Bottom hint */}
            <div style={{ marginTop: 40, textAlign: "center" }}>
              <button onClick={() => openGroup("review")}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, color: "#C9A84C", fontSize: 14, fontWeight: 700 }}>
                {isAr ? "ابدأ برفع ملفك الأول" : "Start by uploading your first file"}
                <span style={{ display: "inline-block", transform: isAr ? "scaleX(-1)" : "none" }}>→</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ══ SUB-TOOL PICKER ═══════════════════════════════════════════════════ */}
      {activeGroup && !activeTab && currentGroup && (
        <main className="mhk-scale-in" key={`grp-${activeGroup}`} style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "40px 24px 100px" }}>
          {/* Group hero */}
          <div style={{
            background: `linear-gradient(135deg,${currentGroup.color}12,${currentGroup.color}05)`,
            border: `1.5px solid ${currentGroup.color}22`,
            borderRadius: 24, padding: "32px 28px", marginBottom: 28,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -40, right: isAr ? "auto" : -40, left: isAr ? -40 : "auto", width: 200, height: 200, borderRadius: "50%", background: currentGroup.color + "08" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: `linear-gradient(135deg,${currentGroup.color}30,${currentGroup.color}15)`, border: `1.5px solid ${currentGroup.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, boxShadow: `0 8px 28px ${currentGroup.color}20` }}>
                {currentGroup.icon}
              </div>
              <div>
                <h2 style={{ color: currentGroup.color, fontWeight: 900, fontSize: 22, margin: "0 0 6px" }}>
                  {isAr ? currentGroup.ar : currentGroup.en}
                </h2>
                <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                  {isAr ? currentGroup.descAr : currentGroup.descEn}
                </p>
              </div>
            </div>
          </div>

          {/* Tool list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {currentGroup.tools.map((tool, idx) => (
              <ToolCard key={tool.key} tool={tool} group={currentGroup} isAr={isAr} idx={idx} onClick={() => openTool(tool.key)} />
            ))}
          </div>
        </main>
      )}

      {/* ══ TOOL VIEW ════════════════════════════════════════════════════════ */}
      {activeTab && (
        <div className="mhk-fade-in" key={activeTab} style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
          {activeTab === "upload"     && <FileUpload onExtracted={setExtractedText} onFileInfo={setFileInfo} extractedText={extractedText} />}
          {activeTab === "thesis"     && <ThesisRoles text={extractedText} />}
          {activeTab === "proofread"  && <Proofreader text={extractedText} />}
          {activeTab === "datalab"    && <DataHub />}
          {activeTab === "aidetect"   && <AIDetector initialText={extractedText} />}
          {activeTab === "citation"   && <CitationPlagiarism initialText={extractedText} />}
          {activeTab === "qr"         && <div style={{ padding: "28px 20px" }}><QRGenerator /></div>}
          {activeTab === "report"     && <div style={{ padding: "28px 20px" }}><ReviewReport /></div>}
          {activeTab === "discussion" && <div style={{ padding: "28px 20px" }}><DiscussionPanel text={extractedText} fileName={fileInfo?.name ?? ""} /></div>}
          {activeTab === "research"   && <ResearchSearch />}
          {activeTab === "about"      && <div style={{ padding: "28px 20px" }}><About /></div>}
          {activeTab === "services"   && <div style={{ padding: "28px 20px" }}><ServicesPortal /></div>}
        </div>
      )}

      {/* ── FOOTER ── */}
      {!activeTab && (
        <footer className="no-print" style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.04)", padding: "28px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#C9A84C,#a07830)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⚖️</div>
            <span style={{ fontWeight: 900, fontSize: 15, color: "#C9A84C" }}>{isAr ? "محكّم" : "Muhakkim"}</span>
          </div>
          <p style={{ color: "#1e2d40", fontSize: 12, margin: 0 }}>
            {isAr ? "منصة التدقيق الأكاديمي الذكي · مدعومة بـ GPT‑5 · © 2025" : "Smart Academic Review Platform · Powered by GPT-5 · © 2025"}
          </p>
        </footer>
      )}
    </div>
  );
}
