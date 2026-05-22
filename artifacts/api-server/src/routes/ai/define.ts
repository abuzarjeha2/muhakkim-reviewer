import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/define", async (req, res) => {
  const { word, lang } = req.body as { word: string; lang: "ar" | "en" };

  if (!word || word.trim().length < 2) {
    res.status(400).json({ error: "Word must be at least 2 characters." });
    return;
  }

  const isAr = lang === "ar";
  const w = word.trim().slice(0, 60);

  const systemPrompt = isAr
    ? `أنت قاموس عربي أكاديمي متخصص. عند إعطائك كلمة عربية:
- ابحث عنها في القاموس العربي الفصيح
- أعطِ تعريفها الدقيق باللغة العربية
- قدّم مترادفاتها من القاموس العربي
- أعطِ أضدادها إن وُجدت
- قدّم أمثلة استخدام أكاديمية
- بيّن فئتها النحوية

أجب بـ JSON فقط:
{
  "word": "الكلمة",
  "found": true,
  "definition": "التعريف من القاموس",
  "synonyms": ["مرادف1", "مرادف2", "مرادف3"],
  "antonyms": ["ضد1", "ضد2"],
  "examples": ["جملة مثال 1", "جملة مثال 2"],
  "partOfSpeech": "اسم|فعل|صفة|ظرف|حرف",
  "note": "ملاحظة عن الاستخدام الأكاديمي الصحيح"
}`
    : `You are an expert English academic dictionary. When given an English word:
- Look it up in standard English dictionaries (Oxford, Merriam-Webster)
- Provide its precise definition
- List its synonyms with nuance
- List antonyms where applicable
- Provide academic usage examples
- Indicate part of speech

Respond with ONLY valid JSON:
{
  "word": "the word",
  "found": true,
  "definition": "dictionary definition",
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2"],
  "examples": ["example sentence 1", "example sentence 2"],
  "partOfSpeech": "noun|verb|adjective|adverb|preposition",
  "note": "note about academic usage"
}`;

  const userPrompt = isAr
    ? `ابحث في القاموس العربي عن الكلمة: "${w}"`
    : `Look up in the English dictionary: "${w}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Dictionary lookup failed");
    res.status(500).json({ error: "Dictionary lookup failed" });
  }
});

export default router;
