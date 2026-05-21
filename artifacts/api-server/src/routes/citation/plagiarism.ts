import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/citation/plagiarism", async (req, res) => {
  const { text, lang } = req.body as { text: string; lang: "ar" | "en" };

  if (!text || text.trim().length < 100) {
    res.status(400).json({ error: "Text must be at least 100 characters." });
    return;
  }

  const isAr = lang === "ar";

  const systemPrompt = isAr
    ? `أنت خبير في كشف الانتحال الأكاديمي وتقييم سلامة الاقتباسات العلمية.

مهمتك: تحليل النص الأكاديمي للكشف عن:
1. **الانتحال الصريح**: فقرات تبدو منقولة حرفياً دون إسناد
2. **الانتحال بالصياغة**: إعادة صياغة أفكار الآخرين دون إحالة
3. **غياب الإسناد**: ادعاءات وإحصاءات وحقائق موثّقة بدون مرجع
4. **التضخيم الاقتباسي**: الاعتماد المفرط على الاقتباسات مع غياب التحليل الذاتي
5. **الاستشهاد الذاتي المفرط**: الإفراط في الاستشهاد بأعمال المؤلف نفسه
6. **مؤشرات جودة الإسناد**: هل الاقتباسات الموجودة صحيحة الشكل؟

أجب بـ JSON فقط بهذه البنية:
{
  "riskScore": <رقم من 0 إلى 100 حيث 0 = لا خطر والـ 100 = خطر عالٍ جداً>,
  "riskLevel": "<Low | Medium | High | Critical>",
  "summary": "<ملخص شامل من 3-4 جمل لنتائج الفحص>",
  "issues": [
    {
      "type": "<plagiarism | missing_citation | paraphrase | self_citation | quality>",
      "severity": "<low | medium | high>",
      "excerpt": "<المقطع المشكوك فيه من النص (أول 120 حرف)>",
      "explanation": "<شرح المشكلة والسبب>",
      "suggestion": "<الاقتراح للمعالجة>"
    }
  ],
  "strengths": ["<جوانب إيجابية في توثيق النص>"],
  "recommendations": ["<توصية شاملة للتحسين>"]
}`
    : `You are an expert in academic plagiarism detection and citation integrity assessment.

Your task: Analyze the academic text to detect:
1. **Direct plagiarism**: Passages that appear copied verbatim without attribution
2. **Paraphrase plagiarism**: Rephrasing others' ideas without citation
3. **Missing attribution**: Claims, statistics, and documented facts without references
4. **Citation padding**: Over-reliance on quotations with absence of original analysis
5. **Excessive self-citation**: Over-referencing the author's own previous work
6. **Citation quality**: Are existing citations correctly formatted?

Respond with ONLY valid JSON in this structure:
{
  "riskScore": <number from 0 to 100 where 0 = no risk and 100 = very high risk>,
  "riskLevel": "<Low | Medium | High | Critical>",
  "summary": "<comprehensive 3-4 sentence summary of findings>",
  "issues": [
    {
      "type": "<plagiarism | missing_citation | paraphrase | self_citation | quality>",
      "severity": "<low | medium | high>",
      "excerpt": "<the suspicious excerpt from the text (first 120 chars)>",
      "explanation": "<explanation of the problem and why>",
      "suggestion": "<suggested fix>"
    }
  ],
  "strengths": ["<positive aspects of the text's documentation>"],
  "recommendations": ["<overall recommendation for improvement>"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: isAr ? `حلّل النص التالي:\n\n${text.slice(0, 5000)}` : `Analyze the following text:\n\n${text.slice(0, 5000)}` },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    res.json(JSON.parse(raw));
  } catch (err) {
    req.log.error(err, "Plagiarism check failed");
    res.status(500).json({ error: "Plagiarism check failed" });
  }
});

export default router;
