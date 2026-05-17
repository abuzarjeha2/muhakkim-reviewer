import React, { useState, useRef } from 'react';
import { useLanguage } from "../../lib/i18n";
import { UploadCloud, FileText, Trash2, FileCheck2, FolderOpen } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
).href;

interface FileUploadProps {
  onExtracted: (text: string) => void;
  onFileInfo?: (info: { name: string; size: string }) => void;
  extractedText: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const getExt = (name: string) =>
  name.toLowerCase().slice(name.lastIndexOf('.')).trim();

/** Always accept if extension matches — MIME types on Android are unreliable */
const isSupported = (file: File) => {
  const ext = getExt(file.name);
  const goodExts = ['.pdf','.doc','.docx','.odt','.txt','.html','.htm','.rtf','.md'];
  if (goodExts.includes(ext)) return true;
  // Fallback: MIME type check (desktop / iOS)
  const goodMime = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain','text/html','text/htm','text/markdown','application/rtf','text/rtf',
  ];
  return goodMime.includes(file.type);
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

function stripHtml(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s{2,}/g,' ').trim();
}

function stripRtf(rtf: string) {
  return rtf
    .replace(/\\[a-z]+\d*\s?/gi,' ')
    .replace(/[{}\\]/g,'')
    .replace(/\s{2,}/g,' ').trim();
}

// ── component ─────────────────────────────────────────────────────────────────
export default function FileUpload({ onExtracted, onFileInfo, extractedText }: FileUploadProps) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [isDragging, setIsDragging]   = useState(false);
  const [isLoading,  setIsLoading]    = useState(false);
  const [progress,   setProgress]     = useState('');
  const [error,      setError]        = useState<string|null>(null);
  const [fileInfo,   setFileInfo]     = useState<{name:string;size:string;detail:string}|null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── process ──────────────────────────────────────────────────────────────
  const processFile = async (file: File) => {
    setError(null);

    if (!isSupported(file)) {
      setError(ar
        ? 'صيغة الملف غير مدعومة. الصيغ المقبولة: PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD'
        : 'Unsupported file format. Accepted: PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD');
      return;
    }

    setIsLoading(true);
    setProgress(ar ? 'جارٍ قراءة الملف…' : 'Reading file…');

    let text = '';
    let detail = '';
    const ext = getExt(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // ── PDF ──
      if (ext === '.pdf' || file.type === 'application/pdf') {
        setProgress(ar ? 'جارٍ استخراج نص PDF…' : 'Extracting PDF text…');
        const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let j = 1; j <= pdf.numPages; j++) {
          setProgress(ar ? `صفحة ${j} من ${pdf.numPages}` : `Page ${j} of ${pdf.numPages}`);
          const page    = await pdf.getPage(j);
          const content = await page.getTextContent();
          pages.push(content.items.map((s: any) => s.str).join(' '));
        }
        text   = pages.join('\n');
        detail = ar ? `${pdf.numPages} صفحة` : `${pdf.numPages} pages`;

      // ── DOCX / DOC / ODT ──
      } else if (['.docx','.doc','.odt'].includes(ext)
        || ['application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.oasis.opendocument.text'].includes(file.type)) {
        setProgress(ar ? 'جارٍ استخراج نص Word…' : 'Extracting Word text…');
        const result = await mammoth.extractRawText({ arrayBuffer });
        text   = result.value;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = ar ? `${words} كلمة` : `${words} words`;

      // ── HTML ──
      } else if (['.html','.htm'].includes(ext) || file.type.startsWith('text/html')) {
        text   = stripHtml(new TextDecoder('utf-8').decode(arrayBuffer));
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = ar ? `${words} كلمة` : `${words} words`;

      // ── RTF ──
      } else if (ext === '.rtf' || ['application/rtf','text/rtf'].includes(file.type)) {
        text   = stripRtf(new TextDecoder('utf-8').decode(arrayBuffer));
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        detail = ar ? `${words} كلمة` : `${words} words`;

      // ── TXT / MD / others ──
      } else {
        text = new TextDecoder('utf-8').decode(arrayBuffer);
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const lines = text.split('\n').length;
        detail = ar ? `${words} كلمة · ${lines} سطر` : `${words} words · ${lines} lines`;
      }

      if (!text.trim()) {
        setError(ar
          ? 'لم يُستخرج أي نص. قد يكون الملف فارغاً أو مشفراً أو يحتوي صوراً فقط.'
          : 'No text extracted. The file may be empty, encrypted, or image-only.');
        return;
      }

      const info = { name: file.name, size: formatSize(file.size) };
      setFileInfo({ ...info, detail });
      onExtracted(text);
      onFileInfo?.(info);

    } catch (err: any) {
      console.error('[FileUpload]', err);
      setError(ar
        ? `خطأ في معالجة الملف: ${err?.message ?? 'خطأ غير متوقع'}`
        : `Error processing file: ${err?.message ?? 'Unexpected error'}`);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleClear = () => {
    onExtracted(''); setFileInfo(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const S: Record<string,React.CSSProperties> = {
    zone: {
      border: `2px dashed ${isDragging ? '#C9A84C' : 'rgba(201,168,76,0.25)'}`,
      borderRadius: 18,
      padding: '48px 24px',
      textAlign: 'center',
      cursor: 'pointer',
      background: isDragging
        ? 'rgba(201,168,76,0.07)'
        : 'rgba(201,168,76,0.02)',
      transition: 'all .25s',
      position: 'relative',
      overflow: 'hidden',
    },
    uploadIcon: { color: '#C9A84C', marginBottom: 16 },
    heading: { fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 },
    sub: { color: '#64748b', fontSize: 13, marginBottom: 20 },
    formatRow: { display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8, marginBottom: 24 },
    fmt: {
      background: 'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.3)',
      color:'#C9A84C', borderRadius:8, padding:'4px 12px', fontSize:12, fontWeight:700,
    },
    btnRow: { display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' },
    btn: {
      display:'inline-flex', alignItems:'center', gap:8,
      background: 'linear-gradient(135deg,#C9A84C,#f5d78e)',
      color:'#080d1a', border:'none', borderRadius:12,
      padding:'12px 28px', fontSize:14, fontWeight:800,
      cursor:'pointer', fontFamily:'inherit', transition:'all .2s',
      boxShadow:'0 4px 20px rgba(201,168,76,0.3)',
    },
    error: {
      background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.35)',
      color:'#fca5a5', borderRadius:12, padding:'12px 16px',
      fontSize:14, marginTop:16,
    },
    loader: {
      display:'flex', alignItems:'center', justifyContent:'center',
      gap:12, padding:'32px 0', color:'#C9A84C', fontSize:14,
    },
    card: {
      background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.2)',
      borderRadius:14, padding:'16px 20px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:12, flexWrap:'wrap', marginTop:16,
    },
    clearBtn: {
      background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
      color:'#fca5a5', borderRadius:10, padding:'8px 16px', fontSize:13,
      fontWeight:700, cursor:'pointer', fontFamily:'inherit',
      display:'flex', alignItems:'center', gap:6, transition:'all .2s',
    },
    preview: {
      marginTop:16, border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:14, overflow:'hidden',
    },
    previewHead: {
      background:'rgba(255,255,255,0.04)', padding:'10px 16px',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#94a3b8',
    },
    previewBody: {
      padding:16, maxHeight:340, overflowY:'auto',
      whiteSpace:'pre-wrap', fontSize:13, color:'#cbd5e1', lineHeight:1.7,
    },
  };

  return (
    <div style={{ padding:'24px 28px' }}>

      {/* ── Drop Zone ── */}
      <div
        style={S.zone}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        data-testid="upload-zone"
      >
        {/* hidden input — very permissive accept for Android */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display:'none' }}
          accept=".pdf,.doc,.docx,.odt,.txt,.html,.htm,.rtf,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/html,application/rtf,text/rtf,text/markdown,*/*"
          onChange={handleChange}
          data-testid="input-file"
        />

        <UploadCloud size={52} style={S.uploadIcon} />

        <p style={S.heading}>
          {ar ? 'اسحب وأفلت الملف هنا' : 'Drag & drop your file here'}
        </p>
        <p style={S.sub}>
          {ar ? 'يدعم ملفات Word وPDF والنصوص' : 'Supports Word, PDF, and text files'}
        </p>

        {/* format badges */}
        <div style={S.formatRow}>
          {['PDF','DOCX','DOC','TXT','HTML','RTF','ODT','MD'].map(f => (
            <span key={f} style={S.fmt}>{f}</span>
          ))}
        </div>

        {/* buttons */}
        <div style={S.btnRow}>
          <button
            style={S.btn}
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            data-testid="btn-choose-file"
          >
            <FolderOpen size={18} />
            {ar ? 'اختر ملفاً' : 'Choose File'}
          </button>
        </div>

        {/* subtle hint for mobile */}
        <p style={{ color:'#334155', fontSize:11, marginTop:16 }}>
          {ar ? 'أو اضغط على الزر لاختيار الملف من هاتفك'
               : 'Or tap the button to pick from your device'}
        </p>
      </div>

      {/* ── Error ── */}
      {error && <div style={S.error}>{error}</div>}

      {/* ── Loader ── */}
      {isLoading && (
        <div style={S.loader}>
          <div style={{
            width:24, height:24, border:'3px solid rgba(201,168,76,0.2)',
            borderTopColor:'#C9A84C', borderRadius:'50%',
            animation:'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span>{progress || (ar ? 'جارٍ المعالجة…' : 'Processing…')}</span>
        </div>
      )}

      {/* ── File card ── */}
      {fileInfo && !isLoading && (
        <div style={S.card}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <FileCheck2 size={28} color="#C9A84C" />
            <div>
              <p style={{ fontWeight:700, color:'#e2e8f0', fontSize:14 }}>{fileInfo.name}</p>
              <p style={{ color:'#64748b', fontSize:12, marginTop:2 }}>
                {fileInfo.size} · {fileInfo.detail}
              </p>
            </div>
          </div>
          <button style={S.clearBtn} onClick={handleClear} data-testid="btn-clear-upload">
            <Trash2 size={14} />
            {ar ? 'مسح' : 'Clear'}
          </button>
        </div>
      )}

      {/* ── Extracted text preview ── */}
      {extractedText && !isLoading && (
        <div style={S.preview}>
          <div style={S.previewHead}>
            <FileText size={15} />
            <span>{ar ? 'معاينة النص المستخرج' : 'Extracted Text Preview'}</span>
            <span style={{ marginInlineStart:'auto', fontSize:12 }}>
              {extractedText.trim().split(/\s+/).filter(Boolean).length}
              {ar ? ' كلمة' : ' words'}
            </span>
          </div>
          <div style={S.previewBody}>{extractedText}</div>
        </div>
      )}
    </div>
  );
}
