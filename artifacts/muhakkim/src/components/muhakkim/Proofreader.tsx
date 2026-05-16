import React, { useState, useEffect } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, CheckCircle2, Copy, FileCheck2,
  BookOpen, FlaskConical, BarChart2, FileText, Lightbulb, AlignLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProofreaderProps {
  text: string;
}

interface Issue {
  id: number;
  line: number;
  type: string;
  typeAr: string;
  snippet: string;
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
}

// Keywords for detecting academic sections in Arabic and English
const SECTION_PATTERNS: Record<string, { ar: string[]; en: string[] }> = {
  abstract: {
    ar: ['مستخلص', 'ملخص', 'الملخص', 'المستخلص', 'موجز'],
    en: ['abstract', 'summary', 'synopsis'],
  },
  theoretical: {
    ar: ['الإطار النظري', 'إطار نظري', 'الأدبيات', 'الدراسات السابقة', 'الخلفية النظرية', 'الإطار المفاهيمي', 'مراجعة الأدبيات'],
    en: ['theoretical framework', 'literature review', 'theoretical background', 'conceptual framework', 'related work', 'prior studies'],
  },
  methodology: {
    ar: ['المنهجية', 'منهجية البحث', 'منهج البحث', 'الطريقة', 'أسلوب البحث', 'المنهج', 'الإجراءات', 'مجتمع الدراسة', 'عينة الدراسة'],
    en: ['methodology', 'research method', 'methods', 'research design', 'procedure', 'sample', 'participants', 'data collection'],
  },
  results: {
    ar: ['النتائج', 'نتائج الدراسة', 'نتائج التحليل', 'المناقشة', 'نتائج البحث', 'عرض النتائج', 'تحليل البيانات', 'الفرضيات'],
    en: ['results', 'findings', 'analysis', 'discussion', 'outcomes', 'data analysis', 'hypothesis testing'],
  },
  recommendations: {
    ar: ['التوصيات', 'المقترحات', 'توصيات الدراسة', 'الخاتمة', 'الاستنتاجات', 'التوصية', 'مقترحات'],
    en: ['recommendations', 'conclusions', 'conclusion', 'implications', 'suggestions', 'future work'],
  },
};

function findSection(text: string, patterns: { ar: string[]; en: string[] }): { found: boolean; excerpt: string; confidence: 'high' | 'medium' | 'low' | 'missing' } {
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    for (const kw of patterns.ar) {
      if (lower.includes(kw.toLowerCase())) {
        return { found: true, excerpt: line.trim().slice(0, 120), confidence: 'high' };
      }
    }
    for (const kw of patterns.en) {
      if (lower.includes(kw.toLowerCase())) {
        return { found: true, excerpt: line.trim().slice(0, 120), confidence: 'medium' };
      }
    }
  }
  // Fuzzy: look in whole text blob for any keyword
  const fullLower = text.toLowerCase();
  for (const kw of [...patterns.ar, ...patterns.en]) {
    if (fullLower.includes(kw.toLowerCase())) {
      return { found: true, excerpt: kw, confidence: 'low' };
    }
  }
  return { found: false, excerpt: '', confidence: 'missing' };
}

function analyzeSection(text: string, key: string): { issues: string[]; issuesAr: string[] } {
  const issues: string[] = [];
  const issuesAr: string[] = [];
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (key === 'abstract') {
    if (wordCount < 100)  { issues.push('Abstract appears short (< 100 words)'); issuesAr.push('المستخلص قصير جداً (أقل من 100 كلمة)'); }
    if (wordCount > 350)  { issues.push('Abstract may be too long (> 350 words)'); issuesAr.push('المستخلص طويل جداً (أكثر من 350 كلمة)'); }
    if (!/keyword|كلمات مفتاحية/i.test(text)) { issues.push('No keywords section detected'); issuesAr.push('لا توجد كلمات مفتاحية في المستخلص'); }
  }
  if (key === 'theoretical') {
    if (wordCount < 200) { issues.push('Theoretical framework seems brief'); issuesAr.push('الإطار النظري مقتضب'); }
    const refPattern = /\(\d{4}\)|et al\.|وآخرون|هـ\)|م\)/;
    if (!refPattern.test(text)) { issues.push('No citations detected in this section'); issuesAr.push('لا توجد مراجع واضحة في الإطار النظري'); }
  }
  if (key === 'methodology') {
    if (!/sample|عينة|مجتمع|participants/i.test(text)) { issues.push('No sample/population mention detected'); issuesAr.push('لم يُذكر مجتمع الدراسة أو العينة'); }
    if (!/instrument|أداة|questionnaire|استبيان|مقياس/i.test(text)) { issues.push('No instrument/tool mentioned'); issuesAr.push('لم تُذكر أداة الدراسة'); }
  }
  if (key === 'results') {
    if (!/table|جدول|figure|شكل|%|p\s*[=<>]|sig|دلالة/i.test(text)) { issues.push('No tables, figures or statistical output detected'); issuesAr.push('لا توجد جداول أو مخرجات إحصائية'); }
  }
  if (key === 'recommendations') {
    if (wordCount < 50) { issues.push('Recommendations section is very short'); issuesAr.push('قسم التوصيات قصير جداً'); }
  }
  return { issues, issuesAr };
}

export default function Proofreader({ text: initialText }: ProofreaderProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState(initialText);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [activeTab, setActiveTab] = useState<'language' | 'structure'>('language');

  useEffect(() => {
    if (initialText && !hasRun) setText(initialText);
  }, [initialText, hasRun]);

  const runAnalysis = () => {
    if (!text.trim()) return;
    runLanguageCheck();
    runStructureCheck();
    setHasRun(true);
  };

  const runLanguageCheck = () => {
    const lines = text.split('\n');
    const found: Issue[] = [];
    let id = 1;

    // Track repeated words per document
    const wordFreq: Record<string, number> = {};
    text.toLowerCase().split(/\s+/).forEach(w => {
      const clean = w.replace(/[^\u0600-\u06FFa-z]/g, '');
      if (clean.length > 4) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });
    const repeated = new Set(Object.entries(wordFreq).filter(([, c]) => c > 5).map(([w]) => w));

    const passiveAr = ['تم ', 'يتم ', 'كان ', 'كانت ', 'قد تم'];
    const passiveEn = [' was ', ' were ', ' has been ', ' have been ', ' had been ', ' is being ', ' are being '];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Long sentences
      const sentences = trimmed.split(/(?<=[.!?؟])\s+/);
      sentences.forEach(sent => {
        const wc = sent.trim().split(/\s+/).filter(Boolean).length;
        if (wc > 45) {
          found.push({ id: id++, line: idx + 1, type: 'Long sentence (>45 words)', typeAr: 'جملة طويلة (أكثر من 45 كلمة)', snippet: sent.trim().slice(0, 60) + '…', severity: 'warning' });
        }
      });

      // Passive voice (Arabic)
      passiveAr.forEach(p => {
        if (line.includes(p)) {
          found.push({ id: id++, line: idx + 1, type: 'Arabic passive voice', typeAr: 'صيغة المبني للمجهول', snippet: trimmed.slice(0, 60), severity: 'info' });
        }
      });

      // Passive voice (English)
      passiveEn.forEach(p => {
        if (line.toLowerCase().includes(p)) {
          found.push({ id: id++, line: idx + 1, type: 'English passive voice', typeAr: 'مبني للمجهول (إنجليزي)', snippet: trimmed.slice(0, 60), severity: 'info' });
        }
      });

      // Repeated words in this line
      const lineWords = trimmed.toLowerCase().split(/\s+/).map(w => w.replace(/[^\u0600-\u06FFa-z]/g, ''));
      lineWords.forEach(w => {
        if (w.length > 4 && repeated.has(w)) {
          if (!found.some(i => i.line === idx + 1 && i.type === 'Repeated word' && i.snippet.includes(w))) {
            found.push({ id: id++, line: idx + 1, type: 'Repeated word', typeAr: 'تكرار كلمة', snippet: `"${w}"`, severity: 'info' });
          }
        }
      });

      // Double spaces / extra whitespace
      if (/  +/.test(line)) {
        found.push({ id: id++, line: idx + 1, type: 'Extra whitespace', typeAr: 'مسافات زائدة', snippet: trimmed.slice(0, 40), severity: 'info' });
      }

      // Missing end punctuation (only for long lines that look like sentences)
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount >= 8 && !/[.!?؟،:;]$/.test(trimmed) && idx < lines.length - 1) {
        found.push({ id: id++, line: idx + 1, type: 'Missing end punctuation', typeAr: 'غياب علامة الترقيم في نهاية الجملة', snippet: trimmed.slice(-40), severity: 'warning' });
      }
    });

    setIssues(found);
  };

  const runStructureCheck = () => {
    const sectionDefs = [
      { key: 'abstract',      labelAr: 'المستخلص',         labelEn: 'Abstract',              icon: <AlignLeft className="w-4 h-4" /> },
      { key: 'theoretical',   labelAr: 'الإطار النظري',     labelEn: 'Theoretical Framework', icon: <BookOpen className="w-4 h-4" /> },
      { key: 'methodology',   labelAr: 'المنهجية',          labelEn: 'Methodology',           icon: <FlaskConical className="w-4 h-4" /> },
      { key: 'results',       labelAr: 'نتائج التحليل',     labelEn: 'Results & Analysis',    icon: <BarChart2 className="w-4 h-4" /> },
      { key: 'recommendations', labelAr: 'التوصيات',        labelEn: 'Recommendations',       icon: <Lightbulb className="w-4 h-4" /> },
    ];

    const results: SectionResult[] = sectionDefs.map(def => {
      const { found, excerpt, confidence } = findSection(text, SECTION_PATTERNS[def.key]);
      const { issues: sIssues, issuesAr } = found ? analyzeSection(text, def.key) : { issues: [], issuesAr: [] };
      return { ...def, found, confidence, excerpt, issues: sIssues, issuesAr };
    });

    setSections(results);
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    toast({ title: lang === 'ar' ? 'تم نسخ النص' : 'Text copied' });
  };

  const getScore = () => {
    if (!hasRun) return null;
    const errors   = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const missingSections = sections.filter(s => !s.found).length;
    const total = errors * 3 + warnings * 2 + missingSections;
    if (total === 0) return { label: lang === 'ar' ? 'ممتاز' : 'Excellent', color: 'bg-green-600 text-white' };
    if (total < 6)  return { label: lang === 'ar' ? 'جيد' : 'Good',      color: 'bg-primary text-primary-foreground' };
    return { label: lang === 'ar' ? 'يحتاج تحسين' : 'Needs Improvement', color: 'bg-amber-600 text-white' };
  };

  const score = getScore();

  const severityColor = {
    error:   'border-red-500/40 bg-red-500/5',
    warning: 'border-amber-500/40 bg-amber-500/5',
    info:    'border-blue-500/40 bg-blue-500/5',
  };
  const severityBadge = {
    error:   'bg-red-600 text-white',
    warning: 'bg-amber-600 text-white',
    info:    'bg-blue-600 text-white',
  };

  const confidenceLabel: Record<string, { ar: string; en: string; color: string }> = {
    high:    { ar: 'موجود',     en: 'Found',          color: 'bg-green-600 text-white' },
    medium:  { ar: 'محتمل',    en: 'Likely found',   color: 'bg-primary text-primary-foreground' },
    low:     { ar: 'جزئي',     en: 'Partial',        color: 'bg-amber-600 text-white' },
    missing: { ar: 'غير موجود', en: 'Not detected',  color: 'bg-red-600 text-white' },
  };

  return (
    <div className="space-y-5">
      {/* Text area */}
      <Textarea
        className="min-h-[220px] resize-y font-sans text-sm p-4 leading-relaxed bg-card border-border text-foreground"
        placeholder={lang === 'ar' ? 'الصق نص البحث هنا للتدقيق…' : 'Paste your research text here for analysis…'}
        value={text}
        onChange={e => setText(e.target.value)}
        data-testid="textarea-proofread"
      />

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button onClick={runAnalysis} className="flex-1" data-testid="btn-run-proofread">
          <FileCheck2 className="w-4 h-4 me-2" />
          {lang === 'ar' ? 'تشغيل التدقيق الشامل' : 'Run Full Analysis'}
        </Button>
        <Button variant="outline" onClick={copyText} data-testid="btn-copy-proofread">
          <Copy className="w-4 h-4 me-2" />
          {lang === 'ar' ? 'نسخ النص' : 'Copy Text'}
        </Button>
      </div>

      {hasRun && (
        <>
          {/* Score + tab switcher */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeTab === 'language' ? 'default' : 'outline'}
                onClick={() => setActiveTab('language')}
                data-testid="tab-language"
              >
                <AlertCircle className="w-3.5 h-3.5 me-1.5" />
                {lang === 'ar' ? `التدقيق اللغوي (${issues.length})` : `Language (${issues.length})`}
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'structure' ? 'default' : 'outline'}
                onClick={() => setActiveTab('structure')}
                data-testid="tab-structure"
              >
                <BookOpen className="w-3.5 h-3.5 me-1.5" />
                {lang === 'ar' ? 'فحص البنية الأكاديمية' : 'Academic Structure'}
              </Button>
            </div>
            {score && (
              <Badge className={`${score.color} px-3 py-1 text-sm`}>{score.label}</Badge>
            )}
          </div>

          {/* Language issues panel */}
          {activeTab === 'language' && (
            <Card className="border-border bg-secondary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  {lang === 'ar' ? 'ملاحظات لغوية' : 'Language Observations'}
                  <span className="text-muted-foreground text-sm font-normal">
                    — {issues.length} {lang === 'ar' ? 'ملاحظة' : 'items'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {issues.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span>{lang === 'ar' ? 'لم يتم العثور على ملاحظات لغوية' : 'No language issues found!'}</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {issues.map(issue => (
                      <div key={issue.id} className={`p-3 border rounded-lg flex items-start gap-3 ${severityColor[issue.severity]}`}>
                        <span className="text-xs font-mono bg-background/60 px-2 py-0.5 rounded shrink-0 mt-0.5 text-muted-foreground">
                          س{issue.line}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`text-xs px-2 py-0 ${severityBadge[issue.severity]}`}>
                              {lang === 'ar' ? issue.typeAr : issue.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {lang === 'ar' ? issue.type : issue.typeAr}
                            </span>
                          </div>
                          <p className="text-xs font-mono bg-background/60 px-2 py-1 rounded text-muted-foreground truncate">
                            {issue.snippet}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Academic structure panel */}
          {activeTab === 'structure' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === 'ar'
                  ? 'فحص وجود الأقسام الأكاديمية الأساسية في النص'
                  : 'Checking for required academic sections in the text'}
              </p>
              {sections.map(sec => {
                const cl = confidenceLabel[sec.confidence];
                return (
                  <Card key={sec.key} className={`border ${sec.found ? 'border-green-500/30' : 'border-red-500/40 bg-red-500/5'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-primary">{sec.icon}</span>
                          <div>
                            <p className="font-semibold text-sm">
                              {lang === 'ar' ? sec.labelAr : sec.labelEn}
                              <span className="text-muted-foreground font-normal text-xs ms-2">
                                {lang === 'ar' ? sec.labelEn : sec.labelAr}
                              </span>
                            </p>
                          </div>
                        </div>
                        <Badge className={`text-xs px-2 shrink-0 ${cl.color}`}>
                          {lang === 'ar' ? cl.ar : cl.en}
                        </Badge>
                      </div>

                      {sec.found && sec.excerpt && (
                        <p className="mt-2 text-xs text-muted-foreground bg-background/60 px-3 py-1.5 rounded font-mono truncate">
                          {sec.excerpt}
                        </p>
                      )}

                      {!sec.found && (
                        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {lang === 'ar'
                            ? `لم يُعثر على قسم "${sec.labelAr}" في النص`
                            : `Section "${sec.labelEn}" was not detected in the text`}
                        </p>
                      )}

                      {sec.found && sec.issues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {sec.issues.map((iss, i) => (
                            <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              {lang === 'ar' ? sec.issuesAr[i] : iss}
                            </p>
                          ))}
                        </div>
                      )}

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

              {/* Summary row */}
              <Card className="border-border bg-secondary/10">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium">
                    {lang === 'ar' ? 'الأقسام المكتملة' : 'Sections found'}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {sections.filter(s => s.found).length} / {sections.length}
                  </span>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
