import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/smart-review", async (req, res) => {
  const { text, role, sections } = req.body as {
    text: string;
    role: string;
    sections: string[];
  };

  if (!text || text.trim().length < 100) {
    res.status(400).json({ error: "النص قصير جداً. يرجى رفع ملف يحتوي على نصوص كافية." });
    return;
  }
  if (!sections || sections.length === 0) {
    res.status(400).json({ error: "يرجى اختيار محور واحد على الأقل للمراجعة." });
    return;
  }

  const systemPrompt = `أنت بروفيسور ومحكم أكاديمي خبير ومتمرس في نقد ومراجعة الرسائل العلمية (ماجستير ودكتوراه).
مهمتك تقديم نقد أكاديمي صارم وبناء باللغة العربية، ورصد الأخطاء والفجوات المنهجية بدقة عالية.
أسلوبك: دقيق، مباشر، محدد بالأدلة من النص، مع اقتراح حلول عملية قابلة للتطبيق.`;

  const userPrompt = `بصفتك خبيراً أكاديمياً، قم بمراجعة وتدقيق النص المستخرج من الرسالة العلمية أدناه.

دور الطالب/المستخدم الذي يطلب التقرير: ${role}

المحاور المطلوب التركيز عليها ونقدها:
${sections.map(s => `- ${s}`).join('\n')}

يرجى صياغة التقرير الأكاديمي الشامل بالتنسيق التالي (استخدم عناوين واضحة):

## أولاً: التقييم العام
تقييم رصين وشامل لجودة الرسالة، مستواها المنهجي، واتساقها المنطقي.

## ثانياً: الملاحظات التفصيلية حسب المحاور
لكل محور مختار، قدّم:
- الفجوة أو الخطأ المرصود (مع الإشارة إلى مكانه في النص)
- الحل الأكاديمي المقترح لتعديله

## ثالثاً: تقييم المنهجية والتحليل الإحصائي
(إن وجد في النص)

## رابعاً: التوصيات والتوجيهات النهائية
توجيهات محددة وقابلة للتطبيق لرفع جودة البحث.

---
نص الرسالة:
${text.slice(0, 60000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 3000,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
    });

    const report = completion.choices[0]?.message?.content ?? "";
    res.json({ report });
  } catch (err) {
    req.log.error(err, "smart-review failed");
    res.status(500).json({ error: "فشل توليد التقرير. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
