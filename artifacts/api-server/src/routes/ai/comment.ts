import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/suggest-comment", async (req, res) => {
  const { sectionTitle, sectionBody, commentType, lang } = req.body as {
    sectionTitle: string;
    sectionBody: string;
    commentType: string;
    lang: "ar" | "en";
  };

  if (!sectionTitle || !sectionBody) {
    res.status(400).json({ error: "sectionTitle and sectionBody are required" });
    return;
  }

  const isAr = lang === "ar";

  const systemPrompt = isAr
    ? `أنت محكّم أكاديمي خبير في مراجعة رسائل الدكتوراه والماجستير.
مهمتك: تقديم تعليق أكاديمي دقيق ومفيد على الفقرة المعطاة، بحسب نوع التعليق المطلوب.
أنواع التعليقات:
- ملاحظة: تعليق بنّاء يشير إلى نقطة تستحق التوضيح أو التعمق
- سؤال: سؤال يطرح إشكالية أو يستوضح جانباً غامضاً
- تصحيح: إشارة إلى خطأ أو قصور منهجي أو علمي يحتاج تصحيحاً
- إشادة: الإشادة بنقطة قوة واضحة في الفقرة
اكتب التعليق باللغة العربية الفصحى الأكاديمية، بجملة أو جملتين مباشرتين ومركزتين.`
    : `You are an expert academic examiner reviewing PhD and Master's theses.
Your task: provide a precise and helpful academic comment on the given paragraph, according to the requested comment type.
Comment types:
- note: a constructive remark pointing to something that deserves clarification or deeper analysis
- question: a question that raises an issue or asks for clarification on an ambiguous aspect
- correction: pointing out a methodological or scientific error that needs correcting
- praise: acknowledging a clear strength in the paragraph
Write the comment in formal academic English, in one or two focused and direct sentences.`;

  const userPrompt = isAr
    ? `القسم: ${sectionTitle}
نوع التعليق المطلوب: ${commentType}
الفقرة:
${sectionBody}

اكتب تعليقاً أكاديمياً مناسباً:`
    : `Section: ${sectionTitle}
Requested comment type: ${commentType}
Paragraph:
${sectionBody}

Write an appropriate academic comment:`;

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "AI comment generation failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
