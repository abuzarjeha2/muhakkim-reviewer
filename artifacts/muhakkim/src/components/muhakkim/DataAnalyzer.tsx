import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../../lib/i18n';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import { UploadCloud, BarChart2, Table2, TrendingUp, X, FlaskConical, Link2, GitMerge } from 'lucide-react';
import {
  buildColStats, ColStats,
  mean, std, median, quantile, sortAsc, sum,
  shapiroFrancia, ksNormality, NormalityResult,
  oneSampleT, twoSampleT, pairedT, oneWayANOVA,
  mannWhitneyU, wilcoxonSignedRank, kruskalWallis,
  chiSquareIndependence, chiSquareGoodnessOfFit, HTestResult,
  correlationMatrix, CorrCell,
  linearRegression, RegressionResult,
  pearsonR, spearmanR, corrTest,
} from '../../lib/statLib';

// ── palette / theme ───────────────────────────────────────────────────────────
const PAL = ['#C9A84C','#93c5fd','#c4b5fd','#5eead4','#f87171','#fb923c','#a3e635','#38bdf8','#e879f9','#34d399'];
const C = {
  gold: '#C9A84C', blue: '#93c5fd', purple: '#c4b5fd', teal: '#5eead4',
  red: '#f87171', green: '#4ade80',
  bg: '#060d1a', card: 'rgba(13,23,45,0.88)', border: 'rgba(201,168,76,0.18)',
  muted: '#475569', text: '#e2e8f0', sub: '#64748b',
};

const fmt = (n?: number | string, d = 4): string => {
  if (n === undefined || n === null) return '—';
  if (typeof n === 'string') return n;
  if (isNaN(n)) return 'NaN';
  if (!isFinite(n)) return n > 0 ? '+∞' : '−∞';
  if (Math.abs(n) >= 1e6) return n.toExponential(2);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en', { maximumFractionDigits: 2 });
  return +n.toFixed(d) === 0 ? '0' : n.toFixed(d).replace(/\.?0+$/, '');
};

const pFmt = (p: number): string => {
  if (isNaN(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  return p.toFixed(4);
};

const pColor = (p: number) => p < 0.05 ? C.red : C.green;
const pLabel = (p: number, ar: boolean) =>
  p < 0.001 ? (ar ? 'دال جداً ***' : 'Very Sig. ***')
  : p < 0.01  ? (ar ? 'دال جداً **' : 'Highly Sig. **')
  : p < 0.05  ? (ar ? 'دال *' : 'Significant *')
  : (ar ? 'غير دال' : 'Not Sig.');

type DataRow = Record<string, unknown>;
type View = 'upload' | 'desc' | 'charts' | 'tests' | 'corr' | 'reg' | 'table';
type TestSub = 'normality' | 'param' | 'nonparam' | 'chisq';
type ParamTest = 'one-t' | 'two-t' | 'paired-t' | 'anova';
type NonParamTest = 'mann' | 'wilcoxon' | 'kruskal';
type ChiTest = 'independence' | 'gof';

function makeHistogram(vals: number[], bins = 14): { x: string; count: number }[] {
  if (!vals.length) return [];
  const mn = Math.min(...vals), mx = Math.max(...vals);
  if (mn === mx) return [{ x: fmt(mn), count: vals.length }];
  const step = (mx - mn) / bins;
  const b = Array.from({ length: bins }, (_, i) => ({ x: fmt(mn + i * step), count: 0 }));
  vals.forEach(v => { b[Math.min(Math.floor((v - mn) / step), bins - 1)].count++; });
  return b;
}

// ── shared sub-components ─────────────────────────────────────────────────────
function StatCard({ label, val, color = C.gold }: { label: string; val: string | number | undefined; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmt(val as number)}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.gold, margin: '20px 0 12px',
      borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>{children}</h3>
  );
}

function ResultBadge({ p }: { p: number }) {
  return (
    <span style={{
      background: p < 0.05 ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.12)',
      border: `1px solid ${p < 0.05 ? 'rgba(239,68,68,0.4)' : 'rgba(74,222,128,0.3)'}`,
      color: pColor(p), borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700,
    }}>p = {pFmt(p)}</span>
  );
}

function HTestCard({ res, ar }: { res: HTestResult; ar: boolean }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 4 }}>
            {ar ? res.nameAr : res.name}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: C.sub }}>
              {res.statLabel} = <strong style={{ color: C.blue }}>{fmt(res.stat)}</strong>
            </span>
            {res.df !== undefined && (
              <span style={{ fontSize: 13, color: C.sub }}>df = {fmt(res.df, 2)}</span>
            )}
            <ResultBadge p={res.pValue} />
            <span style={{ fontSize: 12, color: pColor(res.pValue), fontWeight: 700 }}>
              {pLabel(res.pValue, ar)}
            </span>
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 12, padding: '10px 14px', borderRadius: 10,
        background: res.pValue < 0.05 ? 'rgba(239,68,68,0.06)' : 'rgba(74,222,128,0.05)',
        border: `1px solid ${res.pValue < 0.05 ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.15)'}`,
        fontSize: 13, color: C.text, lineHeight: 1.6,
      }}>
        {ar ? res.conclusionAr : res.conclusion}
      </div>
      {res.extra && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {Object.entries(res.extra).map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, color: C.sub, background: 'rgba(255,255,255,0.04)', padding: '3px 9px', borderRadius: 6 }}>
              {k} = <span style={{ color: C.text }}>{fmt(v as number)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ColSelect({ label, value, onChange, cols, ar }: {
  label: string; value: string; onChange: (v: string) => void;
  cols: ColStats[]; ar: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: C.bg, border: `1px solid ${C.border}`, color: C.text,
        borderRadius: 10, padding: '9px 14px', fontSize: 13, width: '100%', fontFamily: 'inherit',
      }}>
        <option value="">{ar ? '— اختر عموداً —' : '— Select column —'}</option>
        {cols.map(s => (
          <option key={s.col} value={s.col}>{s.col} ({s.type === 'numeric' ? (ar ? 'رقمي' : 'num') : (ar ? 'نصي' : 'text')})</option>
        ))}
      </select>
    </div>
  );
}

function RunBtn({ onClick, ar }: { onClick: () => void; ar: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: `linear-gradient(135deg, ${C.gold}, #f5d78e)`,
      color: '#080d1a', border: 'none', borderRadius: 10, padding: '10px 22px',
      fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: '0 4px 16px rgba(201,168,76,0.25)', alignSelf: 'flex-end',
    }}>
      {ar ? '▶ تشغيل الاختبار' : '▶ Run Test'}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DataAnalyzer() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';

  // ── data state ──────────────────────────────────────────────────────────────
  const [rows,     setRows]     = useState<DataRow[]>([]);
  const [colStats, setColStats] = useState<ColStats[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDrag,   setIsDrag]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── view state ──────────────────────────────────────────────────────────────
  const [view,       setView]       = useState<View>('desc');
  const [testSub,    setTestSub]    = useState<TestSub>('normality');
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('pearson');
  const [expandCol,  setExpandCol]  = useState<string | null>(null);

  // ── chart state ─────────────────────────────────────────────────────────────
  const [chartCol,  setChartCol]  = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'histogram' | 'box'>('histogram');
  const [scatter1,  setScatter1]  = useState('');
  const [scatter2,  setScatter2]  = useState('');

  // ── test state ──────────────────────────────────────────────────────────────
  const [normCol,   setNormCol]   = useState('');
  const [normRes,   setNormRes]   = useState<NormalityResult[]>([]);

  const [paramTest, setParamTest]   = useState<ParamTest>('one-t');
  const [pCol1,     setPCol1]       = useState('');
  const [pCol2,     setPCol2]       = useState('');
  const [mu0,       setMu0]         = useState('0');
  const [groupValCol, setGroupValCol] = useState('');
  const [groupLabelCol, setGroupLabelCol] = useState('');
  const [paramRes,  setParamRes]    = useState<HTestResult | null>(null);

  const [npTest,    setNpTest]      = useState<NonParamTest>('mann');
  const [npCol1,    setNpCol1]      = useState('');
  const [npCol2,    setNpCol2]      = useState('');
  const [npGrpVal,  setNpGrpVal]   = useState('');
  const [npGrpLbl,  setNpGrpLbl]   = useState('');
  const [npRes,     setNpRes]       = useState<HTestResult | null>(null);

  const [chiTest,   setChiTest]     = useState<ChiTest>('independence');
  const [chiCol1,   setChiCol1]     = useState('');
  const [chiCol2,   setChiCol2]     = useState('');
  const [chiRes,    setChiRes]      = useState<HTestResult | null>(null);

  // ── regression state ────────────────────────────────────────────────────────
  const [regX,  setRegX]  = useState('');
  const [regY,  setRegY]  = useState('');
  const [regRes, setRegRes] = useState<RegressionResult | null>(null);

  // ── derived lists ────────────────────────────────────────────────────────────
  const numCols  = useMemo(() => colStats.filter(s => s.type === 'numeric'), [colStats]);
  const textCols = useMemo(() => colStats.filter(s => s.type === 'text'),    [colStats]);

  const getNum = useCallback((col: string) =>
    rows.map(r => +(r[col] as number)).filter(v => !isNaN(v)), [rows]);

  // ── parse file ───────────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setError(null); setLoading(true);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    try {
      let parsed: DataRow[] = [];
      if (['.csv', '.tsv', '.txt'].includes(ext)) {
        const text = await file.text();
        const r = Papa.parse<DataRow>(text, { header: true, dynamicTyping: true, skipEmptyLines: true,
          delimiter: ext === '.tsv' ? '\t' : undefined });
        parsed = r.data;
      } else if (['.xlsx', '.xls', '.ods'].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: 'array' });
        parsed = XLSX.utils.sheet_to_json<DataRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      } else if (ext === '.json') {
        const text = await file.text();
        const d = JSON.parse(text);
        parsed = Array.isArray(d) ? d : [d];
      } else {
        setError(ar ? 'صيغة غير مدعومة' : 'Unsupported format'); return;
      }
      if (!parsed.length) { setError(ar ? 'الملف فارغ' : 'File is empty'); return; }
      const cs = buildColStats(parsed as Record<string, unknown>[]);
      setRows(parsed); setColStats(cs); setFileName(file.name); setView('desc');
      const firstNum = cs.find(c => c.type === 'numeric');
      setChartCol(firstNum?.col ?? cs[0]?.col ?? '');
      setNormCol(firstNum?.col ?? '');
      setPCol1(firstNum?.col ?? ''); setPCol2(cs.find((c, i) => c.type === 'numeric' && i > 0)?.col ?? '');
      setNpCol1(firstNum?.col ?? ''); setNpCol2(cs.find((c, i) => c.type === 'numeric' && i > 0)?.col ?? '');
      setRegX(firstNum?.col ?? ''); setRegY(cs.find((c, i) => c.type === 'numeric' && i > 0)?.col ?? '');
      setScatter1(firstNum?.col ?? ''); setScatter2(cs.find((c, i) => c.type === 'numeric' && i > 0)?.col ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(ar ? `خطأ: ${msg}` : `Error: ${msg}`);
    } finally { setLoading(false); }
  }, [ar]);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; };

  // ── tab button style ────────────────────────────────────────────────────────
  const tabBtn = (active: boolean, small = false): React.CSSProperties => ({
    background: active ? 'rgba(201,168,76,0.14)' : 'transparent',
    border: active ? `1px solid ${C.border}` : '1px solid transparent',
    color: active ? C.gold : C.muted,
    borderRadius: 10, padding: small ? '6px 12px' : '8px 18px',
    fontWeight: active ? 700 : 500, fontSize: small ? 12 : 13,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  });

  // ── UPLOAD SCREEN ───────────────────────────────────────────────────────────
  if (!rows.length) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <style>{`@keyframes da-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.gold, margin: 0 }}>
            {ar ? '📊 محلّل البيانات الإحصائي الشامل' : '📊 Comprehensive Statistical Data Analyzer'}
          </h2>
          <p style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>
            {ar
              ? 'إحصاء وصفي · اختبارات الفروض المعلمية وغير المعلمية · مصفوفة الارتباط · الانحدار الخطي'
              : 'Descriptive stats · Parametric & non-parametric tests · Correlation matrix · Linear regression'}
          </p>
        </div>
        <label style={{
          border: `2px dashed ${isDrag ? C.gold : 'rgba(201,168,76,0.25)'}`,
          borderRadius: 18, padding: '52px 24px', textAlign: 'center', cursor: 'pointer',
          display: 'block', background: isDrag ? 'rgba(201,168,76,0.05)' : 'rgba(201,168,76,0.02)',
          transition: 'all .25s',
        }}
          onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)} onDrop={onDrop}>
          <input type="file" style={{ display: 'none' }}
            accept=".csv,.tsv,.xlsx,.xls,.ods,.json,.txt" onChange={onChange} />
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.gold }}>
              <div style={{ width: 28, height: 28, border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: C.gold, borderRadius: '50%', animation: 'da-spin 0.8s linear infinite' }} />
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
                {['CSV', 'XLSX', 'XLS', 'JSON', 'TSV', 'ODS'].map(f => (
                  <span key={f} style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid ${C.border}`, color: C.gold, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{f}</span>
                ))}
              </div>
              <div style={{ background: `linear-gradient(135deg, ${C.gold}, #f5d78e)`, color: '#080d1a', borderRadius: 12, padding: '12px 32px', fontWeight: 800, fontSize: 14, display: 'inline-block', boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
                {ar ? '📂 اختر ملفاً' : '📂 Choose File'}
              </div>
            </>
          )}
        </label>
        {error && (
          <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', color: '#fca5a5', fontSize: 14 }}>{error}</div>
        )}
        {/* feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 28 }}>
          {[
            { icon: '📋', title: ar ? 'الإحصاء الوصفي'  : 'Descriptive Stats',   desc: ar ? 'متوسط، وسيط، تحيّز، تفلطح، CV، SEM' : 'Mean, median, skewness, kurtosis, CV, SEM' },
            { icon: '🧪', title: ar ? 'اختبارات معلمية'  : 'Parametric Tests',    desc: ar ? 't أحادي/مستقل/مرتبط، ANOVA أحادي' : 'One/two-sample t, paired t, one-way ANOVA' },
            { icon: '📐', title: ar ? 'اختبارات لامعلمية': 'Non-Parametric',      desc: ar ? 'مان-ويتني، ويلكوكسون، كروسكال-واليس' : 'Mann-Whitney, Wilcoxon, Kruskal-Wallis' },
            { icon: '🔗', title: ar ? 'مصفوفة الارتباط'  : 'Correlation Matrix',  desc: ar ? 'بيرسون وسبيرمان مع قيم p' : 'Pearson & Spearman with p-values' },
            { icon: '📉', title: ar ? 'الانحدار الخطي'   : 'Linear Regression',   desc: ar ? 'R², معاملات، F، p-values' : 'R², coefficients, F-test, p-values' },
            { icon: '📊', title: ar ? 'رسوم بيانية'      : 'Charts',              desc: ar ? 'هيستوغرام، تشتت، ترند' : 'Histogram, scatter, trend line' },
          ].map(item => (
            <div key={item.title} style={{ background: 'rgba(201,168,76,0.05)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── MAIN ANALYSIS VIEW ───────────────────────────────────────────────────────
  const VIEWS: { key: View; icon: React.ReactNode; label: string; labelAr: string }[] = [
    { key: 'desc',   icon: <TrendingUp size={14} />,    label: 'Descriptive',   labelAr: 'وصفي'      },
    { key: 'charts', icon: <BarChart2 size={14} />,     label: 'Charts',        labelAr: 'رسوم'      },
    { key: 'tests',  icon: <FlaskConical size={14} />,  label: 'Hyp. Tests',    labelAr: 'اختبارات'  },
    { key: 'corr',   icon: <Link2 size={14} />,         label: 'Correlation',   labelAr: 'ارتباط'    },
    { key: 'reg',    icon: <GitMerge size={14} />,      label: 'Regression',    labelAr: 'انحدار'    },
    { key: 'table',  icon: <Table2 size={14} />,        label: 'Data Table',    labelAr: 'جدول'      },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        @keyframes da-spin { to { transform: rotate(360deg); } }
        .da-row:hover { background: rgba(201,168,76,0.04) !important; }
        .da-card:hover { border-color: rgba(201,168,76,0.35) !important; }
        select option { background: #0c1a30; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius:4px; }
      `}</style>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.gold, margin: 0 }}>
            {ar ? '📊 نتائج التحليل الإحصائي' : '📊 Statistical Analysis Results'}
          </h2>
          <p style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
            📄 {fileName} · {rows.length.toLocaleString()} {ar ? 'صف' : 'rows'} · {colStats.length} {ar ? 'عمود' : 'cols'}
            · {numCols.length} {ar ? 'رقمي' : 'numeric'} · {textCols.length} {ar ? 'نصي' : 'text'}
          </p>
        </div>
        <button onClick={() => { setRows([]); setColStats([]); setFileName(''); setParamRes(null); setNpRes(null); setChiRes(null); setRegRes(null); setNormRes([]); }}
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <X size={14} /> {ar ? 'ملف جديد' : 'New File'}
        </button>
      </div>

      {/* view tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#060d1a', borderRadius: 12, padding: 5, border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button key={v.key} style={tabBtn(view === v.key)} onClick={() => setView(v.key)}>
            {v.icon} {ar ? v.labelAr : v.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESCRIPTIVE                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'desc' && (
        <div>
          {/* summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { icon: '📋', label: ar ? 'إجمالي الصفوف' : 'Total Rows',   val: rows.length.toLocaleString() },
              { icon: '📐', label: ar ? 'عدد الأعمدة'   : 'Columns',      val: colStats.length },
              { icon: '🔢', label: ar ? 'أعمدة رقمية'   : 'Numeric',      val: numCols.length },
              { icon: '📝', label: ar ? 'أعمدة نصية'    : 'Text Cols',    val: textCols.length },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(201,168,76,0.06)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{item.val}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* per-column cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {colStats.map((s, idx) => {
              const exp = expandCol === s.col;
              const color = PAL[idx % PAL.length];
              return (
                <div key={s.col} className="da-card" style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}>
                  <button onClick={() => setExpandCol(exp ? null : s.col)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'start', fontFamily: 'inherit' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}66` }} />
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 14, flex: 1 }}>{s.col}</span>
                    <span style={{ background: s.type === 'numeric' ? 'rgba(147,197,253,0.12)' : 'rgba(196,181,253,0.12)', border: `1px solid ${s.type === 'numeric' ? 'rgba(147,197,253,0.3)' : 'rgba(196,181,253,0.3)'}`, color: s.type === 'numeric' ? C.blue : C.purple, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                      {s.type === 'numeric' ? (ar ? 'رقمي' : 'Numeric') : (ar ? 'نصي' : 'Text')}
                    </span>
                    <span style={{ color: C.sub, fontSize: 12 }}>{s.count} {ar ? 'قيمة' : 'values'}</span>
                    <span style={{ color: C.sub, fontSize: 16 }}>{exp ? '▲' : '▼'}</span>
                  </button>

                  {exp && s.type === 'numeric' && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* ── Central Tendency ── */}
                      <SectionTitle>{ar ? 'مقاييس النزعة المركزية' : 'Central Tendency'}</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
                        <StatCard label={ar ? 'المجموع' : 'Sum'}         val={s.sum}    color={color} />
                        <StatCard label={ar ? 'المتوسط' : 'Mean'}        val={s.mean}   color={color} />
                        <StatCard label={ar ? 'الوسيط'  : 'Median'}      val={s.median} color={color} />
                        <StatCard label={ar ? 'المنوال'  : 'Mode'}        val={s.mode}   color={color} />
                      </div>

                      <SectionTitle>{ar ? 'مقاييس التشتت' : 'Dispersion'}</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
                        <StatCard label={ar ? 'التباين' : 'Variance'}           val={s.variance} color={color} />
                        <StatCard label={ar ? 'الانحراف المعياري' : 'Std Dev'} val={s.std}      color={color} />
                        <StatCard label={ar ? 'خطأ المتوسط' : 'SEM'}           val={s.sem}      color={color} />
                        <StatCard label={ar ? 'معامل التباين%' : 'CV %'}       val={s.cv}       color={color} />
                        <StatCard label={ar ? 'الحد الأدنى' : 'Min'}           val={s.min}      color={color} />
                        <StatCard label={ar ? 'الحد الأقصى' : 'Max'}           val={s.max}      color={color} />
                        <StatCard label={ar ? 'المدى' : 'Range'}               val={s.range}    color={color} />
                      </div>

                      <SectionTitle>{ar ? 'الربيعيات' : 'Quartiles'}</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
                        <StatCard label="Q1 (25%)"  val={s.q1}  color={color} />
                        <StatCard label="Q2 (50%)"  val={s.median} color={color} />
                        <StatCard label="Q3 (75%)"  val={s.q3}  color={color} />
                        <StatCard label={ar ? 'المدى الربيعي IQR' : 'IQR'} val={s.iqr} color={color} />
                      </div>

                      <SectionTitle>{ar ? 'الشكل والتوزيع' : 'Shape'}</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? 'الالتواء' : 'Skewness'}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: color }}>{fmt(s.skewness)}</div>
                          <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>
                            {s.skewness !== undefined && !isNaN(s.skewness) && (
                              s.skewness > 1 ? (ar ? 'التواء يميني قوي' : 'Strong right skew')
                              : s.skewness > 0.5 ? (ar ? 'التواء يميني معتدل' : 'Moderate right skew')
                              : s.skewness < -1 ? (ar ? 'التواء يساري قوي' : 'Strong left skew')
                              : s.skewness < -0.5 ? (ar ? 'التواء يساري معتدل' : 'Moderate left skew')
                              : (ar ? 'توزيع قريب من الطبيعي' : 'Near symmetric')
                            )}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{ar ? 'التفرطح' : 'Kurtosis'}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: color }}>{fmt(s.kurtosis)}</div>
                          <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>
                            {s.kurtosis !== undefined && !isNaN(s.kurtosis) && (
                              s.kurtosis > 3 ? (ar ? 'مدبب (leptokurtic)' : 'Leptokurtic')
                              : s.kurtosis < -3 ? (ar ? 'مفلطح (platykurtic)' : 'Platykurtic')
                              : (ar ? 'طبيعي (mesokurtic)' : 'Mesokurtic')
                            )}
                          </div>
                        </div>
                        <StatCard label={ar ? 'القيم المفقودة' : 'Missing'} val={s.missing} color={color} />
                        <StatCard label={ar ? 'نسبة المفقودة %' : 'Missing %'} val={+(s.missing / rows.length * 100).toFixed(2)} color={color} />
                      </div>
                    </div>
                  )}

                  {exp && s.type === 'text' && (
                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <SectionTitle>{ar ? 'إحصاءات النص' : 'Text Statistics'}</SectionTitle>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
                        {[
                          { label: ar ? 'عدد القيم' : 'Count',           val: s.count     },
                          { label: ar ? 'القيم الفريدة' : 'Unique',       val: s.unique    },
                          { label: ar ? 'القيم المفقودة' : 'Missing',     val: s.missing   },
                          { label: ar ? 'أكثر تكراراً' : 'Most Common',  val: s.top       },
                          { label: ar ? 'تكراره' : 'Its Frequency',      val: s.topFreq   },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color, wordBreak: 'break-all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{String(item.val ?? '—')}</div>
                          </div>
                        ))}
                      </div>
                      {s.freqMap && (
                        <>
                          <SectionTitle>{ar ? 'جدول التكرارات (أعلى 10)' : 'Frequency Table (top 10)'}</SectionTitle>
                          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: 'rgba(201,168,76,0.07)' }}>
                                  <th style={{ padding: '8px 14px', color: C.sub, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{ar ? 'القيمة' : 'Value'}</th>
                                  <th style={{ padding: '8px 14px', color: C.sub, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{ar ? 'التكرار' : 'Freq'}</th>
                                  <th style={{ padding: '8px 14px', color: C.sub, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{ar ? 'النسبة %' : '%'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(s.freqMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([v, f]) => (
                                  <tr key={v} className="da-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '7px 14px', color: C.text }}>{v}</td>
                                    <td style={{ padding: '7px 14px', color, fontWeight: 700 }}>{f}</td>
                                    <td style={{ padding: '7px 14px', color: C.sub }}>{(f / s.count * 100).toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARTS                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'charts' && (
        <div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <ColSelect label={ar ? 'العمود' : 'Column'} value={chartCol} onChange={setChartCol} cols={colStats} ar={ar} />
            <div>
              <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6 }}>{ar ? 'نوع الرسم' : 'Chart Type'}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['histogram', 'bar', 'line', 'box'] as const).map(t => (
                  <button key={t} onClick={() => setChartType(t)} style={tabBtn(chartType === t, true)}>
                    {t === 'histogram' ? '📉' : t === 'bar' ? '📊' : t === 'line' ? '📈' : '📦'} {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            const selStat = colStats.find(s => s.col === chartCol);
            const vals = chartCol ? getNum(chartCol) : [];
            const histData = makeHistogram(vals, 14);
            const barData  = rows.slice(0, 50).map((r, i) => ({ name: String(i + 1), value: +(r[chartCol] as number) }));

            if (selStat?.type === 'text' || (!selStat && chartCol)) {
              const freqMap: Record<string, number> = {};
              rows.forEach(r => { const v = String(r[chartCol] ?? ''); if (v) freqMap[v] = (freqMap[v] ?? 0) + 1; });
              const freqData = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count }));
              return (
                <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={freqData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} width={80} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Bar dataKey="count" name={ar ? 'التكرار' : 'Count'} radius={[0, 4, 4, 0]}>
                        {freqData.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            }

            // box plot approximation
            if (chartType === 'box' && selStat && vals.length) {
              const s = sortAsc(vals);
              const q1 = quantile(s, 0.25), q2 = quantile(s, 0.5), q3 = quantile(s, 0.75);
              const iqr = q3 - q1;
              const lo = Math.max(s[0], q1 - 1.5 * iqr), hi = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
              const boxData = [{ name: chartCol, low: lo, q1, median: q2, q3, high: hi }];
              return (
                <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                    {[{ label: 'Min', val: fmt(s[0]) }, { label: 'Q1', val: fmt(q1) }, { label: 'Median', val: fmt(q2) }, { label: 'Q3', val: fmt(q3) }, { label: 'Max', val: fmt(s[s.length - 1]) }, { label: 'IQR', val: fmt(iqr) }]
                      .map(item => (
                        <div key={item.label}>
                          <div style={{ fontSize: 10, color: C.sub }}>{item.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{item.val}</div>
                        </div>
                      ))}
                  </div>
                  {/* simplified box representation */}
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={boxData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Bar dataKey="low"    stackId="box" fill="transparent" />
                      <Bar dataKey="q1"     stackId="box" fill="rgba(201,168,76,0.15)" stroke={C.gold} strokeWidth={1} />
                      <Bar dataKey="median" stackId="box" fill={C.gold} />
                      <Bar dataKey="q3"     stackId="box" fill="rgba(201,168,76,0.15)" stroke={C.gold} strokeWidth={1} />
                      <Bar dataKey="high"   stackId="box" fill="transparent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            }

            return (
              <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                {selStat && (
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                    {[{ l: ar ? 'متوسط' : 'Mean', v: selStat.mean }, { l: ar ? 'وسيط' : 'Median', v: selStat.median }, { l: ar ? 'انحراف' : 'Std', v: selStat.std }, { l: 'Min', v: selStat.min }, { l: 'Max', v: selStat.max }].map(item => (
                      <div key={item.l}><div style={{ fontSize: 10, color: C.sub }}>{item.l}</div><div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{fmt(item.v)}</div></div>
                    ))}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={320}>
                  {chartType === 'histogram' ? (
                    <BarChart data={histData} margin={{ top: 8, right: 16, bottom: 8, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="x" tick={{ fill: C.sub, fontSize: 10 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} labelStyle={{ color: C.gold }} />
                      <Bar dataKey="count" name={ar ? 'التكرار' : 'Frequency'} radius={[3, 3, 0, 0]}>
                        {histData.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
                      </Bar>
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Line type="monotone" dataKey="value" stroke={C.gold} strokeWidth={2} dot={false} name={chartCol} />
                      {selStat?.mean !== undefined && <ReferenceLine y={selStat.mean} stroke={C.blue} strokeDasharray="4 2" label={{ value: 'μ', fill: C.blue, fontSize: 11 }} />}
                    </LineChart>
                  ) : (
                    <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 11 }} />
                      <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                      <Bar dataKey="value" name={chartCol} radius={[3, 3, 0, 0]}>
                        {barData.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* scatter plot */}
          {numCols.length >= 2 && (
            <div style={{ marginTop: 20 }}>
              <SectionTitle>{ar ? 'مخطط التشتت' : 'Scatter Plot'}</SectionTitle>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <ColSelect label={ar ? 'المحور السيني X' : 'X Axis'} value={scatter1} onChange={setScatter1} cols={numCols} ar={ar} />
                <ColSelect label={ar ? 'المحور الصادي Y' : 'Y Axis'} value={scatter2} onChange={setScatter2} cols={numCols} ar={ar} />
              </div>
              {scatter1 && scatter2 && scatter1 !== scatter2 && (() => {
                const xs = getNum(scatter1), ys = getNum(scatter2);
                const n  = Math.min(xs.length, ys.length);
                const scData = Array.from({ length: n }, (_, i) => ({ x: xs[i], y: ys[i] }));
                const r = pearsonR(xs.slice(0, n), ys.slice(0, n));
                const p = corrTest(r, n);
                return (
                  <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ color: C.sub, fontSize: 13 }}>Pearson r = <strong style={{ color: C.gold }}>{fmt(r)}</strong></span>
                      <ResultBadge p={p} />
                      <span style={{ fontSize: 12, color: pColor(p), fontWeight: 700 }}>{pLabel(p, ar)}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="x" name={scatter1} tick={{ fill: C.sub, fontSize: 11 }} label={{ value: scatter1, position: 'bottom', fill: C.sub, fontSize: 11 }} />
                        <YAxis dataKey="y" name={scatter2} tick={{ fill: C.sub, fontSize: 11 }} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                        <Scatter data={scData} fill={C.gold} fillOpacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HYPOTHESIS TESTS                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'tests' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {([
              { k: 'normality', arL: 'اختبارات الاعتدالية', enL: 'Normality' },
              { k: 'param',     arL: 'معلمية',              enL: 'Parametric' },
              { k: 'nonparam',  arL: 'لامعلمية',            enL: 'Non-Param.' },
              { k: 'chisq',     arL: 'مربع كاي',            enL: 'Chi-Square' },
            ] as { k: TestSub; arL: string; enL: string }[]).map(t => (
              <button key={t.k} style={tabBtn(testSub === t.k, true)} onClick={() => setTestSub(t.k)}>
                {ar ? t.arL : t.enL}
              </button>
            ))}
          </div>

          {/* ── NORMALITY ── */}
          {testSub === 'normality' && (
            <div>
              <p style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>
                {ar ? 'اختبار ما إذا كانت البيانات تتبع توزيعاً طبيعياً' : 'Test whether data follows a normal distribution (H₀: data is normally distributed)'}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
                <ColSelect label={ar ? 'اختر عموداً رقمياً' : 'Numeric column'} value={normCol} onChange={setNormCol} cols={numCols} ar={ar} />
                <RunBtn ar={ar} onClick={() => {
                  if (!normCol) return;
                  const vals = getNum(normCol);
                  if (vals.length < 5) return;
                  setNormRes([shapiroFrancia(vals), ksNormality(vals)]);
                }} />
              </div>
              {normRes.map(r => (
                <div key={r.test} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{ar ? r.testAr : r.test}</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ color: C.sub, fontSize: 13 }}>W/D = <strong style={{ color: C.blue }}>{fmt(r.statistic)}</strong></span>
                      <ResultBadge p={r.pValue} />
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: r.isNormal ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${r.isNormal ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`, fontSize: 13, color: C.text }}>
                    {ar
                      ? (r.isNormal ? '✅ لا يُرفض H₀: البيانات تتبع توزيعاً طبيعياً (p > 0.05)' : '❌ يُرفض H₀: البيانات لا تتبع توزيعاً طبيعياً (p ≤ 0.05)')
                      : (r.isNormal ? '✅ Fail to reject H₀: data is normally distributed (p > 0.05)' : '❌ Reject H₀: data is not normally distributed (p ≤ 0.05)') }
                  </div>
                </div>
              ))}
              {normRes.length === 0 && (
                <div style={{ textAlign: 'center', color: C.sub, padding: 40, fontSize: 14 }}>
                  {ar ? 'اختر عموداً رقمياً وانقر "تشغيل الاختبار"' : 'Select a numeric column and click Run Test'}
                </div>
              )}
            </div>
          )}

          {/* ── PARAMETRIC ── */}
          {testSub === 'param' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: C.sub, marginBottom: 6, display: 'block' }}>{ar ? 'نوع الاختبار' : 'Test Type'}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { k: 'one-t', arL: 'اختبار t أحادي', enL: 'One-sample t' },
                    { k: 'two-t', arL: 'اختبار t مستقل', enL: 'Two-sample t' },
                    { k: 'paired-t', arL: 'اختبار t مرتبط', enL: 'Paired t' },
                    { k: 'anova', arL: 'ANOVA أحادي', enL: 'One-way ANOVA' },
                  ] as { k: ParamTest; arL: string; enL: string }[]).map(t => (
                    <button key={t.k} style={tabBtn(paramTest === t.k, true)} onClick={() => { setParamTest(t.k); setParamRes(null); }}>
                      {ar ? t.arL : t.enL}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {paramTest === 'one-t' && (
                    <>
                      <ColSelect label={ar ? 'العمود' : 'Column'} value={pCol1} onChange={setPCol1} cols={numCols} ar={ar} />
                      <div style={{ minWidth: 120 }}>
                        <label style={{ display: 'block', fontSize: 12, color: C.sub, marginBottom: 6 }}>μ₀</label>
                        <input type="number" value={mu0} onChange={e => setMu0(e.target.value)}
                          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: '9px 14px', fontSize: 13, width: '100%', fontFamily: 'inherit' }} />
                      </div>
                      <RunBtn ar={ar} onClick={() => {
                        if (!pCol1) return;
                        setParamRes(oneSampleT(getNum(pCol1), +mu0));
                      }} />
                    </>
                  )}
                  {(paramTest === 'two-t' || paramTest === 'paired-t') && (
                    <>
                      <ColSelect label={ar ? 'المجموعة 1' : 'Group 1'} value={pCol1} onChange={setPCol1} cols={numCols} ar={ar} />
                      <ColSelect label={ar ? 'المجموعة 2' : 'Group 2'} value={pCol2} onChange={setPCol2} cols={numCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!pCol1 || !pCol2) return;
                        const a = getNum(pCol1), b = getNum(pCol2);
                        const n = Math.min(a.length, b.length);
                        setParamRes(paramTest === 'two-t' ? twoSampleT(a, b) : pairedT(a.slice(0, n), b.slice(0, n)));
                      }} />
                    </>
                  )}
                  {paramTest === 'anova' && (
                    <>
                      <ColSelect label={ar ? 'عمود القيم' : 'Values column'} value={groupValCol} onChange={setGroupValCol} cols={numCols} ar={ar} />
                      <ColSelect label={ar ? 'عمود المجموعات' : 'Group column'} value={groupLabelCol} onChange={setGroupLabelCol} cols={textCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!groupValCol || !groupLabelCol) return;
                        const groupMap: Record<string, number[]> = {};
                        rows.forEach(r => {
                          const g = String(r[groupLabelCol] ?? ''); const v = +(r[groupValCol] as number);
                          if (g && !isNaN(v)) { groupMap[g] = groupMap[g] ?? []; groupMap[g].push(v); }
                        });
                        const groups = Object.values(groupMap).filter(g => g.length >= 2);
                        if (groups.length < 2) return;
                        setParamRes(oneWayANOVA(groups));
                      }} />
                    </>
                  )}
                </div>
              </div>
              {paramRes ? <HTestCard res={paramRes} ar={ar} /> : (
                <div style={{ textAlign: 'center', color: C.sub, padding: 32, fontSize: 14 }}>
                  {ar ? 'اضبط المعاملات وانقر "تشغيل الاختبار"' : 'Configure parameters and click Run Test'}
                </div>
              )}
            </div>
          )}

          {/* ── NON-PARAMETRIC ── */}
          {testSub === 'nonparam' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: C.sub, marginBottom: 6, display: 'block' }}>{ar ? 'نوع الاختبار' : 'Test Type'}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { k: 'mann',     arL: 'مان-ويتني U',      enL: 'Mann-Whitney U' },
                    { k: 'wilcoxon', arL: 'ويلكوكسون',        enL: 'Wilcoxon' },
                    { k: 'kruskal',  arL: 'كروسكال-واليس',   enL: 'Kruskal-Wallis' },
                  ] as { k: NonParamTest; arL: string; enL: string }[]).map(t => (
                    <button key={t.k} style={tabBtn(npTest === t.k, true)} onClick={() => { setNpTest(t.k); setNpRes(null); }}>
                      {ar ? t.arL : t.enL}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {(npTest === 'mann' || npTest === 'wilcoxon') && (
                    <>
                      <ColSelect label={ar ? 'المجموعة 1' : 'Group 1'} value={npCol1} onChange={setNpCol1} cols={numCols} ar={ar} />
                      <ColSelect label={ar ? 'المجموعة 2' : 'Group 2'} value={npCol2} onChange={setNpCol2} cols={numCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!npCol1 || !npCol2) return;
                        const a = getNum(npCol1), b = getNum(npCol2);
                        const n = Math.min(a.length, b.length);
                        setNpRes(npTest === 'mann' ? mannWhitneyU(a, b) : wilcoxonSignedRank(a.slice(0, n), b.slice(0, n)));
                      }} />
                    </>
                  )}
                  {npTest === 'kruskal' && (
                    <>
                      <ColSelect label={ar ? 'عمود القيم' : 'Values'} value={npGrpVal} onChange={setNpGrpVal} cols={numCols} ar={ar} />
                      <ColSelect label={ar ? 'عمود المجموعات' : 'Groups'} value={npGrpLbl} onChange={setNpGrpLbl} cols={textCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!npGrpVal || !npGrpLbl) return;
                        const gm: Record<string, number[]> = {};
                        rows.forEach(r => {
                          const g = String(r[npGrpLbl] ?? ''); const v = +(r[npGrpVal] as number);
                          if (g && !isNaN(v)) { gm[g] = gm[g] ?? []; gm[g].push(v); }
                        });
                        const gs = Object.values(gm).filter(g => g.length >= 2);
                        if (gs.length < 2) return;
                        setNpRes(kruskalWallis(gs));
                      }} />
                    </>
                  )}
                </div>
              </div>
              {npRes ? <HTestCard res={npRes} ar={ar} /> : (
                <div style={{ textAlign: 'center', color: C.sub, padding: 32, fontSize: 14 }}>
                  {ar ? 'اضبط المعاملات وانقر "تشغيل الاختبار"' : 'Configure parameters and click Run Test'}
                </div>
              )}
            </div>
          )}

          {/* ── CHI-SQUARE ── */}
          {testSub === 'chisq' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { k: 'independence', arL: 'استقلالية', enL: 'Independence' },
                    { k: 'gof',          arL: 'حسن الملاءمة', enL: 'Goodness of Fit' },
                  ] as { k: ChiTest; arL: string; enL: string }[]).map(t => (
                    <button key={t.k} style={tabBtn(chiTest === t.k, true)} onClick={() => { setChiTest(t.k); setChiRes(null); }}>
                      {ar ? t.arL : t.enL}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {chiTest === 'independence' && (
                    <>
                      <ColSelect label={ar ? 'المتغير 1' : 'Variable 1'} value={chiCol1} onChange={setChiCol1} cols={textCols} ar={ar} />
                      <ColSelect label={ar ? 'المتغير 2' : 'Variable 2'} value={chiCol2} onChange={setChiCol2} cols={textCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!chiCol1 || !chiCol2) return;
                        const cats1 = [...new Set(rows.map(r => String(r[chiCol1] ?? '')))].filter(Boolean);
                        const cats2 = [...new Set(rows.map(r => String(r[chiCol2] ?? '')))].filter(Boolean);
                        const obs = cats1.map(c1 => cats2.map(c2 =>
                          rows.filter(r => String(r[chiCol1]) === c1 && String(r[chiCol2]) === c2).length
                        ));
                        if (obs.length < 2 || obs[0].length < 2) return;
                        setChiRes(chiSquareIndependence(obs));
                      }} />
                    </>
                  )}
                  {chiTest === 'gof' && (
                    <>
                      <ColSelect label={ar ? 'عمود الفئات' : 'Category column'} value={chiCol1} onChange={setChiCol1} cols={textCols} ar={ar} />
                      <RunBtn ar={ar} onClick={() => {
                        if (!chiCol1) return;
                        const fm: Record<string, number> = {};
                        rows.forEach(r => { const v = String(r[chiCol1] ?? ''); if (v) fm[v] = (fm[v] ?? 0) + 1; });
                        const observed = Object.values(fm);
                        if (observed.length < 2) return;
                        setChiRes(chiSquareGoodnessOfFit(observed));
                      }} />
                    </>
                  )}
                </div>
              </div>
              {chiRes ? <HTestCard res={chiRes} ar={ar} /> : (
                <div style={{ textAlign: 'center', color: C.sub, padding: 32, fontSize: 14 }}>
                  {ar ? 'اضبط المعاملات وانقر "تشغيل الاختبار"' : 'Configure parameters and click Run Test'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CORRELATION                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'corr' && (
        <div>
          {numCols.length < 2 ? (
            <div style={{ textAlign: 'center', color: C.sub, padding: 60, fontSize: 14 }}>
              {ar ? 'يحتاج تحليل الارتباط إلى عمودين رقميين على الأقل' : 'Correlation analysis requires at least 2 numeric columns'}
            </div>
          ) : (() => {
            const cols = numCols.slice(0, 12).map(s => ({ name: s.col, vals: getNum(s.col) }));
            const mat  = correlationMatrix(cols, corrMethod);
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                  <span style={{ color: C.sub, fontSize: 13 }}>{ar ? 'طريقة الحساب:' : 'Method:'}</span>
                  <button style={tabBtn(corrMethod === 'pearson', true)} onClick={() => setCorrMethod('pearson')}>Pearson</button>
                  <button style={tabBtn(corrMethod === 'spearman', true)} onClick={() => setCorrMethod('spearman')}>Spearman</button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '10px 14px', color: C.sub, background: 'rgba(201,168,76,0.07)', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'start' }}>
                          {ar ? 'العمود' : 'Column'}
                        </th>
                        {cols.map((c, i) => (
                          <th key={c.name} style={{ padding: '10px 12px', color: PAL[i % PAL.length], background: 'rgba(201,168,76,0.07)', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cols.map((ci, i) => (
                        <tr key={ci.name} className="da-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 14px', color: PAL[i % PAL.length], fontWeight: 700, whiteSpace: 'nowrap' }}>{ci.name}</td>
                          {mat[i].map((cell: CorrCell, j) => {
                            const isDiag = i === j;
                            const absR = Math.abs(cell.r);
                            const hue = cell.r > 0 ? `rgba(74,222,128,${absR * 0.5})` : `rgba(239,68,68,${absR * 0.5})`;
                            return (
                              <td key={j} style={{
                                padding: '8px 12px', textAlign: 'center',
                                background: isDiag ? 'rgba(201,168,76,0.12)' : hue,
                                fontWeight: isDiag ? 800 : 600,
                                color: isDiag ? C.gold : absR > 0.5 ? C.text : C.sub,
                              }}>
                                <div style={{ fontSize: 13 }}>{isDiag ? '1.00' : fmt(cell.r, 3)}</div>
                                {!isDiag && <div style={{ fontSize: 10, color: pColor(cell.p), marginTop: 2 }}>{pFmt(cell.p)}</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, fontSize: 11, color: C.sub }}>
                  <span style={{ color: 'rgba(74,222,128,0.8)' }}>■ {ar ? 'ارتباط موجب' : 'Positive correlation'}</span>
                  <span style={{ color: 'rgba(239,68,68,0.8)' }}>■ {ar ? 'ارتباط سالب' : 'Negative correlation'}</span>
                  <span>{ar ? 'الأرقام الصغيرة = قيم p' : 'Smaller numbers = p-values'}</span>
                  <span>{ar ? '* p < 0.05 دال إحصائياً' : '* p < 0.05 statistically significant'}</span>
                </div>

                {/* pairwise top correlations */}
                <SectionTitle>{ar ? 'أقوى ارتباطات (|r| > 0.3)' : 'Strongest correlations (|r| > 0.3)'}</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cols.flatMap((ci, i) => cols.slice(i + 1).map((cj, jj) => {
                    const j = i + 1 + jj;
                    const cell = mat[i][j];
                    return { ci: ci.name, cj: cj.name, r: cell.r, p: cell.p };
                  }))
                    .filter(item => Math.abs(item.r) > 0.3)
                    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
                    .slice(0, 10)
                    .map(item => (
                      <div key={`${item.ci}-${item.cj}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{item.ci}</span>
                        <span style={{ color: C.sub }}>↔</span>
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{item.cj}</span>
                        <span style={{ color: item.r > 0 ? C.green : C.red, fontWeight: 800, fontSize: 14 }}>r = {fmt(item.r, 3)}</span>
                        <ResultBadge p={item.p} />
                        <span style={{ fontSize: 11, color: C.sub }}>{Math.abs(item.r) > 0.7 ? (ar ? 'ارتباط قوي' : 'Strong') : Math.abs(item.r) > 0.4 ? (ar ? 'متوسط' : 'Moderate') : (ar ? 'ضعيف' : 'Weak')}</span>
                      </div>
                    ))}
                  {cols.flatMap((ci, i) => cols.slice(i + 1).map((cj, jj) => {
                    const j = i + 1 + jj;
                    const cell = mat[i][j];
                    return { ci: ci.name, cj: cj.name, r: cell.r };
                  })).filter(item => Math.abs(item.r) > 0.3).length === 0 && (
                    <div style={{ color: C.sub, fontSize: 13, padding: 16, textAlign: 'center' }}>
                      {ar ? 'لا توجد ارتباطات تتجاوز |r| > 0.3' : 'No correlations above |r| > 0.3'}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REGRESSION                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'reg' && (
        <div>
          {numCols.length < 2 ? (
            <div style={{ textAlign: 'center', color: C.sub, padding: 60, fontSize: 14 }}>
              {ar ? 'يحتاج الانحدار الخطي إلى عمودين رقميين على الأقل' : 'Linear regression requires at least 2 numeric columns'}
            </div>
          ) : (
            <>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <ColSelect label={ar ? 'المتغير المستقل X' : 'Independent (X)'} value={regX} onChange={setRegX} cols={numCols} ar={ar} />
                  <ColSelect label={ar ? 'المتغير التابع Y'  : 'Dependent (Y)'}   value={regY} onChange={setRegY} cols={numCols} ar={ar} />
                  <RunBtn ar={ar} onClick={() => {
                    if (!regX || !regY || regX === regY) return;
                    const xs = getNum(regX), ys = getNum(regY);
                    const n  = Math.min(xs.length, ys.length);
                    if (n < 3) return;
                    setRegRes(linearRegression(xs.slice(0, n), ys.slice(0, n)));
                  }} />
                </div>
              </div>

              {regRes ? (
                <div>
                  {/* model summary */}
                  <SectionTitle>{ar ? 'ملخص النموذج' : 'Model Summary'}</SectionTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'R²',       val: fmt(regRes.r2, 4),      color: C.gold    },
                      { label: 'Adj. R²',  val: fmt(regRes.adjR2, 4),   color: C.gold    },
                      { label: 'Pearson r',val: fmt(regRes.pearsonR, 4), color: C.blue    },
                      { label: 'F-stat',   val: fmt(regRes.F),          color: C.purple   },
                      { label: 'p(F)',     val: pFmt(regRes.pF),        color: pColor(regRes.pF) },
                      { label: 'n',        val: regRes.n,               color: C.teal     },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{String(item.val)}</div>
                      </div>
                    ))}
                  </div>

                  {/* coefficients */}
                  <SectionTitle>{ar ? 'جدول المعاملات' : 'Coefficients Table'}</SectionTitle>
                  <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(201,168,76,0.07)' }}>
                          {[ar ? 'المتغير' : 'Term', ar ? 'المعامل B' : 'Coeff. B', ar ? 'الخطأ المعياري' : 'Std. Error', ar ? 'قيمة t' : 't-value', ar ? 'قيمة p' : 'p-value', ar ? 'الدلالة' : 'Sig.']
                            .map(h => <th key={h} style={{ padding: '10px 14px', color: C.sub, fontWeight: 700, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { term: ar ? 'الثابت (Intercept)' : 'Intercept', b: regRes.intercept, se: regRes.seIntercept, t: regRes.tIntercept, p: regRes.pIntercept },
                          { term: regX,                                     b: regRes.slope,     se: regRes.seSlope,     t: regRes.tSlope,     p: regRes.pSlope     },
                        ].map(row => (
                          <tr key={row.term} className="da-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '9px 14px', color: C.gold, fontWeight: 700 }}>{row.term}</td>
                            <td style={{ padding: '9px 14px', color: C.text }}>{fmt(row.b)}</td>
                            <td style={{ padding: '9px 14px', color: C.sub }}>{fmt(row.se)}</td>
                            <td style={{ padding: '9px 14px', color: C.blue }}>{fmt(row.t)}</td>
                            <td style={{ padding: '9px 14px' }}><span style={{ color: pColor(row.p), fontWeight: 700 }}>{pFmt(row.p)}</span></td>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: pColor(row.p), fontWeight: 700 }}>{pLabel(row.p, ar)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* equation */}
                  <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(201,168,76,0.07)', border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 14 }}>
                    <span style={{ color: C.sub }}>{ar ? 'معادلة الانحدار: ' : 'Regression equation: '}</span>
                    <strong style={{ color: C.gold }}>
                      Ŷ = {fmt(regRes.intercept)} {regRes.slope >= 0 ? '+' : '−'} {fmt(Math.abs(regRes.slope))} × {regX}
                    </strong>
                  </div>

                  {/* scatter with regression line */}
                  <SectionTitle>{ar ? 'مخطط الانحدار' : 'Regression Plot'}</SectionTitle>
                  {(() => {
                    const xs = getNum(regX), ys = getNum(regY);
                    const n = Math.min(xs.length, ys.length);
                    const scData = Array.from({ length: Math.min(n, 200) }, (_, i) => ({
                      x: xs[i], y: ys[i], fitted: regRes!.fitted[i],
                    }));
                    return (
                      <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="x" name={regX} tick={{ fill: C.sub, fontSize: 11 }} label={{ value: regX, position: 'bottom', fill: C.sub, fontSize: 11 }} />
                            <YAxis dataKey="y" name={regY} tick={{ fill: C.sub, fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                            <Scatter data={scData} fill={C.gold} fillOpacity={0.6} name={ar ? 'ملاحظات' : 'Observations'} />
                            <Scatter data={scData.map(d => ({ x: d.x, y: d.fitted }))} fill={C.red} fillOpacity={0} line={{ stroke: C.red, strokeWidth: 2 }} shape={() => null as unknown as React.ReactElement} name={ar ? 'خط الانحدار' : 'Regression line'} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {/* residuals histogram */}
                  <SectionTitle>{ar ? 'توزيع البواقي' : 'Residuals Distribution'}</SectionTitle>
                  <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px' }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={makeHistogram(regRes.residuals, 12)} margin={{ top: 8, right: 16, bottom: 8, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="x" tick={{ fill: C.sub, fontSize: 10 }} />
                        <YAxis tick={{ fill: C.sub, fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#0c1a30', border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                        <Bar dataKey="count" name={ar ? 'تكرار' : 'Frequency'} radius={[3, 3, 0, 0]}>
                          {makeHistogram(regRes.residuals, 12).map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: C.sub, padding: 60, fontSize: 14 }}>
                  {ar ? 'اختر المتغير المستقل والتابع وانقر "تشغيل الاختبار"' : 'Select X and Y variables and click Run Test'}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DATA TABLE                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(201,168,76,0.08)' }}>
                <th style={{ padding: '10px 14px', color: C.sub, fontWeight: 700, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>#</th>
                {colStats.map((s, i) => (
                  <th key={s.col} style={{ padding: '10px 14px', color: PAL[i % PAL.length], fontWeight: 700, textAlign: 'start', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{s.col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, ri) => (
                <tr key={ri} className="da-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 14px', color: C.sub, fontSize: 11 }}>{ri + 1}</td>
                  {colStats.map(s => (
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
