import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

type Strictness = "low" | "medium" | "high";

const STRICTNESS_LABEL: Record<Strictness, string> = {
  low:    "متساهل (مناسب للمسودات الأولى)",
  medium: "متوسط (مراجعة عادية)",
  high:   "صارم (مراجعة نهائية قبل المناقشة)",
};

const ROLE_LABEL: Record<string, string> = {
  supervisor: "مشرف أكاديمي",
  discussant: "مناقش داخلي",
  external:   "مناقش خارجي",
  researcher: "باحث",
};

const SECTION_META: Record<string, { name: string; prompt: string }> = {
  title:        { name: "العنوان",               prompt: "راجع دقة العنوان وتعبيره عن المحتوى واقترح تحسينات." },
  abstract:     { name: "المستخلص",              prompt: "راجع شمولية المستخلص: المشكلة، الأهداف، المنهج، النتائج، الكلمات المفتاحية." },
  introduction: { name: "المقدمة والإشكالية",    prompt: "قيّم خلفية البحث، المشكلة، أسئلة البحث، أهميته وحدوده." },
  objectives:   { name: "الأهداف والفرضيات",     prompt: "راجع وضوح الأهداف وقابليتها للقياس وارتباط الفرضيات بالمنهجية." },
  theoretical:  { name: "الإطار النظري",         prompt: "قيّم تغطية الأدبيات وحداثة المصادر وتكامل النظريات وتحديد الفجوات." },
  methodology:  { name: "المنهجية",              prompt: "افحص تصميم البحث، العينة، أدوات جمع البيانات، الصدق والثبات والأخلاقيات." },
  analysis:     { name: "تحليل البيانات",        prompt: "قيّم اختيار الأساليب الإحصائية أو النوعية، تفسير النتائج، الجداول والأشكال." },
  results:      { name: "النتائج والمناقشة",     prompt: "راجع تقديم النتائج وارتباطها بالفرضيات والدراسات السابقة." },
  conclusion:   { name: "الخاتمة",               prompt: "قيّم الاستنتاجات وارتباطها بأهداف البحث ومدى شموليتها." },
  recommendations: { name: "التوصيات",           prompt: "راجع واقعية التوصيات وأهميتها للتطبيق أو الأبحاث المستقبلية." },
  references:   { name: "المراجع والمصادر",      prompt: "افحص أسلوب الاقتباس، اكتمال المراجع، حداثتها وتنوعها." },
  language:     { name: "اللغة والأسلوب",        prompt: "راجع سلامة النحو والإملاء، الأسلوب العلمي، الاتساق والوضوح." },
  formatting:   { name: "التنسيق والهيكل",       prompt: "قيّم الفهرس، الترقيم، الهوامش، الخط، الجداول والأشكال والالتزام بدليل الجامعة." },
};

interface SectionResult { score: number; strengths: string; weaknesses: string; suggestions: string[] }
interface ReviewOutput { sections: Record<string, SectionResult>; overall_score: number; summary: string }

function buildPrompt(
  sectionKey: string,
  text: string,
  role: string,
  strictness: Strictness,
  thesisMeta: Record<string, string>,
): string {
  const meta = SECTION_META[sectionKey];
  const roleLabel = ROLE_LABEL[role] ?? role;
  const strictLabel = STRICTNESS_LABEL[strictness];

  const metaLines = Object.entries(thesisMeta)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `أنت ${roleLabel} خبير في مراجعة رسائل الماجستير والدكتوراه.
مستوى الصرامة: ${strictLabel}

بيانات الرسالة:
${metaLines || "(غير محددة)"}

مهمتك: مراجعة قسم "${meta.name}" التالي.
${meta.prompt}

أرجع JSON فقط بهذا الهيكل (لا تضف مفاتيح أخرى):
{
  "score": <رقم 0-10>,
  "strengths": "<نقاط القوة في فقرة واحدة>",
  "weaknesses": "<نقاط الضعف في فقرة واحدة>",
  "suggestions": ["اقتراح 1", "اقتراح 2", "اقتراح 3"]
}

نص القسم:
${text.slice(0, 4000)}`;
}

async function reviewSection(
  key: string,
  text: string,
  role: string,
  strictness: Strictness,
  meta: Record<string, string>,
): Promise<SectionResult> {
  const resp = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 1200,
    temperature: 0.3,
    messages: [{ role: "user", content: buildPrompt(key, text, role, strictness, meta) }],
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  const m   = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const clean = m ? m[1].trim() : raw.trim();
  try {
    return JSON.parse(clean) as SectionResult;
  } catch {
    return { score: 0, strengths: "", weaknesses: raw.slice(0, 400), suggestions: [] };
  }
}

// POST /api/ai/platform-review
// body: { sections: Record<string,string>; role: string; strictness: "low"|"medium"|"high"; meta?: Record<string,string> }
router.post("/ai/platform-review", async (req, res) => {
  const { sections, role = "supervisor", strictness = "medium", meta = {} } = req.body as {
    sections: Record<string, string>;
    role: string;
    strictness: Strictness;
    meta: Record<string, string>;
  };

  if (!sections || typeof sections !== "object") {
    res.status(400).json({ error: "يرجى إرسال sections كـ Record<string,string>." });
    return;
  }

  const entries = Object.entries(sections).filter(([k, v]) => SECTION_META[k] && v && v.trim().length > 30);
  if (!entries.length) {
    res.status(400).json({ error: "لا توجد أقسام كافية للمراجعة. أدخل نصاً في كل قسم تريد مراجعته." });
    return;
  }

  try {
    // Review all sections in parallel
    const results = await Promise.all(
      entries.map(async ([key, text]) => [key, await reviewSection(key, text, role, strictness as Strictness, meta as Record<string,string>)] as const)
    );

    const sections: Record<string, SectionResult> = {};
    let scoreSum = 0;
    for (const [key, result] of results) {
      sections[key] = result;
      scoreSum += result.score;
    }
    const overall_score = Math.round((scoreSum / results.length) * 10) / 10;

    // summary
    const summaryResp = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: "user",
        content: `أنت ${ROLE_LABEL[role] ?? role}. بناءً على المراجعة التالية لرسالة علمية، اكتب ملخصاً نهائياً بفقرتين: إيجابيات عامة وتوصيات رئيسية للتحسين. التقييم العام: ${overall_score}/10.\nالنتائج: ${JSON.stringify(results.map(([k, r]) => ({ section: SECTION_META[k]?.name, score: r.score })), null, 1)}`,
      }],
    });
    const summary = summaryResp.choices[0]?.message?.content?.trim() ?? "";

    const output: ReviewOutput = { sections, overall_score, summary };
    res.json(output);
  } catch (err) {
    req.log.error(err, "platform-review failed");
    res.status(500).json({ error: "فشل تحليل الأقسام. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
