import { useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useLanguage } from "../../lib/i18n";
import { extractRawText } from "mammoth/mammoth.browser.js";

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Section definitions ──────────────────────────────────────────────────────
const SECTIONS = [
  { id: "title",           icon: "📌", ar: "العنوان",              en: "Title",                color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { id: "abstract",        icon: "📝", ar: "المستخلص",             en: "Abstract",             color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "introduction",    icon: "📖", ar: "المقدمة والإشكالية",   en: "Introduction",         color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "objectives",      icon: "🎯", ar: "الأهداف والفرضيات",    en: "Objectives",           color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "theoretical",     icon: "📚", ar: "الإطار النظري",        en: "Theoretical Framework",color: "#5b21b6", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "methodology",     icon: "🔬", ar: "المنهجية",             en: "Methodology",          color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
  { id: "analysis",        icon: "📊", ar: "تحليل البيانات",       en: "Data Analysis",        color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  { id: "results",         icon: "📈", ar: "النتائج والمناقشة",    en: "Results",              color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  { id: "conclusion",      icon: "🏁", ar: "الخاتمة",              en: "Conclusion",           color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  { id: "recommendations", icon: "💡", ar: "التوصيات",             en: "Recommendations",      color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  { id: "references",      icon: "📋", ar: "المراجع والمصادر",     en: "References",           color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  { id: "language",        icon: "✍️", ar: "اللغة والأسلوب",       en: "Language & Style",     color: "#86198f", bg: "#fdf4ff", border: "#f0abfc" },
  { id: "formatting",      icon: "📄", ar: "التنسيق والهيكل",      en: "Formatting",           color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
] as const;

type SecId = typeof SECTIONS[number]["id"];

const ROLES = [
  { id: "supervisor", icon: "👨‍🏫", ar: "مشرف",          en: "Supervisor" },
  { id: "discussant", icon: "🎤",   ar: "مناقش داخلي",   en: "Discussant" },
  { id: "external",   icon: "🌍",   ar: "مناقش خارجي",   en: "External Reviewer" },
  { id: "researcher", icon: "🔬",   ar: "باحث",          en: "Researcher" },
] as const;

const STRICTNESS = [
  { id: "low",    icon: "🟢", ar: "متساهل — للمسودات",    en: "Lenient — drafts" },
  { id: "medium", icon: "🟡", ar: "متوسط — مراجعة عادية", en: "Medium — standard" },
  { id: "high",   icon: "🔴", ar: "صارم — مراجعة نهائية", en: "Strict — final" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SectionResult { score: number; strengths: string; weaknesses: string; suggestions: string[] }
interface ReviewOutput { sections: Record<string, SectionResult>; overall_score: number; summary: string }
type Phase = "role" | "input" | "reviewing" | "done" | "error";

const NAVY = "#1e293b";

function scoreColor(s: number) { return s >= 7 ? "#166534" : s >= 4 ? "#b45309" : "#991b1b"; }
function scoreBg(s: number)    { return s >= 7 ? "#f0fdf4" : s >= 4 ? "#fffbeb" : "#fff5f5"; }
function scoreBorder(s: number){ return s >= 7 ? "#bbf7d0" : s >= 4 ? "#fde68a" : "#fecaca"; }

// ─── PDF extractor ────────────────────────────────────────────────────────────
async function extractPdf(file: File): Promise<string> {
  const buf  = await file.arrayBuffer();
  const pdf  = await getDocument({ data: buf }).promise;
  const mp   = Math.min(pdf.numPages, 60);
  let text   = "";
  for (let i = 1; i <= mp; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

async function extractFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf")  return extractPdf(file);
  if (ext === "docx") { const r = await extractRawText({ arrayBuffer: await file.arrayBuffer() }); return r.value; }
  return file.text();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlatformReview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [phase, setPhase]         = useState<Phase>("role");
  const [role, setRole]           = useState("supervisor");
  const [strictness, setStrictness] = useState<"low"|"medium"|"high">("medium");
  const [activeTab, setActiveTab]  = useState<"upload"|"text"|"sections">("upload");

  // Thesis metadata
  const [meta, setMeta] = useState({ title: "", researcher: "", degree: "", specialization: "", university: "", year: "" });

  // Text areas per section
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.id, ""]))
  );
  const [enabledSecs, setEnabledSecs] = useState<Set<SecId>>(
    new Set(SECTIONS.map(s => s.id))
  );

  // Direct text analysis (tab 2)
  const [directText, setDirectText]   = useState("");
  const [directSec, setDirectSec]     = useState<SecId>("abstract");

  // File
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileStatus, setFileStatus]   = useState<"none"|"loading"|"ok"|"err">("none");
  const [fileName, setFileName]       = useState("");
  const [dragOver, setDragOver]       = useState(false);

  // Results
  const [result, setResult]   = useState<ReviewOutput | null>(null);
  const [error, setError]     = useState("");

  // ── helpers ──
  const setTxt = (id: string, v: string) => setTexts(p => ({ ...p, [id]: v }));
  const toggleSec = (id: SecId) =>
    setEnabledSecs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const filledCount    = SECTIONS.filter(s => texts[s.id].trim()).length;
  const enabledCount   = enabledSecs.size;
  const readyCount     = SECTIONS.filter(s => enabledSecs.has(s.id) && texts[s.id].trim()).length;

  // ── file upload ──
  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf","docx","txt"].includes(ext ?? "")) {
      setFileStatus("err"); setFileName(ar ? "نوع غير مدعوم" : "Unsupported type"); return;
    }
    setFileStatus("loading"); setFileName(file.name);
    try {
      const text = await extractFile(file);
      if (text.trim().length < 100) throw new Error(ar ? "الملف فارغ أو لا يحتوي على نص كافٍ" : "File empty or too short");
      setTexts(Object.fromEntries(SECTIONS.map(s => [s.id, ""])));
      setDirectText(text);
      setFileStatus("ok");
      setActiveTab("text");
    } catch (e) { setFileStatus("err"); setFileName(e instanceof Error ? e.message : String(e)); }
  };

  // ── start review ──
  const startReview = async () => {
    const payload: Record<string, string> = {};

    // Collect from section texts
    for (const s of SECTIONS) {
      if (enabledSecs.has(s.id) && texts[s.id].trim()) payload[s.id] = texts[s.id];
    }
    // Also inject direct text under chosen section if no text provided for it
    if (directText.trim() && enabledSecs.has(directSec) && !payload[directSec]) {
      payload[directSec] = directText;
    }

    if (!Object.keys(payload).length) {
      setError(ar ? "أدخل نصاً في قسم واحد على الأقل." : "Enter text in at least one section."); return;
    }

    setPhase("reviewing"); setError("");
    try {
      const res = await fetch("/api/ai/platform-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: payload, role, strictness, meta }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? `HTTP ${res.status}`); }
      const data = await res.json() as ReviewOutput;
      setResult(data); setPhase("done");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPhase("error"); }
  };

  const reset = () => { setPhase("role"); setResult(null); setError(""); setTexts(Object.fromEntries(SECTIONS.map(s => [s.id,""]))); setDirectText(""); setFileStatus("none"); setFileName(""); };

  const download = () => {
    if (!result) return;
    const lines: string[] = [
      ar ? "تقرير المراجعة الأكاديمية الشاملة" : "Comprehensive Academic Review Report",
      "=".repeat(50),
      ar ? `التقييم العام: ${result.overall_score}/10` : `Overall Score: ${result.overall_score}/10`,
      ar ? `الدور: ${role}  |  الصرامة: ${strictness}` : `Role: ${role}  |  Strictness: ${strictness}`,
      "", result.summary as string, "",
    ];
    for (const sec of SECTIONS) {
      const r = result.sections[sec.id];
      if (!r) continue;
      lines.push(`\n${"─".repeat(40)}\n${ar ? sec.ar : sec.en} — ${r.score}/10\n${"─".repeat(40)}`);
      lines.push(ar ? `نقاط القوة: ${r.strengths}` : `Strengths: ${r.strengths}`);
      lines.push(ar ? `نقاط الضعف: ${r.weaknesses}` : `Weaknesses: ${r.weaknesses}`);
      if (r.suggestions?.length) lines.push((ar ? "الاقتراحات:\n" : "Suggestions:\n") + r.suggestions.map(s => `• ${s}`).join("\n"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: ar ? "تقرير_المراجعة_الشاملة.txt" : "review_report.txt" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const card: React.CSSProperties = { background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 14, overflow: "hidden" };

  // ════════════════════ RENDER ════════════════════
  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ padding: "20px 16px 56px", maxWidth: 1060, margin: "0 auto", fontFamily: ar ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>
      <style>{`@keyframes pr-spin{to{transform:rotate(360deg)}} @keyframes pr-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pr-bounce{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}`}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", border: "1.5px solid #ddd6fe", borderRadius: 16, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#5b21b6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>🎓</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: NAVY }}>
            {ar ? "منصة المراجعة الأكاديمية الشاملة" : "Comprehensive Academic Review Platform"}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#5b21b6" }}>
            {ar ? "١٣ قسماً · ٤ أدوار · ٣ مستويات صرامة · PDF · DOCX · TXT · تحليل مباشر"
                : "13 sections · 4 roles · 3 strictness levels · PDF · DOCX · TXT · Direct text analysis"}
          </p>
        </div>
        {phase === "done" && result && (
          <div style={{ background: scoreBg(result.overall_score as number), border: `1.5px solid ${scoreBorder(result.overall_score as number)}`, borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: scoreColor(result.overall_score as number), lineHeight: 1 }}>{result.overall_score}<span style={{ fontSize: 12, opacity: .7 }}>/10</span></div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{ar ? "التقييم" : "Score"}</div>
          </div>
        )}
      </div>

      {/* ══════════════ PHASE: ROLE ══════════════ */}
      {phase === "role" && (
        <div style={{ animation: "pr-fade .3s ease-out" }}>
          <p style={{ textAlign: "center", fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 14 }}>
            {ar ? "اختر دورك أولاً" : "Choose your role first"}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {ROLES.map(r => (
              <div key={r.id} onClick={() => setRole(r.id)}
                style={{ background: role === r.id ? "#f5f3ff" : "#fff", border: `2px solid ${role === r.id ? "#7c3aed" : "#e8ecf4"}`, borderRadius: 14, padding: "18px 20px", textAlign: "center", cursor: "pointer", minWidth: 110, transition: "all .15s", boxShadow: role === r.id ? "0 4px 14px rgba(124,58,237,.18)" : "none" }}>
                <div style={{ fontSize: 30, marginBottom: 6 }}>{r.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: role === r.id ? "#5b21b6" : NAVY }}>{ar ? r.ar : r.en}</div>
              </div>
            ))}
          </div>
          {/* Strictness */}
          <p style={{ textAlign: "center", fontWeight: 700, fontSize: 14, color: NAVY, marginBottom: 10 }}>{ar ? "مستوى الصرامة" : "Strictness Level"}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
            {STRICTNESS.map(s => (
              <div key={s.id} onClick={() => setStrictness(s.id as "low"|"medium"|"high")}
                style={{ background: strictness === s.id ? "#eff6ff" : "#fff", border: `2px solid ${strictness === s.id ? "#3b82f6" : "#e8ecf4"}`, borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: strictness === s.id ? 800 : 500, color: strictness === s.id ? "#1d4ed8" : NAVY, transition: "all .12s" }}>
                {s.icon} {ar ? s.ar : s.en}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => setPhase("input")} style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 32px", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(92,33,182,.3)" }}>
              {ar ? "التالي ← إدخال الأقسام" : "Next → Enter sections"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ PHASE: INPUT ══════════════ */}
      {phase === "input" && (
        <div style={{ animation: "pr-fade .3s ease-out" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["upload", "text", "sections"] as const).map(t => {
              const labels = { upload: ar ? "📤 رفع ملف" : "📤 Upload File", text: ar ? "✍️ تحليل نصي" : "✍️ Text Analysis", sections: ar ? `📑 الأقسام (${readyCount}/${enabledCount})` : `📑 Sections (${readyCount}/${enabledCount})` };
              return (
                <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#5b21b6" : "#f1f5f9", color: activeTab === t ? "#fff" : "#64748b", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  {labels[t]}
                </button>
              );
            })}
            <button onClick={reset} style={{ marginInlineStart: "auto", background: "#f8faff", border: "1.5px solid #e8ecf4", borderRadius: 10, color: "#64748b", padding: "10px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              ← {ar ? "تغيير الدور" : "Change Role"}
            </button>
          </div>

          {/* Tab: Upload */}
          {activeTab === "upload" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? "#7c3aed" : "#cbd5e1"}`, borderRadius: 16, padding: "40px 20px", textAlign: "center", background: dragOver ? "#f5f3ff" : "#f8faff", cursor: "pointer", transition: "all .15s", marginBottom: 12 }}>
              <div style={{ fontSize: 42, marginBottom: 10, animation: "pr-bounce 2s ease-in-out infinite" }}>📁</div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: NAVY }}>{ar ? "اسحب الملف أو اضغط للاختيار" : "Drag or click to choose file"}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>PDF · DOCX · TXT</p>
              {fileStatus === "loading" && <p style={{ marginTop: 10, color: "#5b21b6", fontWeight: 600, fontSize: 13, animation: "pr-bounce 1s ease-in-out infinite" }}>{ar ? "⚙️ جارٍ استخراج النص…" : "⚙️ Extracting text…"}</p>}
              {fileStatus === "ok"      && <p style={{ marginTop: 10, color: "#166534", fontWeight: 600, fontSize: 13 }}>✅ {fileName} — {ar ? "تم الاستخراج. انتقل إلى تبويب التحليل النصي." : "Extracted. Go to Text Analysis tab."}</p>}
              {fileStatus === "err"     && <p style={{ marginTop: 10, color: "#991b1b", fontWeight: 600, fontSize: 13 }}>❌ {fileName}</p>}
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} style={{ display: "none" }} />
            </div>
          )}

          {/* Tab: Text Analysis (direct paste for one chapter) */}
          {activeTab === "text" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginBottom: 8 }}>{ar ? "اختر الفصل:" : "Choose chapter:"}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {SECTIONS.map(s => (
                  <button key={s.id} onClick={() => setDirectSec(s.id)}
                    style={{ background: directSec === s.id ? s.bg : "#f1f5f9", border: `1.5px solid ${directSec === s.id ? s.border : "#e8ecf4"}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: directSec === s.id ? 800 : 500, color: directSec === s.id ? s.color : "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
                    {s.icon} {ar ? s.ar : s.en}
                  </button>
                ))}
              </div>
              <textarea value={directText} onChange={e => setDirectText(e.target.value)}
                rows={9} dir="rtl"
                placeholder={ar ? "الصق نص الفصل هنا (أو سيظهر هنا محتوى الملف الذي رفعته)…" : "Paste chapter text here…"}
                style={{ width: "100%", padding: "14px 16px", border: "1.5px solid #e8ecf4", borderRadius: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical", color: NAVY, background: "#f8faff" }} />
              <button onClick={() => { setTxt(directSec, directText); setActiveTab("sections"); }}
                disabled={!directText.trim()}
                style={{ marginTop: 10, background: !directText.trim() ? "#f1f5f9" : "#5b21b6", color: !directText.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: !directText.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {ar ? "→ أضف للقسم المحدد" : "→ Add to selected section"}
              </button>
            </div>
          )}

          {/* Tab: Sections */}
          {activeTab === "sections" && (
            <div>
              {/* Thesis metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, marginBottom: 14, background: "#f8faff", border: "1.5px solid #e8ecf4", borderRadius: 12, padding: "14px 16px" }}>
                {[
                  { k: "title",         p: ar ? "عنوان الرسالة"   : "Thesis title" },
                  { k: "researcher",    p: ar ? "اسم الباحث"      : "Researcher name" },
                  { k: "degree",        p: ar ? "ماجستير / دكتوراه" : "Master / PhD" },
                  { k: "specialization",p: ar ? "التخصص"          : "Specialization" },
                  { k: "university",    p: ar ? "الجامعة"          : "University" },
                  { k: "year",          p: ar ? "السنة"            : "Year" },
                ].map(f => (
                  <input key={f.k} value={meta[f.k as keyof typeof meta]}
                    onChange={e => setMeta(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.p} dir="rtl"
                    style={{ padding: "8px 12px", border: "1.5px solid #e8ecf4", borderRadius: 8, fontSize: 12, fontFamily: "inherit", color: NAVY, background: "#fff" }} />
                ))}
              </div>
              {/* Select all / deselect */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setEnabledSecs(new Set(SECTIONS.map(s => s.id)))} style={{ background: "#ede9fe", border: "none", borderRadius: 8, color: "#5b21b6", padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>☑️ {ar ? "تحديد الكل" : "Select all"}</button>
                <button onClick={() => setEnabledSecs(new Set())} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, color: "#64748b", padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔲 {ar ? "إلغاء الكل" : "Deselect all"}</button>
                <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center" }}>{ar ? `${readyCount} جاهز` : `${readyCount} ready`}</span>
              </div>
              {/* Section cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 10 }}>
                {SECTIONS.map(sec => {
                  const enabled = enabledSecs.has(sec.id);
                  return (
                    <div key={sec.id} style={{ ...card, opacity: enabled ? 1 : .5 }}>
                      <div style={{ background: enabled ? sec.bg : "#f8faff", borderBottom: `1.5px solid ${enabled ? sec.border : "#e8ecf4"}`, padding: "9px 12px", display: "flex", alignItems: "center", gap: 7 }}>
                        <span>{sec.icon}</span>
                        <span style={{ fontWeight: 800, fontSize: 13, color: enabled ? sec.color : "#94a3b8", flex: 1 }}>{ar ? sec.ar : sec.en}</span>
                        <input type="checkbox" checked={enabled} onChange={() => toggleSec(sec.id)}
                          style={{ width: 16, height: 16, accentColor: sec.color, cursor: "pointer" }} />
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <textarea value={texts[sec.id]} onChange={e => setTxt(sec.id, e.target.value)}
                          disabled={!enabled} rows={3} dir="rtl"
                          placeholder={ar ? `أدخل نص ${sec.ar} هنا…` : `Enter ${sec.en} text here…`}
                          style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e8ecf4", borderRadius: 8, fontSize: 12, fontFamily: "inherit", resize: "vertical", color: NAVY, background: enabled ? "#f8faff" : "#f1f5f9", cursor: enabled ? "text" : "not-allowed" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => void startReview()} disabled={readyCount === 0 && !directText.trim()}
              style={{ background: readyCount === 0 && !directText.trim() ? "#e2e8f0" : "linear-gradient(135deg,#5b21b6,#7c3aed)", color: readyCount === 0 && !directText.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: 12, padding: "13px 26px", fontWeight: 800, fontSize: 15, cursor: readyCount === 0 && !directText.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: readyCount > 0 || directText.trim() ? "0 4px 16px rgba(92,33,182,.3)" : "none" }}>
              🚀 {ar ? "بدء المراجعة الذكية" : "Start Smart Review"}
            </button>
            {error && <span style={{ color: "#991b1b", fontSize: 13, fontWeight: 600 }}>❌ {error}</span>}
          </div>
        </div>
      )}

      {/* ══════════════ PHASE: REVIEWING ══════════════ */}
      {phase === "reviewing" && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          {/* Progress ring */}
          <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 20px" }}>
            <svg viewBox="0 0 120 120" style={{ width: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e8ecf4" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#7c3aed" strokeWidth="10"
                strokeLinecap="round" strokeDasharray="326" strokeDashoffset="82"
                style={{ animation: "pr-spin 1.8s linear infinite", transformOrigin: "60px 60px" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎓</div>
          </div>
          <p style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>{ar ? "الذكاء الاصطناعي يراجع الأقسام…" : "AI is reviewing sections…"}</p>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{ar ? "يتم تحليل الأقسام بالتوازي — قد يستغرق دقيقة أو دقيقتين" : "Sections analysed in parallel — may take 1-2 minutes"}</p>
        </div>
      )}

      {/* ══════════════ PHASE: ERROR ══════════════ */}
      {phase === "error" && (
        <div style={{ background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 14, padding: "28px", textAlign: "center" }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#991b1b", marginBottom: 10 }}>❌ {error}</p>
          <button onClick={() => setPhase("input")} style={{ background: "#991b1b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "← الرجوع" : "← Back"}</button>
        </div>
      )}

      {/* ══════════════ PHASE: DONE ══════════════ */}
      {phase === "done" && result && (
        <div style={{ animation: "pr-fade .4s ease-out" }}>
          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={download} style={{ background: "#1e293b", border: "none", borderRadius: 12, color: "#fff", padding: "11px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              💾 {ar ? "تحميل التقرير TXT" : "Download TXT"}
            </button>
            <button onClick={reset} style={{ background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 12, color: "#64748b", padding: "11px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              🔄 {ar ? "مراجعة جديدة" : "New Review"}
            </button>
          </div>

          {/* Score bar */}
          <div style={{ background: scoreBg(result.overall_score as number), border: `1.5px solid ${scoreBorder(result.overall_score as number)}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: scoreColor(result.overall_score as number) }}>{ar ? "التقييم الأكاديمي العام" : "Overall Score"}</p>
              <div style={{ background: "#e2e8f0", borderRadius: 99, height: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${((result.overall_score as number)/10)*100}%`, background: scoreColor(result.overall_score as number), borderRadius: 99 }} />
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: scoreColor(result.overall_score as number) }}>{result.overall_score}<span style={{ fontSize: 14, opacity: .6 }}>/10</span></div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 12, padding: "14px 16px", marginBottom: 14, fontSize: 13, color: NAVY, lineHeight: 1.85, direction: "rtl" }}>
              <strong style={{ color: "#5b21b6" }}>📝 {ar ? "الملخص النهائي:" : "Final Summary:"}</strong><br />
              {result.summary}
            </div>
          )}

          {/* Section results */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 12 }}>
            {SECTIONS.map(sec => {
              const r = result.sections[sec.id];
              if (!r || !r.strengths) return null;
              return (
                <div key={sec.id} style={card}>
                  <div style={{ background: sec.bg, borderBottom: `1.5px solid ${sec.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                    <span>{sec.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: sec.color, flex: 1 }}>{ar ? sec.ar : sec.en}</span>
                    <span style={{ background: scoreBg(r.score), border: `1.5px solid ${scoreBorder(r.score)}`, borderRadius: 8, padding: "3px 10px", fontSize: 13, fontWeight: 800, color: scoreColor(r.score) }}>{r.score}/10</span>
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    {/* Score bar */}
                    <div style={{ background: "#f1f5f9", borderRadius: 99, height: 7, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: `${(r.score/10)*100}%`, background: scoreColor(r.score), borderRadius: 99 }} />
                    </div>
                    {r.strengths && <p style={{ margin: "0 0 6px", fontSize: 12.5, color: "#166534", direction: "rtl", lineHeight: 1.7 }}><strong>✅ {ar ? "القوة: " : "Strengths: "}</strong>{r.strengths}</p>}
                    {r.weaknesses && <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#991b1b", direction: "rtl", lineHeight: 1.7 }}><strong>⚠️ {ar ? "الضعف: " : "Weaknesses: "}</strong>{r.weaknesses}</p>}
                    {r.suggestions?.length > 0 && (
                      <div style={{ background: "#f8faff", borderRadius: 8, padding: "8px 10px" }}>
                        <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>💡 {ar ? "الاقتراحات:" : "Suggestions:"}</p>
                        {r.suggestions.map((s, i) => <p key={i} style={{ margin: "2px 0", fontSize: 12, color: NAVY, direction: "rtl" }}>• {s}</p>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 26 }}>
        {ar ? "⚠️ التقرير استرشادي. يُوصى بمراجعته مع المشرف الأكاديمي قبل اعتماده."
            : "⚠️ Report is advisory. Consult your academic supervisor before acting on it."}
      </p>
    </div>
  );
}
