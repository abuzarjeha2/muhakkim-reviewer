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
  { key: 'stats',      icon: '📊', label: 'اختبارات إحصائية',     short: 'إحصاء' },
  { key: 'equations',  icon: '🔢', label: 'المعادلات',             short: 'معادلات' },
];
const SUBTABS_EN = [
  { key: 'explorer',   icon: '📁', label: 'Data Explorer',       short: 'Explore' },
  { key: 'freq',       icon: '📋', label: 'Frequency Table',     short: 'Freq' },
  { key: 'likert',     icon: '⚖️', label: 'Likert Scale',        short: 'Likert' },
  { key: 'timeseries', icon: '📈', label: 'Time Series',         short: 'Time' },
  { key: 'corr',       icon: '🔗', label: 'Correlation Matrix',  short: 'Corr' },
  { key: 'crosstab',   icon: '⊞',  label: 'Cross-Tabulation',   short: 'CrossTab' },
  { key: 'regression', icon: '📉', label: 'Linear Regression',   short: 'Regress' },
  { key: 'stats',      icon: '📊', label: 'Statistical Tests',   short: 'Stats' },
  { key: 'equations',  icon: '🔢', label: 'Equations',           short: 'Eq' },
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
