import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/proofread-text", async (req, res) => {
  const { text, lang } = req.body as { text: string; lang: "ar" | "en" };

  if (!text || text.trim().length < 20) {
    res.status(400).json({ error: "Text must be at least 20 characters." });
    return;
  }

  const isAr = lang === "ar";
  const chunk = text.slice(0, 5000);

  const systemPrompt = isAr
    ? `أنت محرر لغوي أكاديمي متخصص في اللغة العربية الفصحى. مهمتك: تدقيق النص المعطى وكشف المشاكل اللغوية الحقيقية مع التحقق من القاموس العربي.

تحقق من:
1. الأخطاء الإملائية (تهجئة خاطئة، همزات غلط)
2. الأخطاء النحوية (التطابق في الجنس والعدد والحالة الإعرابية)
3. الأخطاء الأسلوبية (جمل مبهمة، تكرار زائد، مبني للمجهول)
4. المصطلحات غير الموجودة في القاموس أو الكلمات الدخيلة غير الضرورية
5. علامات الترقيم الخاطئة

أجب بـ JSON فقط:
{
  "issues": [
    {
      "type": "spelling|grammar|style|vocabulary|punctuation",
      "severity": "error|warning|info",
      "original": "النص المشكوك فيه",
      "suggestion": "الاقتراح الأفضل",
      "explanation": "شرح مختصر للمشكلة",
      "dictVerified": true
    }
  ],
  "score": <0-100>,
  "summary": "ملخص قصير لجودة النص من ناحية لغوية (جملة واحدة)"
}`
    : `You are an expert academic language editor specializing in formal English. Your task: proofread the given text and detect genuine language issues, verifying against standard English dictionaries.

Check for:
1. Spelling errors (misspellings, typos)
2. Grammar errors (subject-verb agreement, tense consistency, article usage)
3. Style issues (unclear sentences, excessive repetition, passive overuse)
4. Vocabulary issues (wrong word choice, non-standard usage, informal language)
5. Punctuation errors

Respond with ONLY valid JSON:
{
  "issues": [
    {
      "type": "spelling|grammar|style|vocabulary|punctuation",
      "severity": "error|warning|info",
      "original": "the problematic text",
      "suggestion": "the better version",
      "explanation": "brief explanation of the problem",
      "dictVerified": true
    }
  ],
  "score": <0-100>,
  "summary": "One sentence summarizing text quality from a language perspective"
}`;

  const userPrompt = isAr
    ? `دقّق النص التالي لغوياً:\n\n${chunk}`
    : `Proofread the following text:\n\n${chunk}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1500,
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
    req.log.error(err, "AI proofread failed");
    res.status(500).json({ error: "AI proofreading failed" });
  }
});

export default router;
