import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const ROLE_META: Record<string, { ar: string; en: string; dutyPromptAr: string; dutyPromptEn: string }> = {
  supervisor: {
    ar: "المشرف الأكاديمي",
    en: "Academic Supervisor",
    dutyPromptAr: `أنت تحلل الرسالة من منظور المشرف الأكاديمي الذي يتابع الطالب طوال مسيرة البحث.
مهام المشرف تشمل: توجيه الإطار المنهجي، مراجعة الأهداف البحثية وانسجامها مع النتائج، مراجعة الأدب العلمي، ضمان سلامة التصميم البحثي، تقييم جودة الكتابة الأكاديمية، والتأكد من الأصالة العلمية.`,
    dutyPromptEn: `You are analysing the thesis from the perspective of the Academic Supervisor who guided the student throughout the research journey.
Supervisor duties include: guiding the methodological framework, reviewing research objectives alignment with findings, reviewing literature, ensuring research design integrity, evaluating academic writing quality, and verifying scientific originality.`,
  },
  internal: {
    ar: "المناقش الداخلي",
    en: "Internal Examiner",
    dutyPromptAr: `أنت تحلل الرسالة من منظور المناقش الداخلي (من نفس المؤسسة).
مهامه تشمل: التحقق من اتساق المنهجية الداخلي، فحص الصلاحية الإحصائية، مراجعة عمق التحليل، تقييم مدى تطبيق النتائج على البيئة المحلية، والتأكد من توافق الرسالة مع معايير المؤسسة.`,
    dutyPromptEn: `You are analysing the thesis from the perspective of the Internal Examiner (from the same institution).
Duties include: verifying internal methodological consistency, checking statistical validity, reviewing depth of analysis, evaluating applicability of findings to the local context, and ensuring the thesis meets institutional standards.`,
  },
  external: {
    ar: "المناقش الخارجي",
    en: "External Examiner",
    dutyPromptAr: `أنت تحلل الرسالة من منظور المناقش الخارجي (من مؤسسة أخرى).
مهامه تشمل: تقييم الإسهام العلمي الأصيل في الحقل المعرفي، مقارنة الرسالة بالمعايير الدولية، تقييم إمكانية النشر، فحص استعراض الأدبيات من منظور شامل، وتقديم رأي مستقل حيادي.`,
    dutyPromptEn: `You are analysing the thesis from the perspective of the External Examiner (from a different institution).
Duties include: evaluating original scientific contribution to the field, comparing the thesis with international standards, assessing publication potential, reviewing the literature from a broad perspective, and providing an independent neutral opinion.`,
  },
  researcher: {
    ar: "الباحث / الطالب",
    en: "Researcher / Student",
    dutyPromptAr: `أنت تحلل الرسالة من منظور الباحث/الطالب الذي كتبها ويعدّها للمناقشة.
ركّز على: نقاط القوة التي يجب تبرزيها، الثغرات التي يجب تحضير إجابات لها، الأسئلة المحتملة من اللجنة، متانة الحجج والأدلة، وكيفية تقديم المساهمة العلمية بوضوح.`,
    dutyPromptEn: `You are analysing the thesis from the perspective of the Researcher/Student who wrote it and is preparing for the defence.
Focus on: strengths to highlight, gaps that need prepared answers, anticipated committee questions, robustness of arguments and evidence, and how to clearly present the scientific contribution.`,
  },
};

router.post("/api/thesis/roles-analyze", async (req, res) => {
  const { text, role, lang } = req.body as {
    text: string;
    role: "supervisor" | "internal" | "external" | "researcher";
    lang: "ar" | "en";
  };

  if (!text || text.trim().length < 100) {
    res.status(400).json({ error: "Text must be at least 100 characters." });
    return;
  }
  if (!role || !ROLE_META[role]) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const isAr   = lang === "ar";
  const meta   = ROLE_META[role];
  const chunk  = text.slice(0, 7000);

  const systemPrompt = isAr
    ? `${meta.dutyPromptAr}

تحليلك يجب أن يكون دقيقاً ومبنياً على النص المُدخل. أجب بـ JSON فقط بالتنسيق التالي:

{
  "roleTitle": "${meta.ar}",
  "duties": ["مهمة 1", "مهمة 2", "..."],
  "score": <0-100>,
  "overallRating": "excellent|good|needs_minor_revision|needs_major_revision",
  "summary": "تقييم عام شامل في فقرة",
  "sections": [
    {
      "nameAr": "اسم القسم",
      "nameEn": "Section Name",
      "icon": "رمز emoji مناسب",
      "observations": [
        {
          "title": "عنوان الملاحظة",
          "description": "وصف تفصيلي للملاحظة مستند إلى النص",
          "severity": "critical|major|minor|positive",
          "excerpt": "مقتبس من النص يدعم هذه الملاحظة (إن وُجد)",
          "solution": "الحل المقترح بشكل واضح وعملي",
          "practicalApplication": "كيفية التطبيق الفعلي على الملف المرفق خطوة بخطوة"
        }
      ]
    }
  ],
  "strongPoints": ["نقطة قوة 1", "نقطة قوة 2"],
  "priorityActions": ["إجراء عاجل 1", "إجراء عاجل 2"]
}`
    : `${meta.dutyPromptEn}

Your analysis must be precise and grounded in the provided text. Respond with ONLY valid JSON:

{
  "roleTitle": "${meta.en}",
  "duties": ["duty 1", "duty 2", "..."],
  "score": <0-100>,
  "overallRating": "excellent|good|needs_minor_revision|needs_major_revision",
  "summary": "A comprehensive overall assessment paragraph",
  "sections": [
    {
      "nameAr": "اسم القسم بالعربية",
      "nameEn": "Section Name",
      "icon": "appropriate emoji",
      "observations": [
        {
          "title": "Observation title",
          "description": "Detailed description grounded in the text",
          "severity": "critical|major|minor|positive",
          "excerpt": "Direct quote from text supporting this observation (if available)",
          "solution": "Clear, practical proposed solution",
          "practicalApplication": "Step-by-step instructions for applying this to the uploaded file"
        }
      ]
    }
  ],
  "strongPoints": ["strength 1", "strength 2"],
  "priorityActions": ["urgent action 1", "urgent action 2"]
}`;

  const userPrompt = isAr
    ? `حلّل الرسالة/الملف التالي من منظور ${meta.ar}:\n\n${chunk}`
    : `Analyse the following thesis/document from the ${meta.en} perspective:\n\n${chunk}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 3000,
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
