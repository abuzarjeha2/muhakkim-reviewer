import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/summarize", async (req, res) => {
  const { text, lang } = req.body as { text: string; lang: "ar" | "en" };

  if (!text || text.trim().split(/\s+/).length < 30) {
    res.status(400).json({ error: "Text must be at least 30 words." });
    return;
  }

  const isAr = lang === "ar";
  const chunk = text.slice(0, 6000);
  const originalWordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const systemPrompt = isAr
    ? `أنت ملخّص أكاديمي متخصص. مهمتك: تلخيص النص البحثي المعطى بثلاث صيغ مختلفة باللغة العربية الفصحى.

أجب بـ JSON فقط:
{
  "short": "تلخيص قصير في جملتين أو ثلاث يلتقط الفكرة الرئيسية",
  "bullets": [
    "النقطة الرئيسية الأولى",
    "النقطة الرئيسية الثانية",
    "النقطة الرئيسية الثالثة",
    "النقطة الرئيسية الرابعة",
    "النقطة الرئيسية الخامسة"
  ],
  "academic": "ملخص أكاديمي رسمي بأسلوب المستخلص العلمي (٨٠-١٢٠ كلمة) يشمل: الهدف، المنهج، النتائج، والتوصيات",
  "summaryWordCount": <عدد كلمات الملخص الأكاديمي تقريباً>
}`
    : `You are a specialized academic summarizer. Your task: summarize the given research text in three different formats in formal English.

Respond with ONLY valid JSON:
{
  "short": "2-3 sentence summary capturing the main idea",
  "bullets": [
    "First key point",
    "Second key point",
    "Third key point",
    "Fourth key point",
    "Fifth key point"
  ],
  "academic": "Formal academic abstract-style summary (80-120 words) including: objective, methodology, findings, and recommendations",
  "summaryWordCount": <approximate word count of the academic summary>
}`;

  const userPrompt = isAr
    ? `لخّص النص البحثي التالي:\n\n${chunk}`
    : `Summarize the following research text:\n\n${chunk}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    res.json({ ...result, originalWordCount });
  } catch (err) {
    req.log.error(err, "AI summarize failed");
    res.status(500).json({ error: "AI summarization failed" });
  }
});

export default router;
