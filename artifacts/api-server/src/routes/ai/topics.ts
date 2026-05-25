import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/topics", async (req, res) => {
  const { field, level, keywords, lang } = req.body as {
    field: string; level: "masters" | "phd"; keywords?: string; lang: "ar" | "en";
  };

  if (!field || field.trim().length < 3) {
    res.status(400).json({ error: lang === "ar" ? "يرجى إدخال التخصص." : "Please enter a field of study." });
    return;
  }
  const isAr = lang === "ar";
  const levelAr = level === "phd" ? "دكتوراه" : "ماجستير";
  const levelEn = level === "phd" ? "doctoral" : "master's";

  const system = isAr
    ? `أنت مرشد أكاديمي متخصص في مساعدة الباحثين على اختيار عناوين رسائلهم.
أعد JSON فقط بهذا الشكل:
{
  "topics": [
    {
      "title": "عنوان مقترح واضح ومحدد",
      "rationale": "سبب أهمية هذا الموضوع",
      "variables": "المتغيرات الرئيسية المقترحة",
      "method": "المنهج المقترح (وصفي/تجريبي/تحليلي)",
      "feasibility": "مدى قابلية البحث (سهل/متوسط/متقدم)",
      "novelty": "درجة الحداثة من 1 إلى 5"
    }
  ]
}
أنتج 10 موضوعات متنوعة ومحددة، تجمع بين الأصالة والقابلية للتطبيق.`
    : `You are an academic advisor specialized in helping researchers choose thesis topics.
Respond with ONLY JSON in this format:
{
  "topics": [
    {
      "title": "Clear and specific suggested title",
      "rationale": "Why this topic matters",
      "variables": "Main variables proposed",
      "method": "Suggested method (descriptive/experimental/analytical)",
      "feasibility": "Research feasibility (easy/medium/advanced)",
      "novelty": "Novelty score from 1 to 5"
    }
  ]
}
Produce 10 varied, specific topics that balance novelty and feasibility.`;

  const user = isAr
    ? `اقترح 10 عناوين بحثية لرسالة ${levelAr} في تخصص: ${field}.${keywords ? `\nاهتمامات الباحث: ${keywords}` : ""}`
    : `Suggest 10 research topics for a ${levelEn} thesis in: ${field}.${keywords ? `\nResearcher interests: ${keywords}` : ""}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 2500,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    res.json(JSON.parse(raw));
  } catch (err) {
    req.log.error(err, "AI topics failed");
    res.status(500).json({ error: lang === "ar" ? "فشل توليد المواضيع" : "Topic generation failed" });
  }
});

export default router;
