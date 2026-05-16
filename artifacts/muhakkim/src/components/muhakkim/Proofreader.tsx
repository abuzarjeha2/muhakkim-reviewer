import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, CheckCircle2, Copy, FileCheck2,
  BookOpen, FlaskConical, BarChart2, Lightbulb,
  AlignLeft, Printer, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProofreaderProps {
  text: string;
}

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
  icon: React.ReactNode;
  found: boolean;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  excerpt: string;
  issues: string[];
  issuesAr: string[];
  fixes: string[];
  fixesAr: string[];
}

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
    en: ['methodology', 'research method', 'methods', 'research design', 'procedure', 'sample', 'participants', 'data collection'],
  },
  results: {
    ar: ['النتائج', 'نتائج الدراسة', 'نتائج التحليل', 'المناقشة', 'نتائج البحث', 'عرض النتائج', 'تحليل البيانات'],
    en: ['results', 'findings', 'analysis', 'discussion', 'outcomes', 'data analysis'],
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
  const issues: string[] = [];
  const issuesAr: string[] = [];
  const fixes: string[] = [];
  const fixesAr: string[] = [];
  const wc = text.trim().split(/\s+/).filter(Boolean).length;

  if (key === 'abstract') {
    if (wc < 100) {
      issues.push('Abstract is short (< 100 words)');
      issuesAr.push('المستخلص قصير جداً (أقل من 100 كلمة)');
      fixes.push('Expand the abstract to cover objectives, method, results, and conclusions (150–300 words recommended).');
      fixesAr.push('وسّع المستخلص ليشمل الأهداف والمنهج والنتائج والاستنتاجات (يُنصح بـ 150–300 كلمة).');
    }
    if (wc > 350) {
      issues.push('Abstract is too long (> 350 words)');
      issuesAr.push('المستخلص طويل جداً (أكثر من 350 كلمة)');
      fixes.push('Trim the abstract to 150–300 words focusing on key points only.');
      fixesAr.push('اختصر المستخلص إلى 150–300 كلمة مع التركيز على النقاط الجوهرية فقط.');
    }
    if (!/keyword|كلمات مفتاحية/i.test(text)) {
      issues.push('No keywords section detected');
      issuesAr.push('لا توجد كلمات مفتاحية');
      fixes.push('Add 4–6 keywords after the abstract (e.g., "Keywords: peer review, research, methodology").');
      fixesAr.push('أضف 4–6 كلمات مفتاحية بعد المستخلص (مثال: "كلمات مفتاحية: تحكيم، منهجية، بحث").');
    }
  }
  if (key === 'theoretical') {
    if (wc < 200) {
      issues.push('Theoretical framework appears brief');
      issuesAr.push('الإطار النظري مقتضب');
      fixes.push('Expand this section with more related theories, models, and literature citations.');
      fixesAr.push('وسّع هذا القسم بإضافة مزيد من النظريات والنماذج والمراجع ذات الصلة.');
    }
    if (!/\(\d{4}\)|et al\.|وآخرون|هـ\)|م\)/.test(text)) {
      issues.push('No citations detected in theoretical framework');
      issuesAr.push('لا توجد استشهادات واضحة في الإطار النظري');
      fixes.push('Add in-text citations in APA format, e.g., (Author, 2020) or (المؤلف، 2020هـ).');
      fixesAr.push('أضف استشهادات داخل النص بصيغة APA مثل: (المؤلف، 2020) أو (Author, 2020).');
    }
  }
  if (key === 'methodology') {
    if (!/sample|عينة|مجتمع|participants/i.test(text)) {
      issues.push('No sample/population mentioned');
      issuesAr.push('لم يُذكر مجتمع الدراسة أو العينة');
      fixes.push('Clearly describe the study population, sample size, and selection method.');
      fixesAr.push('صِف بوضوح مجتمع الدراسة وحجم العينة وطريقة اختيارها.');
    }
    if (!/instrument|أداة|questionnaire|استبيان|مقياس/i.test(text)) {
      issues.push('No research instrument mentioned');
      issuesAr.push('لم تُذكر أداة الدراسة');
      fixes.push('Specify the data collection instrument (questionnaire, interview, observation, etc.) and its validity/reliability.');
      fixesAr.push('حدّد أداة جمع البيانات (استبيان، مقابلة، ملاحظة، إلخ) مع ذكر صدقها وثباتها.');
    }
  }
  if (key === 'results') {
    if (!/table|جدول|figure|شكل|%|p\s*[=<>]|sig|دلالة/i.test(text)) {
      issues.push('No tables, figures, or statistical output detected');
      issuesAr.push('لا توجد جداول أو مخرجات إحصائية');
      fixes.push('Present results using numbered tables or figures with statistical values (means, SD, p-values).');
      fixesAr.push('اعرض النتائج باستخدام جداول أو أشكال مرقّمة تتضمن قيماً إحصائية (متوسطات، انحراف معياري، قيم p).');
    }
  }
  if (key === 'recommendations') {
    if (wc < 50) {
      issues.push('Recommendations section is very short');
      issuesAr.push('قسم التوصيات قصير جداً');
      fixes.push('Add at least 3–5 specific, actionable recommendations based on the study findings.');
      fixesAr.push('أضف 3–5 توصيات محددة وقابلة للتطبيق مستنبطة من نتائج الدراسة.');
    }
  }
  return { issues, issuesAr, fixes, fixesAr };
}

export default function Proofreader({ text: initialText }: ProofreaderProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState(initialText);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'structure' | 'report'>('language');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialText && !hasRun) setText(initialText);
  }, [initialText, hasRun]);

  const toggleExpand = (id: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runAnalysis = () => {
    if (!text.trim()) return;
    const langIssues = runLanguageCheck(text);
    const secResults = runStructureCheck(text);
    setIssues(langIssues);
    setSections(secResults);
    setHasRun(true);
    setActiveTab('language');
  };

  const runLanguageCheck = (body: string): Issue[] => {
    const paragraphs = body.split(/\n{1,}/);
    const found: Issue[] = [];
    let id = 1;
    let wordsSoFar = 0;

    // Word frequency for repetition detection
    const wordFreq: Record<string, number> = {};
    body.toLowerCase().split(/\s+/).forEach(w => {
      const clean = w.replace(/[^\u0600-\u06FFa-zA-Z]/g, '');
      if (clean.length > 5) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });
    const repeatedWords = new Set(
      Object.entries(wordFreq).filter(([, c]) => c > 6).map(([w]) => w)
    );

    const passiveAr = ['تم ', 'يتم ', 'كانت ', 'قد تم', 'سيتم'];
    const passiveEn = [' was ', ' were ', ' has been ', ' have been ', ' had been '];

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed || trimmed.length < 20) {
        wordsSoFar += trimmed.split(/\s+/).filter(Boolean).length;
        return;
      }

      const paraWords = trimmed.split(/\s+/).filter(Boolean).length;
      const page = getPage(wordsSoFar);

      // — Long sentences: split by sentence-ending punctuation
      const sentences = trimmed.split(/(?<=[.!?؟])\s+(?=[^\d])/).filter(s => s.trim().length > 30);
      sentences.forEach(sent => {
        const wc = sent.trim().split(/\s+/).filter(Boolean).length;
        if (wc > 50) {
          found.push({
            id: id++, page, category: 'style',
            type: 'Long sentence (>50 words)',
            typeAr: 'جملة طويلة (أكثر من 50 كلمة)',
            snippet: sent.trim().slice(0, 80) + (sent.length > 80 ? '…' : ''),
            fix: 'Break this sentence into 2–3 shorter sentences, each expressing one idea clearly.',
            fixAr: 'قسّم هذه الجملة إلى 2–3 جمل أقصر، كل جملة تعبّر عن فكرة واحدة بوضوح.',
            severity: 'warning',
          });
        }
      });

      // — Passive voice Arabic
      passiveAr.forEach(p => {
        if (trimmed.includes(p) && !found.some(i => i.page === page && i.typeAr === 'صيغة المبني للمجهول' && i.snippet === trimmed.slice(0, 60))) {
          found.push({
            id: id++, page, category: 'style',
            type: 'Arabic passive voice',
            typeAr: 'صيغة المبني للمجهول',
            snippet: trimmed.slice(0, 70) + '…',
            fix: 'Convert passive constructions to active voice to improve readability (e.g., "تم تطبيق الاختبار" → "طبّق الباحث الاختبار").',
            fixAr: 'حوّل الجمل من المبني للمجهول إلى المبني للمعلوم لتحسين الوضوح (مثال: "تم تطبيق الاختبار" → "طبّق الباحث الاختبار").',
            severity: 'info',
          });
        }
      });

      // — Passive voice English
      passiveEn.forEach(p => {
        if (trimmed.toLowerCase().includes(p)) {
          found.push({
            id: id++, page, category: 'style',
            type: 'English passive voice',
            typeAr: 'مبني للمجهول (إنجليزي)',
            snippet: trimmed.slice(0, 70) + '…',
            fix: 'Prefer active voice: instead of "was conducted", write "the researcher conducted".',
            fixAr: 'استخدم المبني للمعلوم: بدلاً من "was conducted" اكتب "the researcher conducted".',
            severity: 'info',
          });
        }
      });

      // — Repeated words (once per paragraph, most frequent repeated word)
      const paraWordList = trimmed.toLowerCase().split(/\s+/).map(w => w.replace(/[^\u0600-\u06FFa-zA-Z]/g, ''));
      const paraFreq: Record<string, number> = {};
      paraWordList.forEach(w => { if (repeatedWords.has(w)) paraFreq[w] = (paraFreq[w] || 0) + 1; });
      const topRepeated = Object.entries(paraFreq).sort((a, b) => b[1] - a[1])[0];
      if (topRepeated && topRepeated[1] >= 3) {
        found.push({
          id: id++, page, category: 'style',
          type: `Repeated word: "${topRepeated[0]}" (${topRepeated[1]}×)`,
          typeAr: `تكرار الكلمة: "${topRepeated[0]}" (${topRepeated[1]} مرات)`,
          snippet: trimmed.slice(0, 60) + '…',
          fix: `Replace some occurrences of "${topRepeated[0]}" with synonyms to avoid repetition.`,
          fixAr: `استبدل بعض تكرارات كلمة "${topRepeated[0]}" بمترادفات لتجنب الإعادة.`,
          severity: 'info',
        });
      }

      // — Missing sentence-end punctuation: only for long paragraphs (≥15 words) not ending with punctuation
      if (paraWords >= 15 && !/[.!?؟،]$/.test(trimmed)) {
        found.push({
          id: id++, page, category: 'grammar',
          type: 'Missing end punctuation',
          typeAr: 'غياب علامة الترقيم في نهاية الفقرة',
          snippet: '…' + trimmed.slice(-50),
          fix: 'Add a period or appropriate punctuation mark at the end of this paragraph.',
          fixAr: 'أضف نقطة أو علامة ترقيم مناسبة في نهاية هذه الفقرة.',
          severity: 'warning',
        });
      }

      wordsSoFar += paraWords;
    });

    return found;
  };

  const runStructureCheck = (body: string): SectionResult[] => {
    const defs = [
      { key: 'abstract',         labelAr: 'المستخلص',          labelEn: 'Abstract',              icon: <AlignLeft className="w-4 h-4" /> },
      { key: 'theoretical',      labelAr: 'الإطار النظري',      labelEn: 'Theoretical Framework', icon: <BookOpen className="w-4 h-4" /> },
      { key: 'methodology',      labelAr: 'المنهجية',           labelEn: 'Methodology',           icon: <FlaskConical className="w-4 h-4" /> },
      { key: 'results',          labelAr: 'نتائج التحليل',      labelEn: 'Results & Analysis',    icon: <BarChart2 className="w-4 h-4" /> },
      { key: 'recommendations',  labelAr: 'التوصيات',           labelEn: 'Recommendations',       icon: <Lightbulb className="w-4 h-4" /> },
    ];
    return defs.map(def => {
      const { found, excerpt, confidence } = findSection(body, SECTION_PATTERNS[def.key]);
      const { issues, issuesAr, fixes, fixesAr } = found ? analyzeSection(body, def.key) : { issues: [], issuesAr: [], fixes: [], fixesAr: [] };
      return { ...def, found, confidence, excerpt, issues, issuesAr, fixes, fixesAr };
    });
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    toast({ title: lang === 'ar' ? 'تم نسخ النص' : 'Text copied' });
  };

  const printReport = () => {
    if (reportRef.current) {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`
        <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8"/>
          <title>${lang === 'ar' ? 'تقرير التدقيق — محكّم' : 'Proofreading Report — Muhakkim'}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; direction: ${lang === 'ar' ? 'rtl' : 'ltr'}; padding: 30px; color: #1a1a2e; font-size: 13px; }
            h1 { font-size: 20px; border-bottom: 2px solid #C9A84C; padding-bottom: 8px; margin-bottom: 4px; }
            .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #0F1B2D; color: #C9A84C; padding: 8px 10px; text-align: ${lang === 'ar' ? 'right' : 'left'}; font-size: 12px; }
            td { padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; font-size: 12px; }
            tr:nth-child(even) { background: #f9f9f9; }
            .badge-warning { background:#f59e0b; color:#fff; border-radius:4px; padding:1px 6px; font-size:11px; }
            .badge-info { background:#3b82f6; color:#fff; border-radius:4px; padding:1px 6px; font-size:11px; }
            .badge-error { background:#ef4444; color:#fff; border-radius:4px; padding:1px 6px; font-size:11px; }
            .section-title { font-size:15px; font-weight:bold; margin-top:24px; margin-bottom:8px; border-bottom:1px solid #C9A84C; padding-bottom:4px; color:#0F1B2D; }
            .found { color: #16a34a; font-weight: bold; }
            .missing { color: #dc2626; font-weight: bold; }
            .fix { color: #1d4ed8; font-style: italic; }
            @media print { button { display:none; } }
          </style>
        </head>
        <body>
          ${reportRef.current.innerHTML}
          <script>window.print();<\/script>
        </body>
        </html>`);
      win.document.close();
    }
  };

  const score = (() => {
    if (!hasRun) return null;
    const w = issues.filter(i => i.severity === 'warning').length;
    const missing = sections.filter(s => !s.found).length;
    const total = w + missing * 2;
    if (total === 0) return { label: lang === 'ar' ? 'ممتاز' : 'Excellent', color: 'bg-green-600 text-white' };
    if (total <= 4)  return { label: lang === 'ar' ? 'جيد' : 'Good', color: 'bg-primary text-primary-foreground' };
    return { label: lang === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement', color: 'bg-amber-600 text-white' };
  })();

  const severityStyle = {
    error:   { card: 'border-red-500/40 bg-red-500/5',    badge: 'bg-red-600 text-white' },
    warning: { card: 'border-amber-500/40 bg-amber-500/5', badge: 'bg-amber-600 text-white' },
    info:    { card: 'border-blue-500/40 bg-blue-500/5',   badge: 'bg-blue-700 text-white' },
  };

  const confidenceLabel: Record<string, { ar: string; en: string; color: string }> = {
    high:    { ar: 'موجود',      en: 'Found',         color: 'bg-green-600 text-white' },
    medium:  { ar: 'محتمل',     en: 'Likely found',  color: 'bg-primary text-primary-foreground' },
    low:     { ar: 'جزئي',      en: 'Partial',       color: 'bg-amber-600 text-white' },
    missing: { ar: 'غير موجود', en: 'Not detected',  color: 'bg-red-600 text-white' },
  };

  const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  const totalPages = Math.max(1, getPage(text.trim().split(/\s+/).filter(Boolean).length));

  return (
    <div className="space-y-5">
      <Textarea
        className="min-h-[200px] resize-y font-sans text-sm p-4 leading-relaxed bg-card border-border text-foreground"
        placeholder={lang === 'ar' ? 'الصق نص البحث هنا للتدقيق الشامل…' : 'Paste your research text here for full analysis…'}
        value={text}
        onChange={e => setText(e.target.value)}
        data-testid="textarea-proofread"
      />

      <div className="flex gap-3">
        <Button onClick={runAnalysis} className="flex-1" data-testid="btn-run-proofread">
          <FileCheck2 className="w-4 h-4 me-2" />
          {lang === 'ar' ? 'تشغيل التدقيق الشامل' : 'Run Full Analysis'}
        </Button>
        <Button variant="outline" onClick={copyText} data-testid="btn-copy-proofread">
          <Copy className="w-4 h-4 me-2" />
          {lang === 'ar' ? 'نسخ' : 'Copy'}
        </Button>
      </div>

      {hasRun && (
        <>
          {/* Tab bar + score */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={activeTab === 'language' ? 'default' : 'outline'} onClick={() => setActiveTab('language')} data-testid="tab-language">
              <AlertCircle className="w-3.5 h-3.5 me-1.5" />
              {lang === 'ar' ? `لغوي (${issues.length})` : `Language (${issues.length})`}
            </Button>
            <Button size="sm" variant={activeTab === 'structure' ? 'default' : 'outline'} onClick={() => setActiveTab('structure')} data-testid="tab-structure">
              <BookOpen className="w-3.5 h-3.5 me-1.5" />
              {lang === 'ar' ? 'البنية الأكاديمية' : 'Academic Structure'}
            </Button>
            <Button size="sm" variant={activeTab === 'report' ? 'default' : 'outline'} onClick={() => setActiveTab('report')} data-testid="tab-report">
              <Printer className="w-3.5 h-3.5 me-1.5" />
              {lang === 'ar' ? 'تقرير مفصّل' : 'Detailed Report'}
            </Button>
            {score && <Badge className={`ms-auto ${score.color} px-3 py-1`}>{score.label}</Badge>}
          </div>

          {/* ── Language tab ── */}
          {activeTab === 'language' && (
            <Card className="border-border bg-secondary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  {lang === 'ar' ? 'الملاحظات اللغوية' : 'Language Observations'}
                  <span className="text-muted-foreground text-sm font-normal">
                    — {issues.length} {lang === 'ar' ? 'ملاحظة' : 'items'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {issues.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span>{lang === 'ar' ? 'لا توجد ملاحظات لغوية' : 'No language issues found!'}</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pe-1">
                    {issues.map(issue => {
                      const expanded = expandedIssues.has(issue.id);
                      const s = severityStyle[issue.severity];
                      return (
                        <div key={issue.id} className={`border rounded-lg overflow-hidden ${s.card}`}>
                          <button
                            className="w-full text-start p-3 flex items-start gap-3"
                            onClick={() => toggleExpand(issue.id)}
                          >
                            <span className="text-xs font-mono bg-background/60 px-2 py-0.5 rounded shrink-0 text-muted-foreground">
                              {lang === 'ar' ? `ص${issue.page}` : `P${issue.page}`}
                            </span>
                            <div className="flex-1 min-w-0">
                              <Badge className={`text-xs px-2 py-0 mb-1 ${s.badge}`}>
                                {lang === 'ar' ? issue.typeAr : issue.type}
                              </Badge>
                              <p className="text-xs font-mono text-muted-foreground truncate">{issue.snippet}</p>
                            </div>
                            <span className="text-muted-foreground shrink-0 mt-0.5">
                              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </button>
                          {expanded && (
                            <div className="px-3 pb-3 border-t border-border/30 bg-background/40">
                              <p className="text-xs text-muted-foreground mt-2 mb-1 font-medium">
                                {lang === 'ar' ? 'المشكلة:' : 'Issue:'}
                              </p>
                              <p className="text-xs text-foreground/80 mb-2">
                                {lang === 'ar' ? issue.typeAr : issue.type}
                                <span className="text-muted-foreground ms-2">({lang === 'ar' ? issue.type : issue.typeAr})</span>
                              </p>
                              <p className="text-xs font-medium text-green-400 mb-1">
                                {lang === 'ar' ? 'طريقة الحل:' : 'How to fix:'}
                              </p>
                              <p className="text-xs text-foreground/80">
                                {lang === 'ar' ? issue.fixAr : issue.fix}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Structure tab ── */}
          {activeTab === 'structure' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === 'ar' ? 'فحص الأقسام الأكاديمية الأساسية في النص' : 'Checking required academic sections'}
              </p>
              {sections.map(sec => {
                const cl = confidenceLabel[sec.confidence];
                return (
                  <Card key={sec.key} className={`border ${sec.found ? 'border-green-500/30' : 'border-red-500/40 bg-red-500/5'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-primary">{sec.icon}</span>
                          <p className="font-semibold text-sm">
                            {lang === 'ar' ? sec.labelAr : sec.labelEn}
                            <span className="text-muted-foreground font-normal text-xs ms-2">
                              {lang === 'ar' ? sec.labelEn : sec.labelAr}
                            </span>
                          </p>
                        </div>
                        <Badge className={`text-xs px-2 shrink-0 ${cl.color}`}>
                          {lang === 'ar' ? cl.ar : cl.en}
                        </Badge>
                      </div>
                      {sec.found && sec.excerpt && (
                        <p className="mt-2 text-xs text-muted-foreground bg-background/60 px-3 py-1.5 rounded font-mono truncate">{sec.excerpt}</p>
                      )}
                      {!sec.found && (
                        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {lang === 'ar' ? `لم يُعثر على قسم "${sec.labelAr}"` : `"${sec.labelEn}" not detected`}
                        </p>
                      )}
                      {sec.issues.map((iss, i) => (
                        <div key={i} className="mt-2">
                          <p className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {lang === 'ar' ? sec.issuesAr[i] : iss}
                          </p>
                          <p className="text-xs text-green-400 ms-4 mt-0.5">
                            ← {lang === 'ar' ? sec.fixesAr[i] : sec.fixes[i]}
                          </p>
                        </div>
                      ))}
                      {sec.found && sec.issues.length === 0 && (
                        <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          {lang === 'ar' ? 'القسم موجود ويبدو مكتملاً' : 'Section found and appears complete'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="border-border bg-secondary/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm font-medium">{lang === 'ar' ? 'الأقسام المكتملة' : 'Sections found'}</span>
                  <span className="text-xl font-bold text-primary">{sections.filter(s => s.found).length} / {sections.length}</span>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Report tab ── */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={printReport} data-testid="btn-print-report">
                  <Printer className="w-4 h-4 me-2" />
                  {lang === 'ar' ? 'طباعة / تحميل التقرير' : 'Print / Download Report'}
                </Button>
              </div>

              {/* Printable report area */}
              <div ref={reportRef} className="bg-card border border-border rounded-xl p-6 space-y-6 text-sm">
                {/* Header */}
                <div className="border-b-2 pb-4" style={{ borderColor: 'hsl(var(--primary))' }}>
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ar' ? 'تقرير التدقيق الأكاديمي الشامل' : 'Comprehensive Academic Proofreading Report'}
                  </h2>
                  <p className="text-muted-foreground text-xs mt-1">
                    {lang === 'ar' ? `التاريخ: ${today} | عدد الصفحات التقديري: ${totalPages} | عدد الملاحظات: ${issues.length + sections.filter(s => s.issues.length > 0 || !s.found).length}` : `Date: ${today} | Est. pages: ${totalPages} | Total items: ${issues.length + sections.filter(s => s.issues.length > 0 || !s.found).length}`}
                  </p>
                </div>

                {/* Section A: Language */}
                {issues.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base mb-3 text-primary">
                      {lang === 'ar' ? 'أولاً: الملاحظات اللغوية' : 'A. Language Observations'}
                    </h3>
                    <div className="space-y-3">
                      {issues.map((issue, idx) => (
                        <div key={issue.id} className="border border-border/50 rounded-lg p-4 bg-background/40">
                          <div className="flex items-start gap-3 flex-wrap">
                            <span className="font-bold text-primary shrink-0">#{idx + 1}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge className={`text-xs ${severityStyle[issue.severity].badge}`}>
                                  {lang === 'ar' ? issue.typeAr : issue.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {lang === 'ar' ? `الصفحة ${issue.page}` : `Page ${issue.page}`}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div>
                                  <span className="text-xs font-semibold text-amber-400">{lang === 'ar' ? 'النص المُشار إليه: ' : 'Reference: '}</span>
                                  <span className="text-xs font-mono text-muted-foreground">"{issue.snippet}"</span>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-red-400">{lang === 'ar' ? 'المشكلة: ' : 'Problem: '}</span>
                                  <span className="text-xs text-foreground/80">{lang === 'ar' ? issue.typeAr : issue.type}</span>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-green-400">{lang === 'ar' ? 'طريقة الحل: ' : 'Fix: '}</span>
                                  <span className="text-xs text-foreground/80">{lang === 'ar' ? issue.fixAr : issue.fix}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section B: Academic Structure */}
                <div>
                  <h3 className="font-bold text-base mb-3 text-primary">
                    {lang === 'ar' ? 'ثانياً: البنية الأكاديمية' : 'B. Academic Structure'}
                  </h3>
                  <div className="space-y-3">
                    {sections.map((sec, idx) => {
                      const hasProblems = !sec.found || sec.issues.length > 0;
                      if (!hasProblems) return (
                        <div key={sec.key} className="border border-green-500/30 rounded-lg p-3 flex items-center gap-3 bg-green-500/5">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-sm font-medium">{lang === 'ar' ? sec.labelAr : sec.labelEn}</span>
                          <Badge className="ms-auto bg-green-600 text-white text-xs">{lang === 'ar' ? 'مكتمل' : 'Complete'}</Badge>
                        </div>
                      );
                      return (
                        <div key={sec.key} className="border border-amber-500/30 rounded-lg p-4 bg-background/40">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className="font-bold text-primary">#{issues.length + idx + 1}</span>
                            <span className="font-semibold">{lang === 'ar' ? sec.labelAr : sec.labelEn}</span>
                            <Badge className={`ms-auto text-xs ${sec.found ? 'bg-amber-600 text-white' : 'bg-red-600 text-white'}`}>
                              {sec.found ? (lang === 'ar' ? 'يحتاج تحسين' : 'Needs improvement') : (lang === 'ar' ? 'غير موجود' : 'Missing')}
                            </Badge>
                          </div>
                          {!sec.found ? (
                            <div className="space-y-1.5">
                              <div>
                                <span className="text-xs font-semibold text-red-400">{lang === 'ar' ? 'المشكلة: ' : 'Problem: '}</span>
                                <span className="text-xs text-foreground/80">
                                  {lang === 'ar' ? `لم يُعثر على قسم "${sec.labelAr}" في النص` : `Section "${sec.labelEn}" was not detected`}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-green-400">{lang === 'ar' ? 'طريقة الحل: ' : 'Fix: '}</span>
                                <span className="text-xs text-foreground/80">
                                  {lang === 'ar' ? `أضف قسم "${sec.labelAr}" مع عنوان واضح وبمحتوى كافٍ` : `Add a clearly labeled "${sec.labelEn}" section with adequate content`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sec.issues.map((iss, i) => (
                                <div key={i}>
                                  <div>
                                    <span className="text-xs font-semibold text-red-400">{lang === 'ar' ? 'المشكلة: ' : 'Problem: '}</span>
                                    <span className="text-xs text-foreground/80">{lang === 'ar' ? sec.issuesAr[i] : iss}</span>
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold text-green-400">{lang === 'ar' ? 'طريقة الحل: ' : 'Fix: '}</span>
                                    <span className="text-xs text-foreground/80">{lang === 'ar' ? sec.fixesAr[i] : sec.fixes[i]}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-border pt-4 grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: lang === 'ar' ? 'الملاحظات اللغوية' : 'Language issues', value: issues.length },
                    { label: lang === 'ar' ? 'الأقسام الموجودة' : 'Sections found', value: `${sections.filter(s => s.found).length}/${sections.length}` },
                    { label: lang === 'ar' ? 'التقييم العام' : 'Overall', value: score?.label ?? '—' },
                  ].map(item => (
                    <div key={item.label} className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xl font-bold text-primary">{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
