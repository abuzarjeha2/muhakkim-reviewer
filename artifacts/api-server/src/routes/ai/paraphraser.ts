import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const STYLE_LABELS: Record<string, { ar: string; en: string }> = {
  academic: { ar: "أكاديمي رصين", en: "formal academic" },
  simple:   { ar: "بسيط وواضح",   en: "simple and clear" },
  formal:   { ar: "رسمي مهني",    en: "professional/formal" },
  concise:  { ar: "مختصر مكثّف",   en: "concise" },
  creative: { ar: "إبداعي متنوع",  en: "creative" },
};

router.post("/ai/paraphraser", async (req, res) => {
  const { text, style, lang, variants } = req.body as {
    text: string; style: string; lang: "ar" | "en"; variants?: number;
  };

  if (!text || text.trim().split(/\s+/).length < 5) {
    res.status(400).json({ error: lang === "ar" ? "النص قصير جداً (5 كلمات على الأقل)." : "Text too short (min 5 words)." });
    return;
  }
  const s = STYLE_LABELS[style] ?? STYLE_LABELS.academic;
  const variantsNum = Number(variants);
  const n = Math.max(1, Math.min(3, Number.isFinite(variantsNum) && variantsNum > 0 ? variantsNum : 3));
  const isAr = lang === "ar";

  const system = isAr
    ? `أنت خبير إعادة صياغة نصوص بأسلوب احترافي. ستعيد صياغة النص المقدم بأسلوب ${s.ar} مع الحفاظ التام على المعنى الأصلي.
أعد JSON فقط بهذا الشكل:
{
  "variants": [
    {
      "text": "النص المُعاد صياغته",
      "changeRatio": <نسبة التغيير من 0 إلى 1>,
      "notes": "ملاحظة قصيرة على ما تم تعديله"
    }
  ]
}
أنتج ${n} صيغ مختلفة لنفس المعنى.`
    : `You are an expert paraphrasing specialist. Rewrite the given text in a ${s.en} style while preserving the original meaning exactly.
Respond with ONLY JSON in this format:
{
  "variants": [
    {
      "text": "the paraphrased text",
      "changeRatio": <change ratio 0 to 1>,
      "notes": "short note on what was modified"
    }
  ]
}
Produce ${n} different variants of the same meaning.`;

  const user = isAr
    ? `أعد صياغة النص التالي:\n\n${text.slice(0, 4000)}`
    : `Paraphrase the following text:\n\n${text.slice(0, 4000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 2000,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    const originalWordCount = text.trim().split(/\s+/).filter(Boolean).length;
    res.json({ ...result, originalWordCount });
  } catch (err) {
    req.log.error(err, "AI paraphraser failed");
    res.status(500).json({ error: lang === "ar" ? "فشلت إعادة الصياغة" : "Paraphrasing failed" });
  }
});

export default router;
