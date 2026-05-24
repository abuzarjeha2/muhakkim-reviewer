import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const ROLE_META: Record<string, { ar: string; en: string }> = {
  researcher: { ar: "الباحث",           en: "Researcher" },
  internal:   { ar: "المناقش الداخلي",  en: "Internal Examiner" },
  external:   { ar: "المناقش الخارجي",  en: "External Examiner" },
};

router.post("/api/thesis/roles-analyze", async (req, res) => {
  const { text, role, lang, degree, title } = req.body as {
    text: string;
    role: "researcher" | "internal" | "external";
    lang: "ar" | "en";
    degree: "doctorate" | "master";
    title?: string;
  };

  if (!text || text.trim().length < 30) {
    res.status(400).json({ error: "Text must be at least 30 characters." });
    return;
  }
  if (!role || !ROLE_META[role]) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const meta      = ROLE_META[role];
  const degreeAr  = degree === "doctorate" ? "الدكتوراه" : "الماجستير";
  const chunk     = text.slice(0, 6000);

  const systemPrompt = `أنت ${meta.ar} أكاديمي متخصص في تحكيم رسائل ${degreeAr}.
عنوان الرسالة: ${title ?? "غير محدد"}
درجة: ${degreeAr}

أجب فقط بـ JSON صحيح بالشكل التالي (لا تضف أي نص خارجه):
{
  "overallScore": <0-100>,
  "scores": {
    "structure": <0-100>,
    "methodology": <0-100>,
    "content": <0-100>,
    "language": <0-100>,
    "references": <0-100>
  },
  "summary": "<3-4 جمل تقييمية>",
  "observations": [
    {
      "severity": "critical|major|minor",
      "page": "<رقم الصفحة أو null>",
      "section": "<اسم الفصل أو القسم>",
      "observation": "<الملاحظة الرئيسية>",
      "explanation": "<تفسير تفصيلي مبني على النص>",
      "solution": "<الحل العملي المقترح>",
      "example": "<مثال تطبيقي أو صياغة مقترحة>"
    }
  ],
  "strongPoints": ["<نقطة قوة 1>", "<نقطة قوة 2>"],
  "recommendation": "<التوصية النهائية بجملة أو جملتين>"
}
قدّم 4-6 ملاحظات متنوعة مع حلول عملية مبنية على محتوى النص.`;

  const userPrompt = `قيّم هذه الرسالة من منظور ${meta.ar}:\n\n${chunk}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 2500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw    = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Thesis role analysis failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
