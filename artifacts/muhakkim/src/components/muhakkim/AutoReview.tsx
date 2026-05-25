import { useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useLanguage } from "../../lib/i18n";

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReviewResult {
  title_review: string;
  toc_review: string;
  abstract_review: string;
  theoretical_framework_review: string;
  methodology_review: string;
  data_analysis_review: string;
  results_review: string;
  recommendations_review: string;
  hypotheses_objectives_review: string;
  gaps: string;
  score: number;
}

const FIELDS: { key: keyof ReviewResult; iconAr: string; ar: string; en: string; color: string; bg: string; border: string }[] = [
  { key: "title_review",                   iconAr: "🏷️",  ar: "العنوان",                  en: "Title",                   color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { key: "abstract_review",                iconAr: "📄",  ar: "المستخلص",                 en: "Abstract",                color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { key: "hypotheses_objectives_review",   iconAr: "🎯",  ar: "الأهداف والفرضيات",        en: "Objectives & Hypotheses", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { key: "toc_review",                     iconAr: "📑",  ar: "الفهرس",                   en: "Table of Contents",       color: "#86198f", bg: "#fdf4ff", border: "#f0abfc" },
  { key: "theoretical_framework_review",   iconAr: "📚",  ar: "الإطار النظري",            en: "Theoretical Framework",   color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { key: "methodology_review",             iconAr: "🔬",  ar: "المنهجية",                 en: "Methodology",             color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" },
  { key: "data_analysis_review",           iconAr: "📊",  ar: "تحليل البيانات",           en: "Data Analysis",           color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  { key: "results_review",                 iconAr: "📈",  ar: "النتائج",                  en: "Results",                 color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  { key: "recommendations_review",         iconAr: "💡",  ar: "التوصيات",                 en: "Recommendations",         color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "gaps",                           iconAr: "🔍",  ar: "الفجوات المكتشفة",         en: "Identified Gaps",         color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
];

type Phase = "idle" | "extracting" | "reviewing" | "done" | "error";

const NAVY = "#1e293b";

function fmt(txt: string) {
  return txt
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- /gm, "• ")
    .replace(/\n/g, "<br>");
}

// ─── PDF extractor ────────────────────────────────────────────────────────────
async function extractPdf(file: File, maxPages = 60): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf  = await getDocument({ data: buf }).promise;
  const mp   = Math.min(pdf.numPages, maxPages);
  let text   = "";
  for (let i = 1; i <= mp; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

// ─── DOCX extractor (mammoth browser build) ───────────────────────────────────
async function extractDocx(file: File): Promise<string> {
  const { extractRawText } = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer: buf });
  return result.value;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AutoReview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const fileRef      = useRef<HTMLInputElement>(null);
  const [phase, setPhase]   = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError]   = useState("");
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setPhase("idle"); setFileName(""); setPageCount(0);
    setChunkCount(0); setReview(null); setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext ?? "")) {
      setError(ar ? "نوع الملف غير مدعوم. يُقبل: PDF · DOCX · TXT" : "Unsupported file type. Accepted: PDF · DOCX · TXT");
      setPhase("error"); return;
    }
    setFileName(file.name); setPhase("extracting"); setError("");

    try {
      let text = "";
      if (ext === "pdf") {
        const buf = await file.arrayBuffer();
        const pdf  = await getDocument({ data: buf }).promise;
        const mp   = Math.min(pdf.numPages, 60);
        setPageCount(mp);
        text = await extractPdf(file, mp);
      } else if (ext === "docx") {
        text = await extractDocx(file);
        setPageCount(0);
      } else {
        text = await file.text();
        setPageCount(0);
      }

      if (text.trim().length < 150) {
        setError(ar ? "النص المستخرج قصير جداً أو الملف فارغ." : "Extracted text is too short or file is empty.");
        setPhase("error"); return;
      }

      setPhase("reviewing");
      const res = await fetch("/api/ai/auto-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { review: ReviewResult; chunks: number };
      setChunkCount(data.chunks);
      setReview(data.review);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) void processFile(f);
  };

  const download = () => {
    if (!review) return;
    const lines = FIELDS.flatMap(f => {
      const val = review[f.key];
      if (!val || String(val) === "غير موجود" || String(val) === "غير موجود في هذا الجزء") return [];
      return [`\n${"=".repeat(50)}\n${ar ? f.ar : f.en}\n${"=".repeat(50)}\n`, String(val), ""];
    });
    lines.unshift(
      ar ? `تقرير المراجعة الأكاديمية الشاملة التلقائية\n${"=".repeat(50)}` : `Automated Academic Review Report\n${"=".repeat(50)}`,
      ar ? `الملف: ${fileName}` : `File: ${fileName}`,
      ar ? `التقييم العام: ${review.score}/10\n` : `Overall Score: ${review.score}/10\n`,
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: ar ? "تقرير_المراجعة.txt" : "review_report.txt" });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // Score colour
  const scoreColor = review
    ? review.score >= 7 ? "#166534" : review.score >= 4 ? "#b45309" : "#991b1b"
    : NAVY;
  const scoreBg    = review
    ? review.score >= 7 ? "#f0fdf4" : review.score >= 4 ? "#fffbeb" : "#fff5f5"
    : "#f8faff";
  const scoreBorder= review
    ? review.score >= 7 ? "#bbf7d0" : review.score >= 4 ? "#fde68a" : "#fecaca"
    : "#e8ecf4";

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 1000, margin: "0 auto", fontFamily: ar ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>
      <style>{`@keyframes ar-spin{to{transform:rotate(360deg)}} @keyframes ar-bounce{0%,100%{transform:translateY(-4px)}50%{transform:translateY(4px)}} @keyframes ar-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#f0f9ff,#eff6ff)", border: "1.5px solid #bae6fd", borderRadius: 16, padding: "18px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#0369a1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📊</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 3px", fontSize: 18, fontWeight: 900, color: NAVY }}>
            {ar ? "المراجعة الشاملة التلقائية بالذكاء الاصطناعي" : "Automated Full AI Thesis Review"}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#0369a1" }}>
            {ar ? "ارفع PDF · DOCX · TXT — يُجزّأ النص تلقائياً ويُدمج في تقرير موحّد مع تقييم /10"
                : "Upload PDF · DOCX · TXT — text is auto-chunked and merged into a unified report with score /10"}
          </p>
        </div>
        {phase === "done" && review && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {chunkCount > 1 && (
              <div style={{ background: "#fff", border: "1.5px solid #bae6fd", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#0369a1" }}>{chunkCount}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{ar ? "جزء" : "chunks"}</div>
              </div>
            )}
            <div style={{ background: scoreBg, border: `1.5px solid ${scoreBorder}`, borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: scoreColor, lineHeight: 1 }}>{review.score}<span style={{ fontSize: 11, opacity: .7 }}>/10</span></div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{ar ? "التقييم" : "Score"}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Upload zone ── */}
      {(phase === "idle" || phase === "error") && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? "#3b82f6" : "#cbd5e1"}`, borderRadius: 16, padding: "36px 20px", textAlign: "center", background: dragOver ? "#eff6ff" : "#f8faff", cursor: "pointer", transition: "all .15s", marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 10, animation: "ar-bounce 2s ease-in-out infinite" }}>📁</div>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15, color: NAVY }}>{ar ? "اسحب الملف هنا أو اضغط للاختيار" : "Drag file here or click to browse"}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>PDF · DOCX · TXT — {ar ? "حتى ٦٠ صفحة" : "up to 60 pages"}</p>
          {phase === "error" && <p style={{ marginTop: 12, color: "#991b1b", fontWeight: 600, fontSize: 13 }}>❌ {error}</p>}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} style={{ display: "none" }} />
        </div>
      )}

      {/* ── Processing state ── */}
      {(phase === "extracting" || phase === "reviewing") && (
        <div style={{ background: "#f8faff", border: "1.5px solid #bfdbfe", borderRadius: 16, padding: "36px 20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, border: "4px solid #bfdbfe", borderTopColor: "#3b82f6", borderRadius: "50%", margin: "0 auto 18px", animation: "ar-spin .8s linear infinite" }} />
          <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 15, color: NAVY }}>
            {phase === "extracting" ? (ar ? "⚙️ استخراج النص من الملف…" : "⚙️ Extracting text from file…") : (ar ? "🧠 الذكاء الاصطناعي يراجع الرسالة…" : "🧠 AI is reviewing the thesis…")}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            {phase === "reviewing" ? (ar ? "يُجزّأ النص ويُرسل على دفعات — قد يستغرق دقيقة أو دقيقتين" : "Text is chunked and sent in batches — may take 1-2 minutes") : fileName}
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {phase === "done" && review && (
        <div style={{ animation: "ar-fade .4s ease-out" }}>
          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={download} style={{ background: "#1e293b", border: "none", borderRadius: 12, color: "#fff", padding: "11px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
              💾 {ar ? "تحميل التقرير TXT" : "Download Report TXT"}
            </button>
            <button onClick={reset} style={{ background: "#f1f5f9", border: "1.5px solid #e2e8f0", borderRadius: 12, color: "#64748b", padding: "11px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              🔄 {ar ? "مراجعة ملف آخر" : "Review Another File"}
            </button>
            <span style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 9, padding: "9px 14px", fontSize: 12, color: "#166534", fontWeight: 700, display: "flex", alignItems: "center" }}>
              ✅ {fileName}{pageCount > 0 && ` · ${pageCount}${ar ? " صفحة" : " pages"}`}
            </span>
          </div>

          {/* Score bar */}
          <div style={{ background: scoreBg, border: `1.5px solid ${scoreBorder}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: scoreColor }}>{ar ? "التقييم الأكاديمي العام" : "Overall Academic Score"}</p>
              <div style={{ background: "#e2e8f0", borderRadius: 99, height: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(review.score / 10) * 100}%`, background: scoreColor, borderRadius: 99, transition: "width 1s ease" }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor }}>{review.score}<span style={{ fontSize: 14, opacity: .6 }}>/10</span></div>
          </div>

          {/* Section cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(430px,1fr))", gap: 12 }}>
            {FIELDS.map(f => {
              const val = String(review[f.key] ?? "");
              if (!val || val === "غير موجود" || val === "غير موجود في هذا الجزء" || val === "0") return null;
              return (
                <div key={f.key} style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ background: f.bg, borderBottom: `1.5px solid ${f.border}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 16 }}>{f.iconAr}</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: f.color }}>{ar ? f.ar : f.en}</span>
                  </div>
                  <div style={{ padding: "12px 14px", fontSize: 13, color: NAVY, direction: "rtl", lineHeight: 1.85, maxHeight: 260, overflowY: "auto" }}
                    dangerouslySetInnerHTML={{ __html: fmt(val) }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 24 }}>
        {ar ? "⚠️ التقرير استرشادي. يُوصى بمراجعته مع المشرف الأكاديمي قبل اعتماده."
            : "⚠️ Report is advisory. Consult your academic supervisor before acting on it."}
      </p>
    </div>
  );
}
