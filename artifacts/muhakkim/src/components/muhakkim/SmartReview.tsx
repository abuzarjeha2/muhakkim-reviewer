import { useState, useRef } from "react";
import { useLanguage } from "../../lib/i18n";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES_AR = [
  "مشرف الرسالة (Supervisor)",
  "مناقش داخلي (Internal Examiner)",
  "مناقش خارجي (External Examiner)",
  "الباحث العلمي (Researcher)",
];
const ROLES_EN = [
  "Thesis Supervisor",
  "Internal Examiner",
  "External Examiner",
  "Researcher",
];

interface Section { idAr: string; idEn: string; labelAr: string; labelEn: string; }
const SECTIONS: Section[] = [
  { idAr: "العنوان والمستخلص والمقدمة (الاتساق والوضوح)",               idEn: "Title, Abstract & Introduction (coherence and clarity)",                 labelAr: "📌 العنوان والمستخلص والمقدمة",               labelEn: "📌 Title, Abstract & Introduction" },
  { idAr: "الأهداف والفرضيات (صياغتها وقابليتها للاختبار)",              idEn: "Objectives & Hypotheses (formulation and testability)",                  labelAr: "🎯 الأهداف والفرضيات",                        labelEn: "🎯 Objectives & Hypotheses" },
  { idAr: "الإطار النظري والدراسات السابقة (الفجوة والربط)",             idEn: "Theoretical Framework & Literature Review (gap and linkage)",            labelAr: "📚 الإطار النظري والدراسات السابقة",           labelEn: "📚 Theoretical Framework & Literature" },
  { idAr: "المنهجية (مجتمع وعينة الدراسة والأدوات والصدق)",             idEn: "Methodology (population, sample, instruments and validity)",             labelAr: "🔬 المنهجية البحثية وأدوات الدراسة",           labelEn: "🔬 Research Methodology & Tools" },
  { idAr: "التحليل الإحصائي، الجداول وعرض النتائج وتفسيرها",            idEn: "Statistical Analysis, Tables, Results presentation and interpretation",  labelAr: "📊 التحليل الإحصائي والنتائج",                 labelEn: "📊 Statistical Analysis & Results" },
  { idAr: "التوصيات والمقترحات والتوثيق الأكاديمي للمراجع",             idEn: "Recommendations, Suggestions and Academic References",                   labelAr: "📝 التوصيات والمقترحات والمراجع",              labelEn: "📝 Recommendations & References" },
];

type Severity = "high" | "medium" | "low";
type Finding = { section: string; severity: Severity; page: number; quote: string; note: string; suggestion: string };
type ReviewResult = {
  overallAssessment: string;
  score: number | null;
  findings: Finding[];
  recommendations: string[];
};
type PageChunk = { page: number; text: string };

// ─── Component ────────────────────────────────────────────────────────────────
export default function SmartReview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName,   setFileName]   = useState("");
  const [pages,      setPages]      = useState<PageChunk[]>([]);
  const [pdfStatus,  setPdfStatus]  = useState<"idle"|"loading"|"ok"|"error">("idle");

  const [role,       setRole]       = useState(0);
  const [checked,    setChecked]    = useState<boolean[]>(SECTIONS.map(() => true));

  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<ReviewResult | null>(null);
  const [error,      setError]      = useState("");

  // ── PDF extraction (per-page) ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPdfStatus("loading");
    setPages([]);
    setResult(null);

    try {
      const ext = file.name.toLowerCase();

      if (ext.endsWith(".txt") || ext.endsWith(".md")) {
        const txt = await file.text();
        // Heuristic: treat ~3000 chars per "page"
        const CHARS_PER_PAGE = 3000;
        const chunks: PageChunk[] = [];
        for (let i = 0; i < txt.length; i += CHARS_PER_PAGE) {
          chunks.push({ page: chunks.length + 1, text: txt.slice(i, i + CHARS_PER_PAGE) });
        }
        setPages(chunks.length ? chunks : [{ page: 1, text: txt }]);
        setPdfStatus("ok");
        return;
      }

      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const maxP = Math.min(pdf.numPages, 80);
      const collected: PageChunk[] = [];
      for (let i = 1; i <= maxP; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim();
        if (text.length > 0) collected.push({ page: i, text });
      }
      setPages(collected);
      setPdfStatus(collected.length ? "ok" : "error");
    } catch {
      setPdfStatus("error");
    }
  };

  // ── Submit ──
  const submit = async () => {
    if (pages.length === 0) return;
    const selectedSections = SECTIONS.filter((_, i) => checked[i]).map(s => ar ? s.idAr : s.idEn);
    if (selectedSections.length === 0) return;

    setLoading(true); setError(""); setResult(null);

    try {
      const res = await fetch("/api/ai/smart-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages,
          role: ar ? ROLES_AR[role] : ROLES_EN[role],
          sections: selectedSections,
          lang: ar ? "ar" : "en",
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as ReviewResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Download as text ──
  const download = () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(ar ? "═══ تقرير المراجعة الذكية الشاملة ═══" : "═══ Smart Academic Review Report ═══");
    lines.push("");
    if (result.score != null) lines.push(`${ar ? "الدرجة الإجمالية" : "Overall Score"}: ${result.score} / 100`);
    lines.push("");
    lines.push(ar ? "── التقييم العام ──" : "── Overall Assessment ──");
    lines.push(result.overallAssessment || "—");
    lines.push("");
    lines.push(ar ? `── الملاحظات (${result.findings.length}) ──` : `── Findings (${result.findings.length}) ──`);
    result.findings.forEach((f, i) => {
      lines.push("");
      lines.push(`${i + 1}. [${f.severity.toUpperCase()}] ${f.section}`);
      lines.push(`   ${ar ? "الصفحة" : "Page"}: ${f.page}`);
      if (f.quote) lines.push(`   ${ar ? "الاقتباس" : "Quote"}: «${f.quote}»`);
      lines.push(`   ${ar ? "الملاحظة" : "Note"}: ${f.note}`);
      lines.push(`   ${ar ? "🤖 الحل المقترح" : "🤖 AI Suggestion"}: ${f.suggestion}`);
    });
    if (result.recommendations.length) {
      lines.push("");
      lines.push(ar ? "── التوصيات النهائية ──" : "── Final Recommendations ──");
      result.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: ar ? "تقرير_مراجعة_أكاديمية.txt" : "academic_review_report.txt" });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const allChecked = checked.every(Boolean);
  const toggle = (i: number) => setChecked(c => c.map((v, j) => j === i ? !v : v));
  const toggleAll = () => setChecked(checked.map(() => !allChecked));

  // ── Styles ──
  const card: React.CSSProperties = { background: "#ffffff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: "20px 18px" };
  const GOLD = "#b45309", NAVY = "#1e293b";

  const sevMeta: Record<Severity, { color: string; bg: string; border: string; labelAr: string; labelEn: string; icon: string }> = {
    high:   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", labelAr: "حرجة",   labelEn: "Critical", icon: "🔴" },
    medium: { color: "#92400e", bg: "#fffbeb", border: "#fde68a", labelAr: "متوسطة", labelEn: "Medium",   icon: "🟡" },
    low:    { color: "#065f46", bg: "#f0fdf4", border: "#bbf7d0", labelAr: "بسيطة",  labelEn: "Minor",    icon: "🟢" },
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 960, margin: "0 auto", fontFamily: ar ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ ...card, marginBottom: 16, background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🎓</div>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: NAVY }}>
              {ar ? "المنصة الذكية لمراجعة الرسائل العلمية" : "Smart Academic Thesis Review"}
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "#92400e" }}>
              {ar ? "ارفع رسالتك · حدد المحاور · احصل على ملاحظات محدّدة برقم الصفحة وحلٍّ مقترح بالذكاء الاصطناعي"
                  : "Upload thesis · Pick sections · Get findings with page numbers and AI-suggested fixes"}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>

        {/* ══ SIDEBAR ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Role */}
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
              👤 {ar ? "الدور الأكاديمي" : "Academic Role"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(ar ? ROLES_AR : ROLES_EN).map((r, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "7px 10px", borderRadius: 9, background: role === i ? "#fffbeb" : "transparent", border: `1.5px solid ${role === i ? "#fde68a" : "#e8ecf4"}`, transition: "all .12s" }}>
                  <input type="radio" name="role" checked={role === i} onChange={() => setRole(i)} style={{ accentColor: GOLD }} />
                  <span style={{ fontSize: 12.5, color: role === i ? GOLD : "#374151", fontWeight: role === i ? 700 : 500 }}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
              📂 {ar ? "رفع ملف الرسالة" : "Upload Thesis File"}
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #c7d4f0", borderRadius: 12, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: pdfStatus === "ok" ? "#f0fdf4" : "#f8faff", transition: "all .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#b45309"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c7d4f0"; }}
            >
              {pdfStatus === "loading" && <div style={{ color: "#1d4ed8", fontSize: 12 }}>⏳ {ar ? "جارٍ القراءة…" : "Reading…"}</div>}
              {pdfStatus === "ok"      && <>
                <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#065f46", marginBottom: 2 }}>{fileName}</div>
                {pages.length > 0 && <div style={{ fontSize: 10.5, color: "#64748b" }}>{pages.length} {ar ? "صفحة مستخرجة" : "pages extracted"}</div>}
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{ar ? "اضغط لتغيير الملف" : "Click to change"}</div>
              </>}
              {pdfStatus === "error"   && <div style={{ color: "#dc2626", fontSize: 12 }}>❌ {ar ? "تعذّر قراءة الملف" : "Could not read file"}</div>}
              {pdfStatus === "idle"    && <>
                <div style={{ fontSize: 26, marginBottom: 6 }}>📄</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 2 }}>{ar ? "اضغط لرفع الملف" : "Click to upload"}</div>
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>PDF · TXT · MD</div>
              </>}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={handleFile} style={{ display: "none" }} />
          </div>

          {/* Start btn */}
          <button
            onClick={submit}
            disabled={loading || pdfStatus !== "ok" || checked.every(v => !v)}
            style={{
              background: loading || pdfStatus !== "ok" ? "#e2e8f0" : "linear-gradient(135deg,#C9A84C,#b45309)",
              color: loading || pdfStatus !== "ok" ? "#94a3b8" : "#fff",
              border: "none", borderRadius: 12, padding: "13px 16px", fontWeight: 800, fontSize: 14,
              cursor: loading || pdfStatus !== "ok" ? "not-allowed" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: pdfStatus === "ok" && !loading ? "0 4px 16px #C9A84C33" : "none",
              transition: "all .15s",
            }}>
            {loading
              ? <><span style={{ display: "inline-block", width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "sr-spin .8s linear infinite" }} />{ar ? "جارٍ التحليل…" : "Analyzing…"}</>
              : <>{ar ? "🚀 بدء المراجعة الشاملة" : "🚀 Start Full Review"}</>}
          </button>

          {/* Powered by */}
          <div style={{ textAlign: "center", fontSize: 10.5, color: "#cbd5e1" }}>
            {ar ? "مدعومة بـ GPT-4.1 · لا يلزم مفتاح API" : "Powered by GPT-4.1 · No API key needed"}
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Section checkboxes */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>
                📋 {ar ? "المحاور المطلوب مراجعتها" : "Sections to Review"}
              </div>
              <button onClick={toggleAll} style={{ background: "none", border: "1px solid #e8ecf4", borderRadius: 7, padding: "4px 10px", fontSize: 11, color: "#64748b", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                {allChecked ? (ar ? "إلغاء الكل" : "Deselect All") : (ar ? "تحديد الكل" : "Select All")}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SECTIONS.map((s, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "9px 12px", borderRadius: 10, background: checked[i] ? "#fffbeb" : "#f8faff", border: `1.5px solid ${checked[i] ? "#fde68a" : "#e8ecf4"}`, transition: "all .12s" }}>
                  <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} style={{ accentColor: GOLD, width: 15, height: 15, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: checked[i] ? GOLD : "#64748b", fontWeight: checked[i] ? 700 : 500, lineHeight: 1.4 }}>
                    {ar ? s.labelAr : s.labelEn}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Report area */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>
                📊 {ar ? "التقرير الأكاديمي الشامل" : "Comprehensive Academic Report"}
              </div>
              {result && (
                <button onClick={download} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e293b", border: "none", borderRadius: 9, color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  💾 {ar ? "تحميل TXT" : "Download TXT"}
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 14px", color: "#991b1b", fontSize: 13, marginBottom: 12 }}>
                ❌ {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8faff", borderRadius: 12, border: "1.5px dashed #c7d4f0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: NAVY, marginBottom: 6 }}>
                  {ar ? "البروفيسور الذكي يراجع الأطروحة…" : "AI Professor is reviewing the thesis…"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {ar ? "قد يستغرق ذلك ١٠–٣٠ ثانية حسب حجم الرسالة" : "This may take 10–30 seconds depending on thesis size"}
                </div>
                <div style={{ marginTop: 16, height: 4, borderRadius: 4, background: "#e8ecf4", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg,#C9A84C,#f5d78e,#C9A84C)", backgroundSize: "200% 100%", animation: "sr-shimmer 1.5s linear infinite" }} />
                </div>
              </div>
            )}

            {/* Structured report output */}
            {result && !loading && (
              <div style={{ direction: ar ? "rtl" : "ltr", textAlign: ar ? "right" : "left" }}>

                {/* Overall assessment */}
                {result.overallAssessment && (
                  <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: GOLD }}>
                        🏛️ {ar ? "التقييم العام" : "Overall Assessment"}
                      </div>
                      {result.score != null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>{ar ? "الدرجة" : "Score"}</span>
                          <span style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 8, padding: "3px 10px", fontWeight: 900, fontSize: 14, color: GOLD }}>
                            {result.score}<span style={{ fontSize: 10, color: "#92400e" }}>/100</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.85, color: "#374151" }}>{result.overallAssessment}</p>
                  </div>
                )}

                {/* Findings stats bar */}
                {result.findings.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {(["high", "medium", "low"] as Severity[]).map(sv => {
                      const count = result.findings.filter(f => f.severity === sv).length;
                      const m = sevMeta[sv];
                      return (
                        <div key={sv} style={{ display: "flex", alignItems: "center", gap: 6, background: m.bg, border: `1.5px solid ${m.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, color: m.color, fontWeight: 700 }}>
                          <span>{m.icon}</span>
                          <span>{ar ? m.labelAr : m.labelEn}</span>
                          <span style={{ background: "#fff", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 900 }}>{count}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: NAVY, fontWeight: 700 }}>
                      📋 {ar ? "المجموع" : "Total"}
                      <span style={{ background: "#fff", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 900 }}>{result.findings.length}</span>
                    </div>
                  </div>
                )}

                {/* Findings grouped by page (ascending) */}
                {result.findings.length > 0 && (() => {
                  const sorted = [...result.findings].sort((a, b) => a.page - b.page);
                  const groups: { page: number; items: typeof sorted }[] = [];
                  for (const f of sorted) {
                    const last = groups[groups.length - 1];
                    if (last && last.page === f.page) last.items.push(f);
                    else groups.push({ page: f.page, items: [f] });
                  }
                  let counter = 0;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 14 }}>
                      {groups.map(g => (
                        <div key={g.page} style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 14, overflow: "hidden" }}>
                          {/* Page header */}
                          <div style={{ background: "linear-gradient(135deg,#1e293b,#334155)", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 20 }}>📄</span>
                              <span style={{ fontWeight: 900, fontSize: 16 }}>
                                {ar ? `الصفحة ${g.page}` : `Page ${g.page}`}
                              </span>
                            </div>
                            <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                              {g.items.length} {ar ? (g.items.length === 1 ? "ملاحظة" : "ملاحظات") : (g.items.length === 1 ? "finding" : "findings")}
                            </span>
                          </div>

                          {/* Findings on this page */}
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            {g.items.map((f, idx) => {
                              counter += 1;
                              const m = sevMeta[f.severity];
                              return (
                                <div key={idx} style={{ padding: "14px 16px", borderTop: idx > 0 ? "1px dashed #e8ecf4" : "none" }}>
                                  {/* Meta row */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                                    <span style={{ background: m.bg, border: `1.5px solid ${m.border}`, color: m.color, fontWeight: 900, fontSize: 11, padding: "3px 9px", borderRadius: 7 }}>
                                      #{counter}
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: m.bg, border: `1.5px solid ${m.border}`, color: m.color, fontWeight: 700, fontSize: 11, padding: "3px 9px", borderRadius: 7 }}>
                                      {m.icon} {ar ? m.labelAr : m.labelEn}
                                    </span>
                                    {f.section && (
                                      <span style={{ background: "#f8faff", border: "1.5px solid #e8ecf4", color: NAVY, fontWeight: 700, fontSize: 11, padding: "3px 9px", borderRadius: 7 }}>
                                        {f.section}
                                      </span>
                                    )}
                                  </div>

                                  {f.quote && (
                                    <div style={{ background: "#f8faff", borderInlineStart: "3px solid #c7d4f0", padding: "8px 12px", borderRadius: 6, fontSize: 12, color: "#475569", fontStyle: "italic", lineHeight: 1.7, marginBottom: 10 }}>
                                      «{f.quote}»
                                    </div>
                                  )}

                                  <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                      📝 {ar ? "الملاحظة" : "Note"}
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: "#1e293b" }}>{f.note}</p>
                                  </div>

                                  <div style={{ background: "linear-gradient(135deg,#f0f9ff,#ecfeff)", border: "1.5px solid #bae6fd", borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#0369a1", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                                      🤖 {ar ? "الحل المقترح بالذكاء الاصطناعي" : "AI-Suggested Fix"}
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: "#0c4a6e", whiteSpace: "pre-wrap" }}>{f.suggestion}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Final recommendations */}
                {result.recommendations.length > 0 && (
                  <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#065f46", marginBottom: 8 }}>
                      ✨ {ar ? "التوصيات النهائية" : "Final Recommendations"}
                    </div>
                    <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.9, color: "#064e3b" }}>
                      {result.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
                    </ol>
                  </div>
                )}

                {/* No findings */}
                {result.findings.length === 0 && (
                  <div style={{ background: "#f0fdf4", border: "1.5px dashed #bbf7d0", borderRadius: 12, padding: "20px", textAlign: "center", color: "#065f46", fontSize: 13 }}>
                    ✅ {ar ? "لم يرصد المحكّم الذكي ملاحظات جوهرية في المحاور المختارة." : "No critical findings detected in the selected sections."}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!result && !loading && (
              <div style={{ textAlign: "center", padding: "36px 20px", background: "#f8faff", borderRadius: 12, border: "1.5px dashed #c7d4f0", color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? "التقرير سيظهر هنا بعد الضغط على زر المراجعة" : "The report will appear here after clicking Review"}
                </div>
                <div style={{ fontSize: 11.5 }}>
                  {ar ? "كل ملاحظة ستحتوي على: النص، رقم الصفحة، والحل المقترح بالذكاء الاصطناعي"
                      : "Each finding will include: note, page number, and AI-suggested fix"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: stack columns */}
      <style>{`
        @keyframes sr-spin    { to { transform: rotate(360deg); } }
        @keyframes sr-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 280px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
