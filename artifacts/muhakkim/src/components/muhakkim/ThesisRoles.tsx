import { useState, useRef, useCallback } from "react";
import { useLanguage } from "../../lib/i18n";
import { useToast } from "../../hooks/use-toast";

// ─── Static role data ─────────────────────────────────────────────────────────
const ROLES = {
  researcher: {
    id: "researcher", ar: "الباحث", en: "Researcher", icon: "✍️", color: "#C9A84C",
    tasks: [
      "صياغة فصول الرسالة وفق المعايير الأكاديمية المعتمدة",
      "الالتزام بالمنهجية العلمية المعتمدة في التخصص",
      "توثيق المصادر والمراجع بدقة وفق نظام الاقتباس المعتمد",
      "تطوير فرضيات البحث والعمل على إثباتها بالأدلة والبيانات",
      "تقديم الرسالة في الموعد المحدد وفق اشتراطات القسم",
      "الرد على ملاحظات المناقشين وتطبيق التعديلات المطلوبة",
    ],
  },
  internal: {
    id: "internal", ar: "المناقش الداخلي", en: "Internal Examiner", icon: "🏛️", color: "#a78bfa",
    tasks: [
      "مراجعة الرسالة داخلياً وفق معايير الجامعة والقسم",
      "تقييم المنهجية والإطار النظري ومدى ملاءمتهما للموضوع",
      "فحص الاتساق المنطقي بين الفصول والأهداف والنتائج",
      "التحقق من أصالة البحث وغياب الانتحال الأكاديمي",
      "إعداد تقرير تقييمي مفصّل قبل جلسة المناقشة",
      "المشاركة الفاعلة في جلسة المناقشة العلنية وتوجيه الأسئلة",
    ],
  },
  external: {
    id: "external", ar: "المناقش الخارجي", en: "External Examiner", icon: "🌍", color: "#34d399",
    tasks: [
      "تقييم الرسالة من منظور خارجي محايد ومستقل",
      "مقارنة البحث بالدراسات الإقليمية والدولية في المجال",
      "تقييم مستوى الإسهام العلمي الأصيل في المعرفة",
      "فحص القيمة العلمية والتطبيقية للبحث وإمكانية نشره",
      "إعداد تقرير مستقل ومفصّل يرفع للجنة العلمية",
      "طرح أسئلة علمية متخصصة وتقييم ردود الباحث",
    ],
  },
};

const DIMS = [
  { id: "structure",    arLabel: "البنية والتنظيم",      enLabel: "Structure" },
  { id: "methodology",  arLabel: "المنهجية العلمية",      enLabel: "Methodology" },
  { id: "content",      arLabel: "جودة المحتوى",          enLabel: "Content Quality" },
  { id: "language",     arLabel: "اللغة والأسلوب",        enLabel: "Language & Style" },
  { id: "references",   arLabel: "التوثيق والمراجع",      enLabel: "References" },
];

const PROCESS_STEPS = [
  { step: 1, arTitle: "تقديم الرسالة",     enTitle: "Submission",          arDesc: "الباحث يرفع النسخة النهائية",     color: "#C9A84C" },
  { step: 2, arTitle: "المراجعة الأولية",  enTitle: "Initial Review",      arDesc: "فحص الاستيفاء الشكلي",            color: "#60a5fa" },
  { step: 3, arTitle: "التحكيم الداخلي",   enTitle: "Internal Examination", arDesc: "تقييم المناقش الداخلي",           color: "#a78bfa" },
  { step: 4, arTitle: "التحكيم الخارجي",   enTitle: "External Examination", arDesc: "تقييم المناقش الخارجي",           color: "#34d399" },
  { step: 5, arTitle: "المناقشة العلنية",  enTitle: "Public Defence",       arDesc: "جلسة المناقشة والدفاع",           color: "#f59e0b" },
  { step: 6, arTitle: "التعديلات النهائية", enTitle: "Final Revisions",     arDesc: "تطبيق الملاحظات والقبول",         color: "#10b981" },
];

const SEV_META = {
  critical: { ar: "حرجة",   en: "Critical",  color: "#ef4444", bg: "#ef444414" },
  major:    { ar: "رئيسية", en: "Major",     color: "#f59e0b", bg: "#f59e0b14" },
  minor:    { ar: "ثانوية", en: "Minor",     color: "#10b981", bg: "#10b98114" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Observation {
  severity: "critical" | "major" | "minor";
  page?: string;
  section?: string;
  observation: string;
  explanation?: string;
  solution?: string;
  example?: string;
}
interface RoleReport {
  overallScore: number;
  scores: Record<string, number>;
  summary: string;
  observations: Observation[];
  strongPoints: string[];
  recommendation: string;
}
type Results = Record<string, RoleReport>;

// ─── Sub-components ───────────────────────────────────────────────────────────
function ObsCard({ obs, i, color, isAr }: { obs: Observation; i: number; color: string; isAr: boolean }) {
  const [open, setOpen] = useState(false);
  const sev = SEV_META[obs.severity] ?? SEV_META.minor;
  return (
    <div style={{ background: "#060d1a", border: `1px solid ${sev.color}25`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: color + "20", color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{i + 1}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: sev.bg, color: sev.color, padding: "2px 8px", borderRadius: 5, border: `1px solid ${sev.color}33` }}>
              {isAr ? sev.ar : sev.en}
            </span>
            {obs.page    && <span style={{ fontSize: 10, color: "#475569" }}>📄 {isAr ? "ص" : "p."} {obs.page}</span>}
            {obs.section && <span style={{ fontSize: 10, color: "#475569" }}>📌 {obs.section}</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.65 }}>{obs.observation}</p>
        </div>
        <span style={{ color: "#334155", fontSize: 12, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {obs.explanation && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>📋 {isAr ? "التفسير التفصيلي" : "Detailed Explanation"}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.75, margin: 0 }}>{obs.explanation}</p>
            </div>
          )}
          {obs.solution && (
            <div style={{ background: "#10b98110", border: "1px solid #10b98125", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>✅ {isAr ? "الحل العملي المقترح" : "Proposed Practical Solution"}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.75, margin: 0 }}>{obs.solution}</p>
            </div>
          )}
          {obs.example && (
            <div style={{ background: color + "0c", border: `1px solid ${color}22`, borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>💡 {isAr ? "مثال تطبيقي" : "Applied Example"}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.75, margin: 0, fontFamily: "monospace" }}>{obs.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DimBar({ label, score, color }: { label: string; score: number; color: string }) {
  const c = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ background: "#060d1a", border: "1px solid #ffffff08", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 900, color: c, marginBottom: 2 }}>{score}%</div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 6 }}>{label}</div>
      <div style={{ height: 4, background: "#0e1829", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: c, borderRadius: 2, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const [c, label] = score >= 85 ? ["#10b981", "ممتاز"] : score >= 70 ? ["#f59e0b", "جيد جداً"] : score >= 55 ? ["#ef4444", "مقبول"] : ["#7f1d1d", "يحتاج تحسين"];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c + "18", border: `1.5px solid ${c}40`, borderRadius: 8, padding: "4px 12px", color: c, fontWeight: 700, fontSize: 14 }}>
      <span>{score}%</span>
      <span style={{ fontSize: 11, opacity: 0.8 }}>{label}</span>
    </div>
  );
}

function ReportCard({ roleId, report, isAr }: { roleId: string; report: RoleReport; isAr: boolean }) {
  const ri = ROLES[roleId as keyof typeof ROLES];
  if (!ri || !report) return null;
  return (
    <div style={{ background: "#0e1829", border: `1.5px solid ${ri.color}22`, borderRadius: 16, overflow: "hidden", marginBottom: 18 }}>
      {/* Header */}
      <div style={{ background: ri.color + "0e", borderBottom: `1px solid ${ri.color}20`, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: ri.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{ri.icon}</span>
          <div>
            <h3 style={{ margin: 0, color: ri.color, fontSize: 16, fontWeight: 800 }}>{isAr ? `تقرير ${ri.ar}` : `${ri.en} Report`}</h3>
            <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{isAr ? ri.en : ri.ar}</p>
          </div>
        </div>
        {report.overallScore != null && <ScoreBadge score={report.overallScore} />}
      </div>
      <div style={{ padding: "18px 20px" }}>
        {/* Dim scores */}
        {report.scores && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ color: "#475569", fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>📊 {isAr ? "التقييم التفصيلي" : "Detailed Scores"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8 }}>
              {DIMS.map(d => (
                <DimBar key={d.id} label={isAr ? d.arLabel : d.enLabel} score={report.scores[d.id] ?? 0} color={ri.color} />
              ))}
            </div>
          </div>
        )}
        {/* Summary */}
        {report.summary && (
          <div style={{ background: ri.color + "0a", border: `1px solid ${ri.color}18`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ color: ri.color, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📝 {isAr ? "الخلاصة التقييمية" : "Assessment Summary"}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>{report.summary}</p>
          </div>
        )}
        {/* Strong points */}
        {report.strongPoints?.length > 0 && (
          <div style={{ background: "#10b98108", border: "1px solid #10b98120", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ color: "#10b981", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>✅ {isAr ? "نقاط القوة" : "Strong Points"}</p>
            {report.strongPoints.map((s, i) => (
              <p key={i} style={{ color: "#64748b", fontSize: 12, lineHeight: 1.7, margin: "0 0 2px" }}>• {s}</p>
            ))}
          </div>
        )}
        {/* Observations */}
        {report.observations?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: "#475569", fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
              🔍 {isAr ? `الملاحظات والتوصيات (${report.observations.length})` : `Observations & Recommendations (${report.observations.length})`}
            </p>
            {report.observations.map((obs, i) => (
              <ObsCard key={i} obs={obs} i={i} color={ri.color} isAr={isAr} />
            ))}
          </div>
        )}
        {/* Recommendation */}
        {report.recommendation && (
          <div style={{ background: "#0e1829", border: "1.5px solid #ffffff0d", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🎯 {isAr ? "التوصية النهائية" : "Final Recommendation"}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{report.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tasks View ───────────────────────────────────────────────────────────────
function TasksView({ isAr }: { isAr: boolean }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <p style={{ color: "#475569", fontSize: 13, marginBottom: 22, lineHeight: 1.7 }}>
        {isAr
          ? "دليل شامل لأدوار ومسؤوليات جميع أطراف مناقشة رسائل الدكتوراه والماجستير"
          : "Comprehensive guide to the roles and responsibilities of all parties in thesis defence"}
      </p>
      {/* Role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14, marginBottom: 28 }}>
        {Object.values(ROLES).map(role => (
          <div key={role.id} style={{ background: "#0e1829", border: `1.5px solid ${role.color}22`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ background: role.color + "0e", borderBottom: `1px solid ${role.color}18`, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: role.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{role.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: role.color }}>{role.ar}</h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{role.en}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {isAr ? "المهام والمسؤوليات" : "Tasks & Responsibilities"}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {role.tasks.map((task, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderBottom: i < role.tasks.length - 1 ? "1px solid #ffffff07" : "none" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: role.color + "20", color: role.color, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65 }}>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Process flowchart */}
      <div style={{ background: "#0e1829", border: "1.5px solid #ffffff0d", borderRadius: 16, padding: "20px 18px" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: "#e2e8f0", textAlign: "center" }}>
          🔄 {isAr ? "مراحل عملية التحكيم الأكاديمي" : "Academic Review Process Stages"}
        </h3>
        <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 6, justifyContent: "center", flexWrap: "wrap", rowGap: 12 }}>
          {PROCESS_STEPS.map((s, i) => (
            <div key={s.step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div style={{ textAlign: "center", minWidth: 100 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: s.color, color: "#080e1c", fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 7px", boxShadow: `0 4px 12px ${s.color}44` }}>{s.step}</div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: s.color }}>{isAr ? s.arTitle : s.enTitle}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#334155" }}>{s.arDesc}</p>
              </div>
              {i < PROCESS_STEPS.length - 1 && (
                <div style={{ width: 22, height: 2, background: "#ffffff0d", margin: "0 2px", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Analysis View ────────────────────────────────────────────────────────────
function AnalysisView({ propText, isAr, toast }: { propText: string; isAr: boolean; toast: ReturnType<typeof import("../../hooks/use-toast").useToast>["toast"] }) {
  const [file, setFile]       = useState<File | null>(null);
  const [localText, setLocalText] = useState("");
  const [title, setTitle]     = useState("");
  const [degree, setDegree]   = useState<"doctorate" | "master">("doctorate");
  const [selected, setSelected] = useState<string[]>(["researcher", "internal", "external"]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: "", pct: 0 });
  const [results, setResults] = useState<{ reports: Results; at: string } | null>(null);
  const [error, setError]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (id: string) =>
    setSelected(p => p.includes(id) ? p.filter(r => r !== id) : [...p, id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    if (f.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = () => setLocalText(reader.result as string);
      reader.readAsText(f, "utf-8");
    }
  };

  const analyze = async () => {
    const textToUse = propText.trim() || localText.trim();
    const ctx = textToUse
      ? textToUse.slice(0, 6000)
      : file
        ? `[ملف: ${file.name} | ${(file.size / 1024).toFixed(1)} كيلوبايت]`
        : "";

    if (!ctx && !title.trim()) { setError(isAr ? "يرجى رفع ملف أو إدخال عنوان الرسالة" : "Please upload a file or enter a thesis title"); return; }
    if (selected.length === 0) { setError(isAr ? "يرجى اختيار فئة واحدة على الأقل" : "Select at least one role"); return; }

    setError(""); setLoading(true); setResults(null);

    const content = ctx || `عنوان: ${title}`;
    const reports: Results = {};

    for (let i = 0; i < selected.length; i++) {
      const role = selected[i];
      const ri = ROLES[role as keyof typeof ROLES];
      setProgress({ step: isAr ? `جاري إعداد تقرير ${ri.ar}…` : `Preparing ${ri.en} report…`, pct: 20 + Math.round(((i + 1) / selected.length) * 70) });
      try {
        const res = await fetch("/api/thesis/roles-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content, role, lang: isAr ? "ar" : "en", degree, title }),
        });
        if (!res.ok) throw new Error();
        reports[role] = await res.json();
      } catch {
        reports[role] = {
          overallScore: 0, scores: {}, summary: isAr ? "تعذّر إنشاء التقرير. أعد المحاولة." : "Report generation failed. Try again.",
          observations: [], strongPoints: [], recommendation: "—",
        };
      }
    }

    setProgress({ step: isAr ? "اكتمل التحليل!" : "Analysis complete!", pct: 100 });
    setResults({ reports, at: new Date().toLocaleString(isAr ? "ar-SA" : "en-US") });
    setLoading(false);
  };

  const hasContent = propText.trim().length > 30 || localText.trim().length > 30 || !!file || title.trim().length > 5;

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── Upload / config card ── */}
      <div style={{ background: "#0e1829", border: "1.5px solid #ffffff0d", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>
          📤 {isAr ? "رفع الرسالة وضبط التحليل" : "Upload Thesis & Configure Analysis"}
        </h3>

        {/* Source indicator */}
        {propText.trim().length > 30 ? (
          <div style={{ background: "#10b98110", border: "1px solid #10b98125", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span>✅</span>
            <p style={{ margin: 0, color: "#10b981", fontSize: 12, fontWeight: 600 }}>
              {isAr ? `تم تحميل النص من الملف المرفوع (${propText.length.toLocaleString()} حرف) — سيُستخدم للتحليل` : `Text loaded from uploaded file (${propText.length.toLocaleString()} chars) — will be used for analysis`}
            </p>
          </div>
        ) : (
          /* Drop zone */
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${file ? "#10b981" : "#ffffff18"}`, borderRadius: 12, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: file ? "#10b98108" : "#060d1a", marginBottom: 14, transition: "all .2s" }}
          >
            <input ref={fileRef} type="file" style={{ display: "none" }} accept=".pdf,.doc,.docx,.txt" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            {file ? (
              <div>
                <span style={{ fontSize: 32 }}>✅</span>
                <p style={{ margin: "8px 0 2px", fontSize: 13, fontWeight: 700, color: "#10b981" }}>{file.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: 40 }}>📄</span>
                <p style={{ margin: "10px 0 4px", fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                  {isAr ? "اسحب الملف هنا أو انقر للاختيار" : "Drag file here or click to choose"}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#334155" }}>PDF · Word · TXT</p>
              </div>
            )}
          </div>
        )}

        {/* Title + degree */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 14 }}>
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder={isAr ? "عنوان الرسالة (اختياري)" : "Thesis title (optional)"}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ffffff18", fontSize: 13, color: "#e2e8f0", background: "#060d1a", outline: "none", fontFamily: "inherit", textAlign: isAr ? "right" : "left" }}
            onFocus={e => (e.target.style.borderColor = "#C9A84C44")}
            onBlur={e => (e.target.style.borderColor = "#ffffff18")}
          />
          <select
            value={degree} onChange={e => setDegree(e.target.value as "doctorate" | "master")}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ffffff18", fontSize: 13, background: "#060d1a", color: "#e2e8f0", cursor: "pointer", fontFamily: "inherit" }}
          >
            <option value="doctorate">{isAr ? "دكتوراه" : "Doctorate"}</option>
            <option value="master">{isAr ? "ماجستير" : "Master's"}</option>
          </select>
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#475569" }}>
            {isAr ? "اختر الفئات المطلوبة:" : "Select roles to analyse:"}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.values(ROLES).map(role => {
              const active = selected.includes(role.id);
              return (
                <button key={role.id} onClick={() => toggle(role.id)}
                  style={{ padding: "9px 16px", borderRadius: 10, border: `2px solid ${active ? role.color + "66" : "#ffffff11"}`, background: active ? role.color + "18" : "transparent", color: active ? role.color : "#475569", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all .15s", fontFamily: "inherit" }}>
                  {role.icon} {isAr ? role.ar : role.en} {active && "✓"}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>⚠️ {error}</div>
        )}

        {/* Analyse button */}
        <button onClick={analyze} disabled={loading}
          style={{ width: "100%", padding: "13px 24px", background: loading ? "#1e293b" : "linear-gradient(135deg,#C9A84C,#a07830)", color: loading ? "#475569" : "#080e1c", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: loading ? "none" : "0 4px 20px #C9A84C33", transition: "all .2s" }}>
          {loading ? `⏳ ${progress.step}` : (isAr ? "🔍 بدء التحليل والتحكيم الذكي" : "🔍 Start AI Analysis & Review")}
        </button>

        {loading && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 5, background: "#060d1a", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.pct}%`, background: "linear-gradient(90deg,#C9A84C,#a78bfa)", borderRadius: 3, transition: "width .5s ease" }} />
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: "#334155", margin: "5px 0 0" }}>{progress.pct}%</p>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {results && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#e2e8f0" }}>📋 {isAr ? "نتائج التحليل والتقييم" : "Analysis & Review Results"}</h3>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#334155" }}>{isAr ? "تم الإنشاء:" : "Generated:"} {results.at}</p>
            </div>
            <button onClick={() => window.print()}
              style={{ padding: "9px 18px", background: "#0e1829", border: "1.5px solid #ffffff11", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", color: "#94a3b8" }}>
              🖨️ {isAr ? "طباعة التقرير" : "Print Report"}
            </button>
          </div>
          {selected.map(role => (
            <ReportCard key={role} roleId={role} report={results.reports[role]} isAr={isAr} />
          ))}
        </div>
      )}

      {!loading && !results && !hasContent && (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#334155", fontSize: 13 }}>
          {isAr ? "ارفع ملفاً أو أدخل عنوان الرسالة للبدء" : "Upload a file or enter a thesis title to begin"}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { text: string }

export default function ThesisRoles({ text }: Props) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAr = lang === "ar";
  const [tab, setTab] = useState<"tasks" | "analysis">("tasks");

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "11px", border: "none",
    background: active ? "#C9A84C18" : "transparent",
    borderBottom: active ? "2.5px solid #C9A84C" : "2.5px solid transparent",
    color: active ? "#C9A84C" : "#475569",
    fontWeight: active ? 800 : 500, fontSize: 14,
    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  });

  return (
    <div style={{ padding: "20px 18px 60px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <h2 style={{ color: "#C9A84C", fontWeight: 900, fontSize: 18, margin: "0 0 4px" }}>
        🎓 {isAr ? "نظام التحكيم الذكي للرسائل الأكاديمية" : "Smart Thesis Review System"}
      </h2>
      <p style={{ color: "#475569", fontSize: 13, margin: "0 0 18px", lineHeight: 1.7 }}>
        {isAr
          ? "مهام كل فئة (مشرف · داخلي · خارجي · باحث) · تحليل ذكي بالذكاء الاصطناعي · تقارير مفصّلة مع حلول عملية"
          : "Role duties (supervisor · internal · external · researcher) · AI analysis · detailed reports with practical solutions"}
      </p>

      {/* Tab bar */}
      <div style={{ display: "flex", background: "#060d1a", border: "1px solid #ffffff08", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
        <button style={tabBtn(tab === "tasks")}    onClick={() => setTab("tasks")}>
          📚 {isAr ? "مهام الفئات" : "Role Duties"}
        </button>
        <button style={tabBtn(tab === "analysis")} onClick={() => setTab("analysis")}>
          🤖 {isAr ? "التحليل الذكي" : "AI Analysis"}
        </button>
      </div>

      {tab === "tasks"    && <TasksView isAr={isAr} />}
      {tab === "analysis" && <AnalysisView propText={text} isAr={isAr} toast={toast} />}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{ opacity:1; } 50%{ opacity:.5; } }
        @media print { button { display:none!important; } }
      `}</style>
    </div>
  );
}
