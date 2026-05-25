import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// section id → Arabic name & custom prompt
const SECTION_META: Record<string, { name: string; prompt: string }> = {
  title:           { name: "العنوان",          prompt: "راجع دقة العنوان ومدى تعبيره عن محتوى الرسالة، واقترح تحسينات إن وجدت." },
  index:           { name: "الفهرس",           prompt: "راجع تنظيم الفهرس وتسلسل الموضوعات، وهل يعكس هيكل الرسالة بشكل منطقي؟" },
  abstract:        { name: "المستخلص",         prompt: "راجع شمولية المستخلص: المشكلة، الأهداف، المنهج، النتائج، والتوصيات. حدد الفجوات." },
  theoretical:     { name: "الإطار النظري",    prompt: "راجع تغطية الأدبيات السابقة، حدد الثغرات النظرية، وتقييم تكامل النظريات مع موضوع الرسالة." },
  methodology:     { name: "المنهجية",          prompt: "راجع تصميم البحث، أدوات جمع البيانات، العينة، الأساليب الإحصائية، ومدى ملاءمتها للإجابة عن الأسئلة." },
  analysis:        { name: "تحليل البيانات",   prompt: "راجع دقة التحليل، وضوح النتائج الإحصائية أو النوعية، وتطابقها مع أسئلة البحث." },
  results:         { name: "النتائج",           prompt: "راجع عرض النتائج وارتباطها بالفرضيات والأهداف، ومدى تفسيرها بشكل غير منحاز." },
  recommendations: { name: "التوصيات",         prompt: "راجع مدى واقعية التوصيات وارتباطها بنتائج الدراسة، وأهميتها للتطبيق أو الأبحاث المستقبلية." },
  hypotheses:      { name: "الفرضيات",         prompt: "راجع صياغة الفرضيات، قابليتها للاختبار، واتساقها مع المنهجية." },
  objectives:      { name: "الأهداف",          prompt: "راجع وضوح الأهداف وقابليتها للتحقق، ومدى تغطيتها لمشكلة البحث." },
};

const SYSTEM = `أنت أستاذ جامعي وخبير أكاديمي متخصص في الإشراف على رسائل الماجستير والدكتوراه.
مهمتك تقديم ملاحظات دقيقة وبناءة تشمل: الأخطاء المنهجية، الفجوات والنواقص، نقاط القوة والضعف، واقتراحات تحسين محددة.
ردودك باللغة العربية الفصحى، منظّمة ومباشرة.`;

async function reviewOne(sectionId: string, text: string): Promise<string> {
  const meta = SECTION_META[sectionId];
  if (!meta) return "قسم غير معروف.";
  if (!text || !text.trim()) return "لم يتم إدخال نص لهذا القسم.";

  const userPrompt = `أنت خبير أكاديمي. المطلوب: مراجعة قسم "${meta.name}" التالي وتقديم ملاحظات دقيقة.

${meta.prompt}

نص القسم:
${text.slice(0, 4000)}

الملاحظات:`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 1200,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user",   content: userPrompt },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? "لا توجد ملاحظات.";
}

// POST /api/ai/section-review
// body: { sectionId?: string; sections?: Record<string, string> }
// If sectionId is provided → review a single section
// If sections map is provided → review all non-empty sections in parallel
router.post("/ai/section-review", async (req, res) => {
  const { sectionId, text, sections } = req.body as {
    sectionId?: string;
    text?: string;
    sections?: Record<string, string>;
  };

  try {
    // Single section
    if (sectionId && text !== undefined) {
      const result = await reviewOne(sectionId, text);
      res.json({ [sectionId]: result });
      return;
    }

    // All sections in parallel
    if (sections && typeof sections === "object") {
      const entries = Object.entries(sections).filter(([, v]) => v && v.trim());
      if (entries.length === 0) {
        res.status(400).json({ error: "لا توجد أقسام بها نص للمراجعة." });
        return;
      }
      const results = await Promise.all(
        entries.map(async ([id, txt]) => [id, await reviewOne(id, txt)])
      );
      res.json(Object.fromEntries(results));
      return;
    }

    res.status(400).json({ error: "يرجى إرسال قسم واحد (sectionId + text) أو جميع الأقسام (sections)." });
  } catch (err) {
    req.log.error(err, "section-review failed");
    res.status(500).json({ error: "فشل تحليل القسم. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
