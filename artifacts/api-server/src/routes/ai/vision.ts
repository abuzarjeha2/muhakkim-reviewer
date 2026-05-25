import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ai/vision", async (req, res) => {
  const { imageBase64, mimeType, mode, prompt, lang } = req.body as {
    imageBase64: string;
    mimeType?: string;
    mode?: "describe" | "ocr" | "analyze" | "translate" | "custom";
    prompt?: string;
    lang?: "ar" | "en";
  };
  const isAr = lang !== "en";

  if (!imageBase64 || imageBase64.length < 50) {
    res.status(400).json({
      error: isAr ? "لم يتم رفع صورة صالحة." : "No valid image uploaded.",
    });
    return;
  }
  // Hard cap ~10 MB base64 ≈ 7.5 MB binary
  if (imageBase64.length > 10 * 1024 * 1024) {
    res.status(413).json({
      error: isAr ? "حجم الصورة كبير جداً (الحد الأقصى 7 ميجابايت)." : "Image too large (max 7 MB).",
    });
    return;
  }

  const mt = (mimeType && /^image\//.test(mimeType)) ? mimeType : "image/png";
  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:${mt};base64,${imageBase64}`;

  const promptByMode: Record<string, { ar: string; en: string }> = {
    describe: {
      ar: "صف هذه الصورة وصفاً أكاديمياً دقيقاً ومنظماً: ما الذي تُظهره، السياق المرئي، العناصر البارزة، الألوان، والمعنى المحتمل. استخدم نقاطاً.",
      en: "Provide a precise, structured academic description of this image: what it shows, visual context, salient elements, colors, and likely meaning. Use bullet points.",
    },
    ocr: {
      ar: "استخرج كل النصوص الموجودة في الصورة كما هي بدون تعديل، مع الحفاظ على التنسيق وفصل الأسطر. إذا لم يوجد نص، أخبرني بذلك.",
      en: "Extract all text in the image verbatim, preserving formatting and line breaks. If no text exists, say so.",
    },
    analyze: {
      ar: "حلّل هذه الصورة بعمق أكاديمي: اشرح المحتوى، استنتج المعنى، حدد أي بيانات أو أرقام أو رسوم بيانية، اقترح ما تدل عليه. نظّم الإجابة في أقسام: (1) ما أراه، (2) النص/البيانات، (3) التحليل والاستنتاج.",
      en: "Analyze this image with academic depth: explain content, infer meaning, identify any data/numbers/charts, suggest what it indicates. Structure: (1) What I see, (2) Text/Data, (3) Analysis & inference.",
    },
    translate: {
      ar: "استخرج جميع النصوص من الصورة ثم ترجمها إلى العربية الفصحى مع الحفاظ على المعنى الأكاديمي.",
      en: "Extract all text from the image, then translate it to clear English while preserving academic meaning.",
    },
    custom: {
      ar: prompt?.trim() || "حلّل هذه الصورة وأجب باللغة العربية.",
      en: prompt?.trim() || "Analyze this image and respond.",
    },
  };

  const selected = promptByMode[mode || "describe"] ?? promptByMode.describe;
  const userText = isAr ? selected.ar : selected.en;

  const system = isAr
    ? "أنت محلل بصري أكاديمي خبير. تجيب بدقة وعمق وتنظيم، مع استخدام العربية الفصحى. لا تختلق محتوى لا تراه؛ إذا كانت الصورة غامضة قُل ذلك صراحة."
    : "You are an expert academic visual analyst. Reply precisely, deeply, and in an organized way. Do not fabricate content you do not see; if the image is unclear, say so explicitly.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1800,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ content });
  } catch (err) {
    req.log.error(err, "vision failed");
    res.status(500).json({
      error: isAr ? "فشل تحليل الصورة. يرجى المحاولة مرة أخرى." : "Image analysis failed. Please try again.",
    });
  }
});

export default router;
