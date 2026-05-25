import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Note {
  severity: "high" | "medium" | "low" | "info";
  title: string;
  body: string;
  suggestion: string | null;
}
interface SectionResult { score: number; notes: Note[]; }
interface AnalysisResults {
  totalScore: number;
  sectionScores: Record<string, number>;
  sectionNotes: Record<string, Note[]>;
  generalNotes: Note[];
  stats: { totalWords: number; totalChars: number; sectionsAnalyzed: number; highIssues: number; mediumIssues: number; lowIssues: number; infoCount: number };
}
type Role = "supervisor" | "internal" | "external" | "researcher";
type Degree = "masters" | "phd";

// ─── Section Definitions ─────────────────────────────────────────────────────
const SECTIONS: Record<string, { label: string; icon: string; color: string; type: "text" | "textarea"; placeholder: string; minLength: number; maxLength?: number; help: string }> = {
  title:         { label: "العنوان",         icon: "📌", color: "#e74c3c", type: "text",     placeholder: "أدخل عنوان الرسالة...", minLength: 15, maxLength: 200, help: "العنوان يجب أن يكون دقيقاً ومحدداً ويعكس محتوى الرسالة بوضوح" },
  toc:           { label: "الفهرس",          icon: "📋", color: "#3498db", type: "textarea", placeholder: "أدخل محتويات الفهرس (أرقام الصفحات والعناوين الفرعية)...", minLength: 50, help: "الفهرس يجب أن يغطي جميع أقسام الرسالة مع ترقيم الصفحات" },
  abstract:      { label: "المستخلص",        icon: "📄", color: "#2ecc71", type: "textarea", placeholder: "أدخل نص المستخلص كاملاً...", minLength: 150, maxLength: 1500, help: "المستخلص يجب أن يحتوي على: مشكلة البحث، الهدف، المنهج، العينة، النتائج الرئيسية" },
  objectives:    { label: "الأهداف",         icon: "🎯", color: "#e67e22", type: "textarea", placeholder: "أدخل أهداف الدراسة (كل هدف في سطر)...", minLength: 30, help: "الأهداف يجب أن تكون SMART: محددة، قابلة للقياس، قابلة للتحقيق، ذات صلة، محددة زمنياً" },
  hypotheses:    { label: "الفرضيات",        icon: "🔬", color: "#9b59b6", type: "textarea", placeholder: "أدخل فرضيات الدراسة (كل فرضية في سطر)...", minLength: 30, help: "الفرضيات يجب أن تكون قابلة للاختبار ومتصلة بالأهداف ومبنية على الإطار النظري" },
  theory:        { label: "الإطار النظري",   icon: "📚", color: "#1abc9c", type: "textarea", placeholder: "أدخل نص الإطار النظري (أو جزء منه للتحليل)...", minLength: 200, help: "الإطار النظري يجب أن يغطي المتغيرات الرئيسية ويُبنى على دراسات سابقة" },
  methodology:   { label: "المنهجية",        icon: "⚙️", color: "#e74c3c", type: "textarea", placeholder: "أدخل وصف المنهجية المستخدمة...", minLength: 150, help: "المنهجية يجب أن تتضمن: نوع المنهج، المجتمع والعينة، أدوات البحث، الصدق والثبات" },
  analysis:      { label: "تحليل البيانات", icon: "📊", color: "#f39c12", type: "textarea", placeholder: "أدخل نص تحليل البيانات والجداول الإحصائية...", minLength: 100, help: "التحليل يجب أن يربط بالفرضيات ويستخدم الاختبارات الإحصائية المناسبة" },
  results:       { label: "النتائج",         icon: "🏆", color: "#27ae60", type: "textarea", placeholder: "أدخل نتائج الدراسة...", minLength: 100, help: "النتائج يجب أن تجيب على أسئلة البحث وتتحقق من الفرضيات" },
  recommendations: { label: "التوصيات",     icon: "💡", color: "#d4ac0d", type: "textarea", placeholder: "أدخل توصيات الدراسة...", minLength: 50, help: "التوصيات يجب أن تنبثق من النتائج وتكون قابلة للتطبيق" },
  references:    { label: "المراجع",         icon: "🔖", color: "#7f8c8d", type: "textarea", placeholder: "أدخل قائمة المراجع...", minLength: 100, help: "المراجع يجب أن تتبع أسلوب توثيق موحد (APA وغيره) وتكون حديثة ومتنوعة" },
};
const SECTION_KEYS = Object.keys(SECTIONS);

// ─── Analysis Engine ──────────────────────────────────────────────────────────
function makeNote(severity: Note["severity"], title: string, body: string, suggestion: string | null = null): Note {
  return { severity, title, body, suggestion };
}
function countWords(text: string) { return text.split(/\s+/).filter(w => w.length > 0).length; }
function similarity(a: string, b: string) {
  const wa = new Set(a.split(/\s+/)), wb = new Set(b.split(/\s+/));
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? inter / union : 0;
}
function checkColloquialWords(text: string, score: { deductions: number[] }, notes: Note[]) {
  const colloquial = ["يعني","طيب","حلو","زين","كذا","عشان","ليش","شو","ايش","يقول","بس","هذي","هذا الكلام","بصراحة","بجد","تمام","اللي","عندي","الحين","يلا","خلّ","لازم","ممكن","أبغى","ابغى"];
  const found = colloquial.filter(w => text.includes(w));
  if (found.length > 0) {
    score.deductions.push(found.length * 3);
    notes.push(makeNote("medium", "وجود كلمات عامية في النص الأكاديمي", `الكلمات: ${found.map(w => `"${w}"`).join("، ")}`, "استبدل الكلمات العامية بمصطلحات أكاديمية رصينة."));
  }
}
function applyGeneralTextChecks(text: string, score: { value: number; deductions: number[] }, notes: Note[], key: string) {
  checkColloquialWords(text, score, notes);
  const sentences = text.split(/[.!؟\n]+/).filter(s => s.trim().length > 0);
  let longSentences = 0;
  sentences.forEach(s => { if (s.trim().split(/\s+/).length > 40) longSentences++; });
  if (longSentences > 2) {
    score.deductions.push(longSentences * 2);
    notes.push(makeNote("low", `${longSentences} جملة طويلة جداً (أكثر من 40 كلمة)`, "الجمل الطويلة جداً تصعب الفهم وتضعف وضوح النص.", "قسّم الجمل الطويلة إلى جمل أقصر وأوضح."));
  }
}

function analyzeTitle(text: string, score: { value: number; deductions: number[] }, notes: Note[], degree: Degree) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 5) { score.deductions.push(20); notes.push(makeNote("high", "العنوان قصير جداً", `العنوان يحتوي على ${words.length} كلمات فقط، والحد الأدنى المناسب هو 8-15 كلمة لضمان الوضوح والشمولية.`, "أعد صياغة العنوان ليكون أكثر شمولية مع الإبقاء على الدقة.")); }
  else if (words.length > 25) { score.deductions.push(10); notes.push(makeNote("medium", "العنوان طويل جداً", `العنوان يحتوي على ${words.length} كلمة، مما قد يضعف تركيز القارئ على الموضوع الرئيسي.`, "اخصر العنوان مع الحفاظ على العناصر الأساسية.")); }
  const vagueWords = ["دراسة","بحث","بحث في","دراسة حول","نحو","في ضوء"];
  const vagueCount = vagueWords.filter(w => text.includes(w)).length;
  if (vagueCount >= 2 && words.length < 10) { score.deductions.push(10); notes.push(makeNote("medium", "العنوان يحتوي على صياغات عامة", "وجود أكثر من صياغة عامة دون تحديد دقيق يجعل العنوان ضعيفاً.", "استبدل الصياغات العامة بمصطلحات محددة تعبر عن محتوى الرسالة بدقة.")); }
  const hasVariables = /علاقة|تأثير|أثر|دور|فاعلية|مدى|مستوى|واقع/.test(text);
  if (!hasVariables && degree === "masters") { score.deductions.push(8); notes.push(makeNote("low", "يفتقر العنوان لتحديد نوع العلاقة بين المتغيرات", "العنوان لا يوضح بوضوح نوع العلاقة المبحوثة (تأثير، علاقة، دور، فاعلية...).", "أضف صياغة توضح العلاقة مثل: \"تأثير المتغير المستقل على المتغير التابع\".")); }
  const hasScope = /في|على|بين|من|خلال|\d{4}/.test(text);
  if (!hasScope) { score.deductions.push(5); notes.push(makeNote("low", "العنوان لا يحدد نطاق البحث", "يفضل أن يحدد العنوان المجال أو المكان أو الزمان لإطار البحث.", "أضف تحديداً للمجال أو المكان مثل: \"في جامعة...\" أو \"في قطاع...\"")); }
  if (/[!?]/.test(text)) { score.deductions.push(5); notes.push(makeNote("medium", "وجود علامات ترقيم غير مناسبة في العنوان", "العنوان الأكاديمي لا يحتوي على علامات تعجب أو استفهام.", "أزل علامات الترقيم غير المناسبة واستخدم صياغة جملة اسمية.")); }
}

function analyzeTOC(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 5) { score.deductions.push(25); notes.push(makeNote("high", "الفهرس فقير جداً", `يحتوي على ${lines.length} عناصر فقط، مما يشير إلى هيكل غير مكتمل.`, "تأكد من إدراج جميع فصول الرسالة وأبوابها الفرعية مع ترقيم الصفحات.")); }
  else if (lines.length < 10) { score.deductions.push(12); notes.push(makeNote("medium", "الفهرس قد يكون غير مكتمل", `عدد العناصر ${lines.length} وهو أقل من المتوقع لرسالة أكاديمية متكاملة.`, "راجع الفهرس وتأكد من تغطية جميع الأقسام الفرعية.")); }
  const requiredSections = ["مقدمة","الإطار النظري","المنهج","النتائج","التوصيات","المراجع","المستخلص"];
  const missing = requiredSections.filter(sec => !text.includes(sec));
  if (missing.length > 0) { score.deductions.push(missing.length * 5); notes.push(makeNote("high", "أقسام أساسية مفقودة من الفهرس", `الأقسام التالية غير موجودة: ${missing.join("، ")}`, "أضف الأقسام المفقودة مع ترقيم الصفحات المناسبة.")); }
  const hasPageNums = /\d{1,4}\s*$/.test(text) || /\d{1,4}\s*\./.test(text);
  if (!hasPageNums && lines.length > 3) { score.deductions.push(10); notes.push(makeNote("medium", "لا توجد أرقام صفحات في الفهرس", "الفهرس بدون ترقيم صفحات يفقد وظيفته الأساسية.", "أضف أرقام الصفحات مقابل كل عنوان فرعي.")); }
}

function analyzeAbstract(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const words = countWords(text);
  if (words < 100) { score.deductions.push(20); notes.push(makeNote("high", "المستخلص قصير جداً", `يحتوي على ${words} كلمة فقط. المطلوب 150-350 كلمة.`, "أعد كتابة المستخلص بما يشمل جميع عناصره الأساسية.")); }
  else if (words < 150) { score.deductions.push(10); notes.push(makeNote("medium", "المستخلص أقل من الطول المطلوب", `يحتوي على ${words} كلمة. الحد الأدنى الموصى به 150 كلمة.`, "أضف مزيداً من التفاصيل حول المنهجية والنتائج.")); }
  else if (words > 400) { score.deductions.push(8); notes.push(makeNote("low", "المستخلص أطول من المعتاد", `يحتوي على ${words} كلمة. الحد الأقصى الموصى به 350 كلمة.`, "اختصر المستخلص مع الحفاظ على عناصره الجوهرية.")); }
  const elements = [
    { term: ["مشكلة","إشكالية","تحدّي"], name: "المشكلة" },
    { term: ["هدف","أهداف","يسعى","يهدف"], name: "الهدف" },
    { term: ["منهج","أسلوب","طريقة","منهجية","وصفي","تجريبي","تحليلي"], name: "المنهج" },
    { term: ["عينة","فرض","مجتمع","مبحوث","مستجيب","أفراد"], name: "العينة" },
    { term: ["نتائج","توصلت","أظهرت","تبين","أشارت"], name: "النتائج" },
    { term: ["توصية","يقترح","توصيات"], name: "التوصيات" },
  ];
  const missingElements = elements.filter(el => !el.term.some(t => text.includes(t))).map(el => el.name);
  if (missingElements.length >= 3) { score.deductions.push(20); notes.push(makeNote("high", "المستخلص يفتقر لعناصر جوهرية", `العناصر المفقودة: ${missingElements.join("، ")}`, "أعد كتابة المستخلص ليشمل جميع العناصر الأساسية بالتسلسل المنطقي.")); }
  else if (missingElements.length > 0) { score.deductions.push(missingElements.length * 5); notes.push(makeNote("medium", "المستخلص يفتقر لبعض العناصر", `العناصر المفقودة: ${missingElements.join("، ")}`, "أضف العناصر المفقودة لجعل المستخلص متكاملاً.")); }
  if (!/\d/.test(text)) { score.deductions.push(8); notes.push(makeNote("low", "المستخلص لا يحتوي على أية أرقام أو إحصائيات", "وجود أرقام (حجم العينة، النسب المئوية) يعزز مصداقية المستخلص.", "أضف بعض الأرقام الأساسية مثل حجم العينة وأهم النسب الإحصائية.")); }
  checkColloquialWords(text, score, notes);
}

function analyzeObjectives(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const lines = text.split("\n").filter(l => l.trim().length > 5);
  if (lines.length < 2) { score.deductions.push(20); notes.push(makeNote("high", "عدد الأهداف غير كافٍ", "رسالة الماجستير تحتاج 3-5 أهداف على الأقل، والدكتوراه 4-6 أهداف.", "حدد أهدافاً إضافية تغطي جوانب البحث المختلفة.")); }
  else if (lines.length > 8) { score.deductions.push(8); notes.push(makeNote("medium", "عدد الأهداف كبير جداً", `يوجد ${lines.length} هدف، مما قد يؤدي إلى تشتت البحث.`, "دمج بعض الأهداف المتقاربة لتقليل عددها إلى 3-6 أهداف.")); }
  const goodStarters = ["تحديد","قياس","تقييم","معرفة","كشف","تحليل","استكشاف","دراسة","فحص","التحقق","تقديم","وصف","معرفة مدى"];
  const badStarters = ["التعرف على","الوقوف على","إلقاء الضوء","التعرّف"];
  let badFormulations = 0;
  lines.forEach(line => {
    const clean = line.replace(/^[\d.\-)]+\s*/, "").trim();
    const startsBad = badStarters.some(s => clean.startsWith(s));
    const startsGood = goodStarters.some(s => clean.startsWith(s));
    if (startsBad) badFormulations++;
    else if (!startsGood && clean.length > 5) badFormulations++;
  });
  if (badFormulations > 0) { score.deductions.push(badFormulations * 5); notes.push(makeNote("medium", "صياغة بعض الأهداف غير قابلة للقياس", `${badFormulations} هدف(أهداف) تستخدم صياغات عامة غير قابلة للقياس المباشر.`, "أعد صياغة الأهداف بأفعال قابلة للقياس مثل: تحديد، قياس، تقييم، تحليل، التحقق من...")); }
  const objectiveTexts = lines.map(l => l.replace(/^[\d.\-)]+\s*/, "").trim());
  for (let i = 0; i < objectiveTexts.length; i++) {
    for (let j = i + 1; j < objectiveTexts.length; j++) {
      if (similarity(objectiveTexts[i], objectiveTexts[j]) > 0.7) {
        score.deductions.push(8);
        notes.push(makeNote("high", "تكرار بين الأهداف", `الهدف "${objectiveTexts[i].substring(0, 40)}..." متكرر بشكل كبير مع هدف آخر.`, "دمج الأهداف المتكررة أو تمييزها بوضوح."));
        break;
      }
    }
  }
}

function analyzeHypotheses(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const lines = text.split("\n").filter(l => l.trim().length > 5);
  if (lines.length < 1) { score.deductions.push(15); notes.push(makeNote("medium", "لا توجد فرضيات واضحة", "معظم الرسائل الكمية تحتاج فرضيات لتوجيه التحليل.", "صغ فرضيات تتعلق بالعلاقات بين متغيرات الدراسة.")); }
  const hypothesisPatterns = [/توجد.*علاقة/,/لا توجد.*علاقة/,/يوجد.*تأثير/,/لا يوجد.*تأثير/,/يوجد.*فروق/,/لا توجد.*فروق/,/توجد.*دلالة/,/لا توجد.*دلالة/];
  const wellFormed = lines.filter(line => hypothesisPatterns.some(p => p.test(line.replace(/^[\d.\-)]+\s*/, "").trim()))).length;
  if (lines.length > 0 && wellFormed === 0) { score.deductions.push(15); notes.push(makeNote("high", "الفرضيات غير مصاغة بالصيغة الإحصائية المطلوبة", "الفرضيات يجب أن تصاغ بشكل يسمح باختبارها إحصائياً.", "أعد صياغة الفرضيات باستخدام الصيغة الإحصائية: \"توجد/لا توجد علاقة دالة إحصائياً عند مستوى دلالة (0.05) بين...\"")); }
  else if (wellFormed < lines.length && lines.length > 0) { score.deductions.push(8); notes.push(makeNote("medium", "بعض الفرضيات غير مصاغة بالشكل الإحصائي المناسب", `${lines.length - wellFormed} فرضية تحتاج إعادة صياغة.`, "وحّد صياغة جميع الفرضيات وفق النمط الإحصائي المعتمد.")); }
  const hasNull = /لا توجد|لا يوجد/.test(text);
  if (lines.length >= 2 && !hasNull) { score.deductions.push(5); notes.push(makeNote("low", "لا توجد فرضيات صفرية واضحة", "يفضل ذكر الفرضية الصفرية (لا توجد علاقة/فروق) جنباً إلى جنب مع الفرضية البديلة.", "أضف الفرضيات الصفرية المقابلة لكل فرضية بديلة.")); }
}

function analyzeTheory(text: string, score: { value: number; deductions: number[] }, notes: Note[], degree: Degree) {
  const words = countWords(text);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
  if (words < 300 && degree === "phd") { score.deductions.push(20); notes.push(makeNote("high", "الإطار النظري قصير جداً لرسالة دكتوراه", `يحتوي على ${words} كلمة فقط. الإطار النظري للدكتوراه يحتاج عادةً 3000+ كلمة.`, "وسّع الإطار النظري بتغطية النظريات والدراسات السابقة بشكل أعمق.")); }
  else if (words < 200) { score.deductions.push(15); notes.push(makeNote("medium", "الإطار النظري قصير", `يحتوي على ${words} كلمة.`, "وسّع الإطار النظري ليغطي المتغيرات الأساسية والدراسات السابقة.")); }
  const hasCitations = /\(\d{4}\)|\[\d+\]|\d{4}[مه]/.test(text) || /دراسة|باحث|أشار|أكد|توصل/.test(text);
  if (!hasCitations) { score.deductions.push(15); notes.push(makeNote("high", "الإطار النظري يفتقر للتوثيق والدراسات السابقة", "الإطار النظري يجب أن يستند إلى دراسات سابقة ونظريات علمية موثقة.", "أضف إشارات للدراسات السابقة والنظريات ذات الصلة مع التوثيق المناسب.")); }
  if (!/يُعرّف|تعريف|مفهوم|يُقصد|المقصود/.test(text)) { score.deductions.push(8); notes.push(makeNote("medium", "لا توجد تعريفات إجرائية للمتغيرات", "الإطار النظري يجب أن يتضمن تعريفات إجرائية للمتغيرات الرئيسية.", "أضف تعريفات إجرائية واضحة لكل متغير من متغيرات الدراسة.")); }
  if (paragraphs.length < 3 && words > 200) { score.deductions.push(5); notes.push(makeNote("low", "الإطار النظري يحتاج تهيئة فقرات أفضل", `النص مقسم إلى ${paragraphs.length} فقرات فقط.`, "قسّم الإطار النظري إلى فقرات مترابطة كل منها يغطي محوراً محدداً.")); }
  const academicTerms = ["متغير","مستقل","تابع","وسيط","ضابط","نظرية","منهج","عينة","صدق","ثبات","إحصاء","دلالة","معامل","ارتباط","انحدار"];
  const academicCount = academicTerms.filter(t => text.includes(t)).length;
  if (academicCount < 2 && words > 200) { score.deductions.push(5); notes.push(makeNote("low", "قلة المصطلحات الأكاديمية المتخصصة", "الإطار النظري يجب أن يستخدم مصطلحات تخصصية دقيقة.", "استخدم مصطلحات أكاديمية أكثر دقة وتخصصاً.")); }
}

function analyzeMethodology(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const required = [
    { terms: ["منهج","المنهج","المنهجية","أسلوب"], name: "نوع المنهج" },
    { terms: ["عينة","المجتمع","أفراد العينة","حجم العينة"], name: "المجتمع والعينة" },
    { terms: ["أداة","استبانة","اختبار","مقياس","استبيان","مقابلة","بطاقة"], name: "أداة البحث" },
    { terms: ["صدق","ثبات","معامل","كرونباخ","ألفا","Cronbach"], name: "الصدق والثبات" },
    { terms: ["إحصائي","SPSS","معامل ارتباط","انحدار","T-test","ANOVA","تحليل التباين"], name: "المعالجة الإحصائية" },
  ];
  const missing = required.filter(r => !r.terms.some(t => text.includes(t))).map(r => r.name);
  if (missing.length >= 3) { score.deductions.push(25); notes.push(makeNote("high", "المنهجية ناقصة بشكل جوهري", `العناصر المفقودة: ${missing.join("، ")}`, "أعد كتابة المنهجية لتشمل جميع العناصر الأساسية بالتفصيل.")); }
  else if (missing.length > 0) { score.deductions.push(missing.length * 7); notes.push(makeNote("medium", "المنهجية تفتقر لبعض العناصر الأساسية", `العناصر المفقودة: ${missing.join("، ")}`, "أضف العناصر المفقودة مع التفصيل المناسب.")); }
  if (!/\d+/.test(text)) { score.deductions.push(10); notes.push(makeNote("medium", "لا توجد أرقام محددة في المنهجية", "المنهجية يجب أن تحتوي على أرقام دقيقة: حجم العينة، عدد فقرات الأداة، معاملات الصدق والثبات.", "أضف الأرقام والإحصائيات اللازمة.")); }
  const methodTypes = ["وصفي","تجريبي","شبه تجريبي","تحليلي","تاريخي","ميداني","مسحي","تطبيقي"];
  if (!methodTypes.some(m => text.includes(m))) { score.deductions.push(10); notes.push(makeNote("high", "لم يتم تحديد نوع المنهج بوضوح", "يجب تحديد نوع المنهج المستخدم بشكل صريح (وصفي، تجريبي، تحليلي...).", "حدد نوع المنهج المستخدم مع تبرير اختياره.")); }
  if (text.includes("ألفا") || text.includes("كرونباخ") || text.toLowerCase().includes("cronbach")) {
    const alphaMatch = text.match(/(?:ألفا|كرونباخ|Cronbach)[^\d]*(\d+\.?\d*)/);
    if (alphaMatch) {
      const alpha = parseFloat(alphaMatch[1]);
      if (alpha < 0.6) { score.deductions.push(12); notes.push(makeNote("high", `معامل كرونباخ ألفا منخفض (${alpha})`, "المقبول عادةً هو 0.70 فأعلى. القيمة المنخفضة تشير إلى مشاكل في ثبات الأداة.", "راجع فقرات الأداة واحذف الفقرات الضعيفة أو أعد صياغتها.")); }
      else if (alpha < 0.70) { score.deductions.push(5); notes.push(makeNote("low", `معامل كرونباخ ألفا مقبول بشكل محدود (${alpha})`, "القيمة مقبولة لكنها قريبة من الحد الأدنى.", "حاول تحسين الثبات بمراجعة الفقرات.")); }
    }
  }
}

function analyzeAnalysis(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const statTests = [
    { pattern: /T.test|t-test|اختبار ت/, name: "اختبار t" },
    { pattern: /ANOVA|تحليل التباين|analysis of variance/i, name: "تحليل التباين" },
    { pattern: /ارتباط|correlation|بيرسون|Pearson/i, name: "معامل الارتباط" },
    { pattern: /انحدار|regression/i, name: "الانحدار" },
    { pattern: /كاي مربع|Chi.square|chi-square/i, name: "كاي مربع" },
    { pattern: /متوسط|وسط حسابي|mean/i, name: "المتوسطات الحسابية" },
    { pattern: /انحراف معياري|standard deviation/i, name: "الانحراف المعياري" },
  ];
  const foundTests = statTests.filter(t => t.pattern.test(text)).map(t => t.name);
  if (foundTests.length === 0 && countWords(text) > 30) { score.deductions.push(20); notes.push(makeNote("high", "لا توجد اختبارات إحصائية واضحة", "قسم تحليل البيانات يجب أن يعرض نتائج الاختبارات الإحصائية المستخدمة.", "أضف جداول النتائج الإحصائية مع تفسيرها.")); }
  const hasNumbers = (text.match(/\d+\.\d{2,}/g) || []).length;
  if (hasNumbers < 3 && countWords(text) > 50) { score.deductions.push(10); notes.push(makeNote("medium", "قلة الأرقام الإحصائية في التحليل", "التحليل الإحصائي يجب أن يحتوي على قيم إحصائية دقيقة.", "أضف القيم الإحصائية الكاملة لكل اختبار.")); }
  if (!/0\.05|0\.01|دلالة إحصائية|مستوى الدلالة|Sig/.test(text) && countWords(text) > 50) { score.deductions.push(8); notes.push(makeNote("medium", "لم يتم ذكر مستوى الدلالة الإحصائية", "يجب تحديد مستوى الدلالة المستخدم (عادةً 0.05 أو 0.01).", "أضف بيان مستوى الدلالة المعتمد في البحث.")); }
  if (!/أي أن|مما يعني|يشير هذا|يدل هذا|يعزى هذا|تفسر|بمعنى/.test(text) && countWords(text) > 100) { score.deductions.push(10); notes.push(makeNote("medium", "التحليل يفتقر لتفسير النتائج الإحصائية", "لا يكفي عرض الأرقام، بل يجب تفسيرها بلغة واضحة.", "أضف تفسيراً لكل نتيجة إحصائية بما يفهمه القارئ غير المتخصص.")); }
}

function analyzeResults(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const words = countWords(text);
  if (words < 50) { score.deductions.push(20); notes.push(makeNote("high", "قسم النتائج قصير جداً", "النتائج تحتاج إلى تفصيل أكثر وربط واضح بالفرضيات.", "وسّع قسم النتائج مع عرض كل نتيجة مرتبطة بفرضية محددة.")); }
  if (!/فرضية|الفرضية|الفرض/.test(text) && words > 50) { score.deductions.push(12); notes.push(makeNote("high", "النتائج غير مرتبطة بالفرضيات بوضوح", "كل نتيجة يجب أن تُربط بالفرضية التي تتحقق منها.", "أعد تنظيم النتائج بحيث كل فرضية لها نتيجة مقابلة.")); }
  if (!/توصلت|أظهرت|أثبتت|تبين|أكدت|دلت|أسفرت|تشير النتائج/.test(text) && words > 30) { score.deductions.push(8); notes.push(makeNote("medium", "صياغة النتائج ضعيفة", "النتائج يجب أن تُصاغ بصيغة جازمة واضحة.", "استخدم صياغات مثل: \"توصلت الدراسة إلى...\" أو \"أظهرت النتائج أن...\"")); }
  if (!/أما|كما|وبالتالي|إضافة إلى|فضلاً عن|علاوة على|فيما يتعلق/.test(text) && words > 100) { score.deductions.push(5); notes.push(makeNote("low", "ضعف في الترابط بين النتائج", "استخدم أدوات الربط لتحقيق التسلسل المنطقي بين النتائج.", "أضف أدوات ربط مناسبة بين النتائج المختلفة.")); }
}

function analyzeRecommendations(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const lines = text.split("\n").filter(l => l.trim().length > 5);
  if (lines.length < 2) { score.deductions.push(15); notes.push(makeNote("medium", "عدد التوصيات قليل", "يجب تقديم توصيات كافية تستند إلى النتائج (3-8 توصيات).", "أضف توصيات إضافية تنبثق من نتائج الدراسة.")); }
  const goodRecPatterns = [/يوصي/,/يُقترح/,/يجب/,/ينبغي/,/من الضروري/,/يفضل/];
  const badRecs = lines.filter(line => {
    const clean = line.replace(/^[\d.\-)]+\s*/, "").trim();
    return !goodRecPatterns.some(p => p.test(clean)) && clean.length > 10;
  }).length;
  if (badRecs > 0) { score.deductions.push(badRecs * 4); notes.push(makeNote("medium", "بعض التوصيات غير مصاغة بصيغة التوصية", `${badRecs} توصية لا تبدأ بصيغة توصية واضحة.`, "ابدأ كل توصية بـ: \"يوصي الباحث بـ...\" أو \"يُقترح...\"")); }
  if (!/بناءً على|استناداً إلى|وفقاً لنتائج|في ضوء نتائج|بناء على نتائج/.test(text) && lines.length >= 2) { score.deductions.push(8); notes.push(makeNote("medium", "التوصيات غير مرتبطة بوضوح بنتائج الدراسة", "كل توصية يجب أن تستند إلى نتيجة محددة من الدراسة.", "اربط كل توصية بالنتيجة التي تستند إليها.")); }
}

function analyzeReferences(text: string, score: { value: number; deductions: number[] }, notes: Note[]) {
  const lines = text.split("\n").filter(l => l.trim().length > 10);
  if (lines.length < 5) { score.deductions.push(20); notes.push(makeNote("high", "عدد المراجع قليل جداً", `يوجد ${lines.length} مرجع فقط. الحد الأدنى عادةً 20-30 مرجعاً للماجستير و40-60 للدكتوراه.`, "أضف المزيد من المراجع الحديثة والمتنوعة.")); }
  let oldRefs = 0, recentRefs = 0, noYearRefs = 0;
  lines.forEach(line => {
    const years = line.match(/(?:19|20)\d{2}/g);
    if (!years) { noYearRefs++; return; }
    years.forEach(y => { if (parseInt(y) < 2010) oldRefs++; else recentRefs++; });
  });
  if (oldRefs > recentRefs && lines.length > 5) { score.deductions.push(12); notes.push(makeNote("medium", "معظم المراجع قديمة", "المراجع القديمة (قبل 2010) أكثر من الحديثة. يُفضل أن تكون غالبية المراجع خلال آخر 10 سنوات.", "حدّث قائمة المراجع بإضافة مصادر حديثة.")); }
  if (noYearRefs > 0) { score.deductions.push(noYearRefs * 3); notes.push(makeNote("medium", `${noYearRefs} مرجع بدون سنة نشر`, "كل مرجع يجب أن يتضمن سنة النشر.", "أكمل بيانات المراجع الناقصة.")); }
  const hasEnglish = lines.some(l => /[a-zA-Z]{3,}/.test(l));
  if (!hasEnglish && lines.length > 10) { score.deductions.push(8); notes.push(makeNote("low", "لا توجد مراجع أجنبية", "التنوع في المصادر (عربية وأجنبية) يعزز مصداقية البحث.", "أضف مراجع أجنبية حديثة ذات صلة.")); }
  const refTexts = lines.map(l => l.replace(/\s+/g, " ").trim());
  for (let i = 0; i < refTexts.length; i++) {
    for (let j = i + 1; j < refTexts.length; j++) {
      if (similarity(refTexts[i], refTexts[j]) > 0.8) {
        score.deductions.push(5);
        notes.push(makeNote("medium", "مرجع مكرر في قائمة المراجع", `المرجع: "${refTexts[i].substring(0, 50)}..." مكرر.`, "احذف المراجع المكررة."));
        break;
      }
    }
  }
}

function performAnalysis(sectionData: Record<string, string>, role: Role, degree: Degree): AnalysisResults {
  const base: Record<string, number> = { title:1.2,toc:0.8,abstract:1.3,objectives:1.4,hypotheses:1.3,theory:1.5,methodology:1.6,analysis:1.5,results:1.4,recommendations:1.0,references:0.9 };
  if (role === "supervisor") { base.theory=1.8; base.methodology=1.8; base.objectives=1.6; }
  else if (role === "internal") { base.analysis=1.8; base.results=1.7; base.hypotheses=1.6; }
  else if (role === "external") { base.title=1.5; base.abstract=1.5; base.theory=1.7; base.references=1.4; }
  else if (role === "researcher") { base.methodology=1.8; base.analysis=1.8; base.references=1.3; }

  const filledSections = SECTION_KEYS.filter(k => (sectionData[k] || "").trim().length >= 10);
  const results: AnalysisResults = { totalScore:0, sectionScores:{}, sectionNotes:{}, generalNotes:[], stats:{ totalWords:0,totalChars:0,sectionsAnalyzed:filledSections.length,highIssues:0,mediumIssues:0,lowIssues:0,infoCount:0 } };
  let totalWeighted = 0, totalWeight = 0;

  filledSections.forEach(key => {
    const text = (sectionData[key] || "").trim();
    const scoreObj = { value: 100, deductions: [] as number[] };
    const notes: Note[] = [];
    switch(key) {
      case "title": analyzeTitle(text, scoreObj, notes, degree); break;
      case "toc": analyzeTOC(text, scoreObj, notes); break;
      case "abstract": analyzeAbstract(text, scoreObj, notes); break;
      case "objectives": analyzeObjectives(text, scoreObj, notes); break;
      case "hypotheses": analyzeHypotheses(text, scoreObj, notes); break;
      case "theory": analyzeTheory(text, scoreObj, notes, degree); break;
      case "methodology": analyzeMethodology(text, scoreObj, notes); break;
      case "analysis": analyzeAnalysis(text, scoreObj, notes); break;
      case "results": analyzeResults(text, scoreObj, notes); break;
      case "recommendations": analyzeRecommendations(text, scoreObj, notes); break;
      case "references": analyzeReferences(text, scoreObj, notes); break;
    }
    applyGeneralTextChecks(text, scoreObj, notes, key);
    const finalScore = Math.max(0, Math.min(100, scoreObj.value - scoreObj.deductions.reduce((a,b)=>a+b,0)));
    results.sectionScores[key] = finalScore;
    results.sectionNotes[key] = notes;
    const w = base[key] || 1;
    totalWeighted += finalScore * w;
    totalWeight += w;
    results.stats.totalWords += countWords(text);
    results.stats.totalChars += text.length;
    notes.forEach(n => {
      if (n.severity === "high") results.stats.highIssues++;
      else if (n.severity === "medium") results.stats.mediumIssues++;
      else if (n.severity === "low") results.stats.lowIssues++;
      else results.stats.infoCount++;
    });
  });

  results.totalScore = Math.round(totalWeight > 0 ? totalWeighted / totalWeight : 0);
  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 80) return "#2ecc71";
  if (score >= 60) return "#f39c12";
  return "#e74c3c";
}
function getScoreLabel(score: number) {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "جيد جداً";
  if (score >= 70) return "جيد";
  if (score >= 60) return "مقبول";
  if (score >= 50) return "ضعيف";
  return "ضعيف جداً";
}
function getSeverityLabel(s: string) {
  const m: Record<string,string> = { high:"حرج", medium:"متوسط", low:"ثانوي", info:"معلوماتي" };
  return m[s] || s;
}
function getSeverityColor(s: string) {
  const m: Record<string,string> = { high:"#e74c3c", medium:"#f39c12", low:"#3498db", info:"#1abc9c" };
  return m[s] || "#aaa";
}

function exportReport(results: AnalysisResults, degree: Degree, field: string) {
  let text = `═══════════════════════════════════════\n   تقرير مراجعة الرسالة الأكاديمية\n═══════════════════════════════════════\n\n`;
  text += `الدرجة العلمية: ${degree === "masters" ? "ماجستير" : "دكتوراه"}\n`;
  text += `التخصص: ${field || "غير محدد"}\n`;
  text += `التقييم العام: ${results.totalScore}% - ${getScoreLabel(results.totalScore)}\n`;
  text += `عدد الأقسام المحللة: ${results.stats.sectionsAnalyzed}\n`;
  text += `إجمالي الكلمات: ${results.stats.totalWords}\n\n`;
  text += `───────────────────────────────────────\n   درجات الأقسام\n───────────────────────────────────────\n\n`;
  Object.entries(results.sectionScores).forEach(([key, score]) => {
    text += `● ${SECTIONS[key].label}: ${score}% (${getScoreLabel(score)})\n`;
  });
  text += `\n───────────────────────────────────────\n   الملاحظات التفصيلية\n───────────────────────────────────────\n\n`;
  Object.entries(results.sectionNotes).forEach(([key, notes]) => {
    notes.forEach(n => {
      text += `[${SECTIONS[key].label}] [${getSeverityLabel(n.severity)}] ${n.title}\n`;
      text += `  ${n.body}\n`;
      if (n.suggestion) text += `  >> المقترح: ${n.suggestion}\n`;
      text += `\n`;
    });
  });
  text += `\n═══════════════════════════════════════\nتم إنشاؤه بواسطة محكّم · ${new Date().toLocaleDateString("ar-EG")}\n═══════════════════════════════════════\n`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `تقرير_مراجعة_الرسالة_${new Date().toISOString().split("T")[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSS Styles ───────────────────────────────────────────────────────────────
const DARK = { bg: "#0a0f0d", card: "#111a16", input: "#0d1512", accent: "#c9a84c", accentDim: "rgba(201,168,76,0.15)", border: "#1e2e28", borderLight: "#2a3e36", text: "#e8e4dc", textMuted: "#8a9490", textDim: "#5a6560", green: "#2ecc71", red: "#e74c3c", orange: "#f39c12", blue: "#3498db" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function AnimatedScore({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    function update(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }, [value]);
  const color = getScoreColor(value);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
      <div style={{ position:"relative", width:90, height:90, flexShrink:0 }}>
        <svg viewBox="0 0 90 90" style={{ width:90,height:90 }}>
          <circle cx="45" cy="45" r="38" fill="none" stroke={DARK.border} strokeWidth="6" />
          <circle cx="45" cy="45" r="38" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transform:"rotate(-90deg)", transformOrigin:"50% 50%", transition:"stroke-dashoffset 1.2s ease" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color }}>{displayed}</div>
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:900, color, marginBottom:2 }}>{getScoreLabel(value)}</div>
        <div style={{ fontSize:13, color:DARK.textMuted }}>من 100 نقطة</div>
      </div>
    </div>
  );
}

function NoteCard({ note, section }: { note: Note; section?: string }) {
  const color = getSeverityColor(note.severity);
  return (
    <div style={{ background:DARK.card, border:`1px solid ${color}33`, borderRadius:10, padding:"14px 16px", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
        {section && <span style={{ fontSize:11, color:DARK.textMuted, background:DARK.input, padding:"2px 7px", borderRadius:5 }}>{section}</span>}
        <span style={{ flex:1, fontWeight:700, fontSize:13, color:DARK.text }}>{note.title}</span>
        <span style={{ fontSize:11, color, background:`${color}1a`, padding:"2px 8px", borderRadius:12, fontWeight:700, flexShrink:0 }}>{getSeverityLabel(note.severity)}</span>
      </div>
      <div style={{ fontSize:13, color:DARK.textMuted, lineHeight:1.7, marginBottom: note.suggestion ? 8 : 0 }}>{note.body}</div>
      {note.suggestion && (
        <div style={{ fontSize:12, color:DARK.accent, background:DARK.accentDim, borderRadius:6, padding:"6px 10px", display:"flex", alignItems:"flex-start", gap:6 }}>
          <span style={{ flexShrink:0, marginTop:1 }}>💡</span>
          <span>{note.suggestion}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LocalReview() {
  const [sectionData, setSectionData] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("lr_thesisData") || "{}"); } catch { return {}; }
  });
  const [currentSection, setCurrentSection] = useState<string>("title");
  const [role, setRole] = useState<Role>("supervisor");
  const [degree, setDegree] = useState<Degree>("masters");
  const [field, setField] = useState("");
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    localStorage.setItem("lr_thesisData", JSON.stringify(sectionData));
  }, [sectionData]);

  const filledCount = SECTION_KEYS.filter(k => (sectionData[k] || "").trim().length >= (SECTIONS[k].minLength || 10)).length;
  const progress = Math.round((filledCount / SECTION_KEYS.length) * 100);

  const handleAnalyze = async () => {
    const filledSections = SECTION_KEYS.filter(k => (sectionData[k] || "").trim().length >= 10);
    if (filledSections.length === 0) { showToast("الرجاء إدخال بيانات قسم واحد على الأقل", "error"); return; }
    setLoading(true);
    const steps = ["فحص العنوان ودقته","تحليل هيكل الفهرس","تقييم شمولية المستخلص","مراجعة صياغة الأهداف","فحص قابلية الفرضيات للاختبار","تحليل الإطار النظري والفجوات","تقييم التوازن المنهجي","فحص ملاءمة التحليل الإحصائي","مراجعة ارتباط النتائج بالفرضيات","تقييم قابلية التوصيات للتطبيق","فحص التوثيق والمراجع","إعداد التقرير النهائي"];
    for (const step of steps) {
      setLoadingStep(step);
      await new Promise(r => setTimeout(r, 200 + Math.random() * 350));
    }
    const r = performAnalysis(sectionData, role, degree);
    setResults(r);
    setLoading(false);
    showToast("تم التحليل بنجاح ✓");
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const handleClear = () => {
    if (!confirm("هل تريد مسح جميع البيانات المدخلة؟")) return;
    setSectionData({});
    setResults(null);
    localStorage.removeItem("lr_thesisData");
    showToast("تم مسح جميع البيانات", "warning");
  };

  const sec = SECTIONS[currentSection];
  const currentVal = sectionData[currentSection] || "";
  const charCount = currentVal.length;

  const allNotes: (Note & { section: string })[] = results
    ? [
        ...results.generalNotes.map(n => ({ ...n, section: "عام" })),
        ...Object.entries(results.sectionNotes).flatMap(([key, notes]) => notes.map(n => ({ ...n, section: SECTIONS[key].label }))),
      ].sort((a, b) => { const o: Record<string,number> = { high:0,medium:1,low:2,info:3 }; return (o[a.severity]||3)-(o[b.severity]||3); })
    : [];

  return (
    <div dir="rtl" style={{ minHeight:"100vh", background:DARK.bg, color:DARK.text, fontFamily:"'Tajawal',sans-serif", position:"relative", overflow:"hidden" }}>
      {/* Animated background */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", width:600,height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.07), transparent 70%)", top:"-10%", right:"-10%", filter:"blur(120px)", animation:"orbFloat 20s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:500,height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(46,204,113,0.05), transparent 70%)", bottom:"-10%", left:"-10%", filter:"blur(120px)", animation:"orbFloat 20s ease-in-out infinite -7s" }} />
        <div style={{ position:"absolute", width:400,height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(201,168,76,0.04), transparent 70%)", top:"40%", left:"40%", filter:"blur(120px)", animation:"orbFloat 20s ease-in-out infinite -14s" }} />
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(201,168,76,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.03) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
      </div>

      <style>{`
        @keyframes orbFloat {
          0%,100%{transform:translate(0,0) scale(1)}
          25%{transform:translate(30px,-40px) scale(1.05)}
          50%{transform:translate(-20px,20px) scale(0.95)}
          75%{transform:translate(40px,30px) scale(1.02)}
        }
        .lr-tab:hover{background:rgba(201,168,76,0.08)!important}
        .lr-tab.active-tab{background:rgba(201,168,76,0.15)!important;border-color:rgba(201,168,76,0.4)!important;color:#c9a84c!important}
        .lr-role:hover{opacity:0.85}
        .lr-role.active-role{background:rgba(201,168,76,0.2)!important;border-color:#c9a84c!important;color:#c9a84c!important}
        .lr-textarea{resize:vertical;min-height:180px}
        .lr-textarea:focus,.lr-input:focus{outline:none;border-color:#c9a84c!important;box-shadow:0 0 0 2px rgba(201,168,76,0.15)}
        .lr-btn-analyze:hover{opacity:0.9;transform:translateY(-1px)}
        .lr-btn-analyze:active{transform:translateY(0)}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background: toast.type === "error" ? "#e74c3c" : toast.type === "warning" ? "#f39c12" : "#27ae60", color:"#fff", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", display:"flex", alignItems:"center", gap:8 }}>
          <span>{toast.type === "error" ? "⚠️" : toast.type === "warning" ? "🔔" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div style={{ position:"fixed", inset:0, background:"rgba(10,15,13,0.92)", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
          <div style={{ width:60,height:60, border:`4px solid ${DARK.border}`, borderTopColor:DARK.accent, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
          <div style={{ fontSize:18, fontWeight:700, color:DARK.accent }}>جارٍ التحليل...</div>
          <div style={{ fontSize:14, color:DARK.textMuted }}>{loadingStep}</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      <div style={{ position:"relative", zIndex:1, maxWidth:1300, margin:"0 auto", padding:"20px 16px 40px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", padding:"36px 20px 32px" }}>
          <div style={{ width:72,height:72, margin:"0 auto 18px", background:"linear-gradient(135deg,#c9a84c,#8b7332)", borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, boxShadow:"0 8px 32px rgba(201,168,76,0.3)" }}>⚖️</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:DARK.text, margin:"0 0 8px" }}>منصة مراجعة الرسائل الأكاديمية</h1>
          <p style={{ color:DARK.textMuted, fontSize:14, margin:0 }}>تحليل محلي فوري · ١١ قسماً · ٤ أدوار · بدون إنترنت</p>
          {progress > 0 && (
            <div style={{ maxWidth:400, margin:"16px auto 0", background:DARK.border, borderRadius:10, height:6, overflow:"hidden" }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${DARK.accent},#8b7332)`, width:`${progress}%`, borderRadius:10, transition:"width .4s" }} />
            </div>
          )}
          {progress > 0 && <div style={{ fontSize:12, color:DARK.textMuted, marginTop:6 }}>{filledCount} من {SECTION_KEYS.length} قسم مكتمل</div>}
        </div>

        {/* Controls bar */}
        <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, padding:"16px 18px", marginBottom:20, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center" }}>
          {/* Degree */}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:12, color:DARK.textMuted }}>الدرجة العلمية</label>
            <select value={degree} onChange={e => setDegree(e.target.value as Degree)}
              style={{ background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.text, borderRadius:8, padding:"6px 12px", fontSize:13, fontFamily:"inherit" }}>
              <option value="masters">ماجستير</option>
              <option value="phd">دكتوراه</option>
            </select>
          </div>
          {/* Field */}
          <div style={{ flex:1, minWidth:160, display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:12, color:DARK.textMuted }}>التخصص</label>
            <input value={field} onChange={e => setField(e.target.value)}
              placeholder="مثال: علم النفس التربوي"
              style={{ background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.text, borderRadius:8, padding:"6px 12px", fontSize:13, fontFamily:"inherit" }} />
          </div>
          {/* Roles */}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:12, color:DARK.textMuted }}>وضع التقييم</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {([["supervisor","مشرف"],["internal","داخلي"],["external","خارجي"],["researcher","باحث"]] as [Role,string][]).map(([r, label]) => (
                <button key={r} className={`lr-role${role===r?" active-role":""}`}
                  onClick={() => setRole(r)}
                  style={{ background:"transparent", border:`1px solid ${DARK.borderLight}`, color:DARK.textMuted, borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main 2-column layout */}
        <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:18, alignItems:"start" }}>

          {/* LEFT: Input Panel (sticky) */}
          <div style={{ position:"sticky", top:20 }}>
            <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, overflow:"hidden" }}>
              {/* Section tabs */}
              <div style={{ borderBottom:`1px solid ${DARK.border}`, maxHeight:320, overflowY:"auto" }}>
                {SECTION_KEYS.map(key => {
                  const s = SECTIONS[key];
                  const val = (sectionData[key] || "").trim();
                  const filled = val.length >= (s.minLength || 10);
                  const isActive = currentSection === key;
                  return (
                    <button key={key} className={`lr-tab${isActive?" active-tab":""}`}
                      onClick={() => setCurrentSection(key)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"transparent", border:"none", borderBottom:`1px solid ${DARK.border}`, color: isActive ? DARK.accent : DARK.text, cursor:"pointer", fontFamily:"inherit", textAlign:"right", transition:"all .12s" }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight:700 }}>{s.label}</span>
                      {filled && <span style={{ width:8,height:8, borderRadius:"50%", background:DARK.green, flexShrink:0 }} />}
                      {results && results.sectionScores[key] !== undefined && (
                        <span style={{ fontSize:11, color:getScoreColor(results.sectionScores[key]), fontWeight:700, flexShrink:0 }}>{results.sectionScores[key]}%</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Current section input */}
              <div style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{sec.icon}</span>
                  <span style={{ fontSize:15, fontWeight:800, color:DARK.text }}>{sec.label}</span>
                </div>
                <div style={{ fontSize:12, color:DARK.textMuted, background:DARK.accentDim, border:`1px solid rgba(201,168,76,0.15)`, borderRadius:8, padding:"8px 10px", marginBottom:10, lineHeight:1.7 }}>
                  💡 {sec.help}
                </div>
                {sec.type === "textarea" ? (
                  <textarea className="lr-textarea"
                    value={currentVal}
                    placeholder={sec.placeholder}
                    onChange={e => setSectionData(prev => ({ ...prev, [currentSection]: e.target.value }))}
                    style={{ width:"100%", background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.text, borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"inherit", lineHeight:1.7, boxSizing:"border-box" }}
                  />
                ) : (
                  <input className="lr-input"
                    value={currentVal}
                    placeholder={sec.placeholder}
                    onChange={e => setSectionData(prev => ({ ...prev, [currentSection]: e.target.value }))}
                    style={{ width:"100%", background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.text, borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }}
                  />
                )}
                <div style={{ fontSize:11, color: sec.maxLength && charCount > sec.maxLength ? DARK.red : charCount < (sec.minLength||0) ? DARK.orange : DARK.textDim, marginTop:4, textAlign:"left" }}>
                  {charCount} حرف{sec.maxLength ? ` / ${sec.maxLength}` : ""}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding:"12px 16px 16px", display:"flex", flexDirection:"column", gap:8, borderTop:`1px solid ${DARK.border}` }}>
                <button className="lr-btn-analyze"
                  onClick={handleAnalyze}
                  disabled={loading}
                  style={{ width:"100%", background:`linear-gradient(135deg,${DARK.accent},#8b7332)`, border:"none", borderRadius:10, color:"#fff", padding:"12px", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit", boxShadow:`0 4px 16px rgba(201,168,76,0.3)`, transition:"all .15s", opacity:loading?0.6:1 }}>
                  {loading ? "جارٍ التحليل..." : "🔍 ابدأ التحليل"}
                </button>
                <div style={{ display:"flex", gap:8 }}>
                  {results && (
                    <button onClick={() => exportReport(results, degree, field)}
                      style={{ flex:1, background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.textMuted, borderRadius:8, padding:"8px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      📥 تصدير
                    </button>
                  )}
                  <button onClick={handleClear}
                    style={{ flex:1, background:DARK.input, border:`1px solid ${DARK.borderLight}`, color:DARK.red, borderRadius:8, padding:"8px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                    🗑️ مسح الكل
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Results Panel */}
          <div ref={resultsRef}>
            {!results ? (
              <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, padding:"60px 20px", textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
                <div style={{ fontSize:16, fontWeight:700, color:DARK.textMuted, marginBottom:8 }}>لم يبدأ التحليل بعد</div>
                <div style={{ fontSize:13, color:DARK.textDim }}>أدخل بيانات الأقسام من اللوحة اليسرى، ثم اضغط "ابدأ التحليل"</div>
                <div style={{ marginTop:24, display:"flex", flexWrap:"wrap", justifyContent:"center", gap:12 }}>
                  {[{ icon:"⚡", label:"تحليل فوري بدون انتظار" },{ icon:"🔒", label:"بياناتك محفوظة محلياً" },{ icon:"📋", label:"تصدير التقرير نصياً" }].map(item => (
                    <div key={item.label} style={{ background:DARK.input, border:`1px solid ${DARK.border}`, borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                      <span>{item.icon}</span>
                      <span style={{ fontSize:12, color:DARK.textMuted }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {/* Score overview */}
                <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, padding:"20px 22px" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:DARK.accent, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>📈 ملخص التقييم الشامل</div>
                  <AnimatedScore value={results.totalScore} />
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20 }}>
                    {[
                      { val:results.stats.sectionsAnalyzed, label:"أقسام محللة", color:DARK.green },
                      { val:results.stats.highIssues, label:"ملاحظات حرجة", color:DARK.red },
                      { val:results.stats.mediumIssues, label:"ملاحظات متوسطة", color:DARK.orange },
                      { val:results.stats.totalWords.toLocaleString("ar-EG"), label:"إجمالي الكلمات", color:DARK.blue },
                    ].map(s => (
                      <div key={s.label} style={{ background:DARK.input, border:`1px solid ${DARK.border}`, borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                        <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
                        <div style={{ fontSize:11, color:DARK.textDim, marginTop:3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section scores grid */}
                <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, padding:"20px 22px" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:DARK.accent, marginBottom:14 }}>📋 درجات الأقسام</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
                    {Object.entries(results.sectionScores).map(([key, score]) => {
                      const s = SECTIONS[key];
                      const color = getScoreColor(score);
                      return (
                        <button key={key} onClick={() => setCurrentSection(key)}
                          style={{ background:DARK.input, border:`1px solid ${color}33`, borderRadius:10, padding:"12px", textAlign:"center", cursor:"pointer", fontFamily:"inherit" }}>
                          <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                          <div style={{ fontSize:12, fontWeight:700, color:DARK.text, marginBottom:6 }}>{s.label}</div>
                          <div style={{ fontSize:22, fontWeight:900, color, marginBottom:2 }}>{score}%</div>
                          <div style={{ fontSize:11, color:DARK.textMuted }}>{getScoreLabel(score)}</div>
                          <div style={{ height:4, background:DARK.border, borderRadius:3, marginTop:8, overflow:"hidden" }}>
                            <div style={{ height:"100%", background:color, width:`${score}%`, borderRadius:3, transition:"width .6s" }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* All notes */}
                {allNotes.length > 0 && (
                  <div style={{ background:DARK.card, border:`1px solid ${DARK.border}`, borderRadius:14, padding:"20px 22px" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:DARK.accent, marginBottom:4, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      📝 جميع الملاحظات التفصيلية
                      <span style={{ background:DARK.accentDim, color:DARK.accent, borderRadius:12, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{allNotes.length} ملاحظة</span>
                    </div>
                    {/* severity legend */}
                    <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                      {[["high","حرج",DARK.red],["medium","متوسط",DARK.orange],["low","ثانوي",DARK.blue],["info","معلوماتي","#1abc9c"]].map(([s,label,color]) => {
                        const count = allNotes.filter(n=>n.severity===s).length;
                        if(!count) return null;
                        return <span key={s} style={{fontSize:11,color:color as string,background:`${color as string}1a`,padding:"3px 10px",borderRadius:12,fontWeight:700}}>{count} {label}</span>;
                      })}
                    </div>
                    <div style={{ maxHeight:500, overflowY:"auto", paddingLeft:4 }}>
                      {allNotes.map((note, i) => <NoteCard key={i} note={note} section={note.section} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
