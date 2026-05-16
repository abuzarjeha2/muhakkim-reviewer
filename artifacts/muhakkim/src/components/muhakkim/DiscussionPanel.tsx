import { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, FileText, BarChart2, HelpCircle,
  Star, CheckCircle2, Clock, RotateCcw, ChevronUp,
  ChevronRight, ChevronDown, Plus, Printer
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
type Role = "supervisor" | "external" | "internal";
type CommentType = "note" | "question" | "correction" | "praise";
type Priority = "high" | "med" | "low";
type Status = "pending" | "review" | "approved";
type SubView = "annotation" | "report" | "progress" | "questions";

interface Comment {
  id: number;
  paraId: string;
  paraLabel: string;
  text: string;
  type: CommentType;
  time: string;
  role: Role;
}

interface Chapter {
  id: string;
  name: string;
  nameEn: string;
  pct: number;
  status: Status;
}

interface Question {
  id: number;
  text: string;
  priority: Priority;
  chapter: string;
  done: boolean;
}

// ─── Initial data ────────────────────────────────────
const INITIAL_COMMENTS: Comment[] = [
  {
    id: 1, paraId: "p2", paraLabel: "الفصل الثاني: الإطار النظري",
    text: "يُنصح بالتوسع في مناقشة نظرية TAM وربطها بالسياق المحلي بشكل أعمق.",
    type: "note", time: "منذ ٢ ساعة", role: "external"
  }
];

const INITIAL_CHAPTERS: Chapter[] = [
  { id: "ch1", name: "الفصل الأول: المقدمة",          nameEn: "Chapter 1: Introduction",       pct: 100, status: "approved" },
  { id: "ch2", name: "الفصل الثاني: الإطار النظري",    nameEn: "Chapter 2: Theoretical Framework", pct: 75, status: "review" },
  { id: "ch3", name: "الفصل الثالث: المنهجية",         nameEn: "Chapter 3: Methodology",        pct: 60, status: "review" },
  { id: "ch4", name: "الفصل الرابع: النتائج",          nameEn: "Chapter 4: Results",            pct: 40, status: "pending" },
  { id: "ch5", name: "الفصل الخامس: التوصيات",         nameEn: "Chapter 5: Recommendations",   pct: 20, status: "pending" },
];

const INITIAL_QUESTIONS: Question[] = [
  { id: 1, text: "كيف تم التحقق من صدق وثبات أداة الدراسة (الاستبانة)؟", priority: "high", chapter: "منهجية", done: false },
  { id: 2, text: "ما مبررات اختيار نظرية TAM دون غيرها من النظريات؟",      priority: "med",  chapter: "نظري",   done: false },
  { id: 3, text: "هل تعميم النتائج على جميع الجامعات مبرر بحجم العينة؟",   priority: "high", chapter: "نتائج",  done: false },
];

const PARAGRAPHS = [
  { id: "p1", num: "١", title: "الفصل الأول: المقدمة وإشكالية البحث",        titleEn: "Chapter 1: Introduction & Problem Statement",
    text: "يتناول هذا البحث دراسة أثر التحول الرقمي على جودة الخدمات التعليمية في المؤسسات الجامعية السعودية خلال الفترة الممتدة من عام ٢٠١٩ إلى ٢٠٢٤، مع التركيز على قياس مؤشرات الأداء الأكاديمي قبل وبعد تبني منصات التعلم الإلكتروني." },
  { id: "p2", num: "٢", title: "الفصل الثاني: الإطار النظري والدراسات السابقة", titleEn: "Chapter 2: Theoretical Framework & Literature Review",
    text: "استندت الدراسة إلى نظرية قبول التكنولوجيا (TAM) ونموذج ديلون ومكلين لنجاح نظم المعلومات، كما استعرضت ما يزيد على ٤٥ دراسة سابقة في مجال التعليم الإلكتروني والتحول الرقمي على المستويين المحلي والدولي." },
  { id: "p3", num: "٣", title: "الفصل الثالث: منهجية البحث وأدواته",         titleEn: "Chapter 3: Research Methodology & Tools",
    text: "اعتمد البحث المنهج الوصفي التحليلي المختلط، وشملت عينة الدراسة ٣٨٠ طالباً وطالبة من خمس جامعات حكومية سعودية تم اختيارها بالطريقة العشوائية الطبقية، فضلاً عن ٢٢ مقابلة معمقة مع أعضاء هيئة التدريس." },
  { id: "p4", num: "٤", title: "الفصل الرابع: نتائج الدراسة ومناقشتها",      titleEn: "Chapter 4: Results & Discussion",
    text: "كشفت نتائج الدراسة عن وجود أثر إيجابي دال إحصائياً عند مستوى (α≤0.05) للتحول الرقمي على جودة الخدمات التعليمية بمعامل ارتباط بلغ (r=0.73)، كما أظهرت أن البنية التحتية التقنية تُعدّ أبرز متغير وسيط في هذه العلاقة." },
  { id: "p5", num: "٥", title: "الفصل الخامس: الخلاصة والتوصيات",           titleEn: "Chapter 5: Conclusions & Recommendations",
    text: "أوصت الدراسة بضرورة تبني استراتيجية وطنية شاملة للتحول الرقمي في قطاع التعليم العالي، وإنشاء مركز وطني لقياس جودة التعلم الإلكتروني، وتخصيص ميزانيات واضحة لبرامج التدريب المستمر لأعضاء هيئة التدريس." },
];

const CRITERIA = [
  { key: "originality", labelAr: "الأصالة والابتكار",       labelEn: "Originality",          descAr: "مدى إسهام البحث في إضافة معرفة جديدة",     descEn: "Contribution of new knowledge" },
  { key: "methodology", labelAr: "سلامة المنهجية",           labelEn: "Methodology",          descAr: "مناسبة المنهج وأدوات جمع البيانات",         descEn: "Appropriateness of methods & tools" },
  { key: "literature",  labelAr: "شمولية مراجعة الأدب",     labelEn: "Literature Review",    descAr: "استيعاب الدراسات السابقة ذات الصلة",        descEn: "Coverage of relevant prior studies" },
  { key: "analysis",    labelAr: "جودة التحليل الإحصائي",   labelEn: "Statistical Analysis", descAr: "دقة استخدام الأساليب الإحصائية",            descEn: "Accuracy of statistical methods" },
  { key: "writing",     labelAr: "جودة الكتابة الأكاديمية", labelEn: "Academic Writing",     descAr: "الوضوح والدقة في التعبير العلمي",            descEn: "Clarity and precision of expression" },
];

const TYPE_ICONS: Record<CommentType, string> = { note: "📝", question: "❓", correction: "✏️", praise: "✅" };
const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  med:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low:  "bg-green-500/20 text-green-400 border-green-500/30",
};
const STATUS_STYLES: Record<Status, { label: string; labelEn: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "قيد الانتظار", labelEn: "Pending",    cls: "bg-muted/30 text-muted-foreground",  icon: <Clock className="w-3 h-3" /> },
  review:   { label: "تحت المراجعة", labelEn: "In Review",  cls: "bg-amber-500/20 text-amber-400",     icon: <RotateCcw className="w-3 h-3" /> },
  approved: { label: "مقبول",         labelEn: "Approved",   cls: "bg-green-500/20 text-green-400",     icon: <CheckCircle2 className="w-3 h-3" /> },
};

// ─── Main Component ──────────────────────────────────
export default function DiscussionPanel() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [subView, setSubView] = useState<SubView>("annotation");
  const [role, setRole] = useState<Role>("supervisor");
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [chapters, setChapters] = useState<Chapter[]>(INITIAL_CHAPTERS);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [decision, setDecision] = useState<"accept" | "minor" | "reject" | null>(null);
  const [generalNotes, setGeneralNotes] = useState("");
  const [thesisTitle, setThesisTitle] = useState("");
  const [studentName, setStudentName] = useState("");

  // Annotation state
  const [selectedPara, setSelectedPara] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState<CommentType>("note");

  // Question form
  const [newQText, setNewQText] = useState("");
  const [newQPriority, setNewQPriority] = useState<Priority>("med");
  const [newQChapter, setNewQChapter] = useState("منهجية");
  const [qCounter, setQCounter] = useState(4);

  // ── Annotation handlers ──
  const handleParaClick = (paraId: string) => {
    setSelectedPara(prev => prev === paraId ? null : paraId);
    setCommentText("");
    setCommentType("note");
  };

  const saveComment = () => {
    if (!commentText.trim() || !selectedPara) return;
    const para = PARAGRAPHS.find(p => p.id === selectedPara);
    const newComment: Comment = {
      id: Date.now(),
      paraId: selectedPara,
      paraLabel: ar ? para?.title ?? selectedPara : para?.titleEn ?? selectedPara,
      text: commentText,
      type: commentType,
      time: ar ? "الآن" : "Just now",
      role,
    };
    setComments(prev => [...prev, newComment]);
    setCommentText("");
    setSelectedPara(null);
  };

  // ── Chapter handlers ──
  const updateChapterPct = (id: string, val: number) => {
    setChapters(prev => prev.map(c => c.id === id ? { ...c, pct: val } : c));
  };

  const cycleStatus = (id: string) => {
    const order: Status[] = ["pending", "review", "approved"];
    setChapters(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = order[(order.indexOf(c.status) + 1) % 3];
      return { ...c, status: next };
    }));
  };

  const overallPct = Math.round(chapters.reduce((a, c) => a + c.pct, 0) / chapters.length);

  // ── Question handlers ──
  const addQuestion = () => {
    if (!newQText.trim()) return;
    setQuestions(prev => [...prev, { id: qCounter, text: newQText, priority: newQPriority, chapter: newQChapter, done: false }]);
    setQCounter(c => c + 1);
    setNewQText("");
  };

  const toggleQuestion = (id: number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, done: !q.done } : q));
  };

  // ── Stats ──
  const approvedCount = chapters.filter(c => c.status === "approved").length;
  const avgScore = Object.values(scores).length
    ? (Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length).toFixed(1)
    : "—";

  // ── Print report ──
  const printReport = () => {
    const content = document.getElementById("discussion-report-print");
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8">
      <title>${ar ? "تقرير المناقشة — محكّم" : "Discussion Report — Muhakkim"}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 32px; color: #111; font-size: 13px; }
        h2 { font-size: 18px; border-bottom: 2px solid #C9A84C; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #0F1B2D; color: #C9A84C; padding: 8px; text-align: right; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .stars { color: #C9A84C; font-size: 16px; }
        @media print { button { display: none; } }
      </style></head><body>${content.innerHTML}
      <script>window.print();<\/script></body></html>`);
    win.document.close();
  };

  // ─── SUB-TABS ───────────────────────────────────────
  const subTabs = [
    { key: "annotation" as SubView, labelAr: "التعليق على الفقرات", labelEn: "Paragraph Annotation", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "report"     as SubView, labelAr: "تقرير المناقش",        labelEn: "Examiner Report",       icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "progress"   as SubView, labelAr: "تتبع الإنجاز",         labelEn: "Progress Tracker",      icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: "questions"  as SubView, labelAr: "أسئلة المناقشة",       labelEn: "Discussion Questions",  icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* ── Role selector + sub-tabs ── */}
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
          data-testid="select-role"
        >
          <option value="supervisor">{ar ? "👨‍🏫 مشرف" : "👨‍🏫 Supervisor"}</option>
          <option value="external">{ar ? "🔍 مناقش خارجي" : "🔍 External Examiner"}</option>
          <option value="internal">{ar ? "👥 مناقش داخلي" : "👥 Internal Examiner"}</option>
        </select>
      </div>

      {/* ── Quick stats row ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: comments.length,  labelAr: "تعليقات",       labelEn: "Comments" },
          { num: questions.length, labelAr: "أسئلة",          labelEn: "Questions" },
          { num: approvedCount,    labelAr: "فصول مقبولة",    labelEn: "Approved" },
          { num: avgScore,         labelAr: "التقييم الكلي",  labelEn: "Avg. Score" },
        ].map(s => (
          <Card key={s.labelEn} className="border-border bg-secondary/10">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-primary">{s.num}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? s.labelAr : s.labelEn}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ════════════════════════════════════
          VIEW 1 — Paragraph Annotation
      ════════════════════════════════════ */}
      {subView === "annotation" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {ar ? "انقر على أي فقرة لإضافة تعليق عليها" : "Click any paragraph to add a comment"}
          </p>

          <div className="space-y-2">
            {PARAGRAPHS.map(para => {
              const paraComments = comments.filter(c => c.paraId === para.id);
              const isSelected = selectedPara === para.id;
              return (
                <div key={para.id}>
                  <div
                    onClick={() => handleParaClick(para.id)}
                    data-testid={`para-${para.id}`}
                    className={`relative rounded-lg p-4 cursor-pointer transition-all border-s-4 ${
                      isSelected
                        ? "bg-primary/10 border-s-primary"
                        : paraComments.length > 0
                          ? "bg-blue-500/5 border-s-blue-500/60 hover:bg-blue-500/10"
                          : "bg-card border-s-transparent hover:bg-secondary/20 hover:border-s-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5 shrink-0">{para.num}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <strong className="text-sm text-foreground">{ar ? para.title : para.titleEn}</strong>
                          {paraComments.length > 0 && (
                            <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {paraComments.length} {ar ? "تعليق" : "comment"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{para.text}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {isSelected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Comment form */}
                  {isSelected && (
                    <div className="border border-primary/40 rounded-b-lg bg-card/80 p-4 -mt-1 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs text-primary font-semibold">
                        {ar ? `تعليق على: ${para.title}` : `Comment on: ${para.titleEn}`}
                      </p>
                      <Textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={ar ? "اكتب ملاحظتك أو سؤالك على هذه الفقرة..." : "Write your note or question on this paragraph..."}
                        className="min-h-[70px] text-sm bg-background border-border"
                        data-testid="input-comment-text"
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
                        <div className="flex gap-2 ms-auto">
                          <Button size="sm" variant="outline" onClick={() => setSelectedPara(null)}>
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                          <Button size="sm" onClick={saveComment} disabled={!commentText.trim()} data-testid="btn-save-comment">
                            {ar ? "💾 حفظ" : "💾 Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing comments */}
                  {paraComments.length > 0 && (
                    <div className="ms-8 mt-1 space-y-1.5">
                      {paraComments.map(c => (
                        <div key={c.id} className="bg-blue-500/8 border border-blue-500/20 border-s-2 border-s-blue-400 rounded-lg p-3">
                          <p className="text-[10px] text-blue-400 font-semibold mb-1">
                            {TYPE_ICONS[c.type]} {ar ? { note:"ملاحظة",question:"سؤال",correction:"تصحيح",praise:"إشادة" }[c.type] : c.type}
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

      {/* ════════════════════════════════════
          VIEW 2 — Examiner Report
      ════════════════════════════════════ */}
      {subView === "report" && (
        <div className="space-y-5">
          {/* Printable area */}
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

            {/* Thesis info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{ar ? "عنوان الرسالة" : "Thesis Title"}</label>
                <input
                  value={thesisTitle}
                  onChange={e => setThesisTitle(e.target.value)}
                  placeholder={ar ? "أثر التحول الرقمي على جودة الخدمات التعليمية..." : "Impact of digital transformation on educational quality..."}
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
                    <div className="flex gap-1 shrink-0" dir="ltr">
                      {[1,2,3,4,5].map(i => (
                        <button
                          key={i}
                          onClick={() => setScores(prev => ({ ...prev, [c.key]: i }))}
                          data-testid={`star-${c.key}-${i}`}
                          className={`text-2xl transition-all hover:scale-110 ${
                            (scores[c.key] ?? 0) >= i ? "text-primary" : "text-border"
                          }`}
                        >
                          <Star className={`w-5 h-5 ${(scores[c.key] ?? 0) >= i ? "fill-primary" : ""}`} />
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground ms-2 mt-1 min-w-[28px]">
                        {scores[c.key] ? `${scores[c.key]}/5` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {ar ? "الملاحظات العامة" : "General Notes"}
              </label>
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

          {/* Print button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={printReport} data-testid="btn-print-discussion-report">
              <Printer className="w-4 h-4 me-2" />
              {ar ? "🖨️ طباعة التقرير" : "🖨️ Print Report"}
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          VIEW 3 — Progress Tracker
      ════════════════════════════════════ */}
      {subView === "progress" && (
        <div className="space-y-4">
          {/* Overall */}
          <div
            className="text-center p-6 rounded-xl border"
            style={{ background: "hsl(var(--primary)/0.06)", borderColor: "hsl(var(--primary)/0.4)" }}
          >
            <p className="text-5xl font-black text-primary leading-none">{overallPct}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {ar ? "نسبة الإنجاز الكلية للرسالة" : "Overall Thesis Completion"}
            </p>
            <div className="mt-4 h-2.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--primary)))" }}
              />
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
                      <span className="text-sm font-semibold">{ar ? ch.name : ch.nameEn}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">{ch.pct}%</span>
                        <button
                          onClick={() => cycleStatus(ch.id)}
                          data-testid={`status-${ch.id}`}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${st.cls}`}
                        >
                          {st.icon}
                          {ar ? st.label : st.labelEn}
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${ch.pct}%`, background: "linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--primary)))" }}
                      />
                    </div>
                    <input
                      type="range" min={0} max={100} value={ch.pct}
                      onChange={e => updateChapterPct(ch.id, Number(e.target.value))}
                      data-testid={`slider-${ch.id}`}
                      className="w-full accent-primary"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          VIEW 4 — Discussion Questions
      ════════════════════════════════════ */}
      {subView === "questions" && (
        <div className="space-y-4">
          {/* Add question form */}
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
              <select
                value={newQPriority}
                onChange={e => setNewQPriority(e.target.value as Priority)}
                className="text-xs rounded-lg border border-border bg-card text-foreground px-2.5 py-1.5"
              >
                <option value="high">🔴 {ar ? "أولوية عالية" : "High priority"}</option>
                <option value="med">🟡 {ar ? "أولوية متوسطة" : "Medium priority"}</option>
                <option value="low">🟢 {ar ? "أولوية منخفضة" : "Low priority"}</option>
              </select>
              <select
                value={newQChapter}
                onChange={e => setNewQChapter(e.target.value)}
                className="text-xs rounded-lg border border-border bg-card text-foreground px-2.5 py-1.5"
              >
                {["منهجية","نظري","نتائج","توصيات","عام"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
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
              {ar ? "لا توجد أسئلة بعد. أضف أول سؤال." : "No questions yet. Add your first question."}
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map(q => (
                <div
                  key={q.id}
                  data-testid={`question-${q.id}`}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    q.done
                      ? "opacity-50 bg-card border-border"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  {/* Priority badge */}
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black border shrink-0 mt-0.5 ${PRIORITY_COLORS[q.priority]}`}>
                    {{ high: <ChevronUp className="w-3 h-3" />, med: <ChevronRight className="w-3 h-3" />, low: <ChevronDown className="w-3 h-3" /> }[q.priority]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${q.done ? "line-through" : ""}`}>{q.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 text-blue-400 border-blue-500/30 bg-blue-500/10">
                        {q.chapter}
                      </Badge>
                      {q.done && (
                        <Badge className="text-[10px] px-2 py-0 bg-green-600 text-white">
                          {ar ? "✓ تمت المناقشة" : "✓ Discussed"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    data-testid={`check-question-${q.id}`}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      q.done
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-border hover:border-primary"
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
