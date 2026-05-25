import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const TYPE_PROMPTS: Record<string, { ar: string; en: string }> = {
  intro:        { ar: "مقدمة بحثية أكاديمية", en: "academic research introduction" },
  litreview:    { ar: "مراجعة أدبيات (إطار نظري)", en: "literature review" },
  methodology:  { ar: "وصف منهجية البحث", en: "research methodology description" },
  results:      { ar: "عرض نتائج الدراسة", en: "study results presentation" },
  discussion:   { ar: "مناقشة وتفسير النتائج", en: "discussion and interpretation of results" },
  conclusion:   { ar: "خاتمة بحثية", en: "research conclusion" },
  abstract:     { ar: "مستخلص بحثي علمي", en: "scientific research abstract" },
  paragraph:    { ar: "فقرة أكاديمية عامة", en: "general academic paragraph" },
};

const TONE_LABELS: Record<string, { ar: string; en: string }> = {
  academic: { ar: "أكاديمية رصينة", en: "formal academic" },
  concise:  { ar: "موجزة ومختصرة", en: "concise" },
  detailed: { ar: "تفصيلية ومعمّقة", en: "detailed and in-depth" },
};

router.post("/ai/writer", async (req, res) => {
  const { topic, type, tone, words, lang } = req.body as {
    topic: string; type: string; tone: string; words: number; lang: "ar" | "en";
  };

  if (!topic || topic.trim().length < 5) {
    res.status(400).json({ error: lang === "ar" ? "يرجى إدخال الموضوع (5 أحرف على الأقل)." : "Please enter a topic (min 5 chars)." });
    return;
  }
  const t = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.paragraph;
  const tn = TONE_LABELS[tone] ?? TONE_LABELS.academic;
  const wordsNum = Number(words);
  const targetWords = Math.max(80, Math.min(800, Number.isFinite(wordsNum) && wordsNum > 0 ? wordsNum : 250));
  const isAr = lang === "ar";

  const system = isAr
    ? `أنت كاتب أكاديمي محترف. اكتب فقرات بحثية باللغة العربية الفصحى، بأسلوب علمي رصين، مع تدفق منطقي، واستخدام مصطلحات تخصصية دقيقة. لا تستخدم عبارات افتتاحية مثل "إليك..." بل ابدأ مباشرة بالنص.`
    : `You are a professional academic writer. Write research-grade content in formal English with logical flow and precise terminology. Do not include preambles like "Here is..." — start directly with the content.`;

  const user = isAr
    ? `اكتب ${t.ar} حول الموضوع التالي بأسلوب ${tn.ar}، بطول حوالي ${targetWords} كلمة.

الموضوع: ${topic}

أنتج النص مباشرة دون عناوين فرعية ودون مقدمات.`
    : `Write a ${t.en} on the following topic in a ${tn.en} style, approximately ${targetWords} words long.

Topic: ${topic}

Produce the text directly without subheadings or preambles.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: Math.min(2000, targetWords * 4),
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    res.json({ content, wordCount });
  } catch (err) {
    req.log.error(err, "AI writer failed");
    res.status(500).json({ error: lang === "ar" ? "فشل توليد النص" : "Text generation failed" });
  }
});

export default router;
