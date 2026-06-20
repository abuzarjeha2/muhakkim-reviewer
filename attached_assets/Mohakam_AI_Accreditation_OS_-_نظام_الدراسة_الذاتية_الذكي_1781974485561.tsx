import { useState, useEffect, useMemo, useRef } from "react";
import { LayoutDashboard, FileText, Upload, CheckCircle2, BarChart3, Search, FolderTree, PenLine, Sparkles, AlertTriangle, Download, Trash2, Plus, Loader2, X, ChevronRight, Languages, ClipboardCheck, TrendingUp, FileCheck2, Save, Cloud, CloudOff, UserCheck, MessageSquare, Award } from "lucide-react";

// ============= نظام الحفظ الدائم =============
async function storeGet(key, fallback) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function storeSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

// ============= بيانات المعايير (NCAAA - 8 معايير) =============
const STANDARDS = [
  { id: 1, code: "1", name: "الرؤية والرسالة والتخطيط الاستراتيجي", nameEn: "Vision, Mission & Strategic Planning", criteria: ["1.0.1","1.0.2","1.0.3"] },
  { id: 2, code: "2", name: "الحوكمة والقيادة والإدارة", nameEn: "Governance, Leadership & Management", criteria: ["2.1.1","2.1.2","2.1.3","2.1.4","2.2.1","2.2.2","2.2.3","2.2.4","2.3.1","2.3.2","2.4.1","2.4.2","2.4.3","2.4.4","2.4.5","2.4.6","2.4.7","2.5.1","2.5.2","2.5.3"] },
  { id: 3, code: "3", name: "التعليم والتعلم", nameEn: "Teaching & Learning", criteria: ["3.1.1","3.1.2","3.1.3","3.1.4","3.1.5","3.2.1","3.2.2","3.3.1","3.3.2","3.3.3","3.6.1","3.6.2","3.6.3","3.6.4"] },
  { id: 4, code: "4", name: "الطلبة", nameEn: "Students", criteria: ["4.1.1","4.1.2","4.1.3","4.1.4","4.1.5","4.2.1","4.2.2","4.2.3","4.3.1","4.3.2","4.3.3","4.3.4","4.5.1","4.5.2","4.5.3","4.5.4","4.5.5","4.6.1","4.6.2"] },
  { id: 5, code: "5", name: "أعضاء هيئة التدريس والموظفون", nameEn: "Faculty & Staff", criteria: ["5.1.1","5.1.2","5.1.3","5.1.4","5.1.5","5.2.1","5.2.2","5.2.3","5.2.4"] },
  { id: 6, code: "6", name: "مصادر المؤسسة", nameEn: "Institutional Resources", criteria: ["6.1.1","6.1.2","6.1.3","6.1.4","6.2.1","6.2.2","6.2.3","6.2.4","6.2.5","6.2.6","6.3.1","6.3.2","6.3.3","6.3.4","6.3.5","6.4.1","6.4.2","6.4.3","6.4.4"] },
  { id: 7, code: "7", name: "البحث والابتكار", nameEn: "Research & Innovation", criteria: ["7.1.1","7.1.2","7.1.3","7.1.4","7.1.5","7.2.1","7.2.2","7.2.3","7.2.4","7.2.5","7.2.6"] },
  { id: 8, code: "8", name: "الشراكة المجتمعية", nameEn: "Community Partnership", criteria: ["8.0.1","8.0.2","8.0.3"] },
];

const COMPLIANCE_LABELS = { 0: "غير مقيّم", 1: "عدم التزام", 2: "التزام جزئي", 3: "التزام كبير", 4: "التزام كامل" };
const COMPLIANCE_COLORS = { 0: "#64748b", 1: "#dc2626", 2: "#f59e0b", 3: "#3b82f6", 4: "#16a34a" };

// ألوان الهوية
const C = { navy: "#0f1f3d", navy2: "#1a3057", gold: "#c9a227", goldL: "#e3c659", bg: "#f4f6fb", card: "#ffffff" };

// ============= استدعاء الذكاء الاصطناعي =============
async function callAI(prompt, system = "") {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: (system ? system + "\n\n" : "") + prompt }],
      }),
    });
    const data = await res.json();
    return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  } catch (e) {
    return "حدث خطأ في الاتصال بالذكاء الاصطناعي: " + e.message;
  }
}

async function callAIJson(prompt, system = "") {
  const txt = await callAI(prompt, system + "\nأجب فقط بصيغة JSON صالحة دون أي نص إضافي أو علامات markdown.");
  try {
    const s = txt.indexOf("{"); const e = txt.lastIndexOf("}");
    const a = txt.indexOf("["); 
    if (a !== -1 && (a < s || s === -1)) {
      const ae = txt.lastIndexOf("]");
      return JSON.parse(txt.slice(a, ae + 1));
    }
    return JSON.parse(txt.slice(s, e + 1));
  } catch {
    return null;
  }
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // saved | saving | error
  const [evaluations, setEvaluations] = useState(() => {
    const init = {};
    STANDARDS.forEach(s => s.criteria.forEach(c => { init[c] = { score: 0, comment: "" }; }));
    return init;
  });
  const [evidence, setEvidence] = useState([]);
  const [kpis, setKpis] = useState([
    { id: 1, name: "تقييم الطلبة لجودة الخبرة التعليمية", actual: 4.6, target: 4.5, internal: 4.4, external: 4.22 },
    { id: 2, name: "رضا المستفيدين عن مصادر التعلم", actual: 4.3, target: 3.8, internal: 4.1, external: 3.87 },
    { id: 3, name: "نسبة أعضاء هيئة التدريس للطلاب", actual: 5.5, target: 6.0, internal: 7.0, external: 8.0 },
  ]);
  const [ssrSections, setSsrSections] = useState({});
  const [mockResults, setMockResults] = useState({});
  const [collegeInfo, setCollegeInfo] = useState({ name: "كلية الغد للعلوم الطبية التطبيقية", program: "", date: new Date().toLocaleDateString("ar-SA") });

  // تحميل البيانات المحفوظة عند بدء التشغيل
  useEffect(() => {
    (async () => {
      const data = await storeGet("mohakam_data", null);
      if (data) {
        if (data.evaluations) setEvaluations(data.evaluations);
        if (data.evidence) setEvidence(data.evidence);
        if (data.kpis) setKpis(data.kpis);
        if (data.ssrSections) setSsrSections(data.ssrSections);
        if (data.mockResults) setMockResults(data.mockResults);
        if (data.collegeInfo) setCollegeInfo(data.collegeInfo);
      }
      setLoaded(true);
    })();
  }, []);

  // الحفظ التلقائي عند أي تغيير (بعد التحميل الأولي)
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await storeSet("mohakam_data", { evaluations, evidence, kpis, ssrSections, mockResults, collegeInfo });
      setSaveStatus(ok ? "saved" : "error");
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [evaluations, evidence, kpis, ssrSections, mockResults, collegeInfo, loaded]);

  // إحصائيات لوحة القيادة
  const stats = useMemo(() => {
    const allCriteria = STANDARDS.flatMap(s => s.criteria);
    const evaluated = allCriteria.filter(c => evaluations[c]?.score > 0).length;
    const withEvidence = new Set(evidence.map(e => e.criterion)).size;
    const standardAverages = STANDARDS.map(s => {
      const scores = s.criteria.map(c => evaluations[c]?.score || 0).filter(x => x > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { ...s, avg: avg, rating: Math.round(avg) };
    });
    const ssrDone = Object.keys(ssrSections).filter(k => ssrSections[k]).length;
    return {
      totalCriteria: allCriteria.length,
      evaluated,
      progressPct: Math.round((evaluated / allCriteria.length) * 100),
      evidenceCount: evidence.length,
      criteriaWithEvidence: withEvidence,
      evidencePct: Math.round((withEvidence / allCriteria.length) * 100),
      standardAverages,
      overallAvg: standardAverages.filter(s => s.avg > 0).length ? (standardAverages.reduce((a, s) => a + s.avg, 0) / standardAverages.filter(s => s.avg > 0).length).toFixed(2) : "0",
      ssrDone,
    };
  }, [evaluations, evidence, ssrSections]);

  const NAV = [
    { id: "dashboard", name: "لوحة القيادة", icon: LayoutDashboard },
    { id: "standards", name: "إدارة المعايير", icon: FolderTree },
    { id: "evidence", name: "رفع الأدلة", icon: Upload },
    { id: "review", name: "مراجعة الأدلة بالذكاء", icon: ClipboardCheck },
    { id: "kpis", name: "حساب المؤشرات", icon: BarChart3 },
    { id: "gap", name: "تحليل الفجوات", icon: AlertTriangle },
    { id: "language", name: "تحسين اللغة", icon: Languages },
    { id: "ssr", name: "كتابة SSR", icon: PenLine },
    { id: "mock", name: "الزيارة التجريبية", icon: UserCheck },
    { id: "final", name: "التحقق النهائي", icon: FileCheck2 },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "Tajawal, system-ui, sans-serif", background: C.bg, minHeight: "100vh", display: "flex", color: C.navy }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        *{box-sizing:border-box} ::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:${C.gold};border-radius:4px}
        .glass{background:rgba(255,255,255,.9);backdrop-filter:blur(10px)} .fade{animation:f .4s ease} @keyframes f{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {!loaded && (
        <div style={{ position: "fixed", inset: 0, background: `linear-gradient(135deg,${C.navy},${C.navy2})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999, gap: 16, color: "#fff" }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.navy, fontSize: 28 }}>م</div>
          <Loader2 size={28} color={C.goldL} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ color: C.goldL, fontSize: 14 }}>جاري تحميل بياناتك المحفوظة...</div>
        </div>
      )}

      {/* الشريط الجانبي */}
      <aside style={{ width: 260, background: `linear-gradient(180deg,${C.navy},${C.navy2})`, color: "#fff", padding: "20px 0", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid rgba(201,162,39,.3)`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.navy, fontSize: 20 }}>م</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>محكّم AI</div>
              <div style={{ fontSize: 11, color: C.goldL }}>نظام الاعتماد الذكي</div>
            </div>
          </div>
        </div>
        {NAV.map(n => {
          const Icon = n.icon; const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: active ? `linear-gradient(90deg,rgba(201,162,39,.25),transparent)` : "transparent", border: "none", borderRight: active ? `3px solid ${C.gold}` : "3px solid transparent", color: active ? C.goldL : "#cdd5e0", cursor: "pointer", fontSize: 14, fontFamily: "inherit", fontWeight: active ? 700 : 500, transition: ".2s" }}>
              <Icon size={19} /> {n.name}
            </button>
          );
        })}
        <div style={{ padding: 16, margin: "16px 12px 0", background: "rgba(201,162,39,.1)", borderRadius: 12, fontSize: 12, color: "#cdd5e0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>الإنجاز الكلي</span><span style={{ color: C.goldL, fontWeight: 700 }}>{stats.progressPct}%</span></div>
          <div style={{ height: 6, background: "rgba(255,255,255,.15)", borderRadius: 3 }}><div style={{ height: "100%", width: stats.progressPct + "%", background: `linear-gradient(90deg,${C.gold},${C.goldL})`, borderRadius: 3, transition: ".5s" }} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 11 }}>
            {saveStatus === "saving" && <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ...</>}
            {saveStatus === "saved" && <><Cloud size={13} color="#4ade80" /> <span style={{ color: "#4ade80" }}>محفوظ تلقائياً</span></>}
            {saveStatus === "error" && <><CloudOff size={13} color="#f87171" /> <span style={{ color: "#f87171" }}>خطأ في الحفظ</span></>}
          </div>
        </div>
      </aside>

      {/* المحتوى */}
      <main style={{ flex: 1, padding: "24px 32px", overflowX: "hidden" }}>
        {tab === "dashboard" && <Dashboard stats={stats} collegeInfo={collegeInfo} setCollegeInfo={setCollegeInfo} />}
        {tab === "standards" && <Standards evaluations={evaluations} setEvaluations={setEvaluations} evidence={evidence} />}
        {tab === "evidence" && <Evidence evidence={evidence} setEvidence={setEvidence} />}
        {tab === "review" && <Review evidence={evidence} setEvidence={setEvidence} />}
        {tab === "kpis" && <KPIs kpis={kpis} setKpis={setKpis} />}
        {tab === "gap" && <GapAnalysis stats={stats} evaluations={evaluations} />}
        {tab === "language" && <LanguageTool />}
        {tab === "ssr" && <SSRWriter ssrSections={ssrSections} setSsrSections={setSsrSections} stats={stats} collegeInfo={collegeInfo} kpis={kpis} />}
        {tab === "mock" && <MockVisit mockResults={mockResults} setMockResults={setMockResults} evaluations={evaluations} evidence={evidence} collegeInfo={collegeInfo} />}
        {tab === "final" && <FinalCheck stats={stats} evidence={evidence} ssrSections={ssrSections} kpis={kpis} />}
      </main>
    </div>
  );
}

// ============= مكونات مشتركة =============
function Header({ icon: Icon, title, sub }) {
  return (
    <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg,${C.navy},${C.navy2})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={24} color={C.goldL} /></div>
      <div><h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1><p style={{ margin: "2px 0 0", color: "#64748b", fontSize: 14 }}>{sub}</p></div>
    </div>
  );
}
function Card({ children, style }) { return <div className="glass fade" style={{ background: C.card, borderRadius: 16, padding: 20, boxShadow: "0 2px 16px rgba(15,31,61,.06)", border: "1px solid #eef1f6", ...style }}>{children}</div>; }
function Btn({ children, onClick, disabled, variant = "primary", style }) {
  const styles = { primary: { background: `linear-gradient(135deg,${C.navy},${C.navy2})`, color: "#fff" }, gold: { background: `linear-gradient(135deg,${C.gold},${C.goldL})`, color: C.navy }, ghost: { background: "#fff", color: C.navy, border: `1px solid ${C.navy}` } };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "10px 18px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, opacity: disabled ? .6 : 1, display: "inline-flex", alignItems: "center", gap: 8, transition: ".2s", ...styles[variant], ...style }}>{children}</button>;
}

// ============= 1. لوحة القيادة =============
function Dashboard({ stats, collegeInfo, setCollegeInfo }) {
  const cards = [
    { label: "نسبة إنجاز الدراسة", val: stats.progressPct + "%", icon: TrendingUp, c: C.gold },
    { label: "المعايير المقيّمة", val: `${stats.evaluated}/${stats.totalCriteria}`, icon: CheckCircle2, c: "#16a34a" },
    { label: "الأدلة المرفوعة", val: stats.evidenceCount, icon: FileText, c: "#3b82f6" },
    { label: "نسبة اكتمال الأدلة", val: stats.evidencePct + "%", icon: FolderTree, c: "#8b5cf6" },
    { label: "التقييم العام", val: stats.overallAvg, icon: BarChart3, c: C.navy },
    { label: "أقسام SSR المكتملة", val: stats.ssrDone, icon: PenLine, c: "#ec4899" },
  ];
  return (
    <div>
      <Header icon={LayoutDashboard} title="لوحة القيادة التنفيذية" sub="نظرة شاملة على جاهزية الدراسة الذاتية للاعتماد" />
      <Card style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>اسم المؤسسة</label>
          <input value={collegeInfo.name} onChange={e => setCollegeInfo({ ...collegeInfo, name: e.target.value })} style={inp} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>البرنامج الأكاديمي</label>
          <input value={collegeInfo.program} onChange={e => setCollegeInfo({ ...collegeInfo, program: e.target.value })} placeholder="مثال: بكالوريوس التمريض" style={inp} />
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
        {cards.map((c, i) => { const Icon = c.icon; return (
          <Card key={i} style={{ borderTop: `3px solid ${c.c}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{c.label}</div><div style={{ fontSize: 30, fontWeight: 800, color: c.c }}>{c.val}</div></div>
              <Icon size={22} color={c.c} style={{ opacity: .5 }} />
            </div>
          </Card>
        ); })}
      </div>
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 18 }}>حالة المعايير الثمانية</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.standardAverages.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, color: C.goldL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{s.code}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COMPLIANCE_COLORS[s.rating] }}>{s.avg > 0 ? s.avg.toFixed(2) : "—"} {s.rating > 0 && `(${COMPLIANCE_LABELS[s.rating]})`}</span>
                </div>
                <div style={{ height: 8, background: "#eef1f6", borderRadius: 4 }}><div style={{ height: "100%", width: (s.avg / 4 * 100) + "%", background: COMPLIANCE_COLORS[s.rating] || C.gold, borderRadius: 4, transition: ".5s" }} /></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============= 2. إدارة المعايير =============
function Standards({ evaluations, setEvaluations, evidence }) {
  const [open, setOpen] = useState(1);
  const setScore = (c, score) => setEvaluations(p => ({ ...p, [c]: { ...p[c], score } }));
  const setComment = (c, comment) => setEvaluations(p => ({ ...p, [c]: { ...p[c], comment } }));
  return (
    <div>
      <Header icon={FolderTree} title="إدارة المعايير" sub="تقييم جميع المعايير الفرعية وعناصر التقييم حسب معايير الاعتماد NCAAA" />
      {STANDARDS.map(s => {
        const scores = s.criteria.map(c => evaluations[c]?.score || 0).filter(x => x > 0);
        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—";
        return (
          <Card key={s.id} style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
            <button onClick={() => setOpen(open === s.id ? 0 : s.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 18, background: open === s.id ? "#f8f9fc" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${C.navy},${C.navy2})`, color: C.goldL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{s.code}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div><div style={{ fontSize: 12, color: "#94a3b8" }}>{s.nameEn} · {s.criteria.length} معيار فرعي</div></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, marginLeft: 8 }}>{avg}</div>
              <ChevronRight size={20} color="#94a3b8" style={{ transform: open === s.id ? "rotate(90deg)" : "rotate(0)", transition: ".3s" }} />
            </button>
            {open === s.id && (
              <div style={{ padding: "0 18px 18px" }}>
                {s.criteria.map(c => {
                  const evCount = evidence.filter(e => e.criterion === c).length;
                  return (
                    <div key={c} style={{ padding: 14, borderRadius: 12, background: "#f8f9fc", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, color: C.navy, background: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 13 }}>{c}</span>
                        {evCount > 0 && <span style={{ fontSize: 11, color: "#16a34a", background: "#dcfce7", padding: "3px 8px", borderRadius: 6 }}>{evCount} دليل</span>}
                        <div style={{ display: "flex", gap: 6, marginRight: "auto" }}>
                          {[1, 2, 3, 4].map(n => (
                            <button key={n} onClick={() => setScore(c, n)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, background: evaluations[c]?.score === n ? COMPLIANCE_COLORS[n] : "#fff", color: evaluations[c]?.score === n ? "#fff" : "#94a3b8", boxShadow: "0 1px 4px rgba(0,0,0,.08)", transition: ".2s" }}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <textarea value={evaluations[c]?.comment || ""} onChange={e => setComment(c, e.target.value)} placeholder="التعليق على نتائج التقييم بناءً على الأدلة..." style={{ ...inp, minHeight: 60, resize: "vertical" }} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============= 3. رفع الأدلة =============
function Evidence({ evidence, setEvidence }) {
  const [form, setForm] = useState({ code: "", name: "", criterion: "1.0.1", type: "PDF" });
  const allCriteria = STANDARDS.flatMap(s => s.criteria);
  const add = () => {
    if (!form.name) return;
    setEvidence(p => [...p, { ...form, id: Date.now(), reviewed: false, quality: null, analysis: "" }]);
    setForm({ code: "", name: "", criterion: form.criterion, type: "PDF" });
  };
  return (
    <div>
      <Header icon={Upload} title="رفع الأدلة وإدارتها" sub="تسجيل الأدلة وربطها بالمعايير المناسبة مع التصنيف التلقائي" />
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>إضافة دليل جديد</h3>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px 120px", gap: 12, alignItems: "end" }}>
          <div><label style={lbl}>رقم الدليل</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="1.0.1.1" style={inp} /></div>
          <div><label style={lbl}>اسم الدليل</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="الخطة الاستراتيجية 2023-2026" style={inp} /></div>
          <div><label style={lbl}>المعيار</label><select value={form.criterion} onChange={e => setForm({ ...form, criterion: e.target.value })} style={inp}>{allCriteria.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>النوع</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>{["PDF", "Word", "Excel", "PowerPoint", "صورة", "CSV", "ZIP"].map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div style={{ marginTop: 14 }}><Btn variant="gold" onClick={add}><Plus size={18} /> إضافة الدليل</Btn></div>
      </Card>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>قائمة الأدلة ({evidence.length})</h3>
        </div>
        {evidence.length === 0 ? <p style={{ color: "#94a3b8", textAlign: "center", padding: 30 }}>لم تتم إضافة أدلة بعد</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evidence.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8f9fc", borderRadius: 10 }}>
                <FileText size={20} color={C.navy} />
                <span style={{ fontWeight: 700, color: C.gold, fontSize: 13, minWidth: 60 }}>{e.code || "—"}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{e.name}</span>
                <span style={{ fontSize: 11, background: "#fff", padding: "3px 8px", borderRadius: 6, color: "#64748b" }}>{e.type}</span>
                <span style={{ fontSize: 11, background: C.navy, color: C.goldL, padding: "3px 8px", borderRadius: 6 }}>{e.criterion}</span>
                {e.reviewed && <CheckCircle2 size={16} color="#16a34a" />}
                <button onClick={() => setEvidence(p => p.filter(x => x.id !== e.id))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============= 4. مراجعة الأدلة بالذكاء =============
function Review({ evidence, setEvidence }) {
  const [loading, setLoading] = useState(null);
  const reviewOne = async (ev) => {
    setLoading(ev.id);
    const result = await callAIJson(
      `أنت خبير اعتماد أكاديمي. راجع هذا الدليل المرتبط بالمعيار ${ev.criterion}:\nاسم الدليل: "${ev.name}" (نوع: ${ev.type})\nقيّم: مدى توافق الدليل مع المعيار، قوة الإثبات، الوضوح. أعطِ تقييم جودة من 1-5 وملاحظات موجزة.`,
      `أرجع JSON بالشكل: {"quality": رقم من 1-5, "analysis": "تحليل موجز بالعربية", "suggestions": "اقتراحات للتحسين"}`
    );
    setEvidence(p => p.map(x => x.id === ev.id ? { ...x, reviewed: true, quality: result?.quality || 3, analysis: result?.analysis || "تمت المراجعة", suggestions: result?.suggestions || "" } : x));
    setLoading(null);
  };
  const reviewAll = async () => { for (const ev of evidence.filter(e => !e.reviewed)) await reviewOne(ev); };
  return (
    <div>
      <Header icon={ClipboardCheck} title="مراجعة الأدلة بالذكاء الاصطناعي" sub="تحليل اكتمال وجودة الأدلة وتوافقها مع المعايير تلقائياً" />
      <Card style={{ marginBottom: 16 }}>
        <Btn onClick={reviewAll} disabled={evidence.filter(e => !e.reviewed).length === 0}><Sparkles size={18} /> مراجعة جميع الأدلة غير المراجعة</Btn>
      </Card>
      {evidence.length === 0 ? <Card><p style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>أضف أدلة أولاً من قسم رفع الأدلة</p></Card> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {evidence.map(e => (
            <Card key={e.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: e.reviewed ? 12 : 0 }}>
                <span style={{ fontWeight: 700, color: C.gold }}>{e.code}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{e.name}</span>
                <span style={{ fontSize: 11, background: C.navy, color: C.goldL, padding: "3px 8px", borderRadius: 6 }}>{e.criterion}</span>
                {e.reviewed && e.quality && <span style={{ fontWeight: 800, color: e.quality >= 4 ? "#16a34a" : e.quality >= 3 ? "#f59e0b" : "#dc2626" }}>الجودة: {e.quality}/5</span>}
                <Btn variant="ghost" onClick={() => reviewOne(e)} disabled={loading === e.id} style={{ padding: "6px 12px", fontSize: 13 }}>{loading === e.id ? <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />} مراجعة</Btn>
              </div>
              {e.reviewed && e.analysis && (
                <div style={{ background: "#f8f9fc", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 6 }}><strong style={{ color: C.navy }}>التحليل: </strong>{e.analysis}</div>
                  {e.suggestions && <div><strong style={{ color: C.gold }}>اقتراحات: </strong>{e.suggestions}</div>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============= 5. حساب المؤشرات =============
function KPIs({ kpis, setKpis }) {
  const [form, setForm] = useState({ name: "", actual: "", target: "", internal: "", external: "" });
  const add = () => { if (!form.name) return; setKpis(p => [...p, { ...form, id: Date.now(), actual: +form.actual, target: +form.target, internal: +form.internal, external: +form.external }]); setForm({ name: "", actual: "", target: "", internal: "", external: "" }); };
  const maxVal = Math.max(...kpis.flatMap(k => [k.actual, k.target, k.internal, k.external]), 5);
  return (
    <div>
      <Header icon={BarChart3} title="حساب المؤشرات وتحليلها" sub="إدارة مؤشرات الأداء KPIs مع المقارنات المرجعية الداخلية والخارجية" />
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>اسم المؤشر</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>الفعلي</label><input type="number" value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>المستهدف</label><input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>داخلي</label><input type="number" value={form.internal} onChange={e => setForm({ ...form, internal: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>خارجي</label><input type="number" value={form.external} onChange={e => setForm({ ...form, external: e.target.value })} style={inp} /></div>
          <Btn variant="gold" onClick={add}><Plus size={16} /></Btn>
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {kpis.map(k => {
          const met = k.actual >= k.target;
          const bars = [{ l: "الفعلي", v: k.actual, c: met ? "#16a34a" : "#dc2626" }, { l: "المستهدف", v: k.target, c: C.gold }, { l: "داخلي", v: k.internal, c: "#3b82f6" }, { l: "خارجي", v: k.external, c: "#8b5cf6" }];
          return (
            <Card key={k.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h4 style={{ margin: 0 }}>{k.name}</h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: met ? "#dcfce7" : "#fee2e2", color: met ? "#16a34a" : "#dc2626" }}>{met ? "✓ تحقق المستهدف" : "لم يتحقق"}</span>
                  <button onClick={() => setKpis(p => p.filter(x => x.id !== k.id))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}><Trash2 size={15} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
                {bars.map((b, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "flex-end", height: 80, gap: 4 }}>
                      <div style={{ flex: 1, height: (b.v / maxVal * 100) + "%", background: b.c, borderRadius: "6px 6px 0 0", minHeight: 4, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 4, color: "#fff", fontWeight: 700, fontSize: 12 }}>{b.v}</div>
                    </div>
                    <div style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 6 }}>{b.l}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============= 6. تحليل الفجوات =============
function GapAnalysis({ stats, evaluations }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const analyze = async () => {
    setLoading(true);
    const summary = stats.standardAverages.map(s => `${s.name}: ${s.avg.toFixed(2)}`).join("، ");
    const res = await callAIJson(
      `أنت خبير اعتماد أكاديمي. حلّل نتائج الدراسة الذاتية التالية وحدد الفجوات:\n${summary}\nالتقييم العام: ${stats.overallAvg}`,
      `أرجع JSON: {"strengths":["نقطة قوة"],"weaknesses":["نقطة ضعف"],"opportunities":["فرصة تحسين"],"risks":["مخاطر"],"actionPlan":[{"action":"إجراء","responsible":"الجهة","priority":"عالية/متوسطة"}]}`
    );
    setResult(res); setLoading(false);
  };
  return (
    <div>
      <Header icon={AlertTriangle} title="تحليل الفجوات" sub="تحديد نقاط القوة والضعف وفرص التحسين واقتراح خطة تطوير" />
      <Card style={{ marginBottom: 16 }}><Btn onClick={analyze} disabled={loading}>{loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={18} />} تحليل الفجوات بالذكاء الاصطناعي</Btn></Card>
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ t: "نقاط القوة", d: result.strengths, c: "#16a34a" }, { t: "نقاط الضعف", d: result.weaknesses, c: "#dc2626" }, { t: "فرص التحسين", d: result.opportunities, c: "#3b82f6" }, { t: "المخاطر", d: result.risks, c: "#f59e0b" }].map((sec, i) => (
            <Card key={i} style={{ borderTop: `3px solid ${sec.c}` }}>
              <h4 style={{ marginTop: 0, color: sec.c }}>{sec.t}</h4>
              <ul style={{ margin: 0, paddingRight: 18, lineHeight: 1.9, fontSize: 14 }}>{(sec.d || []).map((x, j) => <li key={j}>{x}</li>)}</ul>
            </Card>
          ))}
          <Card style={{ gridColumn: "1/3", borderTop: `3px solid ${C.gold}` }}>
            <h4 style={{ marginTop: 0, color: C.gold }}>خطة العمل المقترحة</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: "#f8f9fc" }}><th style={th}>الإجراء</th><th style={th}>الجهة المسؤولة</th><th style={th}>الأولوية</th></tr></thead>
              <tbody>{(result.actionPlan || []).map((a, i) => <tr key={i}><td style={td}>{a.action}</td><td style={td}>{a.responsible}</td><td style={td}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: a.priority === "عالية" ? "#fee2e2" : "#fef3c7", color: a.priority === "عالية" ? "#dc2626" : "#f59e0b" }}>{a.priority}</span></td></tr>)}</tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============= 7. تحسين اللغة =============
function LanguageTool() {
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("proofread");
  const modes = { proofread: "تدقيق لغوي", academic: "أسلوب أكاديمي", translateEn: "ترجمة للإنجليزية", translateAr: "ترجمة للعربية" };
  const run = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const prompts = {
      proofread: "دقق النص التالي لغوياً وأصلح الأخطاء الإملائية والنحوية وعلامات الترقيم، وأعد النص المصحح فقط:",
      academic: "حوّل النص التالي إلى أسلوب أكاديمي رصين مناسب لتقرير دراسة ذاتية، ووحّد المصطلحات، وأعد النص فقط:",
      translateEn: "ترجم النص التالي إلى الإنجليزية الأكاديمية، وأعد الترجمة فقط:",
      translateAr: "ترجم النص التالي إلى العربية الأكاديمية، وأعد الترجمة فقط:",
    };
    setOut(await callAI(`${prompts[mode]}\n\n${text}`));
    setLoading(false);
  };
  return (
    <div>
      <Header icon={Languages} title="تحسين اللغة" sub="التدقيق اللغوي، تحسين الصياغة، توحيد المصطلحات، والترجمة" />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {Object.entries(modes).map(([k, v]) => <button key={k} onClick={() => setMode(k)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, background: mode === k ? C.navy : "#f1f5f9", color: mode === k ? C.goldL : "#64748b" }}>{v}</button>)}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="الصق النص المراد معالجته هنا..." style={{ ...inp, minHeight: 140, resize: "vertical" }} />
        <div style={{ marginTop: 12 }}><Btn variant="gold" onClick={run} disabled={loading}>{loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={18} />} معالجة النص</Btn></div>
      </Card>
      {out && <Card><h4 style={{ marginTop: 0, color: C.gold }}>النتيجة</h4><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9, fontSize: 15 }}>{out}</div></Card>}
    </div>
  );
}

// ============= 8. كتابة SSR =============
function SSRWriter({ ssrSections, setSsrSections, stats, collegeInfo, kpis }) {
  const [loading, setLoading] = useState(null);
  const sections = [
    { id: "intro", name: "المقدمة" },
    { id: "college", name: "وصف الكلية" },
    { id: "program", name: "وصف البرنامج" },
    { id: "analysis", name: "تحليل الأداء" },
    { id: "kpi", name: "تحليل المؤشرات" },
    { id: "strengths", name: "نقاط القوة" },
    { id: "improvement", name: "فرص التحسين" },
    { id: "recommendations", name: "التوصيات" },
    { id: "conclusion", name: "الخاتمة" },
  ];
  const generate = async (sec) => {
    setLoading(sec.id);
    const ctx = `المؤسسة: ${collegeInfo.name}، البرنامج: ${collegeInfo.program || "غير محدد"}، التقييم العام: ${stats.overallAvg}، عدد الأدلة: ${stats.evidenceCount}`;
    const txt = await callAI(`أنت خبير في كتابة تقارير الدراسة الذاتية للاعتماد الأكاديمي (SSR). اكتب قسم "${sec.name}" بأسلوب أكاديمي رصين ومفصل بالعربية. السياق: ${ctx}. اكتب فقرة أو فقرتين احترافيتين.`);
    setSsrSections(p => ({ ...p, [sec.id]: txt }));
    setLoading(null);
  };
  const generateAll = async () => { for (const s of sections) await generate(s); };
  const exportDoc = () => {
    const content = sections.map(s => `<h2 style="color:#0f1f3d">${s.name}</h2><p>${(ssrSections[s.id] || "").replace(/\n/g, "<br>")}</p>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tajawal,Arial;padding:40px;line-height:1.8}h1{color:#c9a227;text-align:center}h2{border-bottom:2px solid #c9a227;padding-bottom:6px}</style></head><body><h1>تقرير الدراسة الذاتية - ${collegeInfo.name}</h1>${content}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "SSR_Report.doc"; a.click();
  };
  return (
    <div>
      <Header icon={PenLine} title="كتابة تقرير الدراسة الذاتية SSR" sub="توليد جميع أقسام التقرير تلقائياً بالذكاء الاصطناعي مع إمكانية التعديل والتصدير" />
      <Card style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={generateAll}><Sparkles size={18} /> توليد جميع الأقسام</Btn>
        <Btn variant="gold" onClick={exportDoc}><Download size={18} /> تصدير Word</Btn>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sections.map(sec => (
          <Card key={sec.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ssrSections[sec.id] ? 12 : 0 }}>
              <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>{ssrSections[sec.id] && <CheckCircle2 size={18} color="#16a34a" />} {sec.name}</h4>
              <Btn variant="ghost" onClick={() => generate(sec)} disabled={loading === sec.id} style={{ padding: "6px 14px", fontSize: 13 }}>{loading === sec.id ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />} توليد</Btn>
            </div>
            {ssrSections[sec.id] !== undefined && (
              <textarea value={ssrSections[sec.id]} onChange={e => setSsrSections(p => ({ ...p, [sec.id]: e.target.value }))} style={{ ...inp, minHeight: 120, resize: "vertical", lineHeight: 1.8 }} />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============= 9. التحقق النهائي =============
function FinalCheck({ stats, evidence, ssrSections, kpis }) {
  const checks = [
    { name: "تقييم جميع المعايير", done: stats.evaluated === stats.totalCriteria, detail: `${stats.evaluated}/${stats.totalCriteria}` },
    { name: "رفع الأدلة المطلوبة", done: stats.evidenceCount > 0, detail: `${stats.evidenceCount} دليل` },
    { name: "مراجعة الأدلة بالذكاء", done: evidence.length > 0 && evidence.every(e => e.reviewed), detail: `${evidence.filter(e => e.reviewed).length}/${evidence.length}` },
    { name: "إدخال المؤشرات", done: kpis.length > 0, detail: `${kpis.length} مؤشر` },
    { name: "كتابة أقسام SSR", done: stats.ssrDone >= 5, detail: `${stats.ssrDone}/9 قسم` },
    { name: "التقييم العام ≥ 3", done: parseFloat(stats.overallAvg) >= 3, detail: stats.overallAvg },
  ];
  const readyPct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);
  return (
    <div>
      <Header icon={FileCheck2} title="التحقق النهائي وجاهزية الاعتماد" sub="مراجعة شاملة لجميع عناصر الدراسة الذاتية قبل اعتماد التقرير" />
      <Card style={{ marginBottom: 20, textAlign: "center", background: `linear-gradient(135deg,${C.navy},${C.navy2})`, color: "#fff" }}>
        <div style={{ fontSize: 14, color: C.goldL, marginBottom: 8 }}>نسبة الجاهزية للاعتماد</div>
        <div style={{ fontSize: 56, fontWeight: 800, color: readyPct >= 80 ? "#4ade80" : readyPct >= 50 ? C.goldL : "#f87171" }}>{readyPct}%</div>
        <div style={{ height: 10, background: "rgba(255,255,255,.15)", borderRadius: 5, marginTop: 12, maxWidth: 400, margin: "12px auto 0" }}><div style={{ height: "100%", width: readyPct + "%", background: `linear-gradient(90deg,${C.gold},${C.goldL})`, borderRadius: 5, transition: ".6s" }} /></div>
      </Card>
      <Card>
        <h3 style={{ marginTop: 0 }}>قائمة التحقق</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "#f8f9fc", borderRadius: 10 }}>
              {c.done ? <CheckCircle2 size={24} color="#16a34a" /> : <X size={24} color="#dc2626" />}
              <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.done ? "#16a34a" : "#94a3b8", background: "#fff", padding: "4px 12px", borderRadius: 8 }}>{c.detail}</span>
            </div>
          ))}
        </div>
        {readyPct === 100 && <div style={{ marginTop: 16, padding: 16, background: "#dcfce7", borderRadius: 12, textAlign: "center", color: "#16a34a", fontWeight: 700 }}>🎉 التقرير جاهز للاعتماد! جميع العناصر مكتملة.</div>}
      </Card>
    </div>
  );
}

// ============= الزيارة التجريبية الذكية =============
function MockVisit({ mockResults, setMockResults, evaluations, evidence, collegeInfo }) {
  const ROLES = [
    { id: "leader", name: "القيادات العليا", desc: "العميد ووكلاء الكلية", icon: Award },
    { id: "faculty", name: "أعضاء هيئة التدريس", desc: "المحاضرون ورؤساء الأقسام", icon: UserCheck },
    { id: "student", name: "الطلبة", desc: "طلاب البرامج المختلفة", icon: MessageSquare },
  ];
  const [selectedStd, setSelectedStd] = useState(1);
  const [role, setRole] = useState("leader");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [report, setReport] = useState(null);

  const std = STANDARDS.find(s => s.id === selectedStd);

  const exportReport = (r, s, ro) => {
    const list = (arr) => (arr || []).map(x => `<li>${x}</li>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tajawal,Arial;padding:40px;line-height:1.8;color:#0f1f3d}h1{color:#c9a227;text-align:center}h2{border-bottom:2px solid #c9a227;padding-bottom:6px;color:#0f1f3d}.score{text-align:center;font-size:42px;font-weight:800;color:${COMPLIANCE_COLORS[r.readiness]}}.box{background:#f8f9fc;padding:16px;border-radius:10px;margin:12px 0}</style></head><body>
      <h1>تقرير الزيارة التجريبية الذكية</h1>
      <p style="text-align:center;color:#64748b">${collegeInfo.name} · ${r.date}</p>
      <div class="box"><strong>المعيار:</strong> ${s?.name}<br><strong>الفئة المُقابَلة:</strong> ${ro?.name}</div>
      <div class="score">درجة الجاهزية: ${r.readiness}/4 (${COMPLIANCE_LABELS[r.readiness]})</div>
      <h2>ملخص المراجع</h2><p>${r.summary || ""}</p>
      <h2>نقاط القوة</h2><ul>${list(r.strengths)}</ul>
      <h2>الثغرات وفرص التحسين</h2><ul>${list(r.gaps)}</ul>
      <h2>توصيات قبل الزيارة الفعلية</h2><ul>${list(r.recommendations)}</ul>
    </body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `MockVisit_${s?.code}_${r.role}.doc`; a.click();
  };

  const generateQuestions = async () => {
    setLoading(true); setReport(null); setAnswers({});
    const roleName = ROLES.find(r => r.id === role).name;
    const res = await callAIJson(
      `أنت مراجع خارجي في فريق اعتماد أكاديمي (NCAAA) يجري زيارة ميدانية. أنت تقابل "${roleName}" في ${collegeInfo.name}.\nاطرح 5 أسئلة تقييمية واقعية حول معيار "${std.name}" كما يطرحها المراجع الخارجي فعلياً في الزيارة.`,
      `أرجع JSON مصفوفة: ["السؤال الأول", "السؤال الثاني", ...] بالعربية فقط.`
    );
    setQuestions(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  const evaluate = async () => {
    setEvaluating(true);
    const qa = questions.map((q, i) => `س: ${q}\nج: ${answers[i] || "(لم تتم الإجابة)"}`).join("\n\n");
    const roleName = ROLES.find(r => r.id === role).name;
    const res = await callAIJson(
      `أنت مراجع خارجي خبير في الاعتماد الأكاديمي. قيّم إجابات "${roleName}" حول معيار "${std.name}":\n\n${qa}\n\nقيّم جودة الإجابات ومدى دعمها للمعيار، وحدد درجة الجاهزية من 1-4.`,
      `أرجع JSON: {"readiness": رقم 1-4, "strengths": ["نقطة قوة"], "gaps": ["ثغرة أو نقطة تحسين"], "recommendations": ["توصية قبل الزيارة الفعلية"], "summary": "ملخص تقييم المراجع"}`
    );
    const result = { ...res, std: selectedStd, role, date: new Date().toLocaleDateString("ar-SA") };
    setReport(result);
    setMockResults(p => ({ ...p, [`${selectedStd}_${role}`]: result }));
    setEvaluating(false);
  };

  return (
    <div>
      <Header icon={UserCheck} title="الزيارة التجريبية الذكية" sub="محاكاة زيارة فريق الاعتماد الخارجي — أسئلة، تقييم إجابات، وتقرير جاهزية لكل معيار" />

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>إعداد المقابلة</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>اختر المعيار</label>
          <select value={selectedStd} onChange={e => { setSelectedStd(+e.target.value); setQuestions([]); setReport(null); }} style={inp}>
            {STANDARDS.map(s => <option key={s.id} value={s.id}>{s.code}. {s.name}</option>)}
          </select>
        </div>
        <label style={lbl}>اختر الفئة المُقابَلة</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 6 }}>
          {ROLES.map(r => { const Icon = r.icon; const active = role === r.id; return (
            <button key={r.id} onClick={() => { setRole(r.id); setQuestions([]); setReport(null); }} style={{ padding: 16, borderRadius: 12, border: active ? `2px solid ${C.gold}` : "2px solid #e2e8f0", background: active ? "rgba(201,162,39,.08)" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: ".2s" }}>
              <Icon size={26} color={active ? C.gold : "#94a3b8"} />
              <div style={{ fontWeight: 700, marginTop: 8, color: C.navy }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{r.desc}</div>
            </button>
          ); })}
        </div>
        <div style={{ marginTop: 16 }}><Btn onClick={generateQuestions} disabled={loading}>{loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={18} />} بدء المقابلة وتوليد الأسئلة</Btn></div>
      </Card>

      {questions.length > 0 && !report && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}><MessageSquare size={20} color={C.gold} /> أسئلة المراجع الخارجي</h3>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 16, padding: 14, background: "#f8f9fc", borderRadius: 12 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.navy, color: C.goldL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontWeight: 600, lineHeight: 1.6 }}>{q}</span>
              </div>
              <textarea value={answers[i] || ""} onChange={e => setAnswers(p => ({ ...p, [i]: e.target.value }))} placeholder="اكتب إجابتك كما ستجيب في الزيارة الفعلية..." style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
          ))}
          <Btn variant="gold" onClick={evaluate} disabled={evaluating}>{evaluating ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ClipboardCheck size={18} />} تقييم الإجابات وإصدار التقرير</Btn>
        </Card>
      )}

      {report && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <Btn variant="ghost" onClick={() => exportReport(report, std, ROLES.find(r => r.id === report.role))} style={{ padding: "6px 14px", fontSize: 13 }}><Download size={15} /> تصدير التقرير</Btn>
          </div>
          <div style={{ textAlign: "center", padding: "10px 0 20px", borderBottom: "1px solid #eef1f6", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>درجة الجاهزية للمعيار: {std.name}</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: COMPLIANCE_COLORS[report.readiness] }}>{report.readiness}/4</div>
            <div style={{ fontWeight: 700, color: COMPLIANCE_COLORS[report.readiness] }}>{COMPLIANCE_LABELS[report.readiness]}</div>
          </div>
          {report.summary && <div style={{ background: "#f8f9fc", padding: 14, borderRadius: 12, marginBottom: 16, lineHeight: 1.8, fontSize: 14 }}><strong style={{ color: C.navy }}>ملخص المراجع: </strong>{report.summary}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ padding: 14, background: "#f0fdf4", borderRadius: 12 }}>
              <h4 style={{ marginTop: 0, color: "#16a34a" }}>نقاط القوة</h4>
              <ul style={{ margin: 0, paddingRight: 18, lineHeight: 1.9, fontSize: 14 }}>{(report.strengths || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div style={{ padding: 14, background: "#fef2f2", borderRadius: 12 }}>
              <h4 style={{ marginTop: 0, color: "#dc2626" }}>الثغرات وفرص التحسين</h4>
              <ul style={{ margin: 0, paddingRight: 18, lineHeight: 1.9, fontSize: 14 }}>{(report.gaps || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          <div style={{ padding: 14, background: "rgba(201,162,39,.08)", borderRadius: 12, marginTop: 14 }}>
            <h4 style={{ marginTop: 0, color: C.gold }}>توصيات قبل الزيارة الفعلية</h4>
            <ul style={{ margin: 0, paddingRight: 18, lineHeight: 1.9, fontSize: 14 }}>{(report.recommendations || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </Card>
      )}

      {Object.keys(mockResults).length > 0 && (
        <Card>
          <h3 style={{ marginTop: 0 }}>سجل الزيارات التجريبية</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(mockResults).map(([key, r]) => {
              const s = STANDARDS.find(x => x.id === r.std); const ro = ROLES.find(x => x.id === r.role);
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8f9fc", borderRadius: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: COMPLIANCE_COLORS[r.readiness], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{r.readiness}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{s?.name}</div><div style={{ fontSize: 12, color: "#94a3b8" }}>{ro?.name} · {r.date}</div></div>
                  <button onClick={() => exportReport(r, s, ro)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.navy }}><Download size={15} /></button>
                  <button onClick={() => setMockResults(p => { const n = { ...p }; delete n[key]; return n; })} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// أنماط مشتركة
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", marginTop: 4, outline: "none", background: "#fff" };
const lbl = { fontSize: 12, color: "#64748b", fontWeight: 600 };
const th = { padding: 10, textAlign: "right", fontWeight: 700, color: C.navy, borderBottom: "2px solid #e2e8f0" };
const td = { padding: 10, borderBottom: "1px solid #f1f5f9" };