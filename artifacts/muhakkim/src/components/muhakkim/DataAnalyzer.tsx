import React, { useState, useCallback } from 'react';
import { useLanguage } from '../../lib/i18n';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { UploadCloud, BarChart2, Table2, TrendingUp, X, ChevronDown, ChevronUp } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DataRow { [key: string]: string | number; }

interface ColStats {
  col: string;
  type: 'numeric' | 'text';
  count: number;
  missing: number;
  // numeric only
  mean?: number;
  median?: number;
  mode?: number | string;
  std?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  // text only
  unique?: number;
  top?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics helpers
// ─────────────────────────────────────────────────────────────────────────────
function numStats(vals: number[]): Partial<ColStats> {
  if (!vals.length) return {};
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];

  // mode
  const freq: Record<number, number> = {};
  vals.forEach(v => { freq[v] = (freq[v] ?? 0) + 1; });
  const mode = +Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

  return { mean, median, mode, std, min: sorted[0], max: sorted[n - 1], q1, q3 };
}

function buildColStats(rows: DataRow[]): ColStats[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);

  return keys.map(col => {
    const rawVals = rows.map(r => r[col]);
    const nonNull = rawVals.filter(v => v !== null && v !== undefined && v !== '');
    const numericVals = nonNull
      .map(v => +v)
      .filter(v => !isNaN(v));

    const isNumeric = numericVals.length > nonNull.length * 0.7;

    if (isNumeric) {
      return {
        col, type: 'numeric',
        count: numericVals.length,
        missing: rows.length - numericVals.length,
        ...numStats(numericVals),
      };
    } else {
      const strVals = nonNull.map(String);
      const freqMap: Record<string, number> = {};
      strVals.forEach(v => { freqMap[v] = (freqMap[v] ?? 0) + 1; });
      const top = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      return {
        col, type: 'text',
        count: strVals.length,
        missing: rows.length - strVals.length,
        unique: new Set(strVals).size,
        top,
      };
    }
  });
}

function makeHistogram(vals: number[], bins = 10): { x: string; count: number }[] {
  if (!vals.length) return [];
  const min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) return [{ x: String(min), count: vals.length }];
  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    x: (min + i * step).toFixed(2),
    count: 0,
  }));
  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    buckets[idx].count++;
  });
  return buckets;
}

const fmt = (n?: number) =>
  n === undefined ? '—' : (Math.abs(n) >= 1000 ? n.toLocaleString('en', { maximumFractionDigits: 2 }) : n.toFixed(4).replace(/\.?0+$/, ''));

// ─────────────────────────────────────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = ['#C9A84C','#93c5fd','#c4b5fd','#5eead4','#f87171','#fb923c','#a3e635','#38bdf8'];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
type ViewMode = 'table' | 'stats' | 'charts';

export default function DataAnalyzer() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  const [rows,    setRows]    = useState<DataRow[]>([]);
  const [stats,   setStats]   = useState<ColStats[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDrag,  setIsDrag]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [view,    setView]    = useState<ViewMode>('stats');
  const [chartCol, setChartCol] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'histogram'>('bar');
  const [expandCol, setExpandCol] = useState<string | null>(null);

  // ── parse ──────────────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    try {
      let parsed: DataRow[] = [];

      if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
        const text = await file.text();
        const result = Papa.parse<DataRow>(text, {
          header: true, dynamicTyping: true, skipEmptyLines: true,
          delimiter: ext === '.tsv' ? '\t' : undefined,
        });
        parsed = result.data;

      } else if (['.xlsx', '.xls', '.ods'].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        parsed = XLSX.utils.sheet_to_json<DataRow>(ws, { defval: '' });

      } else if (ext === '.json') {
        const text = await file.text();
        const data = JSON.parse(text);
        parsed = Array.isArray(data) ? data : [data];

      } else {
        setError(ar
          ? 'الصيغة غير مدعومة. الرجاء استخدام CSV, XLSX, XLS, TSV, JSON'
          : 'Unsupported format. Use CSV, XLSX, XLS, TSV, or JSON.');
        return;
      }

      if (!parsed.length) {
        setError(ar ? 'الملف فارغ أو لا يحتوي بيانات' : 'File is empty or has no data.');
        return;
      }

      const s = buildColStats(parsed);
      setRows(parsed);
      setStats(s);
      setFileName(file.name);
      setView('stats');
      // default chart col = first numeric
      const firstNum = s.find(c => c.type === 'numeric');
      setChartCol(firstNum?.col ?? s[0]?.col ?? '');

    } catch (e: any) {
      setError(ar ? `خطأ في قراءة الملف: ${e?.message}` : `Error reading file: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  }, [ar]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
    e.target.value = '';
  };

  // ── current chart data ─────────────────────────────────────────────────────
  const numericCols = stats.filter(s => s.type === 'numeric');
  const selectedStat = stats.find(s => s.col === chartCol);
  const chartVals = chartCol
    ? rows.map(r => +r[chartCol]).filter(v => !isNaN(v))
    : [];

  const barData = chartCol
    ? rows.slice(0, 60).map((r, i) => ({ name: String(i + 1), value: +r[chartCol] }))
    : [];

  const histData = makeHistogram(chartVals, 12);

  // ── styles ─────────────────────────────────────────────────────────────────
  const C = {
    gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
    bg: '#060d1a', card: 'rgba(13,23,45,0.85)', border: 'rgba(201,168,76,0.15)',
    muted: '#475569', text: '#e2e8f0', sub: '#64748b',
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
    border: active ? `1px solid ${C.border}` : '1px solid transparent',
    color: active ? C.gold : C.muted,
    borderRadius: 10, padding: '8px 18px', fontWeight: active ? 700 : 500,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  });

  // ── empty / upload zone ────────────────────────────────────────────────────
  if (!rows.length) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <style>{`@keyframes da-spin{to{transform:rotate(360deg)}}`}</style>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.gold, margin: 0 }}>
            {ar ? '📊 محلّل البيانات الإحصائية' : '📊 Statistical Data Analyzer'}
          </h2>
          <p style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>
            {ar
              ? 'ارفع ملف بيانات لتحليله إحصائياً وعرض الرسوم البيانية'
              : 'Upload a data file for statistical analysis and charts'}
          </p>
        </div>

        <label
          style={{
            border: `2px dashed ${isDrag ? C.gold : 'rgba(201,168,76,0.25)'}`,
            borderRadius: 18, padding: '52px 24px', textAlign: 'center',
            cursor: 'pointer', display: 'block',
            background: isDrag ? 'rgba(201,168,76,0.05)' : 'rgba(201,168,76,0.02)',
            transition: 'all .25s',
          }}
          onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={handleDrop}
        >
          <input type="file" style={{ display: 'none' }}
            accept=".csv,.tsv,.xlsx,.xls,.ods,.json,.txt"
            onChange={handleChange} />

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.gold }}>
              <div style={{
                width: 28, height: 28, border: `3px solid rgba(201,168,76,0.2)`,
                borderTopColor: C.gold, borderRadius: '50%',
                animation: 'da-spin 0.8s linear infinite',
              }} />
              {ar ? 'جارٍ التحليل…' : 'Analyzing…'}
            </div>
          ) : (
            <>
              <BarChart2 size={52} color={C.gold} style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                {ar ? 'اسحب وأفلت ملف البيانات هنا' : 'Drag & drop your data file here'}
              </p>
              <p style={{ color: C.sub, fontSize: 13, marginBottom: 24 }}>
                {ar ? 'أو انقر لاختيار الملف' : 'Or click to browse'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {['CSV', 'XLSX', 'XLS', 'JSON', 'TSV'].map(f => (
                  <span key={f} style={{
                    background: 'rgba(201,168,76,0.08)', border: `1px solid ${C.border}`,
                    color: C.gold, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                  }}>{f}</span>
                ))}
              </div>
              <div style={{
                background: `linear-gradient(135deg, ${C.gold}, #f5d78e)`,
                color: '#080d1a', borderRadius: 12, padding: '12px 32px',
                fontWeight: 800, fontSize: 14, display: 'inline-block',
                boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
              }}>
                {ar ? '📂 اختر ملفاً' : '📂 Choose File'}
              </div>
            </>
          )}
        </label>

        {error && (
          <div style={{
            marginTop: 16, background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
            padding: '12px 16px', color: '#fca5a5', fontSize: 14,
          }}>{error}</div>
        )}
      </div>
    );
  }

  // ── main analysis view ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        @keyframes da-spin { to { transform: rotate(360deg); } }
        .da-row:hover { background: rgba(201,168,76,0.04) !important; }
        .da-card:hover { border-color: rgba(201,168,76,0.35) !important; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius:4px; }
      `}</style>

      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.gold, margin: 0 }}>
            {ar ? '📊 نتائج التحليل' : '📊 Analysis Results'}
          </h2>
          <p style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
            📄 {fileName} &nbsp;·&nbsp;
            {rows.length.toLocaleString()} {ar ? 'سطر' : 'rows'} &nbsp;·&nbsp;
            {stats.length} {ar ? 'عمود' : 'columns'}
          </p>
        </div>
        <button
          onClick={() => { setRows([]); setStats([]); setFileName(''); }}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', borderRadius: 10, padding: '8px 16px', fontSize: 13,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <X size={14} /> {ar ? 'ملف جديد' : 'New File'}
        </button>
      </div>

      {/* view tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20,
        background: '#060d1a', borderRadius: 12, padding: 5,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button style={tabBtn(view === 'stats')} onClick={() => setView('stats')}>
          <TrendingUp size={15} /> {ar ? 'الإحصاءات' : 'Statistics'}
        </button>
        <button style={tabBtn(view === 'charts')} onClick={() => setView('charts')}>
          <BarChart2 size={15} /> {ar ? 'الرسوم البيانية' : 'Charts'}
        </button>
        <button style={tabBtn(view === 'table')} onClick={() => setView('table')}>
          <Table2 size={15} /> {ar ? 'جدول البيانات' : 'Data Table'}
        </button>
      </div>

      {/* ── STATS VIEW ── */}
      {view === 'stats' && (
        <div>
          {/* summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: ar ? 'إجمالي الصفوف' : 'Total Rows', val: rows.length.toLocaleString(), icon: '📋' },
              { label: ar ? 'عدد الأعمدة' : 'Columns', val: stats.length, icon: '📐' },
              { label: ar ? 'أعمدة رقمية' : 'Numeric Cols', val: numericCols.length, icon: '🔢' },
              { label: ar ? 'أعمدة نصية' : 'Text Cols', val: stats.filter(s => s.type === 'text').length, icon: '📝' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(201,168,76,0.06)', border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{item.val}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* per-column stat cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.map((s, idx) => {
              const expanded = expandCol === s.col;
              const color = PALETTE[idx % PALETTE.length];
              return (
                <div key={s.col} className="da-card" style={{
                  background: C.card, border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s',
                }}>
                  <button
                    onClick={() => setExpandCol(expanded ? null : s.col)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '14px 18px', display: 'flex', alignItems: 'center',
                      gap: 12, textAlign: 'start', fontFamily: 'inherit',
                    }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                      boxShadow: `0 0 8px ${color}66`,
                    }} />
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 14, flex: 1 }}>{s.col}</span>
                    <span style={{
                      background: s.type === 'numeric' ? 'rgba(147,197,253,0.12)' : 'rgba(196,181,253,0.12)',
                      border: `1px solid ${s.type === 'numeric' ? 'rgba(147,197,253,0.3)' : 'rgba(196,181,253,0.3)'}`,
                      color: s.type === 'numeric' ? C.blue : C.purple,
                      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                    }}>
                      {s.type === 'numeric' ? (ar ? 'رقمي' : 'Numeric') : (ar ? 'نصي' : 'Text')}
                    </span>
                    <span style={{ color: C.sub, fontSize: 12 }}>{s.count} {ar ? 'قيمة' : 'values'}</span>
                    {expanded ? <ChevronUp size={16} color={C.sub} /> : <ChevronDown size={16} color={C.sub} />}
                  </button>

                  {expanded && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {s.type === 'numeric' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, paddingTop: 14 }}>
                          {[
                            { label: ar ? 'المتوسط' : 'Mean',          val: fmt(s.mean)  },
                            { label: ar ? 'الوسيط' : 'Median',         val: fmt(s.median) },
                            { label: ar ? 'المنوال' : 'Mode',           val: fmt(s.mode as number) },
                            { label: ar ? 'الانحراف المعياري' : 'Std Dev', val: fmt(s.std) },
                            { label: ar ? 'الحد الأدنى' : 'Min',       val: fmt(s.min)   },
                            { label: ar ? 'الحد الأقصى' : 'Max',       val: fmt(s.max)   },
                            { label: 'Q1',                               val: fmt(s.q1)    },
                            { label: 'Q3',                               val: fmt(s.q3)    },
                            { label: ar ? 'القيم المفقودة' : 'Missing', val: s.missing    },
                          ].map(item => (
                            <div key={item.label} style={{
                              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                              padding: '10px 14px',
                            }}>
                              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: color }}>{item.val}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, paddingTop: 14 }}>
                          {[
                            { label: ar ? 'عدد القيم' : 'Count',          val: s.count  },
                            { label: ar ? 'القيم الفريدة' : 'Unique',     val: s.unique },
                            { label: ar ? 'القيم المفقودة' : 'Missing',   val: s.missing },
                            { label: ar ? 'الأكثر تكراراً' : 'Most Common', val: s.top },
                          ].map(item => (
                            <div key={item.label} style={{
                              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                              padding: '10px 14px',
                            }}>
                              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: color,
                                wordBreak: 'break-all', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                {String(item.val ?? '—')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHARTS VIEW ── */}
      {view === 'charts' && (
        <div>
          {/* controls */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6 }}>
                {ar ? 'العمود' : 'Column'}
              </label>
              <select
                value={chartCol}
                onChange={e => setChartCol(e.target.value)}
                style={{
                  background: '#060d1a', border: `1px solid ${C.border}`, color: C.text,
                  borderRadius: 10, padding: '9px 14px', fontSize: 13, width: '100%',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>
                {stats.map(s => (
                  <option key={s.col} value={s.col}>{s.col} ({s.type === 'numeric' ? (ar ? 'رقمي' : 'num') : (ar ? 'نصي' : 'text')})</option>
                ))}
              </select>
            </div>

            {selectedStat?.type === 'numeric' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6 }}>
                  {ar ? 'نوع الرسم' : 'Chart Type'}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['bar', 'line', 'histogram'] as const).map(t => (
                    <button key={t} onClick={() => setChartType(t)} style={tabBtn(chartType === t)}>
                      {t === 'bar' ? '📊' : t === 'line' ? '📈' : '📉'} {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* chart */}
          <div style={{
            background: C.card, border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '24px 16px',
          }}>
            {selectedStat?.type === 'numeric' ? (
              <>
                {/* stats summary bar */}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
                  {[
                    { label: ar ? 'متوسط' : 'Mean',   val: fmt(selectedStat.mean)   },
                    { label: ar ? 'وسيط' : 'Median',  val: fmt(selectedStat.median) },
                    { label: ar ? 'انحراف' : 'Std',    val: fmt(selectedStat.std)    },
                    { label: 'Min', val: fmt(selectedStat.min) },
                    { label: 'Max', val: fmt(selectedStat.max) },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 10, color: C.sub }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{item.val}</div>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'histogram' ? (
                    <BarChart data={histData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="x" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                        labelStyle={{ color: C.gold }}
                      />
                      <Bar dataKey="count" name={ar ? 'التكرار' : 'Frequency'} radius={[4, 4, 0, 0]}>
                        {histData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={barData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Line type="monotone" dataKey="value" stroke={C.gold} strokeWidth={2} dot={false} name={chartCol} />
                    </LineChart>
                  ) : (
                    <BarChart data={barData.slice(0, 40)} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Bar dataKey="value" name={chartCol} radius={[4, 4, 0, 0]}>
                        {barData.slice(0, 40).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </>
            ) : (
              /* text column: frequency bar chart */
              (() => {
                const freqMap: Record<string, number> = {};
                rows.forEach(r => {
                  const v = String(r[chartCol] ?? '');
                  if (v) freqMap[v] = (freqMap[v] ?? 0) + 1;
                });
                const freqData = Object.entries(freqMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([name, count]) => ({ name, count }));
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={freqData} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} width={80} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Bar dataKey="count" name={ar ? 'التكرار' : 'Count'} radius={[0, 4, 4, 0]}>
                        {freqData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                <th style={{ padding: '10px 14px', color: C.sub, fontWeight: 700, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                  #
                </th>
                {stats.map((s, i) => (
                  <th key={s.col} style={{
                    padding: '10px 14px', color: PALETTE[i % PALETTE.length],
                    fontWeight: 700, textAlign: 'start',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, ri) => (
                <tr key={ri} className="da-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 14px', color: C.sub, fontSize: 11 }}>{ri + 1}</td>
                  {stats.map(s => (
                    <td key={s.col} style={{ padding: '8px 14px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(row[s.col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p style={{ textAlign: 'center', padding: 12, color: C.sub, fontSize: 12 }}>
              {ar ? `يُعرض أول 200 صف من أصل ${rows.length.toLocaleString()}` : `Showing first 200 of ${rows.length.toLocaleString()} rows`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
