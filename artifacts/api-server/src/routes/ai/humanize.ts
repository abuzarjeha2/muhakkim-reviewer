import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/humanize", async (req, res) => {
  const { text, lang } = req.body as { text: string; lang: "ar" | "en" };

  if (!text || text.trim().length < 50) {
    res.status(400).json({ error: "Text must be at least 50 characters long." });
    return;
  }

  const isAr = lang === "ar";
  const slice = text.slice(0, 4000);

  const systemPrompt = isAr
    ? `أنت خبير متخصص في إعادة صياغة النصوص المكتوبة بالذكاء الاصطناعي وتحويلها إلى نصوص تبدو بشرية وطبيعية تماماً.
مهمتك: أعِد كتابة النص المعطى بثلاثة أساليب مختلفة لتبدو كأنها كتبها إنسان حقيقي.

القواعد الأساسية لكل أسلوب:
- تجنّب الانسيابية المفرطة وأضِف تعثرات طبيعية
- غيّر طول الجمل (قصيرة وطويلة بشكل غير منتظم)
- استخدم تعابير شخصية وصوتاً فردياً واضحاً
- تجنّب العبارات الانتقالية الآلية مثل "من المهم أن نلاحظ"
- حافظ على المعنى الأصلي والمحتوى العلمي بشكل كامل
- استخدم تنوعاً في المفردات دون تكلف
- أضِف بعض التعابير الطبيعية المناسبة

أجب بـ JSON فقط بهذه البنية الدقيقة:
{
  "variants": [
    {
      "style": "academic",
      "titleAr": "أكاديمي رسمي",
      "titleEn": "Academic & Formal",
      "descAr": "لغة علمية رصينة مع طابع بشري واضح — مناسب للأبحاث والرسائل",
      "descEn": "Scholarly tone with clear human character — ideal for papers & theses",
      "icon": "🎓",
      "text": "<النص المعاد كتابته بأسلوب أكاديمي بشري>"
    },
    {
      "style": "natural",
      "titleAr": "طبيعي سلس",
      "titleEn": "Natural & Flowing",
      "descAr": "كتابة طبيعية تلقائية كما يكتبها إنسان متعلم في الحياة اليومية",
      "descEn": "Spontaneous and natural writing as an educated person would write",
      "icon": "✍️",
      "text": "<النص المعاد كتابته بأسلوب طبيعي بشري>"
    },
    {
      "style": "simplified",
      "titleAr": "مبسط مباشر",
      "titleEn": "Clear & Direct",
      "descAr": "لغة مباشرة وجمل قصيرة واضحة — سهل الفهم وغير متكلف",
      "descEn": "Direct language with short clear sentences — easy to read",
      "icon": "💬",
      "text": "<النص المعاد كتابته بأسلوب مبسط بشري>"
    }
  ]
}`
    : `You are an expert in rewriting AI-generated text to make it sound completely human and natural.
Your task: Rewrite the given text in three different human styles that bypass AI detection tools.

Core rules for each style:
- Avoid excessive fluency — add natural imperfections and varied sentence rhythm
- Mix sentence lengths (short and long in an irregular pattern)  
- Include a distinct personal voice and individual perspective
- Eliminate robotic transition phrases like "It is important to note that"
- Preserve the original meaning and academic content fully
- Use varied vocabulary without sounding forced
- Add natural, appropriate expressions

Respond with ONLY valid JSON in this exact structure:
{
  "variants": [
    {
      "style": "academic",
      "titleAr": "أكاديمي رسمي",
      "titleEn": "Academic & Formal",
      "descAr": "لغة علمية رصينة مع طابع بشري واضح — مناسب للأبحاث والرسائل",
      "descEn": "Scholarly tone with clear human character — ideal for papers & theses",
      "icon": "🎓",
      "text": "<rewritten text in human academic style>"
    },
    {
      "style": "natural",
      "titleAr": "طبيعي سلس",
      "titleEn": "Natural & Flowing",
      "descAr": "كتابة طبيعية تلقائية كما يكتبها إنسان متعلم في الحياة اليومية",
      "descEn": "Spontaneous and natural writing as an educated person would write",
      "icon": "✍️",
      "text": "<rewritten text in natural human style>"
    },
    {
      "style": "simplified",
      "titleAr": "مبسط مباشر",
      "titleEn": "Clear & Direct",
      "descAr": "لغة مباشرة وجمل قصيرة واضحة — سهل الفهم وغير متكلف",
      "descEn": "Direct language with short clear sentences — easy to read",
      "icon": "💬",
      "text": "<rewritten text in simplified human style>"
    }
  ]
}`;

  const userPrompt = isAr
    ? `أعِد كتابة النص التالي بالأساليب الثلاثة:\n\n${slice}`
    : `Rewrite the following text in all three styles:\n\n${slice}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    req.log.error(err, "AI humanize failed");
    res.status(500).json({ error: "AI humanization failed" });
  }
});

export default router;
