import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import DataAnalyzer from './DataAnalyzer';
import StatParser from './StatParser';
import EquationChecker from './EquationChecker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
  ComposedChart, ScatterChart, Scatter,
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
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x / 2);
  return x >= 0 ? p : 1 - p;
}
function chiSqP(chi: number, df: number): number {
  if (chi <= 0 || df <= 0) return 1;
  const k = 2 / (9 * df);
  const z = ((chi / df) ** (1 / 3) - (1 - k)) / Math.sqrt(k);
  return Math.max(0, Math.min(1, 1 - normalCDF(z)));
}
function pearson(xs: number[], ys: number[]): number {
  const xb = avg(xs), yb = avg(ys);
  const num = xs.reduce((s, x, i) => s + (x - xb) * (ys[i] - yb), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - xb) ** 2, 0) * ys.reduce((s, y) => s + (y - yb) ** 2, 0));
  return den === 0 ? 0 : r2(num / den);
}
function rInterp(rv: number, ar: boolean) {
  const a = Math.abs(rv);
  if (a < 0.10) return { label: ar ? 'ضئيل' : 'Negligible', color: C.sub };
  if (a < 0.30) return { label: ar ? 'ضعيف' : 'Small', color: C.muted };
  if (a < 0.50) return { label: ar ? 'متوسط' : 'Moderate', color: C.yellow };
  if (a < 0.70) return { label: ar ? 'قوي' : 'Large', color: C.blue };
  if (a < 0.90) return { label: ar ? 'قوي جداً' : 'Very Large', color: C.teal };
  return { label: ar ? 'شبه تام' : 'Near Perfect', color: C.green };
}
function rCellBg(rv: number): string {
  const a = Math.abs(rv);
  return rv > 0 ? `rgba(74,222,128,${0.06 + a * 0.5})` : `rgba(248,113,113,${0.06 + a * 0.5})`;
}

// ── Matrix operations for multiple regression ──────────────────────────────
function matMul(A: number[][], B: number[][]): number[][] {
  return A.map(row => Array.from({ length: B[0].length }, (_, j) =>
    row.reduce((s, v, k) => s + v * B[k][j], 0)));
}
function matT(A: number[][]): number[][] { return A[0].map((_, j) => A.map(row => row[j])); }
function matInv(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    const sc = M[c][c]; M[c] = M[c].map(v => v / sc);
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c]; M[r] = M[r].map((v, j) => v - f * M[c][j]); }
  }
  return M.map(row => row.slice(n));
}
interface RegResult {
  vars: string[]; depVar: string; beta: number[]; se: number[]; tStat: number[]; pVal: number[];
  R2: number; adjR2: number; F: number; pF: number; n: number; k: number; rmse: number; residuals: number[]; fitted: number[];
}
function olsRegression(Xm: number[][], y: number[], depVar: string, indVars: string[]): RegResult | null {
  const n = y.length, k = Xm[0].length;
  const Xa = Xm.map(row => [1, ...row]);
  const Xt = matT(Xa); const XtX = matMul(Xt, Xa); const inv = matInv(XtX);
  if (!inv) return null;
  const Xty = Xt.map(row => row.reduce((s, x, i) => s + x * y[i], 0));
  const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const fitted = Xa.map(row => row.reduce((s, x, j) => s + x * beta[j], 0));
  const residuals = y.map((yi, i) => yi - fitted[i]);
  const ybar = avg(y);
  const SSres = residuals.reduce((s, e) => s + e * e, 0);
  const SStot = y.reduce((s, yi) => s + (yi - ybar) ** 2, 0);
  const MSres = SSres / (n - k - 1); const MSreg = (SStot - SSres) / k;
  const R2 = r2(1 - SSres / SStot);
  const adjR2 = r2(1 - (1 - R2) * (n - 1) / (n - k - 1));
  const F = r2(MSreg / MSres); const pF = r2(chiSqP(F * k, k));
  const se = inv.map((row, i) => r2(Math.sqrt(Math.max(0, MSres * row[i]))));
  const tStat = beta.map((b, i) => r2(se[i] !== 0 ? b / se[i] : 0));
  const pVal = tStat.map(t => { const p = 2 * (1 - normalCDF(Math.abs(t))); return r2(Math.max(0.0001, p)); });
  return { vars: [indVars.length > 0 ? 'Intercept' : 'β₀', ...indVars], depVar, beta: beta.map(b => r2(b)), se, tStat, pVal, R2, adjR2, F, pF, n, k, rmse: r2(Math.sqrt(MSres)), residuals: residuals.map(e => r2(e)), fitted: fitted.map(f => r2(f)) };
}
function pLabel(p: number, ar: boolean): { text: string; color: string } {
  if (p < 0.001) return { text: ar ? 'دال جداً (p<0.001)' : 'Highly sig. (p<0.001)', color: C.green };
  if (p < 0.01)  return { text: ar ? 'دال (p<0.01)' : 'Sig. (p<0.01)', color: C.teal };
  if (p < 0.05)  return { text: ar ? 'دال (p<0.05)' : 'Sig. (p<0.05)', color: C.blue };
  return { text: ar ? 'غير دال (p≥0.05)' : 'Not sig. (p≥0.05)', color: C.muted };
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
// ④  CORRELATION MATRIX
// ════════════════════════════════════════════════════════════════════════════
function CorrelationMatrix({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [selA, setSelA] = useState(0);
  const [selB, setSelB] = useState(1);

  const { vars, cols, matrix } = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim()).map(l => l.split(/[,;\t]/).map(v => v.trim()));
    if (lines.length < 2) return { vars: [], cols: [], matrix: [] };
    let hdr: string[], rows: string[][];
    if (hasHeader) { hdr = lines[0].map((h, i) => h || `X${i + 1}`); rows = lines.slice(1); }
    else { hdr = lines[0].map((_, i) => `X${i + 1}`); rows = lines; }
    const cols: { name: string; vals: number[] }[] = [];
    for (let c = 0; c < hdr.length; c++) {
      const vals = rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v));
      if (vals.length >= 2) cols.push({ name: hdr[c], vals });
    }
    const minLen = Math.min(...cols.map(c => c.vals.length));
    const aligned = cols.map(c => ({ ...c, vals: c.vals.slice(0, minLen) }));
    const matrix = aligned.map(cx => aligned.map(cy => pearson(cx.vals, cy.vals)));
    return { vars: aligned.map(c => c.name), cols: aligned, matrix };
  }, [raw, hasHeader]);

  const hasData = matrix.length >= 2;
  const scatter = hasData && selA < cols.length && selB < cols.length && selA !== selB
    ? cols[selA].vals.map((x, i) => ({ x, y: cols[selB].vals[i] }))
    : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
          {ar ? 'الصف الأول = أسماء المتغيرات' : 'First row = variable names'}
        </label>
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
            {ar ? 'البيانات CSV — كل صف مشاركٌ، كل عمود متغير' : 'CSV data — each row = observation, each column = variable'}
          </p>
          <TA value={raw} onChange={setRaw} rows={5}
            placeholder={ar
              ? 'الدرجة,الغياب,الساعات\n85,2,6\n72,5,4\n90,1,8\n65,7,3'
              : 'Score,Absences,Hours\n85,2,6\n72,5,4\n90,1,8\n65,7,3'} />
        </div>
      </div>

      {!hasData && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل بيانات CSV بمتغيرَين على الأقل' : 'Enter CSV with at least 2 numerical variables'}</p>}

      {hasData && (
        <>
          {/* Matrix */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  <th style={{ padding: '9px 12px', color: C.sub, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}></th>
                  {vars.map(v => <th key={v} style={{ padding: '9px 12px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {vars.map((vr, i) => (
                  <tr key={vr} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: C.gold, whiteSpace: 'nowrap', background: 'rgba(201,168,76,0.04)' }}>{vr}</td>
                    {matrix[i].map((rv, j) => {
                      const ip = rInterp(rv, ar);
                      const isDiag = i === j;
                      return (
                        <td key={j} style={{ padding: '8px 10px', textAlign: 'center', background: isDiag ? 'rgba(255,255,255,0.03)' : rCellBg(rv), cursor: !isDiag ? 'pointer' : 'default', transition: 'opacity .15s' }}
                          title={!isDiag ? `r = ${rv} — ${ip.label}` : ''}
                          onClick={() => { if (!isDiag) { setSelA(i); setSelB(j); } }}>
                          {isDiag
                            ? <span style={{ color: C.sub }}>1.00</span>
                            : <><div style={{ fontWeight: 800, color: ip.color, fontSize: 13 }}>{rv.toFixed(2)}</div>
                              <div style={{ fontSize: 9, color: ip.color, opacity: 0.8, marginTop: 1 }}>{ip.label}</div></>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pair details table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {[ar ? 'المتغير أ' : 'Var A', ar ? 'المتغير ب' : 'Var B', 'r', ar ? 'القوة' : 'Strength', ar ? 'الاتجاه' : 'Direction'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vars.flatMap((va, i) => vars.slice(i + 1).map((vb, jj) => {
                  const j = i + 1 + jj;
                  const rv = matrix[i][j];
                  const ip = rInterp(rv, ar);
                  return (
                    <tr key={`${i}-${j}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: selA === i && selB === j ? 'rgba(201,168,76,0.06)' : 'transparent' }}
                      onClick={() => { setSelA(i); setSelB(j); }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text }}>{va}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text }}>{vb}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{ background: rCellBg(rv), borderRadius: 6, padding: '2px 10px', fontWeight: 800, color: ip.color }}>{rv.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: ip.color, fontWeight: 600 }}>{ip.label}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: rv > 0 ? C.green : rv < 0 ? C.red : C.sub }}>
                        {rv > 0 ? (ar ? '↑ طردي' : '↑ Positive') : rv < 0 ? (ar ? '↓ عكسي' : '↓ Negative') : '—'}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          {/* Scatter plot for selected pair */}
          {scatter.length > 0 && selA !== selB && (
            <ChartCard title={`🔵 ${ar ? 'مخطط الانتشار' : 'Scatter Plot'}: ${vars[selA]} × ${vars[selB]}  (r = ${matrix[selA][selB].toFixed(2)})`}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={scatter} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="x" name={vars[selA]} tick={{ fill: C.sub, fontSize: 9 }} label={{ value: vars[selA], position: 'insideBottom', offset: -2, fill: C.sub, fontSize: 10 }} />
                  <YAxis dataKey="y" name={vars[selB]} tick={{ fill: C.sub, fontSize: 9 }} />
                  <Tooltip {...TT} formatter={(v: number | string, name: string) => [v, name === 'y' ? vars[selB] : vars[selA]]} />
                  <Line type="linear" dataKey="y" stroke={C.gold} dot={{ r: 4, fill: C.gold, fillOpacity: 0.7 }} activeDot={{ r: 6 }} strokeWidth={0} />
                </LineChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: C.sub, textAlign: 'center', margin: '4px 0 0' }}>{ar ? 'انقر على أي زوج في الجدول لعرض مخططه' : 'Click any pair in the table to view its scatter plot'}</p>
            </ChartCard>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <span style={{ fontSize: 11, color: C.sub, marginInlineEnd: 4 }}>{ar ? 'مرجع تفسير r:' : 'r interpretation:'}</span>
            {[[ar ? '|r|<0.1 ضئيل' : '|r|<0.1 Negligible', C.sub],
              [ar ? '0.1–0.3 ضعيف' : '0.1–0.3 Small', C.muted],
              [ar ? '0.3–0.5 متوسط' : '0.3–0.5 Moderate', C.yellow],
              [ar ? '0.5–0.7 قوي' : '0.5–0.7 Large', C.blue],
              [ar ? '0.7–0.9 قوي جداً' : '0.7–0.9 Very Large', C.teal],
              [ar ? '≥0.9 شبه تام' : '≥0.9 Near Perfect', C.green]].map(([l, c]) => (
              <span key={String(l)} style={{ fontSize: 10, color: c as string, background: `${c as string}15`, border: `1px solid ${c as string}30`, borderRadius: 5, padding: '2px 8px' }}>{l}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑤  CROSS-TABULATION + CHI-SQUARE
// ════════════════════════════════════════════════════════════════════════════
function CrossTab({ ar }: { ar: boolean }) {
  const [rawA, setRawA] = useState('');
  const [rawB, setRawB] = useState('');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [view, setView] = useState<'obs' | 'exp' | 'pct'>('obs');

  const res = useMemo(() => {
    const vA = rawA.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
    const vB = rawB.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
    const n = Math.min(vA.length, vB.length);
    if (n < 4) return null;
    const catsA = [...new Set(vA.slice(0, n))].sort();
    const catsB = [...new Set(vB.slice(0, n))].sort();
    const obs: number[][] = catsA.map(a => catsB.map(b =>
      vA.slice(0, n).filter((v, i) => v === a && vB[i] === b).length
    ));
    const rowTot = obs.map(row => row.reduce((s, v) => s + v, 0));
    const colTot = catsB.map((_, j) => obs.reduce((s, row) => s + row[j], 0));
    const total = rowTot.reduce((s, v) => s + v, 0);
    const exp: number[][] = obs.map((row, i) => row.map((_, j) => r2(rowTot[i] * colTot[j] / total)));
    let chiSq = 0;
    obs.forEach((row, i) => row.forEach((o, j) => { if (exp[i][j] > 0) chiSq += (o - exp[i][j]) ** 2 / exp[i][j]; }));
    chiSq = r2(chiSq);
    const df = (catsA.length - 1) * (catsB.length - 1);
    const p = chiSqP(chiSq, df);
    const cramers = df > 0 ? r2(Math.sqrt(chiSq / (total * Math.min(catsA.length - 1, catsB.length - 1)))) : 0;
    return { catsA, catsB, obs, exp, rowTot, colTot, total, chiSq, df, p, cramers };
  }, [rawA, rawB]);

  const tableData = res
    ? (view === 'obs' ? res.obs : view === 'exp' ? res.exp : res.obs.map((row, i) => row.map((o, j) => r2(o / (res.rowTot[i] || 1) * 100))))
    : null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {([
          [nameA, setNameA, rawA, setRawA, ar ? 'المتغير الأول (الصفوف)' : 'Variable A (rows)', ar ? 'مثال: ذكر, أنثى, ذكر, أنثى...' : 'e.g.: Male, Female, Male, Female...'],
          [nameB, setNameB, rawB, setRawB, ar ? 'المتغير الثاني (الأعمدة)' : 'Variable B (columns)', ar ? 'مثال: موافق, معارض, محايد, موافق...' : 'e.g.: Agree, Disagree, Neutral, Agree...'],
        ] as const).map(([name, setName, raw, setRaw, label, ph], idx) => (
          <div key={idx}>
            <input value={name} onChange={e => (setName as (v: string) => void)(e.target.value)}
              placeholder={ar ? `اسم المتغير ${idx + 1}` : `Variable ${idx + 1} name`}
              style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none', marginBottom: 6 }} />
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>{label}</p>
            <TA value={raw} onChange={v => (setRaw as (v: string) => void)(v)} rows={4} placeholder={ph} />
          </div>
        ))}
      </div>

      {!res && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '20px 0' }}>{ar ? 'أدخل متغيرَين فئويَّين (4 مشاهدات على الأقل)' : 'Enter 2 categorical variables (at least 4 observations each)'}</p>}

      {res && (
        <>
          {/* Chi-square summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: 'χ²', v: res.chiSq, color: C.gold },
              { l: 'df', v: res.df, color: C.blue },
              { l: 'p-value', v: res.p < 0.001 ? '<0.001' : res.p.toFixed(3), color: pLabel(res.p, ar).color },
              { l: "Cramér's V", v: res.cramers, color: C.teal },
              { l: 'n', v: res.total, color: C.sub },
            ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
            <div style={{ ...{}, display: 'flex', alignItems: 'center', background: `${pLabel(res.p, ar).color}15`, border: `1px solid ${pLabel(res.p, ar).color}33`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: pLabel(res.p, ar).color }}>
              {pLabel(res.p, ar).text}
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {([['obs', ar ? 'التكرارات المشاهدة' : 'Observed'], ['exp', ar ? 'المتوقعة' : 'Expected'], ['pct', ar ? 'نسب الصف %' : 'Row %']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', border: `1px solid ${view === k ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`, background: view === k ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)', color: view === k ? C.gold : C.muted }}>
                {l}
              </button>
            ))}
          </div>

          {/* Contingency table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  <th style={{ padding: '9px 12px', color: C.sub, borderBottom: `1px solid ${C.border}` }}>
                    {(nameA || (ar ? 'أ' : 'A'))} \ {(nameB || (ar ? 'ب' : 'B'))}
                  </th>
                  {res.catsB.map(b => <th key={b} style={{ padding: '9px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{b}</th>)}
                  <th style={{ padding: '9px 10px', textAlign: 'center', color: C.purple, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{ar ? 'المجموع' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {res.catsA.map((a, i) => (
                  <tr key={a} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: C.gold, background: 'rgba(201,168,76,0.04)', whiteSpace: 'nowrap' }}>{a}</td>
                    {(tableData![i]).map((val, j) => (
                      <td key={j} style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: C.text }}>{view === 'pct' ? `${val}%` : val}</span>
                        {view === 'obs' && <div style={{ fontSize: 9, color: C.sub, marginTop: 1 }}>E={res.exp[i][j]}</div>}
                      </td>
                    ))}
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: C.purple, fontWeight: 700 }}>
                      {view === 'pct' ? '100%' : res.rowTot[i]}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(201,168,76,0.06)', borderTop: `1px solid ${C.border}`, fontWeight: 800 }}>
                  <td style={{ padding: '8px 12px', color: C.purple }}>{ar ? 'المجموع' : 'Total'}</td>
                  {res.colTot.map((ct, j) => <td key={j} style={{ padding: '8px 10px', textAlign: 'center', color: C.purple }}>{ct}</td>)}
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: C.gold }}>{res.total}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bar chart of observed */}
          <ChartCard title={`📊 ${ar ? 'توزيع التكرارات المشاهدة' : 'Observed Frequencies Distribution'}`}>
            <ResponsiveContainer width="100%" height={Math.max(180, res.catsA.length * 45)}>
              <BarChart data={res.catsA.map((a, i) => {
                const row: Record<string, unknown> = { name: a };
                res.catsB.forEach((b, j) => { row[b] = res.obs[i][j]; });
                return row;
              })} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 10 }} />
                <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                <Tooltip {...TT} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: C.sub }} />
                {res.catsB.map((b, j) => <Bar key={b} dataKey={b} fill={P[j % P.length]} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cramér's V interpretation */}
          <div style={{ marginTop: 12, padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }}>
            <span style={{ color: C.gold, fontWeight: 700 }}>Cramér's V = {res.cramers}</span>
            <span style={{ color: C.sub, marginInlineStart: 8 }}>
              {res.cramers < 0.10 ? (ar ? '← تأثير ضئيل' : '← Negligible effect')
                : res.cramers < 0.30 ? (ar ? '← تأثير صغير' : '← Small effect')
                : res.cramers < 0.50 ? (ar ? '← تأثير متوسط' : '← Moderate effect')
                : (ar ? '← تأثير كبير' : '← Large effect')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑥  REGRESSION ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
function RegressionAnalysis({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [depIdx, setDepIdx] = useState(0);
  const [indIdxs, setIndIdxs] = useState<number[]>([1]);

  const { vars, cols } = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim()).map(l => l.split(/[,;\t]/).map(v => v.trim()));
    if (lines.length < 3) return { vars: [], cols: [] };
    let hdr: string[], rows: string[][];
    if (hasHeader) { hdr = lines[0].map((h, i) => h || `X${i + 1}`); rows = lines.slice(1); }
    else { hdr = lines[0].map((_, i) => `X${i + 1}`); rows = lines; }
    const cs: { name: string; vals: number[] }[] = [];
    for (let c = 0; c < hdr.length; c++) {
      const vals = rows.map(r => parseFloat(r[c])).filter(v => !isNaN(v));
      if (vals.length >= 3) cs.push({ name: hdr[c], vals });
    }
    const minLen = Math.min(...cs.map(c => c.vals.length));
    return { vars: cs.map(c => c.name), cols: cs.map(c => ({ ...c, vals: c.vals.slice(0, minLen) })) };
  }, [raw, hasHeader]);

  const toggleInd = (idx: number) => {
    if (idx === depIdx) return;
    setIndIdxs(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const result: RegResult | null = useMemo(() => {
    if (cols.length < 2) return null;
    const safeIndIdxs = indIdxs.filter(i => i !== depIdx && i < cols.length);
    if (safeIndIdxs.length === 0) return null;
    const y = cols[depIdx]?.vals ?? [];
    const Xm = cols[0].vals.map((_, i) => safeIndIdxs.map(j => cols[j].vals[i]));
    return olsRegression(Xm, y, vars[depIdx] ?? '', safeIndIdxs.map(j => vars[j] ?? ''));
  }, [cols, depIdx, indIdxs, vars]);

  const hasData = vars.length >= 2;
  const isSimple = result && result.k === 1;

  const scatterData = isSimple && result
    ? cols[indIdxs.filter(i => i !== depIdx)[0]]?.vals.map((x, i) => ({
        x, y: cols[depIdx].vals[i],
        fit: r2(result.beta[0] + result.beta[1] * x),
      }))
    : null;

  const residualData = result
    ? result.fitted.map((f, i) => ({ x: r2(f), y: result.residuals[i] }))
    : null;

  return (
    <div>
      {/* Input */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
            {ar ? 'الصف الأول = أسماء المتغيرات' : 'First row = variable names'}
          </label>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
            {ar ? 'البيانات CSV — كل صف مشاركٌ، كل عمود متغير' : 'CSV data — rows = observations, columns = variables'}
          </p>
          <TA value={raw} onChange={setRaw} rows={5}
            placeholder={ar
              ? 'الدرجة,الدخل,التعليم,العمر\n82,35000,16,28\n74,28000,12,35\n91,52000,18,24\n67,22000,10,45'
              : 'Score,Income,Education,Age\n82,35000,16,28\n74,28000,12,35\n91,52000,18,24\n67,22000,10,45'} />
        </div>

        {hasData && (
          <div style={{ minWidth: 200 }}>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 8px' }}>{ar ? 'المتغير التابع (Y)' : 'Dependent variable (Y)'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {vars.map((v, i) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: depIdx === i ? C.gold : C.text }}>
                  <input type="radio" name="dep" checked={depIdx === i} onChange={() => { setDepIdx(i); setIndIdxs(prev => prev.filter(j => j !== i)); }} />
                  {v}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 8px' }}>{ar ? 'المتغيرات المستقلة (X)' : 'Independent variables (X)'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vars.map((v, i) => i === depIdx ? null : (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: indIdxs.includes(i) ? C.blue : C.muted }}>
                  <input type="checkbox" checked={indIdxs.includes(i)} onChange={() => toggleInd(i)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasData && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل بيانات CSV بمتغيرَين على الأقل' : 'Enter CSV data with at least 2 variables'}</p>}
      {hasData && !result && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '12px 0' }}>{ar ? 'اختر متغيراً تابعاً ومتغيراً مستقلاً على الأقل' : 'Select a dependent variable and at least one independent variable'}</p>}

      {result && (
        <>
          {/* Model summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: 'R²', v: result.R2, color: C.gold },
              { l: ar ? 'R² المعدّل' : 'Adj. R²', v: result.adjR2, color: C.teal },
              { l: 'F', v: result.F, color: C.blue },
              { l: 'p(F)', v: result.pF < 0.001 ? '<0.001' : result.pF.toFixed(3), color: pLabel(result.pF, ar).color },
              { l: 'RMSE', v: result.rmse, color: C.purple },
              { l: 'n', v: result.n, color: C.sub },
              { l: 'k', v: result.k, color: C.sub },
            ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
            <div style={{ display: 'flex', alignItems: 'center', background: `${pLabel(result.pF, ar).color}15`, border: `1px solid ${pLabel(result.pF, ar).color}33`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: pLabel(result.pF, ar).color }}>
              {pLabel(result.pF, ar).text}
            </div>
          </div>

          {/* Equation */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontFamily: 'monospace' }}>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 6px' }}>{ar ? 'معادلة الانحدار:' : 'Regression equation:'}</p>
            <p style={{ fontSize: 13, color: C.gold, margin: 0, fontWeight: 700, wordBreak: 'break-all' }}>
              {result.depVar} = {result.beta[0]}{result.beta.slice(1).map((b, i) => ` ${b >= 0 ? '+' : ''} ${b}·${result.vars[i + 1]}`).join('')}
            </p>
          </div>

          {/* Coefficients table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {[ar ? 'المتغير' : 'Variable', 'β', 'SE', 't', 'p-value', ar ? 'الدلالة' : 'Sig.'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.vars.map((v, i) => {
                  const pl = pLabel(result.pVal[i], ar);
                  return (
                    <tr key={v} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: i === 0 ? C.sub : C.text }}>{v}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <span style={{ background: result.beta[i] >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: result.beta[i] >= 0 ? C.green : C.red, borderRadius: 6, padding: '2px 10px', fontWeight: 700 }}>{result.beta[i]}</span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{result.se[i]}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>{result.tStat[i]}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: pl.color }}>{result.pVal[i] <= 0.0001 ? '<0.0001' : result.pVal[i].toFixed(4)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, color: pl.color, fontWeight: 600 }}>{pl.text.split('(')[0].trim()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
            {scatterData && (
              <ChartCard title={`🔵 ${ar ? 'مخطط الانتشار مع خط الانحدار' : 'Scatter Plot with Regression Line'}`}>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={scatterData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="x" tick={{ fill: C.sub, fontSize: 9 }} name={result.vars[1]} />
                    <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                    <Tooltip {...TT} />
                    <Line type="linear" dataKey="y" name={result.depVar} stroke={C.gold} strokeWidth={0} dot={{ r: 4, fill: C.gold, fillOpacity: 0.7 }} />
                    <Line type="linear" dataKey="fit" name={ar ? 'خط الانحدار' : 'Fit'} stroke={C.teal} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {residualData && (
              <ChartCard title={`📉 ${ar ? 'مخطط البواقي (Fitted vs Residuals)' : 'Residuals Plot (Fitted vs Residuals)'}`}>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={residualData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="x" tick={{ fill: C.sub, fontSize: 9 }} label={{ value: ar ? 'القيم المتوقعة' : 'Fitted', position: 'insideBottom', offset: -2, fill: C.sub, fontSize: 9 }} />
                    <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                    <Tooltip {...TT} />
                    <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 2" />
                    <Line type="linear" dataKey="y" name={ar ? 'البواقي' : 'Residual'} stroke={C.purple} strokeWidth={0} dot={{ r: 4, fill: C.purple, fillOpacity: 0.7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* R² interpretation */}
          <div style={{ marginTop: 12, padding: '10px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }}>
            <span style={{ color: C.gold, fontWeight: 700 }}>R² = {result.R2}</span>
            <span style={{ color: C.sub, marginInlineStart: 8 }}>
              {ar
                ? `يفسّر النموذج ${(result.R2 * 100).toFixed(1)}% من التباين في المتغير التابع`
                : `The model explains ${(result.R2 * 100).toFixed(1)}% of variance in the dependent variable`}
            </span>
            <span style={{ color: C.muted, marginInlineStart: 8, fontSize: 10 }}>
              {ar ? '* قيم p تقريبية (تقريب التوزيع الطبيعي)' : '* p-values are approximate (normal approximation)'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑦  GROUP COMPARISON — t-test & ANOVA
// ════════════════════════════════════════════════════════════════════════════
function gStats(vals: number[]) {
  const n = vals.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, se: 0, min: 0, max: 0, median: 0 };
  const m = avg(vals);
  const sd = n > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const med = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  return { n, mean: r2(m), sd: r2(sd), se: r2(sd / Math.sqrt(n)), min: sorted[0], max: sorted[n - 1], median: r2(med) };
}
const GCOLORS = ['#C9A84C', '#5eead4', '#93c5fd', '#c4b5fd', '#4ade80', '#f87171', '#fb923c', '#fbbf24'];
function dLabel(d: number, ar: boolean) { if (d < 0.2) return ar ? 'ضئيل' : 'Negligible'; if (d < 0.5) return ar ? 'صغير' : 'Small'; if (d < 0.8) return ar ? 'متوسط' : 'Medium'; if (d < 1.2) return ar ? 'كبير' : 'Large'; return ar ? 'كبير جداً' : 'Very Large'; }
function e2Label(e: number, ar: boolean) { if (e < 0.01) return ar ? 'ضئيل' : 'Negligible'; if (e < 0.06) return ar ? 'صغير' : 'Small'; if (e < 0.14) return ar ? 'متوسط' : 'Medium'; return ar ? 'كبير' : 'Large'; }

function GroupComparison({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [groupCol, setGroupCol] = useState(0);
  const [valCol, setValCol] = useState(1);

  const { headers, rows } = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim()).map(l => l.split(/[,;\t]/).map(v => v.trim()));
    if (lines.length < 3) return { headers: [] as string[], rows: [] as string[][] };
    if (hasHeader) return { headers: lines[0].map((h, i) => h || `C${i + 1}`), rows: lines.slice(1) };
    return { headers: lines[0].map((_, i) => `C${i + 1}`), rows: lines };
  }, [raw, hasHeader]);

  const groups = useMemo(() => {
    if (!rows.length) return [] as { name: string; vals: number[]; stats: ReturnType<typeof gStats> }[];
    const map = new Map<string, number[]>();
    for (const row of rows) {
      const g = row[groupCol] ?? ''; const v = parseFloat(row[valCol]);
      if (!g || isNaN(v)) continue;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(v);
    }
    return Array.from(map.entries()).map(([name, vals]) => ({ name, vals, stats: gStats(vals) }));
  }, [rows, groupCol, valCol]);

  const tResult = useMemo(() => {
    if (groups.length !== 2) return null;
    const [g1, g2] = groups;
    const s1 = g1.stats, s2 = g2.stats;
    if (s1.n < 2 || s2.n < 2 || (s1.sd === 0 && s2.sd === 0)) return null;
    const se2 = (s1.sd ** 2) / s1.n + (s2.sd ** 2) / s2.n;
    const se = Math.sqrt(se2); if (se === 0) return null;
    const t = r2((s1.mean - s2.mean) / se);
    const df = r2(se2 ** 2 / (((s1.sd ** 2 / s1.n) ** 2) / (s1.n - 1) + ((s2.sd ** 2 / s2.n) ** 2) / (s2.n - 1)));
    const p = r2(Math.max(0.0001, 2 * (1 - normalCDF(Math.abs(t)))));
    const d = r2(Math.abs(s1.mean - s2.mean) / (Math.sqrt((s1.sd ** 2 + s2.sd ** 2) / 2) || 1));
    const ci95lo = r2((s1.mean - s2.mean) - 1.96 * se);
    const ci95hi = r2((s1.mean - s2.mean) + 1.96 * se);
    return { t, df, p, d, ci95lo, ci95hi };
  }, [groups]);

  const anova = useMemo(() => {
    if (groups.length < 2) return null;
    const N = groups.reduce((s, g) => s + g.stats.n, 0);
    const grandMean = groups.reduce((s, g) => s + g.stats.mean * g.stats.n, 0) / N;
    const SSbet = groups.reduce((s, g) => s + g.stats.n * (g.stats.mean - grandMean) ** 2, 0);
    const SSwit = groups.reduce((s, g) => s + g.vals.reduce((ss, v) => ss + (v - g.stats.mean) ** 2, 0), 0);
    const SStot = SSbet + SSwit; const k = groups.length;
    const MSbet = SSbet / (k - 1); const MSwit = SSwit / (N - k);
    const F = r2(MSbet / (MSwit || 1)); const eta2 = r2(SSbet / (SStot || 1));
    const pF = r2(Math.max(0.0001, chiSqP(F * (k - 1), k - 1)));
    return { N, k, F, pF, eta2, SSbet: r2(SSbet), SSwit: r2(SSwit), SStot: r2(SStot), MSbet: r2(MSbet), MSwit: r2(MSwit), df1: k - 1, df2: N - k };
  }, [groups]);

  const pairwise = useMemo(() => {
    if (groups.length < 2) return [] as { a: string; b: string; diff: number; t: number; p: number }[];
    const out: { a: string; b: string; diff: number; t: number; p: number }[] = [];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const s1 = groups[i].stats, s2 = groups[j].stats;
        if (s1.n < 2 || s2.n < 2) continue;
        const se = Math.sqrt((s1.sd ** 2) / s1.n + (s2.sd ** 2) / s2.n); if (se === 0) continue;
        const t = r2((s1.mean - s2.mean) / se);
        const p = r2(Math.max(0.0001, 2 * (1 - normalCDF(Math.abs(t)))));
        out.push({ a: groups[i].name, b: groups[j].name, diff: r2(s1.mean - s2.mean), t, p });
      }
    }
    return out;
  }, [groups]);

  const isT = groups.length === 2;

  return (
    <div>
      {/* Input */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
            {ar ? 'الصف الأول = أسماء الأعمدة' : 'First row = column names'}
          </label>
          <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
            {ar ? 'CSV: عمود التسمية (المجموعة) + عمود القيمة الرقمية' : 'CSV: group label column + numeric value column'}
          </p>
          <TA value={raw} onChange={setRaw} rows={6}
            placeholder={ar
              ? 'المجموعة,الدرجة\nأ,82\nأ,75\nأ,90\nأ,88\nب,65\nب,70\nب,68\nج,55\nج,60\nج,58\nج,62'
              : 'Group,Score\nA,82\nA,75\nA,90\nA,88\nB,65\nB,70\nB,68\nC,55\nC,60\nC,58\nC,62'} />
        </div>
        {headers.length >= 2 && (
          <div style={{ minWidth: 190 }}>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 6px' }}>{ar ? 'عمود المجموعة' : 'Group column'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
              {headers.map((h, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: groupCol === i ? C.gold : C.text }}>
                  <input type="radio" name="gcol" checked={groupCol === i} onChange={() => setGroupCol(i)} />{h}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.sub, margin: '0 0 6px' }}>{ar ? 'عمود القيمة' : 'Value column'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {headers.map((h, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: valCol === i ? C.blue : C.text }}>
                  <input type="radio" name="vcol" checked={valCol === i} onChange={() => setValCol(i)} />{h}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {groups.length < 2 && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل بيانات بمجموعتَين على الأقل' : 'Enter data with at least 2 groups'}</p>}

      {groups.length >= 2 && (
        <>
          {/* Descriptive stats table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {[ar ? 'المجموعة' : 'Group', 'n', ar ? 'المتوسط' : 'Mean', ar ? 'الانحراف ±' : '±SD', ar ? 'الخطأ' : 'SE', ar ? 'الوسيط' : 'Median', 'Min', 'Max'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr key={g.name} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: GCOLORS[i % GCOLORS.length], marginInlineEnd: 6 }} />
                      <span style={{ color: GCOLORS[i % GCOLORS.length] }}>{g.name}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{g.stats.n}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>{g.stats.mean}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{g.stats.sd}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{g.stats.se}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{g.stats.median}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{g.stats.min}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{g.stats.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar chart of means */}
          <ChartCard title={`📊 ${ar ? 'متوسطات المجموعات' : 'Group Means'}`}>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={groups.map((g, i) => ({ name: g.name, mean: g.stats.mean, color: GCOLORS[i % GCOLORS.length] }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                <YAxis tick={{ fill: C.sub, fontSize: 9 }} />
                <Tooltip {...TT} formatter={(v: number) => [v, ar ? 'المتوسط' : 'Mean']} />
                <Bar dataKey="mean" radius={[6, 6, 0, 0]}>
                  {groups.map((_, i) => <Cell key={i} fill={GCOLORS[i % GCOLORS.length]} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Welch t-test */}
          {isT && tResult && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
              <p style={{ fontWeight: 800, color: C.gold, margin: '0 0 12px', fontSize: 14 }}>
                🧪 {ar ? "اختبار ويلش t (تباينات غير متساوية)" : "Welch's t-Test (unequal variances)"}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { l: 't', v: tResult.t, color: C.blue },
                  { l: 'df', v: tResult.df, color: C.sub },
                  { l: 'p', v: tResult.p <= 0.001 ? '<0.001' : tResult.p.toFixed(3), color: pLabel(tResult.p, ar).color },
                  { l: "Cohen's d", v: tResult.d, color: C.purple },
                  { l: '95% CI', v: `[${tResult.ci95lo}, ${tResult.ci95hi}]`, color: C.teal },
                ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
                <div style={{ display: 'flex', alignItems: 'center', background: `${pLabel(tResult.p, ar).color}15`, border: `1px solid ${pLabel(tResult.p, ar).color}33`, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: pLabel(tResult.p, ar).color }}>{pLabel(tResult.p, ar).text}</div>
              </div>
              <p style={{ fontSize: 12, color: C.sub, margin: 0 }}>
                {ar ? `حجم الأثر — Cohen's d = ${tResult.d}: ${dLabel(tResult.d, ar)}` : `Effect size — Cohen's d = ${tResult.d}: ${dLabel(tResult.d, ar)}`}
              </p>
            </div>
          )}

          {/* ANOVA */}
          {anova && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
              <p style={{ fontWeight: 800, color: C.gold, margin: '0 0 12px', fontSize: 14 }}>
                📊 {ar ? 'تحليل التباين الأحادي (One-Way ANOVA)' : 'One-Way ANOVA'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { l: 'F', v: anova.F, color: C.blue },
                  { l: `df(${anova.df1},${anova.df2})`, v: `${anova.df1}, ${anova.df2}`, color: C.sub },
                  { l: 'p', v: anova.pF <= 0.001 ? '<0.001' : anova.pF.toFixed(3), color: pLabel(anova.pF, ar).color },
                  { l: 'η²', v: anova.eta2, color: C.purple },
                ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
                <div style={{ display: 'flex', alignItems: 'center', background: `${pLabel(anova.pF, ar).color}15`, border: `1px solid ${pLabel(anova.pF, ar).color}33`, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: pLabel(anova.pF, ar).color }}>{pLabel(anova.pF, ar).text}</div>
              </div>
              <p style={{ fontSize: 12, color: C.sub, margin: '0 0 12px' }}>
                {ar ? `η² = ${anova.eta2} (${e2Label(anova.eta2, ar)})` : `η² = ${anova.eta2} (${e2Label(anova.eta2, ar)} effect)`}
              </p>
              {/* ANOVA table */}
              <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'rgba(201,168,76,0.06)' }}>
                      {[ar ? 'المصدر' : 'Source', 'SS', 'df', 'MS', 'F', 'p'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { src: ar ? 'بين المجموعات' : 'Between', ss: anova.SSbet, df: anova.df1, ms: anova.MSbet, f: anova.F, p: anova.pF as number | '' },
                      { src: ar ? 'داخل المجموعات' : 'Within', ss: anova.SSwit, df: anova.df2, ms: anova.MSwit, f: '' as number | '', p: '' as number | '' },
                      { src: ar ? 'الكلي' : 'Total', ss: anova.SStot, df: anova.df1 + anova.df2, ms: '' as number | '', f: '' as number | '', p: '' as number | '' },
                    ].map((row, i) => (
                      <tr key={row.src} style={{ background: i === 0 ? 'rgba(201,168,76,0.04)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: i === 2 ? 700 : 400 }}>{row.src}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.ss}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.df}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.ms}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>{row.f}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: typeof row.p === 'number' ? pLabel(row.p, ar).color : C.sub }}>{typeof row.p === 'number' ? (row.p <= 0.001 ? '<0.001' : row.p.toFixed(3)) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pairwise comparisons */}
          {pairwise.length > 1 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
              <p style={{ fontWeight: 800, color: C.gold, margin: '0 0 6px', fontSize: 14 }}>🔀 {ar ? 'المقارنات الزوجية (LSD)' : 'Pairwise Comparisons (LSD)'}</p>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>{ar ? '⚠ بدون تصحيح بونفيروني — طبّقه عند الحاجة' : '⚠ No Bonferroni correction — apply if needed'}</p>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(201,168,76,0.06)' }}>
                      {[ar ? 'المقارنة' : 'Comparison', ar ? 'الفرق' : 'Diff', 't', 'p', ar ? 'الدلالة' : 'Sig.'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pairwise.map((pw, i) => {
                      const pl = pLabel(pw.p, ar);
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }}>{pw.a} vs {pw.b}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: pw.diff >= 0 ? C.green : C.red }}>{pw.diff > 0 ? '+' : ''}{pw.diff}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', color: C.blue }}>{pw.t}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', color: pl.color }}>{pw.p <= 0.001 ? '<0.001' : pw.p.toFixed(3)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, color: pl.color, fontWeight: 600 }}>{pl.text.split('(')[0].trim()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: 'center' }}>
            {ar ? '* قيم p تقريبية (التوزيع الطبيعي) · موثوقة لـ n≥30 لكل مجموعة' : '* Approximate p-values (normal approx.) · reliable for n≥30 per group'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑧  CRONBACH'S ALPHA — Reliability Analysis
// ════════════════════════════════════════════════════════════════════════════
function alphaLabel(a: number, ar: boolean): { text: string; color: string } {
  if (a >= 0.90) return { text: ar ? 'ممتاز (α≥0.90)' : 'Excellent (α≥0.90)', color: C.green };
  if (a >= 0.80) return { text: ar ? 'جيد جداً (α≥0.80)' : 'Good (α≥0.80)', color: C.teal };
  if (a >= 0.70) return { text: ar ? 'مقبول (α≥0.70)' : 'Acceptable (α≥0.70)', color: C.blue };
  if (a >= 0.60) return { text: ar ? 'مشكوك (α≥0.60)' : 'Questionable (α≥0.60)', color: C.yellow };
  return { text: ar ? 'غير مقبول (α<0.60)' : 'Unacceptable (α<0.60)', color: C.red };
}

function CronbachAlpha({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('');
  const [hasHeader, setHasHeader] = useState(true);

  const { items, matrix } = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim()).map(l => l.split(/[,;\t]/).map(v => v.trim()));
    if (lines.length < 4) return { items: [] as string[], matrix: [] as number[][] };
    let hdr: string[], dataRows: string[][];
    if (hasHeader) { hdr = lines[0].map((h, i) => h || `F${i + 1}`); dataRows = lines.slice(1); }
    else { hdr = lines[0].map((_, i) => `F${i + 1}`); dataRows = lines; }
    const mat: number[][] = [];
    for (const row of dataRows) {
      const vals = row.map(v => parseFloat(v));
      if (vals.length >= 2 && vals.every(v => !isNaN(v))) mat.push(vals);
    }
    if (mat.length < 3) return { items: [] as string[], matrix: [] as number[][] };
    const cols = mat[0].length;
    return { items: hdr.slice(0, cols), matrix: mat.map(r => r.slice(0, cols)) };
  }, [raw, hasHeader]);

  const result = useMemo(() => {
    const n = matrix.length, k = items.length;
    if (n < 3 || k < 2) return null;
    const totals = matrix.map(row => row.reduce((s, v) => s + v, 0));
    const totalMean = avg(totals);
    const totalVar = totals.reduce((s, t) => s + (t - totalMean) ** 2, 0) / (n - 1);
    if (totalVar === 0) return null;
    const itemMeans = items.map((_, j) => avg(matrix.map(row => row[j])));
    const itemVars = items.map((_, j) => {
      const m = itemMeans[j];
      return matrix.reduce((s, row) => s + (row[j] - m) ** 2, 0) / (n - 1);
    });
    const sumItemVars = itemVars.reduce((s, v) => s + v, 0);
    const alpha = r2((k / (k - 1)) * (1 - sumItemVars / totalVar));

    const itemStats = items.map((name, j) => {
      const itemVals = matrix.map(row => row[j]);
      const restScores = matrix.map((row, ri) => totals[ri] - row[j]);
      const corr = r2(pearson(itemVals, restScores));
      // Alpha-if-deleted
      const remVars = itemVars.filter((_, i) => i !== j);
      const remTotals = matrix.map(row => row.reduce((s, v, i) => i !== j ? s + v : s, 0));
      const remTotalMean = avg(remTotals);
      const remTotalVar = remTotals.reduce((s, t) => s + (t - remTotalMean) ** 2, 0) / (n - 1);
      const remSumVars = remVars.reduce((s, v) => s + v, 0);
      const km1 = k - 1;
      const aid = r2(km1 > 1 && remTotalVar > 0 ? (km1 / (km1 - 1)) * (1 - remSumVars / remTotalVar) : 0);
      return { name, mean: r2(itemMeans[j]), sd: r2(Math.sqrt(itemVars[j])), corr, aid };
    });

    return { alpha, k, n, totalVar: r2(totalVar), sumItemVars: r2(sumItemVars), itemStats };
  }, [matrix, items]);

  const corrData = result ? result.itemStats.map(s => ({ name: s.name.length > 8 ? s.name.slice(0, 8) + '…' : s.name, corr: s.corr, aid: s.aid })) : [];

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, cursor: 'pointer', marginBottom: 6 }}>
          <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
          {ar ? 'الصف الأول = أسماء الفقرات' : 'First row = item names'}
        </label>
        <p style={{ fontSize: 11, color: C.sub, margin: '0 0 4px' }}>
          {ar ? 'CSV: كل عمود = فقرة (بند)، كل صف = مستجيب — القيم رقمية فقط' : 'CSV: each column = item, each row = respondent — numeric values only'}
        </p>
        <TA value={raw} onChange={setRaw} rows={6}
          placeholder={ar
            ? 'ف1,ف2,ف3,ف4,ف5\n4,3,4,5,4\n3,3,3,4,3\n5,4,5,5,5\n2,2,3,2,3\n4,4,4,3,4\n3,3,4,4,3'
            : 'I1,I2,I3,I4,I5\n4,3,4,5,4\n3,3,3,4,3\n5,4,5,5,5\n2,2,3,2,3\n4,4,4,3,4\n3,3,4,4,3'} />
      </div>

      {!result && items.length === 0 && <p style={{ textAlign: 'center', color: C.sub, fontSize: 13, padding: '24px 0' }}>{ar ? 'أدخل بيانات فقرات المقياس (3 مستجيبين على الأقل و2 فقرة)' : 'Enter scale item data (at least 3 respondents and 2 items)'}</p>}
      {items.length > 0 && !result && <p style={{ textAlign: 'center', color: C.red, fontSize: 13, padding: '12px 0' }}>{ar ? 'تحقق من البيانات — يجب أن تكون جميع القيم أرقاماً' : 'Check data — all values must be numeric'}</p>}

      {result && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${alphaLabel(result.alpha, ar).color}18`, border: `2px solid ${alphaLabel(result.alpha, ar).color}55`, borderRadius: 14, padding: '12px 20px' }}>
              <span style={{ fontSize: 13, color: C.sub }}>α Cronbach</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: alphaLabel(result.alpha, ar).color }}>{result.alpha}</span>
            </div>
            {[
              { l: ar ? 'الفقرات' : 'Items (k)', v: result.k, color: C.blue },
              { l: ar ? 'المستجيبون' : 'Respondents (n)', v: result.n, color: C.sub },
              { l: ar ? 'تباين المجموع' : 'Total Var.', v: result.totalVar, color: C.purple },
              { l: ar ? 'مجموع تباين الفقرات' : 'Sum Item Var.', v: result.sumItemVars, color: C.sub },
            ].map(s => <Pill key={s.l} label={s.l} value={s.v} color={s.color} />)}
            <div style={{ display: 'flex', alignItems: 'center', background: `${alphaLabel(result.alpha, ar).color}15`, border: `1px solid ${alphaLabel(result.alpha, ar).color}33`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: alphaLabel(result.alpha, ar).color }}>
              {alphaLabel(result.alpha, ar).text}
            </div>
          </div>

          {/* Item statistics table */}
          <div style={{ overflowX: 'auto', marginBottom: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                  {[ar ? 'الفقرة' : 'Item', ar ? 'المتوسط' : 'Mean', ar ? 'الانحراف' : 'SD',
                    ar ? 'ارتباط الفقرة بالكلي المصحَّح' : 'Corrected Item-Total r',
                    ar ? 'α عند حذف الفقرة' : 'α if Item Deleted'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'center', color: C.gold, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.itemStats.map((s, i) => {
                  const corrColor = s.corr >= 0.4 ? C.green : s.corr >= 0.3 ? C.teal : s.corr >= 0.2 ? C.yellow : C.red;
                  const aidColor = s.aid > result.alpha ? C.red : C.green;
                  return (
                    <tr key={s.name} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 700, color: C.gold }}>{s.name}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>{s.mean}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', color: C.sub }}>{s.sd}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <span style={{ background: `${corrColor}15`, color: corrColor, borderRadius: 6, padding: '2px 12px', fontWeight: 700 }}>{s.corr}</span>
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <span style={{ color: aidColor, fontWeight: 700 }}>{s.aid}</span>
                        {s.aid > result.alpha && <span style={{ fontSize: 10, color: C.red, marginInlineStart: 4 }}>▲ {ar ? 'يرفع α' : 'raises α'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Correlation bar chart */}
          <ChartCard title={`📊 ${ar ? 'ارتباط كل فقرة بالمقياس الكلي (المصحَّح)' : 'Corrected Item-Total Correlations'}`}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={corrData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 10 }} />
                <YAxis domain={[-0.2, 1]} tick={{ fill: C.sub, fontSize: 9 }} />
                <Tooltip {...TT} formatter={(v: number, name: string) => [v, name === 'corr' ? (ar ? 'ارتباط الفقرة' : 'Item-Total r') : (ar ? 'α عند الحذف' : 'α if Deleted')]} />
                <ReferenceLine y={0.3} stroke={C.yellow} strokeDasharray="4 2" label={{ value: '0.3', fill: C.yellow, fontSize: 9 }} />
                <Bar dataKey="corr" name="corr" radius={[4, 4, 0, 0]}>
                  {corrData.map((d, i) => <Cell key={i} fill={d.corr >= 0.3 ? C.teal : C.red} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Interpretation guide */}
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([['≥0.90', ar ? 'ممتاز' : 'Excellent', C.green], ['≥0.80', ar ? 'جيد جداً' : 'Good', C.teal], ['≥0.70', ar ? 'مقبول' : 'Acceptable', C.blue], ['≥0.60', ar ? 'مشكوك' : 'Questionable', C.yellow], ['<0.60', ar ? 'مشكلة' : 'Unacceptable', C.red]] as [string, string, string][]).map(([range, label, color]) => (
              <span key={range} style={{ fontSize: 11, color, background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 8, padding: '4px 10px' }}>{range}: {label}</span>
            ))}
            <span style={{ fontSize: 11, color: C.muted, marginInlineStart: 'auto' }}>
              {ar ? '· ارتباط الفقرة بالكلي ≥0.3 مقبول · الفقرات التي ترفع α عند حذفها يُنصح بمراجعتها' : '· Item-total r ≥0.3 acceptable · items raising α if deleted should be reviewed'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── MEDIATION ANALYSIS (Baron & Kenny + Sobel) ────────────────────────────
function olsWithSE(X: number[][], Y: number[]) {
  const Xt = matT(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInv(XtX);
  if (!XtXinv) {
    const z = X[0].map(() => 0);
    return { beta: z, se: z, tv: z, pv: z.map(() => 1), R2: 0, dof: 0 };
  }
  const XtY = matMul(Xt, Y.map(yi => [yi]));
  const beta = matMul(XtXinv, XtY).map(row => row[0]);
  const yhat = X.map(row => row.reduce((s, xi, j) => s + xi * beta[j], 0));
  const res = Y.map((yi, i) => yi - yhat[i]);
  const SSE = res.reduce((s, ri) => s + ri * ri, 0);
  const dof = Y.length - beta.length;
  const MSE = SSE / Math.max(1, dof);
  const se = XtXinv.map((row, j) => Math.sqrt(Math.max(0, MSE * row[j])));
  const tv = beta.map((b, j) => b / Math.max(1e-10, se[j]));
  const pv = tv.map(ti => 2 * (1 - normalCDF(Math.abs(ti))));
  const Stot = Y.reduce((s, yi) => s + (yi - avg(Y)) ** 2, 0);
  const R2 = Math.max(0, 1 - SSE / Math.max(1e-10, Stot));
  return { beta, se, tv, pv, R2, dof };
}

function MediationAnalysis({ ar }: { ar: boolean }) {
  const [xRaw, setXRaw] = useState('2 3 4 5 6 3 4 5 6 7 4 5 6 7 8');
  const [mRaw, setMRaw] = useState('3 4 5 6 7 4 5 6 7 8 5 6 7 8 9');
  const [yRaw, setYRaw] = useState('55 62 68 75 82 60 67 74 81 88 65 72 79 86 93');

  const parse = (s: string) => s.split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));

  const res = useMemo(() => {
    const xv = parse(xRaw), mv = parse(mRaw), yv = parse(yRaw);
    const n = Math.min(xv.length, mv.length, yv.length);
    if (n < 5) return null;
    const x = xv.slice(0, n), m = mv.slice(0, n), y = yv.slice(0, n);

    const s1 = olsWithSE(x.map(xi => [1, xi]), y);       // Y ~ X  → c (total)
    const s2 = olsWithSE(x.map(xi => [1, xi]), m);       // M ~ X  → a
    const s3 = olsWithSE(x.map((xi, i) => [1, xi, m[i]]), y); // Y ~ X+M → c', b

    const a = s2.beta[1], SE_a = s2.se[1], t_a = s2.tv[1], p_a = s2.pv[1];
    const b = s3.beta[2], SE_b = s3.se[2], t_b = s3.tv[2], p_b = s3.pv[2];
    const c  = s1.beta[1], t_c  = s1.tv[1], p_c  = s1.pv[1];
    const cp = s3.beta[1], t_cp = s3.tv[1], p_cp = s3.pv[1];

    const indirect = a * b;
    const sobelSE  = Math.sqrt(b * b * SE_a * SE_a + a * a * SE_b * SE_b);
    const sobelZ   = indirect / Math.max(1e-12, sobelSE);
    const sobelP   = 2 * (1 - normalCDF(Math.abs(sobelZ)));
    const propMed  = Math.abs(c) > 1e-10 ? indirect / c : 0;

    return { a, SE_a, t_a, p_a, b, SE_b, t_b, p_b, c, t_c, p_c, cp, t_cp, p_cp, indirect, sobelSE, sobelZ, sobelP, propMed, R2_1: s1.R2, R2_2: s2.R2, R2_3: s3.R2, n, dof1: s1.dof, dof3: s3.dof };
  }, [xRaw, mRaw, yRaw]);

  const pF  = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const sig = (p: number) => p < 0.05;
  const SB  = ({ label, val, color }: { label: string; val: string; color?: string }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', textAlign: 'center', minWidth: 88 }}>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color ?? C.text }}>{val}</div>
    </div>
  );
  const Sig = ({ p }: { p: number }) => (
    <span style={{ fontSize: 11, fontWeight: 700, color: sig(p) ? C.green : C.red }}>
      {sig(p) ? '✓' : '✗'} p = {pF(p)}
    </span>
  );

  return (
    <div>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: ar ? 'X — المتغير المستقل' : 'X — Independent Variable', val: xRaw, set: setXRaw },
          { label: ar ? 'M — الوسيط (Mediator)' : 'M — Mediator Variable', val: mRaw, set: setMRaw },
          { label: ar ? 'Y — المتغير التابع' : 'Y — Dependent Variable',   val: yRaw, set: setYRaw },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{label}</label>
            <textarea rows={3} value={val} onChange={e => set(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

      {!res && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 5 قيم على الأقل في كل متغير' : 'At least 5 values per variable required'}</p>}

      {res && (
        <>
          {/* Path diagram */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 14 }}>{ar ? 'مخطط المسار — Baron & Kenny' : 'Path Diagram — Baron & Kenny'}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', rowGap: 8 }}>
              {/* X box */}
              <div style={{ background: 'rgba(147,197,253,0.12)', border: `2px solid ${C.blue}40`, borderRadius: 10, padding: '10px 18px', fontWeight: 800, color: C.blue, fontSize: 15 }}>X</div>
              {/* X→M→Y top path */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px' }}>
                <div style={{ fontSize: 10, color: C.teal, marginBottom: 2 }}>a = {res.a.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: sig(res.p_a) ? C.green : C.red }}>{sig(res.p_a) ? '✓' : '✗'} sig.</div>
              </div>
              <div style={{ background: 'rgba(94,234,212,0.12)', border: `2px solid ${C.teal}40`, borderRadius: 10, padding: '10px 18px', fontWeight: 800, color: C.teal, fontSize: 15 }}>M</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px' }}>
                <div style={{ fontSize: 10, color: C.teal, marginBottom: 2 }}>b = {res.b.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: sig(res.p_b) ? C.green : C.red }}>{sig(res.p_b) ? '✓' : '✗'} sig.</div>
              </div>
              <div style={{ background: 'rgba(201,168,76,0.12)', border: `2px solid ${C.gold}40`, borderRadius: 10, padding: '10px 18px', fontWeight: 800, color: C.gold, fontSize: 15 }}>Y</div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: C.sub }}>
              {ar ? `الأثر الكلي: c = ${res.c.toFixed(3)} · الأثر المباشر: c' = ${res.cp.toFixed(3)} · الأثر غير المباشر: a×b = ${res.indirect.toFixed(3)}`
                  : `Total c = ${res.c.toFixed(3)} · Direct c' = ${res.cp.toFixed(3)} · Indirect a×b = ${res.indirect.toFixed(3)}`}
            </div>
          </div>

          {/* Baron & Kenny Steps */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'خطوات Baron & Kenny' : 'Baron & Kenny Steps'}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'الخطوة' : 'Step', ar ? 'النموذج' : 'Model', 'β', 't', 'p', ar ? 'الاشتراط' : 'Required'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: ar ? 'right' : 'left', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { step: '1', model: 'Y ~ X', coef: res.c,  t: res.t_c,  p: res.p_c,  req: ar ? 'دال (c)' : 'Sig. (c)' },
                  { step: '2', model: 'M ~ X', coef: res.a,  t: res.t_a,  p: res.p_a,  req: ar ? 'دال (a)' : 'Sig. (a)' },
                  { step: '3a', model: 'Y ~ X+M (M)', coef: res.b,  t: res.t_b,  p: res.p_b,  req: ar ? 'دال (b)' : 'Sig. (b)' },
                  { step: "3b", model: "Y ~ X+M (X = c')", coef: res.cp, t: res.t_cp, p: res.p_cp, req: ar ? 'أصغر من c' : '< c (mediation)' },
                ].map(({ step, model, coef, t, p, req }) => (
                  <tr key={step} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: C.blue }}>{step}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: C.text }}>{model}</td>
                    <td style={{ padding: '8px 12px', color: C.text }}>{coef.toFixed(3)}</td>
                    <td style={{ padding: '8px 12px', color: C.sub }}>{t.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px' }}><Sig p={p} /></td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{req}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Indirect effect + Sobel */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <SB label={ar ? 'الأثر غير المباشر (a×b)' : 'Indirect effect (a×b)'} val={res.indirect.toFixed(4)} color={C.purple} />
            <SB label="SE (Sobel)" val={res.sobelSE.toFixed(4)} />
            <SB label="z (Sobel)" val={res.sobelZ.toFixed(3)} />
            <SB label="p (Sobel)" val={pF(res.sobelP)} color={sig(res.sobelP) ? C.green : C.red} />
            <SB label={ar ? 'نسبة الوساطة' : 'Proportion mediated'} val={`${(Math.abs(res.propMed) * 100).toFixed(1)}%`} color={C.gold} />
          </div>

          {/* APA text */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.blue, marginBottom: 8 }}>APA (English)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
              {`The indirect effect was ${res.indirect.toFixed(3)} (SE = ${res.sobelSE.toFixed(3)}, z = ${res.sobelZ.toFixed(2)}, p ${res.sobelP < 0.001 ? '< .001' : `= ${res.sobelP.toFixed(3)}`}).`}
              <br/>
              {`The total effect of X on Y was significant, c = ${res.c.toFixed(3)}, t(${res.dof1}) = ${res.t_c.toFixed(2)}, p ${res.p_c < 0.001 ? '< .001' : `= ${res.p_c.toFixed(3)}`}.`}
              <br/>
              {`After controlling for M, the direct effect was c' = ${res.cp.toFixed(3)}, t(${res.dof3}) = ${res.t_cp.toFixed(2)}, p ${res.p_cp < 0.001 ? '< .001' : `= ${res.p_cp.toFixed(3)}`}.`}
            </div>
          </div>

          {/* Mediation type */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(196,181,253,0.08)', border: `1px solid rgba(196,181,253,0.3)`, fontSize: 13 }}>
            <strong style={{ color: C.purple }}>{ar ? 'نوع الوساطة: ' : 'Mediation type: '}</strong>
            <span style={{ color: C.text }}>
              {!sig(res.p_c) ? (ar ? 'لا يوجد أثر كلي دال (لا وساطة)' : 'No significant total effect (no mediation)')
               : sig(res.sobelP) && !sig(res.p_cp) ? (ar ? 'وساطة كاملة (Full Mediation)' : 'Full Mediation')
               : sig(res.sobelP) && sig(res.p_cp)  ? (ar ? 'وساطة جزئية (Partial Mediation)' : 'Partial Mediation')
               : (ar ? 'لا دليل على وساطة' : 'No evidence of mediation')}
            </span>
          </div>

          <p style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 0 }}>
            {ar ? '* يُنصح بـ bootstrapping (5000 مكرر) للتحقق من الأثر غير المباشر في برامج متخصصة (PROCESS/JASP) · اختبار Sobel حساس لتوزيع البيانات'
                : '* Bootstrapping (5000 iterations) is preferred to confirm indirect effects — use PROCESS/JASP for published work · Sobel test assumes normality'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── CONFIDENCE INTERVAL CALCULATOR ───────────────────────────────────────
function CICalc({ ar }: { ar: boolean }) {
  const [mode, setMode] = useState<'mean'|'prop'|'diff'|'pearson'>('mean');
  // mean
  const [mStr, setMStr] = useState('72.4'); const [sStr, setSStr] = useState('10.8'); const [nStr, setNStr] = useState('45');
  // proportion
  const [xStr, setXStr] = useState('34'); const [nPStr, setNPStr] = useState('80');
  // diff of means
  const [m1S, setM1S] = useState('68.2'); const [s1S, setS1S] = useState('9.4'); const [n1S, setN1S] = useState('40');
  const [m2S, setM2S] = useState('73.8'); const [s2S, setS2S] = useState('10.2'); const [n2S, setN2S] = useState('38');
  // pearson r
  const [rStr, setRStr] = useState('0.52'); const [nRStr, setNRStr] = useState('60');
  const [conf, setConf] = useState(95);

  const z = conf === 99 ? 2.576 : conf === 90 ? 1.645 : 1.960;

  const ci = useMemo(() => {
    if (mode === 'mean') {
      const m = parseFloat(mStr), s = parseFloat(sStr), n = parseFloat(nStr);
      if (!isFinite(m)||!isFinite(s)||!isFinite(n)||n<2||s<0) return null;
      const se = s/Math.sqrt(n), me = z*se;
      return { lo:m-me, hi:m+me, se, me, label:`M = ${m.toFixed(2)}`, unit:'', extra:`n = ${n}, SD = ${s}` };
    }
    if (mode === 'prop') {
      const x = parseFloat(xStr), n = parseFloat(nPStr);
      if (!isFinite(x)||!isFinite(n)||n<2||x<0||x>n) return null;
      const p = x/n;
      // Wilson interval
      const denom = 1 + z*z/n;
      const centre = (p + z*z/(2*n))/denom;
      const half = (z/denom)*Math.sqrt(p*(1-p)/n + z*z/(4*n*n));
      const se = Math.sqrt(p*(1-p)/n);
      return { lo:Math.max(0,centre-half), hi:Math.min(1,centre+half), se, me:half, label:`p̂ = ${(p*100).toFixed(1)}%`, unit:'', extra:`x = ${x}, n = ${n}` };
    }
    if (mode === 'diff') {
      const m1=parseFloat(m1S),s1=parseFloat(s1S),n1=parseFloat(n1S);
      const m2=parseFloat(m2S),s2=parseFloat(s2S),n2=parseFloat(n2S);
      if ([m1,s1,n1,m2,s2,n2].some(v=>!isFinite(v))||n1<2||n2<2||s1<0||s2<0) return null;
      const diff = m1-m2;
      const se = Math.sqrt(s1*s1/n1+s2*s2/n2);
      const me = z*se;
      const sp = Math.sqrt(((n1-1)*s1*s1+(n2-1)*s2*s2)/(n1+n2-2));
      const d = Math.abs(diff)/Math.max(1e-10,sp);
      return { lo:diff-me, hi:diff+me, se, me, label:`Δ = ${diff.toFixed(3)}`, unit:'', extra:`d = ${d.toFixed(3)}, Welch SE = ${se.toFixed(3)}` };
    }
    // pearson r
    const r = parseFloat(rStr), n = parseFloat(nRStr);
    if (!isFinite(r)||!isFinite(n)||n<4||Math.abs(r)>=1) return null;
    const zr = 0.5*Math.log((1+r)/(1-r));
    const se = 1/Math.sqrt(n-3);
    const lo_z = zr-z*se, hi_z = zr+z*se;
    const lo = (Math.exp(2*lo_z)-1)/(Math.exp(2*lo_z)+1);
    const hi = (Math.exp(2*hi_z)-1)/(Math.exp(2*hi_z)+1);
    return { lo, hi, se, me:z*se, label:`r = ${r.toFixed(3)}`, unit:'', extra:`Fisher z' = ${zr.toFixed(4)}, n = ${n}` };
  }, [mode, mStr, sStr, nStr, xStr, nPStr, m1S, s1S, n1S, m2S, s2S, n2S, rStr, nRStr, conf, z]);

  const fmt = (v: number) => mode==='prop' ? `${(v*100).toFixed(2)}%` : v.toFixed(4);

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {([['mean',ar?'متوسط عيّنة':'Sample Mean'],['prop',ar?'نسبة':'Proportion'],['diff',ar?'فرق متوسطين':'Diff. of Means'],['pearson',ar?'Pearson r':'Pearson r']] as const).map(([m,lbl])=>(
          <button key={m} onClick={()=>setMode(m)}
            style={{ background:mode===m?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${mode===m?C.gold:C.border}`, borderRadius:9, padding:'7px 14px', color:mode===m?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:mode===m?700:400, fontSize:13 }}>
            {lbl}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {[90,95,99].map(c=>(
            <button key={c} onClick={()=>setConf(c)}
              style={{ background:conf===c?'rgba(94,234,212,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${conf===c?C.teal:C.border}`, borderRadius:7, padding:'5px 12px', color:conf===c?C.teal:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:conf===c?700:400, fontSize:12 }}>
              {c}%
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:16 }}>
        {mode==='mean' && [
          { l:'M', v:mStr, s:setMStr }, { l:'SD', v:sStr, s:setSStr }, { l:'n', v:nStr, s:setNStr }
        ].map(({l,v,s})=>(
          <div key={l}>
            <label style={{fontSize:11,color:C.sub,display:'block',marginBottom:3}}>{l}</label>
            <input value={v} onChange={e=>s(e.target.value)} type="number" style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:14,fontWeight:700,direction:'ltr',boxSizing:'border-box'}}/>
          </div>
        ))}
        {mode==='prop' && [
          { l:ar?'عدد النجاحات x':'Successes x', v:xStr, s:setXStr }, { l:'n', v:nPStr, s:setNPStr }
        ].map(({l,v,s})=>(
          <div key={l}>
            <label style={{fontSize:11,color:C.sub,display:'block',marginBottom:3}}>{l}</label>
            <input value={v} onChange={e=>s(e.target.value)} type="number" style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:14,fontWeight:700,direction:'ltr',boxSizing:'border-box'}}/>
          </div>
        ))}
        {mode==='diff' && [
          { l:'M₁', v:m1S, s:setM1S }, { l:'SD₁', v:s1S, s:setS1S }, { l:'n₁', v:n1S, s:setN1S },
          { l:'M₂', v:m2S, s:setM2S }, { l:'SD₂', v:s2S, s:setS2S }, { l:'n₂', v:n2S, s:setN2S }
        ].map(({l,v,s})=>(
          <div key={l}>
            <label style={{fontSize:11,color:C.sub,display:'block',marginBottom:3}}>{l}</label>
            <input value={v} onChange={e=>s(e.target.value)} type="number" style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:14,fontWeight:700,direction:'ltr',boxSizing:'border-box'}}/>
          </div>
        ))}
        {mode==='pearson' && [
          { l:'r', v:rStr, s:setRStr }, { l:'n', v:nRStr, s:setNRStr }
        ].map(({l,v,s})=>(
          <div key={l}>
            <label style={{fontSize:11,color:C.sub,display:'block',marginBottom:3}}>{l}</label>
            <input value={v} onChange={e=>s(e.target.value)} type="number" step="0.001" min="-1" max="1" style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',color:C.text,fontSize:14,fontWeight:700,direction:'ltr',boxSizing:'border-box'}}/>
          </div>
        ))}
      </div>

      {ci && (
        <>
          {/* Visual CI strip */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 24px', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.gold, marginBottom:16 }}>
              {conf}% {ar?'فترة الثقة':'Confidence Interval'} — {ci.label}
            </div>
            <div style={{ position:'relative', height:36, marginBottom:12 }}>
              <div style={{ position:'absolute', top:'50%', left:'5%', right:'5%', height:4, background:'rgba(255,255,255,0.08)', borderRadius:4, transform:'translateY(-50%)' }}/>
              {(() => {
                const range = ci.hi - ci.lo;
                const pad = range * 0.3;
                const total = range + 2*pad;
                const loP = (pad/total*90)+5;
                const hiP = ((pad+range)/total*90)+5;
                const midP = (loP+hiP)/2;
                return <>
                  <div style={{ position:'absolute', top:'50%', left:`${loP}%`, right:`${100-hiP}%`, height:8, background:`${C.blue}66`, borderRadius:4, transform:'translateY(-50%)' }}/>
                  <div style={{ position:'absolute', top:'50%', left:`${loP}%`, width:3, height:20, background:C.blue, borderRadius:2, transform:'translate(-50%,-50%)' }}/>
                  <div style={{ position:'absolute', top:'50%', left:`${hiP}%`, width:3, height:20, background:C.blue, borderRadius:2, transform:'translate(-50%,-50%)' }}/>
                  <div style={{ position:'absolute', top:'50%', left:`${midP}%`, width:8, height:8, background:C.gold, borderRadius:'50%', transform:'translate(-50%,-50%)' }}/>
                  <div style={{ position:'absolute', top:'-2px', left:`${loP}%`, transform:'translateX(-50%)', fontSize:11, color:C.blue }}>{fmt(ci.lo)}</div>
                  <div style={{ position:'absolute', bottom:'-2px', left:`${midP}%`, transform:'translateX(-50%)', fontSize:11, color:C.gold, fontWeight:700 }}>{ci.label}</div>
                  <div style={{ position:'absolute', top:'-2px', left:`${hiP}%`, transform:'translateX(-50%)', fontSize:11, color:C.blue }}>{fmt(ci.hi)}</div>
                </>;
              })()}
            </div>
            <div style={{ display:'flex', gap:16, fontSize:12, color:C.sub, marginTop:20 }}>
              <span>{ar?'الحد الأدنى':'Lower'}: <strong style={{color:C.text}}>{fmt(ci.lo)}</strong></span>
              <span>{ar?'الحد الأعلى':'Upper'}: <strong style={{color:C.text}}>{fmt(ci.hi)}</strong></span>
              <span>SE: <strong style={{color:C.text}}>{ci.se.toFixed(4)}</strong></span>
              <span>ME: <strong style={{color:C.text}}>±{fmt(ci.me)}</strong></span>
            </div>
            {ci.extra && <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>{ci.extra}</div>}
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 16px', fontSize:12, color:C.sub }}>
            <strong style={{ color:C.gold }}>APA: </strong>
            {ci.label}, {conf}% CI [{fmt(ci.lo)}, {fmt(ci.hi)}]
            {mode==='prop' && <span style={{color:C.muted}}> {ar?'(Wilson interval)':'(Wilson interval)'}</span>}
            {mode==='pearson' && <span style={{color:C.muted}}> {ar?'(تحويل Fisher z)':'(Fisher z transformation)'}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── PARTIAL CORRELATION MATRIX ────────────────────────────────────────────
function PartialCorr({ ar }: { ar: boolean }) {
  const DEF = `gpa,study,anxiety,motivation,score
3.8,22,2.1,4.2,88
3.2,18,3.4,3.6,76
2.9,14,4.1,2.8,65
3.6,20,2.5,4.0,84
3.0,16,3.8,3.1,70
3.9,24,1.9,4.5,92
3.4,19,3.0,3.7,79
2.7,13,4.5,2.6,62
3.7,21,2.3,4.1,87
3.1,17,3.6,3.3,72
3.5,20,2.7,3.9,81
3.3,18,3.1,3.5,75
3.8,23,2.0,4.3,89
2.8,15,4.2,2.9,67
3.6,21,2.4,4.0,85`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const varNames = hasHeader ? firstCells.map(h => h.trim()) : Array.from({ length: firstCells.length }, (_, i) => `V${i + 1}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.trim().split(sep).map(v => parseFloat(v.trim())).filter(v => isFinite(v)));
    const k = Math.min(...data.map(r => r.length), varNames.length);
    if (k < 2 || data.length < k + 2) return null;
    const n = data.length;
    const D = data.map(r => r.slice(0, k));

    // Pearson correlation matrix
    const R: number[][] = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => {
        if (i === j) return 1;
        const xi = D.map(r => r[i]), xj = D.map(r => r[j]);
        return pearson(xi, xj);
      }));

    // Helper functions (always defined)
    const df = n - k;
    const tStat = (rp: number) => rp * Math.sqrt(df) / Math.sqrt(Math.max(1e-10, 1 - rp * rp));
    const pVal = (rp: number) => 2 * (1 - normalCDF(Math.abs(tStat(rp))));
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const stars = (p: number) => p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
    const colorR = (r: number) => r >= 0.5 ? C.teal : r >= 0.3 ? C.blue : r >= 0 ? C.sub : r >= -0.3 ? '#f97316' : C.red;

    // Invert R for partial correlations
    const Rinv = matInv(R);
    if (!Rinv) return { n, k, varNames, R, Rp: null, df, tStat, pVal, pFmt, stars, colorR };

    const Rp: number[][] = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => {
        if (i === j) return 1;
        return -Rinv[i][j] / Math.sqrt(Math.abs(Rinv[i][i] * Rinv[j][j]));
      }));

    return { n, k, varNames, R, Rp, df, tStat, pVal, pFmt, stars, colorR };
  }, [raw]);

  const [view, setView] = useState<'partial'|'pearson'>('partial');
  const [copyMsg, setCopyMsg] = useState('');

  const copyTSV = () => {
    if (!result?.Rp) return;
    const M = view === 'partial' ? result.Rp : result.R;
    const header = ['', ...result.varNames].join('\t');
    const rows = result.varNames.map((v, i) => [v, ...M[i].map(r => r.toFixed(4))].join('\t'));
    navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => { setCopyMsg(ar?'تم النسخ':'Copied!'); setTimeout(()=>setCopyMsg(''),1800); });
  };

  const matToShow = view === 'partial' ? result?.Rp : result?.R;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['partial',ar?'ارتباط جزئي':'Partial r'],['pearson',ar?'Pearson r (عادي)':'Pearson r (zero-order)']] as const).map(([m,lbl])=>(
          <button key={m} onClick={()=>setView(m)}
            style={{ background:view===m?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${view===m?C.gold:C.border}`, borderRadius:9, padding:'7px 14px', color:view===m?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:view===m?700:400, fontSize:12 }}>
            {lbl}
          </button>
        ))}
        <button onClick={copyTSV} style={{ marginLeft:'auto', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.sub, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>
          {copyMsg || (ar?'نسخ TSV':'Copy TSV')}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'البيانات — السطر الأول: أسماء المتغيرات (اختياري) · يدعم CSV/Tab':'Data — first row: variable names (optional) · CSV/tab supported'}
        </label>
        <textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={7}
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 12px', color:C.text, fontSize:11, fontFamily:'monospace', direction:'ltr', resize:'vertical', boxSizing:'border-box' }}/>
      </div>

      {!result && <p style={{color:C.muted,fontSize:13}}>{ar?'يلزم ≥ 5 صفوف و ≥ 2 أعمدة':'Need ≥ 5 rows and ≥ 2 columns'}</p>}

      {result && matToShow && (
        <>
          <div style={{ fontSize:11, color:C.sub, marginBottom:8 }}>
            n = {result.n}, k = {result.k} {ar?'متغيرات':'variables'}, df = {result.df}
            {view==='partial' && <span style={{color:C.muted}}> · {ar?'كل ارتباط يضبط جميع المتغيرات الأخرى':'each r controls for all other variables'}</span>}
          </div>
          <div style={{ overflowX:'auto', background:C.card, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:12 }}>
            <table style={{ borderCollapse:'collapse', fontSize:11, minWidth:'100%' }}>
              <thead><tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ padding:'8px 12px', color:C.sub, textAlign:'left' }}>—</th>
                {result.varNames.map(v=><th key={v} style={{ padding:'8px 12px', color:C.gold, fontWeight:700, whiteSpace:'nowrap' }}>{v}</th>)}
              </tr></thead>
              <tbody>
                {result.varNames.map((vi, i) => (
                  <tr key={vi} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'6px 12px', fontWeight:700, color:C.gold, whiteSpace:'nowrap' }}>{vi}</td>
                    {matToShow[i].map((r, j) => {
                      const p = i === j ? 1 : result.pVal(r);
                      const s = i === j ? '' : result.stars(p);
                      return (
                        <td key={j} style={{ padding:'6px 12px', textAlign:'center', background:i===j?'rgba(255,255,255,0.04)':'transparent', fontWeight:i===j?700:400, color:i===j?C.muted:result.colorR(r) }}>
                          {i===j ? '—' : <>{r.toFixed(3)}<sup style={{color:C.gold}}>{s}</sup><br/><span style={{fontSize:9,color:C.muted}}>{result.pFmt(p)}</span></>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize:11, color:C.muted }}>* p&lt;.05 · ** p&lt;.01 · *** p&lt;.001</div>
        </>
      )}

      {result && !result.Rp && (
        <p style={{ color:C.red, fontSize:13 }}>{ar?'مصفوفة الارتباط غير قابلة للعكس (تحقق من التعدد الخطي أو أزل متغيرات متطابقة)':'Correlation matrix is singular — check for multicollinearity or duplicate variables'}</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── LOGISTIC REGRESSION ───────────────────────────────────────────────────
// ── module-level helpers for exact tests ─────────────────────────────────
function lgammaApprox(n: number): number {
  if (n <= 0) return Infinity;
  if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - lgammaApprox(1 - n);
  const x = n - 1;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let s = c[0]; for (let i = 1; i < 9; i++) s += c[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}
function logBinomCoef(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lgammaApprox(n + 1) - lgammaApprox(k + 1) - lgammaApprox(n - k + 1);
}

// ════════════════════════════════════════════════════════════════════════════
// ── REPEATED MEASURES ANOVA ───────────────────────────────────────────────
function RMAnova({ ar }: { ar: boolean }) {
  const DEF = `Sub,Pre,Post,Followup
1,68,75,78
2,72,80,82
3,65,70,73
4,71,79,81
5,67,74,76
6,73,81,84
7,69,76,79
8,74,82,85
9,66,73,75
10,70,78,80
11,76,84,87
12,68,75,77`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 4) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const allNames = hasHeader ? firstCells.map(h => h.trim()) : Array.from({ length: firstCells.length }, (_, i) => `C${i + 1}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.trim().split(sep).map(v => parseFloat(v.trim())).filter(v => isFinite(v)));

    const isSubjCol = ['sub', 'id', 'subject', 'subj', 'participant'].some(s => allNames[0]?.toLowerCase().includes(s));
    const condNames = isSubjCol ? allNames.slice(1) : allNames;
    const D = isSubjCol ? data.map(r => r.slice(1)) : data;

    const n = D.length, k = Math.min(...D.map(r => r.length), condNames.length);
    if (n < 3 || k < 2) return null;
    const Dat = D.map(r => r.slice(0, k));
    const cN = condNames.slice(0, k);

    const grandMean = avg(Dat.flat());
    const subMeans = Dat.map(row => avg(row));
    const condMeans = Array.from({ length: k }, (_, j) => avg(Dat.map(r => r[j])));
    const SS_total = Dat.flat().reduce((s, x) => s + (x - grandMean) ** 2, 0);
    const SS_subj = k * subMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
    const SS_cond = n * condMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
    const SS_err = SS_total - SS_subj - SS_cond;
    const df_c = k - 1, df_e = (n - 1) * (k - 1);
    const MS_c = SS_cond / df_c, MS_e = SS_err / Math.max(1, df_e);
    const F = MS_c / Math.max(1e-10, MS_e);
    const pv = 1 - chiSqP(F * df_c, df_c);
    const eta2 = SS_cond / SS_total;
    const partial_eta2 = SS_cond / (SS_cond + SS_err);

    // GG epsilon from covariance matrix
    const S: number[][] = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => {
        const mi = condMeans[i], mj = condMeans[j];
        return Dat.reduce((s, r) => s + (r[i] - mi) * (r[j] - mj), 0) / (n - 1);
      }));
    const rMs = S.map(row => avg(row));
    const cMs = Array.from({ length: k }, (_, j) => avg(S.map(r => r[j])));
    const gS = avg(S.flat());
    const St = S.map((row, i) => row.map((v, j) => v - rMs[i] - cMs[j] + gS));
    const trSq = St.reduce((s, row, i) => s + row[i], 0) ** 2;
    const sumSq = St.flat().reduce((s, v) => s + v * v, 0);
    const eps = Math.min(1, Math.max(1 / (k - 1), sumSq > 0 ? trSq / ((k - 1) * sumSq) : 1));
    const pv_GG = 1 - chiSqP(F * df_c * eps, df_c * eps);

    // Post-hoc pairwise t-tests Bonferroni
    const nP = (k * (k - 1)) / 2;
    const pairs: { c1: string; c2: string; diff: number; t: number; df: number; p: number; p_bonf: number }[] = [];
    for (let i = 0; i < k - 1; i++) for (let j = i + 1; j < k; j++) {
      const diffs = Dat.map(r => r[i] - r[j]);
      const m = avg(diffs);
      const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - m) ** 2, 0) / (n - 1));
      const se = sd / Math.sqrt(n);
      const t = m / Math.max(1e-10, se);
      const p = 2 * (1 - normalCDF(Math.abs(t)));
      pairs.push({ c1: cN[i], c2: cN[j], diff: m, t, df: n - 1, p, p_bonf: Math.min(1, p * nP) });
    }

    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const stars = (p: number) => p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
    const chartData = cN.map((name, j) => ({ name, mean: +condMeans[j].toFixed(3), se: +(Math.sqrt(S[j][j] / n)).toFixed(3) }));
    return { n, k, cN, condMeans, SS_subj, SS_cond, SS_err, SS_total, df_c, df_e, MS_c, MS_e, F, pv, eta2, partial_eta2, eps, pv_GG, pairs, pFmt, stars, chartData };
  }, [raw]);

  const pC = (p: number) => p < 0.05 ? C.green : C.red;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'كل صف = مشارك · كل عمود = شرط/وقت · السطر الأول: أسماء الشروط (اختياري) · العمود الأول يمكن أن يكون رقم المشارك'
            : 'Each row = subject · each column = condition/time · first row: names (optional) · first col may be subject ID'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم ≥ 3 مشاركين وشرطان على الأقل' : 'Need ≥ 3 subjects and ≥ 2 conditions'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { l: `F(${result.df_c},${result.df_e})`, v: result.F.toFixed(3), c: C.text },
              { l: 'p (spheric.)', v: result.pFmt(result.pv), c: pC(result.pv) },
              { l: `p (GG ε=${result.eps.toFixed(3)})`, v: result.pFmt(result.pv_GG), c: pC(result.pv_GG) },
              { l: 'η²', v: result.eta2.toFixed(4), c: result.eta2 >= 0.14 ? C.green : result.eta2 >= 0.06 ? C.gold : C.teal },
              { l: 'Partial η²', v: result.partial_eta2.toFixed(4), c: C.sub },
              { l: 'n', v: String(result.n) }, { l: 'k', v: String(result.k) },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 82 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c ?? C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* ANOVA table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '8px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? 'جدول تحليل التباين (مقاييس متكررة)' : 'One-Way Repeated Measures ANOVA Table'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'المصدر' : 'Source', 'SS', 'df', 'MS', 'F', 'p'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { src: ar ? 'بين المشاركين' : 'Between Subjects', ss: result.SS_subj, df: result.n - 1, ms: null, f: null, p: null },
                  { src: ar ? 'الشروط (داخل)' : 'Condition (Within)', ss: result.SS_cond, df: result.df_c, ms: result.MS_c, f: result.F, p: result.pv },
                  { src: ar ? 'الخطأ' : 'Error', ss: result.SS_err, df: result.df_e, ms: result.MS_e, f: null, p: null },
                  { src: ar ? 'الكلي' : 'Total', ss: result.SS_total, df: result.n * result.k - 1, ms: null, f: null, p: null },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 3 ? 'rgba(201,168,76,0.04)' : i === 1 ? 'rgba(94,234,212,0.04)' : 'transparent' }}>
                    <td style={{ padding: '6px 10px', fontWeight: i === 3 ? 700 : i === 1 ? 700 : 400, color: i === 1 ? C.teal : i === 3 ? C.gold : C.sub }}>{row.src}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.ss.toFixed(3)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.df}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{row.ms != null ? row.ms.toFixed(3) : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text }}>{row.f != null ? row.f.toFixed(3) : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: row.p != null ? pC(row.p) : C.muted, fontWeight: row.p != null && row.p < 0.05 ? 700 : 400 }}>{row.p != null ? result.pFmt(row.p) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Condition means chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar ? 'متوسطات الشروط (±SE)' : 'Condition Means (±SE)'}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={result.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.sub }} />
                <YAxis tick={{ fontSize: 9, fill: C.sub }} width={36} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="mean" fill={C.teal} radius={6} label={{ position: 'top', fontSize: 9, fill: C.sub, formatter: (v: number) => v.toFixed(2) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Post-hoc table */}
          {result.pairs.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '8px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
                {ar ? 'مقارنات زوجية بعدية (Bonferroni)' : 'Post-Hoc Pairwise (Bonferroni corrected)'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[ar ? 'الزوج' : 'Pair', ar ? 'الفرق' : 'Diff', 't', ar ? 'p (خام)' : 'p (raw)', ar ? 'p (Bonf)' : 'p (Bonf)'].map(h => (
                    <th key={h} style={{ padding: '5px 10px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.pairs.map(row => (
                    <tr key={`${row.c1}${row.c2}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '5px 10px', color: C.text }}>{row.c1} → {row.c2}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: row.diff >= 0 ? C.teal : '#f97316', fontWeight: 700 }}>{row.diff.toFixed(3)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: C.sub }}>{row.t.toFixed(3)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: pC(row.p) }}>{result.pFmt(row.p)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: pC(row.p_bonf), fontWeight: row.p_bonf < 0.05 ? 700 : 400 }}>{result.pFmt(row.p_bonf)}<sup style={{ color: C.gold }}>{result.stars(row.p_bonf)}</sup></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `أشار تحليل التباين ذو المقاييس المتكررة إلى ${result.pv_GG < 0.05 ? 'أثر دال' : 'أثر غير دال'} للشرط، F(${(result.df_c * result.eps).toFixed(2)}, ${(result.df_e * result.eps).toFixed(2)}) = ${result.F.toFixed(2)}, p = ${result.pFmt(result.pv_GG)} (Greenhouse-Geisser ε = ${result.eps.toFixed(3)}), η² = ${result.eta2.toFixed(3)}`
              : `A one-way repeated measures ANOVA revealed a ${result.pv_GG < 0.05 ? 'significant' : 'non-significant'} effect of condition, F(${(result.df_c * result.eps).toFixed(2)}, ${(result.df_e * result.eps).toFixed(2)}) = ${result.F.toFixed(2)}, p = ${result.pFmt(result.pv_GG)} (Greenhouse-Geisser ε = ${result.eps.toFixed(3)}), η² = ${result.eta2.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── FISHER'S EXACT TEST ───────────────────────────────────────────────────
function logHypergeomPMF(k: number, K: number, N: number, n: number): number {
  return logBinomCoef(K, k) + logBinomCoef(N - K, n - k) - logBinomCoef(N, n);
}
function FisherExact({ ar }: { ar: boolean }) {
  const [aV, setAV] = useState('10'); const [bV, setBV] = useState('5');
  const [cV, setCV] = useState('3');  const [dV, setDV] = useState('12');
  const [r1, setR1] = useState(''); const [r2, setR2] = useState('');
  const [c1, setC1] = useState(''); const [c2, setC2] = useState('');

  const result = useMemo(() => {
    const a = parseInt(aV), b = parseInt(bV), c = parseInt(cV), d = parseInt(dV);
    if ([a,b,c,d].some(v => !isFinite(v) || v < 0)) return null;
    const N = a+b+c+d, K = a+c, n = a+b;
    if (N < 4) return null;
    const x_obs = a;
    const x_min = Math.max(0, n+K-N), x_max = Math.min(n, K);
    const probs: { x: number; p: number }[] = [];
    for (let x = x_min; x <= x_max; x++) {
      probs.push({ x, p: Math.exp(logHypergeomPMF(x, K, N, n)) });
    }
    const p_obs = probs.find(pr => pr.x === x_obs)?.p ?? 0;
    const p_two = Math.min(1, probs.filter(pr => pr.p <= p_obs * (1 + 1e-7)).reduce((s, pr) => s + pr.p, 0));
    const p_less = Math.min(1, probs.filter(pr => pr.x <= x_obs).reduce((s, pr) => s + pr.p, 0));
    const p_greater = Math.min(1, probs.filter(pr => pr.x >= x_obs).reduce((s, pr) => s + pr.p, 0));
    const or = (a * d) / Math.max(1, b * c);
    const logOR = Math.log(Math.max(1e-10, or));
    const se_OR = Math.sqrt(1/Math.max(1,a) + 1/Math.max(1,b) + 1/Math.max(1,c) + 1/Math.max(1,d));
    const or_lo = Math.exp(logOR - 1.96 * se_OR), or_hi = Math.exp(logOR + 1.96 * se_OR);
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(4);
    return { a,b,c,d, N, or, or_lo, or_hi, p_two, p_less, p_greater, pFmt };
  }, [aV, bV, cV, dV]);

  const cellStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', color: C.text, fontSize: 22, fontWeight: 800 as const, direction: 'ltr' as const, boxSizing: 'border-box' as const, textAlign: 'center' as const };
  const R1lbl = r1 || (ar ? 'المجموعة 1' : 'Group 1'), R2lbl = r2 || (ar ? 'المجموعة 2' : 'Group 2');
  const C1lbl = c1 || (ar ? 'النتيجة +' : 'Outcome +'), C2lbl = c2 || (ar ? 'النتيجة −' : 'Outcome −');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10, maxWidth: 400 }}>
        <div><label style={{ fontSize: 10, color: C.sub, display: 'block', marginBottom: 2 }}>{ar?'اسم الصف 1 (اختياري)':'Row 1 label (opt)'}</label><input value={r1} onChange={e=>setR1(e.target.value)} style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',color:C.sub,fontSize:11,boxSizing:'border-box' }}/></div>
        <div><label style={{ fontSize: 10, color: C.sub, display: 'block', marginBottom: 2 }}>{ar?'اسم الصف 2 (اختياري)':'Row 2 label (opt)'}</label><input value={r2} onChange={e=>setR2(e.target.value)} style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',color:C.sub,fontSize:11,boxSizing:'border-box' }}/></div>
        <div><label style={{ fontSize: 10, color: C.sub, display: 'block', marginBottom: 2 }}>{ar?'اسم العمود 1 (اختياري)':'Col 1 label (opt)'}</label><input value={c1} onChange={e=>setC1(e.target.value)} style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',color:C.sub,fontSize:11,boxSizing:'border-box' }}/></div>
        <div><label style={{ fontSize: 10, color: C.sub, display: 'block', marginBottom: 2 }}>{ar?'اسم العمود 2 (اختياري)':'Col 2 label (opt)'}</label><input value={c2} onChange={e=>setC2(e.target.value)} style={{ width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,padding:'5px 10px',color:C.sub,fontSize:11,boxSizing:'border-box' }}/></div>
      </div>

      <div style={{ marginBottom: 16, maxWidth: 360 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>
            <th style={{ padding: '6px 8px', fontSize: 11, color: C.sub }}></th>
            <th style={{ padding: '6px 8px', fontSize: 11, color: C.gold }}>{C1lbl}</th>
            <th style={{ padding: '6px 8px', fontSize: 11, color: C.gold }}>{C2lbl}</th>
          </tr></thead>
          <tbody>
            {[[R1lbl, aV, setAV, bV, setBV],[R2lbl, cV, setCV, dV, setDV]].map(([lbl, v1, s1, v2, s2]) => (
              <tr key={lbl as string}>
                <td style={{ padding: '4px 8px', fontWeight: 700, fontSize: 12, color: C.text, whiteSpace: 'nowrap' }}>{lbl as string}</td>
                <td style={{ padding: '4px 6px' }}><input type="number" min="0" value={v1 as string} onChange={e => (s1 as (v:string)=>void)(e.target.value)} style={cellStyle}/></td>
                <td style={{ padding: '4px 6px' }}><input type="number" min="0" value={v2 as string} onChange={e => (s2 as (v:string)=>void)(e.target.value)} style={cellStyle}/></td>
              </tr>
            ))}
          </tbody>
        </table>
        {result && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'center' }}>N = {result.N}</div>}
      </div>

      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { l: ar?'p (طرفان)':'p (two-sided)', v: result.pFmt(result.p_two), c: result.p_two < 0.05 ? C.green : C.red, big: true },
              { l: ar?'p (أصغر)':'p (less)', v: result.pFmt(result.p_less), c: C.sub },
              { l: ar?'p (أكبر)':'p (greater)', v: result.pFmt(result.p_greater), c: C.sub },
              { l: 'Odds Ratio', v: result.or.toFixed(4), c: result.or > 1 ? C.teal : C.red },
              { l: '95% CI (OR)', v: `[${result.or_lo.toFixed(3)}, ${result.or_hi.toFixed(3)}]`, c: C.blue },
            ].map(({ l, v, c, big }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${big ? (result.p_two < 0.05 ? C.green : C.red) : C.border}`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: big ? 20 : 13, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `كشف اختبار Fisher الدقيق عن ${result.p_two < 0.05 ? 'ارتباط دال' : 'ارتباط غير دال'} بين المتغيرين، p = ${result.pFmt(result.p_two)} (طرفان)، OR = ${result.or.toFixed(3)}، 95% CI [${result.or_lo.toFixed(3)}, ${result.or_hi.toFixed(3)}]`
              : `Fisher's exact test revealed a ${result.p_two < 0.05 ? 'significant' : 'non-significant'} association, p = ${result.pFmt(result.p_two)} (two-tailed), OR = ${result.or.toFixed(3)}, 95% CI [${result.or_lo.toFixed(3)}, ${result.or_hi.toFixed(3)}]`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── BINOMIAL TEST ─────────────────────────────────────────────────────────
function BinomialTest({ ar }: { ar: boolean }) {
  const [xStr, setXStr] = useState('34'); const [nStr, setNStr] = useState('80'); const [p0Str, setP0Str] = useState('0.5');
  const [tail, setTail] = useState<'two'|'greater'|'less'>('two');
  const [conf, setConf] = useState(95);

  const result = useMemo(() => {
    const x = Math.round(parseFloat(xStr)), n = Math.round(parseFloat(nStr)), p0 = parseFloat(p0Str);
    if (!isFinite(x)||!isFinite(n)||!isFinite(p0)||n<1||x<0||x>n||p0<=0||p0>=1) return null;
    const pObs = Math.exp(logBinomCoef(n, x) + x * Math.log(p0) + (n - x) * Math.log(1 - p0));
    let p_two = 0, p_less = 0, p_greater = 0;
    const maxK = Math.min(n, 500);
    if (n <= 500) {
      for (let k = 0; k <= n; k++) {
        const pk = Math.exp(logBinomCoef(n, k) + k * Math.log(p0) + (n - k) * Math.log(1 - p0));
        if (pk <= pObs * (1 + 1e-7)) p_two += pk;
        if (k <= x) p_less += pk;
        if (k >= x) p_greater += pk;
      }
    } else {
      // Normal approximation with continuity correction
      const mu = n * p0, sig = Math.sqrt(n * p0 * (1 - p0));
      p_less = normalCDF((x + 0.5 - mu) / sig);
      p_greater = 1 - normalCDF((x - 0.5 - mu) / sig);
      p_two = 2 * Math.min(p_less, p_greater);
    }
    const pv = tail === 'two' ? p_two : tail === 'greater' ? p_greater : p_less;
    // Wilson CI for proportion
    const pHat = x / n;
    const z = conf === 99 ? 2.576 : conf === 90 ? 1.645 : 1.960;
    const denom = 1 + z*z/n;
    const centre = (pHat + z*z/(2*n))/denom;
    const half = (z/denom)*Math.sqrt(pHat*(1-pHat)/n + z*z/(4*n*n));
    const ci_lo = Math.max(0, centre - half), ci_hi = Math.min(1, centre + half);
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(4);
    const sig = pv < 0.05;
    // Effect size: Cohen's g = p - 0.5 (for deviation from 0.5) or h for any p0
    const h = 2 * Math.asin(Math.sqrt(pHat)) - 2 * Math.asin(Math.sqrt(p0));
    const maxK2 = maxK;
    // Chart: binomial distribution with marked x
    const chartData: { k: number; p: number; obs: boolean }[] = [];
    const lo = Math.max(0, Math.round(n*p0 - 4*Math.sqrt(n*p0*(1-p0))));
    const hi = Math.min(n, Math.round(n*p0 + 4*Math.sqrt(n*p0*(1-p0))));
    for (let k = lo; k <= hi; k++) {
      const pk = Math.exp(logBinomCoef(Math.min(n, maxK2), k > maxK2 ? 0 : k) + k * Math.log(p0) + (Math.min(n, maxK2) - k) * Math.log(1 - p0));
      chartData.push({ k, p: isFinite(pk) ? pk : 0, obs: k === x });
    }
    return { x, n, p0, pHat, pv, p_two, p_less, p_greater, ci_lo, ci_hi, h, sig, pFmt, chartData };
  }, [xStr, nStr, p0Str, tail, conf]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
        {[
          { l: `x (${ar?'نجاح':'successes'})`, v: xStr, s: setXStr },
          { l: `n (${ar?'تجارب':'trials'})`, v: nStr, s: setNStr },
          { l: `p₀ (${ar?'المفترضة':'hypothesized'})`, v: p0Str, s: setP0Str, step: '0.01' },
        ].map(({ l, v, s, step }) => (
          <div key={l}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 3 }}>{l}</label>
            <input type="number" value={v} onChange={e => s(e.target.value)} step={step} min="0"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 18, fontWeight: 800, direction: 'ltr', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['two',ar?'طرفان':'Two-tailed'],['greater',ar?'أكبر':'Greater'],['less',ar?'أصغر':'Less']] as const).map(([t,lbl])=>(
          <button key={t} onClick={()=>setTail(t)} style={{ background:tail===t?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${tail===t?C.gold:C.border}`, borderRadius:7, padding:'5px 12px', color:tail===t?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:tail===t?700:400, fontSize:12 }}>{lbl}</button>
        ))}
        <span style={{ color: C.sub, fontSize: 12, marginLeft: 12 }}>CI:</span>
        {[90,95,99].map(c=>(
          <button key={c} onClick={()=>setConf(c)} style={{ background:conf===c?'rgba(94,234,212,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${conf===c?C.teal:C.border}`, borderRadius:7, padding:'5px 10px', color:conf===c?C.teal:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:conf===c?700:400, fontSize:11 }}>{c}%</button>
        ))}
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'أدخل قيماً صحيحة':'Enter valid values'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ background: C.card, border: `2px solid ${result.sig?C.green:C.red}`, borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: C.sub }}>p-value</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: result.sig ? C.green : C.red }}>{result.pFmt(result.pv)}</div>
              <div style={{ fontSize: 11, color: result.sig?C.green:C.red, fontWeight: 700 }}>{result.sig?(ar?'دال':'Sig.'):(ar?'غير دال':'n.s.')}</div>
            </div>
            {[
              { l: 'p̂', v: `${(result.pHat*100).toFixed(1)}%`, c: C.teal },
              { l: 'p₀', v: `${(result.p0*100).toFixed(1)}%`, c: C.sub },
              { l: `${conf}% CI`, v: `[${(result.ci_lo*100).toFixed(1)}%, ${(result.ci_hi*100).toFixed(1)}%]`, c: C.blue },
              { l: "Cohen's h", v: result.h.toFixed(3), c: Math.abs(result.h)>=0.8?C.red:Math.abs(result.h)>=0.5?C.gold:C.teal },
              { l: 'p (two)', v: result.pFmt(result.p_two), c: C.sub },
              { l: 'p (≤x)', v: result.pFmt(result.p_less), c: C.sub },
              { l: 'p (≥x)', v: result.pFmt(result.p_greater), c: C.sub },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {result.chartData.length > 0 && result.n <= 200 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar?'التوزيع ثنائي الحد (x المُلاحَظ بالذهبي)':'Binomial distribution (observed x in gold)'}</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={result.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="k" tick={{ fontSize: 8, fill: C.sub }} />
                  <YAxis tick={{ fontSize: 8, fill: C.sub }} width={32} />
                  <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }} formatter={(v: number) => v.toFixed(5)} />
                  <Bar dataKey="p" radius={2}>
                    {result.chartData.map((entry) => (
                      <Cell key={entry.k} fill={entry.obs ? C.gold : `${C.blue}88`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `أشار الاختبار الثنائي الحد الدقيق إلى ${result.sig?'دلالة':'عدم دلالة'} إحصائية (x = ${result.x}, n = ${result.n}, p̂ = ${(result.pHat*100).toFixed(1)}%, p = ${result.pFmt(result.pv)}, ${conf}% CI [${(result.ci_lo*100).toFixed(1)}%, ${(result.ci_hi*100).toFixed(1)}%])`
              : `An exact binomial test indicated that the observed proportion (p̂ = ${(result.pHat*100).toFixed(1)}%) was ${result.sig?'significantly':'not significantly'} different from p₀ = ${(result.p0*100).toFixed(1)}% (x = ${result.x}, n = ${result.n}, p = ${result.pFmt(result.pv)}, ${conf}% CI [${(result.ci_lo*100).toFixed(1)}%, ${(result.ci_hi*100).toFixed(1)}%])`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ANCOVA ───────────────────────────────────────────────────────────────
function Ancova({ ar }: { ar: boolean }) {
  const DEF = `Group,Covariate,Outcome
A,68,78
A,72,82
A,65,73
A,71,81
A,67,76
B,73,85
B,69,80
B,74,86
B,66,77
B,70,83
C,76,90
C,68,82
C,74,87
C,70,84
C,72,85`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(l => {
      const cells = l.trim().split(sep);
      return { g: cells[0]?.trim() ?? '', x: parseFloat(cells[1]?.trim() ?? ''), y: parseFloat(cells[2]?.trim() ?? '') };
    }).filter(r => r.g && isFinite(r.x) && isFinite(r.y));
    if (rows.length < 6) return null;
    const groups = [...new Set(rows.map(r => r.g))].sort();
    const k = groups.length;
    if (k < 2) return null;
    const n = rows.length;
    const yArr = rows.map(r => r.y), xArr = rows.map(r => r.x);

    // Full model: Y ~ 1 + cov + d1 + ... + d(k-1)
    const Xfull = rows.map(r => [1, r.x, ...groups.slice(0, k - 1).map(g => r.g === g ? 1 : 0)]);
    // Reduced: Y ~ 1 + cov
    const Xcov = rows.map(r => [1, r.x]);

    const full = olsWithSE(Xfull, yArr);
    const cov = olsWithSE(Xcov, yArr);
    if (!full || !cov) return null;

    const yhat_full = Xfull.map(row => row.reduce((s, v, i) => s + v * full.beta[i], 0));
    const yhat_cov = Xcov.map(row => row.reduce((s, v, i) => s + v * cov.beta[i], 0));
    const SS_err_full = yArr.reduce((s, v, i) => s + (v - yhat_full[i]) ** 2, 0);
    const SS_err_cov = yArr.reduce((s, v, i) => s + (v - yhat_cov[i]) ** 2, 0);
    const SS_group = SS_err_cov - SS_err_full;
    const df_g = k - 1, df_e = n - k - 1;
    const F = (SS_group / df_g) / Math.max(1e-10, SS_err_full / df_e);
    const pv = 1 - chiSqP(F * df_g, df_g);
    const partial_eta2 = SS_group / (SS_group + SS_err_full);
    const xMean = avg(xArr);
    const adjMeans = groups.map(g => {
      const row = [1, xMean, ...groups.slice(0, k - 1).map(gg => g === gg ? 1 : 0)];
      return row.reduce((s, v, i) => s + v * full.beta[i], 0);
    });
    const rawMeans = groups.map(g => avg(rows.filter(r => r.g === g).map(r => r.y)));
    const slope = full.beta[1], slopeSE = full.se[1];
    const t_slope = slope / Math.max(1e-10, slopeSE);
    const p_slope = 2 * (1 - normalCDF(Math.abs(t_slope)));
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const R2_full = 1 - SS_err_full / yArr.reduce((s, v) => s + (v - avg(yArr)) ** 2, 0);
    const nByG = groups.map(g => rows.filter(r => r.g === g).length);
    return { n, k, groups, F, df_g, df_e, pv, partial_eta2, adjMeans, rawMeans, slope, slopeSE, t_slope, p_slope, xMean, pFmt, R2_full, nByG };
  }, [raw]);

  const pC = (p: number) => p < 0.05 ? C.green : C.red;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'ثلاثة أعمدة: المجموعة (نصي) · المتغير المصاحب (رقمي) · المتغير التابع (رقمي) · فاصلة أو tab'
            : 'Three columns: Group (text) · Covariate (numeric) · Outcome (numeric) · comma or tab separated'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم ≥ 2 مجموعات و ≥ 6 مشاهدات' : 'Need ≥ 2 groups and ≥ 6 observations'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { l: `F(${result.df_g},${result.df_e})`, v: result.F.toFixed(3), c: C.text },
              { l: 'p', v: result.pFmt(result.pv), c: pC(result.pv) },
              { l: 'Partial η²', v: result.partial_eta2.toFixed(4), c: result.partial_eta2 >= 0.14 ? C.green : result.partial_eta2 >= 0.06 ? C.gold : C.teal },
              { l: 'R² (full)', v: result.R2_full.toFixed(4), c: C.blue },
              { l: `β (${ar ? 'مصاحب' : 'covariate'})`, v: result.slope.toFixed(4), c: C.sub },
              { l: 'p (covariate)', v: result.pFmt(result.p_slope), c: pC(result.p_slope) },
              { l: `x̄ (${ar ? 'مصاحب' : 'cov'})`, v: result.xMean.toFixed(3), c: C.muted },
              { l: 'N', v: String(result.n) },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c ?? C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Adjusted vs raw means */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '8px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? 'المتوسطات المعدَّلة (عند x̄ للمصاحب) مقابل الخام' : 'Adjusted Means (at grand x̄) vs Raw Means'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'المجموعة' : 'Group', 'n', ar ? 'متوسط خام' : 'Raw Mean', ar ? 'متوسط معدَّل' : 'Adj. Mean', ar ? 'الفرق' : 'Diff'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.groups.map((g, i) => (
                  <tr key={g} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: C.text }}>{g}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted }}>{result.nByG[i]}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{result.rawMeans[i].toFixed(3)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: C.teal, fontWeight: 700 }}>{result.adjMeans[i].toFixed(3)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', color: result.adjMeans[i] - result.rawMeans[i] >= 0 ? C.teal : '#f97316' }}>
                      {(result.adjMeans[i] - result.rawMeans[i] >= 0 ? '+' : '')}{(result.adjMeans[i] - result.rawMeans[i]).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart: adjusted means */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>
              {ar ? 'المتوسطات المعدَّلة (ذهبي) مقابل الخام (رمادي)' : 'Adjusted (gold) vs Raw (gray) Means'}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={result.groups.map((g, i) => ({ name: g, adj: +result.adjMeans[i].toFixed(3), raw: +result.rawMeans[i].toFixed(3) }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.sub }} />
                <YAxis tick={{ fontSize: 9, fill: C.sub }} width={36} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="raw" fill="rgba(255,255,255,0.2)" radius={4} name={ar ? 'خام' : 'Raw'} />
                <Bar dataKey="adj" fill={C.gold} radius={4} name={ar ? 'معدَّل' : 'Adjusted'} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `بعد ضبط المتغير المصاحب (β = ${result.slope.toFixed(3)}, p = ${result.pFmt(result.p_slope)})، أشار تحليل التغاير إلى ${result.pv < 0.05 ? 'أثر جماعي دال' : 'أثر جماعي غير دال'}، F(${result.df_g}, ${result.df_e}) = ${result.F.toFixed(2)}, p = ${result.pFmt(result.pv)}, Partial η² = ${result.partial_eta2.toFixed(3)}`
              : `After controlling for the covariate (β = ${result.slope.toFixed(3)}, p = ${result.pFmt(result.p_slope)}), a one-way ANCOVA revealed a ${result.pv < 0.05 ? 'significant' : 'non-significant'} group effect, F(${result.df_g}, ${result.df_e}) = ${result.F.toFixed(2)}, p = ${result.pFmt(result.pv)}, partial η² = ${result.partial_eta2.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── DIAGNOSTIC ACCURACY ───────────────────────────────────────────────────
function DiagnosticAccuracy({ ar }: { ar: boolean }) {
  const [tpS, setTP] = useState('45'); const [fpS, setFP] = useState('10');
  const [fnS, setFN] = useState('5');  const [tnS, setTN] = useState('40');
  const [prev, setPrev] = useState('50');

  const result = useMemo(() => {
    const TP = parseInt(tpS), FP = parseInt(fpS), FN = parseInt(fnS), TN = parseInt(tnS);
    const prevalence = parseFloat(prev) / 100;
    if ([TP,FP,FN,TN].some(v => !isFinite(v) || v < 0)) return null;
    const N = TP+FP+FN+TN; if (N < 4) return null;
    const sens   = TP / Math.max(1, TP+FN);
    const spec   = TN / Math.max(1, TN+FP);
    const ppv    = TP / Math.max(1, TP+FP);
    const npv    = TN / Math.max(1, TN+FN);
    const acc    = (TP+TN) / N;
    const lr_pos = sens / Math.max(1e-10, 1-spec);
    const lr_neg = (1-sens) / Math.max(1e-10, spec);
    const dor    = lr_pos / Math.max(1e-10, lr_neg);
    const youden = sens + spec - 1;
    const f1     = 2*TP / Math.max(1, 2*TP+FP+FN);
    const mcc    = (TP*TN - FP*FN) / Math.max(1e-10, Math.sqrt((TP+FP)*(TP+FN)*(TN+FP)*(TN+FN)));
    const bacc   = (sens + spec) / 2;
    // Bayesian PPV/NPV at specified prevalence
    const ppv_prev = (sens * prevalence) / Math.max(1e-10, (sens*prevalence + (1-spec)*(1-prevalence)));
    const npv_prev = (spec * (1-prevalence)) / Math.max(1e-10, (spec*(1-prevalence) + (1-sens)*prevalence));
    // Wilson CI
    const wCI = (p: number, n: number): [number,number] => {
      const z = 1.96, d = 1+z*z/n, c = (p+z*z/(2*n))/d, h = (z/d)*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));
      return [Math.max(0,c-h), Math.min(1,c+h)];
    };
    const [sLo,sHi] = wCI(sens,TP+FN); const [spLo,spHi] = wCI(spec,TN+FP);
    const [pLo,pHi] = wCI(ppv,TP+FP);  const [nLo,nHi] = wCI(npv,TN+FN);
    const pFmt = (p: number) => p.toFixed(4);
    return { TP,FP,FN,TN,N,sens,spec,ppv,npv,acc,lr_pos,lr_neg,dor,youden,f1,mcc,bacc,ppv_prev,npv_prev,prevalence,sLo,sHi,spLo,spHi,pLo,pHi,nLo,nHi,pFmt };
  }, [tpS, fpS, fnS, tnS, prev]);

  const cellIn = (val: string, set: (v: string) => void, lbl: string, color: string) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 3 }}>{lbl}</div>
      <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
        style={{ width: 72, background: `${color}22`, border: `1px solid ${color}66`, borderRadius: 8, padding: '8px 4px', color, fontSize: 20, fontWeight: 800, direction: 'ltr', textAlign: 'center' }} />
    </div>
  );

  return (
    <div>
      {/* 2x2 grid */}
      <div style={{ marginBottom: 14 }}>
        <table style={{ borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead><tr>
            <th style={{ padding: '4px 10px', fontSize: 11, color: C.sub }}></th>
            <th style={{ padding: '4px 10px', fontSize: 12, color: C.green, fontWeight: 700 }}>{ar ? 'مرضي (فعلي +)' : 'Disease + (actual)'}</th>
            <th style={{ padding: '4px 10px', fontSize: 12, color: C.red, fontWeight: 700 }}>{ar ? 'سليم (فعلي −)' : 'Disease − (actual)'}</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px 10px', fontSize: 12, color: C.gold, fontWeight: 700 }}>{ar ? 'اختبار +' : 'Test +'}</td>
              <td style={{ padding: '6px 8px' }}>{cellIn(tpS, setTP, 'TP', C.green)}</td>
              <td style={{ padding: '6px 8px' }}>{cellIn(fpS, setFP, 'FP', C.red)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', fontSize: 12, color: C.gold, fontWeight: 700 }}>{ar ? 'اختبار −' : 'Test −'}</td>
              <td style={{ padding: '6px 8px' }}>{cellIn(fnS, setFN, 'FN', '#f97316')}</td>
              <td style={{ padding: '6px 8px' }}>{cellIn(tnS, setTN, 'TN', C.teal)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 11, color: C.sub }}>{ar ? 'معدل الانتشار الفعلي (%) للـ PPV/NPV بياني:' : 'Prevalence (%) for Bayesian PPV/NPV:'}</label>
          <input type="number" min="1" max="99" value={prev} onChange={e => setPrev(e.target.value)}
            style={{ width: 64, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 8px', color: C.text, fontSize: 13, direction: 'ltr' }} />
          <span style={{ color: C.sub, fontSize: 11 }}>%</span>
        </div>
      </div>

      {result && (
        <>
          {/* Primary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(115px,1fr))', gap: 9, marginBottom: 12 }}>
            {[
              { l: ar ? 'الحساسية' : 'Sensitivity', v: `${(result.sens*100).toFixed(1)}%`, sub: `[${(result.sLo*100).toFixed(1)}, ${(result.sHi*100).toFixed(1)}]`, c: C.green },
              { l: ar ? 'النوعية' : 'Specificity', v: `${(result.spec*100).toFixed(1)}%`, sub: `[${(result.spLo*100).toFixed(1)}, ${(result.spHi*100).toFixed(1)}]`, c: C.teal },
              { l: 'PPV', v: `${(result.ppv*100).toFixed(1)}%`, sub: `[${(result.pLo*100).toFixed(1)}, ${(result.pHi*100).toFixed(1)}]`, c: C.gold },
              { l: 'NPV', v: `${(result.npv*100).toFixed(1)}%`, sub: `[${(result.nLo*100).toFixed(1)}, ${(result.nHi*100).toFixed(1)}]`, c: C.blue },
              { l: ar ? 'الدقة' : 'Accuracy', v: `${(result.acc*100).toFixed(1)}%`, c: C.sub },
              { l: 'LR+', v: result.lr_pos.toFixed(3), c: result.lr_pos >= 10 ? C.green : result.lr_pos >= 5 ? C.gold : C.sub },
              { l: 'LR−', v: result.lr_neg.toFixed(3), c: result.lr_neg <= 0.1 ? C.green : result.lr_neg <= 0.2 ? C.gold : C.sub },
              { l: 'DOR', v: result.dor.toFixed(2), c: C.purple },
              { l: "Youden's J", v: result.youden.toFixed(4), c: result.youden >= 0.5 ? C.green : result.youden >= 0.3 ? C.gold : C.red },
              { l: 'F1 Score', v: result.f1.toFixed(4), c: C.teal },
              { l: 'MCC', v: result.mcc.toFixed(4), c: C.blue },
              { l: 'Balanced Acc', v: `${(result.bacc*100).toFixed(1)}%`, c: C.sub },
            ].map(({ l, v, sub, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.sub, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div>
                {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Bayesian PPV/NPV */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 8 }}>
              {ar ? `PPV/NPV عند انتشار ${prev}% (بايزي)` : `Bayesian PPV/NPV at ${prev}% prevalence`}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: C.sub }}>{ar ? 'PPV بياني' : 'Bayesian PPV'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{(result.ppv_prev*100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.sub }}>{ar ? 'NPV بياني' : 'Bayesian NPV'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.teal }}>{(result.npv_prev*100).toFixed(1)}%</div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, alignSelf: 'center', maxWidth: 240 }}>
                {ar ? 'يختلف عن PPV/NPV من الجدول الذي يعكس انتشار العيّنة فقط'
                    : 'Differs from table PPV/NPV which reflects sample prevalence only'}
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `أظهر الاختبار حساسية = ${(result.sens*100).toFixed(1)}% (95% CI [${(result.sLo*100).toFixed(1)}, ${(result.sHi*100).toFixed(1)}])، ونوعية = ${(result.spec*100).toFixed(1)}% (95% CI [${(result.spLo*100).toFixed(1)}, ${(result.spHi*100).toFixed(1)}])، LR+ = ${result.lr_pos.toFixed(2)}، DOR = ${result.dor.toFixed(2)}، Youden's J = ${result.youden.toFixed(3)}`
              : `The test demonstrated sensitivity = ${(result.sens*100).toFixed(1)}% (95% CI [${(result.sLo*100).toFixed(1)}, ${(result.sHi*100).toFixed(1)}]), specificity = ${(result.spec*100).toFixed(1)}% (95% CI [${(result.spLo*100).toFixed(1)}, ${(result.spHi*100).toFixed(1)}]), LR+ = ${result.lr_pos.toFixed(2)}, DOR = ${result.dor.toFixed(2)}, Youden's J = ${result.youden.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── TWO-WAY ANOVA ─────────────────────────────────────────────────────────
function TwoWayAnova({ ar }: { ar: boolean }) {
  const DEF = `A,B,Y
a1,b1,23
a1,b1,25
a1,b2,28
a1,b2,30
a2,b1,19
a2,b1,21
a2,b2,31
a2,b2,33
a3,b1,15
a3,b1,17
a3,b2,24
a3,b2,26`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(l => {
      const cells = l.trim().split(sep);
      return { a: cells[0]?.trim() ?? '', b: cells[1]?.trim() ?? '', y: parseFloat(cells[2]?.trim() ?? '') };
    }).filter(r => r.a && r.b && isFinite(r.y));
    if (rows.length < 6) return null;
    const levA = [...new Set(rows.map(r => r.a))].sort();
    const levB = [...new Set(rows.map(r => r.b))].sort();
    const nA = levA.length, nB = levB.length;
    if (nA < 2 || nB < 2) return null;

    const n = rows.length;
    const Y = rows.map(r => r.y);
    const grandMean = avg(Y);
    const SS_total = Y.reduce((s, v) => s + (v - grandMean) ** 2, 0);

    // Cell means
    const cellMean = (a: string, b: string) => {
      const vals = rows.filter(r => r.a === a && r.b === b).map(r => r.y);
      return vals.length ? avg(vals) : 0;
    };
    const margA = levA.map(a => avg(rows.filter(r => r.a === a).map(r => r.y)));
    const margB = levB.map(b => avg(rows.filter(r => r.b === b).map(r => r.y)));
    const nA_arr = levA.map(a => rows.filter(r => r.a === a).length);
    const nB_arr = levB.map(b => rows.filter(r => r.b === b).length);

    // SS using regression (Type-III via contrast approach)
    // Build design matrix: 1 + A_dummies + B_dummies + AB_dummies
    const dA = levA.slice(0, nA - 1);
    const dB = levB.slice(0, nB - 1);
    const dAB: [string,string][] = [];
    for (const a of dA) for (const b of dB) dAB.push([a,b]);

    const buildX = (incA: boolean, incB: boolean, incAB: boolean) =>
      rows.map(r => [
        1,
        ...(incA ? dA.map(a => r.a === a ? 1 : 0) : []),
        ...(incB ? dB.map(b => r.b === b ? 1 : 0) : []),
        ...(incAB ? dAB.map(([a,b]) => r.a === a && r.b === b ? 1 : 0) : []),
      ]);

    const fit = (X: number[][]) => {
      const o = olsWithSE(X, Y);
      if (!o) return null;
      const res = Y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * o.beta[j], 0));
      return res.reduce((s, v) => s + v*v, 0);
    };

    const SS_full   = fit(buildX(true,  true,  true))  ?? SS_total;
    const SS_noA    = fit(buildX(false, true,  true))  ?? SS_total;
    const SS_noB    = fit(buildX(true,  false, true))  ?? SS_total;
    const SS_noAB   = fit(buildX(true,  true,  false)) ?? SS_total;

    const SS_A  = SS_noA  - SS_full;
    const SS_B  = SS_noB  - SS_full;
    const SS_AB = SS_noAB - SS_full;
    const SS_err = SS_full;

    const df_A = nA-1, df_B = nB-1, df_AB = (nA-1)*(nB-1);
    const df_err = n - nA*nB;
    if (df_err < 1) return null;
    const MS_err = SS_err / df_err;
    const F_A  = (SS_A  / df_A)  / Math.max(1e-10, MS_err);
    const F_B  = (SS_B  / df_B)  / Math.max(1e-10, MS_err);
    const F_AB = (SS_AB / df_AB) / Math.max(1e-10, MS_err);
    const p_A  = 1 - chiSqP(F_A  * df_A,  df_A);
    const p_B  = 1 - chiSqP(F_B  * df_B,  df_B);
    const p_AB = 1 - chiSqP(F_AB * df_AB, df_AB);
    const eta2_A  = SS_A  / SS_total;
    const eta2_B  = SS_B  / SS_total;
    const eta2_AB = SS_AB / SS_total;

    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const stars = (p: number) => p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';

    // Cell means for interaction plot
    const interactionData = levB.map(b => {
      const row: Record<string,string|number> = { b };
      levA.forEach(a => { row[a] = +cellMean(a, b).toFixed(3); });
      return row;
    });

    return { n, nA, nB, levA, levB, margA, margB, nA_arr, nB_arr, SS_A, SS_B, SS_AB, SS_err, SS_total, df_A, df_B, df_AB, df_err, F_A, F_B, F_AB, p_A, p_B, p_AB, eta2_A, eta2_B, eta2_AB, MS_err, interactionData, pFmt, stars };
  }, [raw]);

  const pC = (p: number) => p < 0.05 ? C.green : C.red;
  const COLORS = [C.teal, C.gold, C.blue, C.purple, C.green, C.red];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'ثلاثة أعمدة: العامل A (نصي) · العامل B (نصي) · المتغير التابع (رقمي) · كل مجموعة خلية بصف منفصل'
            : 'Three columns: Factor A (text) · Factor B (text) · Outcome (numeric) · each cell observation on its own row'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 2+ مستويات لكل عامل و ≥ 6 مشاهدات' : 'Need 2+ levels per factor and ≥ 6 observations'}</p>}
      {result && (
        <>
          {/* ANOVA table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '8px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? 'جدول تحليل التباين ثنائي الاتجاه (Type III SS)' : 'Two-Way ANOVA Table (Type III SS)'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar?'المصدر':'Source','SS','df','MS','F','p','η²'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { src: ar?'العامل A':'Factor A', SS: result.SS_A, df: result.df_A, F: result.F_A, p: result.p_A, eta2: result.eta2_A },
                  { src: ar?'العامل B':'Factor B', SS: result.SS_B, df: result.df_B, F: result.F_B, p: result.p_B, eta2: result.eta2_B },
                  { src: ar?'التفاعل A×B':'A×B Interaction', SS: result.SS_AB, df: result.df_AB, F: result.F_AB, p: result.p_AB, eta2: result.eta2_AB },
                  { src: ar?'الخطأ':'Error', SS: result.SS_err, df: result.df_err, F: null, p: null, eta2: null },
                  { src: ar?'الكلي':'Total', SS: result.SS_total, df: result.n-1, F: null, p: null, eta2: null },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i===4?'rgba(201,168,76,0.04)':i===2?'rgba(139,92,246,0.06)':i<3?'rgba(94,234,212,0.03)':'transparent' }}>
                    <td style={{ padding:'5px 8px', fontWeight:i<3?700:400, color:i===2?C.purple:i<3?C.teal:i===4?C.gold:C.sub }}>{row.src}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:C.sub }}>{row.SS.toFixed(3)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:C.sub }}>{row.df}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:C.sub }}>{row.F!=null?(row.SS/row.df).toFixed(3):'—'}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:C.sub }}>{row.F!=null?row.F.toFixed(3):'—'}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:row.p!=null?pC(row.p):C.muted, fontWeight:row.p!=null&&row.p<0.05?700:400 }}>
                      {row.p!=null?`${result.pFmt(row.p)}${result.stars(row.p)}`:'—'}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:C.muted }}>{row.eta2!=null?row.eta2.toFixed(4):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interaction plot */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: result.p_AB < 0.05 ? C.purple : C.gold, marginBottom: 10 }}>
              {ar ? `رسم التفاعل A×B ${result.p_AB < 0.05 ? '— التفاعل دال ✓' : ''}` : `A×B Interaction Plot ${result.p_AB < 0.05 ? '— Significant interaction ✓' : ''}`}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={result.interactionData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="b" tick={{ fontSize: 10, fill: C.sub }} label={{ value: ar?'مستويات B':'Factor B levels', position:'insideBottom', offset:-4, fontSize:10, fill:C.sub }} />
                <YAxis tick={{ fontSize: 9, fill: C.sub }} width={36} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                {result.levA.map((a, i) => (
                  <Line key={a} type="monotone" dataKey={a} name={`A=${a}`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4, fill: COLORS[i % COLORS.length] }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Marginal means */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { title: ar?'متوسطات العامل A (هامشية)':'Factor A Marginal Means', levs: result.levA, means: result.margA, ns: result.nA_arr, color: C.teal },
              { title: ar?'متوسطات العامل B (هامشية)':'Factor B Marginal Means', levs: result.levB, means: result.margB, ns: result.nB_arr, color: C.blue },
            ].map(({ title, levs, means, ns, color }) => (
              <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.03)', fontSize: 11, fontWeight: 700, color }}>{title}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {levs.map((l, i) => (
                      <tr key={l} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '4px 10px', color: C.text, fontWeight: 700 }}>{l}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'center', color: C.muted, fontSize: 10 }}>n={ns[i]}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color, fontWeight: 700 }}>{means[i].toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `كشف تحليل التباين ثنائي الاتجاه عن: أثر A ${result.p_A<0.05?'دال':'غير دال'} F(${result.df_A},${result.df_err})=${result.F_A.toFixed(2)}, p=${result.pFmt(result.p_A)}, η²=${result.eta2_A.toFixed(3)}؛ أثر B ${result.p_B<0.05?'دال':'غير دال'} F(${result.df_B},${result.df_err})=${result.F_B.toFixed(2)}, p=${result.pFmt(result.p_B)}, η²=${result.eta2_B.toFixed(3)}؛ التفاعل A×B ${result.p_AB<0.05?'دال':'غير دال'} F(${result.df_AB},${result.df_err})=${result.F_AB.toFixed(2)}, p=${result.pFmt(result.p_AB)}, η²=${result.eta2_AB.toFixed(3)}`
              : `A two-way ANOVA revealed: ${result.p_A<0.05?'significant':'non-significant'} main effect of A, F(${result.df_A},${result.df_err})=${result.F_A.toFixed(2)}, p=${result.pFmt(result.p_A)}, η²=${result.eta2_A.toFixed(3)}; ${result.p_B<0.05?'significant':'non-significant'} main effect of B, F(${result.df_B},${result.df_err})=${result.F_B.toFixed(2)}, p=${result.pFmt(result.p_B)}, η²=${result.eta2_B.toFixed(3)}; ${result.p_AB<0.05?'significant':'non-significant'} A×B interaction, F(${result.df_AB},${result.df_err})=${result.F_AB.toFixed(2)}, p=${result.pFmt(result.p_AB)}, η²=${result.eta2_AB.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── BLAND-ALTMAN ─────────────────────────────────────────────────────────
function BlandAltman({ ar }: { ar: boolean }) {
  const DEF = `Method1,Method2
120,125
130,128
115,118
140,138
125,127
135,132
110,115
145,142
128,130
122,124
138,136
118,121
132,130
142,140
127,129`;
  const [raw, setRaw] = useState(DEF);
  const [ciPct, setCiPct] = useState(95);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 4) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(l => {
      const c = l.trim().split(sep);
      return { m1: parseFloat(c[0]?.trim() ?? ''), m2: parseFloat(c[1]?.trim() ?? '') };
    }).filter(r => isFinite(r.m1) && isFinite(r.m2));
    if (rows.length < 5) return null;
    const n = rows.length;
    const means = rows.map(r => (r.m1 + r.m2) / 2);
    const diffs = rows.map(r => r.m1 - r.m2);
    const bias = avg(diffs);
    const sd_diff = Math.sqrt(diffs.reduce((s, d) => s + (d - bias) ** 2, 0) / (n - 1));
    const z = ciPct === 99 ? 2.576 : ciPct === 90 ? 1.645 : 1.960;
    const loa_lo = bias - 1.96 * sd_diff;
    const loa_hi = bias + 1.96 * sd_diff;
    // CI for bias
    const se_bias = sd_diff / Math.sqrt(n);
    const bias_lo = bias - z * se_bias, bias_hi = bias + z * se_bias;
    // CI for LoA using Bland-Altman formula: SE_LoA = sqrt(3*s²/n)
    const se_loa = Math.sqrt(3 * sd_diff * sd_diff / n);
    const loa_lo_lo = loa_lo - z * se_loa, loa_lo_hi = loa_lo + z * se_loa;
    const loa_hi_lo = loa_hi - z * se_loa, loa_hi_hi = loa_hi + z * se_loa;
    // Proportional bias: Pearson r(mean, diff)
    const r_prop = pearson(means, diffs);
    const t_prop = r_prop * Math.sqrt(n - 2) / Math.max(1e-10, Math.sqrt(1 - r_prop * r_prop));
    const p_prop = 2 * (1 - normalCDF(Math.abs(t_prop)));
    // % within LoA
    const within = diffs.filter(d => d >= loa_lo && d <= loa_hi).length;
    const pctWithin = within / n;
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const plotData = rows.map((_, i) => ({ x: +means[i].toFixed(3), diff: +diffs[i].toFixed(3) }));
    return { n, bias, sd_diff, loa_lo, loa_hi, bias_lo, bias_hi, loa_lo_lo, loa_lo_hi, loa_hi_lo, loa_hi_hi, r_prop, p_prop, within, pctWithin, pFmt, plotData, ciPct };
  }, [raw, ciPct]);

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'عمودان: القياس بالطريقة 1 · القياس بالطريقة 2 (نفس المشارك في كل صف)'
            : 'Two columns: Method 1 measurement · Method 2 measurement (same subject per row)'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <span style={{ color: C.sub, fontSize: 12 }}>CI:</span>
        {[90, 95, 99].map(c => (
          <button key={c} onClick={() => setCiPct(c)} style={{ background: ciPct === c ? 'rgba(94,234,212,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ciPct === c ? C.teal : C.border}`, borderRadius: 7, padding: '5px 12px', color: ciPct === c ? C.teal : C.sub, cursor: 'pointer', fontFamily: 'inherit', fontWeight: ciPct === c ? 700 : 400, fontSize: 12 }}>{c}%</button>
        ))}
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم ≥ 5 أزواج قياسات' : 'Need ≥ 5 measurement pairs'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { l: ar ? 'التحيّز (Bias)' : 'Mean Bias', v: result.bias.toFixed(4), c: Math.abs(result.bias) < result.sd_diff * 0.5 ? C.teal : C.gold },
              { l: `${result.ciPct}% CI (Bias)`, v: `[${result.bias_lo.toFixed(3)}, ${result.bias_hi.toFixed(3)}]`, c: C.blue },
              { l: 'SD (diff)', v: result.sd_diff.toFixed(4), c: C.sub },
              { l: 'LoA lower', v: result.loa_lo.toFixed(4), c: C.red },
              { l: 'LoA upper', v: result.loa_hi.toFixed(4), c: C.red },
              { l: ar ? 'داخل LoA' : 'Within LoA', v: `${(result.pctWithin * 100).toFixed(1)}%`, c: result.pctWithin >= 0.95 ? C.green : C.gold },
              { l: 'r (prop. bias)', v: result.r_prop.toFixed(4), c: Math.abs(result.r_prop) > 0.3 ? C.red : C.teal },
              { l: 'p (prop. bias)', v: result.pFmt(result.p_prop), c: result.p_prop < 0.05 ? C.red : C.green },
              { l: 'n', v: String(result.n) },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: c ?? C.text }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Bland-Altman plot */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 8 }}>
              {ar ? 'رسم Bland-Altman (الفرق مقابل المتوسط)' : 'Bland-Altman Plot (Difference vs Mean)'}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="x" type="number" name={ar ? 'المتوسط' : 'Mean'} tick={{ fontSize: 9, fill: C.sub }}
                  label={{ value: ar ? 'متوسط الطريقتين' : 'Mean of two methods', position: 'insideBottom', offset: -12, fontSize: 10, fill: C.sub }} />
                <YAxis dataKey="diff" type="number" name={ar ? 'الفرق' : 'Diff'} tick={{ fontSize: 9, fill: C.sub }} width={38}
                  label={{ value: ar ? 'M1 − M2' : 'M1 − M2', angle: -90, position: 'insideLeft', fontSize: 10, fill: C.sub }} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }}
                  formatter={(v: number) => v.toFixed(3)} />
                <ReferenceLine y={result.bias} stroke={C.gold} strokeWidth={2} strokeDasharray="8 3" label={{ value: `Bias=${result.bias.toFixed(2)}`, fontSize: 9, fill: C.gold, position: 'right' }} />
                <ReferenceLine y={result.loa_hi} stroke={C.red} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: `+1.96SD=${result.loa_hi.toFixed(2)}`, fontSize: 9, fill: C.red, position: 'right' }} />
                <ReferenceLine y={result.loa_lo} stroke={C.red} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: `−1.96SD=${result.loa_lo.toFixed(2)}`, fontSize: 9, fill: C.red, position: 'right' }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <Scatter data={result.plotData} fill={C.teal} opacity={0.85} r={5} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* LoA CI table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '7px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? `حدود الاتفاق مع CI ${result.ciPct}%` : `Limits of Agreement with ${result.ciPct}% CI`}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['', ar ? 'التقدير' : 'Estimate', `${result.ciPct}% CI`].map(h => (
                  <th key={h} style={{ padding: '5px 12px', textAlign: 'center', color: C.sub }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { l: ar ? 'التحيّز' : 'Bias (mean diff)', v: result.bias, lo: result.bias_lo, hi: result.bias_hi, c: C.gold },
                  { l: ar ? 'الحد الأعلى للاتفاق' : 'Upper LoA', v: result.loa_hi, lo: result.loa_hi_lo, hi: result.loa_hi_hi, c: C.red },
                  { l: ar ? 'الحد الأدنى للاتفاق' : 'Lower LoA', v: result.loa_lo, lo: result.loa_lo_lo, hi: result.loa_lo_hi, c: C.red },
                ].map(row => (
                  <tr key={row.l} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 12px', color: row.c, fontWeight: 700 }}>{row.l}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.text, fontWeight: 700 }}>{row.v.toFixed(4)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>[{row.lo.toFixed(3)}, {row.hi.toFixed(3)}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `كشف تحليل Bland-Altman عن تحيّز = ${result.bias.toFixed(3)} (${result.ciPct}% CI [${result.bias_lo.toFixed(3)}, ${result.bias_hi.toFixed(3)}])، وحدود اتفاق (95%) = [${result.loa_lo.toFixed(3)}, ${result.loa_hi.toFixed(3)}]؛ بلغت نسبة القياسات داخل الحدود ${(result.pctWithin * 100).toFixed(1)}%؛ ${result.p_prop < 0.05 ? 'وُجد تحيّز تناسبي دال' : 'لا يوجد تحيّز تناسبي'} (r = ${result.r_prop.toFixed(3)}, p = ${result.pFmt(result.p_prop)})`
              : `Bland-Altman analysis revealed a mean bias of ${result.bias.toFixed(3)} (${result.ciPct}% CI [${result.bias_lo.toFixed(3)}, ${result.bias_hi.toFixed(3)}]), with 95% limits of agreement [${result.loa_lo.toFixed(3)}, ${result.loa_hi.toFixed(3)}]; ${(result.pctWithin * 100).toFixed(1)}% of observations lay within the limits; ${result.p_prop < 0.05 ? 'a significant proportional bias was detected' : 'no significant proportional bias was detected'} (r = ${result.r_prop.toFixed(3)}, p = ${result.pFmt(result.p_prop)})`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── POLYNOMIAL REGRESSION ────────────────────────────────────────────────
function PolyReg({ ar }: { ar: boolean }) {
  const DEF = `x,y
1,2.1
2,3.9
3,8.2
4,14.1
5,22.3
6,32.5
7,44.8
8,59.2
9,75.9
10,94.7`;
  const [raw, setRaw] = useState(DEF);
  const [maxDeg, setMaxDeg] = useState(2);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 4) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(l => {
      const c = l.trim().split(sep);
      return [parseFloat(c[0]?.trim() ?? ''), parseFloat(c[1]?.trim() ?? '')];
    }).filter(r => r.every(isFinite));
    if (rows.length < 4) return null;
    const xArr = rows.map(r => r[0]), yArr = rows.map(r => r[1]);
    const n = xArr.length;
    const yMean = avg(yArr);
    const SS_tot = yArr.reduce((s, v) => s + (v - yMean) ** 2, 0);

    const fits: { deg: number; beta: number[]; R2: number; R2adj: number; AIC: number; BIC: number; RMSE: number }[] = [];
    for (let d = 1; d <= Math.min(maxDeg, 5, n - 2); d++) {
      const X = xArr.map(xi => Array.from({ length: d + 1 }, (_, k) => xi ** k));
      const o = olsWithSE(X, yArr);
      if (!o) continue;
      const yhat = X.map(row => row.reduce((s, v, i) => s + v * o.beta[i], 0));
      const SS_err = yArr.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0);
      const R2 = 1 - SS_err / SS_tot;
      const R2adj = 1 - (1 - R2) * (n - 1) / Math.max(1, n - d - 1);
      const p = d + 1;
      const AIC = n * Math.log(SS_err / n) + 2 * p;
      const BIC = n * Math.log(SS_err / n) + p * Math.log(n);
      const RMSE = Math.sqrt(SS_err / n);
      fits.push({ deg: d, beta: o.beta, R2, R2adj, AIC, BIC, RMSE });
    }
    if (!fits.length) return null;

    const bestAIC = fits.reduce((b, f) => f.AIC < b.AIC ? f : b);
    const selected = fits[maxDeg - 1] ?? fits[fits.length - 1];

    // Fitted curve for selected degree
    const xMin = Math.min(...xArr), xMax = Math.max(...xArr);
    const curveX = Array.from({ length: 120 }, (_, i) => xMin + i * (xMax - xMin) / 119);
    const curveData = curveX.map(xi => ({
      x: +xi.toFixed(4),
      fit: +selected.beta.reduce((s, b, k) => s + b * xi ** k, 0).toFixed(5),
    }));
    const scatterData = rows.map(r => ({ x: r[0], y: r[1] }));
    const residuals = rows.map(r => ({
      x: r[0],
      res: +(r[1] - selected.beta.reduce((s, b, k) => s + b * r[0] ** k, 0)).toFixed(4),
    }));

    const eqStr = (beta: number[]) => beta.map((b, k) => {
      const bStr = b.toFixed(4);
      if (k === 0) return bStr;
      if (k === 1) return `${b >= 0 ? ' + ' : ' - '}${Math.abs(b).toFixed(4)}x`;
      return `${b >= 0 ? ' + ' : ' - '}${Math.abs(b).toFixed(4)}x^${k}`;
    }).join('');

    return { n, fits, selected, bestAIC, curveData, scatterData, residuals, xMin, xMax, eqStr };
  }, [raw, maxDeg]);

  const degColors = [C.teal, C.gold, C.blue, C.purple, C.green];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'عمودان: x (مستقل) · y (تابع) · فاصلة أو tab' : 'Two columns: x (predictor) · y (outcome) · comma or tab separated'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: C.sub, fontSize: 12 }}>{ar ? 'أقصى درجة:' : 'Max degree:'}</span>
        {[1, 2, 3, 4, 5].map(d => (
          <button key={d} onClick={() => setMaxDeg(d)} style={{ background: maxDeg === d ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${maxDeg === d ? C.gold : C.border}`, borderRadius: 7, padding: '5px 12px', color: maxDeg === d ? C.gold : C.sub, cursor: 'pointer', fontFamily: 'inherit', fontWeight: maxDeg === d ? 700 : 400, fontSize: 13 }}>{d}</button>
        ))}
        {result && <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{ar ? 'أفضل AIC: درجة' : 'Best AIC: degree'} {result.bestAIC.deg}</span>}
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم ≥ 4 نقاط' : 'Need ≥ 4 data points'}</p>}
      {result && (
        <>
          {/* Model comparison */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '7px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? 'مقارنة النماذج' : 'Model Comparison'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'الدرجة' : 'Degree', 'R²', 'R² adj', 'AIC', 'BIC', 'RMSE'].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: 'center', color: C.sub }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.fits.map((f, i) => (
                  <tr key={f.deg} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: f.deg === maxDeg ? 'rgba(94,234,212,0.06)' : f.deg === result.bestAIC.deg ? 'rgba(201,168,76,0.06)' : 'transparent' }}>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: degColors[i % degColors.length], fontWeight: 700 }}>
                      {f.deg} {f.deg === result.bestAIC.deg ? '★' : ''}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: f.R2 >= 0.9 ? C.green : f.R2 >= 0.7 ? C.gold : C.sub, fontWeight: 700 }}>{f.R2.toFixed(4)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: C.sub }}>{f.R2adj.toFixed(4)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: f.deg === result.bestAIC.deg ? C.gold : C.muted }}>{f.AIC.toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: C.muted }}>{f.BIC.toFixed(2)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'center', color: C.sub }}>{f.RMSE.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Equation */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{ar ? `معادلة الدرجة ${maxDeg}:` : `Degree-${maxDeg} equation:`}</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: C.teal, wordBreak: 'break-all' }}>ŷ = {result.eqStr(result.selected.beta)}</div>
          </div>

          {/* Fitted curve + scatter */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 8 }}>
              {ar ? `المنحنى المناسب (درجة ${maxDeg})` : `Fitted Curve (degree ${maxDeg})`}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: C.sub }} />
                <YAxis tick={{ fontSize: 9, fill: C.sub }} width={36} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }} formatter={(v: number) => v.toFixed(4)} />
                <Line data={result.curveData} type="monotone" dataKey="fit" stroke={C.gold} strokeWidth={2} dot={false} name={ar ? 'مناسب' : 'Fitted'} />
                <Scatter data={result.scatterData} dataKey="y" fill={C.teal} opacity={0.9} name={ar ? 'ملاحَظ' : 'Observed'} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Residuals */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 8 }}>{ar ? 'رسم البواقي' : 'Residuals'}</div>
            <ResponsiveContainer width="100%" height={130}>
              <ScatterChart margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: C.sub }} />
                <YAxis dataKey="res" type="number" tick={{ fontSize: 9, fill: C.sub }} width={36} />
                <ReferenceLine y={0} stroke={C.gold} strokeWidth={1.5} strokeDasharray="6 3" />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }} formatter={(v: number) => v.toFixed(4)} />
                <Scatter data={result.residuals} fill={C.teal} opacity={0.8} r={4} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ROC CURVE ────────────────────────────────────────────────────────────
function RocCurve({ ar }: { ar: boolean }) {
  const DEF = `Label,Score
1,0.92
1,0.88
1,0.85
1,0.79
1,0.74
1,0.71
1,0.68
1,0.62
1,0.58
1,0.45
0,0.83
0,0.76
0,0.64
0,0.57
0,0.48
0,0.42
0,0.35
0,0.28
0,0.22
0,0.15`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 4) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = dataLines.map(l => {
      const c = l.trim().split(sep);
      return { label: parseFloat(c[0]?.trim() ?? ''), score: parseFloat(c[1]?.trim() ?? '') };
    }).filter(r => isFinite(r.label) && isFinite(r.score) && (r.label === 0 || r.label === 1));
    if (rows.length < 6) return null;

    const nP = rows.filter(r => r.label === 1).length;
    const nN = rows.filter(r => r.label === 0).length;
    if (nP < 2 || nN < 2) return null;

    // Sort by score descending
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    const thresholds = [...new Set(sorted.map(r => r.score))].sort((a, b) => b - a);

    const rocPoints: { thr: number; sens: number; spec: number; fpr: number; j: number }[] = [];
    for (const thr of thresholds) {
      const TP = rows.filter(r => r.label === 1 && r.score >= thr).length;
      const FP = rows.filter(r => r.label === 0 && r.score >= thr).length;
      const sens = TP / nP;
      const spec = (nN - FP) / nN;
      const fpr = 1 - spec;
      rocPoints.push({ thr, sens, spec, fpr, j: sens + spec - 1 });
    }
    // Add (0,0) and (1,1)
    const allPts = [{ fpr: 0, sens: 0 }, ...rocPoints.map(p => ({ fpr: p.fpr, sens: p.sens })), { fpr: 1, sens: 1 }];

    // AUC via trapezoidal rule
    let auc = 0;
    for (let i = 1; i < allPts.length; i++) {
      auc += (allPts[i].fpr - allPts[i-1].fpr) * (allPts[i].sens + allPts[i-1].sens) / 2;
    }
    auc = Math.abs(auc);

    // 95% CI for AUC (Hanley-McNeil)
    const A = auc;
    const Q1 = A / (2 - A);
    const Q2 = 2 * A * A / (1 + A);
    const se_auc = Math.sqrt((A * (1 - A) + (nP - 1) * (Q1 - A * A) + (nN - 1) * (Q2 - A * A)) / (nP * nN));
    const auc_lo = Math.max(0, A - 1.96 * se_auc), auc_hi = Math.min(1, A + 1.96 * se_auc);

    // Optimal cutoff (max Youden J)
    const best = rocPoints.reduce((b, p) => p.j > b.j ? p : b, rocPoints[0]);

    // TP/FP/FN/TN at optimal
    const TP_opt = rows.filter(r => r.label === 1 && r.score >= best.thr).length;
    const FP_opt = rows.filter(r => r.label === 0 && r.score >= best.thr).length;
    const FN_opt = nP - TP_opt, TN_opt = nN - FP_opt;

    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const chartData = allPts.map(p => ({ fpr: +p.fpr.toFixed(4), sens: +p.sens.toFixed(4) }));
    return { nP, nN, n: nP + nN, auc, auc_lo, auc_hi, se_auc, best, TP_opt, FP_opt, FN_opt, TN_opt, rocPoints, chartData, pFmt };
  }, [raw]);

  const aucColor = (a: number) => a >= 0.9 ? C.green : a >= 0.8 ? C.teal : a >= 0.7 ? C.gold : a >= 0.6 ? '#f97316' : C.red;

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'عمودان: التصنيف الفعلي (0 أو 1) · درجة الاحتمالية (0–1) · كل مشاهدة في صف'
            : 'Two columns: Actual label (0 or 1) · Probability score (0–1) · one observation per row'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم ≥ 6 مشاهدات بتصنيف 0/1' : 'Need ≥ 6 observations with 0/1 labels'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { l: 'AUC', v: result.auc.toFixed(4), c: aucColor(result.auc), big: true },
              { l: '95% CI (AUC)', v: `[${result.auc_lo.toFixed(4)}, ${result.auc_hi.toFixed(4)}]`, c: C.blue },
              { l: ar ? 'قاطع أمثل (Youden)' : 'Optimal Cutoff', v: result.best.thr.toFixed(4), c: C.gold },
              { l: ar ? 'حساسية عنده' : 'Sensitivity@opt', v: `${(result.best.sens * 100).toFixed(1)}%`, c: C.green },
              { l: ar ? 'نوعية عنده' : 'Specificity@opt', v: `${(result.best.spec * 100).toFixed(1)}%`, c: C.teal },
              { l: "Youden's J", v: result.best.j.toFixed(4), c: C.purple },
              { l: `n+ / n−`, v: `${result.nP} / ${result.nN}`, c: C.sub },
              { l: 'n', v: String(result.n) },
            ].map(({ l, v, c, big }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${big ? aucColor(result.auc) : C.border}`, borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                <div style={{ fontSize: big ? 22 : 12, fontWeight: 700, color: c }}>{v}</div>
                {big && <div style={{ fontSize: 10, color: aucColor(result.auc), fontWeight: 600 }}>
                  {result.auc >= 0.9 ? (ar ? 'ممتاز' : 'Excellent') : result.auc >= 0.8 ? (ar ? 'جيد جداً' : 'Good') : result.auc >= 0.7 ? (ar ? 'مقبول' : 'Fair') : result.auc >= 0.6 ? (ar ? 'ضعيف' : 'Poor') : (ar ? 'فاشل' : 'Fail')}
                </div>}
              </div>
            ))}
          </div>

          {/* ROC curve */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 8 }}>
              {ar ? `منحنى ROC · AUC = ${result.auc.toFixed(4)}` : `ROC Curve · AUC = ${result.auc.toFixed(4)}`}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={result.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: C.sub }}
                  label={{ value: ar ? 'معدل إيجابية كاذبة (1−Spec)' : 'False Positive Rate (1−Specificity)', position: 'insideBottom', offset: -12, fontSize: 10, fill: C.sub }} />
                <YAxis dataKey="sens" type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: C.sub }} width={32}
                  label={{ value: ar ? 'الحساسية' : 'Sensitivity (TPR)', angle: -90, position: 'insideLeft', fontSize: 10, fill: C.sub }} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 10 }} formatter={(v: number) => v.toFixed(4)} />
                {/* Diagonal reference */}
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                {/* Optimal point */}
                <ReferenceLine x={1 - result.best.spec} stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" />
                <ReferenceLine y={result.best.sens} stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="sens" stroke={aucColor(result.auc)} strokeWidth={2.5} dot={false} name="ROC" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Confusion matrix at optimal threshold */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '7px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
              {ar ? `مصفوفة الالتباس عند القاطع الأمثل (${result.best.thr.toFixed(4)})` : `Confusion Matrix at Optimal Cutoff (${result.best.thr.toFixed(4)})`}
            </div>
            <div style={{ padding: 16 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={{ padding: '4px 12px', color: C.sub }}></th>
                  <th style={{ padding: '4px 12px', color: C.green, fontWeight: 700 }}>{ar ? 'مرضي (فعلي)' : 'Actual +'}</th>
                  <th style={{ padding: '4px 12px', color: C.red, fontWeight: 700 }}>{ar ? 'سليم (فعلي)' : 'Actual −'}</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 12px', color: C.gold, fontWeight: 700 }}>{ar ? 'تنبؤ +' : 'Pred +'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.green, fontSize: 20, fontWeight: 800 }}>{result.TP_opt}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.red, fontSize: 20, fontWeight: 800 }}>{result.FP_opt}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 12px', color: C.gold, fontWeight: 700 }}>{ar ? 'تنبؤ −' : 'Pred −'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: '#f97316', fontSize: 20, fontWeight: 800 }}>{result.FN_opt}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.teal, fontSize: 20, fontWeight: 800 }}>{result.TN_opt}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `أظهر تحليل منحنى ROC أداءً ${result.auc >= 0.9 ? 'ممتازاً' : result.auc >= 0.8 ? 'جيداً' : result.auc >= 0.7 ? 'مقبولاً' : 'ضعيفاً'} بمساحة تحت المنحنى AUC = ${result.auc.toFixed(4)} (95% CI [${result.auc_lo.toFixed(4)}, ${result.auc_hi.toFixed(4)}]). القاطع الأمثل = ${result.best.thr.toFixed(4)} أعطى حساسية = ${(result.best.sens * 100).toFixed(1)}% ونوعية = ${(result.best.spec * 100).toFixed(1)}% (Youden's J = ${result.best.j.toFixed(4)})`
              : `ROC curve analysis demonstrated ${result.auc >= 0.9 ? 'excellent' : result.auc >= 0.8 ? 'good' : result.auc >= 0.7 ? 'fair' : 'poor'} discriminability with AUC = ${result.auc.toFixed(4)} (95% CI [${result.auc_lo.toFixed(4)}, ${result.auc_hi.toFixed(4)}]). The optimal cutoff of ${result.best.thr.toFixed(4)} yielded sensitivity = ${(result.best.sens * 100).toFixed(1)}% and specificity = ${(result.best.spec * 100).toFixed(1)}% (Youden's J = ${result.best.j.toFixed(4)})`}
          </div>
        </>
      )}
    </div>
  );
}

function sigmoid(x: number) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
function logisticFit(X: number[][], y: number[]) {
  const n = X.length, k = X[0].length;
  let beta = Array(k).fill(0);
  for (let iter = 0; iter < 80; iter++) {
    const p = X.map(xi => sigmoid(xi.reduce((s, xij, j) => s + xij * beta[j], 0)));
    const W = p.map(pi => Math.max(1e-8, pi * (1 - pi)));
    const g = Array.from({ length: k }, (_, j) => X.reduce((s, xi, i) => s + xi[j] * (y[i] - p[i]), 0));
    const F: number[][] = Array.from({ length: k }, (_, j) => Array.from({ length: k }, (_, l) => X.reduce((s, xi, i) => s + xi[j] * xi[l] * W[i], 0)));
    const Finv = matInv(F);
    if (!Finv) break;
    const delta = Finv.map(row => row.reduce((s, fij, j) => s + fij * g[j], 0));
    for (let j = 0; j < k; j++) beta[j] += delta[j];
    if (delta.reduce((s, d) => s + d * d, 0) < 1e-12) break;
  }
  const p = X.map(xi => sigmoid(xi.reduce((s, xij, j) => s + xij * beta[j], 0)));
  const W = p.map(pi => Math.max(1e-8, pi * (1 - pi)));
  const F: number[][] = Array.from({ length: k }, (_, j) => Array.from({ length: k }, (_, l) => X.reduce((s, xi, i) => s + xi[j] * xi[l] * W[i], 0)));
  const Finv = matInv(F);
  const se = Finv ? Array.from({ length: k }, (_, j) => Math.sqrt(Math.max(0, Finv[j][j]))) : Array(k).fill(NaN);
  const LL = y.reduce((s, yi, i) => s + (yi * Math.log(Math.max(1e-10, p[i])) + (1 - yi) * Math.log(Math.max(1e-10, 1 - p[i]))), 0);
  const p0 = avg(y);
  const LL0 = n * (p0 * Math.log(Math.max(1e-10, p0)) + (1 - p0) * Math.log(Math.max(1e-10, 1 - p0)));
  return { beta, se, LL, LL0, n, k, p };
}
function LogisticReg({ ar }: { ar: boolean }) {
  const DEF = `pass,gpa,study,anxiety,motivation
1,3.8,22,2.1,4.2
0,2.9,14,4.1,2.8
1,3.6,20,2.5,4.0
0,3.0,16,3.8,3.1
1,3.9,24,1.9,4.5
0,2.7,13,4.5,2.6
1,3.7,21,2.3,4.1
0,3.1,17,3.6,3.3
1,3.5,20,2.7,3.9
1,3.8,23,2.0,4.3
0,2.8,15,4.2,2.9
1,3.6,21,2.4,4.0
1,3.4,19,3.0,3.7
0,2.6,12,4.8,2.5
1,3.9,25,1.8,4.6
0,3.2,18,3.4,3.6
1,3.7,22,2.2,4.2
0,2.9,15,4.0,3.0
1,3.8,23,2.1,4.4
1,3.5,21,2.6,4.1`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 6) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const varNames = hasHeader ? firstCells.map(h => h.trim()) : Array.from({ length: firstCells.length }, (_, i) => i === 0 ? 'Y' : `X${i}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.trim().split(sep).map(v => parseFloat(v.trim())).filter(v => isFinite(v)));
    const k = Math.min(...data.map(r => r.length), varNames.length);
    if (k < 2 || data.length < k + 2) return null;
    const n = data.length;
    const D = data.map(r => r.slice(0, k));
    const y = D.map(r => r[0]);
    if (!y.every(v => v === 0 || v === 1)) return { error: ar ? 'Y يجب أن يكون 0 أو 1 (ثنائي)' : 'Y must be binary (0 or 1)' };
    const predNames = varNames.slice(1, k);
    const Xraw = D.map(r => r.slice(1));
    const Xm = Xraw.map(r => [1, ...r]);  // add intercept
    const fit = logisticFit(Xm, y);
    const depName = varNames[0];
    const allNames = ['(Intercept)', ...predNames];
    const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
    const pC = (p: number) => p < 0.05 ? C.green : C.muted;
    const stars = (p: number) => p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
    const pv = fit.beta.map((b, j) => 2 * (1 - normalCDF(Math.abs(b / Math.max(1e-10, fit.se[j])))));
    const chi2 = -2 * (fit.LL0 - fit.LL);
    const df = k - 1;
    const chi2p = 1 - chiSqP(chi2, df);
    const mcFadden = 1 - fit.LL / fit.LL0;
    const nagel = (1 - Math.exp(-chi2 / n)) / (1 - Math.exp(2 * fit.LL0 / n));
    const aic = -2 * fit.LL + 2 * k;
    const cutoff = 0.5;
    const classified = fit.p.map((pi, i) => ({ pred: pi >= cutoff ? 1 : 0, actual: y[i] }));
    const correct = classified.filter(c => c.pred === c.actual).length;
    const accuracy = correct / n;
    // AUC (trapezoidal)
    const sorted = [...fit.p.map((pi, i) => ({ pi, y: y[i] }))].sort((a, b) => b.pi - a.pi);
    let tp = 0, fp = 0, prevTp = 0, prevFp = 0;
    const posN = y.filter(v => v === 1).length, negN = n - posN;
    let auc = 0;
    for (const { y: yi } of sorted) {
      if (yi === 1) tp++; else fp++;
      auc += (fp - prevFp) * (tp + prevTp) / 2;
      prevTp = tp; prevFp = fp;
    }
    auc /= Math.max(1, posN * negN);
    const chartData = predNames.slice(0, 8).map((name, i) => ({
      name, beta: fit.beta[i + 1], or: Math.exp(fit.beta[i + 1]),
      ci_lo: Math.exp(fit.beta[i + 1] - 1.96 * fit.se[i + 1]),
      ci_hi: Math.exp(fit.beta[i + 1] + 1.96 * fit.se[i + 1]),
    }));
    return { n, k, depName, allNames, predNames, fit, pv, chi2, df, chi2p, mcFadden, nagel, aic, accuracy, auc, pFmt, pC, stars, chartData };
  }, [raw]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'البيانات — العمود الأول: Y (0 أو 1) · الأعمدة التالية: المتنبئات · السطر الأول: أسماء المتغيرات (اختياري) · CSV/Tab'
            : 'Data — col 1: Y (binary 0/1) · remaining: predictors · row 1: variable names (optional) · CSV/tab'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 6 صفوف على الأقل وعمودان (Y ثنائي + متنبئ)' : 'Need ≥ 6 rows and ≥ 2 columns (binary Y + predictor)'}</p>}
      {'error' in (result ?? {}) && <p style={{ color: C.red, fontSize: 13 }}>{(result as { error: string }).error}</p>}

      {result && !('error' in result) && (() => {
        const r = result as Exclude<typeof result, { error: string } | null>;
        return (
          <>
            {/* Model summary */}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { l: 'McFadden R²', v: r.mcFadden.toFixed(4), c: r.mcFadden >= 0.2 ? C.green : r.mcFadden >= 0.1 ? C.gold : C.sub },
                { l: "Nagelkerke R²", v: r.nagel.toFixed(4), c: C.sub },
                { l: `χ²(${r.df})`, v: r.chi2.toFixed(3), c: C.text },
                { l: 'p(χ²)', v: r.pFmt(r.chi2p), c: r.chi2p < 0.05 ? C.green : C.red },
                { l: 'AIC', v: r.aic.toFixed(2), c: C.sub },
                { l: ar ? 'دقة التصنيف' : 'Accuracy', v: `${(r.accuracy * 100).toFixed(1)}%`, c: r.accuracy >= 0.8 ? C.green : r.accuracy >= 0.7 ? C.gold : C.sub },
                { l: 'AUC', v: r.auc.toFixed(4), c: r.auc >= 0.9 ? C.green : r.auc >= 0.7 ? C.teal : r.auc >= 0.6 ? C.gold : C.red },
                { l: 'n', v: String(r.n), c: C.sub },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Coefficient table */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
                {ar ? `جدول المعاملات — المتغير التابع: ${r.depName}` : `Coefficients — Dependent: ${r.depName}`}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {[ar?'المتغير':'Variable','β','SE','z','p','OR','95% CI (OR)'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'center', color: C.sub, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {r.allNames.map((name, j) => {
                      const pv = r.pv[j], b = r.fit.beta[j], se = r.fit.se[j];
                      const or = Math.exp(b), ci_lo = Math.exp(b - 1.96 * se), ci_hi = Math.exp(b + 1.96 * se);
                      return (
                        <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: j === 0 ? 400 : 700, color: j === 0 ? C.sub : C.text }}>{name}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: b >= 0 ? C.teal : '#f97316', fontWeight: 700 }}>{b.toFixed(4)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{se.toFixed(4)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text }}>{(b / Math.max(1e-10, se)).toFixed(3)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: r.pC(pv), fontWeight: pv < 0.05 ? 700 : 400 }}>{r.pFmt(pv)}<sup style={{ color: C.gold }}>{r.stars(pv)}</sup></td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: or > 1 ? C.teal : or < 1 ? '#f97316' : C.sub, fontWeight: 700 }}>{j === 0 ? '—' : or.toFixed(4)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub, fontSize: 10 }}>{j === 0 ? '—' : `[${ci_lo.toFixed(3)}, ${ci_hi.toFixed(3)}]`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* OR chart */}
            {r.chartData.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar ? 'نسب الأرجحية (OR) مع CI 95%' : 'Odds Ratios with 95% CI'}</div>
                <ResponsiveContainer width="100%" height={Math.max(120, r.chartData.length * 36)}>
                  <BarChart data={r.chartData} layout="vertical" margin={{ top: 4, right: 50, left: 70, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                    <XAxis type="number" tick={{ fontSize: 9, fill: C.sub }} domain={['auto','auto']}/>
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: C.sub }} width={65}/>
                    <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} formatter={(v: number) => v.toFixed(4)}/>
                    <ReferenceLine x={1} stroke={C.gold} strokeDasharray="4 2"/>
                    <Bar dataKey="or" fill={C.blue} radius={4} label={{ position: 'right', fontSize: 9, fill: C.sub, formatter: (v: number) => v.toFixed(3) }}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 11, color: C.sub }}>
              <strong style={{ color: C.gold }}>APA: </strong>
              {ar
                ? `أشار نموذج الانحدار اللوجستي إلى دلالة إحصائية للنموذج الكلي: χ²(${r.df}) = ${r.chi2.toFixed(2)}, p = ${r.pFmt(r.chi2p)}, McFadden R² = ${r.mcFadden.toFixed(3)}, AUC = ${r.auc.toFixed(3)}`
                : `The logistic regression model was statistically significant: χ²(${r.df}) = ${r.chi2.toFixed(2)}, p = ${r.pFmt(r.chi2p)}, McFadden R² = ${r.mcFadden.toFixed(3)}, AUC = ${r.auc.toFixed(3)}`}
              <br /><span style={{ fontSize: 10, color: C.muted }}>* p&lt;.05 · ** p&lt;.01 · *** p&lt;.001 · OR &gt; 1 = {ar?'يزيد احتمال Y=1':'increases odds of Y=1'}</span>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── McDONALD'S OMEGA ──────────────────────────────────────────────────────
function OmegaRel({ ar }: { ar: boolean }) {
  const DEF = `i1,i2,i3,i4,i5,i6,i7,i8
4,3,4,5,4,3,4,4
2,2,3,2,2,3,2,3
5,5,5,4,5,5,5,5
3,4,3,3,3,4,3,4
4,4,5,4,4,4,4,5
2,3,2,2,2,2,2,3
5,4,5,5,5,5,5,4
3,3,4,3,3,3,3,3
4,5,4,5,4,5,4,5
2,2,2,3,2,2,2,2
5,5,5,5,5,5,5,5
3,4,3,3,3,3,3,4
4,4,4,4,4,4,4,4
2,2,3,2,3,2,2,2
5,5,4,5,5,5,5,5`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].trim().split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const itemNames = hasHeader ? firstCells.map(h => h.trim()) : Array.from({ length: firstCells.length }, (_, i) => `i${i + 1}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.trim().split(sep).map(v => parseFloat(v.trim())).filter(v => isFinite(v)));
    const k = Math.min(...data.map(r => r.length), itemNames.length);
    if (k < 3 || data.length < 5) return null;
    const n = data.length;
    const D = data.map(r => r.slice(0, k));

    // Correlation matrix
    const R: number[][] = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => i === j ? 1 : pearson(D.map(r => r[i]), D.map(r => r[j]))));

    // Alpha (standardized)
    const rBar = R.flat().filter((_, idx) => idx % (k + 1) !== 0).reduce((s, v) => s + v, 0) / (k * (k - 1));
    const alpha = (k * rBar) / (1 + (k - 1) * rBar);

    // Omega: extract first factor via power iteration on R
    let v = Array(k).fill(1 / Math.sqrt(k));
    for (let iter = 0; iter < 200; iter++) {
      const Rv = R.map(row => row.reduce((s, rij, j) => s + rij * v[j], 0));
      const norm = Math.sqrt(Rv.reduce((s, x) => s + x * x, 0));
      const vNew = Rv.map(x => x / Math.max(1e-10, norm));
      if (vNew.reduce((s, x, i) => s + (x - v[i]) ** 2, 0) < 1e-14) { v = vNew; break; }
      v = vNew;
    }
    const lambda1 = R.map(row => row.reduce((s, rij, j) => s + rij * v[j], 0)).reduce((s, x, i) => s + x * v[i], 0);
    const loadings = v.map(vi => vi * Math.sqrt(Math.max(0, lambda1)));
    const sumL = loadings.reduce((s, l) => s + l, 0);
    const sumL2 = loadings.reduce((s, l) => s + l * l, 0);
    const uniqueness = loadings.map(l => Math.max(0, 1 - l * l));
    const sumU = uniqueness.reduce((s, u) => s + u, 0);
    const omega = (sumL * sumL) / Math.max(1e-10, sumL * sumL + sumU);
    const omegaH = (sumL * sumL) / Math.max(1e-10, k);  // hierarchical (simplified)

    // Interpretation
    const relC = (v: number) => v >= 0.9 ? C.green : v >= 0.8 ? C.teal : v >= 0.7 ? C.gold : C.red;
    const relL = (v: number) => v >= 0.9 ? (ar ? 'ممتاز' : 'Excellent') : v >= 0.8 ? (ar ? 'جيد' : 'Good') : v >= 0.7 ? (ar ? 'مقبول' : 'Acceptable') : (ar ? 'ضعيف' : 'Poor');

    const loadingData = itemNames.slice(0, k).map((name, i) => ({ name, loading: +loadings[i].toFixed(4), uniqueness: +uniqueness[i].toFixed(4) }));

    return { n, k, alpha, omega, omegaH: Math.min(1, omegaH), rBar, lambda1, loadings, loadingData, itemNames: itemNames.slice(0, k), relC, relL };
  }, [raw]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'بيانات الفقرات الخام — السطر الأول: أسماء الفقرات (اختياري) · كل صف = مستجيب · CSV/Tab'
            : 'Raw item data — first row: item names (optional) · each row = respondent · CSV/tab'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 5 مستجيبين و3 فقرات على الأقل' : 'Need ≥ 5 respondents and ≥ 3 items'}</p>}
      {result && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: "McDonald's ω", v: result.omega.toFixed(4), c: result.relC(result.omega), note: result.relL(result.omega) },
              { l: "Cronbach's α", v: result.alpha.toFixed(4), c: result.relC(result.alpha), note: result.relL(result.alpha) },
              { l: 'Δ(ω−α)', v: (result.omega - result.alpha >= 0 ? '+' : '') + (result.omega - result.alpha).toFixed(4), c: result.omega >= result.alpha ? C.teal : '#f97316', note: '' },
            ].map(({ l, v, c, note }) => (
              <div key={l} style={{ background: C.card, border: `2px solid ${c}`, borderRadius: 14, padding: '14px 22px', textAlign: 'center', minWidth: 120 }}>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: c }}>{v}</div>
                {note && <div style={{ fontSize: 11, color: c, fontWeight: 700 }}>{note}</div>}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'center' }}>
              {[
                { l: 'k (items)', v: String(result.k) }, { l: 'n', v: String(result.n) },
                { l: 'r̄ (mean r)', v: result.rBar.toFixed(4) }, { l: 'λ₁', v: result.lambda1.toFixed(4) },
              ].map(({ l, v }) => (
                <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 12px', textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Factor loading bar chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>
              {ar ? 'تشبعات العامل الأول وتفرّدات الفقرات' : 'First Factor Loadings & Item Uniqueness'}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(150, result.k * 30)}>
              <BarChart data={result.loadingData} layout="vertical" margin={{ top: 4, right: 60, left: 30, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: C.sub }}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: C.sub }} width={28}/>
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} formatter={(v: number) => v.toFixed(4)}/>
                <Legend wrapperStyle={{ fontSize: 10 }}/>
                <Bar dataKey="loading" name={ar?'تشبع':'Loading'} fill={C.blue} radius={3} label={{ position: 'right', fontSize: 9, fill: C.sub, formatter: (v: number) => v.toFixed(3) }}/>
                <Bar dataKey="uniqueness" name={ar?'تفرّد':'Uniqueness'} fill={`${C.red}66`} radius={3}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 11, color: C.sub }}>
            <strong style={{ color: C.gold }}>{ar ? 'تفسير: ' : 'Note: '}</strong>
            {ar
              ? `ω = ${result.omega.toFixed(3)} مقابل α = ${result.alpha.toFixed(3)}. ${result.omega > result.alpha ? 'ω > α يشير إلى تباين في تشبعات الفقرات (غير tau-equivalent) — يُفضَّل ω.' : 'ω ≈ α يشير إلى توازٍ في تشبعات الفقرات — كلاهما مناسب.'} McDonald (1999): ω هو مقدار غير متحيّز لموثوقية الدرجة المركّبة.`
              : `ω = ${result.omega.toFixed(3)} vs. α = ${result.alpha.toFixed(3)}. ${result.omega > result.alpha ? 'ω > α indicates unequal factor loadings (non-tau-equivalent) — ω is preferred.' : 'ω ≈ α indicates parallel items — both are appropriate.'} McDonald (1999): ω is an unbiased estimate of composite reliability.`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── TWO-PROPORTION Z-TEST ─────────────────────────────────────────────────
function TwoPropZ({ ar }: { ar: boolean }) {
  const [x1, setX1] = useState('47'); const [n1, setN1] = useState('120');
  const [x2, setX2] = useState('38'); const [n2, setN2] = useState('110');
  const [conf, setConf] = useState(95);
  const [tail, setTail] = useState<'two'|'greater'|'less'>('two');

  const z_crit = conf === 99 ? 2.576 : conf === 90 ? 1.645 : 1.960;

  const result = useMemo(() => {
    const x1n=parseFloat(x1),n1n=parseFloat(n1),x2n=parseFloat(x2),n2n=parseFloat(n2);
    if ([x1n,n1n,x2n,n2n].some(v=>!isFinite(v))||n1n<2||n2n<2||x1n<0||x1n>n1n||x2n<0||x2n>n2n) return null;
    const p1=x1n/n1n, p2=x2n/n2n;
    const pPool=(x1n+x2n)/(n1n+n2n);
    const se_z=Math.sqrt(pPool*(1-pPool)*(1/n1n+1/n2n));
    const se_ci=Math.sqrt(p1*(1-p1)/n1n+p2*(1-p2)/n2n);
    const diff=p1-p2;
    const z=diff/Math.max(1e-10,se_z);
    let pv: number;
    if (tail==='two') pv=2*(1-normalCDF(Math.abs(z)));
    else if (tail==='greater') pv=1-normalCDF(z);
    else pv=normalCDF(z);
    const ci_lo=diff-z_crit*se_ci, ci_hi=diff+z_crit*se_ci;
    // Cohen's h
    const phi1=2*Math.asin(Math.sqrt(p1)), phi2=2*Math.asin(Math.sqrt(p2));
    const h=Math.abs(phi1-phi2);
    const hLbl = h>=0.8?(ar?'كبير':'Large'):h>=0.5?(ar?'متوسط':'Medium'):(ar?'صغير':'Small');
    const hC = h>=0.8?C.red:h>=0.5?C.gold:C.teal;
    const pFmt = (p:number) => p<0.001?'< .001':p.toFixed(3);
    const sig = pv<0.05;
    const or=(p1*(1-p2))/Math.max(1e-10,(p2*(1-p1)));
    const rr=p1/Math.max(1e-10,p2);
    return { p1,p2,pPool,se_z,se_ci,diff,z,pv,ci_lo:Math.max(-1,ci_lo),ci_hi:Math.min(1,ci_hi),h,hLbl,hC,or,rr,sig,pFmt };
  }, [x1,n1,x2,n2,conf,tail,z_crit]);

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
        {([
          {l:`x₁ (${ar?'نجاح':'Successes'})`,v:x1,s:setX1},{l:`n₁`,v:n1,s:setN1},
          {l:`x₂ (${ar?'نجاح':'Successes'})`,v:x2,s:setX2},{l:`n₂`,v:n2,s:setN2}
        ]).map(({l,v,s})=>(
          <div key={l}>
            <label style={{fontSize:11,color:C.sub,display:'block',marginBottom:3}}>{l}</label>
            <input value={v} onChange={e=>s(e.target.value)} type="number" min="0"
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',color:C.text,fontSize:18,fontWeight:800,direction:'ltr',boxSizing:'border-box'}}/>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{fontSize:12,color:C.sub}}>{ar?'مستوى الثقة:':'Confidence:'}</span>
        {[90,95,99].map(c=>(
          <button key={c} onClick={()=>setConf(c)} style={{ background:conf===c?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${conf===c?C.gold:C.border}`, borderRadius:7, padding:'5px 12px', color:conf===c?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:conf===c?700:400, fontSize:12 }}>{c}%</button>
        ))}
        <span style={{fontSize:12,color:C.sub,marginLeft:12}}>{ar?'الطرف:':'Tail:'}</span>
        {([['two',ar?'طرفان':'Two-tailed'],['greater',ar?'أكبر (p₁>p₂)':'Greater (p₁>p₂)'],['less',ar?'أصغر (p₁<p₂)':'Less (p₁<p₂)']] as const).map(([t,lbl])=>(
          <button key={t} onClick={()=>setTail(t)} style={{ background:tail===t?'rgba(94,234,212,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${tail===t?C.teal:C.border}`, borderRadius:7, padding:'5px 12px', color:tail===t?C.teal:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:tail===t?700:400, fontSize:11 }}>{lbl}</button>
        ))}
      </div>

      {!result && <p style={{color:C.muted,fontSize:13}}>{ar?'أدخل قيماً صحيحة (x ≤ n)':'Enter valid values (x ≤ n)'}</p>}
      {result && (
        <>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
            <div style={{background:C.card,border:`2px solid ${result.sig?C.green:C.red}`,borderRadius:12,padding:'12px 20px',textAlign:'center'}}>
              <div style={{fontSize:11,color:C.sub}}>p-value ({tail==='two'?(ar?'طرفان':'two-tailed'):tail==='greater'?(ar?'أكبر':'greater'):(ar?'أصغر':'less')})</div>
              <div style={{fontSize:30,fontWeight:900,color:result.sig?C.green:C.red}}>{result.pFmt(result.pv)}</div>
              <div style={{fontSize:11,color:result.sig?C.green:C.red,fontWeight:700}}>{result.sig?(ar?'دال':'Significant'):(ar?'غير دال':'Not significant')}</div>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignSelf:'center'}}>
              {[
                {l:'p̂₁',v:`${(result.p1*100).toFixed(1)}%`,c:C.teal},{l:'p̂₂',v:`${(result.p2*100).toFixed(1)}%`,c:C.blue},
                {l:'Δp̂',v:`${(result.diff*100).toFixed(2)}%`,c:C.text},{l:'z',v:result.z.toFixed(3),c:C.text},
                {l:`${conf}% CI`,v:`[${(result.ci_lo*100).toFixed(2)}%, ${(result.ci_hi*100).toFixed(2)}%]`,c:C.blue},
                {l:"Cohen's h",v:result.h.toFixed(3),c:result.hC},{l:'OR',v:result.or.toFixed(3),c:C.sub},{l:'RR',v:result.rr.toFixed(3),c:C.sub},
              ].map(({l,v,c})=>(
                <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'6px 12px',textAlign:'center',minWidth:72}}>
                  <div style={{fontSize:9,color:C.sub}}>{l}</div>
                  <div style={{fontSize:11,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Proportion visual */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px',marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:12}}>{ar?'مقارنة النسب':'Proportion Comparison'}</div>
            {[{lbl:ar?'المجموعة 1':'Group 1',p:result.p1,x:parseFloat(x1),n:parseFloat(n1),color:C.teal},
              {lbl:ar?'المجموعة 2':'Group 2',p:result.p2,x:parseFloat(x2),n:parseFloat(n2),color:C.blue}].map(({lbl,p,x,n,color})=>(
              <div key={lbl} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.sub,marginBottom:4}}>
                  <span>{lbl}</span><span style={{color,fontWeight:700}}>{x}/{n} = {(p*100).toFixed(1)}%</span>
                </div>
                <div style={{height:20,background:'rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${p*100}%`,background:color,borderRadius:10}}/>
                </div>
              </div>
            ))}
            <div style={{fontSize:11,color:C.sub,marginTop:8}}>
              {ar?'حجم الأثر:':'Effect size:'} Cohen&apos;s h = {result.h.toFixed(3)} <span style={{color:result.hC,fontWeight:700}}>({result.hLbl})</span>
              <span style={{color:C.muted}}> · {ar?'معيار Cohen: .20 صغير · .50 متوسط · .80 كبير':'Cohen (1988): .20 small · .50 medium · .80 large'}</span>
            </div>
          </div>

          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'10px 16px',fontSize:12,color:C.sub}}>
            <strong style={{color:C.gold}}>APA: </strong>
            {ar
              ?`كانت نسبة المجموعة 1 (${(result.p1*100).toFixed(1)}%) ${result.sig?'أعلى دلالياً من':'لا تختلف دلالياً عن'} نسبة المجموعة 2 (${(result.p2*100).toFixed(1)}%)، z = ${result.z.toFixed(2)}, p = ${result.pFmt(result.pv)}, ${conf}% CI [${(result.ci_lo*100).toFixed(2)}%, ${(result.ci_hi*100).toFixed(2)}%], h = ${result.h.toFixed(3)}`
              :`Proportion 1 (${(result.p1*100).toFixed(1)}%) was ${result.sig?'significantly different from':'not significantly different from'} Proportion 2 (${(result.p2*100).toFixed(1)}%), z = ${result.z.toFixed(2)}, p = ${result.pFmt(result.pv)}, ${conf}% CI [${(result.ci_lo*100).toFixed(2)}%, ${(result.ci_hi*100).toFixed(2)}%], h = ${result.h.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── COHEN'S KAPPA ─────────────────────────────────────────────────────────
function CohenKappa({ ar }: { ar: boolean }) {
  const DEF = `1 1
2 2
1 2
1 1
2 1
3 3
2 2
1 1
3 2
3 3
2 2
1 1
3 3
2 2
1 1
2 3
1 1
2 2
3 3
2 2`;
  const [raw, setRaw] = useState(DEF);
  const [useWeighted, setUseWeighted] = useState(false);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const ratings: [number, number][] = [];
    for (const line of lines) {
      const parts = line.trim().split(/[\s,\t]+/);
      if (parts.length < 2) continue;
      const r1 = parseFloat(parts[0]), r2 = parseFloat(parts[1]);
      if (isFinite(r1) && isFinite(r2)) ratings.push([r1, r2]);
    }
    if (ratings.length < 5) return null;
    const n = ratings.length;
    const cats = [...new Set([...ratings.map(r => r[0]), ...ratings.map(r => r[1])])].sort((a, b) => a - b);
    const k = cats.length;
    const matrix: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
    for (const [r1, r2] of ratings) {
      const i = cats.indexOf(r1), j = cats.indexOf(r2);
      if (i >= 0 && j >= 0) matrix[i][j]++;
    }
    const rowT = matrix.map(row => row.reduce((s, v) => s + v, 0));
    const colT = Array.from({ length: k }, (_, j) => matrix.reduce((s, row) => s + row[j], 0));
    const Po = matrix.reduce((s, row, i) => s + row[i], 0) / n;
    const Pe = rowT.reduce((s, ri, i) => s + (ri / n) * (colT[i] / n), 0);
    const kappa = Pe >= 1 ? 0 : (Po - Pe) / (1 - Pe);

    let kappaW: number | null = null;
    if (k > 2 && useWeighted) {
      const maxD = k - 1;
      let PoW = 0, PeW = 0;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const w = 1 - Math.abs(i - j) / maxD;
        PoW += w * matrix[i][j] / n;
        PeW += w * (rowT[i] / n) * (colT[j] / n);
      }
      kappaW = PeW >= 1 ? 0 : (PoW - PeW) / (1 - PeW);
    }

    const se = Math.sqrt((Po * (1 - Po)) / Math.max(1, n * (1 - Pe) ** 2));
    const ci_lo = kappa - 1.96 * se, ci_hi = kappa + 1.96 * se;
    const z = kappa / Math.max(1e-10, se);
    const pv = 2 * (1 - normalCDF(Math.abs(z)));

    return { n, k, cats, matrix, rowT, colT, Po, Pe, kappa, kappaW, se, ci_lo, ci_hi, z, pv };
  }, [raw, useWeighted]);

  const kC = (v: number) => v >= 0.81 ? C.green : v >= 0.61 ? C.teal : v >= 0.41 ? C.blue : v >= 0.21 ? C.gold : C.red;
  const kL = (v: number) => v >= 0.81 ? (ar ? 'ممتاز تقريباً' : 'Almost perfect') : v >= 0.61 ? (ar ? 'قوي' : 'Substantial') : v >= 0.41 ? (ar ? 'متوسط' : 'Moderate') : v >= 0.21 ? (ar ? 'معقول' : 'Fair') : v >= 0 ? (ar ? 'طفيف' : 'Slight') : (ar ? 'ضعيف' : 'Poor');
  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: C.sub }}>
          <input type="checkbox" checked={useWeighted} onChange={e => setUseWeighted(e.target.checked)} style={{ marginRight: 6 }} />
          {ar ? 'كاپا مرجّحة (للفئات الترتيبية)' : 'Weighted κ (linear, for ordinal categories)'}
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'كل سطر: تقدير المحكّم 1 ثم تقدير المحكّم 2' : 'Each row: Rater 1 rating, Rater 2 rating (space/comma separated)'}
          </label>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={10}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          {result && (
            <>
              {/* Main stats */}
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ background: C.card, border: `2px solid ${kC(result.kappa)}`, borderRadius: 12, padding: '12px 22px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: C.sub }}>{ar ? 'كاپا Cohen' : "Cohen's κ"}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: kC(result.kappa) }}>{result.kappa.toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: kC(result.kappa), fontWeight: 700 }}>{kL(result.kappa)}</div>
                </div>
                {result.kappaW !== null && (
                  <div style={{ background: C.card, border: `2px solid ${kC(result.kappaW)}`, borderRadius: 12, padding: '12px 22px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.sub }}>{ar ? 'كاپا مرجّحة' : 'Weighted κ'}</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: kC(result.kappaW) }}>{result.kappaW.toFixed(4)}</div>
                    <div style={{ fontSize: 12, color: kC(result.kappaW), fontWeight: 700 }}>{kL(result.kappaW)}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { l: 'Po (observed)', v: result.Po.toFixed(4) }, { l: 'Pe (expected)', v: result.Pe.toFixed(4) },
                  { l: 'SE', v: result.se.toFixed(4) }, { l: 'z', v: result.z.toFixed(3) },
                  { l: 'p', v: pFmt(result.pv), c: result.pv < 0.05 ? C.green : C.red },
                  { l: '95% CI', v: `[${result.ci_lo.toFixed(3)}, ${result.ci_hi.toFixed(3)}]`, c: C.blue },
                  { l: 'n', v: String(result.n) }, { l: 'k cats', v: String(result.k) },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 72 }}>
                    <div style={{ fontSize: 9, color: C.sub }}>{l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c ?? C.text }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', fontSize: 11, color: C.sub }}>
                <strong style={{ color: C.gold }}>APA: </strong>
                {`κ = ${result.kappa.toFixed(3)}, SE = ${result.se.toFixed(3)}, p = ${pFmt(result.pv)}, 95% CI [${result.ci_lo.toFixed(3)}, ${result.ci_hi.toFixed(3)}]`}
                <br /><span style={{ fontSize: 10, color: C.muted }}>
                  {ar ? 'Landis & Koch (1977): ≥.81 ممتاز · .61–.80 قوي · .41–.60 متوسط · .21–.40 معقول · .01–.20 طفيف · ≤0 ضعيف'
                    : 'Landis & Koch (1977): ≥.81 Almost perfect · .61–.80 Substantial · .41–.60 Moderate · .21–.40 Fair · .01–.20 Slight · ≤0 Poor'}
                </span>
              </div>
            </>
          )}
          {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 5 زوج تقدير على الأقل' : 'Need ≥ 5 rating pairs'}</p>}
        </div>
      </div>

      {result && result.k <= 8 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
            {ar ? 'مصفوفة الاتفاق' : 'Agreement Matrix'} (n = {result.n})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, margin: '8px' }}>
              <thead><tr>
                <th style={{ padding: '4px 10px', color: C.sub }}>{ar ? 'م2↓ / م1→' : 'R2↓ R1→'}</th>
                {result.cats.map(c => <th key={c} style={{ padding: '4px 10px', textAlign: 'center', color: C.gold }}>{c}</th>)}
                <th style={{ padding: '4px 10px', textAlign: 'center', color: C.sub }}>{ar ? 'المجموع' : 'Total'}</th>
              </tr></thead>
              <tbody>
                {result.cats.map((cat, i) => (
                  <tr key={cat} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '4px 10px', fontWeight: 700, color: C.gold }}>{cat}</td>
                    {result.matrix[i].map((v, j) => (
                      <td key={j} style={{ padding: '4px 10px', textAlign: 'center', background: i === j ? 'rgba(94,234,212,0.12)' : 'transparent', fontWeight: i === j ? 700 : 400, color: i === j ? C.teal : C.text }}>{v}</td>
                    ))}
                    <td style={{ padding: '4px 10px', textAlign: 'center', color: C.sub }}>{result.rowT[i]}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '4px 10px', color: C.sub }}>{ar ? 'المجموع' : 'Total'}</td>
                  {result.colT.map((v, j) => <td key={j} style={{ padding: '4px 10px', textAlign: 'center', color: C.sub }}>{v}</td>)}
                  <td style={{ padding: '4px 10px', textAlign: 'center', fontWeight: 700, color: C.text }}>{result.n}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── HIERARCHICAL REGRESSION (ΔR²) ─────────────────────────────────────────
function HierarchReg({ ar }: { ar: boolean }) {
  const DEF = `score age gender gpa motivation anxiety
75 22 1 3.8 4.1 3.2
82 24 0 3.5 3.8 2.8
68 21 1 2.9 3.0 4.1
90 25 0 3.9 4.5 2.1
71 23 1 3.2 3.3 3.7
85 22 0 3.7 4.2 2.5
78 24 1 3.4 3.7 3.0
65 21 0 2.7 2.8 4.5
88 23 1 3.8 4.4 2.3
73 25 0 3.1 3.1 3.9
80 22 1 3.6 4.0 2.7
76 23 0 3.3 3.6 3.4
84 24 1 3.7 4.3 2.6
70 21 0 3.0 3.2 3.8
87 23 1 3.9 4.6 2.2`;
  const [raw, setRaw] = useState(DEF);
  const [block1N, setBlock1N] = useState('2');

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 5) return null;
    const firstCells = lines[0].trim().split(/[\s,\t]+/);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v)));
    const headers = hasHeader ? firstCells : Array.from({ length: firstCells.length }, (_, i) => i === 0 ? 'Y' : `X${i}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.trim().split(/[\s,\t;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v)));
    const pTotal = Math.min(...data.map(r => r.length));
    if (data.length < pTotal + 1 || pTotal < 3) return null;
    const D = data.map(r => r.slice(0, pTotal));
    const n = D.length, kTotal = pTotal - 1;
    const Y = D.map(r => r[0]);
    const Xall = D.map(r => r.slice(1));
    const b1n = Math.max(1, Math.min(parseInt(block1N) || 1, kTotal - 1));
    const depName = headers[0] ?? 'Y';
    const predNames = headers.slice(1, pTotal);
    const pred1 = predNames.slice(0, b1n), pred2 = predNames.slice(b1n);

    const X1 = Xall.map(r => r.slice(0, b1n));
    const reg1 = olsRegression(X1, Y, depName, pred1);
    const reg2 = olsRegression(Xall, Y, depName, predNames);
    if (!reg1 || !reg2) return null;

    const deltaR2 = reg2.R2 - reg1.R2;
    const k1 = b1n, k2 = kTotal;
    const ddf = k2 - k1;
    const dF = ((deltaR2 / ddf) / Math.max(1e-10, (1 - reg2.R2) / (n - k2 - 1)));
    const dpv = 1 - chiSqP(dF * ddf, ddf);

    return { n, k1, k2, ddf, Y, Xall, pred1, pred2, depName, reg1, reg2, deltaR2, dF, dpv };
  }, [raw, block1N]);

  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const pC = (p: number) => p < 0.05 ? C.green : C.red;
  const r2C = (r2: number) => r2 >= 0.5 ? C.green : r2 >= 0.3 ? C.gold : r2 >= 0.1 ? C.teal : C.muted;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 120px', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'البيانات — السطر الأول: أسماء المتغيرات · العمود الأول: Y · الأعمدة التالية: المتنبئات (بلوك 1 أولاً ثم بلوك 2)'
              : 'Data — first row: var names · col 1: Y · remaining: predictors (Block 1 first, then Block 2)'}
          </label>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'عدد متنبئات البلوك 1' : '# Block 1 predictors'}
          </label>
          <input type="number" value={block1N} onChange={e => setBlock1N(e.target.value)} min="1"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px', color: C.text, fontSize: 22, fontWeight: 800, direction: 'ltr', boxSizing: 'border-box', textAlign: 'center' }} />
        </div>
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 3 أعمدة على الأقل (Y + بلوك1 + بلوك2)' : 'Need ≥ 3 columns (Y + block1 + block2)'}</p>}

      {result && (
        <>
          {/* Block labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { lbl: ar ? 'البلوك 1 (الضبط/السياق)' : 'Block 1 (Controls)', preds: result.pred1, reg: result.reg1, color: C.teal },
              { lbl: ar ? 'البلوك 1 + 2 (النموذج الكامل)' : 'Block 1 + 2 (Full Model)', preds: result.pred1.concat(result.pred2), reg: result.reg2, color: C.blue },
            ].map(({ lbl, preds, reg, color }) => (
              <div key={lbl} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color, marginBottom: 8 }}>{lbl}</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{preds.join(' + ')}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                  <span>R² = <strong style={{ color: r2C(reg.R2) }}>{reg.R2.toFixed(4)}</strong></span>
                  <span>Adj.R² = <strong style={{ color: C.sub }}>{reg.adjR2.toFixed(4)}</strong></span>
                  <span>F = <strong style={{ color: C.text }}>{reg.F.toFixed(3)}</strong></span>
                  <span>p = <strong style={{ color: pC(reg.pF) }}>{pFmt(reg.pF)}</strong></span>
                </div>
                <div style={{ marginTop: 10 }}>
                  {reg.vars.slice(1).map((v, i) => (
                    <div key={v} style={{ display: 'flex', gap: 12, fontSize: 11, color: C.sub, borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '3px 0' }}>
                      <span style={{ minWidth: 70, fontWeight: 600, color: C.text }}>{v}</span>
                      <span>β={reg.beta[i + 1].toFixed(3)}</span>
                      <span>t={reg.tStat[i + 1].toFixed(3)}</span>
                      <span style={{ color: reg.pVal[i + 1] < 0.05 ? C.green : C.muted }}>p={pFmt(reg.pVal[i + 1])}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ΔR² highlight */}
          <div style={{ background: `rgba(201,168,76,0.1)`, border: `2px solid ${C.gold}`, borderRadius: 14, padding: '16px 24px', marginBottom: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? 'زيادة R² (ΔR²)' : 'R² Change (ΔR²)'}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.gold }}>{result.deltaR2.toFixed(4)}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{(result.deltaR2 * 100).toFixed(1)}% {ar ? 'تباين إضافي' : 'additional variance'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { l: `ΔF(${result.ddf},${result.n - result.k2 - 1})`, v: result.dF.toFixed(3), c: C.text },
                { l: 'p(ΔF)', v: pFmt(result.dpv), c: pC(result.dpv) },
                { l: 'Δk predictors', v: String(result.k2 - result.k1), c: C.sub },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 10, color: C.sub }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: result.dpv < 0.05 ? C.green : C.muted, fontWeight: result.dpv < 0.05 ? 700 : 400 }}>
              {result.dpv < 0.05
                ? (ar ? `✓ إضافة [${result.pred2.join(', ')}] تفسّر ${(result.deltaR2 * 100).toFixed(1)}% إضافي دلالياً` : `✓ Adding [${result.pred2.join(', ')}] explains ${(result.deltaR2 * 100).toFixed(1)}% additional variance significantly`)
                : (ar ? `✗ إضافة البلوك 2 لا تفسّر تبايناً إضافياً دالاً` : `✗ Block 2 addition does not explain significant additional variance`)}
            </div>
          </div>

          {/* Visual R² bars */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 12 }}>{ar ? 'التباين المفسَّر' : 'Variance Explained'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { lbl: ar ? 'البلوك 1' : 'Block 1', r2: result.reg1.R2, color: C.teal },
                { lbl: ar ? 'البلوك 1 + 2' : 'Block 1+2', r2: result.reg2.R2, color: C.blue },
              ].map(({ lbl, r2, color }) => (
                <div key={lbl}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub, marginBottom: 4 }}>
                    <span>{lbl}</span><span style={{ color, fontWeight: 700 }}>R² = {r2.toFixed(4)}</span>
                  </div>
                  <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r2 * 100}%`, background: color, borderRadius: 7 }}/>
                  </div>
                </div>
              ))}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gold, marginBottom: 4, fontWeight: 700 }}>
                  <span>{ar ? 'ΔR² (البلوك 2 وحده)' : 'ΔR² (Block 2 only)'}</span>
                  <span>ΔR² = {result.deltaR2.toFixed(4)}</span>
                </div>
                <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', display: 'flex' }}>
                    <div style={{ width: `${result.reg1.R2 * 100}%`, background: `${C.teal}44`, borderRadius: 0 }}/>
                    <div style={{ width: `${result.deltaR2 * 100}%`, background: C.gold, borderRadius: 0 }}/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 12, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {ar
              ? `أضافت متغيرات البلوك 2 [${result.pred2.join(', ')}] تبايناً إضافياً دالاً (ΔR² = ${result.deltaR2.toFixed(3)}, ΔF(${result.ddf}, ${result.n - result.k2 - 1}) = ${result.dF.toFixed(2)}, p = ${pFmt(result.dpv)})`
              : `Block 2 variables [${result.pred2.join(', ')}] explained additional variance (ΔR² = ${result.deltaR2.toFixed(3)}, ΔF(${result.ddf}, ${result.n - result.k2 - 1}) = ${result.dF.toFixed(2)}, p = ${pFmt(result.dpv)})`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ICC — INTRACLASS CORRELATION COEFFICIENT ─────────────────────────────
function IccCalc({ ar }: { ar: boolean }) {
  const DEF = `Rater1,Rater2,Rater3
82,80,84
77,79,78
91,89,93
68,71,70
85,84,87
73,72,75
88,90,89
79,80,81
92,94,91
74,75,76
86,85,88
70,72,71`;
  const [raw, setRaw] = useState(DEF);
  const [model, setModel] = useState<'icc1'|'icc2'|'icc3'>('icc3');

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 4) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const firstCells = lines[0].split(sep);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v.trim())));
    const raterNames = hasHeader ? firstCells.map(h => h.trim()) : null;
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const data = dataLines.map(l => l.split(sep).map(v => parseFloat(v.trim())).filter(v => isFinite(v) && !isNaN(v)));
    const n = data.length, k = Math.min(...data.map(r => r.length));
    if (n < 3 || k < 2) return null;
    const D = data.map(r => r.slice(0, k));

    const grandMean = avg(D.flat());
    const rowMeans = D.map(r => avg(r));
    const colMeans = Array.from({ length: k }, (_, j) => avg(D.map(r => r[j])));
    const SSR = k * rowMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
    const SSC = n * colMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
    const SST = D.flat().reduce((s, x) => s + (x - grandMean) ** 2, 0);
    const SSE = SST - SSR - SSC;
    const dfR = n - 1, dfC = k - 1, dfE = (n - 1) * (k - 1);
    const MSR = SSR / Math.max(1, dfR), MSC = SSC / Math.max(1, dfC), MSE = SSE / Math.max(1, dfE);

    let icc: number;
    if (model === 'icc1') {
      icc = (MSR - MSE) / (MSR + (k - 1) * MSE);
    } else if (model === 'icc2') {
      icc = (MSR - MSE) / (MSR + (k - 1) * MSE + k * (MSC - MSE) / n);
    } else {
      icc = (MSR - MSE) / (MSR + (k - 1) * MSE);
    }
    icc = Math.max(-1, Math.min(1, icc));

    const F = MSR / Math.max(1e-10, MSE);
    const pv = 1 - chiSqP(F * dfR, dfR);

    const raterStats = Array.from({ length: k }, (_, j) => {
      const vals = D.map(r => r[j]);
      const m = avg(vals);
      const sd = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
      return { name: (raterNames?.[j]) ?? `R${j + 1}`, m, sd };
    });

    const chartData = D.map((row, i) => {
      const obj: Record<string,number> = { subject: i + 1 };
      row.forEach((v, j) => { obj[(raterNames?.[j]) ?? `R${j+1}`] = v; });
      return obj;
    });

    return { n, k, icc, F, pv, SSR, SSC, SSE, dfR, dfC, dfE, MSR, MSC, MSE, raterStats, chartData, raterNames: raterStats.map(r => r.name) };
  }, [raw, model]);

  const iccC = (v: number) => v >= 0.9 ? C.green : v >= 0.75 ? C.teal : v >= 0.5 ? C.gold : C.red;
  const iccL = (v: number) => v >= 0.9 ? (ar?'ممتاز':'Excellent') : v >= 0.75 ? (ar?'جيد':'Good') : v >= 0.5 ? (ar?'متوسط':'Moderate') : (ar?'ضعيف':'Poor');
  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const COLORS = [C.blue, C.teal, C.gold, C.green, C.purple, C.red];

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {([['icc1',ar?'أحادي العشوائية ICC(1,1)':'One-Way Random ICC(1,1)'],['icc2',ar?'ثنائي العشوائية ICC(2,1)':'Two-Way Random ICC(2,1)'],['icc3',ar?'ثنائي مختلط ICC(3,1)':'Two-Way Mixed ICC(3,1)']] as const).map(([m,lbl])=>(
          <button key={m} onClick={()=>setModel(m)}
            style={{ background:model===m?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${model===m?C.gold:C.border}`, borderRadius:9, padding:'7px 14px', color:model===m?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:model===m?700:400, fontSize:12 }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>
          {ar?'البيانات — السطر الأول: أسماء المحكّمين/القياسات (اختياري) · كل سطر = موضوع واحد · كل عمود = محكّم/وقت':
             'Data — first row: rater/measurement names (optional) · each row = one subject · each column = one rater/time'}
        </label>
        <textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={8}
          style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 12px', color:C.text, fontSize:11, fontFamily:'monospace', direction:'ltr', resize:'vertical', boxSizing:'border-box' }}/>
      </div>

      {!result && <p style={{ color:C.muted, fontSize:13 }}>{ar?'يلزم 3 موضوعات وعمودان على الأقل':'Need ≥ 3 subjects and ≥ 2 raters/measurements'}</p>}

      {result && (
        <>
          {/* ICC value */}
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ background:C.card, border:`2px solid ${iccC(result.icc)}`, borderRadius:14, padding:'16px 28px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.sub, marginBottom:4 }}>ICC({model==='icc1'?'1':'2'},{model==='icc3'?'1':'1'})</div>
              <div style={{ fontSize:38, fontWeight:900, color:iccC(result.icc) }}>{result.icc.toFixed(4)}</div>
              <div style={{ fontSize:13, color:iccC(result.icc), fontWeight:700 }}>{iccL(result.icc)}</div>
            </div>
            <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
              {[
                { l:`F(${result.dfR},${result.dfE})`, v:result.F.toFixed(3), c:C.text },
                { l:'p', v:pFmt(result.pv), c:result.pv<0.05?C.green:C.red },
                { l:'n (subjects)', v:String(result.n), c:C.sub },
                { l:'k (raters)', v:String(result.k), c:C.sub },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 14px', textAlign:'center', minWidth:80 }}>
                  <div style={{ fontSize:10, color:C.sub }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Two-way ANOVA table */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <div style={{ padding:'10px 16px', background:'rgba(201,168,76,0.07)', fontWeight:700, fontSize:12, color:C.gold }}>
              {ar?'جدول تحليل التباين الثنائي (Two-Way ANOVA)':'Two-Way ANOVA Table'}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead><tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {[ar?'المصدر':'Source','SS','df','MS'].map(h=>(
                  <th key={h} style={{ padding:'6px 12px', textAlign:'center', color:C.sub, fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { src:ar?'بين الموضوعات (BMS)':'Between Subjects (BMS)', ss:result.SSR, df:result.dfR, ms:result.MSR },
                  { src:ar?'بين المحكّمين (JMS)':'Between Raters (JMS)', ss:result.SSC, df:result.dfC, ms:result.MSC },
                  { src:ar?'الخطأ (EMS)':'Error (EMS)', ss:result.SSE, df:result.dfE, ms:result.MSE },
                  { src:ar?'الكلي':'Total', ss:result.SSR+result.SSC+result.SSE, df:result.dfR+result.dfC+result.dfE, ms:null },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background:i===3?'rgba(201,168,76,0.04)':'transparent' }}>
                    <td style={{ padding:'6px 12px', fontWeight:i===3?700:400, color:i===3?C.gold:C.text }}>{row.src}</td>
                    <td style={{ padding:'6px 12px', textAlign:'center', color:C.sub }}>{row.ss.toFixed(3)}</td>
                    <td style={{ padding:'6px 12px', textAlign:'center', color:C.sub }}>{row.df}</td>
                    <td style={{ padding:'6px 12px', textAlign:'center', color:C.sub }}>{row.ms!=null?row.ms.toFixed(3):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rater profile chart */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:12, color:C.gold, marginBottom:10 }}>
              {ar?'قيم المحكّمين/القياسات لكل موضوع':'Rater/Measurement Profiles per Subject'}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={result.chartData} margin={{ top:4, right:8, left:0, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                <XAxis dataKey="subject" tick={{ fontSize:9, fill:C.sub }} label={{ value:ar?'الموضوع':'Subject', position:'insideBottom', offset:-4, fill:C.sub, fontSize:9 }}/>
                <YAxis tick={{ fontSize:9, fill:C.sub }} width={32}/>
                <Tooltip contentStyle={{ background:'#0d172d', border:`1px solid ${C.border}`, borderRadius:8, fontSize:11 }}/>
                <Legend wrapperStyle={{ fontSize:10 }}/>
                {result.raterNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 16px', fontSize:12, color:C.sub }}>
            <strong style={{ color:C.gold }}>{ar?'التفسير: ':'Interpretation: '}</strong>
            {ar
              ? `ICC = ${result.icc.toFixed(3)} — ${iccL(result.icc)} · معيار Koo & Mae (2016): < .50 ضعيف · .50–.75 متوسط · .75–.90 جيد · ≥ .90 ممتاز`
              : `ICC = ${result.icc.toFixed(3)} — ${iccL(result.icc)} · Koo & Mae (2016): < .50 Poor · .50–.75 Moderate · .75–.90 Good · ≥ .90 Excellent`}
            <br/><span style={{ fontSize:11, color:C.muted, display:'block', marginTop:4 }}>
              {ar?'ICC(1,1): المحكّمون عشوائيون وغير منتظمون · ICC(2,1): المحكّمون عشوائيون واتفاق مطلق · ICC(3,1): المحكّمون ثابتون واتساق'
                 :'ICC(1,1): random raters, absolute · ICC(2,1): random raters, absolute agreement · ICC(3,1): fixed raters, consistency'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── CHI-SQUARE GOODNESS OF FIT ────────────────────────────────────────────
function ChiGoF({ ar }: { ar: boolean }) {
  const [obsRaw, setObsRaw]   = useState('30 45 25 20 35 15');
  const [expRaw, setExpRaw]   = useState('');
  const [lblRaw, setLblRaw]   = useState('A B C D E F');

  const result = useMemo(() => {
    const p = (s: string) => s.trim().split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));
    const obs = p(obsRaw); const k = obs.length;
    if (k < 2) return null;
    const n = obs.reduce((s, o) => s + o, 0);
    if (n === 0) return null;

    let exp: number[];
    const ep = p(expRaw);
    if (ep.length === k) {
      const es = ep.reduce((s, e) => s + e, 0);
      exp = Math.abs(es - 1) < 0.02 ? ep.map(e => e * n) : ep;
    } else {
      exp = Array(k).fill(n / k);
    }

    const chiSq = obs.reduce((s, o, i) => s + (o - exp[i]) ** 2 / Math.max(0.001, exp[i]), 0);
    const df = k - 1;
    const pv = 1 - chiSqP(chiSq, df);
    const w = Math.sqrt(chiSq / n);
    const lbls = lblRaw.trim().split(/[\s,;،]+/).filter(Boolean);

    return {
      k, n, obs, exp, chiSq, df, pv, w,
      lbls: Array.from({ length: k }, (_, i) => lbls[i] ?? `Cat${i+1}`),
      smallCell: exp.some(e => e < 5),
      cells: Array.from({ length: k }, (_, i) => ({
        lbl: lbls[i] ?? `Cat${i+1}`,
        o: obs[i], e: exp[i],
        diff: obs[i] - exp[i],
        chi: (obs[i] - exp[i]) ** 2 / Math.max(0.001, exp[i]),
        pct: obs[i] / n * 100,
      })),
    };
  }, [obsRaw, expRaw, lblRaw]);

  const wC = (w: number) => w >= 0.5 ? C.gold : w >= 0.3 ? C.blue : w >= 0.1 ? C.teal : C.muted;
  const wL = (w: number) => w >= 0.5 ? (ar?'كبير':'large') : w >= 0.3 ? (ar?'متوسط':'medium') : w >= 0.1 ? (ar?'صغير':'small') : (ar?'ضئيل':'trivial');
  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const pC = (p: number) => p < 0.05 ? C.green : C.red;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { lbl: ar?'التكرارات الملاحظة (O)':'Observed frequencies (O)', val: obsRaw, set: setObsRaw, ph: '30 45 25 20 35 15' },
          { lbl: ar?'التكرارات/النسب المتوقعة (اتركها فارغة = توزيع منتظم)':'Expected freq/prop (empty = uniform)', val: expRaw, set: setExpRaw, ph: ar?'أو 0.2 0.3 0.1...(فارغة=منتظم)':'or 0.2 0.3 0.1... (empty=uniform)' },
          { lbl: ar?'تسميات الفئات (اختيارية)':'Category labels (optional)', val: lblRaw, set: setLblRaw, ph: 'A B C D E F' },
        ].map(({ lbl, val, set, ph }) => (
          <div key={lbl}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{lbl}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'أدخل تكرارين على الأقل':'Enter at least 2 observed frequencies'}</p>}

      {result && (
        <>
          {result.smallCell && (
            <div style={{ background: 'rgba(245,215,142,0.1)', border: `1px solid ${C.gold}`, borderRadius: 9, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: C.gold }}>
              ⚠ {ar?'بعض الخلايا المتوقعة < 5 — نتائج χ² قد تكون غير دقيقة':'Some expected cells < 5 — χ² results may be unreliable'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l:'χ²', v:result.chiSq.toFixed(4), c:C.text },
              { l:`df`, v:String(result.df), c:C.sub },
              { l:'p', v:pFmt(result.pv), c:pC(result.pv) },
              { l:"Cohen's w", v:result.w.toFixed(3), c:wC(result.w), s:wL(result.w) },
              { l:'n', v:String(result.n), c:C.sub },
            ].map(({ l, v, c, s }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 10, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
                {s && <div style={{ fontSize: 9, color: c }}>{s}</div>}
              </div>
            ))}
          </div>

          {/* Observed vs Expected chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar?'ملاحظ مقابل متوقع':'Observed vs. Expected'}</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={result.cells.map(c => ({ name: c.lbl, [ar?'ملاحظ':'Observed']: c.o, [ar?'متوقع':'Expected']: +c.e.toFixed(2) }))} margin={{ top:4, right:8, left:0, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:9, fill:C.sub }}/>
                <YAxis tick={{ fontSize:9, fill:C.sub }} width={28}/>
                <Tooltip contentStyle={{ background:'#0d172d', border:`1px solid ${C.border}`, borderRadius:8, fontSize:11 }}/>
                <Legend wrapperStyle={{ fontSize:10 }}/>
                <Bar dataKey={ar?'ملاحظ':'Observed'} fill={`${C.blue}bb`} radius={[3,3,0,0]}/>
                <Bar dataKey={ar?'متوقع':'Expected'} fill={`${C.gold}66`} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cell-by-cell table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(201,168,76,0.07)' }}>
                {[ar?'الفئة':'Category','O','E','O−E',(ar?'مساهمة χ²':'χ² Contrib.'), '%'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.cells.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: c.chi > result.chiSq/result.k*2 ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 700, color: C.text }}>{c.lbl}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: C.text }}>{c.o}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>{c.e.toFixed(2)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: c.diff > 0 ? C.green : C.red }}>{c.diff > 0 ? '+' : ''}{c.diff.toFixed(2)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: c.chi > 3.84 ? C.gold : C.sub }}>{c.chi.toFixed(3)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: C.muted }}>{c.pct.toFixed(1)}%</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px solid ${C.border}`, background: 'rgba(201,168,76,0.06)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 800, color: C.gold }}>{ar?'المجموع':'Total'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: C.text }}>{result.n}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>{result.exp.reduce((s,e)=>s+e,0).toFixed(2)}</td>
                  <td colSpan={2} style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: C.text }}>χ²={result.chiSq.toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: C.muted }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 12, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {`χ²(${result.df}, N = ${result.n}) = ${result.chiSq.toFixed(2)}, p = ${pFmt(result.pv)}, w = ${result.w.toFixed(2)}`}
            <br/><span style={{ color: pC(result.pv), fontSize: 11 }}>
              {result.pv < 0.05 ? (ar?'✓ توزيع الملاحظات يختلف دلالياً عن المتوقع':'✓ Observed distribution significantly differs from expected')
                                : (ar?'✗ لا يوجد دليل كافٍ على اختلاف التوزيع عن المتوقع':'✗ No significant difference from expected distribution')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ONE-WAY ANOVA FROM SUMMARY STATISTICS ────────────────────────────────
function AnovaSummary({ ar }: { ar: boolean }) {
  const DEF = `Control,20,52.3,8.1
Low,22,61.4,7.6
Medium,21,68.9,9.2
High,19,75.2,8.8`;
  const [raw, setRaw] = useState(DEF);

  interface GrpRow { name:string; n:number; m:number; sd:number }

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    const groups: GrpRow[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]+/).map(s => s.trim());
      if (parts.length < 4) continue;
      const n = parseFloat(parts[1]), m = parseFloat(parts[2]), sd = parseFloat(parts[3]);
      if (isFinite(n) && n >= 2 && isFinite(m) && isFinite(sd) && sd >= 0) {
        groups.push({ name: parts[0], n, m, sd });
      }
    }
    if (groups.length < 2) return null;
    const k = groups.length;
    const N = groups.reduce((s, g) => s + g.n, 0);
    const grandM = groups.reduce((s, g) => s + g.n * g.m, 0) / N;
    const SSb = groups.reduce((s, g) => s + g.n * (g.m - grandM) ** 2, 0);
    const SSw = groups.reduce((s, g) => s + (g.n - 1) * g.sd ** 2, 0);
    const dfb = k - 1, dfw = N - k;
    const MSb = SSb / dfb, MSw = SSw / dfw;
    const F = MSb / Math.max(1e-10, MSw);
    const pv = 1 - chiSqP(F * dfb, dfb);
    const eta2 = SSb / (SSb + SSw);
    const omega2 = (SSb - dfb * MSw) / (SSb + SSw + MSw);
    const pooledSD = Math.sqrt(MSw);

    // Tukey HSD critical value (approx using q / sqrt(2)); q from studentized range
    // For simplicity: compare each pair with Bonferroni-corrected t
    const nPairs = k * (k - 1) / 2;
    const pairs: { g1:string; g2:string; diff:number; se:number; t:number; p:number; d:number; sig:boolean }[] = [];
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const g1 = groups[i], g2 = groups[j];
        const se = Math.sqrt(MSw * (1/g1.n + 1/g2.n));
        const diff = g1.m - g2.m;
        const t = Math.abs(diff) / Math.max(1e-10, se);
        const p_raw = 2 * (1 - normalCDF(t));
        const p_bon = Math.min(1, p_raw * nPairs);
        const d = Math.abs(diff) / Math.max(1e-10, pooledSD);
        pairs.push({ g1: g1.name, g2: g2.name, diff, se, t, p: p_bon, d, sig: p_bon < 0.05 });
      }
    }

    return { k, N, groups, grandM, SSb, SSw, MSb, MSw, dfb, dfw, F, pv, eta2, omega2, pooledSD, pairs };
  }, [raw]);

  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const pC = (p: number) => p < 0.05 ? C.green : C.red;
  const eta2C = (e: number) => e >= 0.14 ? C.gold : e >= 0.06 ? C.blue : e >= 0.01 ? C.teal : C.muted;
  const eta2L = (e: number) => e >= 0.14 ? (ar?'كبير':'large') : e >= 0.06 ? (ar?'متوسط':'medium') : e >= 0.01 ? (ar?'صغير':'small') : (ar?'ضئيل':'trivial');

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'كل سطر: اسم المجموعة، n، M، SD (مفصولة بفاصلة أو تاب)' : 'Each row: Group name, n, M, SD (comma or tab separated)'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'يلزم مجموعتان على الأقل بتنسيق: الاسم، n، M، SD':'Need ≥ 2 groups formatted as: Name, n, M, SD'}</p>}

      {result && (
        <>
          {/* F test summary */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l:`F(${result.dfb},${result.dfw})`, v:result.F.toFixed(3), c:C.text },
              { l:'p', v:pFmt(result.pv), c:pC(result.pv) },
              { l:'η²', v:result.eta2.toFixed(3), c:eta2C(result.eta2), s:eta2L(result.eta2) },
              { l:'ω²', v:result.omega2.toFixed(3), c:C.sub },
              { l:'Pooled SD', v:result.pooledSD.toFixed(3), c:C.sub },
              { l:'N', v:String(result.N), c:C.sub },
              { l:'k', v:String(result.k), c:C.sub },
            ].map(({ l, v, c, s }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 10, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div>
                {s && <div style={{ fontSize: 9, color: c }}>{s}</div>}
              </div>
            ))}
          </div>

          {/* ANOVA Table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar ? 'جدول ANOVA' : 'ANOVA Summary Table'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar?'المصدر':'Source','SS','df','MS','F','p'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: C.text }}>{ar?'بين المجموعات':'Between Groups'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>{result.SSb.toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>{result.dfb}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>{result.MSb.toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: C.text }}>{result.F.toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: pC(result.pv) }}>{pFmt(result.pv)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '6px 12px', color: C.sub }}>{ar?'داخل المجموعات (خطأ)':'Within Groups (Error)'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>{result.SSw.toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>{result.dfw}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: C.sub }}>{result.MSw.toFixed(3)}</td>
                  <td colSpan={2}/>
                </tr>
                <tr style={{ background: 'rgba(201,168,76,0.04)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: C.gold }}>{ar?'الكلي':'Total'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>{(result.SSb+result.SSw).toFixed(3)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 700 }}>{result.dfb+result.dfw}</td>
                  <td colSpan={3}/>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Groups bar chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar?'المتوسطات (M ± SD)':'Group Means (M ± SD)'}</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={result.groups.map(g => ({ name:g.name, M:+g.m.toFixed(3), SD:+g.sd.toFixed(3) }))} margin={{ top:4, right:8, left:0, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:9, fill:C.sub }}/>
                <YAxis tick={{ fontSize:9, fill:C.sub }} width={36}/>
                <Tooltip contentStyle={{ background:'#0d172d', border:`1px solid ${C.border}`, borderRadius:8, fontSize:11 }} formatter={(v:number)=>v.toFixed(3)}/>
                <Bar dataKey="M" fill={`${C.blue}bb`} radius={[4,4,0,0]} label={{ position:'top', formatter:(v:number)=>v.toFixed(1), fill:C.sub, fontSize:9 }}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Post-hoc pairs (Bonferroni) */}
          {result.pairs.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 12, color: C.gold }}>
                {ar ? `مقارنات Bonferroni البعدية (nPairs = ${result.pairs.length})` : `Bonferroni Post-hoc Comparisons (nPairs = ${result.pairs.length})`}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[ar?'المقارنة':'Comparison','M diff','d','p (Bonf.)',ar?'النتيجة':'Result'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.pairs.map((pr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: pr.sig ? 'rgba(94,234,212,0.04)' : 'transparent' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 600, color: C.text }}>{pr.g1} vs {pr.g2}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: pr.diff > 0 ? C.green : C.red }}>{pr.diff > 0 ? '+' : ''}{pr.diff.toFixed(3)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: C.sub }}>{pr.d.toFixed(3)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: pC(pr.p), fontWeight: 700 }}>{pFmt(pr.p)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: pr.sig ? C.green : C.muted, fontWeight: pr.sig ? 700 : 400 }}>{pr.sig ? (ar?'✓ دال':'✓ Sig.') : (ar?'ns':'ns')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', fontSize: 12, color: C.sub }}>
            <strong style={{ color: C.gold }}>APA: </strong>
            {`F(${result.dfb}, ${result.dfw}) = ${result.F.toFixed(2)}, p = ${pFmt(result.pv)}, η² = ${result.eta2.toFixed(3)}, ω² = ${result.omega2.toFixed(3)}`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── REGRESSION DIAGNOSTICS (VIF, DW, Residuals) ──────────────────────────
function RegDiagnostics({ ar }: { ar: boolean }) {
  const DEF = `score anxiety motivation gpa
75 3.2 4.1 3.8
82 2.8 3.8 3.5
68 4.1 3.0 2.9
90 2.1 4.5 3.9
71 3.7 3.3 3.2
85 2.5 4.2 3.7
78 3.0 3.7 3.4
65 4.5 2.8 2.7
88 2.3 4.4 3.8
73 3.9 3.1 3.1
80 2.7 4.0 3.6
76 3.4 3.6 3.3
84 2.6 4.3 3.7
70 3.8 3.2 3.0
87 2.2 4.6 3.9`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 4) return null;
    const firstCells = lines[0].trim().split(/[\s,\t]+/);
    const hasHeader = firstCells.some(v => isNaN(parseFloat(v)));
    const headers = hasHeader ? firstCells : Array.from({ length: firstCells.length }, (_, i) => i === 0 ? 'Y' : `X${i}`);
    const dataLines = (hasHeader ? lines.slice(1) : lines);
    const data = dataLines.map(l => l.trim().split(/[\s,\t;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v)));
    const p_total = Math.min(...data.map(r => r.length));
    if (data.length < p_total + 1 || p_total < 2) return null;
    const D = data.map(r => r.slice(0, p_total));
    const n = D.length, k = p_total - 1;
    const Y = D.map(r => r[0]);
    const Xraw = D.map(r => r.slice(1));
    const depName = headers[0] ?? 'Y';
    const predNames = headers.slice(1, p_total);

    const reg = olsRegression(Xraw, Y, depName, predNames);
    if (!reg) return null;

    // Durbin-Watson on residuals
    const resids = reg.residuals;
    const DW = resids.slice(1).reduce((s, e, i) => s + (e - resids[i]) ** 2, 0) / Math.max(1e-10, resids.reduce((s, e) => s + e * e, 0));

    // VIF: for each predictor j, regress Xj on rest + intercept
    const vif: number[] = [];
    for (let j = 0; j < k; j++) {
      const Yj = Xraw.map(r => r[j]);
      const Xoth = Xraw.map(r => [1, ...r.filter((_, i) => i !== j)]);
      const { R2 } = olsWithSE(Xoth, Yj);
      vif.push(1 / Math.max(1e-10, 1 - R2));
    }

    // Standardized residuals
    const MSE = resids.reduce((s, e) => s + e * e, 0) / Math.max(1, n - k - 1);
    const sRes = resids.map(e => e / Math.sqrt(MSE));

    // Residuals vs. Fitted scatter data
    const rfData = reg.fitted.map((f, i) => ({ fitted: +Number(f).toFixed(3), sRes: +sRes[i].toFixed(3) }));

    // QQ data for residuals
    const sortedRes = [...sRes].sort((a, b) => a - b);
    const qqData = sortedRes.map((r, i) => ({ theoretical: +zInv((i + 0.5) / n).toFixed(3), sample: +r.toFixed(3) }));

    return { n, k, depName, predNames, reg, DW, vif, sRes, rfData, qqData, MSE };
  }, [raw]);

  const vifC = (v: number) => v >= 10 ? C.red : v >= 5 ? C.gold : C.green;
  const vifLbl = (v: number) => v >= 10 ? (ar ? 'مشكلة شديدة' : 'Severe') : v >= 5 ? (ar ? 'مشكلة متوسطة' : 'Moderate') : (ar ? 'لا مشكلة' : 'OK');
  const dwC = (d: number) => d >= 1.5 && d <= 2.5 ? C.green : C.gold;
  const dwLbl = (d: number) => d >= 1.5 && d <= 2.5 ? (ar ? 'لا ارتباط ذاتي' : 'No autocorrelation') : d < 1.5 ? (ar ? 'ارتباط ذاتي موجب محتمل' : 'Possible + autocorr.') : (ar ? 'ارتباط ذاتي سالب محتمل' : 'Possible − autocorr.');

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'البيانات — السطر الأول: أسماء المتغيرات (اختياري) · العمود الأول: المتغير التابع Y · الأعمدة التالية: المتنبئات X' : 'Data — first row: variable names (optional) · first column: Y (dependent) · other columns: predictors X'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم n > p + 1 وعمودان على الأقل' : 'Need n > p + 1 and at least 2 columns'}</p>}

      {result && (
        <>
          {/* Model fit summary */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: 'R²', v: result.reg.R2.toFixed(4), c: result.reg.R2 >= 0.5 ? C.green : result.reg.R2 >= 0.3 ? C.gold : C.red },
              { l: 'Adj.R²', v: result.reg.adjR2.toFixed(4), c: C.sub },
              { l: `F(${result.k},${result.n-result.k-1})`, v: result.reg.F.toFixed(3), c: C.text },
              { l: 'p(F)', v: result.reg.pF < 0.001 ? '< .001' : result.reg.pF.toFixed(3), c: result.reg.pF < 0.05 ? C.green : C.red },
              { l: 'RMSE', v: result.reg.rmse.toFixed(4), c: C.sub },
              { l: 'n', v: String(result.n), c: C.text },
              { l: 'k', v: String(result.k), c: C.text },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 10, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* VIF Table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar ? 'معامل تضخم التباين (VIF) — كشف التعدد الخطي' : 'Variance Inflation Factor (VIF) — Multicollinearity Check'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar?'المتنبئ':'Predictor','β','VIF',ar?'التسامح':'Tolerance',ar?'التفسير':'Interpretation'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.predNames.map((name, j) => (
                  <tr key={j} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: result.vif[j] >= 10 ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: C.text }}>{name}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', color: C.sub }}>{result.reg.beta[j+1]?.toFixed(4) ?? '—'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 800, color: vifC(result.vif[j]) }}>{result.vif[j].toFixed(3)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', color: C.sub }}>{(1/result.vif[j]).toFixed(3)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', color: vifC(result.vif[j]) }}>{vifLbl(result.vif[j])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '8px 16px', fontSize: 11, color: C.muted }}>
              {ar ? 'VIF < 5 = مقبول · 5–10 = مشكلة متوسطة · > 10 = مشكلة شديدة (التسامح = 1/VIF)' : 'VIF < 5 = acceptable · 5–10 = moderate · > 10 = severe (Tolerance = 1/VIF)'}
            </div>
          </div>

          {/* Durbin-Watson */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? 'إحصاء Durbin-Watson' : 'Durbin-Watson Stat.'}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: dwC(result.DW) }}>{result.DW.toFixed(4)}</div>
              <div style={{ fontSize: 11, color: dwC(result.DW) }}>{dwLbl(result.DW)}</div>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: C.muted }}>
              {ar ? 'DW ≈ 2: لا ارتباط ذاتي · DW < 1.5: ارتباط ذاتي موجب · DW > 2.5: ارتباط ذاتي سالب · المدى الجيد: 1.5 ≤ DW ≤ 2.5'
                  : 'DW ≈ 2: no autocorrelation · DW < 1.5: positive autocorr. · DW > 2.5: negative autocorr. · Good range: 1.5 ≤ DW ≤ 2.5'}
            </div>
          </div>

          {/* Residuals vs Fitted + QQ side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar?'البواقي المعيارية مقابل القيم المُناسَبة':'Std. Residuals vs. Fitted'}</div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={result.rfData} margin={{ top:4,right:8,left:0,bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="fitted" tick={{fontSize:9,fill:C.sub}} label={{value:ar?'مُناسَب':'Fitted',position:'insideBottom',offset:-4,fill:C.sub,fontSize:9}}/>
                  <YAxis tick={{fontSize:9,fill:C.sub}} label={{value:ar?'باقٍ':'Resid.',angle:-90,position:'insideLeft',fill:C.sub,fontSize:9}}/>
                  <Tooltip contentStyle={{background:'#0d172d',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                  <ReferenceLine y={0} stroke={C.gold} strokeDasharray="4 3"/>
                  <ReferenceLine y={2} stroke={C.red} strokeDasharray="3 3" label={{value:'±2',fill:C.red,fontSize:8}}/>
                  <ReferenceLine y={-2} stroke={C.red} strokeDasharray="3 3"/>
                  <Bar dataKey="sRes" fill={`${C.blue}88`} radius={[2,2,0,0]}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>{ar?'مخطط QQ للبواقي (اعتدالية البواقي)':'Residuals Q-Q Plot (normality)'}</div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={result.qqData} margin={{ top:4,right:8,left:0,bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="theoretical" tick={{fontSize:9,fill:C.sub}} label={{value:ar?'نظري':'Theoretical',position:'insideBottom',offset:-4,fill:C.sub,fontSize:9}}/>
                  <YAxis tick={{fontSize:9,fill:C.sub}} label={{value:ar?'عيني':'Sample',angle:-90,position:'insideLeft',fill:C.sub,fontSize:9}}/>
                  <Tooltip contentStyle={{background:'#0d172d',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                  <ReferenceLine segment={[{x:result.qqData[0]?.theoretical,y:result.qqData[0]?.theoretical},{x:result.qqData[result.qqData.length-1]?.theoretical,y:result.qqData[result.qqData.length-1]?.theoretical}]} stroke={C.gold} strokeDasharray="4 3"/>
                  <Bar dataKey="sample" fill={`${C.teal}88`} radius={[2,2,0,0]}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p style={{ fontSize: 11, color: C.muted }}>
            {ar ? '* VIF: إحصاء كشف التعدد الخطي بين المتنبئات · DW: كشف الارتباط الذاتي للبواقي · بواقٍ خارج ±2 تُشير لقيم شاذة أو مؤثرة'
                : '* VIF detects multicollinearity among predictors · DW detects autocorrelation in residuals · Residuals beyond ±2 may indicate outliers or influential cases'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── DESCRIPTIVE STATISTICS TABLE (Table 1 Generator) ─────────────────────
function DescTable({ ar }: { ar: boolean }) {
  const DEF = `variable,score,anxiety,motivation,gpa,age
P1,75,3.2,4.1,3.8,22
P2,82,2.8,3.8,3.5,24
P3,68,4.1,3.0,2.9,21
P4,90,2.1,4.5,3.9,25
P5,71,3.7,3.3,3.2,23
P6,85,2.5,4.2,3.7,22
P7,78,3.0,3.7,3.4,24
P8,65,4.5,2.8,2.7,21
P9,88,2.3,4.4,3.8,23
P10,73,3.9,3.1,3.1,25
P11,80,2.7,4.0,3.6,22
P12,76,3.4,3.6,3.3,23`;
  const [raw, setRaw] = useState(DEF);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 3) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

    const cols: { name: string; vals: number[] }[] = headers.map((name, i) => {
      const vals: number[] = [];
      for (const line of lines.slice(1)) {
        const v = parseFloat(line.split(sep)[i]?.trim().replace(/^"|"$/g, '') ?? '');
        if (isFinite(v) && !isNaN(v)) vals.push(v);
      }
      return { name, vals };
    });

    const numeric = cols.filter(c => c.vals.length >= 3);
    if (!numeric.length) return null;

    const stats = numeric.map(({ name, vals }) => {
      const n = vals.length, m = avg(vals);
      const sorted = [...vals].sort((a,b)=>a-b);
      const sd = Math.sqrt(vals.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,n-1));
      const se = sd/Math.sqrt(n);
      const median = n%2===0?(sorted[n/2-1]+sorted[n/2])/2:sorted[Math.floor(n/2)];
      const skew = n>=3 ? (n/((n-1)*(n-2)))*vals.reduce((s,x)=>s+((x-m)/Math.max(1e-10,sd))**3,0) : 0;
      const kurt = n>=4 ? (n*(n+1)/((n-1)*(n-2)*(n-3)))*vals.reduce((s,x)=>s+((x-m)/Math.max(1e-10,sd))**4,0)-3*(n-1)**2/((n-2)*(n-3)) : 0;
      return { name, n, m, sd, se, median, min:sorted[0], max:sorted[n-1], skew, kurt };
    });

    return { stats };
  }, [raw]);

  const skC = (s: number) => Math.abs(s)<0.5?C.green:Math.abs(s)<1?C.gold:C.red;
  const kuC = (k: number) => Math.abs(k)<2?C.green:Math.abs(k)<3?C.gold:C.red;

  const copyTable = () => {
    if (!result) return;
    const hdr = `Variable\tn\tM\tSD\tSE\tMedian\tMin\tMax\tSkewness\tKurtosis`;
    const rows = result.stats.map(s =>
      `${s.name}\t${s.n}\t${s.m.toFixed(2)}\t${s.sd.toFixed(2)}\t${s.se.toFixed(3)}\t${s.median.toFixed(2)}\t${s.min.toFixed(2)}\t${s.max.toFixed(2)}\t${s.skew.toFixed(2)}\t${s.kurt.toFixed(2)}`);
    navigator.clipboard.writeText([hdr,...rows].join('\n')).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);});
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'البيانات — السطر الأول: أسماء المتغيرات · الفاصل: فاصلة أو tab · القيم غير الرقمية تُتجاهل' : 'Data — first row: variable names · separator: comma or tab · non-numeric values are skipped'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={9}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'يلزم 3 صفوف بيانات على الأقل وعمود رقمي واحد':'Need ≥ 3 data rows and ≥ 1 numeric column'}</p>}

      {result && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={copyTable}
              style={{ background: copied?'rgba(94,234,212,0.2)':'rgba(201,168,76,0.15)', border: `1px solid ${copied?C.teal:C.gold}`, borderRadius: 9, padding: '7px 18px', color: copied?C.teal:C.gold, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
              {copied ? (ar?'✓ تم النسخ':'✓ Copied!') : (ar?'📋 نسخ TSV (للـ Word/Excel)':'📋 Copy TSV (paste into Word/Excel)')}
            </button>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.gold }}>
                {ar?`الإحصاءات الوصفية (n=${result.stats[0]?.n} مشاهدة · ${result.stats.length} متغير)`:`Descriptive Statistics (n=${result.stats[0]?.n} observations · ${result.stats.length} variables)`}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {[ar?'المتغير':'Variable','n','M','SD','SE',ar?'الوسيط':'Median',ar?'الحد الأدنى':'Min',ar?'الحد الأقصى':'Max',ar?'الالتواء':'Skew',ar?'التفرطح':'Kurtosis'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'center', color: C.sub, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.stats.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i%2===0?'rgba(255,255,255,0.01)':'transparent' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: C.text, textAlign: ar?'right':'left', paddingLeft: ar?10:14, minWidth: 80 }}>{s.name}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{s.n}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: C.text }}>{s.m.toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{s.sd.toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.muted }}>{s.se.toFixed(3)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.sub }}>{s.median.toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.muted }}>{s.min.toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.muted }}>{s.max.toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: skC(s.skew), fontWeight: Math.abs(s.skew)>=1?700:400 }}>{s.skew.toFixed(3)}<div style={{fontSize:8,color:skC(s.skew)}}>{Math.abs(s.skew)<0.5?(ar?'متماثل':'symm.'):Math.abs(s.skew)<1?(ar?'متوسط':'mod.'):ar?'شديد':'high'}</div></td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: kuC(s.kurt), fontWeight: Math.abs(s.kurt)>=3?700:400 }}>{s.kurt.toFixed(3)}<div style={{fontSize:8,color:kuC(s.kurt)}}>{Math.abs(s.kurt)<2?(ar?'مقبول':'ok'):Math.abs(s.kurt)<3?(ar?'متوسط':'mod.'):ar?'شديد':'high'}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual M ± SD bars */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 12 }}>{ar?'رسم المتوسطات ± الانحراف المعياري':'Mean ± SD Chart'}</div>
            <ResponsiveContainer width="100%" height={Math.max(160, result.stats.length * 38)}>
              <BarChart data={result.stats.map(s=>({name:s.name,M:+s.m.toFixed(3),err:+s.sd.toFixed(3)}))} layout="vertical" margin={{ top:4, right:40, left:60, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize:9, fill:C.sub }}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:C.sub }} width={55}/>
                <Tooltip contentStyle={{ background:'#0d172d', border:`1px solid ${C.border}`, borderRadius:8, fontSize:11 }} formatter={(v:number)=>v.toFixed(3)}/>
                <Bar dataKey="M" fill={`${C.blue}bb`} radius={[0,4,4,0]} label={{ position:'right', formatter:(v:number)=>v.toFixed(2), fill:C.sub, fontSize:9 }}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ fontSize: 11, color: C.muted }}>
            {ar ? '* الالتواء: |S| < 0.5 = متماثل · 0.5–1.0 = متوسط · > 1.0 = شديد | التفرطح الزائد: |K| < 2 = مقبول · بياناتك جاهزة للنسخ بتنسيق TSV (للصق في Word أو Excel)'
                : '* Skewness: |S| < 0.5 = symmetric · 0.5–1.0 = moderate · > 1.0 = substantial | Excess kurtosis: |K| < 2 = acceptable · Copy as TSV to paste directly into Word or Excel'}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── T-TESTS (One-sample / Paired / Welch Independent) ─────────────────────
type TTRes =
  | { type:'onesample'; n:number; xbar:number; s:number; se:number; t:number; p:number; d:number; ci_lo:number; ci_hi:number; mu0:number }
  | { type:'paired'; n:number; xbar1:number; xbar2:number; dbar:number; sd:number; se:number; t:number; p:number; d:number; ci_lo:number; ci_hi:number; diffs:number[] }
  | { type:'welch'; n1:number; n2:number; m1:number; m2:number; s1:number; s2:number; t_w:number; df_w:number; p_w:number; t_s:number; p_s:number; d:number; F_lev:number; p_lev:number; ci_lo:number; ci_hi:number };

function TTests({ ar }: { ar: boolean }) {
  const [mode, setMode] = useState<'onesample'|'paired'|'welch'>('paired');
  const [raw1, setRaw1] = useState('4 3 5 4 3 5 4 3 5 4 3 4 5 4 3');
  const [raw2, setRaw2] = useState('5 4 6 5 4 6 5 4 6 5 4 5 6 5 4');
  const [mu0Str, setMu0Str] = useState('3');

  const parse = (s: string) => s.trim().split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));

  const result: TTRes | null = useMemo(() => {
    const x1 = parse(raw1);
    if (mode === 'onesample') {
      const mu0 = parseFloat(mu0Str);
      if (x1.length < 3 || isNaN(mu0)) return null;
      const n = x1.length, xbar = avg(x1);
      const s = Math.sqrt(x1.reduce((s,x)=>s+(x-xbar)**2,0)/Math.max(1,n-1));
      const se = s/Math.sqrt(n), t=(xbar-mu0)/Math.max(1e-10,se);
      const p = 2*(1-normalCDF(Math.abs(t))), d=(xbar-mu0)/Math.max(1e-10,s);
      return { type:'onesample', n, xbar, s, se, t, p, d, ci_lo:xbar-1.96*se, ci_hi:xbar+1.96*se, mu0 };
    }
    if (mode === 'paired') {
      const x2 = parse(raw2);
      const n = Math.min(x1.length, x2.length);
      if (n < 3) return null;
      const v1=x1.slice(0,n), v2=x2.slice(0,n);
      const diffs=v1.map((x,i)=>v2[i]-x), dbar=avg(diffs);
      const sd=Math.sqrt(diffs.reduce((s,d)=>s+(d-dbar)**2,0)/Math.max(1,n-1));
      const se=sd/Math.sqrt(n), t=dbar/Math.max(1e-10,se);
      const p=2*(1-normalCDF(Math.abs(t))), d=dbar/Math.max(1e-10,sd);
      return { type:'paired', n, xbar1:avg(v1), xbar2:avg(v2), diffs, dbar, sd, se, t, p, d, ci_lo:dbar-1.96*se, ci_hi:dbar+1.96*se };
    }
    // Welch independent
    const x2 = parse(raw2);
    if (x1.length < 3 || x2.length < 3) return null;
    const n1=x1.length, n2=x2.length, m1=avg(x1), m2=avg(x2);
    const v1n=x1.reduce((s,x)=>s+(x-m1)**2,0)/(n1-1), v2n=x2.reduce((s,x)=>s+(x-m2)**2,0)/(n2-1);
    const s1=Math.sqrt(v1n), s2=Math.sqrt(v2n);
    const se_w=Math.sqrt(v1n/n1+v2n/n2);
    const t_w=(m1-m2)/Math.max(1e-10,se_w);
    const df_w=(v1n/n1+v2n/n2)**2/((v1n/n1)**2/(n1-1)+(v2n/n2)**2/(n2-1));
    const p_w=2*(1-normalCDF(Math.abs(t_w)));
    const sp=Math.sqrt(((n1-1)*v1n+(n2-1)*v2n)/(n1+n2-2));
    const t_s=(m1-m2)/(sp*Math.sqrt(1/n1+1/n2));
    const p_s=2*(1-normalCDF(Math.abs(t_s)));
    const d=Math.abs(m1-m2)/Math.max(1e-10,sp);
    // Levene (Brown-Forsythe median-based)
    const s1s=[...x1].sort((a,b)=>a-b), s2s=[...x2].sort((a,b)=>a-b);
    const med1=s1s[Math.floor(n1/2)], med2=s2s[Math.floor(n2/2)];
    const z1=x1.map(x=>Math.abs(x-med1)), z2=x2.map(x=>Math.abs(x-med2));
    const zbar=avg([...z1,...z2]), z1b=avg(z1), z2b=avg(z2);
    const SSLb=n1*(z1b-zbar)**2+n2*(z2b-zbar)**2;
    const SSLw=z1.reduce((s,z)=>s+(z-z1b)**2,0)+z2.reduce((s,z)=>s+(z-z2b)**2,0);
    const F_lev=SSLb/Math.max(1e-10,SSLw/(n1+n2-2));
    const p_lev=1-chiSqP(F_lev,1);
    return { type:'welch', n1, n2, m1, m2, s1, s2, t_w, df_w, p_w, t_s, p_s, d, F_lev, p_lev, ci_lo:(m1-m2)-1.96*se_w, ci_hi:(m1-m2)+1.96*se_w };
  }, [mode, raw1, raw2, mu0Str]);

  const pFmt = (p:number) => p<0.001?'< .001':p.toFixed(3);
  const pC = (p:number) => p<0.05?C.green:C.red;
  const dC = (d:number) => Math.abs(d)>=0.8?C.gold:Math.abs(d)>=0.5?C.blue:Math.abs(d)>=0.2?C.teal:C.muted;
  const dLbl = (d:number) => { const a=Math.abs(d); return a>=0.8?(ar?'كبير':'large'):a>=0.5?(ar?'متوسط':'medium'):a>=0.2?(ar?'صغير':'small'):(ar?'ضئيل':'trivial'); };

  const StatCard = ({ label, val, color, sub }: { label:string; val:string; color?:string; sub?:string }) => (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 14px', textAlign:'center', minWidth:88 }}>
      <div style={{ fontSize:10, color:C.sub }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:800, color:color??C.text }}>{val}</div>
      {sub && <div style={{ fontSize:9, color:C.muted }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Mode selector */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {([['onesample',ar?'أحادي العينة':'One-Sample'],['paired',ar?'مزدوج (قبل/بعد)':'Paired (Pre/Post)'],['welch',ar?'مستقل (Welch)':'Independent (Welch)']] as const).map(([m,lbl]) => (
          <button key={m} onClick={()=>setMode(m)}
            style={{ background:mode===m?'rgba(201,168,76,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${mode===m?C.gold:C.border}`, borderRadius:9, padding:'7px 16px', color:mode===m?C.gold:C.sub, cursor:'pointer', fontFamily:'inherit', fontWeight:mode===m?700:400, fontSize:13 }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{ display:'grid', gridTemplateColumns:mode==='onesample'?'1fr 140px':'1fr 1fr', gap:12, marginBottom:14 }}>
        <div>
          <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>
            {mode==='onesample'?(ar?'البيانات':'Data'):mode==='paired'?(ar?'قبل / المجموعة 1':'Before / Group 1'):(ar?'المجموعة الأولى':'Group 1')}
          </label>
          <textarea value={raw1} onChange={e=>setRaw1(e.target.value)} rows={4}
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 12px', color:C.text, fontSize:11, fontFamily:'monospace', direction:'ltr', resize:'vertical', boxSizing:'border-box' }}/>
        </div>
        {mode==='onesample' ? (
          <div>
            <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>{ar?'المتوسط الفرضي μ₀':'Hypothesized mean μ₀'}</label>
            <input type="number" value={mu0Str} onChange={e=>setMu0Str(e.target.value)} step="0.1"
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:9, padding:'12px', color:C.text, fontSize:20, fontWeight:700, direction:'ltr', boxSizing:'border-box' }}/>
          </div>
        ) : (
          <div>
            <label style={{ fontSize:11, color:C.sub, display:'block', marginBottom:4 }}>
              {mode==='paired'?(ar?'بعد / المجموعة 2':'After / Group 2'):(ar?'المجموعة الثانية':'Group 2')}
            </label>
            <textarea value={raw2} onChange={e=>setRaw2(e.target.value)} rows={4}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 12px', color:C.text, fontSize:11, fontFamily:'monospace', direction:'ltr', resize:'vertical', boxSizing:'border-box' }}/>
          </div>
        )}
      </div>

      {!result && <p style={{ color:C.muted, fontSize:13 }}>{ar?'يلزم 3 قيم على الأقل':'Need at least 3 values per group'}</p>}

      {result?.type === 'onesample' && (
        <>
          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
            <StatCard label="n" val={String(result.n)}/>
            <StatCard label={ar?'المتوسط x̄':'Mean x̄'} val={result.xbar.toFixed(4)}/>
            <StatCard label={ar?'الانحراف s':'SD s'} val={result.s.toFixed(4)}/>
            <StatCard label="μ₀" val={String(result.mu0)} color={C.sub}/>
            <StatCard label="t" val={result.t.toFixed(4)}/>
            <StatCard label="p (two-tailed)" val={pFmt(result.p)} color={pC(result.p)}/>
            <StatCard label="Cohen's d" val={result.d.toFixed(3)} color={dC(result.d)} sub={dLbl(result.d)}/>
            <StatCard label="95% CI" val={`[${result.ci_lo.toFixed(3)}, ${result.ci_hi.toFixed(3)}]`} color={C.blue}/>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 16px', fontSize:12, color:C.sub }}>
            <strong style={{ color:C.gold }}>APA: </strong>
            {ar ? `t(${result.n-1}) = ${result.t.toFixed(2)}, p = ${pFmt(result.p)}, d = ${result.d.toFixed(2)}, 95% CI [${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`
                : `t(${result.n-1}) = ${result.t.toFixed(2)}, p = ${pFmt(result.p)}, d = ${result.d.toFixed(2)}, 95% CI [${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`}
            <br/><span style={{ color:result.p<0.05?C.green:C.red, fontSize:11 }}>
              {result.p<0.05 ? (ar?`✓ المتوسط (${result.xbar.toFixed(2)}) يختلف دلالياً عن μ₀=${result.mu0}`:`✓ Mean (${result.xbar.toFixed(2)}) significantly differs from μ₀=${result.mu0}`)
                             : (ar?`✗ لا يوجد دليل كافٍ على اختلاف المتوسط عن μ₀=${result.mu0}`:`✗ No evidence that mean differs from μ₀=${result.mu0}`)}
            </span>
          </div>
        </>
      )}

      {result?.type === 'paired' && (
        <>
          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
            <StatCard label={ar?'الأزواج n':'Pairs n'} val={String(result.n)}/>
            <StatCard label={ar?'م. القبلي':'M before'} val={result.xbar1.toFixed(3)}/>
            <StatCard label={ar?'م. البعدي':'M after'} val={result.xbar2.toFixed(3)}/>
            <StatCard label={ar?'م. الفروق D̄':'Mean diff D̄'} val={result.dbar.toFixed(4)} color={result.dbar>0?C.green:C.red}/>
            <StatCard label="t" val={result.t.toFixed(4)}/>
            <StatCard label="p (two)" val={pFmt(result.p)} color={pC(result.p)}/>
            <StatCard label="d (Cohen)" val={result.d.toFixed(3)} color={dC(result.d)} sub={dLbl(result.d)}/>
            <StatCard label="95% CI (diff)" val={`[${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`} color={C.blue}/>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.gold, marginBottom:10 }}>{ar?'توزيع الفروق (بعد − قبل)':'Distribution of Differences (After − Before)'}</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={(() => {
                const mn=Math.min(...result.diffs), mx=Math.max(...result.diffs);
                if(mn===mx) return [{x:String(mn),count:result.diffs.length}];
                const bw=(mx-mn)/8;
                return Array.from({length:8},(_,b)=>({x:(mn+b*bw).toFixed(2),count:result.diffs.filter(d=>d>=mn+b*bw&&(b===7?d<=mx:d<mn+(b+1)*bw)).length}));
              })()} margin={{ top:4,right:8,left:0,bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="x" tick={{fontSize:9,fill:C.sub}}/>
                <YAxis tick={{fontSize:9,fill:C.sub}} width={24}/>
                <Tooltip contentStyle={{background:'#0d172d',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                <ReferenceLine x={result.dbar.toFixed(2)} stroke={C.gold} strokeDasharray="4 3"/>
                <Bar dataKey="count" fill={`${C.blue}bb`} radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 16px', fontSize:12, color:C.sub }}>
            <strong style={{ color:C.gold }}>APA: </strong>
            {`t(${result.n-1}) = ${result.t.toFixed(2)}, p = ${pFmt(result.p)}, d = ${result.d.toFixed(2)}, 95% CI [${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`}
            <br/><span style={{ color:result.p<0.05?C.green:C.red, fontSize:11 }}>
              {result.p<0.05 ? (ar?`✓ فرق دال: M_diff = ${result.dbar.toFixed(2)} (${result.dbar>0?'تحسّن':'تراجع'}) p ${pFmt(result.p)}`:`✓ Significant difference: M_diff = ${result.dbar.toFixed(2)} p ${pFmt(result.p)}`)
                             : (ar?'✗ لا فرق دال بين القياسين':'✗ No significant difference between measurements')}
            </span>
          </div>
        </>
      )}

      {result?.type === 'welch' && (
        <>
          {/* Group descriptives */}
          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
            {[{lbl:ar?'المجموعة 1':'Group 1',n:result.n1,m:result.m1,s:result.s1},{lbl:ar?'المجموعة 2':'Group 2',n:result.n2,m:result.m2,s:result.s2}].map(g=>(
              <div key={g.lbl} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 14px' }}>
                <div style={{ fontSize:11, color:C.gold, fontWeight:700 }}>{g.lbl}</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>M={g.m.toFixed(3)}</div>
                <div style={{ fontSize:10, color:C.sub }}>SD={g.s.toFixed(3)} · n={g.n}</div>
              </div>
            ))}
          </div>
          {/* Levene */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12 }}>
            <strong style={{ color:C.gold }}>{ar?'اختبار Levene (Brown-Forsythe) لتجانس التباين: ':'Levene (Brown-Forsythe) Test of Variance Equality: '}</strong>
            F = {result.F_lev.toFixed(3)}, p = <strong style={{ color:pC(result.p_lev) }}>{pFmt(result.p_lev)}</strong>
            <span style={{ color:result.p_lev<0.05?C.red:C.green, marginLeft:8, fontSize:11 }}>
              {result.p_lev<0.05 ? (ar?'⚠ تباينات غير متجانسة → استخدم Welch':'⚠ Unequal variances → use Welch') : (ar?'✓ تباينات متجانسة → كلاهما صالح':'✓ Equal variances → both tests valid')}
            </span>
          </div>
          {/* Both t-tests */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[{lbl:ar?'t-test ويلش (متباين)':'Welch t-test (unequal var.)',t:result.t_w,df:result.df_w,p:result.p_w,rec:true},
              {lbl:ar?'t-test ستيودنت (متجانس)':'Student t-test (equal var.)',t:result.t_s,df:result.n1+result.n2-2,p:result.p_s,rec:false}].map(({lbl,t,df,p,rec})=>(
              <div key={lbl} style={{ background:C.card, border:`1px solid ${rec?C.gold:C.border}`, borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:rec?C.gold:C.sub, fontWeight:rec?700:400, marginBottom:6 }}>{lbl}{rec?` ⭐`:''}</div>
                <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12 }}>
                  <span>t({df.toFixed(1)}) = <strong style={{color:C.text}}>{t.toFixed(3)}</strong></span>
                  <span>p = <strong style={{color:pC(p)}}>{pFmt(p)}</strong></span>
                  <span style={{color:p<0.05?C.green:C.red,fontWeight:700}}>{p<0.05?(ar?'دال':'Sig.'):(ar?'غير دال':'ns')}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:14 }}>
            <StatCard label="Cohen's d" val={result.d.toFixed(3)} color={dC(result.d)} sub={dLbl(result.d)}/>
            <StatCard label={ar?'فرق المتوسطات':'Mean diff'} val={(result.m1-result.m2).toFixed(3)} color={result.m1>result.m2?C.green:C.red}/>
            <StatCard label="95% CI (diff)" val={`[${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`} color={C.blue}/>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:'10px 16px', fontSize:12, color:C.sub }}>
            <strong style={{ color:C.gold }}>APA (Welch): </strong>
            {`t(${result.df_w.toFixed(1)}) = ${result.t_w.toFixed(2)}, p = ${pFmt(result.p_w)}, d = ${result.d.toFixed(2)}, 95% CI [${result.ci_lo.toFixed(2)}, ${result.ci_hi.toFixed(2)}]`}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── POST-HOC TESTS ────────────────────────────────────────────────────────
function PostHoc({ ar }: { ar: boolean }) {
  const DEF = `A: 4 3 5 4 3 5 4 3
B: 3 4 3 4 3 4 3 4
C: 5 5 4 5 5 4 5 5
D: 2 3 2 3 2 3 2 3`;
  const [raw, setRaw] = useState(DEF);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    const groups: { name: string; vals: number[] }[] = [];
    for (const line of lines) {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (!match) continue;
      const vals = match[2].trim().split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));
      if (vals.length >= 2) groups.push({ name: match[1].trim(), vals });
    }
    if (groups.length < 2) return null;

    const k = groups.length;
    const N = groups.reduce((s, g) => s + g.vals.length, 0);
    const gm  = groups.map(g => avg(g.vals));
    const gN  = groups.map(g => g.vals.length);
    const gSD = groups.map((g, i) => Math.sqrt(g.vals.reduce((s, x) => s+(x-gm[i])**2, 0) / Math.max(1, gN[i]-1)));

    const SSw = groups.reduce((s, _, i) => s + (gN[i]-1)*gSD[i]**2, 0);
    const df_err = N - k;
    const MSE   = SSw / Math.max(1, df_err);
    const grand = avg(groups.flatMap(g => g.vals));
    const SSb   = groups.reduce((s, _, i) => s + gN[i]*(gm[i]-grand)**2, 0);
    const df_b  = k - 1;
    const F     = (SSb / df_b) / Math.max(1e-10, MSE);
    const η2    = SSb / (SSb + SSw);
    const pF    = 1 - chiSqP(F * df_b, df_b);

    const m = k*(k-1)/2;
    const pairs: { i: number; j: number; md: number; t: number; p_raw: number; p_bon: number; p_holm: number; d: number; sig_bon: boolean; sig_holm: boolean }[] = [];
    for (let i = 0; i < k-1; i++) for (let j = i+1; j < k; j++) {
      const se = Math.sqrt(MSE*(1/gN[i]+1/gN[j]));
      const t  = Math.abs(gm[i]-gm[j]) / Math.max(1e-10, se);
      const p_raw = 2*(1-normalCDF(t));
      const poolSD = Math.sqrt(((gN[i]-1)*gSD[i]**2+(gN[j]-1)*gSD[j]**2)/Math.max(1,gN[i]+gN[j]-2));
      const d = Math.abs(gm[i]-gm[j])/Math.max(1e-10,poolSD);
      pairs.push({ i, j, md: gm[i]-gm[j], t, p_raw, p_bon: Math.min(1,p_raw*m), p_holm: 0, d, sig_bon: false, sig_holm: false });
    }
    // Holm step-down
    const byP = [...pairs].sort((a,b)=>a.p_raw-b.p_raw);
    byP.forEach((pr, idx) => { pr.p_holm = Math.min(1, pr.p_raw*(m-idx)); pr.sig_holm = pr.p_raw <= 0.05/(m-idx); });
    pairs.forEach(pr => { pr.sig_bon = pr.p_bon < 0.05; });

    // p-adj matrix
    const mx: (number|null)[][] = Array.from({length:k},()=>new Array(k).fill(null));
    pairs.forEach(({i,j,p_bon})=>{ mx[i][j]=mx[j][i]=p_bon; });

    return { groups, k, N, gm, gN, gSD, F, df_b, df_err, η2, pF, pairs, m, mx };
  }, [raw]);

  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const starFmt = (p: number) => p<0.001?'***':p<0.01?'**':p<0.05?'*':'ns';
  const pColor = (p: number) => p < 0.05 ? C.green : C.muted;
  const cellBg = (p: number|null) => !p ? 'transparent' : p<0.05 ? 'rgba(94,234,212,0.18)' : 'rgba(255,255,255,0.03)';
  const dLabel = (d: number) => d>=0.8?(ar?'كبير':'large'):d>=0.5?(ar?'متوسط':'med.'):d>=0.2?(ar?'صغير':'small'):(ar?'ضئيل':'trivial');

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'أدخل كل مجموعة في سطر: اسم المجموعة : القيم' : 'Each group on its own line: GroupName: v1 v2 v3 ...'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={7}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'يلزم مجموعتان أو أكثر':'Need 2+ groups'}</p>}

      {result && (
        <>
          {/* ANOVA summary */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 8 }}>{ar?'ANOVA أحادي الاتجاه (الخطوة الأولى)':'One-Way ANOVA (prerequisite)'}</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, alignItems: 'center' }}>
              <span>F({result.df_b}, {result.df_err}) = <strong style={{ color: C.text }}>{result.F.toFixed(3)}</strong></span>
              <span>p = <strong style={{ color: result.pF<0.05?C.green:C.red }}>{pFmt(result.pF)}</strong></span>
              <span>η² = <strong style={{ color: C.blue }}>{result.η2.toFixed(3)}</strong></span>
              <span style={{ fontSize: 11, color: result.pF<0.05?C.green:C.gold }}>
                {result.pF<0.05 ? (ar?'✓ فروق دالة → المقارنات البعدية مبررة':'✓ Significant — post-hoc justified') : (ar?'⚠ لا فروق دالة → المقارنات بعدية غير موصى بها':'⚠ Not significant — post-hoc not recommended')}
              </span>
            </div>
          </div>

          {/* Group cards */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {result.groups.map((g, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>{g.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>M={result.gm[i].toFixed(2)}</div>
                <div style={{ fontSize: 10, color: C.sub }}>SD={result.gSD[i].toFixed(2)} · n={result.gN[i]}</div>
              </div>
            ))}
          </div>

          {/* Pairwise table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar ? `المقارنات الزوجية (${result.m} أزواج) — Bonferroni & Holm` : `Pairwise Comparisons (${result.m} pairs) — Bonferroni & Holm`}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[ar?'المقارنة':'Pair', 'MD', 't', 'p', 'p (Bonf)', '✓Bon', 'p (Holm)', '✓Holm', "d"].map(h => (
                    <th key={h} style={{ padding: '7px 9px', textAlign: 'center', color: C.sub, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.pairs.map(({ i, j, md, t, p_raw, p_bon, p_holm, sig_bon, sig_holm, d }) => (
                    <tr key={`${i}${j}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: sig_bon?'rgba(94,234,212,0.05)':'transparent' }}>
                      <td style={{ padding: '5px 9px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>{result.groups[i].name} vs {result.groups[j].name}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: C.sub }}>{md.toFixed(3)}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: C.sub }}>{t.toFixed(3)}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: pColor(p_raw) }}>{pFmt(p_raw)} <sup>{starFmt(p_raw)}</sup></td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: pColor(p_bon), fontWeight: sig_bon?700:400 }}>{pFmt(p_bon)}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center' }}>{sig_bon?<span style={{color:C.green,fontWeight:800}}>✓</span>:<span style={{color:C.muted}}>—</span>}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: pColor(p_holm), fontWeight: sig_holm?700:400 }}>{pFmt(p_holm)}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center' }}>{sig_holm?<span style={{color:C.green,fontWeight:800}}>✓</span>:<span style={{color:C.muted}}>—</span>}</td>
                      <td style={{ padding: '5px 9px', textAlign: 'center', color: d>=0.8?C.gold:d>=0.5?C.blue:d>=0.2?C.teal:C.muted }}>
                        {d.toFixed(3)}<div style={{fontSize:8,color:C.muted}}>{dLabel(d)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Significance matrix */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar?'مصفوفة الدلالة (p Bonferroni — الخلايا الخضراء = دالة)':'Significance Matrix (Bonferroni p-adj — green = significant)'}
            </div>
            <div style={{ overflowX: 'auto', padding: '12px' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr>
                  <th style={{ padding: '6px 10px' }}></th>
                  {result.groups.map((g, j) => <th key={j} style={{ padding: '6px 10px', color: C.gold, textAlign: 'center', minWidth: 65 }}>{g.name}</th>)}
                </tr></thead>
                <tbody>
                  {result.groups.map((g, i) => (
                    <tr key={i}>
                      <th style={{ padding: '6px 10px', textAlign: ar?'right':'left', color: C.gold, fontWeight: 700, paddingRight: 14 }}>{g.name}</th>
                      {result.groups.map((_, j) => (
                        <td key={j} style={{ padding: '6px 10px', textAlign: 'center', background: i===j?'rgba(255,255,255,0.04)':cellBg(result.mx[i][j]), borderRadius: 4, minWidth: 65 }}>
                          {i===j ? '—' : result.mx[i][j]!==null ? (
                            <span style={{ color: result.mx[i][j]!<0.05?C.green:C.muted, fontWeight: result.mx[i][j]!<0.05?700:400 }}>
                              {pFmt(result.mx[i][j]!)}{result.mx[i][j]!<0.05?' ✓':''}
                            </span>
                          ) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 11, color: C.muted }}>
            {ar ? '* p تقريبي (توزيع طبيعي) · أكثر دقة لـ df > 30 · Bonferroni: يُقلّل خطأ النوع الأول · Holm: أقوى إحصائياً (أعلى قوة اختبار) · d: Cohen (0.2=صغير، 0.5=متوسط، 0.8=كبير)'
                : '* p uses normal approximation (accurate for df > 30) · Bonferroni: controls FWER · Holm: more powerful (step-down) · d: Cohen (0.2=small, 0.5=medium, 0.8=large)'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ITEM ANALYSIS ────────────────────────────────────────────────────────
function ItemAnalysis({ ar }: { ar: boolean }) {
  const DEF = `4 3 5 4 3 5 4 3
3 4 3 4 3 4 3 4
5 5 4 5 5 4 5 5
2 3 2 3 2 3 2 3
4 4 5 4 4 5 4 4
3 3 3 3 3 3 3 3
5 4 4 5 4 4 5 4
4 5 5 4 5 5 4 5
2 2 3 2 2 3 2 2
5 5 5 5 5 5 5 5
3 4 4 3 4 4 3 4
1 2 1 2 1 2 1 2`;
  const [raw, setRaw] = useState(DEF);
  const [names, setNames] = useState('');
  const [maxScore, setMaxScore] = useState(5);

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
    const data = lines.map(l => l.trim().split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v)));
    if (!data.length) return null;
    const p = Math.min(...data.map(r => r.length));
    if (data.length < 5 || p < 2) return null;
    const D = data.map(r => r.slice(0, p));
    const n = D.length;

    const totals = D.map(row => row.reduce((s, v) => s + v, 0));
    const idxByTot = [...Array(n).keys()].sort((a, b) => totals[a] - totals[b]);
    const cut = Math.max(1, Math.floor(0.27 * n));

    const varOf = (arr: number[]) => { const m = avg(arr); return arr.reduce((s, x) => s+(x-m)**2, 0) / Math.max(1, arr.length-1); };

    const calcAlpha = (mat: number[][]): number => {
      const k = mat[0].length;
      if (k < 2) return 0;
      const varItems = Array.from({ length: k }, (_, j) => varOf(mat.map(r => r[j])));
      const tots = mat.map(r => r.reduce((s,v)=>s+v,0));
      const varTot = varOf(tots);
      if (varTot < 1e-10) return 0;
      return (k/(k-1)) * (1 - varItems.reduce((s,v)=>s+v,0) / varTot);
    };

    const overallAlpha = calcAlpha(D);

    const items = Array.from({ length: p }, (_, j) => {
      const col = D.map(r => r[j]);
      const rest = D.map(r => r.reduce((s, v, k) => k !== j ? s+v : s, 0));
      const citc = pearson(col, rest);

      const subMat = D.map(r => r.filter((_, k) => k !== j));
      const alphaIfDel = calcAlpha(subMat);

      const m = avg(col);
      const sd = Math.sqrt(varOf(col));
      const difficulty = m / Math.max(1, maxScore);

      const lower27 = avg(idxByTot.slice(0, cut).map(i => D[i][j]));
      const upper27 = avg(idxByTot.slice(-cut).map(i => D[i][j]));
      const disc = (upper27 - lower27) / Math.max(1, maxScore);

      const status = citc >= 0.4 ? 'good' : citc >= 0.3 ? 'marginal' : 'poor';
      return { m, sd, citc, alphaIfDel, difficulty, disc, status };
    });

    const vnames = names.trim() ? names.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : Array.from({ length: p }, (_, i) => `Q${i+1}`);
    const chartData = items.map((it, i) => ({ name: vnames[i] ?? `Q${i+1}`, CITC: +it.citc.toFixed(3), D: +it.disc.toFixed(3) }));
    return { items, vnames: vnames.slice(0, p), overallAlpha, n, p, chartData };
  }, [raw, names, maxScore]);

  const citcC = (c: number) => c >= 0.4 ? C.green : c >= 0.3 ? C.gold : C.red;
  const discC = (d: number) => d >= 0.4 ? C.green : d >= 0.3 ? C.gold : d >= 0.2 ? C.blue : C.red;
  const diffC = (p: number) => p > 0.8 ? C.red : p > 0.2 ? C.green : C.red;
  const statusLabel = (s: string) => s === 'good' ? (ar?'✓ جيدة':'✓ Good') : s === 'marginal' ? (ar?'⚠ مقبولة':'⚠ Marginal') : (ar?'✗ ضعيفة':'✗ Poor');
  const statusColor = (s: string) => s === 'good' ? C.green : s === 'marginal' ? C.gold : C.red;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 120px', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'البيانات — كل سطر مستجيب · كل عمود فقرة' : 'Data — each row = respondent, each column = item'}
          </label>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{ar?'أسماء الفقرات (اختياري)':'Item names (optional)'}</label>
          <textarea value={names} onChange={e => setNames(e.target.value)} rows={8} placeholder="Q1\nQ2\nQ3\n..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{ar?'أعلى درجة ممكنة':'Max possible score'}</label>
          <input type="number" value={maxScore} min={2} max={100} onChange={e => setMaxScore(Number(e.target.value))}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 14, fontWeight: 700, direction: 'ltr', boxSizing: 'border-box' }} />
          <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0' }}>{ar?'للمقياس الخماسي: 5':'e.g., Likert-5: 5'}</p>
        </div>
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar?'يلزم 5 مستجيبين على الأقل وفقرتان فأكثر':'Need ≥ 5 respondents and ≥ 2 items'}</p>}

      {result && (
        <>
          {/* Overall alpha */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { l: 'n', v: String(result.n), c: C.text },
              { l: ar?'فقرات':'Items', v: String(result.p), c: C.text },
              { l: 'α (كرونباخ)', v: result.overallAlpha.toFixed(3), c: result.overallAlpha >= 0.7 ? C.green : result.overallAlpha >= 0.6 ? C.gold : C.red },
              { l: ar?'فقرات جيدة CITC≥0.4':'Good items CITC≥0.4', v: String(result.items.filter(it=>it.citc>=0.4).length), c: C.green },
              { l: ar?'فقرات ضعيفة CITC<0.3':'Poor items CITC<0.3', v: String(result.items.filter(it=>it.citc<0.3).length), c: result.items.filter(it=>it.citc<0.3).length ? C.red : C.green },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 10, color: C.sub }}>{l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* CITC + D bar chart */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 10 }}>
              {ar?'الارتباط المصحَّح بالدرجة الكلية (CITC) ومؤشر التمييز (D) لكل فقرة':'CITC & Discrimination Index D per item'}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={result.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.sub }}/>
                <YAxis domain={[-0.1, 1]} tick={{ fontSize: 9, fill: C.sub }} width={30}/>
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }}/>
                <Legend wrapperStyle={{ fontSize: 11, color: C.sub }}/>
                <ReferenceLine y={0.4} stroke={C.green} strokeDasharray="6 3" label={{ value: '0.4', fill: C.green, fontSize: 9, position: 'insideTopRight' }}/>
                <ReferenceLine y={0.3} stroke={C.gold} strokeDasharray="4 3" label={{ value: '0.3', fill: C.gold, fontSize: 9, position: 'insideTopRight' }}/>
                <Bar dataKey="CITC" fill={`${C.blue}bb`} radius={[3,3,0,0]} name="CITC"/>
                <Bar dataKey="D" fill={`${C.teal}99`} radius={[3,3,0,0]} name="D (Discrim.)"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Item analysis table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar?'جدول تحليل الفقرات التفصيلي':'Detailed Item Analysis Table'}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[ar?'الفقرة':'Item', ar?'م':'M', ar?'ع':'SD', ar?'الصعوبة P':'Difficulty P', 'CITC', ar?'التمييز D':'Discrim. D', ar?'α بحذفها':'α if del.', ar?'الحالة':'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'center', color: C.sub, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {result.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: it.status === 'poor' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: C.text }}>{result.vnames[i] ?? `Q${i+1}`}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.sub }}>{it.m.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted }}>{it.sd.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: diffC(it.difficulty) }}>{(it.difficulty*100).toFixed(1)}%<div style={{ fontSize: 9, color: C.muted }}>{it.difficulty > 0.8 ? (ar?'سهلة':'Easy') : it.difficulty < 0.2 ? (ar?'صعبة':'Hard') : (ar?'متوسطة':'Moderate')}</div></td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: citcC(it.citc), fontWeight: 700 }}>{it.citc.toFixed(3)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: discC(it.disc), fontWeight: 600 }}>{it.disc.toFixed(3)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted }}>{it.alphaIfDel.toFixed(3)}<div style={{ fontSize: 9, color: it.alphaIfDel > result.overallAlpha + 0.01 ? C.red : C.muted }}>{it.alphaIfDel > result.overallAlpha + 0.01 ? (ar?'↑ يُحسَّن بحذفها':'↑ improves α') : ''}</div></td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: statusColor(it.status), fontWeight: 700 }}>{statusLabel(it.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            <strong style={{ color: C.sub }}>{ar?'معيار التقييم: ':'Criteria: '}</strong>
            {ar ? 'CITC ≥ 0.4 = جيدة · 0.3–0.4 = مقبولة · < 0.3 = مرشحة للحذف | P: 0.2–0.8 = مدى مناسب | D ≥ 0.4 = ممتاز · 0.3–0.4 = جيد · 0.2–0.3 = مقبول · < 0.2 = ضعيف'
                : 'CITC ≥ 0.4 = good · 0.3–0.4 = marginal · < 0.3 = candidate for removal | P: 0.2–0.8 = good difficulty range | D ≥ 0.4 = excellent · 0.3–0.4 = good · 0.2–0.3 = marginal · < 0.2 = poor'}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── OUTLIER DETECTION ────────────────────────────────────────────────────
function OutlierDetection({ ar }: { ar: boolean }) {
  const [raw, setRaw] = useState('12 15 14 10 98 16 13 14 12 15 11 14 16 13 12 14 15 13 99 12');
  const [zThr, setZThr] = useState(2.5);

  const parse = (s: string) => s.split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));

  const result = useMemo(() => {
    const vals = parse(raw);
    if (vals.length < 4) return null;
    const n = vals.length;
    const mu = avg(vals);
    const sd = Math.sqrt(vals.reduce((s, x) => s + (x - mu)**2, 0) / Math.max(1, n - 1));
    const sorted = [...vals].sort((a, b) => a - b);

    // Quartiles (linear interpolation)
    const quart = (p: number) => {
      const pos = p * (n - 1);
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    };
    const q1 = quart(0.25), median = quart(0.5), q3 = quart(0.75);
    const iqr = q3 - q1;
    const fence_lo = q1 - 1.5 * iqr, fence_hi = q3 + 1.5 * iqr;
    const whi_lo = sorted.find(v => v >= fence_lo) ?? sorted[0];
    const whi_hi = [...sorted].reverse().find(v => v <= fence_hi) ?? sorted[sorted.length - 1];

    const rows = vals.map((v, i) => {
      const z = (v - mu) / Math.max(1e-10, sd);
      return { i: i + 1, v, z, zOut: Math.abs(z) > zThr, iqrOut: v < fence_lo || v > fence_hi };
    });

    const iqrOutVals = rows.filter(r => r.iqrOut).map(r => r.v);
    const zOutVals   = rows.filter(r => r.zOut).map(r => r.v);

    // Data for histogram (recharts)
    const mn = sorted[0], mx = sorted[sorted.length - 1];
    const bins = 10, bw = (mx - mn) / bins;
    const hist = Array.from({ length: bins }, (_, b) => {
      const lo = mn + b * bw, hi = mn + (b + 1) * bw;
      return { label: lo.toFixed(1), count: vals.filter(v => v >= lo && (b === bins - 1 ? v <= hi : v < hi)).length, lo, hi };
    });

    return { vals, n, mu, sd, sorted, q1, median, q3, iqr, fence_lo, fence_hi, whi_lo, whi_hi, rows, iqrOutVals, zOutVals, hist, mn, mx };
  }, [raw, zThr]);

  const BoxPlot = () => {
    if (!result) return null;
    const { q1, median, q3, whi_lo, whi_hi, iqrOutVals, mn, mx } = result;
    const W = 500, H = 80, PAD = 40;
    const sc = (v: number) => PAD + ((v - mn) / Math.max(1e-10, mx - mn)) * (W - 2 * PAD);
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible', display: 'block' }}>
        <line x1={sc(whi_lo)} y1={H/2} x2={sc(q1)} y2={H/2} stroke={C.sub} strokeWidth={1.5}/>
        <line x1={sc(q3)} y1={H/2} x2={sc(whi_hi)} y2={H/2} stroke={C.sub} strokeWidth={1.5}/>
        {[whi_lo, whi_hi].map((v, i) => <line key={i} x1={sc(v)} y1={H/2-8} x2={sc(v)} y2={H/2+8} stroke={C.sub} strokeWidth={1.5}/>)}
        <rect x={sc(q1)} y={H/2-14} width={Math.max(1,sc(q3)-sc(q1))} height={28} fill="rgba(96,165,250,0.18)" stroke={C.blue} strokeWidth={1.5} rx={3}/>
        <line x1={sc(median)} y1={H/2-14} x2={sc(median)} y2={H/2+14} stroke={C.gold} strokeWidth={3}/>
        {iqrOutVals.map((v, i) => <circle key={i} cx={sc(v)} cy={H/2} r={5} fill="rgba(239,68,68,0.75)" stroke={C.red} strokeWidth={1.5}/>)}
        {[{ v: q1, lbl: `Q1=${q1.toFixed(2)}`, col: C.sub }, { v: median, lbl: `M=${result.median.toFixed(2)}`, col: C.gold }, { v: q3, lbl: `Q3=${q3.toFixed(2)}`, col: C.sub }].map(({ v, lbl, col }) => (
          <text key={lbl} x={sc(v)} y={H + 16} textAnchor="middle" fontSize={9} fill={col}>{lbl}</text>
        ))}
        {[mn, mx].map((v, i) => <text key={i} x={sc(v)} y={H/2 - 20} textAnchor="middle" fontSize={9} fill={C.muted}>{v.toFixed(1)}</text>)}
      </svg>
    );
  };

  return (
    <div>
      {/* Input */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
          {ar ? 'البيانات (أرقام مفصولة بمسافات أو فواصل)' : 'Data (numbers separated by spaces or commas)'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {/* Z-score threshold */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: C.sub }}>{ar ? 'عتبة Z-score:' : 'Z-score threshold:'}</label>
        {[2, 2.5, 3].map(t => (
          <button key={t} onClick={() => setZThr(t)}
            style={{ background: zThr === t ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${zThr === t ? C.gold : C.border}`, borderRadius: 8, padding: '5px 14px', color: zThr === t ? C.gold : C.sub, cursor: 'pointer', fontFamily: 'inherit', fontWeight: zThr === t ? 700 : 400, fontSize: 13 }}>
            |z| {`>`} {t}
          </button>
        ))}
        <span style={{ fontSize: 11, color: C.muted }}>{ar ? '(المتحفظ: 2.5 ، الصارم: 3)' : '(Moderate: 2.5, Strict: 3)'}</span>
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'أدخل 4 قيم على الأقل' : 'Enter at least 4 values'}</p>}

      {result && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'n', val: String(result.n), color: C.text },
              { label: ar?'المتوسط':'Mean', val: result.mu.toFixed(3), color: C.text },
              { label: ar?'الانحراف':'SD', val: result.sd.toFixed(3), color: C.text },
              { label: 'IQR', val: result.iqr.toFixed(3), color: C.blue },
              { label: ar?'شوارد IQR':'IQR Outliers', val: String(result.iqrOutVals.length), color: result.iqrOutVals.length ? C.red : C.green },
              { label: `|z|>${zThr}`, val: String(result.zOutVals.length), color: result.zOutVals.length ? C.red : C.green },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 10, color: C.sub }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Box plot */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 12 }}>
              {ar ? 'مخطط الصندوق (Box Plot) — النقاط الحمراء = شوارد IQR' : 'Box Plot — Red dots = IQR outliers'}
            </div>
            <BoxPlot />
          </div>

          {/* IQR boundaries */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 12 }}>
            <strong style={{ color: C.text }}>{ar ? 'حدود IQR: ' : 'IQR Fences: '}</strong>
            <span style={{ color: C.sub }}>
              {ar ? `السياج السفلي = Q1 − 1.5×IQR = ` : 'Lower fence = Q1 − 1.5×IQR = '}<strong style={{ color: C.blue }}>{result.fence_lo.toFixed(3)}</strong>
              {' · '}
              {ar ? `السياج العلوي = Q3 + 1.5×IQR = ` : 'Upper fence = Q3 + 1.5×IQR = '}<strong style={{ color: C.blue }}>{result.fence_hi.toFixed(3)}</strong>
            </span>
            {result.iqrOutVals.length > 0 && (
              <div style={{ marginTop: 6, color: C.red }}>
                {ar ? 'القيم الشاذة: ' : 'Outlier values: '}{result.iqrOutVals.join(', ')}
              </div>
            )}
          </div>

          {/* Observation table (compact) */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              {ar ? 'تفصيل القيم (المُعلَّمة = شاذة)' : 'Value Detail (highlighted = outlier)'}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#080f22' }}>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['#', ar?'القيمة':'Value', 'z-score', 'IQR', `|z|>${zThr}`].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(({ i, v, z, zOut, iqrOut }) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: (zOut || iqrOut) ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                      <td style={{ padding: '5px 12px', textAlign: 'center', color: C.muted }}>{i}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'center', fontWeight: (zOut||iqrOut)?700:400, color: (zOut||iqrOut)?C.red:C.text }}>{v}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'center', color: Math.abs(z)>zThr?C.red:C.sub }}>{z.toFixed(3)}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'center' }}>{iqrOut ? <span style={{ color: C.red, fontWeight: 700 }}>✗ شاذ</span> : <span style={{ color: C.green }}>✓</span>}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'center' }}>{zOut  ? <span style={{ color: C.red, fontWeight: 700 }}>✗ شاذ</span> : <span style={{ color: C.green }}>✓</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histogram */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 10 }}>{ar ? 'التوزيع التكراري' : 'Distribution Histogram'}</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={result.hist} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.sub }} />
                <YAxis tick={{ fontSize: 9, fill: C.sub }} width={24} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" radius={[3,3,0,0]}>
                  {result.hist.map((bin, i) => (
                    <Cell key={i} fill={bin.lo < result.fence_lo || bin.hi > result.fence_hi ? `${C.red}99` : `${C.blue}99`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p style={{ fontSize: 11, color: C.muted, marginBottom: 0 }}>
            {ar ? '* طريقة IQR: الأكثر مقاومةً لحجم العينة · Z-score: مناسبة للتوزيع الطبيعي · اتخذ قراراً تحليلياً قبل حذف أي قيمة شاذة'
                : '* IQR method is robust to sample size · Z-score assumes normality · Make an analytical decision before removing any outlier'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── EXPLORATORY FACTOR ANALYSIS (EFA) ────────────────────────────────────
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const D = A.map(row => [...row]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sw = 0; sw < 50 * n * n; sw++) {
    let mx = 0, p = 0, q = 1;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) if (Math.abs(D[i][j]) > mx) { mx = Math.abs(D[i][j]); p = i; q = j; }
    if (mx < 1e-10) break;
    const dif = D[q][q] - D[p][p];
    const phi = dif === 0 ? Math.PI / 4 : 0.5 * Math.atan2(2 * D[p][q], dif);
    const c = Math.cos(phi), s = Math.sin(phi);
    const Dpp = D[p][p], Dqq = D[q][q], Dpq = D[p][q];
    D[p][p] = c*c*Dpp - 2*s*c*Dpq + s*s*Dqq;
    D[q][q] = s*s*Dpp + 2*s*c*Dpq + c*c*Dqq;
    D[p][q] = D[q][p] = 0;
    for (let r = 0; r < n; r++) {
      if (r !== p && r !== q) { const dp = D[r][p], dq = D[r][q]; D[r][p] = D[p][r] = c*dp - s*dq; D[r][q] = D[q][r] = s*dp + c*dq; }
      const vp = V[r][p], vq = V[r][q]; V[r][p] = c*vp - s*vq; V[r][q] = s*vp + c*vq;
    }
  }
  const ord = D.map((row, i) => ({ v: row[i], i })).sort((a, b) => b.v - a.v);
  return { values: ord.map(x => x.v), vectors: ord.map(x => V.map(row => row[x.i])) };
}

function faCorrMat(data: number[][]): number[][] {
  const n = data.length, p = data[0].length;
  const mu = Array.from({ length: p }, (_, j) => avg(data.map(r => r[j])));
  const sd = Array.from({ length: p }, (_, j) => { const col = data.map(r => r[j]); return Math.sqrt(col.reduce((s, x) => s + (x - mu[j])**2, 0) / Math.max(1, n-1)); });
  return Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => {
    if (i === j) return 1;
    if (sd[i] < 1e-10 || sd[j] < 1e-10) return 0;
    return data.reduce((s, r) => s + (r[i]-mu[i])*(r[j]-mu[j]), 0) / ((n-1)*sd[i]*sd[j]);
  }));
}

function FactorAnalysis({ ar }: { ar: boolean }) {
  const DEF = `4 3 5 4 3 5 4 3
3 4 3 4 3 4 3 4
5 5 4 5 5 4 5 5
2 3 2 3 2 3 2 3
4 4 5 4 4 5 4 4
3 3 3 3 3 3 3 3
5 4 4 5 4 4 5 4
4 5 5 4 5 5 4 5
2 2 3 2 2 3 2 2
5 5 5 5 5 5 5 5
3 4 4 3 4 4 3 4
1 2 1 2 1 2 1 2`;
  const [raw, setRaw] = useState(DEF);
  const [names, setNames] = useState('');

  const result = useMemo(() => {
    const lines = raw.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const data = lines.map(l => l.trim().split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v)));
    if (!data.length) return null;
    const p = Math.min(...data.map(r => r.length));
    if (data.length < p + 1 || p < 2) return null;
    const D = data.map(r => r.slice(0, p));
    const n = D.length;

    const R = faCorrMat(D);
    const { values: λ, vectors: Vecs } = jacobiEigen(R);
    const nF = Math.min(p, Math.max(1, λ.filter(v => v > 1).length), 8);
    const L = Array.from({ length: p }, (_, i) => Array.from({ length: nF }, (_, k) => Vecs[i][k] * Math.sqrt(Math.max(0, λ[k]))));
    const h2 = Array.from({ length: p }, (_, i) => L[i].reduce((s, l) => s + l*l, 0));

    const totalVar = p;
    const pctVar = λ.map(v => v / totalVar * 100);
    const cumPct = pctVar.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);

    let kmo = 0;
    const Rinv = matInv(R);
    if (Rinv) {
      let sR2 = 0, sA2 = 0;
      for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
        if (i === j) continue;
        sR2 += R[i][j]**2;
        const aij = -Rinv[i][j] / Math.sqrt(Math.abs(Rinv[i][i] * Rinv[j][j]));
        sA2 += aij**2;
      }
      kmo = sR2 / (sR2 + sA2);
    }

    const detR = λ.reduce((prod, v) => prod * Math.max(1e-100, v), 1);
    const chi2 = Math.max(0, -(n - 1 - (2*p + 5)/6) * Math.log(Math.max(1e-100, detR)));
    const bartDf = p * (p - 1) / 2;
    const bartP = 1 - chiSqP(chi2, bartDf);

    const vnames = names.trim() ? names.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : Array.from({ length: p }, (_, i) => `V${i+1}`);
    const screeData = λ.slice(0, Math.min(p, 15)).map((v, i) => ({ factor: `F${i+1}`, λ: +v.toFixed(4) }));

    return { L, λ, nF, h2, pctVar, cumPct: cumPct.slice(0, nF), kmo, chi2, bartDf, bartP, vnames: vnames.slice(0, p), screeData, n, p };
  }, [raw, names]);

  const kmoLabel = (k: number) => k > 0.9 ? (ar?'ممتاز':'Marvelous') : k > 0.8 ? (ar?'جيد جداً':'Meritorious') : k > 0.7 ? (ar?'متوسط':'Middling') : k > 0.6 ? (ar?'مقبول':'Mediocre') : k > 0.5 ? (ar?'ضعيف':'Miserable') : (ar?'غير مقبول':'Unacceptable');
  const kmoColor = (k: number) => k > 0.7 ? C.green : k > 0.5 ? C.gold : C.red;
  const loadBg = (l: number) => { const a=Math.abs(l); return a>=0.6?'rgba(201,168,76,0.3)':a>=0.4?'rgba(96,165,250,0.2)':a>=0.3?'rgba(94,234,212,0.12)':'transparent'; };
  const loadColor = (l: number) => { const a=Math.abs(l); return a>=0.6?C.gold:a>=0.4?C.blue:a>=0.3?C.teal:C.muted; };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'البيانات — كل سطر مشاهدة · كل عمود عنصر (فقرة)' : 'Data — each row = 1 observation, each column = 1 item/variable'}
          </label>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={9}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>
            {ar ? 'أسماء المتغيرات (اختياري، سطر لكل اسم)' : 'Variable names (optional, one per line)'}
          </label>
          <textarea value={names} onChange={e => setNames(e.target.value)} rows={9} placeholder={'V1\nV2\nV3\n...'}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم n > p ≥ 2 (مشاهدات أكثر من متغيرات)' : 'Need n > p ≥ 2 (more observations than variables)'}</p>}

      {result && (
        <>
          {/* KMO + Bartlett */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 18px', flex: '0 0 auto', minWidth: 160 }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>KMO {ar ? '(ملاءمة العينة)' : '(Sampling Adequacy)'}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: kmoColor(result.kmo) }}>{result.kmo.toFixed(3)}</div>
              <div style={{ fontSize: 11, color: kmoColor(result.kmo), marginTop: 2 }}>{kmoLabel(result.kmo)}</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 18px', flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>{ar ? "اختبار Bartlett للتروية" : "Bartlett's Test of Sphericity"}</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div><span style={{ fontSize: 11, color: C.muted }}>χ²({result.bartDf}) = </span><strong style={{ color: C.text, fontSize: 14 }}>{result.chi2.toFixed(2)}</strong></div>
                <div><span style={{ fontSize: 11, color: C.muted }}>p = </span><strong style={{ color: result.bartP < 0.05 ? C.green : C.red }}>{result.bartP < 0.001 ? '< .001' : result.bartP.toFixed(3)}</strong></div>
                <span style={{ fontSize: 11, color: result.bartP < 0.05 ? C.green : C.red }}>
                  {result.bartP < 0.05 ? (ar ? '✓ مناسب للتحليل العاملي' : '✓ Suitable for FA') : (ar ? '✗ غير مناسب' : '✗ Not suitable')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>n = {result.n} · p = {result.p} · {ar ? 'عوامل مقترحة (λ>1)' : 'Suggested factors (λ>1)'}: {result.nF}</div>
            </div>
          </div>

          {/* Scree + Loadings side-by-side on wide screens */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 10 }}>
                {ar ? 'مخطط Scree — معيار Kaiser: الاحتفاظ بالعوامل ذات λ > 1' : 'Scree Plot — Kaiser criterion: retain factors with λ > 1'}
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart data={result.screeData} margin={{ top: 4, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="factor" tick={{ fontSize: 10, fill: C.sub }} />
                  <YAxis tick={{ fontSize: 10, fill: C.sub }} width={34} />
                  <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => v.toFixed(3)} />
                  <ReferenceLine y={1} stroke={C.red} strokeDasharray="6 3" label={{ value: 'λ=1', fill: C.red, fontSize: 10, position: 'insideTopRight' }} />
                  <Bar dataKey="λ" fill={`${C.gold}bb`} radius={[4,4,0,0]} />
                  <Line type="linear" dataKey="λ" stroke={C.blue} dot={{ r: 4, fill: C.blue }} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Loadings table */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
                {ar ? `مصفوفة التشبعات (${result.nF} عوامل — PCA بدون تدوير)` : `Factor Loading Matrix (${result.nF} factors — Unrotated PCA)`}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '7px 12px', textAlign: ar?'right':'left', color: C.sub, minWidth: 70 }}>{ar?'المتغير':'Variable'}</th>
                    {Array.from({ length: result.nF }, (_, k) => <th key={k} style={{ padding: '7px 10px', color: C.gold, textAlign: 'center', minWidth: 60 }}>F{k+1}<div style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>{result.pctVar[k].toFixed(1)}%</div></th>)}
                    <th style={{ padding: '7px 10px', color: C.sub, textAlign: 'center', minWidth: 50 }}>h²</th>
                  </tr></thead>
                  <tbody>
                    {result.vnames.map((name, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600, color: C.text }}>{name}</td>
                        {Array.from({ length: result.nF }, (_, k) => {
                          const l = result.L[i][k];
                          return <td key={k} style={{ padding: '6px 10px', textAlign: 'center', background: loadBg(l), color: loadColor(l), fontWeight: Math.abs(l)>=0.4?700:400 }}>{l.toFixed(3)}</td>;
                        })}
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted }}>{result.h2[i].toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '7px 12px', color: C.sub, fontSize: 10 }}>{ar?'% مفسَّر':'% Variance'}</td>
                      {Array.from({ length: result.nF }, (_, k) => <td key={k} style={{ padding: '7px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, fontSize: 10 }}>{result.pctVar[k].toFixed(1)}%</td>)}
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: C.gold, fontWeight: 700, fontSize: 10 }}>{result.h2.reduce((s,h)=>s+h,0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 12px', color: C.muted, fontSize: 10 }}>{ar?'% تراكمي':'% Cum.'}</td>
                      {result.cumPct.map((c, k) => <td key={k} style={{ padding: '4px 10px', textAlign: 'center', color: C.muted, fontSize: 10 }}>{c.toFixed(1)}%</td>)}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['rgba(201,168,76,0.3)', C.gold, ar?'|λ|≥0.6 تشبع عالٍ':'|λ|≥0.6 High'], ['rgba(96,165,250,0.2)', C.blue, ar?'|λ|≥0.4 متوسط':'|λ|≥0.4 Moderate'], ['rgba(94,234,212,0.12)', C.teal, ar?'|λ|≥0.3 ضعيف':'|λ|≥0.3 Low']].map(([bg, col, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <div style={{ width: 18, height: 12, borderRadius: 3, background: bg as string, border: `1px solid ${col}50` }} />
                <span style={{ color: C.sub }}>{label}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 0 }}>
            {ar ? '* استخلاص المكونات الرئيسية (PCA) بدون تدوير · لتدوير Varimax أو Oblimin استخدم R/SPSS/JASP · الكفاية: KMO > 0.7 و p(Bartlett) < .05'
                : '* Unrotated PCA extraction · For Varimax/Oblimin rotation use R/SPSS/JASP · Adequacy: KMO > 0.7 and p(Bartlett) < .05'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── EFFECT SIZE CONVERTER ─────────────────────────────────────────────────
type ESType = 'd' | 'r' | 'f' | 'eta2' | 'OR' | 'V';

function EffectSizeConverter({ ar }: { ar: boolean }) {
  const [type, setType] = useState<ESType>('d');
  const [valStr, setValStr] = useState('0.50');
  const [nStr, setNStr] = useState('');

  const ES_TYPES: { key: ESType; label: string; hint: string }[] = [
    { key: 'd',    label: "Cohen's d",     hint: ar ? 'الفرق بين متوسطين بوحدات الانحراف المعياري' : 'Standardized mean difference' },
    { key: 'r',    label: 'Pearson r',     hint: ar ? 'معامل الارتباط (−1 إلى 1)'             : 'Correlation coefficient (−1 to 1)' },
    { key: 'f',    label: "Cohen's f",     hint: ar ? 'حجم أثر ANOVA (f = d/2 للمجموعتين)'    : 'ANOVA effect size (f = d/2 for 2 groups)' },
    { key: 'eta2', label: 'η² (eta²)',     hint: ar ? 'نسبة التباين المفسَّر (0 إلى 1)'       : 'Proportion of variance explained' },
    { key: 'OR',   label: 'Odds Ratio',    hint: ar ? 'نسبة الحظوظ (يجب أن تكون > 0)'         : 'Odds ratio (must be > 0)' },
    { key: 'V',    label: "Cramér's V",    hint: ar ? 'حجم أثر جداول التقاطع (0 إلى 1)'      : 'Chi-square table effect size (0 to 1)' },
  ];

  const result = useMemo(() => {
    const v = parseFloat(valStr);
    const n = parseFloat(nStr);
    if (isNaN(v)) return null;

    let d: number;
    switch (type) {
      case 'd':    d = v; break;
      case 'r':    { const rc = Math.max(-0.9999, Math.min(0.9999, v)); d = 2 * rc / Math.sqrt(Math.max(1e-10, 1 - rc * rc)); break; }
      case 'f':    d = 2 * Math.abs(v); break;
      case 'eta2': { const e = Math.max(0, Math.min(0.9999, v)); d = Math.sqrt(4 * e / Math.max(1e-10, 1 - e)); break; }
      case 'OR':   d = Math.log(Math.max(1e-10, v)) * Math.sqrt(3) / Math.PI; break;
      case 'V':    { const vc = Math.max(0, Math.min(0.9999, v)); d = 2 * vc / Math.sqrt(Math.max(1e-10, 1 - vc * vc)); break; }
      default:     d = 0;
    }

    const da = Math.abs(d);
    const r   = Math.max(-0.9999, Math.min(0.9999, d / Math.sqrt(d * d + 4)));
    const ra  = Math.abs(r);
    const f   = da / 2;
    const eta2 = da * da / (da * da + 4);
    const R2   = r * r;
    const OR_  = Math.exp(d * Math.PI / Math.sqrt(3));
    const fisherZ = Math.atanh(r);
    const V_   = ra / Math.sqrt(ra * ra + 1 - ra * ra); // ≈ r for 2x2

    // Hedge's g (bias-corrected d) — requires n
    const g = (!isNaN(n) && n > 4) ? d * (1 - 3 / (4 * (n - 2) - 1)) : null;

    // 95% CI for d (Hedges approximation)
    const ci = (!isNaN(n) && n > 4) ? 1.96 * Math.sqrt(4 / n + d * d / (2 * n)) : null;

    // Power (for two-group t-test at α=.05 with equal groups)
    const powerArr = (!isNaN(n) && n > 4) ? [0.8, 0.9, 0.95].map(pow => {
      // Solve for n from power: n = ((z_α/2 + z_β) / (d/2))² * 2
      const zB = pow === 0.8 ? 0.842 : pow === 0.9 ? 1.282 : 1.645;
      const nReq = Math.ceil(2 * ((1.96 + zB) / Math.max(0.01, da)) ** 2);
      return { pow, nReq };
    }) : null;

    // Interpretation
    const interpD = da < 0.1 ? (ar ? 'ضئيل جداً' : 'Negligible') : da < 0.2 ? (ar ? 'صغير جداً' : 'Very small') : da < 0.5 ? (ar ? 'صغير' : 'Small') : da < 0.8 ? (ar ? 'متوسط' : 'Medium') : da < 1.2 ? (ar ? 'كبير' : 'Large') : (ar ? 'كبير جداً' : 'Very large');
    const interpR  = ra < 0.1 ? (ar ? 'ضئيل' : 'Negligible') : ra < 0.3 ? (ar ? 'صغير' : 'Small') : ra < 0.5 ? (ar ? 'متوسط' : 'Medium') : (ar ? 'كبير' : 'Large');
    const colorD   = da < 0.2 ? C.muted : da < 0.5 ? C.blue : da < 0.8 ? C.gold : C.green;

    return { d, r, f, eta2, R2, OR: OR_, fisherZ, V: V_, g, ci, interpD, interpR, colorD, powerArr };
  }, [valStr, type, nStr]);

  const fmt = (v: number | null, dec = 4) => v === null ? '—' : v.toFixed(dec);

  return (
    <div>
      {/* Type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 16 }}>
        {ES_TYPES.map(tp => (
          <button key={tp.key} onClick={() => setType(tp.key)}
            style={{ background: type === tp.key ? 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.07))' : 'rgba(255,255,255,0.02)', border: `1px solid ${type === tp.key ? 'rgba(201,168,76,0.45)' : C.border}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: ar ? 'right' : 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: type === tp.key ? C.gold : C.text }}>{tp.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{tp.hint}</div>
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{ES_TYPES.find(t => t.key === type)?.label} =</label>
          <input type="number" step="0.01" value={valStr} onChange={e => setValStr(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.gold}60`, borderRadius: 9, padding: '10px 14px', color: C.text, fontSize: 16, fontWeight: 700, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{ar ? 'n الكلي (اختياري — للـ CI وHedge\'s g)' : 'Total n (optional — for CI & Hedge\'s g)'}</label>
          <input type="number" value={nStr} onChange={e => setNStr(e.target.value)} placeholder={ar ? 'مثلاً 120' : 'e.g. 120'}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
        </div>
      </div>

      {result && (
        <>
          {/* Conversion table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'التحويل إلى مقاييس أخرى' : 'Converted Effect Sizes'}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'المقياس' : 'Metric', ar ? 'القيمة' : 'Value', ar ? 'التفسير' : 'Benchmark', ar ? 'المرجع' : 'Source'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: ar ? 'right' : 'left', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { label: "Cohen's d",    val: fmt(result.d, 3),      bench: `${result.interpD} (0.2/0.5/0.8)`, src: 'Cohen 1988' },
                  { label: "Hedge's g",    val: fmt(result.g, 3),      bench: ar ? 'تصحيح للعينات الصغيرة' : 'Bias-corrected d', src: 'Hedges 1981' },
                  { label: 'Pearson r',    val: fmt(result.r, 4),      bench: `${result.interpR} (0.1/0.3/0.5)`, src: 'Cohen 1988' },
                  { label: 'R² (r²)',      val: `${(result.R2*100).toFixed(1)}%`, bench: ar ? '% تباين مشترك' : '% Shared variance', src: '' },
                  { label: "Cohen's f",    val: fmt(result.f, 3),      bench: 'Small/Med/Large: 0.1/0.25/0.4', src: 'Cohen 1988' },
                  { label: 'η² (eta²)',    val: fmt(result.eta2, 4),   bench: 'Small/Med/Large: 0.01/0.06/0.14', src: 'Cohen 1988' },
                  { label: 'Odds Ratio',   val: fmt(result.OR, 3),     bench: 'Small/Med/Large: 1.5/2.5/4.3', src: 'Cohen 1988' },
                  { label: "Fisher's z",   val: fmt(result.fisherZ, 4), bench: ar ? 'لتقدير الفترة الثقة لـ r' : 'For CI of r', src: 'Fisher 1921' },
                  { label: "Cramér's V",   val: fmt(Math.abs(result.r), 4), bench: '≈ r for 2×2 table', src: '' },
                  ...(result.ci !== null ? [{ label: '95% CI (d)',   val: `[${fmt(result.d - result.ci, 3)}, ${fmt(result.d + result.ci, 3)}]`, bench: ar ? 'تقريبي' : 'Approximate', src: 'Hedges & Olkin' }] : []),
                ].map(({ label, val, bench, src }) => (
                  <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: label === "Cohen's d" ? result.colorD : C.text }}>{label}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: label === "Cohen's d" ? result.colorD : C.text, fontWeight: label === "Cohen's d" ? 800 : 400, fontSize: label === "Cohen's d" ? 14 : 12 }}>{val}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: C.muted }}>{bench}</td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: C.muted }}>{src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Power table */}
          {result.powerArr && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'حجم العينة المطلوب (t-test مجموعتان متساويتان · α = .05)' : 'Required n per group (independent t-test · α = .05)'}</div>
              <div style={{ display: 'flex', gap: 0 }}>
                {result.powerArr.map(({ pow, nReq }) => (
                  <div key={pow} style={{ flex: 1, padding: '14px', textAlign: 'center', borderLeft: ar ? 'none' : `1px solid ${C.border}`, borderRight: ar ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? `قدرة ${(pow*100).toFixed(0)}%` : `Power ${(pow*100).toFixed(0)}%`}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{nReq}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{ar ? 'لكل مجموعة' : 'per group'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual bar */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 8, fontWeight: 600 }}>{ar ? 'موضع d على مقياس كوهن' : "Position on Cohen's d scale"}</div>
            <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'linear-gradient(to right,rgba(239,68,68,0.3),rgba(251,191,36,0.4),rgba(74,222,128,0.4))', overflow: 'visible' }}>
              {[{ x: 0.2, label: '0.2' }, { x: 0.5, label: '0.5' }, { x: 0.8, label: '0.8' }].map(({ x, label }) => (
                <div key={x} style={{ position: 'absolute', left: `${Math.min(95, x / 1.5 * 100)}%`, top: 0, height: '100%', width: 2, background: 'rgba(255,255,255,0.2)' }}>
                  <span style={{ position: 'absolute', top: 16, left: -6, fontSize: 10, color: C.muted }}>{label}</span>
                </div>
              ))}
              <div style={{ position: 'absolute', top: -4, width: 22, height: 22, borderRadius: '50%', background: result.colorD, border: '3px solid #fff', transform: 'translateX(-50%)', left: `${Math.min(97, Math.abs(result.d) / 1.5 * 100)}%`, boxShadow: `0 0 10px ${result.colorD}`, transition: 'left 0.3s' }} />
            </div>
            <div style={{ marginTop: 22, textAlign: 'center', fontSize: 14, fontWeight: 800, color: result.colorD }}>
              |d| = {Math.abs(result.d).toFixed(3)} — {result.interpD}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── MODERATION ANALYSIS ──────────────────────────────────────────────────
function ModerationAnalysis({ ar }: { ar: boolean }) {
  const [xRaw, setXRaw] = useState('2 3 4 5 6 7 2 3 4 5 6 7 2 3 4 5 6 7');
  const [wRaw, setWRaw] = useState('1 1 1 1 1 1 3 3 3 3 3 3 5 5 5 5 5 5');
  const [yRaw, setYRaw] = useState('50 55 60 65 70 72 55 62 70 78 85 90 60 70 82 92 100 105');

  const parse = (s: string) => s.split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));

  const result = useMemo(() => {
    const xv = parse(xRaw), wv = parse(wRaw), yv = parse(yRaw);
    const n = Math.min(xv.length, wv.length, yv.length);
    if (n < 6) return null;
    const x = xv.slice(0, n), w = wv.slice(0, n), y = yv.slice(0, n);

    // Center X and W for interpretability
    const mx = avg(x), mw = avg(w);
    const xc = x.map(xi => xi - mx);
    const wc = w.map(wi => wi - mw);
    const xw = xc.map((xi, i) => xi * wc[i]);
    const sdW = Math.sqrt(wc.reduce((s, wi) => s + wi * wi, 0) / Math.max(1, n - 1));

    // Design matrix [1, Xc, Wc, Xc*Wc]
    const DM = x.map((_, i) => [1, xc[i], wc[i], xw[i]]);
    const { beta, tv, pv, R2, dof } = olsWithSE(DM, y);
    const [b0, b_X, b_W, b_XW] = beta;

    // Full covariance matrix for simple slope SEs
    const Xt = matT(DM);
    const XtXinv = matInv(matMul(Xt, DM));
    const yhat = DM.map(row => row.reduce((s, xi, j) => s + xi * beta[j], 0));
    const resid = y.map((yi, i) => yi - yhat[i]);
    const MSE = resid.reduce((s, ri) => s + ri * ri, 0) / Math.max(1, dof);

    const wLevels = [
      { wl: -sdW, label: ar ? 'W − 1 انحراف' : 'W − 1 SD' },
      { wl:     0, label: ar ? 'W = المتوسط'  : 'W = Mean' },
      { wl: +sdW, label: ar ? 'W + 1 انحراف' : 'W + 1 SD' },
    ];

    const simpleSlopes = wLevels.map(({ wl, label }) => {
      const slope  = b_X + b_XW * wl;
      const cov_XW = XtXinv ? MSE * XtXinv[1][3] : 0;
      const seB_X  = XtXinv ? Math.sqrt(Math.max(0, MSE * XtXinv[1][1])) : 1;
      const seB_XW = XtXinv ? Math.sqrt(Math.max(0, MSE * XtXinv[3][3])) : 1;
      const se_sl  = Math.sqrt(Math.max(0, seB_X ** 2 + wl ** 2 * seB_XW ** 2 + 2 * wl * cov_XW));
      const t_sl   = slope / Math.max(1e-10, se_sl);
      const p_sl   = 2 * (1 - normalCDF(Math.abs(t_sl)));
      return { label, wl, slope, se_sl, t_sl, p_sl };
    });

    // Interaction plot data (20 points over Xc range)
    const NPTS = 20;
    const xcMin = Math.min(...xc), xcMax = Math.max(...xc);
    const plotData = Array.from({ length: NPTS }, (_, i) => {
      const xci = xcMin + (xcMax - xcMin) * i / (NPTS - 1);
      const row: Record<string, number> = { x: +(xci + mx).toFixed(2) };
      wLevels.forEach(({ wl }, li) => {
        row[`line${li}`] = +(b0 + b_X * xci + b_W * wl + b_XW * xci * wl).toFixed(3);
      });
      return row;
    });

    return { b0, b_X, b_W, b_XW, t_X: tv[1], t_W: tv[2], t_XW: tv[3], p_X: pv[1], p_W: pv[2], p_XW: pv[3], R2, dof, n, simpleSlopes, plotData, wLevels };
  }, [xRaw, wRaw, yRaw]);

  const pF  = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const sig = (p: number) => p < 0.05;
  const COLORS = ['#60a5fa', '#f5d78e', '#4ade80'];

  const SB = ({ label, val, color }: { label: string; val: string; color?: string }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color ?? C.text }}>{val}</div>
    </div>
  );

  return (
    <div>
      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: ar ? 'X — المتغير المستقل' : 'X — Independent Variable', val: xRaw, set: setXRaw },
          { label: ar ? 'W — المعتدِل (Moderator)' : 'W — Moderator Variable', val: wRaw, set: setWRaw },
          { label: ar ? 'Y — المتغير التابع' : 'Y — Dependent Variable',   val: yRaw, set: setYRaw },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 4 }}>{label}</label>
            <textarea rows={3} value={val} onChange={e => set(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>

      {!result && <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'يلزم 6 قيم على الأقل في كل متغير' : 'At least 6 values per variable required'}</p>}

      {result && (
        <>
          {/* Regression table */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>
              Y ~ X + W + X×W &nbsp;<span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>R² = {result.R2.toFixed(3)} · n = {result.n}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'المنبئ' : 'Predictor', 'β', 't', 'p', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: ar ? 'right' : 'left', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { label: 'X (centered)',   b: result.b_X,  t: result.t_X,  p: result.p_X  },
                  { label: 'W (centered)',   b: result.b_W,  t: result.t_W,  p: result.p_W  },
                  { label: 'X × W',         b: result.b_XW, t: result.t_XW, p: result.p_XW },
                ].map(({ label, b, t, p }) => (
                  <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: label === 'X × W' ? 'rgba(201,168,76,0.04)' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: label === 'X × W' ? 700 : 400, color: label === 'X × W' ? C.gold : C.text }}>{label}</td>
                    <td style={{ padding: '8px 12px' }}>{b.toFixed(3)}</td>
                    <td style={{ padding: '8px 12px', color: C.sub }}>{t.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: sig(p) ? C.green : C.red, fontWeight: 700 }}>
                        {sig(p) ? '✓' : '✗'} {pF(p)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: C.muted }}>
                      {label === 'X × W' ? (sig(p) ? (ar ? '✦ تفاعل دال — يوجد اعتدال' : '✦ Sig. interaction = Moderation!') : (ar ? 'لا دليل على اعتدال' : 'No moderation')) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interaction plot */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 12 }}>
              {ar ? 'مخطط التفاعل (Simple Slopes)' : 'Interaction Plot (Simple Slopes)'}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={result.plotData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="x" stroke={C.sub} tick={{ fontSize: 10, fill: C.sub }} label={{ value: 'X', position: 'insideRight', offset: 0, fill: C.sub, fontSize: 11 }} />
                <YAxis stroke={C.sub} tick={{ fontSize: 10, fill: C.sub }} width={40} />
                <Tooltip contentStyle={{ background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {result.wLevels.map(({ label }, i) => (
                  <Line key={i} type="linear" dataKey={`line${i}`} stroke={COLORS[i]} name={label} dot={false} strokeWidth={2} strokeDasharray={i === 0 ? '6 3' : i === 2 ? '2 3' : undefined} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Simple Slopes */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'بسائط المنحدر (Simple Slopes)' : 'Simple Slopes'}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[ar ? 'مستوى W' : 'W level', ar ? 'المنحدر (b_X)' : 'Slope (b_X)', 'SE', 't', 'p'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: ar ? 'right' : 'left', color: C.sub, fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.simpleSlopes.map(({ label, slope, se_sl, t_sl, p_sl }, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', color: COLORS[i], fontWeight: 700 }}>{label}</td>
                    <td style={{ padding: '8px 12px' }}>{slope.toFixed(3)}</td>
                    <td style={{ padding: '8px 12px', color: C.sub }}>{se_sl.toFixed(3)}</td>
                    <td style={{ padding: '8px 12px', color: C.sub }}>{t_sl.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: sig(p_sl) ? C.green : C.red, fontWeight: 700 }}>{sig(p_sl) ? '✓' : '✗'} {pF(p_sl)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key stats + APA */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <SB label="R²" val={result.R2.toFixed(3)} color={C.gold} />
            <SB label="b (X×W)" val={result.b_XW.toFixed(3)} color={sig(result.p_XW) ? C.green : C.red} />
            <SB label="t (X×W)" val={result.t_XW.toFixed(2)} />
            <SB label="p (X×W)" val={pF(result.p_XW)} color={sig(result.p_XW) ? C.green : C.red} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: C.blue, marginBottom: 8 }}>APA (English)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: C.text, lineHeight: 1.8 }}>
              {`The interaction between X and W was ${sig(result.p_XW) ? '' : 'not '}statistically significant, `}
              {`b = ${result.b_XW.toFixed(3)}, t(${result.dof}) = ${result.t_XW.toFixed(2)}, p ${result.p_XW < 0.001 ? '< .001' : `= ${result.p_XW.toFixed(3)}`}, R² = ${result.R2.toFixed(3)}.`}
              {sig(result.p_XW) && ` Simple slopes analysis revealed that the effect of X was ${result.simpleSlopes[2].slope > result.simpleSlopes[0].slope ? 'stronger' : 'weaker'} at high levels of W.`}
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 0 }}>
            {ar ? '* تُمركَز X وW تلقائياً لتقليل التعدد الخطي · لتحليل Johnson-Neyman واستخدام PROCESS Macro (Hayes)'
                : '* X and W are mean-centered to reduce multicollinearity · For Johnson-Neyman regions use PROCESS Macro (Hayes)'}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── NON-PARAMETRIC HELPERS ────────────────────────────────────────────────
function rankArr(arr: number[]): number[] {
  const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array<number>(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j < idx.length && idx[j].v === idx[i].v) j++;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k++) out[idx[k].i] = avg;
    i = j;
  }
  return out;
}

function mwuTest(g1: number[], g2: number[]) {
  const n1 = g1.length, n2 = g2.length, N = n1 + n2;
  const all = [...g1.map(v => ({ v, g: 1 })), ...g2.map(v => ({ v, g: 2 }))].sort((a, b) => a.v - b.v);
  let i = 0;
  while (i < N) {
    let j = i; while (j < N && all[j].v === all[i].v) j++;
    const rk = (i + j + 1) / 2;
    for (let k = i; k < j; k++) (all[k] as { v: number; g: number; rank?: number }).rank = rk;
    i = j;
  }
  const R1 = all.filter(x => x.g === 1).reduce((s, x) => s + ((x as { rank?: number }).rank ?? 0), 0);
  const U1 = n1 * n2 + n1 * (n1 + 1) / 2 - R1;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const z = (U - n1 * n2 / 2) / Math.sqrt(n1 * n2 * (N + 1) / 12);
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const r = Math.abs(z) / Math.sqrt(N);
  return { U, U1, U2, z, p, r };
}

function kwTest(groups: number[][]) {
  const N = groups.reduce((s, g) => s + g.length, 0);
  const tagged = groups.flatMap((g, gi) => g.map(v => ({ v, g: gi }))).sort((a, b) => a.v - b.v);
  let i = 0;
  while (i < N) {
    let j = i; while (j < N && tagged[j].v === tagged[i].v) j++;
    const rk = (i + j + 1) / 2;
    for (let k = i; k < j; k++) (tagged[k] as { v: number; g: number; rank?: number }).rank = rk;
    i = j;
  }
  const H = (12 / (N * (N + 1))) * groups.reduce((s, g, gi) => {
    const Ri = tagged.filter(x => x.g === gi).reduce((acc, x) => acc + ((x as { rank?: number }).rank ?? 0), 0);
    return s + Ri * Ri / g.length;
  }, 0) - 3 * (N + 1);
  const df = groups.length - 1;
  const p = 1 - chiSqP(H, df);
  const eta2 = Math.max(0, (H - df + 1) / (N - df));
  return { H, df, p, eta2 };
}

function spearmanTest(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const rs = pearson(rankArr(xs), rankArr(ys));
  const t = rs * Math.sqrt(n - 2) / Math.sqrt(Math.max(1e-12, 1 - rs * rs));
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  return { rs, t, n, p };
}

type NPTest = 'mwu' | 'kw' | 'spearman';

function NonParametricTests({ ar }: { ar: boolean }) {
  const [test, setTest] = useState<NPTest>('mwu');
  const [g1Raw, setG1Raw] = useState('23 45 34 56 67 45 34 56');
  const [g2Raw, setG2Raw] = useState('12 23 34 15 22 18 25 30');
  const [kwRaws, setKwRaws] = useState(['23 45 34 56 67', '12 23 34 15 22', '45 67 56 78 65']);
  const [xRaw, setXRaw] = useState('23 45 34 56 67 45 34 56 67 78');
  const [yRaw, setYRaw] = useState('12 34 23 45 56 34 23 45 56 67');

  const parse = (s: string) => s.split(/[\s,;،]+/).map(Number).filter(v => isFinite(v) && !isNaN(v));

  const mwuResult  = useMemo(() => { const g1 = parse(g1Raw), g2 = parse(g2Raw); return (test === 'mwu' && g1.length >= 3 && g2.length >= 3) ? mwuTest(g1, g2) : null; }, [test, g1Raw, g2Raw]);
  const kwResult   = useMemo(() => { const gs = kwRaws.map(parse).filter(g => g.length >= 2); return (test === 'kw' && gs.length >= 2) ? kwTest(gs) : null; }, [test, kwRaws]);
  const spResult   = useMemo(() => { const x = parse(xRaw), y = parse(yRaw); return (test === 'spearman' && x.length >= 5 && y.length >= 5) ? spearmanTest(x, y) : null; }, [test, xRaw, yRaw]);

  const TA = { style: { width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'monospace', direction: 'ltr' as const, resize: 'vertical' as const, boxSizing: 'border-box' as const } };
  const pFmt = (p: number) => p < 0.001 ? '< .001' : p.toFixed(3);
  const sig   = (p: number) => p < 0.05;

  const Badge = ({ p }: { p: number }) => (
    <span style={{ background: sig(p) ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${sig(p) ? C.green : C.red}50`, borderRadius: 7, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: sig(p) ? C.green : C.red }}>
      {sig(p) ? (ar ? 'دال (p < .05)' : 'Sig. (p < .05)') : (ar ? 'غير دال' : 'Not sig.')}
    </span>
  );

  const StatBox = ({ label, val }: { label: string; val: string }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 10, color: C.sub, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{val}</div>
    </div>
  );

  const TESTS = [
    { key: 'mwu'     as NPTest, label: ar ? 'مان-ويتني U' : 'Mann-Whitney U', desc: ar ? 'بديل t-test للمجموعتين المستقلتين' : 'Alternative to independent t-test' },
    { key: 'kw'      as NPTest, label: ar ? 'كروسكال-واليس H' : 'Kruskal-Wallis H', desc: ar ? 'بديل ANOVA لثلاث مجموعات فأكثر' : 'Alternative to one-way ANOVA' },
    { key: 'spearman'as NPTest, label: ar ? 'ارتباط سبيرمان ρ' : "Spearman's ρ", desc: ar ? 'بديل ارتباط بيرسون (للرتب أو البيانات غير المعتدلة)' : 'Non-parametric rank correlation' },
  ];

  return (
    <div>
      {/* Test selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginBottom: 18 }}>
        {TESTS.map(tp => (
          <button key={tp.key} onClick={() => setTest(tp.key)}
            style={{ background: test === tp.key ? 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(245,215,142,0.07))' : 'rgba(255,255,255,0.02)', border: `1px solid ${test === tp.key ? 'rgba(201,168,76,0.45)' : C.border}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: ar ? 'right' : 'left', transition: 'all .2s' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: test === tp.key ? C.gold : C.text }}>{tp.label}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{tp.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Mann-Whitney U ── */}
      {test === 'mwu' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[{ label: ar ? 'المجموعة الأولى' : 'Group 1', val: g1Raw, set: setG1Raw }, { label: ar ? 'المجموعة الثانية' : 'Group 2', val: g2Raw, set: setG2Raw }].map(({ label, val, set }) => (
              <div key={label}>
                <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 5 }}>{label}</label>
                <textarea rows={3} value={val} onChange={e => set(e.target.value)} {...TA} />
                <span style={{ fontSize: 10, color: C.muted }}>n = {parse(val).length}</span>
              </div>
            ))}
          </div>
          {mwuResult ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                <StatBox label="U" val={mwuResult.U.toFixed(0)} />
                <StatBox label="z" val={mwuResult.z.toFixed(3)} />
                <StatBox label="p" val={pFmt(mwuResult.p)} />
                <StatBox label="r (effect)" val={mwuResult.r.toFixed(3)} />
                <Badge p={mwuResult.p} />
              </div>
              <div style={{ padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.sub }}>
                <strong style={{ color: C.text }}>APA:</strong> U = {mwuResult.U.toFixed(0)}, z = {mwuResult.z.toFixed(2)}, p {mwuResult.p < 0.001 ? '< .001' : `= ${mwuResult.p.toFixed(3)}`}, r = {mwuResult.r.toFixed(2)}
                <div style={{ marginTop: 6, fontSize: 11 }}>{ar ? `U₁ = ${mwuResult.U1.toFixed(0)} · U₂ = ${mwuResult.U2.toFixed(0)}` : `U₁ = ${mwuResult.U1.toFixed(0)} · U₂ = ${mwuResult.U2.toFixed(0)}`}</div>
              </div>
            </>
          ) : <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'أدخل ≥ 3 قيم في كل مجموعة' : 'Enter ≥ 3 values per group'}</p>}
        </div>
      )}

      {/* ── Kruskal-Wallis ── */}
      {test === 'kw' && (
        <div>
          {kwRaws.map((raw, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 4 }}>{ar ? `المجموعة ${i + 1}` : `Group ${i + 1}`}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <textarea rows={2} value={raw} onChange={e => { const c = [...kwRaws]; c[i] = e.target.value; setKwRaws(c); }} {...TA} />
                {kwRaws.length > 2 && <button onClick={() => setKwRaws(kwRaws.filter((_, j) => j !== i))} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: C.red, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>}
              </div>
              <span style={{ fontSize: 10, color: C.muted }}>n = {parse(raw).length}</span>
            </div>
          ))}
          <button onClick={() => setKwRaws([...kwRaws, ''])} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 16px', color: C.sub, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginBottom: 16 }}>
            {ar ? '+ مجموعة' : '+ Group'}
          </button>
          {kwResult ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                <StatBox label="H" val={kwResult.H.toFixed(3)} />
                <StatBox label={`df`} val={String(kwResult.df)} />
                <StatBox label="p" val={pFmt(kwResult.p)} />
                <StatBox label="η² (ε²)" val={kwResult.eta2.toFixed(3)} />
                <Badge p={kwResult.p} />
              </div>
              <div style={{ padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.sub }}>
                <strong style={{ color: C.text }}>APA:</strong> H({kwResult.df}) = {kwResult.H.toFixed(2)}, p {kwResult.p < 0.001 ? '< .001' : `= ${kwResult.p.toFixed(3)}`}, ε² = {kwResult.eta2.toFixed(2)}
              </div>
            </>
          ) : <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'أدخل ≥ 2 قيم في كل مجموعة' : 'Enter ≥ 2 values per group'}</p>}
        </div>
      )}

      {/* ── Spearman ── */}
      {test === 'spearman' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[{ label: ar ? 'المتغير X' : 'Variable X', val: xRaw, set: setXRaw }, { label: ar ? 'المتغير Y' : 'Variable Y', val: yRaw, set: setYRaw }].map(({ label, val, set }) => (
              <div key={label}>
                <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 5 }}>{label}</label>
                <textarea rows={3} value={val} onChange={e => set(e.target.value)} {...TA} />
                <span style={{ fontSize: 10, color: C.muted }}>n = {parse(val).length}</span>
              </div>
            ))}
          </div>
          {spResult ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                <StatBox label="ρ (Spearman)" val={spResult.rs.toFixed(4)} />
                <StatBox label={`t(${spResult.n - 2})`} val={spResult.t.toFixed(3)} />
                <StatBox label="p" val={pFmt(spResult.p)} />
                <Badge p={spResult.p} />
              </div>
              <div style={{ padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.sub }}>
                <strong style={{ color: C.text }}>APA:</strong> r_s({spResult.n - 2}) = {spResult.rs.toFixed(2)}, p {spResult.p < 0.001 ? '< .001' : `= ${spResult.p.toFixed(3)}`}
                <div style={{ marginTop: 6, fontSize: 11, color: C.muted }}>{ar ? 'الاتجاه: ' : 'Direction: '}<strong style={{ color: spResult.rs > 0 ? C.green : C.red }}>{spResult.rs > 0 ? (ar ? 'موجب' : 'Positive') : (ar ? 'سالب' : 'Negative')}</strong> · {ar ? 'القوة: ' : 'Strength: '}<strong style={{ color: C.text }}>{Math.abs(spResult.rs) < 0.3 ? (ar ? 'ضعيف' : 'Weak') : Math.abs(spResult.rs) < 0.6 ? (ar ? 'متوسط' : 'Moderate') : (ar ? 'قوي' : 'Strong')}</strong></div>
              </div>
            </>
          ) : <p style={{ color: C.muted, fontSize: 13 }}>{ar ? 'أدخل ≥ 5 قيم في كل متغير' : 'Enter ≥ 5 values per variable'}</p>}
        </div>
      )}

      <p style={{ fontSize: 11, color: C.muted, marginTop: 14, marginBottom: 0 }}>
        {ar ? '* تستخدم هذه الاختبارات الرتب بدلاً من القيم الخام — تصلح عند رفض الاعتدالية أو للبيانات الترتيبية'
            : '* These tests use ranks instead of raw values — appropriate when normality is rejected or for ordinal data'}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑨  NORMALITY TEST (D'Agostino-Pearson K² + histogram + Q-Q)
// ════════════════════════════════════════════════════════════════════════════
function NormalityTest({ ar }: { ar: boolean }) {
  const DEMO = '23 45 34 56 67 45 34 23 56 67 45 78 56 34 45 67 56 45 34 56 67 45 56 34 45 38 71 55 42 60';
  const [raw, setRaw] = useState(DEMO);

  const vals = useMemo(() =>
    raw.split(/[\s,;،\n]+/).map(Number).filter(v => isFinite(v) && !isNaN(v)), [raw]);
  const n = vals.length;

  const stats = useMemo(() => {
    if (n < 8) return null;
    const m = avg(vals);
    const s2 = vals.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
    const sd = Math.sqrt(s2);
    if (sd === 0) return null;

    const skew = vals.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
    const kurt = vals.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n - 3;
    const zSkew = skew / Math.sqrt(6 / n);
    const zKurt = kurt / Math.sqrt(24 / n);
    const K2 = zSkew ** 2 + zKurt ** 2;
    const pVal = Math.exp(-K2 / 2);   // chi²(2) survival = e^(−K²/2)

    const mn = Math.min(...vals), mx = Math.max(...vals);
    const k = Math.max(5, Math.ceil(Math.log2(n)) + 1);
    const bw = (mx - mn) / k || 1;
    const bins = Array.from({ length: k }, (_, i) => {
      const lo = mn + i * bw, hi = lo + bw;
      const cnt = vals.filter(v => v >= lo && (i < k - 1 ? v < hi : v <= hi)).length;
      const mid = (lo + hi) / 2;
      return {
        label: lo.toFixed(1),
        density: parseFloat((cnt / (n * bw)).toFixed(5)),
        normal: parseFloat(((1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((mid - m) / sd) ** 2)).toFixed(5)),
      };
    });

    const sorted = [...vals].sort((a, b) => a - b);
    const qq = sorted.map((v, i) => {
      const z = zInv((i + 0.5) / n);
      return { z: parseFloat(z.toFixed(3)), v, ref: parseFloat((m + z * sd).toFixed(2)) };
    });

    return { m, sd, skew, kurt, zSkew, zKurt, K2, pVal, mn, mx, bins, qq };
  }, [vals, n]);

  const isNormal = !!(stats && stats.pVal >= 0.05);
  const isBorder = !!(stats && stats.pVal < 0.05 && stats.pVal >= 0.01);

  const TT = { contentStyle: { background: '#0d172d', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 } };

  return (
    <div>
      {/* Input */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 5 }}>
          {ar ? 'أدخل القيم (فاصلة أو مسافة أو سطر جديد):' : 'Enter values (comma / space / newline separated):'}
        </label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', direction: 'ltr' }} />
        <span style={{ fontSize: 11, color: C.muted }}>n = {n}</span>
      </div>

      {n < 8 && <p style={{ color: C.red, fontSize: 13 }}>{ar ? 'يلزم 8 قيم على الأقل (يُفضّل ≥ 20)' : 'At least 8 values required (≥ 20 recommended)'}</p>}

      {stats && (
        <>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8, marginBottom: 14 }}>
            {[
              { label: ar ? 'المتوسط' : 'Mean',           val: stats.m.toFixed(2),    color: C.text },
              { label: ar ? 'الانحراف المعياري' : 'SD',   val: stats.sd.toFixed(2),   color: C.text },
              { label: ar ? 'الالتواء (g₁)' : 'Skewness', val: stats.skew.toFixed(3), color: Math.abs(stats.skew) < 0.5 ? C.green : Math.abs(stats.skew) < 1 ? C.gold : C.red },
              { label: ar ? 'التفرطح (g₂)' : 'Ex. Kurtosis', val: stats.kurt.toFixed(3), color: Math.abs(stats.kurt) < 1 ? C.green : Math.abs(stats.kurt) < 2 ? C.gold : C.red },
              { label: "K² (D'Agostino)",                  val: stats.K2.toFixed(3),   color: C.blue },
              { label: 'p-value',                          val: stats.pVal < 0.001 ? '< .001' : stats.pVal.toFixed(3), color: stats.pVal >= 0.05 ? C.green : C.red },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.sub, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Decision badge */}
          <div style={{ marginBottom: 18, padding: '13px 18px', borderRadius: 12, background: isNormal ? 'rgba(74,222,128,0.07)' : isBorder ? 'rgba(201,168,76,0.07)' : 'rgba(239,68,68,0.07)', border: `1.5px solid ${isNormal ? C.green : isBorder ? C.gold : C.red}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: isNormal ? C.green : isBorder ? C.gold : C.red, marginBottom: isBorder || !isNormal ? 5 : 0 }}>
              {isNormal
                ? (ar ? '✓ لا يُرفض افتراض الاعتدالية — p ≥ .05' : '✓ Cannot reject normality — p ≥ .05')
                : isBorder
                  ? (ar ? '⚠️ نتيجة حدّية — .01 ≤ p < .05 (استخدم الرسوم البيانية لتأكيد)' : '⚠️ Borderline — .01 ≤ p < .05 (check plots)')
                  : (ar ? '✗ يُرفض افتراض الاعتدالية — p < .05' : '✗ Normality rejected — p < .05')}
            </div>
            {!isNormal && (
              <div style={{ fontSize: 12, color: C.sub }}>
                {ar ? '→ بدائل لابارامترية: Mann-Whitney U · Kruskal-Wallis · معامل سبيرمان'
                    : '→ Non-parametric alternatives: Mann-Whitney U · Kruskal-Wallis · Spearman ρ'}
              </div>
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 14 }}>
            {/* Histogram + Normal curve */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>
                {ar ? '📊 مدرج تكراري + منحنى الاعتدال' : '📊 Histogram + Normal Curve'}
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={stats.bins} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} />
                  <Tooltip {...TT} />
                  <Bar dataKey="density" name={ar ? 'الكثافة' : 'Density'} fill="rgba(74,158,235,0.5)" radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="normal" name={ar ? 'نظري' : 'Normal'} stroke={C.gold} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Q-Q Plot */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: C.gold, marginBottom: 10 }}>
                {ar ? '📈 مخطط Q-Q (الكميّات الطبيعية)' : '📈 Q-Q Plot (Normal Quantiles)'}
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={stats.qq} margin={{ top: 4, right: 8, bottom: 16, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="z" tick={{ fill: C.muted, fontSize: 9 }} label={{ value: ar ? 'الكميّة النظرية' : 'Theoretical Quantile', position: 'insideBottom', offset: -8, fill: C.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} />
                  <Tooltip {...TT} />
                  <Line type="linear" dataKey="v" name={ar ? 'البيانات' : 'Data'} stroke={C.blue} strokeWidth={0} dot={{ r: 3, fill: C.blue, opacity: 0.8 }} activeDot={{ r: 4 }} />
                  <Line type="linear" dataKey="ref" name={ar ? 'خط الاعتدال' : 'Normal line'} stroke={C.gold} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Skewness / Kurtosis detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {([
              { label: ar ? 'الالتواء' : 'Skewness g₁', val: stats.skew, z: stats.zSkew,
                desc: Math.abs(stats.skew) < 0.5 ? (ar ? 'متماثل' : 'Symmetric') : Math.abs(stats.skew) < 1 ? (ar ? 'التواء معتدل' : 'Moderate skew') : (ar ? 'التواء شديد' : 'High skew'),
                col: Math.abs(stats.skew) < 0.5 ? C.green : Math.abs(stats.skew) < 1 ? C.gold : C.red },
              { label: ar ? 'التفرطح الزائد' : 'Ex. Kurtosis g₂', val: stats.kurt, z: stats.zKurt,
                desc: Math.abs(stats.kurt) < 1 ? (ar ? 'اعتدالي' : 'Normal') : Math.abs(stats.kurt) < 2 ? (ar ? 'انحراف معتدل' : 'Moderate') : (ar ? 'انحراف شديد' : 'High deviation'),
                col: Math.abs(stats.kurt) < 1 ? C.green : Math.abs(stats.kurt) < 2 ? C.gold : C.red },
            ] as {label:string;val:number;z:number;desc:string;col:string}[]).map(({ label, val, z, desc, col }) => (
              <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{val.toFixed(3)}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>z = {z.toFixed(2)}</div>
                </div>
                <div style={{ background: `${col}18`, border: `1px solid ${col}50`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>{desc}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 0 }}>
            {ar ? '* اختبار D\'Agostino-Pearson K² (df=2) · يفقد دقّته لـ n < 20 · يُنصح بتفسير المدرج و Q-Q معاً'
                : "* D'Agostino-Pearson K² omnibus test (df=2) · Unreliable for n < 20 · Interpret alongside histogram and Q-Q plot"}
          </p>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑩  SAMPLE SIZE CALCULATOR
// ════════════════════════════════════════════════════════════════════════════
function zInv(p: number): number {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity; if (Math.abs(p - 0.5) < 1e-10) return 0;
  const sign = p > 0.5 ? 1 : -1, q = Math.min(p, 1 - p);
  const t = Math.sqrt(-2 * Math.log(q));
  const num = 2.515517 + 0.802853 * t + 0.010328 * t * t;
  const den = 1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t;
  return sign * (t - num / den);
}

type TestType = 'ttest' | 'corr' | 'chisq' | 'prop';
type APATest = 'desc' | 'ttest' | 'anova' | 'corr' | 'chisq' | 'reg';
function calcN(type: TestType, alpha: number, pw: number, twoTailed: boolean,
               d: number, rVal: number, w: number, p1: number, p2: number): number | null {
  const za = zInv(twoTailed ? 1 - alpha / 2 : 1 - alpha);
  const zb = zInv(pw);
  if (!isFinite(za) || !isFinite(zb)) return null;
  switch (type) {
    case 'ttest': if (d <= 0) return null; return Math.ceil(2 * ((za + zb) / d) ** 2);
    case 'corr': { const ar = Math.abs(rVal); if (ar <= 0 || ar >= 1) return null; const zr = 0.5 * Math.log((1 + ar) / (1 - ar)); return Math.ceil((za + zb) ** 2 / zr ** 2 + 3); }
    case 'chisq': if (w <= 0) return null; return Math.ceil((za + zb) ** 2 / w ** 2);
    case 'prop': { if (p1 === p2 || p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1) return null; const pb = (p1 + p2) / 2; const num = (za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2; return Math.ceil(num / (p1 - p2) ** 2); }
  }
}

function SampleSizeCalc({ ar }: { ar: boolean }) {
  const [type, setType] = useState<TestType>('ttest');
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);
  const [twoTailed, setTwoTailed] = useState(true);
  const [d, setD] = useState(0.5);
  const [rVal, setRVal] = useState(0.3);
  const [w, setW] = useState(0.3);
  const [p1, setP1] = useState(0.5);
  const [p2, setP2] = useState(0.35);

  const n = calcN(type, alpha, power, twoTailed, d, rVal, w, p1, p2);
  const powerRows = [0.70, 0.80, 0.90, 0.95].map(pw => ({ pw, n: calcN(type, alpha, pw, twoTailed, d, rVal, w, p1, p2) }));
  const isGroup = type === 'ttest' || type === 'prop';

  const NumInput = ({ label, value, onChange, min = 0.01, max = 99, step = 0.05 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 11, color: C.sub }}>{label}</label>
      <input type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: 90, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 13, fontFamily: 'inherit' }} />
    </div>
  );

  const TYPES = [
    { key: 'ttest' as TestType, label: ar ? 'اختبار t (مجموعتان)' : 'Two-sample t-test' },
    { key: 'corr' as TestType,  label: ar ? 'معامل الارتباط r' : 'Pearson Correlation' },
    { key: 'chisq' as TestType, label: ar ? 'اختبار كاي مربع' : 'Chi-Square Test' },
    { key: 'prop' as TestType,  label: ar ? 'مقارنة نسبتَين' : 'Two Proportions' },
  ];

  const BENCHMARKS: Record<TestType, { s: string; m: string; l: string }> = {
    ttest: { s: 'd=0.2', m: 'd=0.5', l: 'd=0.8' },
    corr:  { s: 'r=0.1', m: 'r=0.3', l: 'r=0.5' },
    chisq: { s: 'w=0.1', m: 'w=0.3', l: 'w=0.5' },
    prop:  { s: '5%', m: '10–15%', l: '>20%' },
  };

  return (
    <div>
      {/* Test type */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TYPES.map(tp => (
          <button key={tp.key} onClick={() => setType(tp.key)} style={{ background: type === tp.key ? 'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(245,215,142,0.08))' : 'rgba(255,255,255,0.03)', border: `1px solid ${type === tp.key ? 'rgba(201,168,76,0.5)' : C.border}`, color: type === tp.key ? C.gold : C.sub, borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {tp.label}
          </button>
        ))}
      </div>

      {/* Parameters */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20, padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <NumInput label={ar ? 'مستوى α' : 'Alpha (α)'} value={alpha} onChange={setAlpha} min={0.001} max={0.2} step={0.005} />
        <NumInput label={ar ? 'القدرة (1-β)' : 'Power (1−β)'} value={power} onChange={setPower} min={0.5} max={0.999} step={0.05} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 11, color: C.sub }}>{ar ? 'الاتجاه' : 'Tails'}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[[true, ar ? 'ثنائي' : '2-tailed'], [false, ar ? 'أحادي' : '1-tailed']].map(([v, lbl]) => (
              <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: twoTailed === v ? C.gold : C.text }}>
                <input type="radio" checked={twoTailed === v} onChange={() => setTwoTailed(v as boolean)} />{lbl as string}
              </label>
            ))}
          </div>
        </div>
        {type === 'ttest' && <NumInput label={ar ? 'حجم الأثر d' : "Cohen's d"} value={d} onChange={setD} min={0.01} max={3} step={0.1} />}
        {type === 'corr'  && <NumInput label={ar ? 'معامل r' : 'Correlation r'} value={rVal} onChange={setRVal} min={0.01} max={0.99} step={0.05} />}
        {type === 'chisq' && <NumInput label={ar ? 'حجم الأثر w' : "Cohen's w"} value={w} onChange={setW} min={0.01} max={2} step={0.05} />}
        {type === 'prop'  && <>
          <NumInput label={ar ? 'النسبة p₁' : 'Proportion p₁'} value={p1} onChange={setP1} min={0.01} max={0.99} step={0.05} />
          <NumInput label={ar ? 'النسبة p₂' : 'Proportion p₂'} value={p2} onChange={setP2} min={0.01} max={0.99} step={0.05} />
        </>}
      </div>

      {/* Main result */}
      {n !== null ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(201,168,76,0.15),rgba(245,215,142,0.05))', border: `2px solid rgba(201,168,76,0.45)`, borderRadius: 16, padding: '16px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? 'الحجم المطلوب' : 'Required n'} {isGroup ? (ar ? 'لكل مجموعة' : 'per group') : ''}</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{n}</div>
            {isGroup && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{ar ? 'الإجمالي' : 'Total'}: <strong style={{ color: C.text }}>{n * 2}</strong></div>}
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: C.sub, lineHeight: 1.8 }}>
            <div>α = <strong style={{ color: C.text }}>{alpha}</strong> · {ar ? 'قدرة' : 'Power'} = <strong style={{ color: C.text }}>{Math.round(power * 100)}%</strong> · {twoTailed ? (ar ? 'ثنائي الاتجاه' : '2-tailed') : (ar ? 'أحادي الاتجاه' : '1-tailed')}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{ar ? '* يُنصح بإضافة 10–15% تعويضاً عن الفاقد المتوقع' : '* Add 10–15% buffer for expected attrition'}</div>
          </div>
        </div>
      ) : <p style={{ color: C.red, fontSize: 13, margin: '0 0 16px' }}>{ar ? 'تحقق من المدخلات (لا تكون متطرفة)' : 'Check inputs (avoid extreme values)'}</p>}

      {/* Power table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'جدول القدرة الإحصائية' : 'Power Table'}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '8px 14px', textAlign: ar ? 'right' : 'left', color: C.sub, fontWeight: 600 }}>{ar ? 'القدرة' : 'Power'}</th>
                <th style={{ padding: '8px 14px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{ar ? 'n' + (isGroup ? ' (لكل مجموعة)' : '') : 'n' + (isGroup ? ' per group' : '')}</th>
                {isGroup && <th style={{ padding: '8px 14px', textAlign: 'center', color: C.sub, fontWeight: 600 }}>{ar ? 'الإجمالي' : 'Total n'}</th>}
              </tr>
            </thead>
            <tbody>
              {powerRows.map(({ pw, n: ni }) => (
                <tr key={pw} style={{ background: Math.abs(pw - power) < 0.001 ? 'rgba(201,168,76,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 14px', fontWeight: Math.abs(pw - power) < 0.001 ? 800 : 400, color: Math.abs(pw - power) < 0.001 ? C.gold : C.text }}>{Math.round(pw * 100)}%</td>
                  <td style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 700, color: C.blue }}>{ni ?? '—'}</td>
                  {isGroup && <td style={{ padding: '8px 14px', textAlign: 'center', color: C.sub }}>{ni != null ? ni * 2 : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Benchmark */}
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.07)', fontWeight: 700, fontSize: 13, color: C.gold }}>{ar ? 'مرجع حجم الأثر (Cohen)' : 'Effect Size Reference (Cohen)'}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {([[ar ? 'صغير' : 'Small', BENCHMARKS[type].s, C.blue], [ar ? 'متوسط' : 'Medium', BENCHMARKS[type].m, C.teal], [ar ? 'كبير' : 'Large', BENCHMARKS[type].l, C.green]] as [string,string,string][]).map(([lbl, val, col]) => (
                <tr key={lbl} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '9px 14px', color: col, fontWeight: 700 }}>{lbl}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: C.text }}>{val}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ padding: '8px 14px', fontSize: 11, color: C.muted }}>
                  {ar ? '· ينصح كوهين بـ Power=0.80 وα=0.05 كحد أدنى للأبحاث الاجتماعية'
                      : '· Cohen recommends Power=0.80 & α=0.05 as minimum for social science research'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ⑩  APA RESULTS FORMATTER
// ════════════════════════════════════════════════════════════════════════════
function APAFormatter({ ar }: { ar: boolean }) {
  const [test, setTest] = useState<APATest>('ttest');
  const [copied, setCopied] = useState<'en' | 'ar' | null>(null);
  const [pv, setPv] = useState('0.023'); const [nv, setNv] = useState('60');
  const [tv, setTv] = useState('2.45'); const [dfv, setDfv] = useState('58'); const [dv, setDv] = useState('0.63'); const [ci1, setCi1] = useState('2.10'); const [ci2, setCi2] = useState('15.40');
  const [Fv, setFv] = useState('4.82'); const [df1, setDf1] = useState('2'); const [df2, setDf2] = useState('87'); const [eta2, setEta2] = useState('0.10');
  const [rv, setRv] = useState('0.42');
  const [chi2, setChi2] = useState('8.76'); const [chiDf, setChiDf] = useState('2'); const [vv, setVv] = useState('0.27');
  const [M, setM] = useState('72.5'); const [SD, setSD] = useState('11.3');
  const [R2, setR2] = useState('0.34'); const [bv, setBv] = useState('0.52'); const [bSE, setBSE] = useState('0.12'); const [btv, setBtv] = useState('4.33'); const [bdf, setBdf] = useState('57');

  const f2 = (x: string) => { const n = parseFloat(x); return isNaN(n) ? '?' : Math.abs(n).toFixed(2).replace(/^0\./, '.'); };
  const fP = (x: string) => { const n = parseFloat(x); if (isNaN(n)) return 'p = ?'; return n < 0.001 ? 'p < .001' : `p = ${n.toFixed(3).replace('0.', '.')}`; };
  const sig = (x: string, ar2: boolean) => { const n = parseFloat(x); if (isNaN(n)) return ''; if (n < 0.001) return ar2 ? 'دال إحصائياً (p < .001)' : 'statistically significant (p < .001)'; if (n < 0.05) return ar2 ? `دال إحصائياً (${fP(x)})` : `statistically significant (${fP(x)})`; return ar2 ? 'غير دال إحصائياً (p > .05)' : 'not statistically significant (p > .05)'; };

  const enResult = (() => {
    switch (test) {
      case 'desc':  return `M = ${f2(M)}, SD = ${f2(SD)}, n = ${nv}`;
      case 'ttest': return `t(${dfv}) = ${f2(tv)}, ${fP(pv)}, d = ${f2(dv)}, 95% CI [${f2(ci1)}, ${f2(ci2)}]`;
      case 'anova': return `F(${df1}, ${df2}) = ${f2(Fv)}, ${fP(pv)}, η² = ${f2(eta2)}`;
      case 'corr':  return `r(${Math.max(0, parseInt(nv) - 2)}) = ${f2(rv)}, ${fP(pv)}`;
      case 'chisq': return `χ²(${chiDf}, N = ${nv}) = ${f2(chi2)}, ${fP(pv)}, V = ${f2(vv)}`;
      case 'reg':   return `R² = ${f2(R2)}, F(${df1}, ${df2}) = ${f2(Fv)}, ${fP(pv)}\nβ = ${f2(bv)}, SE = ${f2(bSE)}, t(${bdf}) = ${f2(btv)}, ${fP(pv)}`;
    }
  })();

  const arResult = (() => {
    switch (test) {
      case 'desc':  return `المتوسط = ${f2(M)}، الانحراف المعياري = ${f2(SD)}، الحجم (ن) = ${nv}`;
      case 'ttest': return `t(${dfv}) = ${f2(tv)}، ${fP(pv)}، d = ${f2(dv)}، فترة الثقة 95% [${f2(ci1)}، ${f2(ci2)}]\nالنتيجة: ${sig(pv, true)}`;
      case 'anova': return `F(${df1}، ${df2}) = ${f2(Fv)}، ${fP(pv)}، η² = ${f2(eta2)}\nالنتيجة: ${sig(pv, true)}`;
      case 'corr':  return `r(${Math.max(0, parseInt(nv) - 2)}) = ${f2(rv)}، ${fP(pv)}\nالنتيجة: ${sig(pv, true)}`;
      case 'chisq': return `χ²(${chiDf}، ن = ${nv}) = ${f2(chi2)}، ${fP(pv)}، V = ${f2(vv)}\nالنتيجة: ${sig(pv, true)}`;
      case 'reg':   return `R² = ${f2(R2)}، F(${df1}، ${df2}) = ${f2(Fv)}، ${fP(pv)}\nβ = ${f2(bv)}، خطأ معياري = ${f2(bSE)}، t(${bdf}) = ${f2(btv)}، ${fP(pv)}\nالنتيجة: ${sig(pv, true)}`;
    }
  })();

  const copyText = (text: string, which: 'en' | 'ar') => {
    navigator.clipboard.writeText(text).then(() => { setCopied(which); setTimeout(() => setCopied(null), 2000); });
  };

  const FI = ({ label, value, onChange, w = 80 }: { label: string; value: string; onChange: (v: string) => void; w?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: C.sub }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ width: w, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', color: C.text, fontSize: 12, fontFamily: 'inherit' }} />
    </div>
  );

  const TESTS: { key: APATest; label: string }[] = [
    { key: 'desc',  label: ar ? 'وصفي' : 'Descriptive' },
    { key: 'ttest', label: ar ? 'اختبار t' : 't-test' },
    { key: 'anova', label: 'ANOVA' },
    { key: 'corr',  label: ar ? 'ارتباط r' : 'Correlation' },
    { key: 'chisq', label: 'χ²' },
    { key: 'reg',   label: ar ? 'انحدار' : 'Regression' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TESTS.map(tp => (
          <button key={tp.key} onClick={() => setTest(tp.key)} style={{ background: test === tp.key ? 'linear-gradient(135deg,rgba(201,168,76,0.2),rgba(245,215,142,0.08))' : 'rgba(255,255,255,0.03)', border: `1px solid ${test === tp.key ? 'rgba(201,168,76,0.5)' : C.border}`, color: test === tp.key ? C.gold : C.sub, borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>
            {tp.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, alignItems: 'flex-end' }}>
        {(test !== 'desc') && <FI label="p-value" value={pv} onChange={setPv} />}
        {(test === 'desc' || test === 'corr' || test === 'chisq') && <FI label="n" value={nv} onChange={setNv} w={70} />}
        {test === 'desc'  && <><FI label="M" value={M} onChange={setM} /><FI label="SD" value={SD} onChange={setSD} /></>}
        {test === 'ttest' && <><FI label="t" value={tv} onChange={setTv} /><FI label="df" value={dfv} onChange={setDfv} w={65} /><FI label="d" value={dv} onChange={setDv} /><FI label="CI lower" value={ci1} onChange={setCi1} /><FI label="CI upper" value={ci2} onChange={setCi2} /></>}
        {test === 'anova' && <><FI label="F" value={Fv} onChange={setFv} /><FI label="df₁" value={df1} onChange={setDf1} w={60} /><FI label="df₂" value={df2} onChange={setDf2} w={60} /><FI label="η²" value={eta2} onChange={setEta2} /></>}
        {test === 'corr'  && <FI label="r" value={rv} onChange={setRv} />}
        {test === 'chisq' && <><FI label="χ²" value={chi2} onChange={setChi2} /><FI label="df" value={chiDf} onChange={setChiDf} w={60} /><FI label="V" value={vv} onChange={setVv} /></>}
        {test === 'reg'   && <><FI label="R²" value={R2} onChange={setR2} /><FI label="F" value={Fv} onChange={setFv} /><FI label="df₁" value={df1} onChange={setDf1} w={60} /><FI label="df₂" value={df2} onChange={setDf2} w={60} /><FI label="β" value={bv} onChange={setBv} /><FI label="SE(β)" value={bSE} onChange={setBSE} /><FI label="t(β)" value={btv} onChange={setBtv} /><FI label="df_t" value={bdf} onChange={setBdf} w={60} /></>}
      </div>

      {([{ lang: 'APA (English)', text: enResult, color: C.blue, which: 'en' as const }, { lang: ar ? 'ترجمة عربية' : 'Arabic Translation', text: arResult, color: C.gold, which: 'ar' as const }]).map(({ lang, text, color, which }) => (
        <div key={lang} style={{ marginBottom: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: `${color}08`, borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 13, color }}>{lang}</span>
            <button onClick={() => copyText(text, which)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 14px', color: copied === which ? C.green : C.sub, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .2s' }}>
              {copied === which ? (ar ? '✓ تم النسخ' : '✓ Copied') : (ar ? 'نسخ' : 'Copy')}
            </button>
          </div>
          <div style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 13.5, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.9, direction: which === 'ar' ? 'rtl' : 'ltr', textAlign: which === 'ar' ? 'right' : 'left' }}>
            {text}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
        {ar ? '* الصيغة وفق APA 7th Edition · منزلتان عشريتان (p-value: ثلاث) · بدون صفر قبل النقطة لـ r و p و η² و β'
            : '* Format follows APA 7th Edition · 2 decimal places (p-values: 3) · leading zero omitted for r, p, η², β'}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── DATAHUB MAIN ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
const SUBTABS_AR = [
  { key: 'explorer',   icon: '📁', label: 'مستكشف البيانات',     short: 'استكشاف' },
  { key: 'desctable',  icon: '📋', label: 'جدول وصفي شامل',       short: 'جدول 1' },
  { key: 'freq',       icon: '📋', label: 'جدول تكراري',          short: 'تكراري' },
  { key: 'likert',     icon: '⚖️', label: 'مقياس ليكرت',          short: 'ليكرت' },
  { key: 'timeseries', icon: '📈', label: 'سلاسل زمنية',          short: 'زمني' },
  { key: 'effectsize', icon: '📏', label: 'محوّل حجم الأثر',       short: 'حجم الأثر' },
  { key: 'outlier',   icon: '🚨', label: 'كشف القيم الشاذة',      short: 'شاذة' },
  { key: 'corr',       icon: '🔗', label: 'مصفوفة الارتباط',      short: 'ارتباط' },
  { key: 'crosstab',   icon: '⊞',  label: 'جدول التقاطع',         short: 'تقاطع' },
  { key: 'regression', icon: '📉', label: 'تحليل الانحدار',        short: 'انحدار' },
  { key: 'regdiag',   icon: '🔬', label: 'تشخيصات الانحدار (VIF)', short: 'VIF' },
  { key: 'mediation',  icon: '🔀', label: 'تحليل الوساطة',         short: 'وساطة' },
  { key: 'moderation', icon: '⚙️', label: 'تحليل الاعتدال',        short: 'اعتدال' },
  { key: 'groups',     icon: '👥', label: 'مقارنة المجموعات',      short: 'مجموعات' },
  { key: 'posthoc',   icon: '🔍', label: 'مقارنات بعدية (ANOVA)',  short: 'بعدية' },
  { key: 'ttests',    icon: '📐', label: 'اختبارات t (ثلاثة أنواع)',short: 't-test' },
  { key: 'cronbach',    icon: 'α',  label: 'ثبات كرونباخ',           short: 'كرونباخ' },
  { key: 'itemanalysis',icon: '📊', label: 'تحليل الفقرات',           short: 'فقرات' },
  { key: 'efa',         icon: '🧩', label: 'التحليل العاملي (EFA)',   short: 'عاملي' },
  { key: 'normality',   icon: '📐', label: 'اختبار الاعتدالية',      short: 'اعتدالية' },
  { key: 'nonparam',    icon: '🔬', label: 'اختبارات لابارامترية',   short: 'لابارام' },
  { key: 'chigof',      icon: 'χ²', label: 'حسن المطابقة (χ²)',       short: 'χ² GoF' },
  { key: 'anovasum',    icon: '📊', label: 'ANOVA من الملخصات',        short: 'ANOVA-S' },
  { key: 'ci',          icon: '📏', label: 'فترات الثقة (CI)',         short: 'CI' },
  { key: 'icc',         icon: '🤝', label: 'اتفاق المحكّمين (ICC)',    short: 'ICC' },
  { key: 'kappa',       icon: 'κ',  label: 'كاپا Cohen — الفئات',      short: 'κ' },
  { key: 'hierreg',     icon: '📈', label: 'انحدار تسلسلي (ΔR²)',      short: 'ΔR²' },
  { key: 'partialcorr', icon: '🔗', label: 'ارتباط جزئي (Matrix)',     short: 'جزئي' },
  { key: 'twoprop',     icon: '⚖️', label: 'z-test نسبتَين',           short: 'z نسبة' },
  { key: 'logreg',      icon: '🔢', label: 'انحدار لوجستي',            short: 'لوجستي' },
  { key: 'omega',       icon: 'ω',  label: "Omega McDonald's ω",       short: 'ω' },
  { key: 'rmmanova',    icon: '🔁', label: 'مقاييس متكررة (RM ANOVA)', short: 'RM' },
  { key: 'fisher',      icon: '🐟', label: "Fisher's Exact Test",      short: 'Fisher' },
  { key: 'binomtest',   icon: '🎲', label: 'اختبار ثنائي الحد',       short: 'Binom' },
  { key: 'ancova',      icon: '🎛️', label: 'تحليل التغاير (ANCOVA)',  short: 'ANCOVA' },
  { key: 'diagacc',     icon: '🩺', label: 'دقة التشخيص',            short: 'Diagn.' },
  { key: 'twoway',      icon: '⊞',  label: 'ANOVA ثنائي الاتجاه',    short: '2-Way' },
  { key: 'blandaltman', icon: '📐', label: 'Bland-Altman (LoA)',      short: 'B-A' },
  { key: 'polyreg',     icon: '〰️', label: 'انحدار متعدد الحدود',    short: 'Poly' },
  { key: 'roc',         icon: '📈', label: 'منحنى ROC / AUC',        short: 'ROC' },
  { key: 'samplesize',  icon: '🎯', label: 'حجم العيّنة',            short: 'عيّنة' },
  { key: 'apa',         icon: '📝', label: 'منسّق APA',              short: 'APA' },
  { key: 'stats',       icon: '📊', label: 'اختبارات إحصائية',     short: 'إحصاء' },
  { key: 'equations',   icon: '🔢', label: 'المعادلات',             short: 'معادلات' },
];
const SUBTABS_EN = [
  { key: 'explorer',    icon: '📁', label: 'Data Explorer',       short: 'Explore' },
  { key: 'desctable',   icon: '📋', label: 'Descriptive Table',    short: 'Table 1' },
  { key: 'freq',        icon: '📋', label: 'Frequency Table',     short: 'Freq' },
  { key: 'likert',      icon: '⚖️', label: 'Likert Scale',        short: 'Likert' },
  { key: 'timeseries',  icon: '📈', label: 'Time Series',         short: 'Time' },
  { key: 'effectsize',  icon: '📏', label: 'Effect Size Converter', short: 'Effect' },
  { key: 'outlier',     icon: '🚨', label: 'Outlier Detection',    short: 'Outliers' },
  { key: 'corr',        icon: '🔗', label: 'Correlation Matrix',  short: 'Corr' },
  { key: 'crosstab',    icon: '⊞',  label: 'Cross-Tabulation',   short: 'CrossTab' },
  { key: 'regression',  icon: '📉', label: 'Linear Regression',   short: 'Regress' },
  { key: 'regdiag',    icon: '🔬', label: 'Regression Diagnostics (VIF)', short: 'VIF' },
  { key: 'mediation',   icon: '🔀', label: 'Mediation Analysis',  short: 'Mediate' },
  { key: 'moderation',  icon: '⚙️', label: 'Moderation Analysis', short: 'Moderate' },
  { key: 'groups',      icon: '👥', label: 'Group Comparison',    short: 'Groups' },
  { key: 'posthoc',     icon: '🔍', label: 'Post-Hoc Tests',       short: 'Post-Hoc' },
  { key: 'ttests',      icon: '📐', label: 't-Tests (3 types)',     short: 't-tests' },
  { key: 'cronbach',    icon: 'α',  label: "Cronbach's Alpha",    short: 'Cronbach' },
  { key: 'itemanalysis',icon: '📊', label: 'Item Analysis',         short: 'Items' },
  { key: 'efa',         icon: '🧩', label: 'Factor Analysis (EFA)', short: 'EFA' },
  { key: 'normality',   icon: '📐', label: 'Normality Test',      short: 'Normal' },
  { key: 'nonparam',    icon: '🔬', label: 'Non-Parametric',      short: 'NonPar' },
  { key: 'chigof',      icon: 'χ²', label: 'Chi-Square GoF',      short: 'χ² GoF' },
  { key: 'anovasum',    icon: '📊', label: 'ANOVA from Summary',   short: 'ANOVA-S' },
  { key: 'ci',          icon: '📏', label: 'Confidence Intervals', short: 'CI' },
  { key: 'icc',         icon: '🤝', label: 'ICC (Rater Agreement)', short: 'ICC' },
  { key: 'kappa',       icon: 'κ',  label: "Cohen's Kappa",        short: 'κ' },
  { key: 'hierreg',     icon: '📈', label: 'Hierarchical Reg. (ΔR²)', short: 'ΔR²' },
  { key: 'partialcorr', icon: '🔗', label: 'Partial Correlation',  short: 'Partial r' },
  { key: 'twoprop',     icon: '⚖️', label: 'Two-Proportion z-test', short: '2-prop z' },
  { key: 'logreg',      icon: '🔢', label: 'Logistic Regression',  short: 'Logistic' },
  { key: 'omega',       icon: 'ω',  label: "McDonald's Omega (ω)", short: 'ω' },
  { key: 'rmmanova',    icon: '🔁', label: 'Repeated Measures ANOVA', short: 'RM-ANOVA' },
  { key: 'fisher',      icon: '🐟', label: "Fisher's Exact Test", short: 'Fisher' },
  { key: 'binomtest',   icon: '🎲', label: 'Binomial Test',       short: 'Binom' },
  { key: 'ancova',      icon: '🎛️', label: 'ANCOVA',              short: 'ANCOVA' },
  { key: 'diagacc',     icon: '🩺', label: 'Diagnostic Accuracy', short: 'Diagn.' },
  { key: 'twoway',      icon: '⊞',  label: 'Two-Way ANOVA',       short: '2-Way' },
  { key: 'blandaltman', icon: '📐', label: 'Bland-Altman (LoA)',  short: 'B-A' },
  { key: 'polyreg',     icon: '〰️', label: 'Polynomial Regression', short: 'Poly' },
  { key: 'roc',         icon: '📈', label: 'ROC Curve / AUC',     short: 'ROC' },
  { key: 'samplesize',  icon: '🎯', label: 'Sample Size',         short: 'n Calc' },
  { key: 'apa',         icon: '📝', label: 'APA Formatter',       short: 'APA' },
  { key: 'stats',       icon: '📊', label: 'Statistical Tests',   short: 'Stats' },
  { key: 'equations',   icon: '🔢', label: 'Equations',           short: 'Eq' },
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
        {sub === 'desctable' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 {ar ? 'الجدول الوصفي الشامل (Table 1)' : 'Descriptive Statistics Table (Table 1)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'n · M · SD · SE · الوسيط · Min–Max · الالتواء · التفرطح · رسم M±SD · نسخ TSV للـ Word أو Excel مباشرةً'
                  : 'n · M · SD · SE · Median · Min–Max · Skewness · Kurtosis · M±SD chart · Copy as TSV for Word or Excel'}
            </p>
            <DescTable ar={ar} />
          </>
        )}
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
        {sub === 'corr'       && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔗 {ar ? 'مصفوفة الارتباط (Pearson)' : 'Correlation Matrix (Pearson)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'الكشف عن العلاقات الخطية بين المتغيرات الكمية — انقر على أي زوج لعرض مخطط الانتشار'
                  : 'Detect linear relationships between quantitative variables — click any pair to view scatter plot'}
            </p>
            <CorrelationMatrix ar={ar} />
          </>
        )}
        {sub === 'crosstab'   && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⊞ {ar ? 'جدول التقاطع واختبار كاي مربع' : 'Cross-Tabulation & Chi-Square Test'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'تحليل العلاقة بين متغيرَين فئويَّين · يحسب χ² و p-value و Cramér\'s V تلقائياً'
                  : 'Analyze association between 2 categorical variables · auto-computes χ², p-value & Cramér\'s V'}
            </p>
            <CrossTab ar={ar} />
          </>
        )}
        {sub === 'groups' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              👥 {ar ? 'مقارنة المجموعات — اختبار t ويلش وتحليل ANOVA' : 'Group Comparison — Welch t-Test & One-Way ANOVA'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'مجموعتان → اختبار t ويلش + Cohen\'s d · 3 مجموعات أو أكثر → ANOVA + η² + مقارنات زوجية'
                  : '2 groups → Welch t-test + Cohen\'s d · 3+ groups → ANOVA + η² + pairwise LSD'}
            </p>
            <GroupComparison ar={ar} />
          </>
        )}
        {sub === 'outlier' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🚨 {ar ? 'كشف القيم الشاذة (Outlier Detection)' : 'Outlier Detection'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'طريقتان: IQR (القيم خارج السياج × 1.5) و Z-score (|z| > عتبة) · مخطط صندوق · جدول تفصيلي ملوَّن · توزيع تكراري'
                  : 'Two methods: IQR (values beyond 1.5×fence) and Z-score (|z| > threshold) · Box plot · Color-coded detail table · Histogram'}
            </p>
            <OutlierDetection ar={ar} />
          </>
        )}
        {sub === 'effectsize' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📏 {ar ? 'محوّل حجم الأثر' : 'Effect Size Converter'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? "أدخل أي مقياس لحجم الأثر واحصل على تحويل فوري لجميع المقاييس الأخرى · d · r · f · η² · OR · Fisher's z · Hedge's g"
                  : "Enter any effect size metric and get instant conversions · d · r · f · η² · OR · Fisher's z · Hedge's g"}
            </p>
            <EffectSizeConverter ar={ar} />
          </>
        )}
        {sub === 'moderation' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚙️ {ar ? 'تحليل الاعتدال — Moderation Analysis' : 'Moderation Analysis (Interaction Effect)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يختبر هل يُغيّر W قوة/اتجاه علاقة X بـY · مخطط التفاعل · بسائط المنحدر عند W ± 1 انحراف · تتمركز X وW تلقائياً'
                  : 'Tests whether W moderates the X→Y relationship · Interaction plot · Simple slopes at W ± 1 SD · X and W auto-centered'}
            </p>
            <ModerationAnalysis ar={ar} />
          </>
        )}
        {sub === 'mediation' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔀 {ar ? 'تحليل الوساطة — Baron & Kenny + اختبار Sobel' : 'Mediation Analysis — Baron & Kenny + Sobel Test'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يحدّد هل يتوسّط M في العلاقة بين X وY · الأثر المباشر وغير المباشر · نوع الوساطة (كاملة / جزئية)'
                  : 'Tests whether M mediates the X→Y relationship · Direct & indirect effects · Full vs. partial mediation'}
            </p>
            <MediationAnalysis ar={ar} />
          </>
        )}
        {sub === 'ttests' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📐 {ar ? 'اختبارات t — ثلاثة أنواع' : 't-Tests — Three Types'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'أحادي العينة (مقارنة بـ μ₀) · مزدوج قبل/بعد (فروق مرتبطة) · مستقل Welch (تباينات مختلفة) + اختبار Levene + Cohen\'s d + 95% CI'
                  : 'One-sample (vs. μ₀) · Paired pre/post · Independent Welch (unequal var.) + Levene test + Cohen\'s d + 95% CI'}
            </p>
            <TTests ar={ar} />
          </>
        )}
        {sub === 'posthoc' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔍 {ar ? 'المقارنات البعدية — Bonferroni & Holm' : 'Post-Hoc Tests — Bonferroni & Holm'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'مقارنات زوجية بعد ANOVA الدال · تصحيح Bonferroni وHolm لضبط الخطأ من النوع الأول · حجم الأثر d لكوهن · مصفوفة الدلالة الملوّنة'
                  : 'Pairwise comparisons after significant ANOVA · Bonferroni & Holm corrections for Type I error · Cohen\'s d effect size · Color-coded significance matrix'}
            </p>
            <PostHoc ar={ar} />
          </>
        )}
        {sub === 'itemanalysis' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 {ar ? 'تحليل الفقرات (Item Analysis)' : 'Item Analysis'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'الارتباط المصحَّح بالدرجة الكلية CITC · Alpha إذا حُذفت الفقرة · مؤشر الصعوبة P · مؤشر التمييز D · تقييم جودة كل فقرة'
                  : 'Corrected Item-Total Correlation · Alpha if deleted · Difficulty index P · Discrimination index D · per-item quality rating'}
            </p>
            <ItemAnalysis ar={ar} />
          </>
        )}
        {sub === 'efa' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🧩 {ar ? 'التحليل العاملي الاستكشافي (EFA)' : 'Exploratory Factor Analysis (EFA)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يكشف البنية الكامنة للمقياس · مخطط Scree · اختبار KMO وBartlett · جدول التشبعات مُلوَّن · القيم الذاتية والتباين المفسَّر'
                  : 'Reveals latent structure · Scree plot · KMO & Bartlett test · Color-coded loading matrix · Eigenvalues & % variance explained'}
            </p>
            <FactorAnalysis ar={ar} />
          </>
        )}
        {sub === 'ci' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📏 {ar ? 'حاسبة فترات الثقة (Confidence Intervals)' : 'Confidence Interval Calculator'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'CI للمتوسط · CI للنسبة (Wilson) · CI لفرق المتوسطين (Welch SE) · CI لـ Pearson r (تحويل Fisher z) · مرئي كشريط'
                  : 'CI for mean · CI for proportion (Wilson) · CI for diff. of means (Welch SE) · CI for Pearson r (Fisher z) · visual strip'}
            </p>
            <CICalc ar={ar} />
          </>
        )}
        {sub === 'icc' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤝 {ar ? 'معامل الارتباط الداخلي ICC — اتفاق المحكّمين والثبات' : 'Intraclass Correlation Coefficient (ICC)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'ICC(1,1) · ICC(2,1) · ICC(3,1) · جدول Two-Way ANOVA · رسم ملفات المحكّمين · معيار Koo & Mae (2016) · يدعم بيانات CSV/Tab'
                  : 'ICC(1,1) · ICC(2,1) · ICC(3,1) · Two-Way ANOVA table · rater profile chart · Koo & Mae (2016) thresholds · CSV/tab data'}
            </p>
            <IccCalc ar={ar} />
          </>
        )}
        {sub === 'logreg' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔢 {ar ? 'الانحدار اللوجستي (ثنائي المتغير التابع)' : 'Logistic Regression (Binary Outcome)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'IRLS convergence · β / SE / z / p · Odds Ratio مع CI 95% · McFadden R² · Nagelkerke R² · AIC · AUC · دقة التصنيف · رسم OR'
                  : 'IRLS convergence · β / SE / z / p · Odds Ratio with 95% CI · McFadden R² · Nagelkerke R² · AIC · AUC · classification accuracy · OR chart'}
            </p>
            <LogisticReg ar={ar} />
          </>
        )}
        {sub === 'omega' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ω {ar ? "موثوقية McDonald's Omega — بديل أدق لـ Cronbach's α" : "McDonald's Omega (ω) Reliability"}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'ω_t من نموذج عامل واحد · مقارنة مع α · تشبعات العامل الأول وتفرّدات الفقرات · بيانات خام (فقرات × مستجيبين) · رسم التشبعات'
                  : 'ω_t from one-factor model · compare with α · first-factor loadings & uniqueness · raw item data (items × respondents) · loading chart'}
            </p>
            <OmegaRel ar={ar} />
          </>
        )}
        {sub === 'rmmanova' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔁 {ar ? 'تحليل التباين للمقاييس المتكررة (One-Way RM ANOVA)' : 'One-Way Repeated Measures ANOVA'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'SS بين المشاركين / الشروط / الخطأ · F و η² و Partial η² · اختبار كروية Greenhouse-Geisser (ε) · مقارنات زوجية Bonferroni · رسم المتوسطات'
                  : 'SS partition (subjects/condition/error) · F, η², partial η² · Greenhouse-Geisser sphericity correction (ε) · Bonferroni post-hoc pairwise · means chart'}
            </p>
            <RMAnova ar={ar} />
          </>
        )}
        {sub === 'fisher' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🐟 {ar ? "اختبار Fisher الدقيق (جدول 2×2)" : "Fisher's Exact Test (2×2 table)"}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'توزيع hypergeometric دقيق · p (طرفان / أصغر / أكبر) · Odds Ratio مع CI 95% (Woolf) · مثالي للعيّنات الصغيرة (توقع خلية < 5)'
                  : 'Exact hypergeometric distribution · two-sided / one-sided p · Odds Ratio + 95% CI (Woolf) · ideal for small samples (expected cell < 5)'}
            </p>
            <FisherExact ar={ar} />
          </>
        )}
        {sub === 'binomtest' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎲 {ar ? 'اختبار ثنائي الحد الدقيق' : 'Exact Binomial Test'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'اختبار دقيق: هل النسبة المُلاحَظة تختلف عن p₀؟ · p من التوزيع ثنائي الحد · CI Wilson · Cohen\'s h · رسم توزيع الاحتمالات'
                  : 'Exact test: does observed proportion differ from p₀? · exact binomial p-value · Wilson CI · Cohen\'s h effect size · probability distribution chart'}
            </p>
            <BinomialTest ar={ar} />
          </>
        )}
        {sub === 'ancova' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎛️ {ar ? 'تحليل التغاير (ANCOVA — One-Way)' : 'Analysis of Covariance (One-Way ANCOVA)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'F للأثر الجماعي بعد ضبط المتغير المصاحب · Partial η² · المتوسطات المعدَّلة (عند x̄) مقابل الخام · ميل المصاحب وأهميته · R² للنموذج الكامل'
                  : 'F for group effect after controlling covariate · Partial η² · Adjusted means at grand x̄ vs raw · Covariate slope significance · Full model R²'}
            </p>
            <Ancova ar={ar} />
          </>
        )}
        {sub === 'diagacc' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🩺 {ar ? 'دقة التشخيص (Sensitivity / Specificity / PPV / NPV)' : 'Diagnostic Accuracy (Sensitivity / Specificity / PPV / NPV)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'جدول 2×2 · حساسية · نوعية · PPV / NPV · LR+ / LR− · DOR · Youden\'s J · F1 · MCC · PPV/NPV بايزي عند انتشار مخصص · CI 95% Wilson'
                  : '2×2 table · Sensitivity · Specificity · PPV / NPV · LR+ / LR− · DOR · Youden\'s J · F1 · MCC · Bayesian PPV/NPV at custom prevalence · 95% CI'}
            </p>
            <DiagnosticAccuracy ar={ar} />
          </>
        )}
        {sub === 'twoway' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⊞ {ar ? 'تحليل التباين ثنائي الاتجاه (Two-Way ANOVA)' : 'Two-Way ANOVA (Factorial)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'Type III SS · أثر A · أثر B · تفاعل A×B · η² لكل مصدر · متوسطات هامشية · رسم التفاعل · مصمَّم لعيّنات متوازنة وغير متوازنة (OLS)'
                  : 'Type III SS via OLS · Factor A effect · Factor B effect · A×B interaction · η² per source · marginal means · interaction plot · balanced & unbalanced'}
            </p>
            <TwoWayAnova ar={ar} />
          </>
        )}
        {sub === 'blandaltman' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📐 {ar ? 'رسم Bland-Altman — حدود الاتفاق (Limits of Agreement)' : 'Bland-Altman Plot — Method Agreement'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'التحيّز + SD · حدود الاتفاق (±1.96 SD) مع CI · اختبار التحيّز التناسبي (Pearson r) · نسبة القياسات داخل الحدود · رسم تبعثري تفاعلي'
                  : 'Mean bias ± SD · Limits of Agreement (±1.96 SD) with CI · proportional bias test (Pearson r) · % within LoA · interactive scatter plot'}
            </p>
            <BlandAltman ar={ar} />
          </>
        )}
        {sub === 'polyreg' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              〰️ {ar ? 'الانحدار متعدد الحدود (Polynomial Regression)' : 'Polynomial Regression'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'درجة 1–5 · R² / R² adj / AIC / BIC / RMSE · مقارنة النماذج (★ أفضل AIC) · المعادلة · رسم المنحنى المناسب · رسم البواقي'
                  : 'Degree 1–5 · R² / R² adj / AIC / BIC / RMSE · model comparison (★ best AIC) · equation · fitted curve · residuals chart'}
            </p>
            <PolyReg ar={ar} />
          </>
        )}
        {sub === 'roc' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📈 {ar ? 'منحنى ROC — مساحة تحت المنحنى (AUC)' : 'ROC Curve — Area Under the Curve (AUC)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'AUC مع 95% CI (Hanley-McNeil) · القاطع الأمثل (Youden\'s J) · حساسية ونوعية عند القاطع · مصفوفة الالتباس · رسم ROC تفاعلي'
                  : 'AUC with 95% CI (Hanley-McNeil) · optimal cutoff (Youden\'s J) · sensitivity & specificity at cutoff · confusion matrix · interactive ROC plot'}
            </p>
            <RocCurve ar={ar} />
          </>
        )}
        {sub === 'partialcorr' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔗 {ar ? 'مصفوفة الارتباط الجزئي' : 'Partial Correlation Matrix'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يضبط كل ارتباط جميع المتغيرات الأخرى · مقارنة بـ Pearson العادي · اختبار t للدلالة · نجوم * ** *** · نسخ TSV · بيانات CSV/Tab'
                  : 'Each partial r controls for all other variables · compare with zero-order Pearson · t-test for significance · * ** *** · copy TSV · CSV/tab data'}
            </p>
            <PartialCorr ar={ar} />
          </>
        )}
        {sub === 'twoprop' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚖️ {ar ? 'اختبار z لمقارنة نسبتَين' : 'Two-Proportion z-test'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'z-test مع احتمال مجمَّع · 90/95/99% CI للفرق (Wilson) · Cohen\'s h · Odds Ratio · Risk Ratio · طرف واحد أو طرفان · APA'
                  : 'z-test with pooled proportion · 90/95/99% CI for diff · Cohen\'s h · Odds Ratio · Risk Ratio · one/two-tailed · APA'}
            </p>
            <TwoPropZ ar={ar} />
          </>
        )}
        {sub === 'kappa' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              κ {ar ? 'كاپا Cohen — اتفاق الفئات بين المحكّمين' : "Cohen's Kappa — Categorical Inter-Rater Agreement"}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'كاپا عادي (للفئات الاسمية) · كاپا مرجّح خطي (للترتيبية) · مصفوفة الاتفاق · SE · 95% CI · z-test · معيار Landis & Koch (1977)'
                  : 'Standard κ (nominal) · Weighted κ linear (ordinal) · Agreement matrix · SE · 95% CI · z-test · Landis & Koch (1977) thresholds'}
            </p>
            <CohenKappa ar={ar} />
          </>
        )}
        {sub === 'hierreg' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📈 {ar ? 'الانحدار التسلسلي الهرمي (ΔR²)' : 'Hierarchical Regression (ΔR² — F-change)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'مقارنة نموذجَين متداخلَين · ΔR² = تباين إضافي مفسَّر بالبلوك 2 · ΔF ودلالته · معاملات β لكل بلوك · شريط التباين المفسَّر'
                  : 'Compare nested models · ΔR² = additional variance from Block 2 · ΔF significance · β per block · visual variance bar'}
            </p>
            <HierarchReg ar={ar} />
          </>
        )}
        {sub === 'chigof' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              χ² {ar ? 'اختبار حسن المطابقة (Goodness of Fit)' : 'Chi-Square Goodness of Fit'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'هل التوزيع الملاحظ يطابق المتوقع؟ · χ² = Σ(O−E)²/E · df = k−1 · Cohen\'s w · جدول المساهمات · رسم مقارن O/E'
                  : 'Does observed distribution match expected? · χ² = Σ(O−E)²/E · df = k−1 · Cohen\'s w · cell contributions · O vs E chart'}
            </p>
            <ChiGoF ar={ar} />
          </>
        )}
        {sub === 'anovasum' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 {ar ? 'ANOVA أحادي الاتجاه من الإحصاءات الملخصة' : 'One-Way ANOVA from Summary Statistics'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'أدخل اسم المجموعة، n، M، SD لكل مجموعة · F · η² · ω² · جدول ANOVA · مقارنات Bonferroni البعدية · مفيد عند العمل من نتائج منشورة'
                  : 'Enter group name, n, M, SD per row · F · η² · ω² · ANOVA table · Bonferroni post-hoc · useful when working from published results'}
            </p>
            <AnovaSummary ar={ar} />
          </>
        )}
        {sub === 'nonparam' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔬 {ar ? 'الاختبارات اللابارامترية' : 'Non-Parametric Tests'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'تستخدم الرتب بدلاً من القيم الخام — للبيانات غير المعتدلة أو الترتيبية · Mann-Whitney U · Kruskal-Wallis H · سبيرمان ρ'
                  : 'Rank-based alternatives for non-normal or ordinal data · Mann-Whitney U · Kruskal-Wallis H · Spearman ρ'}
            </p>
            <NonParametricTests ar={ar} />
          </>
        )}
        {sub === 'normality' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📐 {ar ? "اختبار الاعتدالية — D'Agostino-Pearson K²" : "Normality Test — D'Agostino-Pearson K²"}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يختبر هل البيانات تتّبع التوزيع الطبيعي · الالتواء · التفرطح · مدرج تكراري · مخطط Q-Q'
                  : 'Tests whether data follow a normal distribution · Skewness · Kurtosis · Histogram · Q-Q plot'}
            </p>
            <NormalityTest ar={ar} />
          </>
        )}
        {sub === 'apa' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📝 {ar ? 'منسّق نتائج APA 7th Edition' : 'APA 7th Edition Results Formatter'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'أدخل إحصاءاتك فيُنتج النص الجاهز للنشر بصيغة APA 7 — t-test · ANOVA · ارتباط · كاي² · انحدار · وصفي'
                  : 'Enter your statistics and get publication-ready APA 7 text — t-test · ANOVA · correlation · χ² · regression · descriptive'}
            </p>
            <APAFormatter ar={ar} />
          </>
        )}
        {sub === 'samplesize' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 {ar ? 'حاسبة حجم العيّنة (تحليل القدرة الإحصائية)' : 'Sample Size Calculator (Power Analysis)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'تحسب الحجم الأدنى للعيّنة لضمان القدرة الإحصائية · t-test · ارتباط · كاي مربع · نسبتَان'
                  : 'Computes minimum sample size for statistical power · t-test · correlation · chi-square · proportions'}
            </p>
            <SampleSizeCalc ar={ar} />
          </>
        )}
        {sub === 'cronbach' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              α {ar ? 'تحليل الثبات — معامل ألفا كرونباخ' : "Reliability Analysis — Cronbach's Alpha"}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'يقيس اتساق بنود المقياس الداخلي · يُخرج α وارتباط كل فقرة بالمقياس الكلي وقيمة α عند حذف كل فقرة'
                  : 'Measures internal consistency of scale items · outputs α, corrected item-total correlations, and α-if-deleted for each item'}
            </p>
            <CronbachAlpha ar={ar} />
          </>
        )}
        {sub === 'regdiag' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔬 {ar ? 'تشخيصات الانحدار المتعدد' : 'Multiple Regression Diagnostics'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'VIF (كشف التعدد الخطي) · التسامح · إحصاء Durbin-Watson (الارتباط الذاتي) · رسم البواقي مقابل القيم المُناسَبة · مخطط QQ للبواقي'
                  : 'VIF (multicollinearity) · Tolerance · Durbin-Watson (autocorrelation) · Residuals vs. Fitted · Q-Q plot of residuals'}
            </p>
            <RegDiagnostics ar={ar} />
          </>
        )}
        {sub === 'regression' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.gold, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📉 {ar ? 'تحليل الانحدار الخطي (OLS)' : 'Linear Regression Analysis (OLS)'}
            </h3>
            <p style={{ fontSize: 13, color: C.sub, margin: '0 0 16px' }}>
              {ar ? 'انحدار بسيط ومتعدد · معاملات β · R² · F-statistic · مخطط البواقي · معادلة التنبؤ'
                  : 'Simple & multiple regression · β coefficients · R² · F-statistic · Residual plot · Prediction equation'}
            </p>
            <RegressionAnalysis ar={ar} />
          </>
        )}
        {sub === 'stats'      && <StatParser />}
        {sub === 'equations'  && <EquationChecker />}
      </div>
    </div>
  );
}
