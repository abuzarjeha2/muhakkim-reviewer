import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import DataAnalyzer from './DataAnalyzer';
import StatParser from './StatParser';
import EquationChecker from './EquationChecker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
  red: '#f87171', green: '#4ade80', orange: '#fb923c', yellow: '#fbbf24',
  card: 'rgba(13,23,45,0.88)', border: 'rgba(201,168,76,0.18)',
  muted: '#475569', text: '#e2e8f0', sub: '#64748b',
};
const P = ['#C9A84C','#93c5fd','#4ade80','#f87171','#c4b5fd','#fb923c','#5eead4','#fbbf24','#a855f7','#f472b6'];

// ── Math helpers ──────────────────────────────────────────────────────────────
function avg(a: number[]) { return a.reduce((s, v) => s + v, 0) / a.length; }
function sdv(a: number[]) { const m = avg(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); }
function r2(n: number) { return Math.round(n * 100) / 100; }
function parseNums(txt: string) {
  return txt.split(/[\n,;\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
}
function sma(data: number[], k: number): (number | null)[] {
  return data.map((_, i) => i < k - 1 ? null : r2(avg(data.slice(i - k + 1, i + 1))));
}
function ols(xs: number[], ys: number[]) {
  const xb = avg(xs), yb = avg(ys);
  const b = xs.reduce((s, x, i) => s + (x - xb) * (ys[i] - yb), 0) / xs.reduce((s, x) => s + (x - xb) ** 2, 0);
  const a = yb - b * xb;
  return { a: r2(a), b: r2(b) };
}

// ── Tooltip style ─────────────────────────────────────────────────────────────
const TT = { contentStyle: { background: '#0d1729', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 } };

// ── Card wrapper ──────────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, margin: '0 0 10px' }}>{title}</p>
      {children}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Pill({ label, value, color = C.gold }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 76 }}>
      <div style={{ fontSize: 17, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ── Styled textarea ───────────────────────────────────────────────────────────
function TA({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.text, fontFamily: 'inherit', resize: 'vertical', outline: 'none', transition: 'border-color .2s' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = C.border; }} />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ①  FREQUENCY TABLE
// ════════════════════════════════════════════════════════════════════════════
function FrequencyTable({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<'num' | 'cat'>('num');
  const [k, setK] = useState(6);

  const nums = useMemo(() => parseNums(raw), [raw]);

  const catRows = useMemo(() => {
    if (mode !== 'cat') return [];
    const map = new Map<string, number>();
    raw.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean).forEach(v => map.set(v, (map.get(v) ?? 0) + 1));
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const tot = arr.reduce((s, [, c]) => s + c, 0);
    let cum = 0;
    return arr.map(([label, count]) => { cum += count; return { label, count, rel: r2(count / tot * 100), cum, cumRel: r2(cum / tot * 100) }; });
  }, [raw, mode]);

  const numRows = useMemo(() => {
    if (mode !== 'num' || nums.length < 2) return [];
    const mn = Math.min(...nums), mx = Math.max(...nums);
    const w = (mx - mn) / k;
    const cls = Array.from({ length: k }, (_, i) => {
      const lo = r2(mn + i * w), hi = r2(mn + (i + 1) * w);
      return { label: `${lo}–${hi}`, mid: r2((lo + hi) / 2), count: 0, lo, hi };
    });
    nums.forEach(v => { let idx = Math.min(Math.floor((v - mn) / w), k - 1); cls[idx].count++; });
    const tot = nums.length; let cum = 0;
    return cls.map(c => { cum += c.count; return { ...c, rel: r2(c.count / tot * 100), cum, cumRel: r2(cum / tot * 100) }; });
  }, [nums, mode, k]);

  const rows = mode === 'num' ? numRows : catRows;
  const hasData = mode === 'num' ? nums.length >= 2 : catRows.length > 0;
  const barData = rows.slice(0, 15).map((r: { label: string; count: number; rel: number }) => ({ name: r.label, f: r.count, 'f%': r.rel }));
  const pieData = rows.slice(0, 10).map((r: { label: string; count: number }) => ({ name: r.label, value: r.count }));

  const numCols = mode === 'num'
    ? [ar ? 'الفئة' : 'Class', ar ? 'النقطة الوسطى' : 'Midpoint', ar ? 'تكرار (f)' : 'Freq (f)', ar ? 'نسبي % (fr)' : 'Rel % (fr)', ar ? 'تكرار تراكمي (F)' : 'Cum F', ar ? 'نسبي تراكمي % (Fr)' : 'Cum %']
    : [ar ? 'الفئة' : 'Category', ar ? 'تكرار (f)' : 'Freq (f)', ar ? 'نسبي %' : 'Rel %', ar ? 'تراكمي' : 'Cum', ar ? 'تراكمي %' : 'Cum %'];

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{ar ? 'نوع البيانات' : 'Data type'}</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['num', ar ? 'رقمية' : 'Numerical'], ['cat', ar ? 'فئوية' : 'Categorical']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', border: `1px solid ${mode === v ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`, background: mode === v ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)', color: mode === v ? C.gold : C.muted }}>{l}</button>
            ))}
          </div>
        </div>
        {mode === 'num' && (
          <div>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{ar ? 'عدد الفئات' : 'Classes'}</p>
            <input type="number" min={3} max={20} value={k} onChange={e => setK(Math.max(3, Math.min(20, +e.target.value)))}
              style={{ width: 68, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
            {mode === 'num' ? (ar ? 'الأرقام — مفصولة بفواصل أو أسطر' : 'Numbers — comma or newline separated') : (ar ? 'القيم الفئوية' : 'Categorical values')}
          </p>
          <TA value={raw} onChange={setRaw} rows={3}
            placeholder={mode === 'num' ? '23, 18, 45, 31, 57, 22, 40, 15, 38...' : ar ? 'موافق, معارض, محايد, موافق, موافق بشدة...' : 'Agree, Disagree, Neutral, Agree, Strongly Agree...'} />
        </div>
      </div>

      {!hasData && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل بيانات لبناء الجدول التكراري' : 'Enter data to build the frequency table'}</p>}

      {hasData && (
        <>
          {/* Summary pills */}
          {mode === 'num' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { l: 'n', v: nums.length },
                { l: ar ? 'متوسط' : 'Mean', v: r2(avg(nums)) },
                { l: ar ? 'انحراف' : 'SD', v: r2(sdv(nums)) },
                { l: ar ? 'أدنى' : 'Min', v: r2(Math.min(...nums)) },
                { l: ar ? 'أعلى' : 'Max', v: r2(Math.max(...nums)) },
                { l: ar ? 'مدى' : 'Range', v: r2(Math.max(...nums) - Math.min(...nums)) },
                { l: 'CV%', v: r2(sdv(nums) / avg(nums) * 100) },
              ].map(s => <Pill key={s.l} label={s.l} value={s.v} />)}
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {numCols.map(h => <th key={h} style={{ padding: '9px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, i: number) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.text, fontWeight: 600 }}>{row.label}</td>
                    {mode === 'num' && <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{row.mid}</td>}
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ background: 'rgba(201,168,76,0.12)', borderRadius: 5, padding: '2px 10px', color: C.gold, fontWeight: 700 }}>{row.count}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.blue }}>{row.rel}%</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.text }}>{row.cum}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.teal }}>{row.cumRel}%</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(201,168,76,0.06)', fontWeight: 800, borderTop: `1px solid ${C.border}` }}>
                  <td colSpan={mode === 'num' ? 2 : 1} style={{ padding: '8px 10px', textAlign: 'center', color: C.gold }}>{ar ? 'المجموع' : 'Total'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: C.gold }}>{rows.reduce((s: number, r: any) => s + r.count, 0)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: C.gold }}>100%</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            <ChartCard title={`📊 ${ar ? 'المدرّج التكراري' : 'Frequency Histogram'}`}>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={barData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 8 }} interval={0} angle={-25} textAnchor="end" height={40} />
                  <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                  <Tooltip {...TT} />
                  <Bar dataKey="f" name={ar ? 'التكرار' : 'Freq'} radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => <Cell key={i} fill={P[i % P.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={`🥧 ${ar ? 'الرسم الدائري' : 'Pie Chart'}`}>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72}
                    label={({ name, percent }) => `${String(name).length > 7 ? String(name).slice(0, 6) + '…' : name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                    {pieData.map((_, i) => <Cell key={i} fill={P[i % P.length]} />)}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ②  LIKERT SCALE ANALYZER
// ════════════════════════════════════════════════════════════════════════════
interface LikertItem { name: string; raw: string; }

const LIKERT5_AR = ['معارض بشدة', 'معارض', 'محايد', 'موافق', 'موافق بشدة'];
const LIKERT5_EN = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
const LIKERT7_AR = ['معارض بشدة', 'معارض', 'معارض نسبياً', 'محايد', 'موافق نسبياً', 'موافق', 'موافق بشدة'];
const LIKERT7_EN = ['Strongly Disagree', 'Disagree', 'Somewhat Disagree', 'Neutral', 'Somewhat Agree', 'Agree', 'Strongly Agree'];

function likertInterp5(m: number, ar: boolean) {
  if (m <= 1.80) return { label: ar ? 'معارض بشدة' : 'Strongly Disagree', color: C.red };
  if (m <= 2.60) return { label: ar ? 'معارض' : 'Disagree', color: C.orange };
  if (m <= 3.40) return { label: ar ? 'محايد' : 'Neutral', color: '#fbbf24' };
  if (m <= 4.20) return { label: ar ? 'موافق' : 'Agree', color: C.teal };
  return { label: ar ? 'موافق بشدة' : 'Strongly Agree', color: C.green };
}
function likertInterp7(m: number, ar: boolean) {
  if (m <= 1.857) return { label: ar ? 'معارض بشدة' : 'Strongly Disagree', color: C.red };
  if (m <= 2.714) return { label: ar ? 'معارض' : 'Disagree', color: C.orange };
  if (m <= 3.571) return { label: ar ? 'معارض نسبياً' : 'Somewhat Disagree', color: '#f97316' };
  if (m <= 4.429) return { label: ar ? 'محايد' : 'Neutral', color: '#fbbf24' };
  if (m <= 5.286) return { label: ar ? 'موافق نسبياً' : 'Somewhat Agree', color: C.blue };
  if (m <= 6.143) return { label: ar ? 'موافق' : 'Agree', color: C.teal };
  return { label: ar ? 'موافق بشدة' : 'Strongly Agree', color: C.green };
}

const LIKERT_COLORS_5 = [C.red, C.orange, '#fbbf24', C.teal, C.green];
const LIKERT_COLORS_7 = [C.red, C.orange, '#f97316', '#fbbf24', C.blue, C.teal, C.green];

function LikertAnalyzer({ ar }: { ar: boolean }) {
  const [scale, setScale] = useState(5);
  const [items, setItems] = useState<LikertItem[]>([{ name: '', raw: '' }]);

  const labels = scale === 5 ? (ar ? LIKERT5_AR : LIKERT5_EN) : (ar ? LIKERT7_AR : LIKERT7_EN);
  const colors = scale === 5 ? LIKERT_COLORS_5 : LIKERT_COLORS_7;
  const interp = scale === 5 ? likertInterp5 : likertInterp7;

  const results = useMemo(() =>
    items.map((item, idx) => {
      const vals = parseNums(item.raw).filter(v => v >= 1 && v <= scale);
      if (vals.length === 0) return null;
      const m = r2(avg(vals));
      const s = r2(sdv(vals));
      const dist = Array.from({ length: scale }, (_, i) => {
        const cnt = vals.filter(v => v === i + 1).length;
        return { label: labels[i], value: i + 1, count: cnt, pct: r2(cnt / vals.length * 100) };
      });
      const mode = dist.reduce((a, b) => b.count > a.count ? b : a).value;
      const ip = interp(m, ar);
      const agreeIdx = scale === 5 ? 3 : 4;
      const agreePct = r2(dist.slice(agreeIdx).reduce((s, d) => s + d.count, 0) / vals.length * 100);
      return { name: item.name || (ar ? `بند ${idx + 1}` : `Item ${idx + 1}`), vals, mean: m, sd: s, mode, dist, ip, agreePct, n: vals.length };
    }).filter(Boolean) as NonNullable<ReturnType<typeof interp> & {
      name: string; vals: number[]; mean: number; sd: number; mode: number;
      dist: { label: string; value: number; count: number; pct: number }[]; ip: { label: string; color: string }; agreePct: number; n: number;
    }>[],
    [items, scale, ar]
  );

  const allMean = results.length > 0 ? r2(avg(results.map(r => r.mean))) : null;
  const allInterp = allMean !== null ? interp(allMean, ar) : null;

  const stackedData = results.map(r => {
    const row: Record<string, unknown> = { name: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name };
    r.dist.forEach(d => { row[d.label] = d.pct; });
    return row;
  });

  return (
    <div>
      {/* Scale selector + description */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{ar ? 'نوع المقياس' : 'Scale type'}</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {([5, 7] as const).map(s => (
              <button key={s} onClick={() => setScale(s)}
                style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', border: `1px solid ${scale === s ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`, background: scale === s ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)', color: scale === s ? C.gold : C.muted }}>
                {s}{ar ? ' نقاط' : '-point'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {labels.map((l, i) => (
            <span key={l} style={{ fontSize: 10, background: `${colors[i]}15`, border: `1px solid ${colors[i]}30`, color: colors[i], borderRadius: 5, padding: '2px 8px' }}>{i + 1} = {l}</span>
          ))}
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={item.name} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                placeholder={ar ? `نص البند ${idx + 1}` : `Item ${idx + 1} text`}
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
              {items.length > 1 && (
                <button onClick={() => setItems(it => it.filter((_, i) => i !== idx))}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: C.red, borderRadius: 7, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <input value={item.raw} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, raw: e.target.value } : x))}
              placeholder={ar ? `أدخل الاستجابات مفصولة بفواصل مثل: 4,3,5,4,2,5,4,3,4,5` : `Enter responses comma-separated: 4,3,5,4,2,5,4,3,4,5`}
              style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        ))}
        <button onClick={() => setItems(it => [...it, { name: '', raw: '' }])}
          style={{ alignSelf: 'flex-start', background: 'rgba(201,168,76,0.08)', border: `1px solid ${C.border}`, color: C.gold, borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> {ar ? 'إضافة بند' : 'Add item'}
        </button>
      </div>

      {results.length === 0 && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '20px 0' }}>{ar ? 'أدخل استجابات البنود لعرض التحليل' : 'Enter item responses to view analysis'}</p>}

      {results.length > 0 && (
        <>
          {/* Overall */}
          {allMean !== null && allInterp !== null && (
            <div style={{ background: `${allInterp.color}12`, border: `1px solid ${allInterp.color}33`, borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: allInterp.color }}>{allMean}</div>
                <div style={{ fontSize: 10, color: C.sub }}>{ar ? 'المتوسط الكلي' : 'Grand Mean'}</div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: allInterp.color }}>{allInterp.label}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                  {ar ? `تحليل ${results.length} بند — عينة ${results[0]?.n ?? 0} مشاركاً` : `${results.length} items — n = ${results[0]?.n ?? 0}`}
                </div>
              </div>
            </div>
          )}

          {/* Results table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {[ar ? 'البند' : 'Item', 'n', ar ? 'المتوسط' : 'Mean', ar ? 'الانحراف' : 'SD', ar ? 'المنوال' : 'Mode', ar ? '% موافقة' : '% Agree', ar ? 'التفسير' : 'Interpretation'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 10px', color: C.text, fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{r.n}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ background: `${r.ip.color}18`, border: `1px solid ${r.ip.color}40`, color: r.ip.color, borderRadius: 6, padding: '2px 10px', fontWeight: 700 }}>{r.mean}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{r.sd}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.blue }}>{r.mode}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.green }}>{r.agreePct}%</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: r.ip.color }}>{r.ip.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Response distribution per item */}
          {results.map((r, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, margin: '0 0 8px' }}>{r.name}</p>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {r.dist.map((d, j) => (
                  <div key={j} style={{ flex: d.pct || 1, minWidth: 4, position: 'relative' }} title={`${d.label}: ${d.count} (${d.pct}%)`}>
                    <div style={{ height: 20, background: colors[j], borderRadius: 4, opacity: 0.85 }} />
                    {d.pct > 8 && <div style={{ fontSize: 9, color: '#fff', textAlign: 'center', marginTop: 2 }}>{d.pct}%</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.dist.map((d, j) => (
                  <span key={j} style={{ fontSize: 10, color: C.sub }}><span style={{ color: colors[j] }}>●</span> {d.label}: {d.count} ({d.pct}%)</span>
                ))}
              </div>
            </div>
          ))}

          {/* Stacked bar chart */}
          {results.length > 1 && (
            <ChartCard title={`📊 ${ar ? 'توزيع الاستجابات لجميع البنود' : 'Response distribution across items'}`}>
              <ResponsiveContainer width="100%" height={results.length * 38 + 30}>
                <BarChart data={stackedData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" tick={{ fill: C.sub, fontSize: 9 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 10 }} width={90} />
                  <Tooltip {...TT} formatter={(v: unknown) => [`${v}%`]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: C.sub }} />
                  {labels.map((l, j) => (
                    <Bar key={l} dataKey={l} stackId="a" fill={colors[j]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ③  TIME SERIES ANALYZER
// ════════════════════════════════════════════════════════════════════════════
function TimeSeriesAnalyzer({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [showMA3, setShowMA3] = useState(true);
  const [showMA5, setShowMA5] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [forecast, setForecast] = useState(3);

  interface TSPoint { label: string; value: number; ma3: number | null; ma5: number | null; trend: number; gr: number | null; }

  const data: TSPoint[] = useMemo(() => {
    const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
    const parsed: { label: string; value: number }[] = [];
    lines.forEach((line, i) => {
      const parts = line.split(/[,;\t]/);
      if (parts.length >= 2) {
        const v = parseFloat(parts[parts.length - 1].trim());
        if (!isNaN(v)) parsed.push({ label: parts.slice(0, -1).join(' ').trim() || String(i + 1), value: v });
      } else {
        const v = parseFloat(line);
        if (!isNaN(v)) parsed.push({ label: String(i + 1), value: v });
      }
    });
    if (parsed.length < 2) return [];
    const values = parsed.map(p => p.value);
    const ma3 = sma(values, 3);
    const ma5 = sma(values, 5);
    const xs = parsed.map((_, i) => i + 1);
    const { a, b } = ols(xs, values);
    return parsed.map((p, i) => ({
      label: p.label,
      value: p.value,
      ma3: ma3[i],
      ma5: ma5[i],
      trend: r2(a + b * (i + 1)),
      gr: i === 0 ? null : r2((p.value - values[i - 1]) / Math.abs(values[i - 1]) * 100),
    }));
  }, [raw]);

  const forecastData = useMemo(() => {
    if (data.length < 2) return [];
    const values = data.map(d => d.value);
    const xs = data.map((_, i) => i + 1);
    const { a, b } = ols(xs, values);
    const ma3vals = values.slice(-2);
    const ma5vals = values.slice(-4);
    return Array.from({ length: forecast }, (_, i) => {
      const n = data.length + i + 1;
      const trendVal = r2(a + b * n);
      return { label: ar ? `t+${i + 1}` : `t+${i + 1}`, trend: trendVal };
    });
  }, [data, forecast, ar]);

  const chartData = useMemo(() => [
    ...data.map(d => ({
      name: d.label,
      [ar ? 'القيمة' : 'Value']: d.value,
      ...(showMA3 ? { 'MA-3': d.ma3 } : {}),
      ...(showMA5 ? { 'MA-5': d.ma5 } : {}),
      ...(showTrend ? { [ar ? 'الاتجاه' : 'Trend']: d.trend } : {}),
    })),
    ...forecastData.map(f => ({
      name: f.label,
      ...(showTrend ? { [ar ? 'الاتجاه' : 'Trend']: f.trend } : {}),
    })),
  ], [data, forecastData, showMA3, showMA5, showTrend, ar]);

  const values = data.map(d => d.value);
  const hasData = data.length >= 2;
  const trendSlope = hasData ? ols(data.map((_, i) => i + 1), values).b : 0;
  const grs = data.filter(d => d.gr !== null).map(d => d.gr!);
  const lastVal = data.length > 0 ? data[data.length - 1].value : 0;
  const firstVal = data.length > 0 ? data[0].value : 0;
  const cagr = data.length > 1 && firstVal !== 0 ? r2((Math.pow(lastVal / firstVal, 1 / (data.length - 1)) - 1) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
            {ar ? 'البيانات — سطر لكل مشاهدة (اختياري: تسمية، قيمة)' : 'Data — one value per line (optional: label, value)'}
          </p>
          <TA value={raw} onChange={setRaw} rows={6}
            placeholder={ar ? 'يناير, 120\nفبراير, 135\nمارس, 128\nأبريل, 145\nمايو, 160' : 'Jan, 120\nFeb, 135\nMar, 128\nApr, 145\nMay, 160'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{ar ? 'عروض' : 'Show'}</p>
            {[
              [ar ? 'MA-3' : 'MA-3', showMA3, setShowMA3],
              [ar ? 'MA-5' : 'MA-5', showMA5, setShowMA5],
              [ar ? 'خط الاتجاه' : 'Trend line', showTrend, setShowTrend],
            ].map(([label, state, setter]) => (
              <label key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.text, marginBottom: 4 }}>
                <input type="checkbox" checked={state as boolean} onChange={e => (setter as (v: boolean) => void)(e.target.checked)} />
                {label as string}
              </label>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{ar ? 'فترات التنبؤ' : 'Forecast periods'}</p>
            <input type="number" min={0} max={12} value={forecast} onChange={e => setForecast(Math.max(0, Math.min(12, +e.target.value)))}
              style={{ width: 68, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        </div>
      </div>

      {!hasData && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل سلسلة بيانات (قيمتان على الأقل)' : 'Enter at least 2 data points'}</p>}

      {hasData && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: 'n', v: data.length },
              { l: ar ? 'متوسط' : 'Mean', v: r2(avg(values)) },
              { l: ar ? 'انحراف' : 'SD', v: r2(sdv(values)) },
              { l: ar ? 'أدنى' : 'Min', v: r2(Math.min(...values)) },
              { l: ar ? 'أعلى' : 'Max', v: r2(Math.max(...values)) },
              { l: 'CV%', v: r2(sdv(values) / avg(values) * 100) },
              { l: ar ? 'ميل الاتجاه' : 'Trend slope', v: trendSlope, color: trendSlope > 0 ? C.green : trendSlope < 0 ? C.red : C.muted },
              { l: ar ? 'متوسط نمو' : 'Avg growth%', v: grs.length > 0 ? r2(avg(grs)) + '%' : 'N/A', color: grs.length > 0 && avg(grs) > 0 ? C.green : C.red },
              { l: 'CAGR%', v: cagr + '%', color: cagr > 0 ? C.green : C.red },
            ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
          </div>

          {/* Trend direction badge */}
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: trendSlope > 0 ? 'rgba(74,222,128,0.1)' : trendSlope < 0 ? 'rgba(248,113,113,0.1)' : 'rgba(148,163,184,0.1)', border: `1px solid ${trendSlope > 0 ? 'rgba(74,222,128,0.3)' : trendSlope < 0 ? 'rgba(248,113,113,0.3)' : 'rgba(148,163,184,0.2)'}`, borderRadius: 10, padding: '7px 14px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: trendSlope > 0 ? C.green : trendSlope < 0 ? C.red : C.muted }}>
            {trendSlope > 0 ? '📈' : trendSlope < 0 ? '📉' : '➡️'}
            {trendSlope > 0 ? (ar ? 'اتجاه تصاعدي' : 'Upward trend') : trendSlope < 0 ? (ar ? 'اتجاه تنازلي' : 'Downward trend') : (ar ? 'اتجاه مستقر' : 'Stable trend')}
            <span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>(b = {trendSlope})</span>
          </div>

          {/* Line chart */}
          <ChartCard title={`📈 ${ar ? 'الرسم البياني للسلسلة الزمنية' : 'Time Series Chart'}`}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 9 }} />
                <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                <Tooltip {...TT} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: C.sub }} />
                {data.length < chartData.length && <ReferenceLine x={data[data.length - 1]?.label} stroke={C.muted} strokeDasharray="4 4" />}
                <Line type="monotone" dataKey={ar ? 'القيمة' : 'Value'} stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} connectNulls />
                {showMA3 && <Line type="monotone" dataKey="MA-3" stroke={C.blue} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3" />}
                {showMA5 && <Line type="monotone" dataKey="MA-5" stroke={C.purple} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="3 3" />}
                {showTrend && <Line type="monotone" dataKey={ar ? 'الاتجاه' : 'Trend'} stroke={C.teal} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="6 2" />}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Growth rate table */}
          {data.length > 1 && (
            <div style={{ marginTop: 12, overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                    {[ar ? 'الفترة' : 'Period', ar ? 'القيمة' : 'Value', 'MA-3', 'MA-5', ar ? 'اتجاه' : 'Trend', ar ? 'نمو %' : 'Growth %'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text, fontWeight: 600 }}>{d.label}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.gold, fontWeight: 700 }}>{d.value}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.blue }}>{d.ma3 ?? '–'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.purple }}>{d.ma5 ?? '–'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.teal }}>{d.trend}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {d.gr === null ? '–' : (
                          <span style={{ color: d.gr >= 0 ? C.green : C.red, fontWeight: 700 }}>{d.gr >= 0 ? '+' : ''}{d.gr}%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {forecastData.map((f, i) => (
                    <tr key={`f${i}`} style={{ background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted, fontStyle: 'italic' }}>{f.label || `t+${i + 1}`} ★</td>
                      <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'center', color: C.teal, fontStyle: 'italic' }}>{f.trend} ({ar ? 'تنبؤ' : 'forecast'})</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── DATAHUB MAIN ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
const SUBTABS_AR = [
  { key: 'explorer',  icon: '📁', label: 'مستكشف البيانات',     short: 'استكشاف' },
  { key: 'freq',      icon: '📋', label: 'جدول تكراري',          short: 'تكراري' },
  { key: 'likert',    icon: '⚖️', label: 'مقياس ليكرت',          short: 'ليكرت' },
  { key: 'timeseries',icon: '📈', label: 'سلاسل زمنية',          short: 'زمني' },
  { key: 'stats',     icon: '📊', label: 'اختبارات إحصائية',     short: 'إحصاء' },
  { key: 'equations', icon: '🔢', label: 'المعادلات',             short: 'معادلات' },
];
const SUBTABS_EN = [
  { key: 'explorer',   icon: '📁', label: 'Data Explorer',      short: 'Explore' },
  { key: 'freq',       icon: '📋', label: 'Frequency Table',    short: 'Freq' },
  { key: 'likert',     icon: '⚖️', label: 'Likert Scale',       short: 'Likert' },
  { key: 'timeseries', icon: '📈', label: 'Time Series',        short: 'TimeSeries' },
  { key: 'stats',      icon: '📊', label: 'Statistical Tests',  short: 'Stats' },
  { key: 'equations',  icon: '🔢', label: 'Equations',          short: 'Eq' },
];

export default function DataHub() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [sub, setSub] = useState('explorer');
  const subtabs = ar ? SUBTABS_AR : SUBTABS_EN;

  return (
    <div>
      <style>{`@keyframes dh-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(4,9,24,0.85)', padding: '5px 5px', borderBottom: `1px solid ${C.border}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {subtabs.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, background: sub === t.key ? 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.07))' : 'transparent', border: `1px solid ${sub === t.key ? 'rgba(201,168,76,0.4)' : 'transparent'}`, color: sub === t.key ? '#f5d78e' : C.muted, borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{t.icon}</span>
            <span className="dh-label-full">{t.label}</span>
            <span className="dh-label-short" style={{ display: 'none' }}>{t.short}</span>
          </button>
        ))}
      </div>

      <style>{`
        @media(max-width:780px){
          .dh-label-full{display:none!important}
          .dh-label-short{display:inline!important}
        }
      `}</style>

      {/* Content */}
      <div style={{ padding: '22px 24px' }}>
        {sub === 'explorer'   && <DataAnalyzer />}
        {sub === 'freq'       && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 {ar ? 'الجدول التكراري وتحليل التوزيع' : 'Frequency Distribution Analysis'}
            </h3>
            <FrequencyTable ar={ar} />
          </>
        )}
        {sub === 'likert'     && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚖️ {ar ? 'تحليل مقياس ليكرت' : 'Likert Scale Analyzer'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'أدخل استجابات كل بند مفصولة بفواصل — يدعم المقاييس ذات 5 نقاط و7 نقاط'
                  : 'Enter each item\'s responses comma-separated — supports 5-point and 7-point scales'}
            </p>
            <LikertAnalyzer ar={ar} />
          </>
        )}
        {sub === 'timeseries' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📈 {ar ? 'تحليل السلاسل الزمنية' : 'Time Series Analyzer'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'متوسطات متحركة · خط الاتجاه (OLS) · معدلات النمو · التنبؤ'
                  : 'Moving averages · OLS trend line · Growth rates · Forecasting'}
            </p>
            <TimeSeriesAnalyzer ar={ar} />
          </>
        )}
        {sub === 'stats'      && <StatParser />}
        {sub === 'equations'  && <EquationChecker />}
      </div>
    </div>
  );
}
