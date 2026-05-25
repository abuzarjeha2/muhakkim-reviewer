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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMd(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h3 style="color:#1e293b;font-size:15px;font-weight:800;margin:18px 0 8px;border-bottom:2px solid #e8ecf4;padding-bottom:5px">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="color:#374151;font-size:14px;font-weight:700;margin:14px 0 6px">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1e293b">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;line-height:1.7">$1</li>')
    .replace(/\n{2,}/g, '</p><p style="margin:0 0 8px;line-height:1.8">')
    .replace(/\n/g, '<br>');
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SmartReview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName,   setFileName]   = useState("");
  const [pdfText,    setPdfText]    = useState("");
  const [pdfStatus,  setPdfStatus]  = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [pageCount,  setPageCount]  = useState(0);

  const [role,       setRole]       = useState(0);
  const [checked,    setChecked]    = useState<boolean[]>(SECTIONS.map(() => true));

  const [loading,    setLoading]    = useState(false);
  const [report,     setReport]     = useState("");
  const [error,      setError]      = useState("");

  // ── PDF extraction ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPdfStatus("loading");
    setPdfText("");
    setReport("");

    try {
      const ext = file.name.toLowerCase();

      if (ext.endsWith(".txt") || ext.endsWith(".md")) {
        const txt = await file.text();
        setPdfText(txt);
        setPageCount(0);
        setPdfStatus("ok");
        return;
      }

      // PDF via pdfjs
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const maxP = Math.min(pdf.numPages, 50);
      let text = "";
      for (let i = 1; i <= maxP; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
      }
      setPdfText(text);
      setPageCount(maxP);
      setPdfStatus("ok");
    } catch {
      setPdfStatus("error");
    }
  };

  // ── Submit ──
  const submit = async () => {
    if (!pdfText) return;
    const selectedSections = SECTIONS.filter((_, i) => checked[i]).map(s => ar ? s.idAr : s.idEn);
    if (selectedSections.length === 0) return;

    setLoading(true); setError(""); setReport("");

    try {
      const res = await fetch("/api/ai/smart-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pdfText, role: ar ? ROLES_AR[role] : ROLES_EN[role], sections: selectedSections }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { report: string };
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Download ──
  const download = () => {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
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
              {ar ? "ارفع رسالتك · حدد المحاور · احصل على تقرير تحكيم أكاديمي شامل"
                  : "Upload your thesis · Select sections · Get a comprehensive academic review report"}
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
                {pageCount > 0 && <div style={{ fontSize: 10.5, color: "#64748b" }}>{pageCount} {ar ? "صفحة مستخرجة" : "pages extracted"}</div>}
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
              {report && (
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

            {/* Report output */}
            {report && !loading && (
              <div style={{ background: "#fafbff", border: "1px solid #e8ecf4", borderRadius: 12, padding: "20px 18px", lineHeight: 1.9, fontSize: 13.5, color: "#374151", direction: "rtl", textAlign: "right", minHeight: 200 }}>
                <div dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 8px;line-height:1.8">${formatMd(report)}</p>` }} />
              </div>
            )}

            {/* Empty state */}
            {!report && !loading && (
              <div style={{ textAlign: "center", padding: "36px 20px", background: "#f8faff", borderRadius: 12, border: "1.5px dashed #c7d4f0", color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {ar ? "التقرير سيظهر هنا بعد الضغط على زر المراجعة" : "The report will appear here after clicking Review"}
                </div>
                <div style={{ fontSize: 11.5 }}>
                  {ar ? "ارفع ملف PDF ثم اضغط «بدء المراجعة الشاملة»" : "Upload a PDF then click «Start Full Review»"}
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
