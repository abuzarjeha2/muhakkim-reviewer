import { useState, useMemo, useRef } from "react";
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, FileText, BarChart2, HelpCircle,
  Star, CheckCircle2, Clock, RotateCcw, ChevronUp,
  ChevronRight, ChevronDown, Plus, Printer, Upload,
  Lightbulb, AlertCircle, Sparkles, Loader2
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
type Role = "supervisor" | "external" | "internal";
type CommentType = "note" | "question" | "correction" | "praise";
type Priority = "high" | "med" | "low";
type Status = "pending" | "review" | "approved";
type SubView = "annotation" | "report" | "progress" | "questions";

interface DiscussionPanelProps {
  text?: string;
  fileName?: string;
}

interface ParsedSection {
  id: string;
  num: string;
  title: string;
  titleEn: string;
  body: string;
  chapterType: string;
}

interface Chapter {
  id: string;
  name: string;
  nameEn: string;
  pct: number;
  status: Status;
  wordCount: number;
}

interface Comment {
  id: number;
  sectionId: string;
  sectionTitle: string;
  text: string;
  type: CommentType;
  time: string;
  role: Role;
}

interface Question {
  id: number;
  text: string;
  priority: Priority;
  chapter: string;
  done: boolean;
  auto: boolean;
}

// ─── Arabic numeral labels ────────────────────────────
const AR_NUMS = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"];

// ─── Chapter patterns ─────────────────────────────────
const CHAPTER_PATTERNS_AR = [
  { re: /الفصل\s+الأول|المقدمة|إشكالية البحث|مشكلة البحث/,   type: "intro",   labelAr: "المقدمة وإشكالية البحث",        labelEn: "Introduction & Problem Statement" },
  { re: /الفصل\s+الثاني|الإطار\s+النظري|الدراسات\s+السابقة/, type: "theory",  labelAr: "الإطار النظري والدراسات السابقة",  labelEn: "Theoretical Framework & Literature Review" },
  { re: /الفصل\s+الثالث|منهجية|منهج\s+البحث|أدوات\s+البحث/,  type: "method",  labelAr: "منهجية البحث وأدواته",             labelEn: "Research Methodology" },
  { re: /الفصل\s+الرابع|النتائج|نتائج\s+الدراسة/,             type: "results", labelAr: "نتائج الدراسة ومناقشتها",          labelEn: "Results & Discussion" },
  { re: /الفصل\s+الخامس|التوصيات|الخلاصة|الاستنتاجات/,       type: "concl",   labelAr: "الخلاصة والتوصيات",               labelEn: "Conclusions & Recommendations" },
];

const CHAPTER_PATTERNS_EN = [
  { re: /chapter\s+1|introduction|background/i,         type: "intro",   labelAr: "المقدمة",        labelEn: "Introduction" },
  { re: /chapter\s+2|literature\s+review|theoretical/i, type: "theory",  labelAr: "الإطار النظري",  labelEn: "Literature Review" },
  { re: /chapter\s+3|methodology|methods/i,             type: "method",  labelAr: "المنهجية",       labelEn: "Methodology" },
  { re: /chapter\s+4|results|findings/i,                type: "results", labelAr: "النتائج",        labelEn: "Results" },
  { re: /chapter\s+5|conclusion|recommendation/i,       type: "concl",   labelAr: "التوصيات",       labelEn: "Conclusions" },
];

// ─── Suggested questions by chapter type ─────────────
const AUTO_QUESTIONS: Record<string, { text: string; textEn: string; priority: Priority; chapter: string }[]> = {
  intro: [
    { text: "ما مدى وضوح إشكالية البحث وحدّتها؟ وهل تم توثيقها بالمراجع الكافية؟", textEn: "How clearly is the research problem defined and justified with references?", priority: "high", chapter: "مقدمة" },
    { text: "هل أهداف البحث قابلة للقياس والتحقق؟", textEn: "Are the research objectives measurable and achievable?", priority: "med", chapter: "مقدمة" },
  ],
  theory: [
    { text: "ما مبررات اختيار النظريات الحاكمة دون غيرها؟", textEn: "What justifies the choice of theoretical frameworks over alternatives?", priority: "high", chapter: "نظري" },
    { text: "هل الدراسات السابقة شاملة وحديثة (خلال 5 سنوات)؟", textEn: "Are the reviewed studies comprehensive and recent (within 5 years)?", priority: "med", chapter: "نظري" },
    { text: "ما الفجوة البحثية التي يسدّها هذا البحث؟", textEn: "What research gap does this study address?", priority: "high", chapter: "نظري" },
  ],
  method: [
    { text: "كيف تم التحقق من صدق وثبات أداة الدراسة؟", textEn: "How was the reliability and validity of the research instrument verified?", priority: "high", chapter: "منهجية" },
    { text: "هل حجم العينة كافٍ ويمثّل المجتمع الأصلي؟", textEn: "Is the sample size sufficient and representative of the target population?", priority: "high", chapter: "منهجية" },
    { text: "هل أسلوب اختيار العينة يتوافق مع طبيعة البحث؟", textEn: "Does the sampling method align with the research design?", priority: "med", chapter: "منهجية" },
  ],
  results: [
    { text: "هل تعميم النتائج على المجتمع الأصلي مبرر إحصائياً؟", textEn: "Is the generalizability of results statistically justified?", priority: "high", chapter: "نتائج" },
    { text: "هل النتائج متسقة مع الإطار النظري والفرضيات الأولية؟", textEn: "Are the results consistent with the theoretical framework and initial hypotheses?", priority: "med", chapter: "نتائج" },
    { text: "كيف تُفسَّر الفروق الإحصائية من ناحية عملية تطبيقية؟", textEn: "How are the statistical differences explained from a practical standpoint?", priority: "med", chapter: "نتائج" },
  ],
  concl: [
    { text: "هل التوصيات نابعة مباشرة من النتائج؟ أم أنها عامة؟", textEn: "Do the recommendations directly stem from the findings?", priority: "high", chapter: "توصيات" },
    { text: "ما حدود الدراسة وكيف تؤثر على تعميم نتائجها؟", textEn: "What are the study's limitations and how do they affect its generalizability?", priority: "med", chapter: "توصيات" },
  ],
};

// ─── Sample fallback data (no file uploaded) ─────────
const SAMPLE_SECTIONS: ParsedSection[] = [
  { id: "p1", num: "١", chapterType: "intro",
    title: "الفصل الأول: المقدمة وإشكالية البحث",
    titleEn: "Chapter 1: Introduction & Problem Statement",
    body: "يتناول هذا البحث دراسة أثر التحول الرقمي على جودة الخدمات التعليمية في المؤسسات الجامعية السعودية خلال الفترة الممتدة من عام ٢٠١٩ إلى ٢٠٢٤، مع التركيز على قياس مؤشرات الأداء الأكاديمي قبل وبعد تبني منصات التعلم الإلكتروني." },
  { id: "p2", num: "٢", chapterType: "theory",
    title: "الفصل الثاني: الإطار النظري والدراسات السابقة",
    titleEn: "Chapter 2: Theoretical Framework & Literature Review",
    body: "استندت الدراسة إلى نظرية قبول التكنولوجيا (TAM) ونموذج ديلون ومكلين لنجاح نظم المعلومات، كما استعرضت ما يزيد على ٤٥ دراسة سابقة في مجال التعليم الإلكتروني والتحول الرقمي." },
  { id: "p3", num: "٣", chapterType: "method",
    title: "الفصل الثالث: منهجية البحث وأدواته",
    titleEn: "Chapter 3: Research Methodology",
    body: "اعتمد البحث المنهج الوصفي التحليلي المختلط، وشملت عينة الدراسة ٣٨٠ طالباً وطالبة من خمس جامعات حكومية سعودية تم اختيارها بالطريقة العشوائية الطبقية، فضلاً عن ٢٢ مقابلة معمقة." },
  { id: "p4", num: "٤", chapterType: "results",
    title: "الفصل الرابع: نتائج الدراسة ومناقشتها",
    titleEn: "Chapter 4: Results & Discussion",
    body: "كشفت نتائج الدراسة عن وجود أثر إيجابي دال إحصائياً عند مستوى (α≤0.05) للتحول الرقمي على جودة الخدمات التعليمية بمعامل ارتباط بلغ (r=0.73)." },
  { id: "p5", num: "٥", chapterType: "concl",
    title: "الفصل الخامس: الخلاصة والتوصيات",
    titleEn: "Chapter 5: Conclusions & Recommendations",
    body: "أوصت الدراسة بضرورة تبني استراتيجية وطنية شاملة للتحول الرقمي في قطاع التعليم العالي، وإنشاء مركز وطني لقياس جودة التعلم الإلكتروني." },
];

// ─── Text parser ──────────────────────────────────────
function parseTextToSections(text: string): ParsedSection[] {
  if (!text.trim()) return SAMPLE_SECTIONS;

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const allPatterns = [...CHAPTER_PATTERNS_AR, ...CHAPTER_PATTERNS_EN];

  // Find heading lines
  const sections: ParsedSection[] = [];
  let currentSection: { patternIdx: number; startLine: number } | null = null;
  const sectionBodies: { lines: string[]; patternIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchIdx = allPatterns.findIndex(p => p.re.test(line));
    if (matchIdx !== -1 && line.length < 120) {
      if (currentSection !== null) {
        sectionBodies.push({ lines: lines.slice(currentSection.startLine, i), patternIdx: currentSection.patternIdx });
      }
      currentSection = { patternIdx: matchIdx, startLine: i + 1 };
    }
  }
  if (currentSection !== null) {
    sectionBodies.push({ lines: lines.slice(currentSection.startLine), patternIdx: currentSection.patternIdx });
  }

  if (sectionBodies.length === 0) {
    // No headings found — split into chunks of ~3 paragraphs each
    const chunks: string[] = [];
    let chunk: string[] = [];
    for (const line of lines) {
      chunk.push(line);
      if (chunk.length >= 4) { chunks.push(chunk.join(" ")); chunk = []; }
    }
    if (chunk.length) chunks.push(chunk.join(" "));

    return chunks.slice(0, 8).map((body, i) => ({
      id: `p${i + 1}`,
      num: AR_NUMS[i] ?? String(i + 1),
      title: `${i + 1 === 1 ? "المقدمة" : i + 1 === chunks.length ? "الخاتمة" : `القسم ${i + 1}`}`,
      titleEn: `${i + 1 === 1 ? "Introduction" : i + 1 === chunks.length ? "Conclusion" : `Section ${i + 1}`}`,
      chapterType: i === 0 ? "intro" : i === chunks.length - 1 ? "concl" : "other",
      body: body.slice(0, 600) + (body.length > 600 ? "…" : ""),
    }));
  }

  // Use matched sections
  sectionBodies.forEach(({ lines: bodyLines, patternIdx }, i) => {
    const pat = allPatterns[patternIdx];
    const body = bodyLines.join(" ").slice(0, 600);
    sections.push({
      id: `p${i + 1}`,
      num: AR_NUMS[i] ?? String(i + 1),
      title: pat.labelAr,
      titleEn: pat.labelEn,
      chapterType: pat.type,
      body: body + (bodyLines.join(" ").length > 600 ? "…" : ""),
    });
  });

  return sections.length ? sections : SAMPLE_SECTIONS;
}

// ─── Chapter builder from sections ───────────────────
function buildChapters(sections: ParsedSection[]): Chapter[] {
  return sections.map((s, i) => ({
    id: `ch${i + 1}`,
    name: s.title,
    nameEn: s.titleEn,
    wordCount: s.body.split(/\s+/).filter(Boolean).length,
    pct: 0,
    status: "pending" as Status,
  }));
}

// ─── Auto questions from sections ────────────────────
function buildAutoQuestions(sections: ParsedSection[]): Question[] {
  const qs: Question[] = [];
  let idCtr = 1;
  sections.forEach(s => {
    const pool = AUTO_QUESTIONS[s.chapterType] ?? [];
    pool.forEach(q => {
      qs.push({ id: idCtr++, text: q.text, priority: q.priority, chapter: q.chapter, done: false, auto: true });
    });
  });
  return qs.slice(0, 10);
}

// ─── Constants ────────────────────────────────────────
const CRITERIA = [
  { key: "originality", labelAr: "الأصالة والابتكار",       labelEn: "Originality",          descAr: "مدى إسهام البحث في إضافة معرفة جديدة",      descEn: "Contribution of new knowledge" },
  { key: "methodology", labelAr: "سلامة المنهجية",           labelEn: "Methodology",          descAr: "مناسبة المنهج وأدوات جمع البيانات",          descEn: "Appropriateness of methods & tools" },
  { key: "literature",  labelAr: "شمولية مراجعة الأدب",     labelEn: "Literature Review",    descAr: "استيعاب الدراسات السابقة ذات الصلة",         descEn: "Coverage of relevant prior studies" },
  { key: "analysis",    labelAr: "جودة التحليل الإحصائي",   labelEn: "Statistical Analysis", descAr: "دقة استخدام الأساليب الإحصائية",             descEn: "Accuracy of statistical methods" },
  { key: "writing",     labelAr: "جودة الكتابة الأكاديمية", labelEn: "Academic Writing",     descAr: "الوضوح والدقة في التعبير العلمي",             descEn: "Clarity and precision of expression" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  med:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low:  "bg-green-500/20 text-green-400 border-green-500/30",
};

const STATUS_STYLES: Record<Status, { labelAr: string; labelEn: string; cls: string; icon: React.ReactNode }> = {
  pending:  { labelAr: "قيد الانتظار", labelEn: "Pending",   cls: "bg-muted/30 text-muted-foreground",  icon: <Clock className="w-3 h-3" /> },
  review:   { labelAr: "تحت المراجعة", labelEn: "In Review", cls: "bg-amber-500/20 text-amber-400",     icon: <RotateCcw className="w-3 h-3" /> },
  approved: { labelAr: "مقبول",         labelEn: "Approved",  cls: "bg-green-500/20 text-green-400",    icon: <CheckCircle2 className="w-3 h-3" /> },
};

// ─── Main Component ───────────────────────────────────
export default function DiscussionPanel({ text = "", fileName = "" }: DiscussionPanelProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const hasFile = text.trim().length > 0;

  // ── Parse text into sections (memoised) ──
  const sections = useMemo(() => parseTextToSections(text), [text]);
  const initialChapters = useMemo(() => buildChapters(sections), [sections]);
  const autoQuestions = useMemo(() => buildAutoQuestions(sections), [sections]);

  // ── Thesis title from fileName ──
  const derivedTitle = fileName
    ? fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    : "";

  // ── State ──
  const [subView, setSubView] = useState<SubView>("annotation");
  const [role, setRole] = useState<Role>("supervisor");
  const [comments, setComments] = useState<Comment[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [questions, setQuestions] = useState<Question[]>(autoQuestions);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState<"accept" | "minor" | "reject" | null>(null);
  const [generalNotes, setGeneralNotes] = useState("");
  const [thesisTitle, setThesisTitle] = useState(derivedTitle);
  const [studentName, setStudentName] = useState("");

  // Annotation
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState<CommentType>("note");
  const [aiLoading, setAiLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Question form
  const [newQText, setNewQText] = useState("");
  const [newQPriority, setNewQPriority] = useState<Priority>("med");
  const [newQChapter, setNewQChapter] = useState(sections[0]?.chapterType ?? "عام");
  const [qCounter, setQCounter] = useState(autoQuestions.length + 1);

  // ── Reset when file changes ──
  useMemo(() => {
    setChapters(buildChapters(sections));
    setQuestions(buildAutoQuestions(sections));
    setComments([]);
    setSelectedSection(null);
    setThesisTitle(derivedTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // ── Stats ──
  const approvedCount = chapters.filter(c => c.status === "approved").length;
  const avgScore = Object.values(scores).length
    ? (Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length).toFixed(1)
    : "—";
  const overallPct = chapters.length
    ? Math.round(chapters.reduce((a, c) => a + c.pct, 0) / chapters.length)
    : 0;

  // ── AI suggestion ──
  const aiSuggest = async (sec: ParsedSection) => {
    if (aiLoading) {
      abortRef.current?.abort();
      return;
    }
    abortRef.current = new AbortController();
    setAiLoading(true);
    setCommentText("");
    try {
      const res = await fetch("/api/ai/suggest-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionTitle: ar ? sec.title : sec.titleEn,
          sectionBody: sec.body,
          commentType,
          lang,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json) as { content?: string; done?: boolean };
            if (parsed.content) setCommentText(prev => prev + parsed.content);
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setCommentText(ar ? "⚠️ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي." : "⚠️ AI request failed.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ── Annotation handlers ──
  const saveComment = () => {
    if (!commentText.trim() || !selectedSection) return;
    const sec = sections.find(s => s.id === selectedSection);
    setComments(prev => [...prev, {
      id: Date.now(),
      sectionId: selectedSection,
      sectionTitle: ar ? (sec?.title ?? selectedSection) : (sec?.titleEn ?? selectedSection),
      text: commentText,
      type: commentType,
      time: ar ? "الآن" : "Just now",
      role,
    }]);
    setCommentText("");
    setSelectedSection(null);
  };

  // ── Chapter handlers ──
  const updateChapterPct = (id: string, val: number) =>
    setChapters(prev => prev.map(c => c.id === id ? { ...c, pct: val } : c));

  const cycleStatus = (id: string) => {
    const order: Status[] = ["pending", "review", "approved"];
    setChapters(prev => prev.map(c =>
      c.id === id ? { ...c, status: order[(order.indexOf(c.status) + 1) % 3] } : c
    ));
  };

  // ── Question handlers ──
  const addQuestion = () => {
    if (!newQText.trim()) return;
    setQuestions(prev => [...prev, { id: qCounter, text: newQText, priority: newQPriority, chapter: newQChapter, done: false, auto: false }]);
    setQCounter(c => c + 1);
    setNewQText("");
  };

  const toggleQuestion = (id: number) =>
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, done: !q.done } : q));

  // ── Print ──
  const printReport = () => {
    const content = document.getElementById("discussion-report-print");
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${ar ? "تقرير المناقشة — محكّم" : "Discussion Report — Muhakkim"}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;direction:rtl;padding:32px;color:#111;font-size:13px;}
      h2{font-size:18px;border-bottom:2px solid #C9A84C;padding-bottom:6px;}
      table{width:100%;border-collapse:collapse;margin:12px 0;}
      th{background:#0F1B2D;color:#C9A84C;padding:8px;text-align:right;}
      td{padding:8px;border-bottom:1px solid #ddd;}</style></head>
      <body>${content.innerHTML}<script>window.print();<\/script></body></html>`);
    win.document.close();
  };

  // ─── Sub-tabs ─────────────────────────────────────
  const subTabs = [
    { key: "annotation" as SubView, labelAr: "التعليق على الفقرات", labelEn: "Paragraph Annotation", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "report"     as SubView, labelAr: "تقرير المناقش",        labelEn: "Examiner Report",       icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "progress"   as SubView, labelAr: "تتبع الإنجاز",         labelEn: "Progress Tracker",      icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: "questions"  as SubView, labelAr: "أسئلة المناقشة",       labelEn: "Discussion Questions",  icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  // ─── No-file banner ────────────────────────────────
  const NoFileBanner = () => (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 mb-4">
      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-300 leading-relaxed">
        {ar
          ? "لم يُرفع ملف بعد — يتم عرض بيانات تجريبية. ارفع رسالتك من تبويب \"رفع الملف\" لتحليل محتواها الفعلي."
          : "No file uploaded yet — sample data is shown. Upload your thesis from the \"File Upload\" tab to analyse real content."}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* ── Sub-tabs + role ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {subTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSubView(t.key)}
              data-testid={`subtab-${t.key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                subView === t.key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              {t.icon}
              {ar ? t.labelAr : t.labelEn}
            </button>
          ))}
        </div>
        <select
          value={role}
          onChange={e => setRole(e.target.value as Role)}
          className="text-xs rounded-lg border border-border bg-card text-foreground px-3 py-1.5"
        >
          <option value="supervisor">{ar ? "👨‍🏫 مشرف" : "👨‍🏫 Supervisor"}</option>
          <option value="external">{ar ? "🔍 مناقش خارجي" : "🔍 External Examiner"}</option>
          <option value="internal">{ar ? "👥 مناقش داخلي" : "👥 Internal Examiner"}</option>
        </select>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: comments.length,  labelAr: "تعليقات",      labelEn: "Comments" },
          { num: questions.length, labelAr: "أسئلة",         labelEn: "Questions" },
          { num: approvedCount,    labelAr: "فصول مقبولة",   labelEn: "Approved" },
          { num: avgScore,         labelAr: "التقييم الكلي", labelEn: "Avg. Score" },
        ].map(s => (
          <Card key={s.labelEn} className="border-border bg-secondary/10">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-primary">{s.num}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? s.labelAr : s.labelEn}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          VIEW 1 — Paragraph Annotation
      ════════════════════════════════════════ */}
      {subView === "annotation" && (
        <div className="space-y-3">
          {!hasFile && <NoFileBanner />}

          {/* File source indicator */}
          {hasFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary font-medium">{fileName}</span>
              <span>—</span>
              <span>{ar ? `${sections.length} أقسام تم اكتشافها` : `${sections.length} sections detected`}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {ar ? "انقر على أي فقرة لإضافة تعليق عليها" : "Click any paragraph to add a comment"}
          </p>

          <div className="space-y-2">
            {sections.map(sec => {
              const secComments = comments.filter(c => c.sectionId === sec.id);
              const isSelected = selectedSection === sec.id;
              return (
                <div key={sec.id}>
                  <div
                    onClick={() => setSelectedSection(prev => prev === sec.id ? null : sec.id)}
                    data-testid={`section-${sec.id}`}
                    className={`relative rounded-lg p-4 cursor-pointer transition-all border-s-4 ${
                      isSelected
                        ? "bg-primary/10 border-s-primary"
                        : secComments.length > 0
                          ? "bg-blue-500/5 border-s-blue-500/60 hover:bg-blue-500/10"
                          : "bg-card border-s-transparent hover:bg-secondary/20 hover:border-s-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5 shrink-0">{sec.num}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <strong className="text-sm text-foreground">{ar ? sec.title : sec.titleEn}</strong>
                          {secComments.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {secComments.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{sec.body}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {isSelected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Comment form */}
                  {isSelected && (
                    <div className="border border-primary/40 rounded-b-lg bg-card/80 p-4 -mt-1 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-primary font-semibold">
                          {ar ? `تعليق على: ${sec.title}` : `Comment on: ${sec.titleEn}`}
                        </p>
                        {/* AI suggest button */}
                        <button
                          onClick={() => aiSuggest(sec)}
                          data-testid="btn-ai-suggest"
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            aiLoading
                              ? "border-primary/30 bg-primary/5 text-primary/60 cursor-wait"
                              : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {aiLoading
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> {ar ? "جارٍ التوليد…" : "Generating…"}</>
                            : <><Sparkles className="w-3 h-3" /> {ar ? "اقتراح بالذكاء الاصطناعي" : "AI Suggest"}</>
                          }
                        </button>
                      </div>

                      {/* Streaming indicator */}
                      {aiLoading && (
                        <div className="flex items-center gap-2 text-[10px] text-primary/60">
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                          {ar ? "يحلّل الذكاء الاصطناعي الفقرة ويصوغ تعليقاً…" : "AI is analysing the section and composing a comment…"}
                        </div>
                      )}

                      <Textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={ar
                          ? "اكتب تعليقك هنا، أو اضغط «اقتراح بالذكاء الاصطناعي» لتوليد تعليق تلقائي…"
                          : "Write your comment here, or press «AI Suggest» to auto-generate one…"}
                        className={`min-h-[90px] text-sm bg-background border-border transition-all ${aiLoading ? "opacity-70" : ""}`}
                        data-testid="input-comment-text"
                        readOnly={aiLoading}
                      />

                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={commentType}
                          onChange={e => setCommentType(e.target.value as CommentType)}
                          className="text-xs rounded-lg border border-border bg-background text-foreground px-2.5 py-1.5"
                        >
                          <option value="note">📝 {ar ? "ملاحظة" : "Note"}</option>
                          <option value="question">❓ {ar ? "سؤال" : "Question"}</option>
                          <option value="correction">✏️ {ar ? "تصحيح" : "Correction"}</option>
                          <option value="praise">✅ {ar ? "إشادة" : "Praise"}</option>
                        </select>
                        <p className="text-[10px] text-muted-foreground hidden sm:block">
                          {ar ? "اختر النوع ثم اضغط «اقتراح» لتعليق مخصص" : "Select type then press «AI Suggest» for a tailored comment"}
                        </p>
                        <div className="flex gap-2 ms-auto">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedSection(null); abortRef.current?.abort(); }}>
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                          <Button size="sm" onClick={saveComment} disabled={!commentText.trim() || aiLoading} data-testid="btn-save-comment">
                            {ar ? "💾 حفظ" : "💾 Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing comments */}
                  {secComments.length > 0 && (
                    <div className="ms-8 mt-1 space-y-1.5">
                      {secComments.map(c => (
                        <div key={c.id} className="bg-blue-500/8 border border-blue-500/20 border-s-2 border-s-blue-400 rounded-lg p-3">
                          <p className="text-[10px] text-blue-400 font-semibold mb-1">
                            {{ note:"📝",question:"❓",correction:"✏️",praise:"✅" }[c.type]}
                            {" "}{ar ? { note:"ملاحظة",question:"سؤال",correction:"تصحيح",praise:"إشادة" }[c.type] : c.type}
                            {" · "}{c.time}
                          </p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          VIEW 2 — Examiner Report
      ════════════════════════════════════════ */}
      {subView === "report" && (
        <div className="space-y-5">
          <div id="discussion-report-print" className="space-y-5">
            {/* Header */}
            <div className="text-center p-5 border-2 rounded-xl" style={{ borderColor: "hsl(var(--primary)/0.4)", background: "hsl(var(--primary)/0.05)" }}>
              <h2 className="text-xl font-bold text-primary mb-1">
                {ar ? "تقرير لجنة المناقشة والحكم" : "Examination Committee Report"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {ar ? "نموذج تقييم رسالة الدكتوراه / الماجستير" : "PhD / Master's Thesis Evaluation Form"}
              </p>
            </div>

            {/* Auto-filled notice */}
            {hasFile && derivedTitle && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                {ar ? "تم تعبئة عنوان الرسالة تلقائياً من اسم الملف المرفوع." : "Thesis title auto-filled from the uploaded file name."}
              </div>
            )}

            {/* Thesis info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{ar ? "عنوان الرسالة" : "Thesis Title"}</label>
                <input
                  value={thesisTitle}
                  onChange={e => setThesisTitle(e.target.value)}
                  placeholder={ar ? "عنوان الرسالة..." : "Thesis title..."}
                  className="w-full bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2 focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{ar ? "اسم الطالب/ة" : "Student Name"}</label>
                <input
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder={ar ? "اسم الطالب..." : "Student name..."}
                  className="w-full bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Criteria */}
            <Card className="border-border">
              <CardContent className="p-4 divide-y divide-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pb-3">
                  {ar ? "معايير التقييم" : "Evaluation Criteria"}
                </p>
                {CRITERIA.map(c => (
                  <div key={c.key} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{ar ? c.labelAr : c.labelEn}</p>
                      <p className="text-xs text-muted-foreground">{ar ? c.descAr : c.descEn}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 items-center" dir="ltr">
                      {[1,2,3,4,5].map(i => (
                        <button
                          key={i}
                          onClick={() => setScores(prev => ({ ...prev, [c.key]: i }))}
                          data-testid={`star-${c.key}-${i}`}
                          className="transition-all hover:scale-110"
                        >
                          <Star className={`w-5 h-5 transition-colors ${(scores[c.key] ?? 0) >= i ? "fill-primary text-primary" : "text-border"}`} />
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground ms-2 min-w-[28px]">
                        {scores[c.key] ? `${scores[c.key]}/5` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General notes with any existing comments summary */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {ar ? "الملاحظات العامة" : "General Notes"}
              </label>
              {comments.length > 0 && !generalNotes && (
                <button
                  onClick={() => setGeneralNotes(comments.map(c => `[${c.sectionTitle}]: ${c.text}`).join("\n"))}
                  className="text-xs text-primary flex items-center gap-1.5 hover:underline"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {ar ? `استيراد ${comments.length} تعليق من لوحة التعليقات` : `Import ${comments.length} comment(s) from annotation panel`}
                </button>
              )}
              <Textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder={ar ? "اكتب ملاحظاتك العامة على الرسالة..." : "Write your general notes on the thesis..."}
                className="min-h-[100px] bg-card border-border text-sm"
              />
            </div>

            {/* Decision */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {ar ? "قرار اللجنة" : "Committee Decision"}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "accept", labelAr: "✅ قبول بدون تعديل",  labelEn: "✅ Accept",              cls: "border-green-500 text-green-400 bg-green-500/10" },
                  { key: "minor",  labelAr: "📝 قبول بتعديلات",    labelEn: "📝 Accept with Revisions", cls: "border-amber-500 text-amber-400 bg-amber-500/10" },
                  { key: "reject", labelAr: "❌ إعادة للتعديل",    labelEn: "❌ Major Revisions",       cls: "border-red-500 text-red-400 bg-red-500/10" },
                ] as const).map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDecision(d.key)}
                    data-testid={`decision-${d.key}`}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center ${
                      decision === d.key ? d.cls : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {ar ? d.labelAr : d.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={printReport}>
              <Printer className="w-4 h-4 me-2" />
              {ar ? "🖨️ طباعة التقرير" : "🖨️ Print Report"}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          VIEW 3 — Progress Tracker
      ════════════════════════════════════════ */}
      {subView === "progress" && (
        <div className="space-y-4">
          {!hasFile && <NoFileBanner />}

          {hasFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "تم اكتشاف الفصول من محتوى الملف المرفوع" : "Chapters detected from the uploaded file content"}</span>
            </div>
          )}

          {/* Overall */}
          <div className="text-center p-6 rounded-xl border" style={{ background: "hsl(var(--primary)/0.06)", borderColor: "hsl(var(--primary)/0.4)" }}>
            <p className="text-5xl font-black text-primary leading-none">{overallPct}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {ar ? "نسبة الإنجاز الكلية للرسالة" : "Overall Thesis Completion"}
            </p>
            <div className="mt-4 h-2.5 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--primary)))" }} />
            </div>
          </div>

          {/* Chapters */}
          <div className="space-y-3">
            {chapters.map(ch => {
              const st = STATUS_STYLES[ch.status];
              return (
                <Card key={ch.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div>
                        <span className="text-sm font-semibold">{ar ? ch.name : ch.nameEn}</span>
                        {hasFile && (
                          <span className="ms-2 text-[10px] text-muted-foreground">
                            ({ch.wordCount} {ar ? "كلمة" : "words"})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">{ch.pct}%</span>
                        <button
                          onClick={() => cycleStatus(ch.id)}
                          data-testid={`status-${ch.id}`}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${st.cls}`}
                        >
                          {st.icon}
                          {ar ? st.labelAr : st.labelEn}
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${ch.pct}%`, background: "linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--primary)))" }} />
                    </div>
                    <input type="range" min={0} max={100} value={ch.pct}
                      onChange={e => updateChapterPct(ch.id, Number(e.target.value))}
                      data-testid={`slider-${ch.id}`}
                      className="w-full accent-primary" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          VIEW 4 — Discussion Questions
      ════════════════════════════════════════ */}
      {subView === "questions" && (
        <div className="space-y-4">
          {!hasFile && <NoFileBanner />}

          {/* Auto-questions notice */}
          {hasFile && autoQuestions.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {ar
                  ? `تم اقتراح ${autoQuestions.length} سؤال تلقائياً بناءً على فصول الرسالة المكتشفة. يمكنك تعديلها أو إضافة أسئلة جديدة.`
                  : `${autoQuestions.length} questions were auto-suggested based on the detected thesis chapters. You can edit or add more.`}
              </span>
            </div>
          )}

          {/* Add form */}
          <div className="border border-dashed rounded-xl p-4 space-y-3" style={{ borderColor: "hsl(var(--primary)/0.4)" }}>
            <p className="text-sm font-semibold text-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {ar ? "إضافة سؤال مناقشة" : "Add Discussion Question"}
            </p>
            <Textarea
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              placeholder={ar ? "اكتب سؤال المناقشة هنا..." : "Write your discussion question here..."}
              className="min-h-[70px] bg-card border-border text-sm"
              data-testid="input-new-question"
            />
            <div className="flex gap-2 flex-wrap items-center">
              <select value={newQPriority} onChange={e => setNewQPriority(e.target.value as Priority)}
                className="text-xs rounded-lg border border-border bg-card text-foreground px-2.5 py-1.5">
                <option value="high">🔴 {ar ? "أولوية عالية" : "High priority"}</option>
                <option value="med">🟡 {ar ? "أولوية متوسطة" : "Medium priority"}</option>
                <option value="low">🟢 {ar ? "أولوية منخفضة" : "Low priority"}</option>
              </select>
              <select value={newQChapter} onChange={e => setNewQChapter(e.target.value)}
                className="text-xs rounded-lg border border-border bg-card text-foreground px-2.5 py-1.5">
                {sections.map(s => (
                  <option key={s.id} value={s.chapterType}>{ar ? s.title : s.titleEn}</option>
                ))}
                <option value="عام">{ar ? "عام" : "General"}</option>
              </select>
              <Button size="sm" onClick={addQuestion} disabled={!newQText.trim()} className="ms-auto" data-testid="btn-add-question">
                <Plus className="w-3.5 h-3.5 me-1" />
                {ar ? "إضافة" : "Add"}
              </Button>
            </div>
          </div>

          {/* Questions list */}
          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              {ar ? "لا توجد أسئلة. أضف أول سؤال." : "No questions yet. Add your first question."}
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map(q => (
                <div key={q.id} data-testid={`question-${q.id}`}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    q.done ? "opacity-50 bg-card border-border" : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black border shrink-0 mt-0.5 ${PRIORITY_COLORS[q.priority]}`}>
                    {{ high: <ChevronUp className="w-3 h-3" />, med: <ChevronRight className="w-3 h-3" />, low: <ChevronDown className="w-3 h-3" /> }[q.priority]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${q.done ? "line-through" : ""}`}>{q.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 text-blue-400 border-blue-500/30 bg-blue-500/10">
                        {q.chapter}
                      </Badge>
                      {q.auto && (
                        <span className="text-[10px] text-primary/60 flex items-center gap-1">
                          <Lightbulb className="w-2.5 h-2.5" />
                          {ar ? "مقترح تلقائي" : "auto-suggested"}
                        </span>
                      )}
                      {q.done && (
                        <Badge className="text-[10px] px-2 py-0 bg-green-600 text-white">
                          {ar ? "✓ تمت المناقشة" : "✓ Discussed"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    data-testid={`check-question-${q.id}`}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      q.done ? "bg-green-500 border-green-500 text-white" : "border-border hover:border-primary"
                    }`}
                  >
                    {q.done && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <Card className="border-border bg-secondary/10">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {ar ? "تمت مناقشة" : "Discussed"}
              </span>
              <span className="text-xl font-bold text-primary">
                {questions.filter(q => q.done).length} / {questions.length}
              </span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
