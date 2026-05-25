import { useState, useRef } from "react";
import { useLanguage } from "../../lib/i18n";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const GOLD = "#b45309";
const NAVY = "#1e293b";

type OutFmt = "docx" | "txt" | "md" | "pdf";

export default function FileConverter() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [extracted, setExtracted] = useState("");
  const [status, setStatus] = useState<"idle"|"reading"|"ok"|"error">("idle");
  const [target, setTarget] = useState<OutFmt>("docx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setStatus("reading"); setExtracted(""); setError("");
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const max = Math.min(pdf.numPages, 200);
        const parts: string[] = [];
        for (let i = 1; i <= max; i++) {
          const page = await pdf.getPage(i);
          const c = await page.getTextContent();
          const text = c.items.map(it => ("str" in it ? it.str : "")).join(" ").trim();
          if (text) parts.push(text);
        }
        setExtracted(parts.join("\n\n"));
      } else if (lower.endsWith(".docx")) {
        const buf = await f.arrayBuffer();
        const r = await mammoth.extractRawText({ arrayBuffer: buf });
        setExtracted(r.value);
      } else if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf")) {
        setExtracted(await f.text());
      } else {
        setStatus("error");
        setError(isAr ? "صيغة غير مدعومة. المدعوم: PDF, DOCX, TXT, MD, RTF" : "Unsupported format. Supported: PDF, DOCX, TXT, MD, RTF");
        return;
      }
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const baseName = () => {
    const name = (fileName || "document").replace(/\.[^.]+$/, "");
    return name.replace(/[^\w\u0600-\u06FF\s-]+/g, "").replace(/\s+/g, "_").slice(0, 60) || "document";
  };

  const downloadDocx = async (text: string) => {
    const paragraphs = text.split(/\n\n+/).map(block =>
      new Paragraph({
        bidirectional: isAr,
        alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 200, line: 360 },
        children: [new TextRun({
          text: block.replace(/\n/g, " "),
          font: isAr ? "Tajawal" : "Calibri",
          size: 24,
          rightToLeft: isAr,
        })],
      })
    );
    const doc = new Document({
      creator: "Muhakkim",
      title: baseName(),
      styles: { default: { document: { run: { font: isAr ? "Tajawal" : "Calibri", size: 24 } } } },
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            bidirectional: isAr,
            alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text: baseName().replace(/_/g, " "), bold: true, font: isAr ? "Tajawal" : "Calibri", rightToLeft: isAr })],
          }),
          ...paragraphs,
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${baseName()}.docx`);
  };

  const downloadTxt = (text: string, ext: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${baseName()}.${ext}`);
  };

  const downloadPdf = (text: string) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    // Note: Arabic text in jsPDF without custom font may not shape correctly; this is a "good enough" basic export.
    const lines: string[] = [];
    for (const block of text.split(/\n+/)) {
      const wrapped = doc.splitTextToSize(block, maxWidth);
      lines.push(...wrapped, "");
    }
    let y = margin;
    const lineHeight = 16;
    for (const ln of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage(); y = margin;
      }
      doc.text(ln, isAr ? pageWidth - margin : margin, y, { align: isAr ? "right" : "left" });
      y += lineHeight;
    }
    doc.save(`${baseName()}.pdf`);
  };

  const doConvert = async () => {
    if (!extracted) return;
    setBusy(true); setError("");
    try {
      if (target === "docx") await downloadDocx(extracted);
      else if (target === "txt") downloadTxt(extracted, "txt");
      else if (target === "md") downloadTxt(extracted, "md");
      else if (target === "pdf") downloadPdf(extracted);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const fmtOptions: { key: OutFmt; ar: string; en: string; icon: string; desc: string }[] = [
    { key: "docx", ar: "Word (.docx)", en: "Word (.docx)", icon: "📘", desc: "Microsoft Word" },
    { key: "pdf",  ar: "PDF (.pdf)",   en: "PDF (.pdf)",   icon: "📕", desc: "PDF" },
    { key: "txt",  ar: "نص (.txt)",     en: "Text (.txt)",  icon: "📄", desc: "Plain text" },
    { key: "md",   ar: "Markdown (.md)", en: "Markdown (.md)", icon: "📝", desc: "Markdown" },
  ];

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ padding: "20px 16px 48px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔄</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>{isAr ? "محوّل الملفات" : "File Converter"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#92400e" }}>
            {isAr ? "PDF · Word · TXT · MD → Word · PDF · TXT · MD (محلياً وبدون رفع للخوادم)"
                  : "PDF · Word · TXT · MD → Word · PDF · TXT · MD (local, no upload)"}
          </p>
        </div>
      </div>

      {/* Upload */}
      <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
          📂 {isAr ? "ارفع الملف" : "Upload file"}
        </div>
        <div onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #c7d4f0", borderRadius: 12, padding: "22px 12px", textAlign: "center", cursor: "pointer", background: status === "ok" ? "#f0fdf4" : "#f8faff", transition: "all .15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GOLD; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c7d4f0"; }}>
          {status === "reading" && <div style={{ color: "#1d4ed8", fontSize: 13 }}>⏳ {isAr ? "جارٍ القراءة…" : "Reading…"}</div>}
          {status === "ok" && (
            <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#065f46" }}>{fileName}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                {extracted.length.toLocaleString()} {isAr ? "حرف مُستخرَج" : "characters extracted"}
              </div>
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>{isAr ? "اضغط لتغيير الملف" : "Click to change"}</div>
            </>
          )}
          {status === "error" && <div style={{ color: "#dc2626", fontSize: 13 }}>❌ {error}</div>}
          {status === "idle" && (
            <>
              <div style={{ fontSize: 30, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{isAr ? "اضغط لرفع الملف" : "Click to upload"}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>PDF · DOCX · TXT · MD · RTF</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.rtf" onChange={onFile} style={{ display: "none" }} />
      </div>

      {/* Target format + convert */}
      {status === "ok" && extracted && (
        <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
            🎯 {isAr ? "اختر صيغة المخرجات" : "Choose output format"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
            {fmtOptions.map(f => {
              const active = target === f.key;
              return (
                <button key={f.key} onClick={() => setTarget(f.key)}
                  style={{ background: active ? "#fffbeb" : "#fff", border: active ? "1.5px solid #fde68a" : "1.5px solid #e8ecf4", color: active ? GOLD : NAVY, borderRadius: 10, padding: "12px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{f.icon}</span>
                  <span>{isAr ? f.ar : f.en}</span>
                </button>
              );
            })}
          </div>
          <button onClick={doConvert} disabled={busy}
            style={{ width: "100%", marginTop: 16, background: "linear-gradient(135deg,#C9A84C,#b45309)", border: "none", borderRadius: 10, color: "#fff", padding: "12px", fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px #C9A84C33", opacity: busy ? 0.7 : 1 }}>
            {busy ? (isAr ? "⏳ جارٍ التحويل..." : "⏳ Converting...") : (isAr ? "⬇️ حوّل وحمّل" : "⬇️ Convert & Download")}
          </button>
          {error && <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>{error}</div>}
          {target === "pdf" && isAr && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6 }}>
              ⚠️ تنبيه: تصدير PDF للنصوص العربية قد لا يحافظ على تشكيل الحروف المتصلة (jsPDF بدون خط عربي مضمّن). يُفضّل تصدير Word ثم حفظه كـ PDF من Microsoft Word.
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {extracted && (
        <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 10 }}>
            👁️ {isAr ? "معاينة النص المُستخرَج" : "Extracted text preview"}
          </div>
          <div style={{ background: "#fafbff", border: "1px solid #eef1f8", borderRadius: 10, padding: "12px 14px", maxHeight: 320, overflowY: "auto", fontSize: 13, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap", direction: isAr ? "rtl" : "ltr", textAlign: isAr ? "right" : "left" }}>
            {extracted.slice(0, 5000)}
            {extracted.length > 5000 && <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 11, textAlign: "center" }}>... {isAr ? "المعاينة مقطوعة. الملف الكامل سيُحوَّل." : "Preview truncated. Full file will be converted."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
