import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/slides-outline", async (req, res) => {
  const { topic, audience, slidesCount, lang } = req.body as {
    topic: string;
    audience?: string;
    slidesCount?: number;
    lang?: "ar" | "en";
  };
  const isAr = lang !== "en";

  if (!topic || topic.trim().length < 5) {
    res.status(400).json({
      error: isAr ? "يرجى إدخال موضوع (5 أحرف على الأقل)." : "Please enter a topic (min 5 chars).",
    });
    return;
  }

  const count = Math.max(5, Math.min(20, Number(slidesCount) || 10));
  const audienceText = (audience || "").trim() || (isAr ? "جمهور أكاديمي عام" : "general academic audience");

  const system = isAr
    ? `أنت مصمم عروض تقديمية أكاديمي خبير. تُنتج هيكل عرض احترافي يجمع بين الإيجاز والعمق.
أعد JSON فقط بدون أي نص خارجه بهذا الشكل:
{
  "title": "عنوان العرض الرئيسي",
  "subtitle": "عنوان فرعي قصير",
  "slides": [
    {
      "title": "عنوان الشريحة",
      "bullets": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "speakerNotes": "ملاحظات المُحاضر لهذه الشريحة (2-3 أسطر)"
    }
  ]
}

قواعد:
- استخدم العربية الفصحى الرصينة.
- اجعل عنوان كل شريحة قصيراً وقوياً (3-7 كلمات).
- 3-5 نقاط (bullets) لكل شريحة، كل نقطة جملة موجزة (≤14 كلمة).
- ابدأ بشريحة مقدمة/أهداف، وانتهِ بشريحة خاتمة/مراجع.
- speakerNotes توضح ما يقوله المُحاضر شفهياً لتعميق النقاط.`
    : `You are an expert academic slide designer. Produce a professional deck structure that is both concise and substantive.
Reply with JSON only, no prose:
{
  "title": "Main deck title",
  "subtitle": "Short subtitle",
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "speakerNotes": "Speaker notes (2-3 lines)"
    }
  ]
}

Rules:
- Use precise, formal English.
- Slide titles: short and punchy (3-7 words).
- 3-5 bullets per slide, each ≤14 words.
- Start with intro/objectives, end with conclusion/references.
- speakerNotes expand on bullets for the presenter.`;

  const user = isAr
    ? `أنشئ هيكل عرض تقديمي من ${count} شرائح حول:

الموضوع: ${topic}
الجمهور: ${audienceText}`
    : `Create a ${count}-slide deck outline on:

Topic: ${topic}
Audience: ${audienceText}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 3500,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      title?: string;
      subtitle?: string;
      slides?: Array<{ title?: string; bullets?: string[]; speakerNotes?: string }>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({
        error: isAr ? "تعذّر تحليل استجابة الذكاء الاصطناعي." : "Failed to parse AI response.",
      });
      return;
    }

    const slides = (parsed.slides ?? [])
      .map(s => ({
        title: typeof s?.title === "string" ? s.title.trim() : "",
        bullets: Array.isArray(s?.bullets) ? s.bullets.filter(b => typeof b === "string" && b.trim()).map(b => b.trim()) : [],
        speakerNotes: typeof s?.speakerNotes === "string" ? s.speakerNotes.trim() : "",
      }))
      .filter(s => s.title.length > 0);

    if (slides.length === 0) {
      res.status(502).json({
        error: isAr ? "لم يُولِّد الذكاء الاصطناعي شرائح صالحة." : "AI returned no valid slides.",
      });
      return;
    }

    res.json({
      title: typeof parsed.title === "string" ? parsed.title : topic,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : "",
      slides,
    });
  } catch (err) {
    req.log.error(err, "slides-outline failed");
    res.status(500).json({
      error: isAr ? "فشل توليد هيكل العرض." : "Failed to generate slide outline.",
    });
  }
});

export default router;
