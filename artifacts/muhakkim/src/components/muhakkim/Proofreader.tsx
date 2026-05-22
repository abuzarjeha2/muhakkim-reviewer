import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from "../../lib/i18n";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Issue {
  id: number;
  page: number;
  type: string;
  typeAr: string;
  category: 'style' | 'structure' | 'grammar';
  snippet: string;
  fix: string;
  fixAr: string;
  severity: 'error' | 'warning' | 'info';
}

interface SectionResult {
  key: string;
  labelAr: string;
  labelEn: string;
  emoji: string;
  found: boolean;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  excerpt: string;
  issues: string[];
  issuesAr: string[];
  fixes: string[];
  fixesAr: string[];
}

interface AiIssue {
  type: 'spelling' | 'grammar' | 'style' | 'vocabulary' | 'punctuation';
  severity: 'error' | 'warning' | 'info';
  original: string;
  suggestion: string;
  explanation: string;
  dictVerified?: boolean;
}

interface DictResult {
  word: string;
  found: boolean;
  definition: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  partOfSpeech: string;
  note?: string;
}

interface SummaryResult {
  short: string;
  bullets: string[];
  academic: string;
  originalWordCount: number;
  summaryWordCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const WORDS_PER_PAGE = 270;

function getPage(wordsBefore: number) {
  return Math.max(1, Math.ceil((wordsBefore + 1) / WORDS_PER_PAGE));
}

const SECTION_PATTERNS: Record<string, { ar: string[]; en: string[] }> = {
  abstract: {
    ar: ['مستخلص', 'ملخص', 'الملخص', 'المستخلص', 'موجز'],
    en: ['abstract', 'summary', 'synopsis'],
  },
  theoretical: {
    ar: ['الإطار النظري', 'إطار نظري', 'الأدبيات', 'الدراسات السابقة', 'الخلفية النظرية', 'الإطار المفاهيمي', 'مراجعة الأدبيات'],
    en: ['theoretical framework', 'literature review', 'theoretical background', 'conceptual framework', 'related work'],
  },
  methodology: {
    ar: ['المنهجية', 'منهجية البحث', 'منهج البحث', 'الطريقة', 'أسلوب البحث', 'المنهج', 'الإجراءات', 'مجتمع الدراسة', 'عينة الدراسة'],
    en: ['methodology', 'research method', 'methods', 'research design', 'procedure', 'sample', 'participants'],
  },
  results: {
    ar: ['النتائج', 'نتائج الدراسة', 'نتائج التحليل', 'المناقشة', 'نتائج البحث', 'عرض النتائج', 'تحليل البيانات'],
    en: ['results', 'findings', 'analysis', 'discussion', 'outcomes'],
  },
  recommendations: {
    ar: ['التوصيات', 'المقترحات', 'توصيات الدراسة', 'الخاتمة', 'الاستنتاجات', 'التوصية'],
    en: ['recommendations', 'conclusions', 'conclusion', 'implications', 'suggestions'],
  },
};

function findSection(text: string, patterns: { ar: string[]; en: string[] }) {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    for (const kw of patterns.ar) {
      if (lower.includes(kw.toLowerCase()))
        return { found: true, excerpt: line.trim().slice(0, 120), confidence: 'high' as const };
    }
    for (const kw of patterns.en) {
      if (lower.includes(kw.toLowerCase()))
        return { found: true, excerpt: line.trim().slice(0, 120), confidence: 'medium' as const };
    }
  }
  const full = text.toLowerCase();
  for (const kw of [...patterns.ar, ...patterns.en]) {
    if (full.includes(kw.toLowerCase()))
      return { found: true, excerpt: kw, confidence: 'low' as const };
  }
  return { found: false, excerpt: '', confidence: 'missing' as const };
}

function analyzeSection(text: string, key: string) {
  const issues: string[] = [], issuesAr: string[] = [], fixes: string[] = [], fixesAr: string[] = [];
  const wc = text.trim().split(/\s+/).filter(Boolean).length;
  if (key === 'abstract') {
    if (wc < 100) { issues.push('Abstract < 100 words'); issuesAr.push('المستخلص أقل من 100 كلمة'); fixes.push('Expand to 150–300 words covering objectives, method, results.'); fixesAr.push('وسّع المستخلص ليشمل الأهداف والمنهج والنتائج (150–300 كلمة).'); }
    if (wc > 350) { issues.push('Abstract > 350 words'); issuesAr.push('المستخلص أكثر من 350 كلمة'); fixes.push('Trim to 150–300 words.'); fixesAr.push('اختصر إلى 150–300 كلمة.'); }
    if (!/keyword|كلمات مفتاحية/i.test(text)) { issues.push('No keywords found'); issuesAr.push('لا توجد كلمات مفتاحية'); fixes.push('Add 4–6 keywords after the abstract.'); fixesAr.push('أضف 4–6 كلمات مفتاحية بعد المستخلص.'); }
  }
  if (key === 'theoretical') {
    if (wc < 200) { issues.push('Framework too brief'); issuesAr.push('الإطار النظري مقتضب'); fixes.push('Add more theories, models, and citations.'); fixesAr.push('أضف نظريات ونماذج واستشهادات إضافية.'); }
    if (!/\(\d{4}\)|et al\.|وآخرون/.test(text)) { issues.push('No citations detected'); issuesAr.push('لا توجد استشهادات'); fixes.push('Add APA citations, e.g., (Author, 2020).'); fixesAr.push('أضف استشهادات APA مثل: (المؤلف، 2020).'); }
  }
  if (key === 'methodology') {
    if (!/sample|عينة|مجتمع|participants/i.test(text)) { issues.push('No sample mentioned'); issuesAr.push('لم يُذكر مجتمع الدراسة'); fixes.push('Describe population, sample size, and selection.'); fixesAr.push('صِف مجتمع الدراسة وحجم العينة وطريقة اختيارها.'); }
    if (!/instrument|أداة|questionnaire|استبيان/i.test(text)) { issues.push('No instrument mentioned'); issuesAr.push('لم تُذكر أداة الدراسة'); fixes.push('Specify data collection instrument and its validity.'); fixesAr.push('حدّد أداة جمع البيانات مع ذكر صدقها وثباتها.'); }
  }
  if (key === 'results') {
    if (!/table|جدول|figure|شكل|%|p\s*[=<>]/.test(text)) { issues.push('No tables or stats detected'); issuesAr.push('لا توجد جداول أو مخرجات إحصائية'); fixes.push('Present results using numbered tables with statistical values.'); fixesAr.push('اعرض النتائج في جداول مرقّمة بقيم إحصائية.'); }
  }
  if (key === 'recommendations') {
    if (wc < 50) { issues.push('Recommendations too short'); issuesAr.push('التوصيات قصيرة جداً'); fixes.push('Add 3–5 specific, actionable recommendations.'); fixesAr.push('أضف 3–5 توصيات محددة وقابلة للتطبيق.'); }
  }
  return { issues, issuesAr, fixes, fixesAr };
}

function runLanguageCheck(body: string): Issue[] {
  const paragraphs = body.split(/\n{1,}/);
  const found: Issue[] = [];
  let id = 1, wordsSoFar = 0;
  const wordFreq: Record<string, number> = {};
  body.toLowerCase().split(/\s+/).forEach(w => {
    const clean = w.replace(/[^\u0600-\u06FFa-zA-Z]/g, '');
    if (clean.length > 5) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
  });
  const repeatedWords = new Set(Object.entries(wordFreq).filter(([, c]) => c > 6).map(([w]) => w));
  const passiveAr = ['تم ', 'يتم ', 'كانت ', 'قد تم', 'سيتم'];
  const passiveEn = [' was ', ' were ', ' has been ', ' have been ', ' had been '];
  paragraphs.forEach(para => {
    const trimmed = para.trim();
    if (!trimmed || trimmed.length < 20) { wordsSoFar += trimmed.split(/\s+/).filter(Boolean).length; return; }
    const paraWords = trimmed.split(/\s+/).filter(Boolean).length;
    const page = getPage(wordsSoFar);
    const sentences = trimmed.split(/(?<=[.!?؟])\s+(?=[^\d])/).filter(s => s.trim().length > 30);
    sentences.forEach(sent => {
      const wc = sent.trim().split(/\s+/).filter(Boolean).length;
      if (wc > 50) found.push({ id: id++, page, category: 'style', type: 'Long sentence (>50 words)', typeAr: 'جملة طويلة (أكثر من 50 كلمة)', snippet: sent.trim().slice(0, 80) + '…', fix: 'Break into 2–3 shorter sentences.', fixAr: 'قسّم إلى 2–3 جمل أقصر.', severity: 'warning' });
    });
    passiveAr.forEach(p => {
      if (trimmed.includes(p)) found.push({ id: id++, page, category: 'style', type: 'Arabic passive voice', typeAr: 'صيغة المبني للمجهول', snippet: trimmed.slice(0, 70) + '…', fix: 'Use active voice: "طبّق الباحث" instead of "تم تطبيق".', fixAr: 'استخدم المبني للمعلوم: "طبّق الباحث" بدلاً من "تم تطبيق".', severity: 'info' });
    });
    passiveEn.forEach(p => {
      if (trimmed.toLowerCase().includes(p)) found.push({ id: id++, page, category: 'style', type: 'English passive voice', typeAr: 'مبني للمجهول (إنجليزي)', snippet: trimmed.slice(0, 70) + '…', fix: 'Prefer active voice.', fixAr: 'استخدم المبني للمعلوم.', severity: 'info' });
    });
    const paraWordList = trimmed.toLowerCase().split(/\s+/).map(w => w.replace(/[^\u0600-\u06FFa-zA-Z]/g, ''));
    const paraFreq: Record<string, number> = {};
    paraWordList.forEach(w => { if (repeatedWords.has(w)) paraFreq[w] = (paraFreq[w] || 0) + 1; });
    const top = Object.entries(paraFreq).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) found.push({ id: id++, page, category: 'style', type: `Repeated: "${top[0]}" (${top[1]}×)`, typeAr: `تكرار: "${top[0]}" (${top[1]} مرات)`, snippet: trimmed.slice(0, 60) + '…', fix: `Replace some of "${top[0]}" with synonyms.`, fixAr: `استبدل بعض تكرارات "${top[0]}" بمترادفات.`, severity: 'info' });
    if (paraWords >= 15 && !/[.!?؟،]$/.test(trimmed)) found.push({ id: id++, page, category: 'grammar', type: 'Missing end punctuation', typeAr: 'غياب علامة الترقيم', snippet: '…' + trimmed.slice(-50), fix: 'Add period at the end.', fixAr: 'أضف نقطة في النهاية.', severity: 'warning' });
    wordsSoFar += paraWords;
  });
  return found;
}

function runStructureCheck(body: string): SectionResult[] {
  const defs = [
    { key: 'abstract',        labelAr: 'المستخلص',          labelEn: 'Abstract',              emoji: '📄' },
    { key: 'theoretical',     labelAr: 'الإطار النظري',      labelEn: 'Theoretical Framework', emoji: '📚' },
    { key: 'methodology',     labelAr: 'المنهجية',           labelEn: 'Methodology',           emoji: '🔬' },
    { key: 'results',         labelAr: 'النتائج والتحليل',   labelEn: 'Results & Analysis',    emoji: '📊' },
    { key: 'recommendations', labelAr: 'التوصيات',           labelEn: 'Recommendations',       emoji: '💡' },
  ];
  return defs.map(def => {
    const { found, excerpt, confidence } = findSection(body, SECTION_PATTERNS[def.key]);
    const { issues, issuesAr, fixes, fixesAr } = found ? analyzeSection(body, def.key) : { issues: [], issuesAr: [], fixes: [], fixesAr: [] };
    return { ...def, found, confidence, excerpt, issues, issuesAr, fixes, fixesAr };
  });
}

// ─── 3D Floating Orb Canvas ────────────────────────────────────────────────────
function OrbCanvas({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = 220;
    const H = canvas.height = 220;
    const cx = W / 2, cy = H / 2;

    const color = score >= 80 ? ['#10b981', '#34d399', '#6ee7b7'] :
                  score >= 50 ? ['#f59e0b', '#fbbf24', '#fde68a'] :
                                ['#ef4444', '#f87171', '#fca5a5'];

    function draw() {
      tRef.current += 0.012;
      const t = tRef.current;
      ctx!.clearRect(0, 0, W, H);

      const glow = ctx!.createRadialGradient(cx, cy, 20, cx, cy, 100);
      glow.addColorStop(0, color[0] + '44');
      glow.addColorStop(1, 'transparent');
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx!.fill();

      const r = 70 + Math.sin(t * 0.7) * 3;
      const grad = ctx!.createRadialGradient(cx - 22, cy - 22, 5, cx, cy, r);
      grad.addColorStop(0, '#ffffff88');
      grad.addColorStop(0.3, color[1]);
      grad.addColorStop(0.8, color[0]);
      grad.addColorStop(1, '#00000066');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = grad;
      ctx!.shadowColor = color[0];
      ctx!.shadowBlur = 30;
      ctx!.fill();
      ctx!.shadowBlur = 0;

      for (let i = 0; i < 2; i++) {
        const angle = t + i * Math.PI;
        const rx = 90;
        ctx!.save();
        ctx!.translate(cx, cy);
        ctx!.rotate(i * 0.6);
        ctx!.scale(1, 0.3);
        ctx!.beginPath();
        ctx!.arc(0, 0, rx, 0, Math.PI * 2);
        ctx!.strokeStyle = color[2] + '66';
        ctx!.lineWidth = 2;
        ctx!.stroke();
        const dx = Math.cos(angle) * rx;
        const dy = Math.sin(angle) * rx * 0.3;
        ctx!.scale(1, 1 / 0.3);
        ctx!.beginPath();
        ctx!.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx!.fillStyle = color[2];
        ctx!.fill();
        ctx!.restore();
      }

      ctx!.save();
      ctx!.font = 'bold 36px system-ui';
      ctx!.fillStyle = '#ffffff';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.shadowColor = '#000';
      ctx!.shadowBlur = 8;
      ctx!.fillText(`${score}`, cx, cy - 6);
      ctx!.font = '12px system-ui';
      ctx!.fillStyle = '#ffffffaa';
      ctx!.fillText(score >= 80 ? 'ممتاز' : score >= 50 ? 'جيد' : 'يحتاج تحسين', cx, cy + 20);
      ctx!.restore();

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  return <canvas ref={canvasRef} style={{ width: 220, height: 220 }} />;
}

// ─── Animated Progress Ring ────────────────────────────────────────────────────
function ProgressRing({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const r = 28, circ = 2 * Math.PI * r;
  const pct = max ? value / max : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={72}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="#ffffff15" strokeWidth={5} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
        <text x={36} y={40} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">{value}</text>
      </svg>
      <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 70 }}>{label}</span>
    </div>
  );
}

// ─── Particle Field Background ─────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5, opacity: Math.random() * 0.4 + 0.1,
    }));

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(201,168,76,${p.opacity})`;
        ctx!.fill();
      });
      particles.forEach((p, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(p.x - particles[j].x, p.y - particles[j].y);
          if (d < 80) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(201,168,76,${0.12 * (1 - d / 80)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
    }} />
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface ProofreaderProps {
  text?: string;
}

export default function Proofreader({ text: initialText = '' }: ProofreaderProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState(initialText);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'structure' | 'report' | 'ai' | 'dict' | 'summarize'>('language');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // AI state
  const [aiIssues, setAiIssues] = useState<AiIssue[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiSummaryText, setAiSummaryText] = useState("");
  const [aiError, setAiError] = useState("");
  // Dictionary state
  const [dictWord, setDictWord] = useState("");
  const [dictResult, setDictResult] = useState<DictResult | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState("");
  // Summarize state
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMode, setSummaryMode] = useState<'short' | 'bullets' | 'academic'>('short');
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    if (initialText && !hasRun) setText(initialText);
  }, [initialText, hasRun]);

  const score = (() => {
    if (!hasRun) return 50;
    const w = issues.filter(i => i.severity === 'warning').length;
    const missing = sections.filter(s => !s.found).length;
    const total = w + missing * 2;
    if (total === 0) return 95;
    if (total <= 4) return 72;
    return 38;
  })();

  const runAnalysis = useCallback(() => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIssues(runLanguageCheck(text));
      setSections(runStructureCheck(text));
      setHasRun(true);
      setIsAnalyzing(false);
    }, 900);
  }, [text]);

  const copyText = () => {
    navigator.clipboard.writeText(text);
    toast({ title: lang === 'ar' ? 'تم نسخ النص' : 'Text copied' });
  };

  const runAIProofread = async () => {
    if (!text.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiIssues([]);
    setAiScore(null);
    setAiSummaryText("");
    try {
      const res = await fetch("/api/ai/proofread-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setAiIssues(data.issues ?? []);
      setAiScore(data.score ?? null);
      setAiSummaryText(data.summary ?? "");
    } catch {
      setAiError(lang === 'ar' ? 'فشل الاتصال بالخادم. حاول مجدداً.' : 'Failed to connect to server. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const lookupWord = async () => {
    if (!dictWord.trim()) return;
    setDictLoading(true);
    setDictError("");
    setDictResult(null);
    try {
      const res = await fetch("/api/ai/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: dictWord, lang }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setDictResult(data);
    } catch {
      setDictError(lang === 'ar' ? 'فشل البحث. حاول مجدداً.' : 'Lookup failed. Please try again.');
    } finally {
      setDictLoading(false);
    }
  };

  const runSummarize = async () => {
    if (!text.trim()) return;
    setSummaryLoading(true);
    setSummaryError("");
    setSummaryResult(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setSummaryResult(data);
    } catch {
      setSummaryError(lang === 'ar' ? 'فشل التلخيص. حاول مجدداً.' : 'Summarization failed. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const printReport = () => {
    if (!reportRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><meta charset="utf-8"/><title>تقرير محكّم</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;direction:rtl;color:#1a1a2e}h1{border-bottom:2px solid #C9A84C;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0F1B2D;color:#C9A84C;padding:8px}td{padding:8px;border-bottom:1px solid #ddd}@media print{button{display:none}}</style>
    </head><body>${reportRef.current.innerHTML}<script>window.print();<\/script></body></html>`);
    win.document.close();
  };

  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  const totalPages = Math.max(1, getPage(text.trim().split(/\s+/).filter(Boolean).length));
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const severityColor: Record<string, string> = { error: '#ef4444', warning: '#f59e0b', info: '#60a5fa' };
  const confidenceMeta: Record<string, { ar: string; en: string; color: string }> = {
    high:    { ar: 'موجود ✓',    en: 'Found ✓',       color: '#10b981' },
    medium:  { ar: 'محتمل',      en: 'Likely',        color: '#3b82f6' },
    low:     { ar: 'جزئي',       en: 'Partial',       color: '#f59e0b' },
    missing: { ar: 'غير موجود',  en: 'Not detected',  color: '#ef4444' },
  };

  const S: Record<string, React.CSSProperties> = {
    root: { fontFamily: "'Tajawal', 'Segoe UI', sans-serif", direction: lang === 'ar' ? 'rtl' : 'ltr', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1527 50%, #0a1020 100%)', borderRadius: 20, color: '#e2e8f0', padding: '0 0 40px', overflow: 'hidden' },
    hero: { position: 'relative', overflow: 'hidden', padding: '40px 28px 28px', background: 'linear-gradient(180deg, #0f1b2d 0%, transparent 100%)', borderBottom: '1px solid #ffffff08' },
    heroTitle: { fontSize: 'clamp(20px,3.5vw,32px)', fontWeight: 900, background: 'linear-gradient(135deg, #C9A84C 0%, #f5d78e 50%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, lineHeight: 1.1 },
    heroSub: { color: '#64748b', fontSize: 13, marginTop: 6, marginBottom: 0 },
    container: { maxWidth: 860, margin: '0 auto', padding: '0 20px' },
    card: { background: 'linear-gradient(145deg, #0f1b2dcc, #0a1120cc)', backdropFilter: 'blur(20px)', border: '1px solid #ffffff12', borderRadius: 18, padding: 24, marginTop: 20 },
    textarea: { width: '100%', minHeight: 180, background: '#060d1a', border: '1px solid #ffffff15', borderRadius: 12, color: '#e2e8f0', fontSize: 14, padding: '14px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' },
    btnPrimary: { background: 'linear-gradient(135deg, #C9A84C, #f5d78e)', color: '#0a0f1e', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', transition: 'transform .15s, box-shadow .15s', boxShadow: '0 4px 20px #C9A84C44' },
    btnOutline: { background: 'transparent', color: '#C9A84C', border: '1px solid #C9A84C44', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .2s' },
    tabBar: { display: 'flex', gap: 6, marginTop: 20, background: '#060d1a', borderRadius: 12, padding: 5, border: '1px solid #ffffff08' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 16 },
    statCard: { background: 'linear-gradient(145deg, #0f1b2d, #060d1a)', border: '1px solid #ffffff10', borderRadius: 14, padding: '16px 12px', textAlign: 'center' },
    spinner: { width: 18, height: 18, border: '2px solid #0a0f1e44', borderTop: '2px solid #0a0f1e', borderRadius: '50%', animation: 'mhk-spin 0.8s linear infinite' },
  };

  const tab = (active: boolean): React.CSSProperties => ({
    flex: 1, background: active ? 'linear-gradient(135deg, #C9A84C22, #f5d78e11)' : 'transparent',
    border: active ? '1px solid #C9A84C44' : '1px solid transparent',
    borderRadius: 9, padding: '9px 10px', color: active ? '#C9A84C' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
    transition: 'all .2s', fontFamily: 'inherit', textAlign: 'center',
  });

  const issueCard = (sev: string, exp: boolean): React.CSSProperties => ({
    background: exp ? '#0a1525' : '#060d1a',
    border: `1px solid ${(severityColor[sev] ?? '#ffffff') + '33'}`,
    borderRadius: 12, overflow: 'hidden', transition: 'all .25s', cursor: 'pointer', marginBottom: 8,
  });

  const badge = (color: string): React.CSSProperties => ({
    background: color + '22', color, border: `1px solid ${color}44`,
    borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block',
  });

  const secCard = (found: boolean): React.CSSProperties => ({
    background: found ? '#0a1f1544' : '#1f0a0a44',
    border: `1px solid ${found ? '#10b98133' : '#ef444433'}`,
    borderRadius: 14, padding: '16px 18px', transition: 'transform .2s', marginBottom: 8,
  });

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        @keyframes mhk-spin { to { transform: rotate(360deg); } }
        @keyframes mhk-fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mhk-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        .mhk-fade { animation: mhk-fadeUp .5s ease both; }
        .mhk-btn-p:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 30px #C9A84C55 !important; }
        .mhk-btn-p:active { transform: scale(0.98); }
        .mhk-btn-o:hover { background: #C9A84C11 !important; }
        .mhk-issue:hover { border-color: #C9A84C55 !important; }
        .mhk-sec:hover { transform: translateX(-3px); }
        textarea:focus { border-color: #C9A84C66 !important; box-shadow: 0 0 0 3px #C9A84C11; }
      `}</style>

      {/* Hero */}
      <div style={S.hero}>
        <ParticleField />
        <div style={{ ...S.container, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg, #C9A84C, #f5d78e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📝</div>
                <h2 style={S.heroTitle}>{lang === 'ar' ? 'التدقيق الأكاديمي' : 'Academic Proofreader'}</h2>
              </div>
              <p style={S.heroSub}>{lang === 'ar' ? 'تحليل لغوي · بنية أكاديمية · تقرير مفصّل' : 'Language · Structure · Detailed Report'}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {(lang === 'ar'
                  ? ['تحليل لغوي', 'بنية أكاديمية', 'تقرير مفصّل', 'ثنائي اللغة']
                  : ['Language', 'Structure', 'Report', 'Bilingual']
                ).map(tag => (
                  <span key={tag} style={{ background: '#C9A84C15', border: '1px solid #C9A84C33', color: '#C9A84C', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{tag}</span>
                ))}
              </div>
            </div>
            {hasRun && (
              <div style={{ animation: 'mhk-fadeUp .6s ease' }}>
                <OrbCanvas score={score} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.container}>

        {/* Input Card */}
        <div style={{ ...S.card, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>✍️</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{lang === 'ar' ? 'النص البحثي' : 'Research Text'}</span>
            {wordCount > 0 && (
              <span style={{ marginInlineStart: 'auto', color: '#64748b', fontSize: 12 }}>
                {lang === 'ar'
                  ? `${wordCount.toLocaleString('ar')} كلمة · ~${totalPages} صفحة`
                  : `${wordCount.toLocaleString()} words · ~${totalPages} pages`}
              </span>
            )}
          </div>
          <textarea
            style={S.textarea}
            placeholder={lang === 'ar' ? 'الصق نص البحث هنا للتدقيق الشامل…' : 'Paste your research text here for full analysis…'}
            value={text}
            onChange={e => setText(e.target.value)}
            data-testid="textarea-proofread"
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              className="mhk-btn-p"
              style={{ ...S.btnPrimary, opacity: isAnalyzing || !text.trim() ? 0.7 : 1 }}
              onClick={runAnalysis}
              disabled={isAnalyzing || !text.trim()}
              data-testid="btn-run-proofread"
            >
              {isAnalyzing
                ? <><div style={S.spinner} />{lang === 'ar' ? ' جاري التحليل…' : ' Analyzing…'}</>
                : <><span>🔍</span>{lang === 'ar' ? ' تشغيل التدقيق الشامل' : ' Run Full Analysis'}</>
              }
            </button>
            <button className="mhk-btn-o" style={S.btnOutline} onClick={copyText}>
              📋 {lang === 'ar' ? 'نسخ' : 'Copy'}
            </button>
            {hasRun && (
              <button className="mhk-btn-o" style={{ ...S.btnOutline, marginInlineStart: 'auto' }} onClick={printReport}>
                🖨️ {lang === 'ar' ? 'طباعة التقرير' : 'Print Report'}
              </button>
            )}
          </div>
        </div>

        {/* ─── AI Tools Section ─── */}
        {text.trim().length > 20 && (
          <div style={{ ...S.card, marginTop: 16 }}>
            {/* AI Tool Tab Bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#060d1a', borderRadius: 10, padding: 5, border: '1px solid #ffffff08' }}>
              {[
                { key: 'ai',       icon: '🤖', ar: 'تدقيق AI',  en: 'AI Proofread' },
                { key: 'dict',     icon: '📚', ar: 'القاموس',   en: 'Dictionary' },
                { key: 'summarize',icon: '✂️', ar: 'تلخيص',     en: 'Summarize' },
              ].map(t => (
                <button key={t.key}
                  style={{
                    flex: 1,
                    background: activeTab === t.key ? 'linear-gradient(135deg,#93c5fd22,#93c5fd11)' : 'transparent',
                    border: activeTab === t.key ? '1px solid #93c5fd44' : '1px solid transparent',
                    borderRadius: 8, padding: '8px 10px',
                    color: activeTab === t.key ? '#93c5fd' : '#64748b',
                    fontWeight: activeTab === t.key ? 700 : 500,
                    fontSize: 12, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit',
                  }}
                  onClick={() => setActiveTab(t.key as typeof activeTab)}
                >
                  {t.icon} {lang === 'ar' ? t.ar : t.en}
                </button>
              ))}
            </div>

            {/* AI Proofread Panel */}
            {activeTab === 'ai' && (
              <div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>
                  {lang === 'ar'
                    ? 'تدقيق لغوي عميق بالذكاء الاصطناعي مع التحقق من القواميس العربية والإنجليزية — يكشف الأخطاء الإملائية والنحوية والأسلوبية'
                    : 'Deep AI proofreading with Arabic & English dictionary verification — detects spelling, grammar, and style errors'}
                </p>
                <button
                  className="mhk-btn-p"
                  style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#93c5fd,#60a5fa)', boxShadow: '0 4px 20px #93c5fd44', opacity: aiLoading ? 0.7 : 1 }}
                  onClick={runAIProofread}
                  disabled={aiLoading}
                >
                  {aiLoading
                    ? <><div style={S.spinner} />{lang === 'ar' ? ' AI يحلل النص…' : ' AI analyzing…'}</>
                    : <><span>🤖</span>{lang === 'ar' ? ' تشغيل تدقيق AI' : ' Run AI Proofread'}</>
                  }
                </button>

                {aiError && (
                  <div style={{ marginTop: 12, background: '#1f0a0a', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
                    ⚠️ {aiError}
                  </div>
                )}

                {aiScore !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, background: '#060d1a', borderRadius: 10, padding: '12px 16px', border: '1px solid #ffffff08' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: `conic-gradient(${aiScore >= 80 ? '#10b981' : aiScore >= 55 ? '#f59e0b' : '#ef4444'} ${aiScore * 3.6}deg, #1e2940 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#060d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: aiScore >= 80 ? '#10b981' : aiScore >= 55 ? '#f59e0b' : '#ef4444' }}>{aiScore}</div>
                    </div>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>
                        {lang === 'ar' ? 'نتيجة الجودة اللغوية' : 'Language Quality Score'}
                      </div>
                      {aiSummaryText && <div style={{ color: '#64748b', fontSize: 12, marginTop: 3, lineHeight: 1.6 }}>{aiSummaryText}</div>}
                    </div>
                  </div>
                )}

                {aiIssues.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
                      {lang === 'ar' ? `تم اكتشاف ${aiIssues.length} ملاحظة لغوية:` : `Found ${aiIssues.length} language issues:`}
                    </p>
                    <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aiIssues.map((issue, i) => {
                        const sc = issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#60a5fa';
                        const typeLabel: Record<string, { ar: string; en: string }> = {
                          spelling:    { ar: 'إملاء', en: 'Spelling' },
                          grammar:     { ar: 'نحو', en: 'Grammar' },
                          style:       { ar: 'أسلوب', en: 'Style' },
                          vocabulary:  { ar: 'مفردات', en: 'Vocabulary' },
                          punctuation: { ar: 'ترقيم', en: 'Punctuation' },
                        };
                        return (
                          <div key={i} style={{ background: '#060d1a', border: `1px solid ${sc}33`, borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ background: sc + '22', color: sc, borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>
                                  {lang === 'ar' ? typeLabel[issue.type]?.ar : typeLabel[issue.type]?.en}
                                </span>
                                {issue.dictVerified && (
                                  <span style={{ background: '#10b98122', color: '#10b981', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>
                                    📖 {lang === 'ar' ? 'محقق من القاموس' : 'Dict. verified'}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                                <div style={{ background: '#1f0a0a', borderRadius: 7, padding: '7px 10px', border: '1px solid #ef444422' }}>
                                  <p style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, margin: '0 0 2px' }}>
                                    {lang === 'ar' ? '❌ الأصل' : '❌ Original'}
                                  </p>
                                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontFamily: 'monospace' }}>{issue.original}</p>
                                </div>
                                <span style={{ color: '#475569', fontSize: 16 }}>→</span>
                                <div style={{ background: '#0a1f15', borderRadius: 7, padding: '7px 10px', border: '1px solid #10b98122' }}>
                                  <p style={{ fontSize: 10, color: '#10b981', fontWeight: 700, margin: '0 0 2px' }}>
                                    {lang === 'ar' ? '✅ المقترح' : '✅ Suggestion'}
                                  </p>
                                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontFamily: 'monospace' }}>{issue.suggestion}</p>
                                </div>
                              </div>
                              {issue.explanation && (
                                <p style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.6, fontStyle: 'italic' }}>
                                  💡 {issue.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!aiLoading && aiIssues.length === 0 && aiScore !== null && (
                  <div style={{ marginTop: 12, textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36 }}>✅</div>
                    <p style={{ color: '#10b981', fontWeight: 700, marginTop: 8 }}>
                      {lang === 'ar' ? 'لا مشكلات لغوية! النص ممتاز.' : 'No language issues! Text looks great.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Dictionary Panel */}
            {activeTab === 'dict' && (
              <div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>
                  {lang === 'ar'
                    ? 'ابحث في القاموس العربي أو الإنجليزي — تعريف، مترادفات، أضداد، وأمثلة أكاديمية'
                    : 'Search Arabic or English dictionary — definition, synonyms, antonyms, and academic examples'}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={dictWord}
                    onChange={e => setDictWord(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupWord()}
                    placeholder={lang === 'ar' ? 'اكتب كلمة للبحث…' : 'Type a word to look up…'}
                    style={{ flex: 1, background: '#060d1a', border: '1px solid #ffffff15', borderRadius: 10, color: '#e2e8f0', fontSize: 14, padding: '10px 14px', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button
                    className="mhk-btn-p"
                    style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#5eead4,#2dd4bf)', boxShadow: '0 4px 20px #5eead433', padding: '10px 18px', opacity: dictLoading ? 0.7 : 1 }}
                    onClick={lookupWord}
                    disabled={dictLoading || !dictWord.trim()}
                  >
                    {dictLoading ? <div style={S.spinner} /> : '🔍'}
                  </button>
                </div>

                {dictError && (
                  <div style={{ marginTop: 12, background: '#1f0a0a', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
                    ⚠️ {dictError}
                  </div>
                )}

                {dictResult && (
                  <div style={{ marginTop: 14 }}>
                    {!dictResult.found ? (
                      <div style={{ background: '#1f0a0a', border: '1px solid #ef444433', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 32 }}>❓</div>
                        <p style={{ color: '#ef4444', fontWeight: 600, marginTop: 8 }}>
                          {lang === 'ar' ? `لم يُعثر على "${dictResult.word}" في القاموس` : `"${dictResult.word}" not found in dictionary`}
                        </p>
                      </div>
                    ) : (
                      <div style={{ background: '#060d1a', border: '1px solid #5eead433', borderRadius: 12, overflow: 'hidden' }}>
                        {/* Word header */}
                        <div style={{ background: 'linear-gradient(135deg,#5eead422,#2dd4bf11)', padding: '14px 18px', borderBottom: '1px solid #5eead422' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ color: '#5eead4', fontSize: 22, fontWeight: 800 }}>{dictResult.word}</span>
                            <span style={{ background: '#5eead422', color: '#5eead4', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{dictResult.partOfSpeech}</span>
                          </div>
                          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, lineHeight: 1.7, marginBottom: 0 }}>{dictResult.definition}</p>
                        </div>
                        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {dictResult.synonyms?.length > 0 && (
                            <div>
                              <p style={{ color: '#10b981', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>✅ {lang === 'ar' ? 'المترادفات' : 'Synonyms'}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {dictResult.synonyms.map((s, i) => (
                                  <span key={i}
                                    onClick={() => { setDictWord(s); }}
                                    style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98133', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}
                                  >{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {dictResult.antonyms?.length > 0 && (
                            <div>
                              <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>⇔ {lang === 'ar' ? 'الأضداد' : 'Antonyms'}</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {dictResult.antonyms.map((a, i) => (
                                  <span key={i} style={{ background: '#ef444422', color: '#f87171', border: '1px solid #ef444433', borderRadius: 6, padding: '3px 10px', fontSize: 12 }}>{a}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {dictResult.examples?.length > 0 && (
                            <div>
                              <p style={{ color: '#93c5fd', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>📖 {lang === 'ar' ? 'أمثلة' : 'Examples'}</p>
                              {dictResult.examples.map((ex, i) => (
                                <p key={i} style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7, margin: '0 0 4px', fontStyle: 'italic' }}>— {ex}</p>
                              ))}
                            </div>
                          )}
                          {dictResult.note && (
                            <div style={{ background: '#C9A84C11', border: '1px solid #C9A84C33', borderRadius: 8, padding: '8px 12px' }}>
                              <p style={{ color: '#C9A84C', fontSize: 12, margin: 0, lineHeight: 1.7 }}>💡 {dictResult.note}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Summarize Panel */}
            {activeTab === 'summarize' && (
              <div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>
                  {lang === 'ar'
                    ? 'تلخيص ذكي للنص بثلاث صيغ: قصير، نقاط رئيسية، ومستخلص أكاديمي'
                    : 'Smart text summarization in three formats: short, key points, and academic abstract'}
                </p>

                {/* Mode Selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { key: 'short',    ar: '📄 تلخيص قصير',       en: '📄 Short Summary' },
                    { key: 'bullets',  ar: '📌 نقاط رئيسية',      en: '📌 Key Points' },
                    { key: 'academic', ar: '🎓 مستخلص أكاديمي',   en: '🎓 Academic Abstract' },
                  ].map(m => (
                    <button key={m.key}
                      onClick={() => setSummaryMode(m.key as typeof summaryMode)}
                      style={{
                        background: summaryMode === m.key ? '#c4b5fd22' : 'transparent',
                        color: summaryMode === m.key ? '#c4b5fd' : '#64748b',
                        border: summaryMode === m.key ? '1px solid #c4b5fd44' : '1px solid #ffffff11',
                        borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {lang === 'ar' ? m.ar : m.en}
                    </button>
                  ))}
                </div>

                <button
                  className="mhk-btn-p"
                  style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#c4b5fd,#a78bfa)', boxShadow: '0 4px 20px #c4b5fd44', opacity: summaryLoading ? 0.7 : 1 }}
                  onClick={runSummarize}
                  disabled={summaryLoading}
                >
                  {summaryLoading
                    ? <><div style={S.spinner} />{lang === 'ar' ? ' AI يلخص…' : ' AI summarizing…'}</>
                    : <><span>✂️</span>{lang === 'ar' ? ' تلخيص بالذكاء الاصطناعي' : ' AI Summarize'}</>
                  }
                </button>

                {summaryError && (
                  <div style={{ marginTop: 12, background: '#1f0a0a', border: '1px solid #ef444433', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
                    ⚠️ {summaryError}
                  </div>
                )}

                {summaryResult && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Word count info */}
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[
                        { label: lang === 'ar' ? 'الأصل' : 'Original', value: summaryResult.originalWordCount, color: '#64748b' },
                        { label: lang === 'ar' ? 'الملخص' : 'Summary', value: summaryResult.summaryWordCount, color: '#c4b5fd' },
                        { label: lang === 'ar' ? 'الاختصار' : 'Reduction',
                          value: summaryResult.originalWordCount > 0 ? `${Math.round((1 - summaryResult.summaryWordCount / summaryResult.originalWordCount) * 100)}%` : '–',
                          color: '#10b981' },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, background: '#060d1a', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid #ffffff08' }}>
                          <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                          <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Short summary */}
                    {summaryMode === 'short' && summaryResult.short && (
                      <div style={{ background: '#060d1a', border: '1px solid #c4b5fd33', borderRadius: 12, padding: '16px 18px' }}>
                        <p style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                          📄 {lang === 'ar' ? 'الملخص القصير' : 'Short Summary'}
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.8, margin: 0 }}>{summaryResult.short}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(summaryResult.short); toast({ title: lang === 'ar' ? 'تم النسخ' : 'Copied' }); }}
                          style={{ marginTop: 10, background: 'transparent', color: '#64748b', border: '1px solid #ffffff11', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          📋 {lang === 'ar' ? 'نسخ' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {/* Bullets */}
                    {summaryMode === 'bullets' && summaryResult.bullets?.length > 0 && (
                      <div style={{ background: '#060d1a', border: '1px solid #c4b5fd33', borderRadius: 12, padding: '16px 18px' }}>
                        <p style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>
                          📌 {lang === 'ar' ? 'النقاط الرئيسية' : 'Key Points'}
                        </p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {summaryResult.bullets.map((b, i) => (
                            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ color: '#c4b5fd', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>•</span>
                              <span style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Academic abstract */}
                    {summaryMode === 'academic' && summaryResult.academic && (
                      <div style={{ background: '#060d1a', border: '1px solid #c4b5fd33', borderRadius: 12, padding: '16px 18px' }}>
                        <p style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                          🎓 {lang === 'ar' ? 'المستخلص الأكاديمي' : 'Academic Abstract'}
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.9, margin: 0 }}>{summaryResult.academic}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(summaryResult.academic); toast({ title: lang === 'ar' ? 'تم النسخ' : 'Copied' }); }}
                          style={{ marginTop: 10, background: 'transparent', color: '#64748b', border: '1px solid #ffffff11', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          📋 {lang === 'ar' ? 'نسخ' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Row */}
        {hasRun && (
          <div className="mhk-fade" style={S.statGrid}>
            <div style={S.statCard}>
              <ProgressRing value={issues.length} max={Math.max(issues.length, 10)} color="#f59e0b" label={lang === 'ar' ? 'ملاحظات لغوية' : 'Language issues'} />
            </div>
            <div style={S.statCard}>
              <ProgressRing value={sections.filter(s => s.found).length} max={sections.length} color="#10b981" label={lang === 'ar' ? 'أقسام موجودة' : 'Sections found'} />
            </div>
            <div style={S.statCard}>
              <ProgressRing value={issues.filter(i => i.severity === 'warning').length} max={Math.max(issues.length, 5)} color="#ef4444" label={lang === 'ar' ? 'تحذيرات' : 'Warnings'} />
            </div>
          </div>
        )}

        {/* Tabs */}
        {hasRun && (
          <>
            <div style={S.tabBar}>
              {[
                { key: 'language',  label: `📝 ${lang === 'ar' ? `لغوي (${issues.length})` : `Language (${issues.length})`}` },
                { key: 'structure', label: `🏛️ ${lang === 'ar' ? 'البنية الأكاديمية' : 'Academic Structure'}` },
                { key: 'report',    label: `📋 ${lang === 'ar' ? 'التقرير المفصّل' : 'Detailed Report'}` },
              ].map(t => (
                <button key={t.key} style={tab(activeTab === t.key)} onClick={() => setActiveTab(t.key as typeof activeTab)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Language Tab */}
            {activeTab === 'language' && (
              <div className="mhk-fade" style={{ marginTop: 16 }}>
                {issues.length === 0 ? (
                  <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
                    <p style={{ color: '#10b981', fontWeight: 700, fontSize: 15 }}>{lang === 'ar' ? 'لا توجد ملاحظات لغوية!' : 'No language issues!'}</p>
                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{lang === 'ar' ? 'النص خالٍ من المشكلات المكتشفة' : 'No issues detected in this text'}</p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 520, overflowY: 'auto', paddingLeft: 4 }}>
                    {issues.map((issue, idx) => {
                      const exp = expandedId === issue.id;
                      const sc = severityColor[issue.severity] ?? '#ffffff';
                      return (
                        <div
                          key={issue.id}
                          className="mhk-issue"
                          style={{ ...issueCard(issue.severity, exp), animationDelay: `${idx * 40}ms` }}
                          onClick={() => setExpandedId(exp ? null : issue.id)}
                        >
                          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ background: sc + '22', color: sc, borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                              {lang === 'ar' ? `ص${issue.page}` : `P${issue.page}`}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={badge(sc)}>{lang === 'ar' ? issue.typeAr : issue.type}</span>
                              <p style={{ fontSize: 12, color: '#475569', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{issue.snippet}</p>
                            </div>
                            <span style={{ color: '#475569', fontSize: 14, flexShrink: 0 }}>{exp ? '▲' : '▼'}</span>
                          </div>
                          {exp && (
                            <div style={{ padding: '0 16px 14px', borderTop: '1px solid #ffffff08' }}>
                              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ background: '#0a0f1e', borderRadius: 9, padding: 12, border: '1px solid #ef444422' }}>
                                  <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginBottom: 5 }}>🔴 {lang === 'ar' ? 'المشكلة' : 'Problem'}</p>
                                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{lang === 'ar' ? issue.typeAr : issue.type}</p>
                                </div>
                                <div style={{ background: '#0a0f1e', borderRadius: 9, padding: 12, border: '1px solid #10b98122' }}>
                                  <p style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginBottom: 5 }}>✅ {lang === 'ar' ? 'الحل المقترح' : 'Fix'}</p>
                                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{lang === 'ar' ? issue.fixAr : issue.fix}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Structure Tab */}
            {activeTab === 'structure' && (
              <div className="mhk-fade" style={{ marginTop: 16 }}>
                <p style={{ color: '#475569', fontSize: 13, marginBottom: 14 }}>
                  {lang === 'ar' ? 'فحص الأقسام الأكاديمية الخمسة المطلوبة في البحث العلمي' : 'Checking 5 required academic sections'}
                </p>
                {sections.map((sec, idx) => {
                  const cm = confidenceMeta[sec.confidence];
                  return (
                    <div key={sec.key} className="mhk-sec" style={{ ...secCard(sec.found), animationDelay: `${idx * 80}ms` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 11, background: sec.found ? '#10b98122' : '#ef444422', border: `1px solid ${sec.found ? '#10b98144' : '#ef444444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                            {sec.emoji}
                          </div>
                          <div>
                            <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{sec.labelAr}</p>
                            <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>{sec.labelEn}</p>
                          </div>
                        </div>
                        <span style={badge(cm.color)}>{lang === 'ar' ? cm.ar : cm.en}</span>
                      </div>
                      {sec.found && sec.excerpt && (
                        <div style={{ marginTop: 10, background: '#060d1a', borderRadius: 7, padding: '9px 12px', border: '1px solid #ffffff08' }}>
                          <p style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{sec.excerpt}</p>
                        </div>
                      )}
                      {!sec.found && (
                        <div style={{ marginTop: 10, background: '#1f0a0a', borderRadius: 7, padding: '9px 12px', border: '1px solid #ef444422' }}>
                          <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>
                            ⚠️ {lang === 'ar'
                              ? `لم يُعثر على قسم "${sec.labelAr}" — أضف عنواناً واضحاً لهذا القسم`
                              : `"${sec.labelEn}" not found — add a clear section heading`}
                          </p>
                        </div>
                      )}
                      {sec.issues.map((iss, i) => (
                        <div key={i} style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ background: '#1f0a0a', borderRadius: 7, padding: '9px 12px', border: '1px solid #f59e0b22' }}>
                            <p style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700, margin: '0 0 3px' }}>⚠️ {lang === 'ar' ? 'ملاحظة' : 'Note'}</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{lang === 'ar' ? sec.issuesAr[i] : iss}</p>
                          </div>
                          <div style={{ background: '#0a1f15', borderRadius: 7, padding: '9px 12px', border: '1px solid #10b98122' }}>
                            <p style={{ color: '#10b981', fontSize: 11, fontWeight: 700, margin: '0 0 3px' }}>✅ {lang === 'ar' ? 'الحل' : 'Fix'}</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{lang === 'ar' ? sec.fixesAr[i] : sec.fixes[i]}</p>
                          </div>
                        </div>
                      ))}
                      {sec.found && sec.issues.length === 0 && (
                        <div style={{ marginTop: 8, color: '#10b981', fontSize: 12 }}>
                          ✓ {lang === 'ar' ? 'القسم موجود ويبدو مكتملاً' : 'Section found and complete'}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ ...S.card, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{lang === 'ar' ? 'الأقسام المكتملة' : 'Sections found'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sections.map(s => (
                      <div key={s.key} title={s.labelAr} style={{ width: 9, height: 9, borderRadius: '50%', background: s.found ? '#10b981' : '#ef4444' }} />
                    ))}
                    <span style={{ color: '#C9A84C', fontWeight: 900, fontSize: 20, marginInlineStart: 6 }}>
                      {sections.filter(s => s.found).length}/{sections.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="mhk-fade" style={{ marginTop: 16 }}>
                <div ref={reportRef} style={{ ...S.card, lineHeight: 1.8 }}>
                  <div style={{ borderBottom: '2px solid #C9A84C', paddingBottom: 16, marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #C9A84C, #f5d78e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📝</div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#C9A84C' }}>
                          {lang === 'ar' ? 'تقرير التدقيق الأكاديمي الشامل' : 'Comprehensive Proofreading Report'}
                        </h2>
                        <p style={{ margin: '3px 0 0', color: '#475569', fontSize: 11 }}>
                          {lang === 'ar'
                            ? `التاريخ: ${today} · الصفحات: ${totalPages} · الملاحظات: ${issues.length + sections.filter(s => s.issues.length > 0 || !s.found).length}`
                            : `Date: ${today} · Pages: ${totalPages} · Issues: ${issues.length + sections.filter(s => s.issues.length > 0 || !s.found).length}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {issues.length > 0 && (
                    <div style={{ marginBottom: 26 }}>
                      <h3 style={{ color: '#C9A84C', margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
                        📝 {lang === 'ar' ? 'أولاً: الملاحظات اللغوية' : 'A. Language Observations'}
                      </h3>
                      <div style={{ display: 'grid', gap: 9 }}>
                        {issues.map((issue, idx) => (
                          <div key={issue.id} style={{ background: '#060d1a', border: '1px solid #ffffff10', borderRadius: 11, padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, flexWrap: 'wrap' }}>
                              <span style={{ color: '#C9A84C', fontWeight: 900 }}>#{idx + 1}</span>
                              <span style={badge(severityColor[issue.severity] ?? '#fff')}>{lang === 'ar' ? issue.typeAr : issue.type}</span>
                              <span style={{ color: '#475569', fontSize: 11 }}>{lang === 'ar' ? `الصفحة ${issue.page}` : `Page ${issue.page}`}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                              <div>
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{lang === 'ar' ? 'النص المُشار إليه:' : 'Reference:'}</span>
                                <p style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', margin: '3px 0', background: '#0a0f1e', padding: '5px 9px', borderRadius: 5 }}>"{issue.snippet}"</p>
                              </div>
                              <div>
                                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>{lang === 'ar' ? 'الحل المقترح:' : 'Fix:'}</span>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0', lineHeight: 1.6 }}>{lang === 'ar' ? issue.fixAr : issue.fix}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: 26 }}>
                    <h3 style={{ color: '#C9A84C', margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 7 }}>
                      🏛️ {lang === 'ar' ? 'ثانياً: البنية الأكاديمية' : 'B. Academic Structure'}
                    </h3>
                    <div style={{ display: 'grid', gap: 9 }}>
                      {sections.map((sec, idx) => {
                        const ok = sec.found && sec.issues.length === 0;
                        return (
                          <div key={sec.key} style={{ background: '#060d1a', border: `1px solid ${ok ? '#10b98122' : '#f59e0b22'}`, borderRadius: 11, padding: '13px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <span style={{ fontSize: 22, flexShrink: 0 }}>{sec.emoji}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 800, fontSize: 13 }}>{sec.labelAr}</span>
                                <span style={badge(ok ? '#10b981' : !sec.found ? '#ef4444' : '#f59e0b')}>
                                  {ok
                                    ? (lang === 'ar' ? 'مكتمل ✓' : 'Complete ✓')
                                    : !sec.found
                                      ? (lang === 'ar' ? 'غير موجود' : 'Missing')
                                      : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs improvement')}
                                </span>
                              </div>
                              {!sec.found && (
                                <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 3px' }}>
                                  {lang === 'ar' ? `أضف قسم "${sec.labelAr}" مع عنوان واضح وبمحتوى كافٍ` : `Add "${sec.labelEn}" with a clear heading`}
                                </p>
                              )}
                              {sec.issues.map((iss, i) => (
                                <div key={i} style={{ marginTop: 5 }}>
                                  <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 2px' }}>⚠️ {lang === 'ar' ? sec.issuesAr[i] : iss}</p>
                                  <p style={{ fontSize: 12, color: '#10b981', margin: 0 }}>← {lang === 'ar' ? sec.fixesAr[i] : sec.fixes[i]}</p>
                                </div>
                              ))}
                              {ok && <p style={{ fontSize: 12, color: '#10b981', margin: 0 }}>{lang === 'ar' ? 'القسم موجود ويبدو مكتملاً' : 'Section found and complete'}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #ffffff08', paddingTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { icon: '📝', label: lang === 'ar' ? 'الملاحظات اللغوية' : 'Language issues', value: issues.length, color: '#f59e0b' },
                      { icon: '🏛️', label: lang === 'ar' ? 'الأقسام الموجودة' : 'Sections found', value: `${sections.filter(s => s.found).length}/${sections.length}`, color: '#10b981' },
                      { icon: '⭐', label: lang === 'ar' ? 'التقييم العام' : 'Overall', value: score >= 80 ? (lang === 'ar' ? 'ممتاز' : 'Excellent') : score >= 50 ? (lang === 'ar' ? 'جيد' : 'Good') : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs work'), color: '#C9A84C' },
                    ].map(item => (
                      <div key={item.label} style={{ background: '#060d1a', border: '1px solid #ffffff08', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, marginBottom: 5 }}>{item.icon}</div>
                        <p style={{ fontSize: 20, fontWeight: 900, color: item.color, margin: '0 0 3px' }}>{item.value}</p>
                        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!hasRun && (
          <div style={{ ...S.card, textAlign: 'center', padding: '50px 22px', marginTop: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 14, animation: 'mhk-pulse 2s ease infinite' }}>🔬</div>
            <h3 style={{ color: '#C9A84C', fontWeight: 800, fontSize: 18, margin: '0 0 8px' }}>
              {lang === 'ar' ? 'جاهز للتدقيق الأكاديمي' : 'Ready for Academic Analysis'}
            </h3>
            <p style={{ color: '#475569', fontSize: 13, margin: 0, lineHeight: 1.8 }}>
              {lang === 'ar'
                ? 'الصق نص بحثك في الحقل أعلاه · سيحلّل محكّم: اللغة · البنية · الجودة الأكاديمية'
                : 'Paste your text above · Muhakkim will analyze: Language · Structure · Academic Quality'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24, flexWrap: 'wrap' }}>
              {[
                ['📄', 'المستخلص',      'Abstract'],
                ['📚', 'الإطار النظري', 'Framework'],
                ['🔬', 'المنهجية',      'Methodology'],
                ['📊', 'النتائج',       'Results'],
                ['💡', 'التوصيات',      'Recommendations'],
              ].map(([emoji, ar, en]) => (
                <div key={ar} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: '#C9A84C15', border: '1px solid #C9A84C33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{emoji}</div>
                  <span style={{ fontSize: 11, color: '#475569' }}>{lang === 'ar' ? ar : en}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
