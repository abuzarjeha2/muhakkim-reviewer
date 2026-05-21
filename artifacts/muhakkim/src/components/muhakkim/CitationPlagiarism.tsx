import React, { useState } from 'react';
import { useLanguage } from '../../lib/i18n';
import {
  BookOpen, Search, Copy, Check, AlertTriangle, CheckCircle2,
  XCircle, Loader2, ChevronDown, Trash2, ClipboardPaste, ShieldAlert,
} from 'lucide-react';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
  red: '#f87171', green: '#4ade80', orange: '#fb923c', yellow: '#fbbf24',
  card: 'rgba(13,23,45,0.88)', border: 'rgba(201,168,76,0.18)',
  muted: '#475569', text: '#e2e8f0', sub: '#64748b',
};

// ── Citation styles ───────────────────────────────────────────────────────────
const CITATION_STYLES = [
  { value: 'APA7',      label: 'APA 7th',     desc: 'Psychology, Education, Social Sciences' },
  { value: 'MLA9',      label: 'MLA 9th',     desc: 'Humanities, Literature' },
  { value: 'Chicago17', label: 'Chicago 17th', desc: 'History, Arts' },
  { value: 'IEEE',      label: 'IEEE',         desc: 'Engineering, Computer Science' },
  { value: 'Harvard',   label: 'Harvard',      desc: 'General Academic' },
  { value: 'Vancouver', label: 'Vancouver',    desc: 'Medicine, Biology' },
];

const INPUT_TYPES = [
  { value: 'doi',    labelAr: 'رقم DOI',       labelEn: 'DOI Number',       placeholderAr: '10.1016/j.example.2024.01.001', placeholderEn: '10.1016/j.example.2024.01.001' },
  { value: 'url',    labelAr: 'رابط URL',      labelEn: 'URL Link',          placeholderAr: 'https://example.com/article', placeholderEn: 'https://example.com/article' },
  { value: 'manual', labelAr: 'إدخال يدوي',   labelEn: 'Manual Entry',      placeholderAr: 'اسم المؤلف، عنوان البحث، المجلة، السنة، المجلد، الصفحات...', placeholderEn: 'Author name, title, journal, year, volume, pages...' },
];

// ── Plagiarism issue types ────────────────────────────────────────────────────
const ISSUE_TYPE_META: Record<string, { labelAr: string; labelEn: string; color: string; icon: string }> = {
  plagiarism:       { labelAr: 'انتحال صريح',       labelEn: 'Direct Plagiarism',    color: '#f87171', icon: '🚨' },
  missing_citation: { labelAr: 'مرجع مفقود',        labelEn: 'Missing Citation',     color: '#fb923c', icon: '⚠️' },
  paraphrase:       { labelAr: 'صياغة دون إسناد',  labelEn: 'Paraphrase w/o Credit', color: '#fbbf24', icon: '📝' },
  self_citation:    { labelAr: 'استشهاد ذاتي مفرط', labelEn: 'Excessive Self-Cite',  color: '#c4b5fd', icon: '🔄' },
  quality:          { labelAr: 'جودة الاقتباس',     labelEn: 'Citation Quality',     color: '#93c5fd', icon: '🔍' },
};

const SEVERITY_META: Record<string, { labelAr: string; labelEn: string; bg: string; color: string }> = {
  high:   { labelAr: 'خطورة عالية',   labelEn: 'High',   bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  medium: { labelAr: 'خطورة متوسطة', labelEn: 'Medium', bg: 'rgba(251,146,60,0.12)',   color: '#fb923c' },
  low:    { labelAr: 'خطورة منخفضة', labelEn: 'Low',    bg: 'rgba(148,163,184,0.12)',  color: '#94a3b8' },
};

const RISK_META: Record<string, { color: string; bgColor: string; labelAr: string; labelEn: string }> = {
  Low:      { color: '#4ade80', bgColor: 'rgba(74,222,128,0.12)',  labelAr: 'خطر منخفض',    labelEn: 'Low Risk' },
  Medium:   { color: '#fb923c', bgColor: 'rgba(251,146,60,0.12)', labelAr: 'خطر متوسط',    labelEn: 'Medium Risk' },
  High:     { color: '#f87171', bgColor: 'rgba(239,68,68,0.12)',  labelAr: 'خطر مرتفع',    labelEn: 'High Risk' },
  Critical: { color: '#a855f7', bgColor: 'rgba(168,85,247,0.12)', labelAr: 'خطر حرج',      labelEn: 'Critical Risk' },
};

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text, ar }: { text: string; ar: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(201,168,76,0.1)',
      border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(201,168,76,0.25)'}`,
      color: copied ? C.green : C.gold, borderRadius: 8, padding: '6px 14px',
      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .2s',
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? (ar ? 'تم النسخ!' : 'Copied!') : (ar ? 'نسخ' : 'Copy')}
    </button>
  );
}

// ── Risk gauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score, level }: { score: number; level: string }) {
  const meta = RISK_META[level] ?? RISK_META.Low;
  const r = 48;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={meta.color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: meta.color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: 9, color: C.sub, marginTop: 2 }}>Risk</span>
      </div>
    </div>
  );
}

// ── Citation Tab ──────────────────────────────────────────────────────────────
interface CitationResult {
  formatted: string;
  fields: Record<string, string>;
  notes: string;
  inText: string;
}

function CitationTab({ ar, initialText }: { ar: boolean; initialText: string }) {
  const [inputType, setInputType] = useState<'doi' | 'url' | 'manual'>('doi');
  const [style,     setStyle]     = useState('APA7');
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<CitationResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState(false);

  const currentType = INPUT_TYPES.find(t => t.value === inputType)!;

  const generate = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/citation/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, style, type: inputType, lang: ar ? 'ar' : 'en' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setResult(await res.json() as CitationResult);
    } catch (e: unknown) {
      setError(ar ? `خطأ: ${e instanceof Error ? e.message : String(e)}` : `Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(false); }
  };

  return (
    <div>
      {/* style selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>
          {ar ? 'أسلوب الاقتباس' : 'Citation Style'}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CITATION_STYLES.map(s => (
            <button key={s.value} onClick={() => setStyle(s.value)}
              style={{
                background: style === s.value ? 'linear-gradient(135deg,rgba(201,168,76,0.25),rgba(245,215,142,0.12))' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${style === s.value ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: style === s.value ? C.gold : C.muted, borderRadius: 10, padding: '7px 14px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
              }}>
              {s.label}
              {style === s.value && <span style={{ fontSize: 9, display: 'block', color: 'rgba(201,168,76,0.6)', fontWeight: 400 }}>{s.desc}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* input type tabs */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>
          {ar ? 'طريقة الإدخال' : 'Input Method'}
        </label>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(4,9,24,0.8)', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
          {INPUT_TYPES.map(t => (
            <button key={t.value} onClick={() => { setInputType(t.value as 'doi' | 'url' | 'manual'); setInput(''); setResult(null); }}
              style={{
                flex: 1, background: inputType === t.value ? 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.08))' : 'transparent',
                border: `1px solid ${inputType === t.value ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
                color: inputType === t.value ? '#f5d78e' : C.muted,
                borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
              }}>
              {ar ? t.labelAr : t.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* input field */}
      {inputType === 'manual' ? (
        <textarea value={input} onChange={e => { setInput(e.target.value); setResult(null); }}
          placeholder={ar ? currentType.placeholderAr : currentType.placeholderEn}
          style={{ width: '100%', minHeight: 110, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '12px 14px', fontSize: 13, color: C.text,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.7, marginBottom: 12,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = C.border; }} />
      ) : (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={input} onChange={e => { setInput(e.target.value); setResult(null); }}
            placeholder={ar ? currentType.placeholderAr : currentType.placeholderEn}
            onKeyDown={e => e.key === 'Enter' && generate()}
            style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: '12px 14px', fontSize: 13, color: C.text,
              fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = C.border; }} />
        </div>
      )}

      {/* quick examples */}
      <div style={{ marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.sub }}>{ar ? 'أمثلة:' : 'Examples:'}</span>
        {inputType === 'doi' && [
          '10.1038/nature12373', '10.1016/j.cell.2014.05.010',
        ].map(ex => (
          <button key={ex} onClick={() => { setInput(ex); setResult(null); }}
            style={{ background: 'rgba(147,197,253,0.06)', border: '1px solid rgba(147,197,253,0.15)',
              color: C.blue, borderRadius: 6, padding: '2px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
            {ex}
          </button>
        ))}
        {inputType === 'url' && [
          'https://www.nature.com/articles/d41586-024-00001-0',
        ].map(ex => (
          <button key={ex} onClick={() => { setInput(ex); setResult(null); }}
            style={{ background: 'rgba(147,197,253,0.06)', border: '1px solid rgba(147,197,253,0.15)',
              color: C.blue, borderRadius: 6, padding: '2px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
            {ex.slice(0, 40)}…
          </button>
        ))}
      </div>

      {/* generate button */}
      <button onClick={generate} disabled={loading || !input.trim()}
        style={{
          background: loading || !input.trim() ? 'rgba(201,168,76,0.12)' : `linear-gradient(135deg,${C.gold},#f5d78e)`,
          color: loading || !input.trim() ? C.muted : '#080d1a',
          border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 800, fontSize: 14,
          cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: loading || !input.trim() ? 'none' : '0 4px 18px rgba(201,168,76,0.3)',
        }}>
        {loading
          ? <><Loader2 size={15} style={{ animation: 'cp-spin 0.8s linear infinite' }} />{ar ? 'جارٍ التوليد…' : 'Generating…'}</>
          : <><BookOpen size={15} />{ar ? 'توليد الاقتباس' : 'Generate Citation'}</>}
      </button>

      {/* error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
          padding: '12px 16px', color: '#fca5a5', fontSize: 13, marginTop: 14, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />{error}
        </div>
      )}

      {/* result */}
      {result && !loading && (
        <div style={{ marginTop: 18 }}>
          {/* formatted citation */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>
                  📚 {ar ? 'الاقتباس المنسّق' : 'Formatted Citation'} ({style})
                </span>
              </div>
              <CopyButton text={result.formatted} ar={ar} />
            </div>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 14, color: C.text, lineHeight: 1.85, margin: 0, fontStyle: 'italic',
                background: 'rgba(201,168,76,0.04)', borderRadius: 8, padding: '12px 14px',
                border: 'none', borderRight: `3px solid rgba(201,168,76,0.4)' `, fontFamily: 'Georgia,serif' }}>
                {result.formatted}
              </p>
            </div>

            {/* in-text citation */}
            {result.inText && (
              <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.sub, flexShrink: 0 }}>
                  {ar ? 'الاقتباس داخل النص:' : 'In-text citation:'}
                </span>
                <code style={{ fontSize: 13, color: C.blue, background: 'rgba(147,197,253,0.08)',
                  padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(147,197,253,0.15)' }}>
                  {result.inText}
                </code>
                <CopyButton text={result.inText} ar={ar} />
              </div>
            )}

            {/* metadata fields */}
            {Object.keys(result.fields ?? {}).some(k => result.fields[k]) && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <button onClick={() => setExpanded(!expanded)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '10px 18px',
                    color: C.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <span>{ar ? 'بيانات المرجع المستخرجة' : 'Extracted metadata'}</span>
                  <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {expanded && (
                  <div style={{ padding: '0 18px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                    {Object.entries(result.fields).filter(([,v]) => v).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12 }}>
                        <span style={{ color: C.sub, textTransform: 'capitalize' }}>{k}: </span>
                        <span style={{ color: C.text }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* notes */}
          {result.notes && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color={C.yellow} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#fde68a', margin: 0 }}>{result.notes}</p>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={() => { setResult(null); setInput(''); }}
              style={{ background: 'rgba(201,168,76,0.07)', border: `1px solid ${C.border}`, color: C.gold,
                borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ar ? '+ مرجع جديد' : '+ New citation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plagiarism Tab ────────────────────────────────────────────────────────────
interface PlagiarismIssue { type: string; severity: string; excerpt: string; explanation: string; suggestion: string; }
interface PlagiarismResult {
  riskScore: number;
  riskLevel: string;
  summary: string;
  issues: PlagiarismIssue[];
  strengths: string[];
  recommendations: string[];
}

function PlagiarismTab({ ar, initialText }: { ar: boolean; initialText: string }) {
  const [text,    setText]    = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<PlagiarismResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const charCount = text.trim().length;

  const check = async () => {
    if (charCount < 100) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/citation/plagiarism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: ar ? 'ar' : 'en' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setResult(await res.json() as PlagiarismResult);
    } catch (e: unknown) {
      setError(ar ? `خطأ: ${e instanceof Error ? e.message : String(e)}` : `Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setLoading(false); }
  };

  const meta = result ? (RISK_META[result.riskLevel] ?? RISK_META.Low) : null;

  return (
    <div>
      {/* text area */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {ar ? 'النص الأكاديمي للفحص' : 'Academic text to check'}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: charCount < 100 ? C.red : C.sub }}>
              {charCount} {ar ? 'حرف' : 'chars'}
              {charCount < 100 && ` (${ar ? `يحتاج ${100 - charCount} أخرى` : `need ${100 - charCount} more`})`}
            </span>
            <button onClick={() => { setText(''); setResult(null); }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 5 }}>
              <Trash2 size={12} />{ar ? 'مسح' : 'Clear'}
            </button>
          </div>
        </div>
        <textarea value={text} onChange={e => { setText(e.target.value); setResult(null); }}
          placeholder={ar
            ? 'أدخل النص الأكاديمي هنا للتحقق من سلامة اقتباساته ومراجعه وكشف أي انتحال محتمل…'
            : 'Enter academic text here to check citation integrity and detect any potential plagiarism…'}
          style={{ width: '100%', minHeight: 200, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '14px 16px', fontSize: 13, color: C.text,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.75,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = C.border; }} />
      </div>

      {/* action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={check} disabled={loading || charCount < 100}
          style={{
            background: loading || charCount < 100 ? 'rgba(201,168,76,0.12)' : `linear-gradient(135deg,${C.gold},#f5d78e)`,
            color: loading || charCount < 100 ? C.muted : '#080d1a', border: 'none', borderRadius: 12,
            padding: '12px 28px', fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
            cursor: loading || charCount < 100 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: loading || charCount < 100 ? 'none' : '0 4px 18px rgba(201,168,76,0.3)',
          }}>
          {loading
            ? <><Loader2 size={15} style={{ animation: 'cp-spin 0.8s linear infinite' }} />{ar ? 'جارٍ الفحص…' : 'Checking…'}</>
            : <><ShieldAlert size={15} />{ar ? 'فحص الانتحال' : 'Check Plagiarism'}</>}
        </button>
        <button onClick={async () => { try { setText(await navigator.clipboard.readText()); setResult(null); } catch {} }}
          style={{ background: 'rgba(147,197,253,0.08)', border: `1px solid rgba(147,197,253,0.2)`,
            color: C.blue, borderRadius: 12, padding: '12px 18px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ClipboardPaste size={14} />{ar ? 'لصق' : 'Paste'}
        </button>

        {/* detection categories legend */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginInlineStart: 'auto' }}>
          {Object.entries(ISSUE_TYPE_META).slice(0, 3).map(([, m]) => (
            <span key={m.labelEn} style={{ fontSize: 10, background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2px 8px', color: C.sub }}>
              {m.icon} {ar ? m.labelAr : m.labelEn}
            </span>
          ))}
        </div>
      </div>

      {/* error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
          padding: '12px 16px', color: '#fca5a5', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />{error}
        </div>
      )}

      {/* loading */}
      {loading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.gold, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: C.gold,
              borderRadius: '50%', animation: 'cp-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? 'يفحص سلامة الاقتباسات…' : 'Checking citation integrity…'}</span>
          </div>
          <p style={{ color: C.sub, fontSize: 12 }}>
            {ar ? 'يحلّل الانتحال والمراجع المفقودة والإسناد…' : 'Analyzing for plagiarism, missing references, and attribution…'}
          </p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {result && !loading && meta && (
        <div>
          {/* overview card */}
          <div style={{ background: C.card, border: `2px solid ${meta.color}33`, borderRadius: 18,
            padding: '22px 22px', marginBottom: 14, boxShadow: `0 0 40px ${meta.color}12` }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <RiskGauge score={result.riskScore} level={result.riskLevel} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: meta.bgColor, border: `1px solid ${meta.color}44`,
                  borderRadius: 12, padding: '7px 14px', marginBottom: 10 }}>
                  <ShieldAlert size={18} color={meta.color} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: meta.color }}>
                    {ar ? meta.labelAr : meta.labelEn}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
              </div>
            </div>

            {/* stats row */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { num: result.issues?.length ?? 0, labelAr: 'مشكلة مرصودة', labelEn: 'Issues found', color: C.red },
                { num: result.issues?.filter(i => i.severity === 'high').length ?? 0, labelAr: 'خطورة عالية', labelEn: 'High severity', color: C.orange },
                { num: result.strengths?.length ?? 0, labelAr: 'نقطة إيجابية', labelEn: 'Strengths', color: C.green },
                { num: result.recommendations?.length ?? 0, labelAr: 'توصية', labelEn: 'Recommendations', color: C.blue },
              ].map(s => (
                <div key={s.labelEn} style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10, padding: '10px 14px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.num}</div>
                  <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{ar ? s.labelAr : s.labelEn}</div>
                </div>
              ))}
            </div>
          </div>

          {/* issues list */}
          {result.issues?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.gold, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔍 {ar ? 'المشكلات المرصودة' : 'Detected Issues'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.issues.map((issue, i) => {
                  const tm = ISSUE_TYPE_META[issue.type] ?? ISSUE_TYPE_META.missing_citation;
                  const sm = SEVERITY_META[issue.severity] ?? SEVERITY_META.low;
                  return (
                    <div key={i} style={{ border: `1px solid ${tm.color}22`, borderRadius: 12,
                      background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                      {/* header */}
                      <div style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
                        flexWrap: 'wrap', borderBottom: `1px solid rgba(255,255,255,0.05)`,
                        background: `${tm.color}08` }}>
                        <span style={{ fontSize: 16 }}>{tm.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tm.color }}>
                          {ar ? tm.labelAr : tm.labelEn}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          background: sm.bg, color: sm.color, marginInlineStart: 'auto' }}>
                          {ar ? sm.labelAr : sm.labelEn}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        {/* excerpt */}
                        {issue.excerpt && (
                          <blockquote style={{ margin: '0 0 10px', padding: '8px 12px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                            borderInlineStart: `3px solid ${tm.color}44`,
                            fontSize: 12, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.6 }}>
                            "{issue.excerpt}"
                          </blockquote>
                        )}
                        <p style={{ fontSize: 13, color: C.text, margin: '0 0 8px', lineHeight: 1.65 }}>
                          {issue.explanation}
                        </p>
                        {issue.suggestion && (
                          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start',
                            background: 'rgba(74,222,128,0.06)', borderRadius: 8, padding: '8px 12px',
                            border: '1px solid rgba(74,222,128,0.15)' }}>
                            <CheckCircle2 size={14} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: 12, color: '#86efac' }}>{issue.suggestion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* strengths */}
          {result.strengths?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.green, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckCircle2 size={16} color={C.green} />
                {ar ? 'نقاط القوة في التوثيق' : 'Citation Strengths'}
              </h3>
              {result.strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ color: C.green, fontSize: 12, flexShrink: 0, marginTop: 2 }}>✓</span>
                  <span style={{ fontSize: 13, color: C.text }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* recommendations */}
          {result.recommendations?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid rgba(147,197,253,0.2)`, borderRadius: 14, padding: '14px 18px', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.blue, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                📋 {ar ? 'التوصيات' : 'Recommendations'}
              </h3>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ color: C.blue, fontSize: 12, flexShrink: 0, fontWeight: 700, marginTop: 1 }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, color: C.text }}>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* disclaimer */}
          <div style={{ padding: '10px 14px', background: 'rgba(148,163,184,0.05)',
            border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={13} color={C.muted} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: C.sub, margin: 0, lineHeight: 1.6 }}>
              {ar
                ? 'تنبيه: هذا الفحص يعتمد على التحليل الذكي وليس مقارنة بقاعدة بيانات فعلية. استخدمه جنباً إلى جنب مع أدوات الكشف المتخصصة مثل Turnitin أو iThenticate.'
                : 'Note: This check relies on AI analysis, not comparison against an actual database. Use it alongside specialized tools like Turnitin or iThenticate.'}
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => { setResult(null); setText(''); }}
              style={{ background: 'rgba(201,168,76,0.07)', border: `1px solid ${C.border}`, color: C.gold,
                borderRadius: 8, padding: '9px 22px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ar ? '🔄 فحص نص جديد' : '🔄 Check new text'}
            </button>
          </div>
        </div>
      )}

      {/* empty state */}
      {!result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 6 }}>
          {Object.entries(ISSUE_TYPE_META).map(([, m]) => (
            <div key={m.labelEn} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 5 }}>{m.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 3 }}>{ar ? m.labelAr : m.labelEn}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props { initialText?: string; }

export default function CitationPlagiarism({ initialText = '' }: Props) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [subTab, setSubTab] = useState<'citation' | 'plagiarism'>('citation');

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: C.gold, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={22} color={C.gold} />
          {ar ? 'الاقتباس العلمي وكشف الانتحال' : 'Scientific Citation & Plagiarism Detection'}
        </h2>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>
          {ar
            ? 'أنشئ مراجع أكاديمية بأشهر الأساليب العالمية، وافحص النص للكشف عن الانتحال وغياب الإسناد'
            : 'Generate academic references in major international styles, and check text for plagiarism and missing attribution'}
        </p>
      </div>

      {/* sub-tab selector */}
      <div style={{ display: 'flex', background: 'rgba(4,9,24,0.8)', borderRadius: 12, padding: 5,
        border: '1px solid rgba(255,255,255,0.05)', marginBottom: 22, gap: 4 }}>
        {([
          { key: 'citation',   iconAr: '📚 منسّق الاقتباسات',    iconEn: '📚 Citation Formatter' },
          { key: 'plagiarism', iconAr: '🔍 كاشف الانتحال',        iconEn: '🔍 Plagiarism Checker' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{
              flex: 1, background: subTab === t.key
                ? 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.08))'
                : 'transparent',
              border: `1px solid ${subTab === t.key ? 'rgba(201,168,76,0.4)' : 'transparent'}`,
              color: subTab === t.key ? '#f5d78e' : C.muted, borderRadius: 9, padding: '11px 16px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
            }}>
            {ar ? t.iconAr : t.iconEn}
          </button>
        ))}
      </div>

      {subTab === 'citation'   && <CitationTab   ar={ar} initialText={initialText} />}
      {subTab === 'plagiarism' && <PlagiarismTab  ar={ar} initialText={initialText} />}
    </div>
  );
}
