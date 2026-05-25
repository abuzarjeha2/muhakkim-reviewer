import { useState, useRef } from "react";
import { useLanguage } from "../../lib/i18n";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Section definitions ──────────────────────────────────────────────────────
interface Sec { id: string; iconAr: string; labelAr: string; labelEn: string; phAr: string; phEn: string; color: string; bg: string; border: string; }

const SECTIONS: Sec[] = [
  { id: "title",           iconAr: "🏷️",  labelAr: "العنوان",           labelEn: "Title",              phAr: "أدخل عنوان الرسالة هنا…",              phEn: "Enter thesis title here…",            color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { id: "abstract",        iconAr: "📄",  labelAr: "المستخلص",          labelEn: "Abstract",           phAr: "أدخل نص المستخلص هنا…",               phEn: "Enter abstract text here…",           color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "objectives",      iconAr: "🎯",  labelAr: "الأهداف",           labelEn: "Objectives",         phAr: "أدخل أهداف البحث هنا…",               phEn: "Enter research objectives here…",     color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "hypotheses",      iconAr: "❓",  labelAr: "الفرضيات",          labelEn: "Hypotheses",         phAr: "أدخل فرضيات البحث هنا…",              phEn: "Enter research hypotheses here…",     color: "#5b21b6", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "theoretical",     iconAr: "📚",  labelAr: "الإطار النظري",     labelEn: "Theoretical Framework", phAr: "أدخل الإطار النظري والأدبيات…",    phEn: "Enter theoretical framework here…",   color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "index",           iconAr: "📑",  labelAr: "الفهرس / المحتويات", labelEn: "Table of Contents",  phAr: "أدخل الفهرس هنا…",                    phEn: "Enter table of contents here…",       color: "#86198f", bg: "#fdf4ff", border: "#f0abfc" },
  { id: "methodology",     iconAr: "🔬",  labelAr: "المنهجية",          labelEn: "Methodology",        phAr: "أدخل منهجية البحث وأدوات الدراسة…",  phEn: "Enter research methodology here…",    color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
  { id: "analysis",        iconAr: "📊",  labelAr: "تحليل البيانات",    labelEn: "Data Analysis",      phAr: "أدخل نتائج التحليل الإحصائي…",        phEn: "Enter data analysis results here…",   color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  { id: "results",         iconAr: "📈",  labelAr: "النتائج",           labelEn: "Results",            phAr: "أدخل نتائج الدراسة هنا…",             phEn: "Enter study results here…",           color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  { id: "recommendations", iconAr: "💡",  labelAr: "التوصيات",          labelEn: "Recommendations",    phAr: "أدخل توصيات الدراسة هنا…",            phEn: "Enter study recommendations here…",   color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
];

// ─── Status type ──────────────────────────────────────────────────────────────
type Status = "idle" | "loading" | "done" | "error";
interface SectionState { text: string; result: string; status: Status; }

const initState = (): Record<string, SectionState> =>
  Object.fromEntries(SECTIONS.map(s => [s.id, { text: "", result: "", status: "idle" }]));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatResult(txt: string) {
  return txt
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- /gm, "• ")
    .replace(/\n/g, "<br>");
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SectionReview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [state, setState] = useState<Record<string, SectionState>>(initState);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalDone, setGlobalDone] = useState(false);

  // ── Full-file review state ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fullText, setFullText] = useState("");
  const [fileStatus, setFileStatus] = useState<"idle"|"reading"|"ready"|"error">("idle");
  const [fileError, setFileError] = useState("");
  const [fullLoading, setFullLoading] = useState(false);
  const [fullResult, setFullResult] = useState("");
  const [fullMeta, setFullMeta] = useState<{ truncated: boolean; charsAnalyzed: number; charsTotal: number } | null>(null);
  const [fullError, setFullError] = useState("");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setFileStatus("reading"); setFileError(""); setFullText(""); setFullResult(""); setFullError("");
    try {
      const lower = f.name.toLowerCase();
      let text = "";
      if (lower.endsWith(".pdf")) {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const max = Math.min(pdf.numPages, 500);
        const parts: string[] = [];
        for (let i = 1; i <= max; i++) {
          const page = await pdf.getPage(i);
          const c = await page.getTextContent();
          const t = c.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
          if (t) parts.push(t);
        }
        text = parts.join("\n\n");
      } else if (lower.endsWith(".docx")) {
        const buf = await f.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: buf });
        text = r.value;
      } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf")) {
        text = await f.text();
      } else {
        setFileStatus("error");
        setFileError(ar ? "صيغة غير مدعومة. المدعوم: PDF · DOCX · TXT · MD" : "Unsupported format. Supported: PDF · DOCX · TXT · MD");
        return;
      }
      if (text.trim().length < 200) {
        setFileStatus("error");
        setFileError(ar ? "النص المستخرج قصير جداً (أقل من 200 حرف)." : "Extracted text is too short (<200 chars).");
        return;
      }
      setFullText(text);
      setFileStatus("ready");
    } catch (err) {
      setFileStatus("error");
      setFileError(err instanceof Error ? err.message : String(err));
    }
  };

  const reviewFull = async () => {
    if (!fullText) return;
    setFullLoading(true); setFullResult(""); setFullError(""); setFullMeta(null);
    try {
      const r = await fetch("/api/ai/full-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText, title: fileName.replace(/\.[^.]+$/, ""), lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setFullResult(data.content || "");
      setFullMeta({ truncated: !!data.truncated, charsAnalyzed: data.charsAnalyzed || 0, charsTotal: data.charsTotal || 0 });
    } catch (e) {
      setFullError(e instanceof Error ? e.message : String(e));
    } finally { setFullLoading(false); }
  };

  const downloadFull = () => {
    if (!fullResult) return;
    const blob = new Blob([fullResult], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${(fileName || "review").replace(/\.[^.]+$/, "")}_full_review.txt`,
    });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const clearFull = () => {
    setFileName(""); setFullText(""); setFileStatus("idle"); setFileError("");
    setFullResult(""); setFullError(""); setFullMeta(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── helpers ──
  const set = (id: string, patch: Partial<SectionState>) =>
    setState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const filledCount = SECTIONS.filter(s => state[s.id].text.trim()).length;
  const reviewedCount = SECTIONS.filter(s => state[s.id].status === "done").length;

  // ── single section ──
  const reviewSingle = async (id: string) => {
    const txt = state[id].text;
    if (!txt.trim()) return;
    set(id, { status: "loading", result: "" });
    try {
      const res = await fetch("/api/ai/section-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: id, text: txt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, string>;
      set(id, { status: "done", result: data[id] ?? (ar ? "لا توجد ملاحظات." : "No feedback.") });
    } catch (e) {
      set(id, { status: "error", result: e instanceof Error ? e.message : String(e) });
    }
  };

  // ── all sections ──
  const reviewAll = async () => {
    const payload: Record<string, string> = {};
    SECTIONS.forEach(s => { if (state[s.id].text.trim()) payload[s.id] = state[s.id].text; });
    if (!Object.keys(payload).length) return;

    setGlobalLoading(true); setGlobalDone(false);
    // set all filled to loading
    SECTIONS.forEach(s => { if (payload[s.id]) set(s.id, { status: "loading", result: "" }); });

    try {
      const res = await fetch("/api/ai/section-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, string>;
      SECTIONS.forEach(s => {
        if (data[s.id]) set(s.id, { status: "done", result: data[s.id] });
        else if (payload[s.id]) set(s.id, { status: "error", result: ar ? "لم تُرجع نتيجة." : "No result returned." });
      });
      setGlobalDone(true);
    } catch (e) {
      SECTIONS.forEach(s => { if (payload[s.id]) set(s.id, { status: "error", result: e instanceof Error ? e.message : String(e) }); });
    } finally {
      setGlobalLoading(false);
    }
  };

  // ── reset ──
  const resetAll = () => { setState(initState()); setGlobalDone(false); };

  // ── download all results ──
  const download = () => {
    const lines = SECTIONS.flatMap(s => {
      const sec = state[s.id];
      if (sec.status !== "done" || !sec.result) return [];
      return [`\n${"=".repeat(50)}\n${ar ? s.labelAr : s.labelEn}\n${"=".repeat(50)}\n`, sec.result, ""];
    });
    if (!lines.length) return;
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: ar ? "ملاحظات_الرسالة.txt" : "thesis_review.txt" });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const GOLD = "#b45309", NAVY = "#1e293b";
  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, overflow: "hidden" };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 1100, margin: "0 auto", fontFamily: ar ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>
      <style>{`@keyframes sr2-spin{to{transform:rotate(360deg)}} @keyframes sr2-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#eff6ff,#f0f9ff)", border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "18px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📘</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: NAVY }}>
            {ar ? "مراجعة أقسام الرسالة بالذكاء الاصطناعي" : "AI Section-by-Section Thesis Review"}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#1d4ed8" }}>
            {ar ? "أدخل نص كل قسم واحصل على ملاحظات أكاديمية دقيقة · مراجعة كل قسم منفرداً أو الكل معاً"
                : "Paste each section's text and get precise academic feedback · Review individually or all at once"}
          </p>
        </div>
        {/* Stats */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { v: filledCount,   l: ar ? "مملوء" : "Filled",    c: "#1d4ed8" },
            { v: reviewedCount, l: ar ? "مُراجَع" : "Reviewed", c: "#065f46" },
          ].map(s => (
            <div key={s.l} style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 10, padding: "8px 12px", textAlign: "center", minWidth: 52 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Full-file review (no chunking) ══ */}
      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 16, padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📂</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: NAVY }}>
              {ar ? "مراجعة الملف كاملاً دفعة واحدة (بدون تجزئة)" : "Full-file review in one shot (no chunking)"}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#92400e" }}>
              {ar ? "ارفع الرسالة كاملة (PDF · DOCX · TXT) — يُرسل النص كله لمحرّك GPT-4.1 (نافذة مليون رمز) ويعود بتقرير تحكيم شامل."
                  : "Upload the entire thesis (PDF · DOCX · TXT) — full text is sent to GPT-4.1 (1M token window) for a comprehensive review."}
            </p>
          </div>
        </div>

        <div onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #fde68a", borderRadius: 12, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: fileStatus === "ready" ? "#f0fdf4" : "#fff", transition: "all .15s" }}>
          {fileStatus === "reading" && <div style={{ color: GOLD, fontSize: 13 }}>⏳ {ar ? "جارٍ قراءة الملف…" : "Reading file…"}</div>}
          {fileStatus === "ready" && (
            <>
              <div style={{ fontSize: 22 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46", marginTop: 4 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                {fullText.length.toLocaleString()} {ar ? "حرف · جاهز للتحليل الكامل" : "characters · ready for full review"}
              </div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{ar ? "اضغط لتغيير الملف" : "Click to change"}</div>
            </>
          )}
          {fileStatus === "error" && <div style={{ color: "#dc2626", fontSize: 13 }}>❌ {fileError}</div>}
          {fileStatus === "idle" && (
            <>
              <div style={{ fontSize: 26 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginTop: 4 }}>{ar ? "اضغط لرفع الملف كاملاً" : "Click to upload the entire file"}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>PDF · DOCX · TXT · MD</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.rtf" onChange={onPickFile} style={{ display: "none" }} />

        {fileStatus === "ready" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={reviewFull} disabled={fullLoading}
              style={{ background: fullLoading ? "#e2e8f0" : "linear-gradient(135deg,#C9A84C,#b45309)", color: fullLoading ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, fontSize: 13, cursor: fullLoading ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: fullLoading ? "none" : "0 4px 12px #C9A84C44" }}>
              {fullLoading
                ? <><span style={{ width: 13, height: 13, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "sr2-spin .7s linear infinite" }} />{ar ? "جارٍ المراجعة الكاملة…" : "Reviewing full file…"}</>
                : <>🚀 {ar ? "راجع الملف كاملاً الآن" : "Review Full File Now"}</>}
            </button>
            <button onClick={clearFull} style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 10, color: GOLD, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              🗑️ {ar ? "إزالة الملف" : "Remove file"}
            </button>
          </div>
        )}

        {fullError && <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>❌ {fullError}</div>}

        {fullResult && (
          <div style={{ marginTop: 14, background: "#fff", border: "1.5px solid #fde68a", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>📋 {ar ? "تقرير المراجعة الكاملة" : "Full Review Report"}</div>
              <button onClick={downloadFull}
                style={{ background: "#1e293b", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                💾 {ar ? "تحميل التقرير" : "Download report"}
              </button>
            </div>
            {fullMeta?.truncated && (
              <div style={{ marginBottom: 10, padding: "6px 10px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 8, fontSize: 11.5 }}>
                ⚠️ {ar ? `الملف طويل (${fullMeta.charsTotal.toLocaleString()} حرف)؛ اقتُصرت المراجعة على أول ${fullMeta.charsAnalyzed.toLocaleString()} حرف.`
                       : `File is long (${fullMeta.charsTotal.toLocaleString()} chars); review based on first ${fullMeta.charsAnalyzed.toLocaleString()} chars.`}
              </div>
            )}
            <div style={{ background: "#fafbff", border: "1px solid #eef1f8", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.9, color: NAVY, whiteSpace: "pre-wrap", direction: ar ? "rtl" : "ltr", textAlign: ar ? "right" : "left", maxHeight: 500, overflowY: "auto" }}
              dangerouslySetInnerHTML={{ __html: formatResult(fullResult) }} />
          </div>
        )}
      </div>

      {/* ── Section divider ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px" }}>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8" }}>
          {ar ? "أو راجع كل قسم على حدة بإدخاله يدوياً" : "Or review each section manually"}
        </span>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      {/* ── Global actions ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={reviewAll}
          disabled={globalLoading || filledCount === 0}
          style={{ background: globalLoading || filledCount === 0 ? "#e2e8f0" : "linear-gradient(135deg,#1d4ed8,#3b82f6)", color: globalLoading || filledCount === 0 ? "#94a3b8" : "#fff", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: globalLoading || filledCount === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: filledCount > 0 && !globalLoading ? "0 4px 16px rgba(29,78,216,0.25)" : "none" }}>
          {globalLoading
            ? <><span style={{ width: 15, height: 15, border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "sr2-spin .7s linear infinite" }} />{ar ? "جارٍ مراجعة الكل…" : "Reviewing all…"}</>
            : <>{ar ? "🔍 مراجعة جميع الأقسام" : "🔍 Review All Sections"}</>}
        </button>

        {reviewedCount > 0 && (
          <button onClick={download} style={{ background: "#1e293b", border: "none", borderRadius: 12, color: "#fff", padding: "12px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
            💾 {ar ? "تحميل النتائج TXT" : "Download Results TXT"}
          </button>
        )}

        <button onClick={resetAll} style={{ background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 12, color: "#64748b", padding: "12px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          🗑️ {ar ? "مسح الكل" : "Reset All"}
        </button>

        {globalDone && (
          <span style={{ color: "#065f46", fontWeight: 700, fontSize: 13, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 9, padding: "8px 14px" }}>
            ✅ {ar ? "اكتملت مراجعة جميع الأقسام!" : "All sections reviewed!"}
          </span>
        )}
      </div>

      {/* ── Sections grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(440px,1fr))", gap: 14 }}>
        {SECTIONS.map(sec => {
          const st = state[sec.id];
          return (
            <div key={sec.id} style={card}>
              {/* Card header */}
              <div style={{ background: sec.bg, borderBottom: `1.5px solid ${sec.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{sec.iconAr}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: sec.color }}>{ar ? sec.labelAr : sec.labelEn}</span>
                {st.status === "done" && <span style={{ marginInlineStart: "auto", fontSize: 11, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 8px", color: "#166534", fontWeight: 700 }}>✓ {ar ? "مُراجَع" : "Done"}</span>}
              </div>

              <div style={{ padding: "14px 16px" }}>
                {/* Textarea */}
                <textarea
                  value={st.text}
                  onChange={e => set(sec.id, { text: e.target.value, result: "", status: "idle" })}
                  placeholder={ar ? sec.phAr : sec.phEn}
                  rows={5}
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e8ecf4", borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", color: NAVY, background: "#f8faff", direction: "rtl", lineHeight: 1.7, transition: "border-color .15s" }}
                  onFocus={e => { e.currentTarget.style.borderColor = sec.color; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = "#e8ecf4"; }}
                />

                {/* Review single btn */}
                <button
                  onClick={() => reviewSingle(sec.id)}
                  disabled={!st.text.trim() || st.status === "loading"}
                  style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: !st.text.trim() || st.status === "loading" ? "#f1f5f9" : sec.bg, border: `1.5px solid ${!st.text.trim() || st.status === "loading" ? "#e8ecf4" : sec.border}`, borderRadius: 9, color: !st.text.trim() || st.status === "loading" ? "#94a3b8" : sec.color, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: !st.text.trim() || st.status === "loading" ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all .12s" }}>
                  {st.status === "loading"
                    ? <><span style={{ width: 12, height: 12, border: `2px solid ${sec.color}44`, borderTopColor: sec.color, borderRadius: "50%", display: "inline-block", animation: "sr2-spin .7s linear infinite" }} />{ar ? "جارٍ…" : "Reviewing…"}</>
                    : <>📌 {ar ? "مراجعة هذا القسم" : "Review this section"}</>}
                </button>

                {/* Result */}
                {st.status !== "idle" && (
                  <div style={{ marginTop: 12, background: st.status === "error" ? "#fff5f5" : "#f8faff", border: `1.5px solid ${st.status === "error" ? "#fecaca" : sec.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: st.status === "error" ? "#991b1b" : NAVY, direction: "rtl", lineHeight: 1.8, maxHeight: 260, overflowY: "auto" }}>
                    {st.status === "loading" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", animation: "sr2-pulse 1.4s ease-in-out infinite" }}>
                        <span style={{ width: 14, height: 14, border: `2px solid ${sec.color}33`, borderTopColor: sec.color, borderRadius: "50%", display: "inline-block", animation: "sr2-spin .7s linear infinite" }} />
                        {ar ? "البروفيسور الذكي يراجع القسم…" : "AI professor reviewing section…"}
                      </div>
                    )}
                    {st.status === "done"  && <div dangerouslySetInnerHTML={{ __html: formatResult(st.result) }} />}
                    {st.status === "error" && <div>❌ {st.result}</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 24 }}>
        {ar ? "⚠️ الملاحظات استرشادية. يُوصى بمراجعتها مع المشرف الأكاديمي قبل اعتمادها."
            : "⚠️ Feedback is advisory. Consult your academic supervisor before acting on it."}
      </p>
    </div>
  );
}
