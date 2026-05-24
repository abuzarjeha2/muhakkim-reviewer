import { useState, useCallback } from "react";
import { useLanguage } from "../../lib/i18n";
import { useToast } from "../../hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type RoleKey = "supervisor" | "internal" | "external" | "researcher";

interface Observation {
  title: string;
  description: string;
  severity: "critical" | "major" | "minor" | "positive";
  excerpt: string;
  solution: string;
  practicalApplication: string;
}

interface Section {
  nameAr: string;
  nameEn: string;
  icon: string;
  observations: Observation[];
}

interface AnalysisResult {
  roleTitle: string;
  duties: string[];
  score: number;
  overallRating: "excellent" | "good" | "needs_minor_revision" | "needs_major_revision";
  summary: string;
  sections: Section[];
  strongPoints: string[];
  priorityActions: string[];
}

// ─── Static data ──────────────────────────────────────────────────────────────
const ROLES: { key: RoleKey; icon: string; ar: string; en: string; descAr: string; descEn: string; color: string }[] = [
  {
    key: "supervisor",
    icon: "🎓",
    ar: "المشرف الأكاديمي",
    en: "Academic Supervisor",
    descAr: "يوجّه البحث ويضمن سلامته المنهجية والعلمية طوال مراحله",
    descEn: "Guides the research and ensures methodological and scientific integrity throughout",
    color: "#C9A84C",
  },
  {
    key: "internal",
    icon: "🏛️",
    ar: "المناقش الداخلي",
    en: "Internal Examiner",
    descAr: "من نفس المؤسسة — يتحقق من الاتساق الداخلي والمعايير المؤسسية",
    descEn: "From the same institution — checks internal consistency and institutional standards",
    color: "#60a5fa",
  },
  {
    key: "external",
    icon: "🌍",
    ar: "المناقش الخارجي",
    en: "External Examiner",
    descAr: "من مؤسسة أخرى — يقيّم الإسهام العلمي والمقارنة بالمعايير الدولية",
    descEn: "From another institution — evaluates contribution and compares to international standards",
    color: "#a78bfa",
  },
  {
    key: "researcher",
    icon: "✏️",
    ar: "الباحث / الطالب",
    en: "Researcher / Student",
    descAr: "يستعدّ للمناقشة — نقاط القوة، الثغرات، والأسئلة المتوقعة",
    descEn: "Preparing for the defence — strengths, gaps, and anticipated questions",
    color: "#34d399",
  },
];

const SEVERITY_META = {
  critical: { ar: "حرجة",    en: "Critical",  color: "#ef4444", bg: "#ef444418", icon: "🔴" },
  major:    { ar: "رئيسية",  en: "Major",     color: "#f59e0b", bg: "#f59e0b18", icon: "🟠" },
  minor:    { ar: "ثانوية",  en: "Minor",     color: "#60a5fa", bg: "#60a5fa18", icon: "🔵" },
  positive: { ar: "إيجابية", en: "Positive",  color: "#10b981", bg: "#10b98118", icon: "🟢" },
};

const RATING_META = {
  excellent:               { ar: "ممتاز",            en: "Excellent",            color: "#10b981" },
  good:                    { ar: "جيد",               en: "Good",                 color: "#34d399" },
  needs_minor_revision:    { ar: "تعديلات طفيفة",    en: "Minor Revisions",      color: "#f59e0b" },
  needs_major_revision:    { ar: "تعديلات جوهرية",   en: "Major Revisions",      color: "#ef4444" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r  = 28;
  const c  = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <svg width={70} height={70} viewBox="0 0 70 70" style={{ flexShrink: 0 }}>
      <circle cx={35} cy={35} r={r} fill="none" stroke="#ffffff0d" strokeWidth={6} />
      <circle
        cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
        strokeLinecap="round" transform="rotate(-90 35 35)"
        style={{ transition: "stroke-dashoffset .8s ease" }}
      />
      <text x={35} y={39} textAnchor="middle" fill={color} fontSize={14} fontWeight={900}>{pct}</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { text: string }

export default function ThesisRoles({ text }: Props) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAr = lang === "ar";

  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<AnalysisResult | null>(null);
  const [expandedObs, setExpandedObs]   = useState<Set<string>>(new Set());
  const [expandedSec, setExpandedSec]   = useState<Set<string>>(new Set());
  const [reportMode, setReportMode]     = useState(false);

  const hasText = text.trim().length >= 100;

  const toggleObs = (id: string) =>
    setExpandedObs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSec = (id: string) =>
    setExpandedSec(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const analyse = useCallback(async (role: RoleKey) => {
    if (!hasText) {
      toast({ title: isAr ? "يرجى رفع ملف أولاً من قسم التحكيم" : "Please upload a file first from Peer Review section", variant: "destructive" });
      return;
    }
    setSelectedRole(role);
    setLoading(true);
    setResult(null);
    setExpandedObs(new Set());
    setExpandedSec(new Set());
    setReportMode(false);
    try {
      const res = await fetch("/api/thesis/roles-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, role, lang }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as AnalysisResult;
      setResult(data);
      // Auto-expand first section
      if (data.sections?.length) setExpandedSec(new Set([data.sections[0].nameEn]));
    } catch {
      toast({ title: isAr ? "فشل التحليل. حاول مرة أخرى" : "Analysis failed. Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [text, lang, isAr, toast, hasText]);

  const copyReport = () => {
    if (!result) return;
    const roleMeta = ROLES.find(r => r.key === selectedRole)!;
    const lines: string[] = [
      `═══════════════════════════════════════`,
      `تقرير تحليل الرسالة — ${roleMeta.ar}`,
      `Report: ${roleMeta.en}`,
      `═══════════════════════════════════════`,
      ``,
      `التقييم العام: ${result.score}/100`,
      `الحالة: ${RATING_META[result.overallRating]?.[isAr ? "ar" : "en"] ?? result.overallRating}`,
      ``,
      `الملخص:`,
      result.summary,
      ``,
      `نقاط القوة:`,
      ...(result.strongPoints ?? []).map(s => `  ✓ ${s}`),
      ``,
      `الإجراءات العاجلة:`,
      ...(result.priorityActions ?? []).map(a => `  ⚠ ${a}`),
      ``,
    ];
    (result.sections ?? []).forEach(sec => {
      lines.push(`─── ${isAr ? sec.nameAr : sec.nameEn} ───`);
      (sec.observations ?? []).forEach((obs, i) => {
        lines.push(`  ${i + 1}. [${obs.severity.toUpperCase()}] ${obs.title}`);
        lines.push(`     الوصف: ${obs.description}`);
        if (obs.excerpt) lines.push(`     اقتباس: "${obs.excerpt}"`);
        lines.push(`     الحل: ${obs.solution}`);
        lines.push(`     التطبيق: ${obs.practicalApplication}`);
        lines.push(``);
      });
    });
    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: isAr ? "تم نسخ التقرير" : "Report copied" });
  };

  // ── card style ──
  const card: React.CSSProperties = { background: "#0e1829", border: "1px solid #ffffff0e", borderRadius: 14 };

  return (
    <div style={{ padding: "20px 18px 60px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── Header ── */}
      <h2 style={{ color: "#C9A84C", fontWeight: 900, fontSize: 18, margin: "0 0 4px" }}>
        🎓 {isAr ? "تحليل الرسالة حسب الدور الأكاديمي" : "Thesis Analysis by Academic Role"}
      </h2>
      <p style={{ color: "#475569", fontSize: 13, margin: "0 0 6px", lineHeight: 1.7 }}>
        {isAr
          ? "اختر دورك الأكاديمي وسيحلل الذكاء الاصطناعي الرسالة من منظورك مع ملاحظات وحلول عملية مطبّقة على الملف"
          : "Select your academic role and AI will analyse the thesis from your perspective with practical observations and solutions applied to the file"}
      </p>

      {/* ── No text warning ── */}
      {!hasText && (
        <div style={{ background: "#1a1200", border: "1px solid #f59e0b33", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>
            ⚠️ {isAr ? "لم يتم رفع ملف بعد — يرجى الذهاب إلى «رفع الملف» أولاً ثم العودة هنا" : "No file uploaded yet — go to «Upload File» first, then return here"}
          </p>
        </div>
      )}

      {/* ── Role selector ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {ROLES.map(role => {
          const isActive = selectedRole === role.key;
          return (
            <button
              key={role.key}
              onClick={() => analyse(role.key)}
              disabled={loading}
              style={{
                background: isActive ? role.color + "18" : "#0e1829",
                border: `1.5px solid ${isActive ? role.color + "66" : "#ffffff0e"}`,
                borderRadius: 14, padding: "16px 14px",
                cursor: loading ? "not-allowed" : "pointer",
                textAlign: isAr ? "right" : "left",
                transition: "all .18s", outline: "none",
                opacity: loading && !isActive ? 0.5 : 1,
                boxShadow: isActive ? `0 4px 20px ${role.color}22` : "none",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = role.color + "44"; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "#ffffff0e"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: role.color + "18", border: `1px solid ${role.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{role.icon}</div>
                <div style={{ color: isActive ? role.color : "#e2e8f0", fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>
                  {isAr ? role.ar : role.en}
                </div>
              </div>
              <div style={{ color: "#475569", fontSize: 11, lineHeight: 1.6 }}>
                {isAr ? role.descAr : role.descEn}
              </div>
              {isActive && loading && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${role.color}33`, borderTopColor: role.color, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                  <span style={{ color: role.color, fontSize: 11 }}>{isAr ? "جاري التحليل…" : "Analysing…"}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 44, marginBottom: 14, animation: "pulse 1.5s ease infinite" }}>🔍</div>
          <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: 15 }}>
            {isAr ? "الذكاء الاصطناعي يحلل الرسالة…" : "AI is analysing the thesis…"}
          </p>
          <p style={{ color: "#334155", fontSize: 12, marginTop: 6 }}>
            {isAr ? "يستغرق ذلك 15–30 ثانية" : "This takes 15–30 seconds"}
          </p>
        </div>
      )}

      {/* ══════════════ RESULTS ══════════════ */}
      {!loading && result && (
        <div>
          {/* ── Summary card ── */}
          <div style={{ ...card, padding: "20px", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <ScoreRing score={result.score ?? 0} color={ROLES.find(r => r.key === selectedRole)!.color} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 900, fontSize: 16 }}>
                    {ROLES.find(r => r.key === selectedRole)?.[isAr ? "ar" : "en"]}
                  </span>
                  {result.overallRating && (
                    <span style={{
                      background: RATING_META[result.overallRating]?.color + "18",
                      color: RATING_META[result.overallRating]?.color,
                      border: `1px solid ${RATING_META[result.overallRating]?.color}33`,
                      borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                    }}>
                      {RATING_META[result.overallRating]?.[isAr ? "ar" : "en"]}
                    </span>
                  )}
                </div>
                <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.8 }}>{result.summary}</p>
              </div>
            </div>

            {/* Strong points + priority actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              {(result.strongPoints?.length > 0) && (
                <div style={{ background: "#10b98108", border: "1px solid #10b98120", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ color: "#10b981", fontWeight: 700, fontSize: 11, marginBottom: 8 }}>
                    ✅ {isAr ? "نقاط القوة" : "Strengths"}
                  </p>
                  {result.strongPoints.map((s, i) => (
                    <p key={i} style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7, marginBottom: 2 }}>• {s}</p>
                  ))}
                </div>
              )}
              {(result.priorityActions?.length > 0) && (
                <div style={{ background: "#ef444408", border: "1px solid #ef444420", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 11, marginBottom: 8 }}>
                    ⚡ {isAr ? "إجراءات عاجلة" : "Priority Actions"}
                  </p>
                  {result.priorityActions.map((a, i) => (
                    <p key={i} style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7, marginBottom: 2 }}>• {a}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Report actions ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => setReportMode(p => !p)}
              style={{ background: "#C9A84C18", border: "1px solid #C9A84C33", borderRadius: 8, padding: "7px 14px", color: "#C9A84C", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              {reportMode ? (isAr ? "📋 عرض مفصّل" : "📋 Detailed view") : (isAr ? "📄 عرض التقرير" : "📄 Report view")}
            </button>
            <button
              onClick={copyReport}
              style={{ background: "#10b98118", border: "1px solid #10b98133", borderRadius: 8, padding: "7px 14px", color: "#10b981", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              📋 {isAr ? "نسخ التقرير" : "Copy report"}
            </button>
            <button
              onClick={() => { setResult(null); setSelectedRole(null); }}
              style={{ background: "#ffffff08", border: "1px solid #ffffff11", borderRadius: 8, padding: "7px 14px", color: "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              {isAr ? "تحليل جديد" : "New analysis"}
            </button>
          </div>

          {/* ══ DETAILED SECTIONS ══ */}
          {!reportMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(result.sections ?? []).map(sec => {
                const secId  = sec.nameEn;
                const isOpen = expandedSec.has(secId);
                const roleColor = ROLES.find(r => r.key === selectedRole)!.color;
                const counts = { critical: 0, major: 0, minor: 0, positive: 0 };
                (sec.observations ?? []).forEach(o => { counts[o.severity] = (counts[o.severity] ?? 0) + 1; });

                return (
                  <div key={secId} style={{ ...card, overflow: "hidden" }}>
                    {/* Section header */}
                    <button
                      onClick={() => toggleSec(secId)}
                      style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: isAr ? "right" : "left", fontFamily: "inherit" }}
                    >
                      <span style={{ fontSize: 20 }}>{sec.icon}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, flex: 1 }}>
                        {isAr ? sec.nameAr : sec.nameEn}
                      </span>
                      {/* Severity badges */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["critical","major","minor","positive"] as const).map(sev =>
                          counts[sev] > 0 ? (
                            <span key={sev} style={{ background: SEVERITY_META[sev].bg, color: SEVERITY_META[sev].color, border: `1px solid ${SEVERITY_META[sev].color}33`, borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                              {counts[sev]}
                            </span>
                          ) : null
                        )}
                      </div>
                      <span style={{ color: roleColor, fontSize: 14, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {/* Observations */}
                    {isOpen && (
                      <div style={{ padding: "0 12px 14px" }}>
                        {(sec.observations ?? []).map((obs, oIdx) => {
                          const sev    = SEVERITY_META[obs.severity] ?? SEVERITY_META.minor;
                          const obsId  = `${secId}-${oIdx}`;
                          const obsOpen = expandedObs.has(obsId);
                          return (
                            <div key={oIdx} style={{ background: "#060d1a", border: `1px solid ${sev.color}22`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                              {/* Obs header */}
                              <button
                                onClick={() => toggleObs(obsId)}
                                style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, textAlign: isAr ? "right" : "left", fontFamily: "inherit" }}
                              >
                                <span style={{ fontSize: 14 }}>{sev.icon}</span>
                                <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12, flex: 1 }}>{obs.title}</span>
                                <span style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}33`, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                  {sev[isAr ? "ar" : "en"]}
                                </span>
                                <span style={{ color: "#475569", fontSize: 12, flexShrink: 0 }}>{obsOpen ? "▲" : "▼"}</span>
                              </button>

                              {/* Obs detail */}
                              {obsOpen && (
                                <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                                  {/* Description */}
                                  <div>
                                    <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                      📌 {isAr ? "الملاحظة" : "Observation"}
                                    </p>
                                    <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.75 }}>{obs.description}</p>
                                  </div>

                                  {/* Excerpt from text */}
                                  {obs.excerpt && obs.excerpt.trim() && (
                                    <div style={{ background: "#0a1220", border: `1px solid ${sev.color}22`, borderRadius: 8, padding: "10px 12px", borderInlineStart: `3px solid ${sev.color}` }}>
                                      <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                                        💬 {isAr ? "من النص" : "From the text"}
                                      </p>
                                      <p style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7, fontStyle: "italic" }}>«{obs.excerpt}»</p>
                                    </div>
                                  )}

                                  {/* Solution */}
                                  <div style={{ background: "#10b98108", border: "1px solid #10b98120", borderRadius: 8, padding: "10px 12px" }}>
                                    <p style={{ color: "#10b981", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                      💡 {isAr ? "الحل المقترح" : "Proposed Solution"}
                                    </p>
                                    <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.75 }}>{obs.solution}</p>
                                  </div>

                                  {/* Practical application */}
                                  <div style={{ background: "#6366f108", border: "1px solid #6366f120", borderRadius: 8, padding: "10px 12px" }}>
                                    <p style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                      ⚙️ {isAr ? "التطبيق العملي على الملف" : "Practical Application on File"}
                                    </p>
                                    <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.75 }}>{obs.practicalApplication}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ REPORT MODE — flat printable view ══ */}
          {reportMode && (
            <div style={{ ...card, padding: "22px 20px" }}>
              <div style={{ borderBottom: "1px solid #ffffff0d", paddingBottom: 14, marginBottom: 16 }}>
                <h3 style={{ color: "#C9A84C", fontWeight: 900, fontSize: 16 }}>
                  📄 {isAr ? "التقرير الكامل" : "Full Report"}
                </h3>
                <p style={{ color: "#475569", fontSize: 11 }}>
                  {ROLES.find(r => r.key === selectedRole)?.[isAr ? "ar" : "en"]} — {isAr ? `التقييم: ${result.score}/100` : `Score: ${result.score}/100`}
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                  {isAr ? "الملخص العام" : "Summary"}
                </p>
                <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.85 }}>{result.summary}</p>
              </div>

              {(result.sections ?? []).map(sec => (
                <div key={sec.nameEn} style={{ marginBottom: 18 }}>
                  <p style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13, marginBottom: 10, borderBottom: "1px solid #ffffff08", paddingBottom: 6 }}>
                    {sec.icon} {isAr ? sec.nameAr : sec.nameEn}
                  </p>
                  {(sec.observations ?? []).map((obs, i) => {
                    const sev = SEVERITY_META[obs.severity] ?? SEVERITY_META.minor;
                    return (
                      <div key={i} style={{ marginBottom: 14, paddingInlineStart: 12, borderInlineStart: `2px solid ${sev.color}44` }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12 }}>{sev.icon}</span>
                          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 12 }}>{obs.title}</span>
                          <span style={{ color: sev.color, fontSize: 10, fontWeight: 700 }}>[{sev[isAr ? "ar" : "en"]}]</span>
                        </div>
                        <p style={{ color: "#64748b", fontSize: 11, lineHeight: 1.75, marginBottom: 4 }}>{obs.description}</p>
                        {obs.excerpt && <p style={{ color: "#334155", fontSize: 11, fontStyle: "italic", marginBottom: 4 }}>«{obs.excerpt}»</p>}
                        <p style={{ color: "#10b981", fontSize: 11, lineHeight: 1.75, marginBottom: 2 }}>
                          💡 {isAr ? "الحل: " : "Solution: "}<span style={{ color: "#64748b" }}>{obs.solution}</span>
                        </p>
                        <p style={{ color: "#818cf8", fontSize: 11, lineHeight: 1.75 }}>
                          ⚙️ {isAr ? "التطبيق: " : "Apply: "}<span style={{ color: "#64748b" }}>{obs.practicalApplication}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Initial state ── */}
      {!loading && !result && (
        <div style={{ textAlign: "center", padding: "40px 16px" }}>
          <div style={{ fontSize: 50, marginBottom: 14 }}>🎓</div>
          <h3 style={{ color: "#C9A84C", fontWeight: 800, fontSize: 16, margin: "0 0 8px" }}>
            {isAr ? "اختر دورك الأكاديمي لبدء التحليل" : "Select your academic role to start the analysis"}
          </h3>
          <p style={{ color: "#334155", fontSize: 13, lineHeight: 1.8, maxWidth: 420, margin: "0 auto" }}>
            {isAr
              ? "سيحلل الذكاء الاصطناعي الرسالة من منظور كل دور ويقدم ملاحظات مفصّلة مع حلول عملية مطبّقة على محتوى الملف"
              : "AI will analyse the thesis from each role's perspective with detailed observations and practical solutions applied to the file content"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
            {ROLES.map(r => (
              <div key={r.key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24 }}>{r.icon}</div>
                <div style={{ color: r.color, fontSize: 11, marginTop: 4, fontWeight: 700 }}>{isAr ? r.ar : r.en}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
