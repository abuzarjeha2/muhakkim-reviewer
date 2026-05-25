import { useState, useRef } from "react";
import { useLanguage } from "../../lib/i18n";
import PptxGenJS from "pptxgenjs";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

type Slide = { title: string; bullets: string[]; speakerNotes: string };
type Outline = { title: string; subtitle: string; slides: Slide[] };

const GOLD = "#b45309";
const NAVY = "#1e293b";

const THEMES = [
  { key: "academic", ar: "أكاديمي رصين", en: "Academic", bg: "FFFFFF", text: "1E293B", accent: "B45309", title: "0F172A" },
  { key: "modern",   ar: "حديث ملوّن",   en: "Modern",   bg: "0F172A", text: "E2E8F0", accent: "FACC15", title: "FFFFFF" },
  { key: "minimal",  ar: "بسيط نظيف",    en: "Minimal",  bg: "F8FAFC", text: "334155", accent: "0EA5E9", title: "0F172A" },
  { key: "warm",     ar: "دافئ ذهبي",    en: "Warm Gold", bg: "FFFBEB", text: "451A03", accent: "B45309", title: "78350F" },
];

export default function SlidesMaker() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [slidesCount, setSlidesCount] = useState(10);
  const [theme, setTheme] = useState("academic");
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [error, setError] = useState("");

  // Source file state
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileStatus, setFileStatus] = useState<"idle"|"reading"|"ready"|"error">("idle");
  const [fileError, setFileError] = useState("");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setFileStatus("reading"); setFileError(""); setSourceText("");
    try {
      const lower = f.name.toLowerCase();
      let text = "";
      const isImage = f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower);
      if (isImage) {
        if (f.size > 7 * 1024 * 1024) throw new Error(isAr ? "حجم الصورة كبير (الحد 7MB)." : "Image too large (max 7MB).");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ""));
          r.onerror = () => reject(new Error("read error"));
          r.readAsDataURL(f);
        });
        const idx = dataUrl.indexOf(",");
        const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
        const resp = await fetch("/api/ai/vision", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: f.type, mode: "ocr", lang }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Vision failed");
        text = data.content || "";
      } else if (lower.endsWith(".pdf")) {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const max = Math.min(pdf.numPages, 300);
        const parts: string[] = [];
        for (let i = 1; i <= max; i++) {
          const page = await pdf.getPage(i);
          const c = await page.getTextContent();
          const t = c.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
          if (t) parts.push(t);
        }
        text = parts.join("\n\n");
      } else if (lower.endsWith(".docx") || lower.endsWith(".odt")) {
        const buf = await f.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: buf });
        text = r.value;
      } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf") || lower.endsWith(".csv")) {
        text = await f.text();
      } else {
        throw new Error(isAr ? "صيغة غير مدعومة. المدعوم: PDF · DOCX · ODT · TXT · MD · صور" : "Unsupported format. Supported: PDF · DOCX · ODT · TXT · MD · images");
      }
      if (text.trim().length < 100) throw new Error(isAr ? "المحتوى المستخرَج قصير جداً (أقل من 100 حرف)." : "Extracted content too short (<100 chars).");
      setSourceText(text);
      setFileStatus("ready");
    } catch (err) {
      setFileStatus("error");
      setFileError(err instanceof Error ? err.message : String(err));
    }
  };

  const clearFile = () => {
    setFileName(""); setSourceText(""); setFileStatus("idle"); setFileError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const generate = async () => {
    setError(""); setOutline(null);
    if (topic.trim().length < 5 && sourceText.trim().length < 100) {
      setError(isAr ? "أدخل موضوعاً (5 أحرف+) أو ارفع ملفاً مصدراً" : "Enter a topic (5+ chars) or upload a source file");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/ai/slides-outline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, slidesCount, lang, sourceText, sourceName: fileName.replace(/\.[^.]+$/, "") }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setOutline(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isAr ? "خطأ" : "Error"));
    } finally { setLoading(false); }
  };

  const download = async () => {
    if (!outline) return;
    const t = THEMES.find(x => x.key === theme) ?? THEMES[0];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = outline.title;

    // Cover slide
    const cover = pptx.addSlide();
    cover.background = { color: t.bg };
    cover.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.45, fill: { color: t.accent } });
    cover.addText(outline.title, {
      x: 0.6, y: 2.3, w: 12.1, h: 1.6,
      fontSize: 44, bold: true, color: t.title,
      align: isAr ? "right" : "left", valign: "middle",
      fontFace: isAr ? "Tajawal" : "Calibri",
      rtlMode: isAr,
    });
    if (outline.subtitle) {
      cover.addText(outline.subtitle, {
        x: 0.6, y: 4.0, w: 12.1, h: 0.8,
        fontSize: 22, color: t.text,
        align: isAr ? "right" : "left",
        fontFace: isAr ? "Tajawal" : "Calibri",
        rtlMode: isAr,
      });
    }
    cover.addText(isAr ? "أُنشئت بواسطة منصة محكّم" : "Generated by Muhakkim", {
      x: 0.6, y: 6.7, w: 12.1, h: 0.4,
      fontSize: 11, color: t.accent, italic: true,
      align: isAr ? "right" : "left",
      fontFace: isAr ? "Tajawal" : "Calibri",
      rtlMode: isAr,
    });

    // Content slides
    outline.slides.forEach((s, i) => {
      const slide = pptx.addSlide();
      slide.background = { color: t.bg };
      // Title bar
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.85, fill: { color: t.accent } });
      slide.addText(s.title, {
        x: 0.4, y: 0.1, w: 11.5, h: 0.7,
        fontSize: 26, bold: true, color: "FFFFFF",
        align: isAr ? "right" : "left", valign: "middle",
        fontFace: isAr ? "Tajawal" : "Calibri",
        rtlMode: isAr,
      });
      slide.addText(`${i + 1}`, {
        x: 12.3, y: 0.15, w: 0.9, h: 0.55,
        fontSize: 14, bold: true, color: "FFFFFF",
        align: "center", valign: "middle",
      });
      // Bullets
      if (s.bullets.length > 0) {
        slide.addText(
          s.bullets.map(b => ({ text: b, options: { bullet: { code: "25CF" }, breakLine: true } })),
          {
            x: 0.6, y: 1.3, w: 12.1, h: 5.5,
            fontSize: 20, color: t.text,
            align: isAr ? "right" : "left",
            valign: "top",
            paraSpaceAfter: 12,
            lineSpacingMultiple: 1.3,
            fontFace: isAr ? "Tajawal" : "Calibri",
            rtlMode: isAr,
          },
        );
      }
      // Footer
      slide.addText(outline.title, {
        x: 0.4, y: 7.05, w: 12.5, h: 0.3,
        fontSize: 9, color: t.accent, italic: true,
        align: isAr ? "right" : "left",
        fontFace: isAr ? "Tajawal" : "Calibri",
        rtlMode: isAr,
      });
      // Speaker notes
      if (s.speakerNotes) slide.addNotes(s.speakerNotes);
    });

    const safeName = (outline.title || "presentation").replace(/[^\w\u0600-\u06FF\s-]+/g, "").replace(/\s+/g, "_").slice(0, 60);
    await pptx.writeFile({ fileName: `${safeName}.pptx` });
  };

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📊</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>{isAr ? "مولّد عروض البوربوينت الذكي" : "AI PowerPoint Generator"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#92400e" }}>{isAr ? "أدخل الموضوع · احصل على عرض احترافي قابل للتحميل (.pptx)" : "Enter topic · get a professional downloadable .pptx deck"}</p>
        </div>
      </div>

      {/* Source file (optional) */}
      <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>
            📂 {isAr ? "ابنِ العرض من ملف (اختياري)" : "Build slides from a file (optional)"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            PDF · Word · ODT · TXT · MD · {isAr ? "صور (OCR)" : "Images (OCR)"}
          </div>
        </div>
        <div onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #c7d4f0", borderRadius: 12, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: fileStatus === "ready" ? "#f0fdf4" : "#f8faff", transition: "all .15s" }}>
          {fileStatus === "reading" && <div style={{ color: "#1d4ed8", fontSize: 13 }}>⏳ {isAr ? "جارٍ قراءة الملف…" : "Reading file…"}</div>}
          {fileStatus === "ready" && (
            <>
              <div style={{ fontSize: 22 }}>✅</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#065f46", marginTop: 4 }}>{fileName}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                {sourceText.length.toLocaleString()} {isAr ? "حرف · سيُبنى العرض من محتواه" : "characters · slides will be grounded in it"}
              </div>
            </>
          )}
          {fileStatus === "error" && <div style={{ color: "#dc2626", fontSize: 13 }}>❌ {fileError}</div>}
          {fileStatus === "idle" && (
            <>
              <div style={{ fontSize: 26 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginTop: 4 }}>{isAr ? "اضغط لرفع ملف يُبنى منه العرض" : "Click to upload a source file"}</div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{isAr ? "صور تُستخرج نصوصها تلقائياً عبر OCR" : "Images auto-OCRed to text"}</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.odt,.txt,.md,.rtf,.csv,image/*" onChange={onPickFile} style={{ display: "none" }} />
        {fileStatus === "ready" && (
          <button onClick={clearFile} style={{ marginTop: 10, background: "#fff", border: "1.5px solid #fecaca", borderRadius: 8, color: "#dc2626", padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            🗑️ {isAr ? "إزالة الملف" : "Remove file"}
          </button>
        )}
      </div>

      {/* Form */}
      <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          {isAr ? "الموضوع" : "Topic"}
          {fileStatus === "ready" && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginInlineStart: 6 }}>{isAr ? "(اختياري عند رفع ملف)" : "(optional when a file is uploaded)"}</span>}
        </label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)}
          placeholder={isAr ? "مثال: أساليب القياس النفسي في البحث التربوي" : "Example: Psychometric methods in educational research"}
          style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{isAr ? "الجمهور" : "Audience"}</label>
            <input value={audience} onChange={e => setAudience(e.target.value)}
              placeholder={isAr ? "طلاب دراسات عليا، مؤتمر..." : "Grad students, conference..."}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{isAr ? `عدد الشرائح (${slidesCount})` : `Slides (${slidesCount})`}</label>
            <input type="range" min={5} max={20} step={1} value={slidesCount} onChange={e => setSlidesCount(parseInt(e.target.value))} style={{ width: "100%", accentColor: GOLD }} />
          </div>
        </div>

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8, marginTop: 14 }}>{isAr ? "نمط التصميم" : "Theme"}</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
          {THEMES.map(t => {
            const active = theme === t.key;
            return (
              <button key={t.key} onClick={() => setTheme(t.key)}
                style={{ background: active ? "#fffbeb" : "#fff", border: active ? "1.5px solid #fde68a" : "1.5px solid #e8ecf4", color: active ? GOLD : NAVY, borderRadius: 10, padding: "10px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", gap: 3 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: `#${t.bg}`, border: "1px solid #cbd5e1" }} />
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: `#${t.accent}` }} />
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: `#${t.text}` }} />
                </span>
                <span>{isAr ? t.ar : t.en}</span>
              </button>
            );
          })}
        </div>

        <button onClick={generate} disabled={loading}
          style={{ width: "100%", marginTop: 16, background: "linear-gradient(135deg,#C9A84C,#b45309)", border: "none", borderRadius: 10, color: "#fff", padding: "12px", fontWeight: 800, fontSize: 14, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px #C9A84C33", opacity: loading ? 0.7 : 1 }}>
          {loading ? (isAr ? "⏳ جارٍ إنشاء الهيكل..." : "⏳ Generating outline...") : (isAr ? "✨ ولّد هيكل العرض" : "✨ Generate Outline")}
        </button>
        {error && <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{error}</div>}
      </div>

      {/* Preview & download */}
      {outline && (
        <div style={{ background: "#fff", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{outline.title}</div>
              {outline.subtitle && <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>{outline.subtitle}</div>}
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginTop: 4 }}>{outline.slides.length} {isAr ? "شريحة" : "slides"}</div>
            </div>
            <button onClick={download}
              style={{ background: "linear-gradient(135deg,#1e293b,#334155)", border: "none", borderRadius: 10, color: "#fff", padding: "10px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
              💾 {isAr ? "تحميل PowerPoint" : "Download PowerPoint"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {outline.slides.map((s, i) => (
              <div key={i} style={{ background: "#fafbff", border: "1px solid #eef1f8", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ background: GOLD, color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 900 }}>#{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{s.title}</span>
                </div>
                {s.bullets.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, fontSize: 13, lineHeight: 1.8, color: "#334155" }}>
                    {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
                {s.speakerNotes && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#64748b", background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 6, padding: "6px 10px", fontStyle: "italic" }}>
                    🎙️ {s.speakerNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
