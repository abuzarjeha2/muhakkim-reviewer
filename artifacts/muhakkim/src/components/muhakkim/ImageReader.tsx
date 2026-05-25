import { useState, useRef } from "react";
import { useLanguage } from "../../lib/i18n";

const GOLD = "#b45309";
const NAVY = "#1e293b";

type Mode = "describe" | "ocr" | "analyze" | "translate" | "custom";

export default function ImageReader() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string>("");
  const [base64, setBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("image/png");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<Mode>("describe");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError(isAr ? "يرجى اختيار ملف صورة." : "Please choose an image file.");
      return;
    }
    if (f.size > 7 * 1024 * 1024) {
      setError(isAr ? "حجم الصورة كبير (الحد الأقصى 7 ميجابايت)." : "Image too large (max 7 MB).");
      return;
    }
    setError(""); setResult(""); setFileName(f.name); setMimeType(f.type);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setPreview(url);
      const idx = url.indexOf(",");
      setBase64(idx >= 0 ? url.slice(idx + 1) : url);
    };
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!base64) {
      setError(isAr ? "ارفع صورة أولاً." : "Upload an image first.");
      return;
    }
    setError(""); setResult(""); setLoading(true);
    try {
      const r = await fetch("/api/ai/vision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, mode, prompt: customPrompt, lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setResult(data.content || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${(fileName || "image").replace(/\.[^.]+$/, "")}_analysis.txt`,
    });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const modes: { key: Mode; ar: string; en: string; icon: string; descAr: string; descEn: string }[] = [
    { key: "describe", ar: "وصف الصورة", en: "Describe", icon: "📝", descAr: "وصف منظّم لمحتوى الصورة", descEn: "Structured description" },
    { key: "ocr", ar: "استخراج النص", en: "Extract Text (OCR)", icon: "🔤", descAr: "استخراج كل النصوص حرفياً", descEn: "Extract all text verbatim" },
    { key: "analyze", ar: "تحليل عميق", en: "Deep Analysis", icon: "🔬", descAr: "تحليل أكاديمي مفصّل", descEn: "Detailed academic analysis" },
    { key: "translate", ar: "ترجمة النص", en: "Translate Text", icon: "🌐", descAr: "استخراج النص وترجمته", descEn: "Extract & translate text" },
    { key: "custom", ar: "سؤال مخصص", en: "Custom Question", icon: "❓", descAr: "اطرح سؤالك بنفسك", descEn: "Ask your own question" },
  ];

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👁️</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>{isAr ? "قارئ الصور الذكي" : "AI Image Reader"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#92400e" }}>
            {isAr ? "ارفع صورة · افهم محتواها، استخرج نصوصها، حلّلها، أو ترجمها بـ GPT-4.1 Vision"
                  : "Upload an image · understand, OCR, analyze, or translate it with GPT-4.1 Vision"}
          </p>
        </div>
      </div>

      {/* Upload */}
      <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
          🖼️ {isAr ? "ارفع الصورة" : "Upload image"}
        </div>
        <div onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #c7d4f0", borderRadius: 12, padding: "22px 12px", textAlign: "center", cursor: "pointer", background: preview ? "#f0fdf4" : "#f8faff", transition: "all .15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GOLD; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c7d4f0"; }}>
          {preview ? (
            <>
              <img src={preview} alt="preview" style={{ maxHeight: 240, maxWidth: "100%", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginTop: 8 }}>{fileName}</div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{isAr ? "اضغط لتغيير الصورة" : "Click to change"}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{isAr ? "اضغط لرفع الصورة" : "Click to upload"}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>PNG · JPG · WEBP · GIF (≤ 7MB)</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </div>

      {/* Mode picker */}
      {preview && (
        <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
            🎯 {isAr ? "اختر نوع التحليل" : "Choose analysis mode"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
            {modes.map(m => {
              const active = mode === m.key;
              return (
                <button key={m.key} onClick={() => setMode(m.key)}
                  style={{ background: active ? "#fffbeb" : "#fff", border: active ? "1.5px solid #fde68a" : "1.5px solid #e8ecf4", color: active ? GOLD : NAVY, borderRadius: 10, padding: "10px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: isAr ? "right" : "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <span>{isAr ? m.ar : m.en}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>{isAr ? m.descAr : m.descEn}</div>
                </button>
              );
            })}
          </div>

          {mode === "custom" && (
            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
              placeholder={isAr ? "مثال: ما الخطأ في هذه المعادلة؟ أو: لخّص هذا الجدول." : "Example: What's wrong with this equation? Or: Summarize this table."}
              style={{ width: "100%", minHeight: 70, marginTop: 12, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
          )}

          <button onClick={analyze} disabled={loading}
            style={{ width: "100%", marginTop: 16, background: "linear-gradient(135deg,#C9A84C,#b45309)", border: "none", borderRadius: 10, color: "#fff", padding: "12px", fontWeight: 800, fontSize: 14, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px #C9A84C33", opacity: loading ? 0.7 : 1 }}>
            {loading ? (isAr ? "⏳ جارٍ التحليل..." : "⏳ Analyzing...") : (isAr ? "✨ حلّل الصورة" : "✨ Analyze Image")}
          </button>
          {error && <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>
              📋 {isAr ? "نتيجة التحليل" : "Analysis Result"}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={copyResult}
                style={{ background: copied ? "#dcfce7" : "#f1f5f9", border: `1px solid ${copied ? "#86efac" : "#e2e8f0"}`, color: copied ? "#16a34a" : NAVY, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {copied ? (isAr ? "✓ تم النسخ" : "✓ Copied") : (isAr ? "📋 نسخ" : "📋 Copy")}
              </button>
              <button onClick={downloadResult}
                style={{ background: "#1e293b", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                💾 {isAr ? "تحميل" : "Download"}
              </button>
            </div>
          </div>
          <div style={{ background: "#fafbff", border: "1px solid #eef1f8", borderRadius: 10, padding: "14px 16px", fontSize: 14, lineHeight: 1.9, color: NAVY, whiteSpace: "pre-wrap", direction: isAr ? "rtl" : "ltr", textAlign: isAr ? "right" : "left" }}>
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
