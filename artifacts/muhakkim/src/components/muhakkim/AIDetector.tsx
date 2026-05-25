import React, { useState } from 'react';
import { useLanguage } from '../../lib/i18n';
import { ShieldCheck, BotMessageSquare, UserRound, Blend, AlertTriangle, CheckCircle2, XCircle, Loader2, ClipboardPaste, Trash2, Wand2, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// ── theme ─────────────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
  red: '#f87171', green: '#4ade80', orange: '#fb923c',
  bg: '#060d1a', card: 'rgba(13,23,45,0.88)', border: 'rgba(201,168,76,0.18)',
  muted: '#475569', text: '#e2e8f0', sub: '#64748b',
};

// ── types ─────────────────────────────────────────────────────────────────────
interface Signal { type: 'positive' | 'negative'; text: string; }
interface DetectResult {
  score: number;
  verdict: 'AI' | 'Human' | 'Mixed';
  confidence: 'High' | 'Medium' | 'Low';
  signals: Signal[];
  summary: string;
  highlights: string[];
}
interface HumanVariant {
  style: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  text: string;
}
interface HumanizeResult { variants: HumanVariant[]; }

// ── helpers ───────────────────────────────────────────────────────────────────
function getScoreColor(score: number): string {
  if (score >= 70) return C.red;
  if (score >= 40) return C.orange;
  return C.green;
}
function getVerdictIcon(verdict: string) {
  if (verdict === 'AI')    return <BotMessageSquare size={22} />;
  if (verdict === 'Human') return <UserRound size={22} />;
  return <Blend size={22} />;
}
function getVerdictLabel(verdict: string, ar: boolean): string {
  if (verdict === 'AI')    return ar ? 'نص مولَّد بالذكاء الاصطناعي' : 'AI-Generated Text';
  if (verdict === 'Human') return ar ? 'نص بشري' : 'Human-Written Text';
  return ar ? 'مختلط (بشري + AI)' : 'Mixed (Human + AI)';
}
function getConfidenceLabel(c: string, ar: boolean): string {
  if (c === 'High')   return ar ? 'ثقة عالية' : 'High confidence';
  if (c === 'Medium') return ar ? 'ثقة متوسطة' : 'Medium confidence';
  return ar ? 'ثقة منخفضة' : 'Low confidence';
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 52, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>AI Score</span>
      </div>
    </div>
  );
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────
function CopyBtn({ text, ar }: { text: string; ar: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(201,168,76,0.08)',
      border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : C.border}`,
      color: copied ? C.green : C.gold, borderRadius: 8, padding: '6px 12px',
      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all .2s',
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? (ar ? 'تم النسخ ✓' : 'Copied ✓') : (ar ? 'نسخ' : 'Copy')}
    </button>
  );
}

// ── VariantCard ───────────────────────────────────────────────────────────────
function VariantCard({ v, ar, isSelected, onSelect }: { v: HumanVariant; ar: boolean; isSelected: boolean; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const show = isSelected || expanded;
  const previewLen = 220;
  const long = v.text.length > previewLen;

  const STYLE_COLORS: Record<string, { bg: string; border: string; badge: string; text: string }> = {
    academic:   { bg: 'rgba(147,197,253,0.07)', border: 'rgba(147,197,253,0.25)', badge: 'rgba(147,197,253,0.15)', text: '#93c5fd' },
    natural:    { bg: 'rgba(201,168,76,0.07)',  border: 'rgba(201,168,76,0.25)',  badge: 'rgba(201,168,76,0.15)',  text: '#C9A84C' },
    simplified: { bg: 'rgba(94,234,212,0.07)',  border: 'rgba(94,234,212,0.25)',  badge: 'rgba(94,234,212,0.15)',  text: '#5eead4' },
  };
  const sc = STYLE_COLORS[v.style] ?? STYLE_COLORS.natural;

  return (
    <div style={{
      background: isSelected ? sc.bg : C.card, border: `1.5px solid ${isSelected ? sc.border : C.border}`,
      borderRadius: 16, padding: '18px 18px', transition: 'all .2s',
      boxShadow: isSelected ? `0 0 24px ${sc.text}18` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{v.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: sc.text }}>{ar ? v.titleAr : v.titleEn}</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>{ar ? v.descAr : v.descEn}</div>
        </div>
        <button onClick={onSelect} style={{
          background: isSelected ? sc.badge : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isSelected ? sc.border : 'rgba(255,255,255,0.1)'}`,
          color: isSelected ? sc.text : C.sub, borderRadius: 8, padding: '5px 12px',
          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {isSelected
            ? <><Check size={12} /> {ar ? 'محدد' : 'Selected'}</>
            : ar ? 'اختيار' : 'Select'}
        </button>
      </div>

      {/* Text preview */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.text,
        lineHeight: 1.8, direction: ar ? 'rtl' : 'ltr', textAlign: ar ? 'right' : 'left',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: show ? 'none' : '120px',
        overflow: show ? 'visible' : 'hidden',
        position: 'relative',
      }}>
        {show || !long ? v.text : v.text.slice(0, previewLen) + '…'}
      </div>

      {/* Expand / actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        {long && (
          <button onClick={() => setExpanded(e => !e)} style={{
            background: 'none', border: 'none', color: C.sub, fontSize: 12,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}>
            {expanded
              ? <><ChevronUp size={14} />{ar ? 'إخفاء' : 'Collapse'}</>
              : <><ChevronDown size={14} />{ar ? 'عرض الكامل' : 'Show full'}</>}
          </button>
        )}
        <div style={{ marginInlineStart: 'auto' }}>
          <CopyBtn text={v.text} ar={ar} />
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AIDetector({ initialText = '' }: { initialText?: string }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [text,        setText]        = useState(initialText);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<DetectResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // humanize state
  const [humanizing,  setHumanizing]  = useState(false);
  const [humanResult, setHumanResult] = useState<HumanizeResult | null>(null);
  const [humanError,  setHumanError]  = useState<string | null>(null);
  const [selectedVar, setSelectedVar] = useState<string | null>(null);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.trim().length;

  // ── detect ──
  const analyze = async () => {
    if (charCount < 50) return;
    setLoading(true); setError(null); setResult(null);
    setHumanResult(null); setHumanError(null); setSelectedVar(null);
    try {
      const res = await fetch('/api/ai/detect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`); }
      setResult(await res.json() as DetectResult);
    } catch (e) { setError(ar ? `حدث خطأ: ${e instanceof Error ? e.message : e}` : `Error: ${e instanceof Error ? e.message : e}`); }
    finally { setLoading(false); }
  };

  // ── humanize ──
  const humanize = async () => {
    setHumanizing(true); setHumanError(null); setHumanResult(null); setSelectedVar(null);
    try {
      const res = await fetch('/api/ai/humanize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`); }
      setHumanResult(await res.json() as HumanizeResult);
    } catch (e) { setHumanError(ar ? `حدث خطأ: ${e instanceof Error ? e.message : e}` : `Error: ${e instanceof Error ? e.message : e}`); }
    finally { setHumanizing(false); }
  };

  const scoreColor = result ? getScoreColor(result.score) : C.gold;
  const canHumanize = !!result && result.score >= 30 && charCount >= 50;

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto', fontFamily: ar ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>
      <style>{`
        @keyframes ai-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes ai-spin   { to{transform:rotate(360deg)} }
        .ai-signal:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: C.gold, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} color={C.gold} />
          {ar ? 'الكشف وإعادة الصياغة البشرية' : 'AI Detection & Human Rewriting'}
        </h2>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>
          {ar
            ? 'اكشف عن نسبة AI في النص ثم حوّله إلى نص بشري بثلاثة أساليب مختلفة'
            : 'Detect AI content, then rewrite it in three human styles'}
        </p>
      </div>

      {/* ── Tabs / steps indicator ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { n: '١', en: '1', label: ar ? 'الكشف عن AI' : 'Detect AI', done: !!result },
          { n: '٢', en: '2', label: ar ? 'التحويل البشري' : 'Human Rewrite', done: !!humanResult },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: s.done ? C.gold : 'rgba(201,168,76,0.12)',
              border: `2px solid ${s.done ? C.gold : 'rgba(201,168,76,0.3)'}`,
              color: s.done ? '#080d1a' : C.gold,
            }}>
              {s.done ? '✓' : (ar ? s.n : s.en)}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.done ? C.gold : C.sub }}>{s.label}</span>
            {i < 1 && <span style={{ color: C.border, fontSize: 16, marginInline: 2 }}>→</span>}
          </div>
        ))}
      </div>

      {/* ── Text input ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {ar ? 'أدخل النص للتحليل' : 'Enter text to analyze'}
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: charCount < 50 ? C.red : C.sub }}>
              {wordCount} {ar ? 'كلمة' : 'words'} · {charCount} {ar ? 'حرف' : 'chars'}
              {charCount < 50 && ` · ${ar ? `يحتاج ${50 - charCount} حرفاً` : `need ${50 - charCount} more`}`}
            </span>
            <button onClick={() => { setText(''); setResult(null); setError(null); setHumanResult(null); }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 6px', borderRadius: 6 }}>
              <Trash2 size={13} /> {ar ? 'مسح' : 'Clear'}
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); setHumanResult(null); }}
          placeholder={ar ? 'الصق النص هنا للتحقق من مصدره وإعادة صياغته…' : 'Paste text here to detect its origin and rewrite it…'}
          style={{
            width: '100%', minHeight: 180, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '14px 16px', fontSize: 14, color: C.text,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.7,
            direction: ar ? 'rtl' : 'ltr',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = C.border; }}
        />
      </div>

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Detect btn */}
        <button onClick={analyze} disabled={loading || charCount < 50} style={{
          background: loading || charCount < 50 ? 'rgba(201,168,76,0.15)' : `linear-gradient(135deg,${C.gold},#f5d78e)`,
          color: loading || charCount < 50 ? C.muted : '#080d1a',
          border: 'none', borderRadius: 12, padding: '12px 24px',
          fontWeight: 800, fontSize: 14, cursor: loading || charCount < 50 ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: loading || charCount < 50 ? 'none' : '0 4px 18px rgba(201,168,76,0.3)',
        }}>
          {loading
            ? <><Loader2 size={16} style={{ animation: 'ai-spin 0.8s linear infinite' }} />{ar ? 'جارٍ الكشف…' : 'Detecting…'}</>
            : <><ShieldCheck size={16} />{ar ? '١. كشف AI' : '1. Detect AI'}</>}
        </button>

        {/* Humanize btn */}
        <button onClick={humanize} disabled={humanizing || !canHumanize} style={{
          background: humanizing ? 'rgba(147,197,253,0.1)' : !canHumanize ? 'rgba(147,197,253,0.05)' : 'linear-gradient(135deg,#3b82f6,#93c5fd)',
          color: !canHumanize ? C.muted : humanizing ? C.blue : '#080d1a',
          border: `1px solid ${!canHumanize ? 'rgba(147,197,253,0.15)' : 'transparent'}`,
          borderRadius: 12, padding: '12px 24px',
          fontWeight: 800, fontSize: 14, cursor: humanizing || !canHumanize ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: !canHumanize ? 'none' : humanizing ? 'none' : '0 4px 18px rgba(59,130,246,0.3)',
        }}>
          {humanizing
            ? <><Loader2 size={16} style={{ animation: 'ai-spin 0.8s linear infinite' }} />{ar ? 'جارٍ التحويل…' : 'Converting…'}</>
            : <><Wand2 size={16} />{ar ? '٢. حوّل إلى بشري' : '2. Humanize Text'}</>}
        </button>

        {/* Paste */}
        <button onClick={async () => { try { const t = await navigator.clipboard.readText(); setText(t); setResult(null); setHumanResult(null); } catch { /* ignored */ } }}
          style={{ background: 'rgba(148,163,184,0.07)', border: `1px solid rgba(148,163,184,0.18)`, color: C.sub, borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <ClipboardPaste size={15} /> {ar ? 'لصق' : 'Paste'}
        </button>

        {/* Model badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginInlineStart: 'auto' }}>
          {['🤖 ChatGPT', '🧠 GPT-4', '⚡ Claude', '🔮 Gemini'].map(b => (
            <span key={b} style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 9px', color: C.sub }}>{b}</span>
          ))}
        </div>
      </div>

      {/* ── Errors ── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', color: '#fca5a5', fontSize: 14, marginBottom: 20, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />{error}
        </div>
      )}
      {humanError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', color: '#fca5a5', fontSize: 14, marginBottom: 20, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />{humanError}
        </div>
      )}

      {/* ── Detect loading ── */}
      {loading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '32px 24px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: C.gold, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: C.gold, borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>{ar ? 'يفحص النموذج النص…' : 'Model analyzing text…'}</span>
          </div>
          <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>{ar ? 'يبحث عن الأنماط اللغوية والهيكلية…' : 'Examining linguistic and structural patterns…'}</p>
        </div>
      )}

      {/* ── Humanize loading ── */}
      {humanizing && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 18, padding: '28px 24px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: C.blue, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, border: `3px solid rgba(147,197,253,0.2)`, borderTopColor: C.blue, borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>{ar ? 'يُعيد صياغة النص بثلاثة أساليب بشرية…' : 'Rewriting in three human styles…'}</span>
          </div>
          <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>{ar ? 'قد يستغرق ٥–١٠ ثوانٍ…' : 'This may take 5–10 seconds…'}</p>
        </div>
      )}

      {/* ══ DETECTION RESULTS ══ */}
      {result && !loading && (
        <div>
          {/* Score card */}
          <div style={{ background: C.card, border: `2px solid ${scoreColor}33`, borderRadius: 18, padding: '24px', marginBottom: 14, boxShadow: `0 0 40px ${scoreColor}15` }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <ScoreGauge score={result.score} color={scoreColor} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${scoreColor}22`, border: `1px solid ${scoreColor}44`, borderRadius: 12, padding: '8px 16px', marginBottom: 12 }}>
                  <span style={{ color: scoreColor }}>{getVerdictIcon(result.verdict)}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: scoreColor }}>{getVerdictLabel(result.verdict, ar)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: C.sub }}>{ar ? 'مستوى الثقة:' : 'Confidence:'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: result.confidence === 'High' ? 'rgba(74,222,128,0.12)' : 'rgba(251,146,60,0.12)', color: result.confidence === 'High' ? C.green : C.orange }}>
                    {getConfidenceLabel(result.confidence, ar)}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{result.summary}</p>
              </div>
            </div>
            {/* Bar */}
            <div style={{ marginTop: 20 }}>
              <div style={{ position: 'relative', height: 10, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right,#4ade80,#fb923c,#f87171)', opacity: 0.35 }} />
                <div style={{ position: 'absolute', top: -2, width: 14, height: 14, borderRadius: '50%', background: scoreColor, border: '2px solid white', boxShadow: `0 0 8px ${scoreColor}`, left: `calc(${result.score}% - 7px)`, transition: 'left 1s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.green }}>{ar ? '← بشري' : '← Human'}</span>
                <span style={{ fontSize: 10, color: C.orange }}>{ar ? 'مختلط' : 'Mixed'}</span>
                <span style={{ fontSize: 10, color: C.red }}>{ar ? 'ذكاء اصطناعي →' : 'AI →'}</span>
              </div>
            </div>
          </div>

          {/* Signals */}
          {result.signals?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.gold, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔍 {ar ? 'المؤشرات المرصودة' : 'Detected Signals'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {result.signals.map((sig, i) => (
                  <div key={i} className="ai-signal" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${sig.type === 'positive' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)'}` }}>
                    {sig.type === 'positive' ? <XCircle size={16} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} /> : <CheckCircle2 size={16} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{sig.text}</span>
                    <span style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, flexShrink: 0, color: sig.type === 'positive' ? C.red : C.green, background: sig.type === 'positive' ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                      {sig.type === 'positive' ? (ar ? 'مؤشر AI' : 'AI signal') : (ar ? 'بشري' : 'Human')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Humanize CTA — shown when score >= 30 */}
          {canHumanize && !humanResult && (
            <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(147,197,253,0.06))', border: '1.5px solid rgba(147,197,253,0.25)', borderRadius: 16, padding: '20px 22px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 36 }}>🪄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.blue, marginBottom: 4 }}>
                  {ar ? 'حوّل هذا النص إلى نص بشري!' : 'Turn this text into human writing!'}
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>
                  {ar
                    ? `النص يحتوي على ${result.score}% محتوى AI — اضغط لإعادة الصياغة بـ٣ أساليب مختلفة`
                    : `Text is ${result.score}% AI — click to rewrite in 3 different human styles`}
                </div>
              </div>
              <button onClick={humanize} style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', border: 'none', borderRadius: 12, color: '#fff', padding: '12px 22px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(59,130,246,0.3)', whiteSpace: 'nowrap' }}>
                <Wand2 size={16} /> {ar ? 'حوّل الآن' : 'Humanize Now'}
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ padding: '11px 15px', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 11, display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <AlertTriangle size={14} color={C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 11, color: C.sub, margin: 0, lineHeight: 1.6 }}>
              {ar ? 'تنبيه: هذا التحليل استرشادي وليس قاطعاً. قد تظهر نتائج إيجابية كاذبة أو سلبية كاذبة.' : 'Disclaimer: This analysis is indicative, not definitive. False positives and negatives may occur.'}
            </p>
          </div>

          {/* Try again */}
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { setResult(null); setText(''); setHumanResult(null); }}
              style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid ${C.border}`, color: C.gold, borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> {ar ? 'تحليل نص جديد' : 'Analyze new text'}
            </button>
          </div>
        </div>
      )}

      {/* ══ HUMANIZE RESULTS ══ */}
      {humanResult && !humanizing && (
        <div style={{ marginTop: 24 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: C.blue, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wand2 size={20} color={C.blue} />
              {ar ? 'اختر الأسلوب البشري المناسب' : 'Choose Your Human Style'}
            </h3>
            <button onClick={humanize} style={{ background: 'rgba(147,197,253,0.08)', border: '1px solid rgba(147,197,253,0.2)', color: C.blue, borderRadius: 9, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> {ar ? 'إعادة التوليد' : 'Regenerate'}
            </button>
          </div>

          <p style={{ color: C.sub, fontSize: 13, marginBottom: 18 }}>
            {ar
              ? 'اقرأ الأساليب الثلاثة واختر المناسب ثم انسخه — كل نسخة مصممة لتبدو كتابة إنسانية حقيقية'
              : 'Read all three styles, choose the best fit, and copy it — each version is crafted to read as genuine human writing'}
          </p>

          {/* Variant cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {humanResult.variants.map(v => (
              <VariantCard
                key={v.style}
                v={v}
                ar={ar}
                isSelected={selectedVar === v.style}
                onSelect={() => setSelectedVar(selectedVar === v.style ? null : v.style)}
              />
            ))}
          </div>

          {/* Copy selected banner */}
          {selectedVar && (() => {
            const sel = humanResult.variants.find(v => v.style === selectedVar);
            if (!sel) return null;
            return (
              <div style={{ marginTop: 16, background: 'rgba(74,222,128,0.07)', border: '1.5px solid rgba(74,222,128,0.25)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: C.green, fontSize: 14, marginBottom: 2 }}>
                    {ar ? `اخترت: ${sel.titleAr}` : `Selected: ${sel.titleEn}`}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub }}>{ar ? 'انسخ النص واستخدمه في بحثك' : 'Copy the text and use it in your research'}</div>
                </div>
                <CopyBtn text={sel.text} ar={ar} />
              </div>
            );
          })()}

          {/* Tips */}
          <div style={{ marginTop: 14, background: 'rgba(201,168,76,0.05)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8 }}>💡 {ar ? 'نصائح للاستخدام الأفضل' : 'Tips for best results'}</div>
            <ul style={{ margin: 0, paddingInlineStart: 18, color: C.sub, fontSize: 12, lineHeight: 1.9 }}>
              {ar ? [
                'راجع النص المحوَّل وأضف لمساتك الشخصية والمصطلحات المتخصصة',
                'قسّم النصوص الطويلة وحوّل كل قسم على حدة للنتائج الأفضل',
                'يمكنك تحويل النتيجة مرة أخرى للحصول على خيارات جديدة',
              ].map((t, i) => <li key={i}>{t}</li>)
              : [
                'Review and add your personal touches and specialist terms after rewriting',
                'Split long texts and convert each section separately for better results',
                'You can humanize the output again for additional fresh variations',
              ].map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ── How it works (empty state) ── */}
      {!result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginTop: 8 }}>
          {[
            { icon: '🛡️', title: ar ? 'درجة AI' : 'AI Score',             desc: ar ? '٠٪ بشري تماماً — ١٠٠٪ آلي تماماً' : '0% fully human — 100% fully AI' },
            { icon: '🔍', title: ar ? 'مؤشرات مفصّلة' : 'Detailed Signals', desc: ar ? 'أدلة لغوية وأسلوبية لدعم الحكم' : 'Linguistic evidence supporting the verdict' },
            { icon: '🪄', title: ar ? 'تحويل بشري' : 'Human Rewrite',      desc: ar ? '٣ أساليب: أكاديمي · طبيعي · مبسط' : '3 styles: Academic · Natural · Simplified' },
            { icon: '📋', title: ar ? 'نسخ بنقرة' : 'One-Click Copy',      desc: ar ? 'انسخ الأسلوب المناسب مباشرةً' : 'Copy your preferred style instantly' },
          ].map(item => (
            <div key={item.title} style={{ background: 'rgba(201,168,76,0.04)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
