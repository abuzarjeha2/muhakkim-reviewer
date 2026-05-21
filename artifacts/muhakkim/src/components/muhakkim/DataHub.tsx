import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import DataAnalyzer from './DataAnalyzer';
import StatParser from './StatParser';
import EquationChecker from './EquationChecker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
  ComposedChart,
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
  { key: 'freq',       icon: '📋', label: 'جدول تكراري',          short: 'تكراري' },
  { key: 'likert',     icon: '⚖️', label: 'مقياس ليكرت',          short: 'ليكرت' },
  { key: 'timeseries', icon: '📈', label: 'سلاسل زمنية',          short: 'زمني' },
  { key: 'corr',       icon: '🔗', label: 'مصفوفة الارتباط',      short: 'ارتباط' },
  { key: 'crosstab',   icon: '⊞',  label: 'جدول التقاطع',         short: 'تقاطع' },
  { key: 'regression', icon: '📉', label: 'تحليل الانحدار',        short: 'انحدار' },
  { key: 'mediation',  icon: '🔀', label: 'تحليل الوساطة',         short: 'وساطة' },
  { key: 'groups',     icon: '👥', label: 'مقارنة المجموعات',      short: 'مجموعات' },
  { key: 'cronbach',    icon: 'α',  label: 'ثبات كرونباخ',           short: 'كرونباخ' },
  { key: 'normality',   icon: '📐', label: 'اختبار الاعتدالية',      short: 'اعتدالية' },
  { key: 'nonparam',    icon: '🔬', label: 'اختبارات لابارامترية',   short: 'لابارام' },
  { key: 'samplesize',  icon: '🎯', label: 'حجم العيّنة',            short: 'عيّنة' },
  { key: 'apa',         icon: '📝', label: 'منسّق APA',              short: 'APA' },
  { key: 'stats',       icon: '📊', label: 'اختبارات إحصائية',     short: 'إحصاء' },
  { key: 'equations',   icon: '🔢', label: 'المعادلات',             short: 'معادلات' },
];
const SUBTABS_EN = [
  { key: 'explorer',    icon: '📁', label: 'Data Explorer',       short: 'Explore' },
  { key: 'freq',        icon: '📋', label: 'Frequency Table',     short: 'Freq' },
  { key: 'likert',      icon: '⚖️', label: 'Likert Scale',        short: 'Likert' },
  { key: 'timeseries',  icon: '📈', label: 'Time Series',         short: 'Time' },
  { key: 'corr',        icon: '🔗', label: 'Correlation Matrix',  short: 'Corr' },
  { key: 'crosstab',    icon: '⊞',  label: 'Cross-Tabulation',   short: 'CrossTab' },
  { key: 'regression',  icon: '📉', label: 'Linear Regression',   short: 'Regress' },
  { key: 'mediation',   icon: '🔀', label: 'Mediation Analysis',  short: 'Mediate' },
  { key: 'groups',      icon: '👥', label: 'Group Comparison',    short: 'Groups' },
  { key: 'cronbach',    icon: 'α',  label: "Cronbach's Alpha",    short: 'Cronbach' },
  { key: 'normality',   icon: '📐', label: 'Normality Test',      short: 'Normal' },
  { key: 'nonparam',    icon: '🔬', label: 'Non-Parametric',      short: 'NonPar' },
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
