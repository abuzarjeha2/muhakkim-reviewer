import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// Hard cap to stay safely within GPT-4.1's 1M context window.
// ~250k characters ≈ ~80k tokens for Arabic / mixed content — leaves room for output.
const MAX_CHARS = 250_000;

router.post("/ai/full-review", async (req, res) => {
  const { text, title, lang } = req.body as {
    text?: string;
    title?: string;
    lang?: "ar" | "en";
  };
  const isAr = lang !== "en";

  const raw = (text || "").trim();
  if (raw.length < 200) {
    res.status(400).json({
      error: isAr ? "النص قصير جداً (الحد الأدنى 200 حرف)." : "Text too short (min 200 chars).",
    });
    return;
  }

  const truncated = raw.length > MAX_CHARS;
  const body = truncated ? raw.slice(0, MAX_CHARS) : raw;
  const titleLine = title?.trim() ? (isAr ? `عنوان الملف: ${title.trim()}\n\n` : `File title: ${title.trim()}\n\n`) : "";

  const system = isAr
    ? `أنت بروفيسور تحكيم أكاديمي خبير. ستتسلم رسالة علمية كاملة دفعة واحدة (بدون تجزئة) ويُطلب منك مراجعتها مراجعةً شاملة وعميقة.

أعد التقرير بصياغة العربية الفصحى الرصينة، منظَّماً تحت العناوين التالية بهذا الترتيب وبدون أي عنوان آخر:

## 1) التقييم العام
ملخص عام في 3-5 جمل عن جودة العمل ومدى أصالته وعمقه.

## 2) درجة الجودة /10
أعطِ درجة من 10 مع تبرير سطري.

## 3) نقاط القوة
3-6 نقاط ملموسة.

## 4) نقاط الضعف والمآخذ
6-12 نقطة جوهرية مع توضيح مكان الإشكال في الرسالة قدر الإمكان.

## 5) ملاحظات حسب الأقسام
استعرض كل قسم وُجد في الرسالة (العنوان، المستخلص، المقدمة، الإطار النظري، الأهداف، الفرضيات، المنهجية، تحليل البيانات، النتائج، المناقشة، التوصيات، المراجع) بنقاط محدّدة لكل قسم. تجاهل الأقسام غير الموجودة.

## 6) قائمة التعديلات المطلوبة (مرتبة بالأولوية)
قائمة عملية مرقّمة قابلة للتنفيذ مباشرة من الباحث.

## 7) الخلاصة والقرار التحكيمي
قرار: (قبول · قبول مع تعديلات طفيفة · قبول مع تعديلات جوهرية · إعادة بعد تعديل · رفض) مع جملتين تبريراً.

تنبيهات:
- لا تخترع محتوى غير موجود.
- استخدم Markdown بسيط (## للعناوين، - للنقاط).
- إذا كان الملف ناقصاً أو غير واضح، اذكر ذلك صراحة في "التقييم العام".`
    : `You are an expert academic peer reviewer. You will receive an entire thesis/paper in a single shot (no chunking) and must produce a comprehensive deep review.

Respond in clear formal English under the following headings in this order, with no other headings:

## 1) Overall Assessment
3-5 sentence summary of quality, originality, and depth.

## 2) Quality Score /10
Score out of 10 with one-line justification.

## 3) Strengths
3-6 concrete points.

## 4) Weaknesses & Issues
6-12 substantive points; cite where in the document when possible.

## 5) Section-by-Section Notes
Walk through every section present (Title, Abstract, Introduction, Literature, Objectives, Hypotheses, Methodology, Analysis, Results, Discussion, Recommendations, References) with specific bullets. Skip absent sections.

## 6) Required Revisions (Prioritized)
Numbered, actionable list the author can execute directly.

## 7) Final Decision
Decision: (Accept · Accept w/ Minor Revisions · Major Revisions · Reject & Resubmit · Reject) with 2-sentence justification.

Rules:
- Do not fabricate content.
- Use simple Markdown (## for headings, - for bullets).
- If the file is incomplete or unclear, state so explicitly in the Overall Assessment.`;

  const userPrompt = isAr
    ? `${titleLine}راجِع الرسالة العلمية الكاملة التالية مراجعة شاملة عميقة، والتزم بالقالب المحدد بدقة:

<<<BEGIN_THESIS>>>
${body}
<<<END_THESIS>>>${truncated ? "\n\n[ملاحظة: الملف طويل جداً وقد اقتُصر التحليل على أول 250,000 حرف منه.]" : ""}`
    : `${titleLine}Perform a deep comprehensive review of the following full document, strictly following the template above:

<<<BEGIN_THESIS>>>
${body}
<<<END_THESIS>>>${truncated ? "\n\n[Note: Document was very long; analysis is based on the first 250,000 characters.]" : ""}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 6000,
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      res.status(502).json({
        error: isAr ? "تعذّر توليد المراجعة." : "Failed to generate review.",
      });
      return;
    }
    res.json({
      content,
      truncated,
      charsAnalyzed: body.length,
      charsTotal: raw.length,
    });
  } catch (err) {
    req.log.error(err, "full-review failed");
    res.status(500).json({
      error: isAr ? "فشلت المراجعة الكاملة. يرجى المحاولة مرة أخرى." : "Full review failed. Please try again.",
    });
  }
});

export default router;
