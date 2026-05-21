import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/detect", async (req, res) => {
  const { text, lang } = req.body as { text: string; lang: "ar" | "en" };

  if (!text || text.trim().length < 50) {
    res.status(400).json({ error: "Text must be at least 50 characters long." });
    return;
  }

  const isAr = lang === "ar";

  const systemPrompt = isAr
    ? `أنت نظام متخصص في كشف النصوص المكتوبة بالذكاء الاصطناعي (مثل ChatGPT وGPT-4 وClaude وغيرها).
مهمتك: تحليل النص المعطى وتحديد ما إذا كان مكتوباً بواسطة ذكاء اصطناعي أم إنسان.

قم بتحليل هذه المؤشرات:
1. الانسيابية المفرطة وغياب التعثر الطبيعي (AI غالباً ما يكتب بشكل مثالي)
2. الأنماط الهيكلية المتكررة (مقدمة → نقاط → خاتمة بشكل مُتوقع)
3. الرسمية المفرطة وانعدام الصوت الشخصي
4. تكرار تعابير معينة ("من المهم أن نلاحظ"، "بالإضافة إلى ذلك"، "في هذا السياق"، وما شابه)
5. قلة التنوع في طول الجمل (burstiness منخفض)
6. غياب الأخطاء اللغوية البسيطة أو التعابير الشعبية
7. الاستخدام المفرط للقوائم والتعداد
8. انخفاض التشعب (perplexity) - أي أن الكلمات التالية متوقعة جداً

أجب بـ JSON فقط بهذه البنية:
{
  "score": <رقم من 0 إلى 100، حيث 0 = بشري تماماً، 100 = ذكاء اصطناعي تماماً>,
  "verdict": "<AI | Human | Mixed>",
  "confidence": "<High | Medium | Low>",
  "signals": [
    { "type": "<positive|negative>", "text": "<وصف المؤشر>" }
  ],
  "summary": "<ملخص قصير من 2-3 جمل يشرح النتيجة>",
  "highlights": ["<جملة أو عبارة من النص تشير إلى كتابة AI>"]
}`
    : `You are a specialized AI-generated text detection system (detecting output from ChatGPT, GPT-4, Claude, and similar models).
Your task: Analyze the given text and determine whether it was written by an AI or a human.

Analyze these indicators:
1. Excessive fluency and absence of natural hesitation (AI tends to write perfectly)
2. Repetitive structural patterns (intro → bullet points → conclusion in a predictable way)
3. Over-formality and lack of personal voice
4. Repeated transitional phrases ("It is important to note", "Furthermore", "In this context", etc.)
5. Low burstiness (little variation in sentence length)
6. Absence of minor grammatical quirks or colloquial expressions
7. Overuse of lists and enumeration
8. Low perplexity (next words are highly predictable)

Respond with ONLY valid JSON in this structure:
{
  "score": <number from 0 to 100, where 0 = fully human, 100 = fully AI>,
  "verdict": "<AI | Human | Mixed>",
  "confidence": "<High | Medium | Low>",
  "signals": [
    { "type": "<positive|negative>", "text": "<description of the indicator>" }
  ],
  "summary": "<short 2-3 sentence summary explaining the result>",
  "highlights": ["<sentence or phrase from the text that suggests AI writing>"]
}`;

  const userPrompt = isAr
    ? `حلّل النص التالي:\n\n${text.slice(0, 4000)}`
    : `Analyze the following text:\n\n${text.slice(0, 4000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 800,
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
    req.log.error(err, "AI detection failed");
    res.status(500).json({ error: "AI detection failed" });
  }
});

export default router;
