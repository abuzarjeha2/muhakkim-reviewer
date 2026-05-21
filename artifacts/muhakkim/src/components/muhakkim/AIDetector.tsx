import React, { useState } from 'react';
import { useLanguage } from '../../lib/i18n';
import { ShieldCheck, BotMessageSquare, UserRound, Blend, AlertTriangle, CheckCircle2, XCircle, Loader2, ClipboardPaste, Trash2 } from 'lucide-react';

// ── theme ────────────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
  red: '#f87171', green: '#4ade80', orange: '#fb923c',
  bg: '#060d1a', card: 'rgba(13,23,45,0.88)', border: 'rgba(201,168,76,0.18)',
  muted: '#475569', text: '#e2e8f0', sub: '#64748b',
};

// ── types ────────────────────────────────────────────────────────────────────
interface Signal { type: 'positive' | 'negative'; text: string; }
interface DetectResult {
  score: number;
  verdict: 'AI' | 'Human' | 'Mixed';
  confidence: 'High' | 'Medium' | 'Low';
  signals: Signal[];
  summary: string;
  highlights: string[];
}

// ── helpers ──────────────────────────────────────────────────────────────────
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

// ── Animated gauge ────────────────────────────────────────────────────────────
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>AI Score</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  initialText?: string;
}

export default function AIDetector({ initialText = '' }: Props) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [text,    setText]    = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<DetectResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.trim().length;

  const analyze = async () => {
    if (charCount < 50) return;
    setLoading(true); setError(null); setResult(null);

    try {
      const res = await fetch('/api/ai/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as DetectResult;
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(ar ? `حدث خطأ: ${msg}` : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = result ? getScoreColor(result.score) : C.gold;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <style>{`
        @keyframes ai-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes ai-spin   { to{transform:rotate(360deg)} }
        .ai-signal:hover { background: rgba(255,255,255,0.05) !important; }
        .ai-highlight-tag { animation: ai-pulse 2.5s ease-in-out infinite; }
      `}</style>

      {/* header */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: C.gold, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} color={C.gold} />
          {ar ? 'الكشف عن النص المُولَّد بالذكاء الاصطناعي' : 'AI-Generated Text Detector'}
        </h2>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>
          {ar
            ? 'يحلّل النص للكشف عن مؤشرات ChatGPT وGPT-4 وClaude وغيرها من النماذج اللغوية الكبيرة'
            : 'Analyzes text for indicators of ChatGPT, GPT-4, Claude and other large language models'}
        </p>
      </div>

      {/* text input */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {ar ? 'أدخل النص للتحليل' : 'Enter text to analyze'}
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: charCount < 50 ? C.red : C.sub }}>
              {wordCount} {ar ? 'كلمة' : 'words'} · {charCount} {ar ? 'حرف' : 'chars'}
              {charCount < 50 && ` · ${ar ? `يحتاج ${50 - charCount} حرفاً أخرى` : `need ${50 - charCount} more chars`}`}
            </span>
            <button onClick={() => { setText(''); setResult(null); setError(null); }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 6px', borderRadius: 6 }}>
              <Trash2 size={13} /> {ar ? 'مسح' : 'Clear'}
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); }}
          placeholder={ar
            ? 'الصق النص هنا أو اكتبه مباشرة للتحقق من مصدره...'
            : 'Paste or type text here to check its origin...'}
          style={{
            width: '100%', minHeight: 200, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '14px 16px', fontSize: 14, color: C.text,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.7,
            transition: 'border-color .2s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = C.border; }}
        />
      </div>

      {/* action bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={analyze}
          disabled={loading || charCount < 50}
          style={{
            background: loading || charCount < 50
              ? 'rgba(201,168,76,0.15)'
              : `linear-gradient(135deg, ${C.gold}, #f5d78e)`,
            color: loading || charCount < 50 ? C.muted : '#080d1a',
            border: 'none', borderRadius: 12, padding: '12px 28px',
            fontWeight: 800, fontSize: 14, cursor: loading || charCount < 50 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: loading || charCount < 50 ? 'none' : '0 4px 18px rgba(201,168,76,0.3)',
            transition: 'all .2s',
          }}>
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: 'ai-spin 0.8s linear infinite' }} />
              {ar ? 'جارٍ التحليل…' : 'Analyzing…'}
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              {ar ? 'تحليل النص' : 'Analyze Text'}
            </>
          )}
        </button>

        <button
          onClick={async () => {
            try {
              const t = await navigator.clipboard.readText();
              setText(t); setResult(null);
            } catch { /* ignored */ }
          }}
          style={{
            background: 'rgba(147,197,253,0.08)', border: `1px solid rgba(147,197,253,0.2)`,
            color: C.blue, borderRadius: 12, padding: '12px 20px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
          }}>
          <ClipboardPaste size={15} /> {ar ? 'لصق من الحافظة' : 'Paste from clipboard'}
        </button>

        {/* capability badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginInlineStart: 'auto' }}>
          {[
            { icon: '🤖', label: 'ChatGPT' },
            { icon: '🧠', label: 'GPT-4' },
            { icon: '⚡', label: 'Claude' },
            { icon: '🔮', label: 'Gemini' },
          ].map(b => (
            <span key={b.label} style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 9px', color: C.sub }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', color: '#fca5a5', fontSize: 14, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* loading skeleton */}
      {loading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: C.gold, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: C.gold, borderRadius: '50%', animation: 'ai-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>{ar ? 'يحلّل النموذج النص…' : 'Model analyzing text…'}</span>
          </div>
          <p style={{ color: C.sub, fontSize: 13 }}>
            {ar ? 'يفحص الأنماط اللغوية والهيكلية والأسلوبية…' : 'Examining linguistic, structural and stylistic patterns…'}
          </p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {result && !loading && (
        <div>
          {/* main result card */}
          <div style={{
            background: C.card, border: `2px solid ${scoreColor}33`,
            borderRadius: 18, padding: '24px 24px', marginBottom: 16,
            boxShadow: `0 0 40px ${scoreColor}15`,
          }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <ScoreGauge score={result.score} color={scoreColor} />

              <div style={{ flex: 1, minWidth: 200 }}>
                {/* verdict badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${scoreColor}22`, border: `1px solid ${scoreColor}44`, borderRadius: 12, padding: '8px 16px', marginBottom: 12 }}>
                  <span style={{ color: scoreColor }}>{getVerdictIcon(result.verdict)}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: scoreColor }}>
                    {getVerdictLabel(result.verdict, ar)}
                  </span>
                </div>

                {/* confidence */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: C.sub }}>{ar ? 'مستوى الثقة:' : 'Confidence:'}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
                    background: result.confidence === 'High' ? 'rgba(74,222,128,0.12)' : result.confidence === 'Medium' ? 'rgba(251,146,60,0.12)' : 'rgba(148,163,184,0.12)',
                    color: result.confidence === 'High' ? C.green : result.confidence === 'Medium' ? C.orange : C.muted,
                  }}>
                    {getConfidenceLabel(result.confidence, ar)}
                  </span>
                </div>

                {/* summary */}
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>
                  {result.summary}
                </p>
              </div>
            </div>

            {/* score bar legend */}
            <div style={{ marginTop: 20 }}>
              <div style={{ position: 'relative', height: 10, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to right, #4ade80 0%, #fb923c 50%, #f87171 100%)',
                  opacity: 0.35,
                }} />
                <div style={{
                  position: 'absolute', top: -1, width: 14, height: 14, borderRadius: '50%',
                  background: scoreColor, border: '2px solid white',
                  boxShadow: `0 0 8px ${scoreColor}`,
                  left: `calc(${result.score}% - 7px)`,
                  transition: 'left 1s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.green }}>{ar ? '← بشري' : '← Human'}</span>
                <span style={{ fontSize: 10, color: C.orange }}>{ar ? 'مختلط' : 'Mixed'}</span>
                <span style={{ fontSize: 10, color: C.red }}>{ar ? 'ذكاء اصطناعي →' : 'AI →'}</span>
              </div>
            </div>
          </div>

          {/* signals */}
          {result.signals?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.gold, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔍 {ar ? 'المؤشرات والأدلة المرصودة' : 'Detected Signals & Evidence'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.signals.map((sig, i) => (
                  <div key={i} className="ai-signal" style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                    borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${sig.type === 'positive' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)'}`,
                    transition: 'background .15s',
                  }}>
                    {sig.type === 'positive'
                      ? <XCircle size={16} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
                      : <CheckCircle2 size={16} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
                    }
                    <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{sig.text}</span>
                    <span style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      color: sig.type === 'positive' ? C.red : C.green,
                      background: sig.type === 'positive' ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                      padding: '2px 8px', borderRadius: 6,
                    }}>
                      {sig.type === 'positive'
                        ? (ar ? 'مؤشر AI' : 'AI signal')
                        : (ar ? 'مؤشر بشري' : 'Human signal')}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: C.sub, marginTop: 12 }}>
                {ar
                  ? '🔴 مؤشر AI = دليل يدعم الكتابة الآلية · 🟢 مؤشر بشري = دليل يدعم الكتابة البشرية'
                  : '🔴 AI signal = evidence supporting AI authorship · 🟢 Human signal = evidence supporting human authorship'}
              </p>
            </div>
          )}

          {/* highlighted phrases */}
          {result.highlights?.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.gold, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✏️ {ar ? 'عبارات تشير إلى الكتابة الآلية' : 'Phrases suggesting AI authorship'}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.highlights.slice(0, 8).map((phrase, i) => (
                  <span key={i} className="ai-highlight-tag" style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#fca5a5', borderRadius: 8, padding: '5px 12px', fontSize: 12,
                    fontStyle: 'italic', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* disclaimer */}
          <div style={{ padding: '12px 16px', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={15} color={C.muted} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: C.sub, margin: 0, lineHeight: 1.6 }}>
              {ar
                ? 'تنبيه: هذا التحليل استرشادي وليس قاطعاً. الكشف عن نصوص AI ليس علماً دقيقاً بنسبة 100%، وقد تظهر نتائج إيجابية كاذبة أو سلبية كاذبة. استخدم هذه النتائج كأداة مساعدة للحكم لا كحكم نهائي.'
                : 'Disclaimer: This analysis is indicative, not definitive. AI text detection is not 100% accurate — false positives and negatives may occur. Use these results as a supporting tool, not a final judgment.'}
            </p>
          </div>

          {/* try again */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              onClick={() => { setResult(null); setText(''); }}
              style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid ${C.border}`, color: C.gold, borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {ar ? '🔄 تحليل نص جديد' : '🔄 Analyze new text'}
            </button>
          </div>
        </div>
      )}

      {/* how it works (when no result) */}
      {!result && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 10 }}>
          {[
            { icon: '📊', title: ar ? 'درجة النص' : 'AI Score', desc: ar ? 'نسبة مئوية من 0 (بشري) إلى 100 (آلي)' : '0% = fully human to 100% = fully AI' },
            { icon: '🔍', title: ar ? 'مؤشرات مفصّلة' : 'Detailed Signals', desc: ar ? 'أدلة لغوية وأسلوبية تدعم الحكم' : 'Linguistic & stylistic evidence supporting the verdict' },
            { icon: '✏️', title: ar ? 'عبارات مميّزة' : 'Flagged Phrases', desc: ar ? 'أجزاء النص التي تبدو مولَّدة آلياً' : 'Specific text sections that appear machine-generated' },
            { icon: '📝', title: ar ? 'ملخص التحليل' : 'Analysis Summary', desc: ar ? 'تفسير واضح لنتائج الكشف' : 'Clear explanation of detection results' },
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
