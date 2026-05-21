import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/citation/format", async (req, res) => {
  const { input, style, type, lang } = req.body as {
    input: string;
    style: "APA7" | "MLA9" | "Chicago17" | "IEEE" | "Harvard" | "Vancouver";
    type: "doi" | "url" | "manual";
    lang: "ar" | "en";
  };

  if (!input || !input.trim()) {
    res.status(400).json({ error: "Input is required." });
    return;
  }

  const isAr = lang === "ar";

  const styleGuides: Record<string, string> = {
    APA7: "APA 7th edition (American Psychological Association)",
    MLA9: "MLA 9th edition (Modern Language Association)",
    Chicago17: "Chicago 17th edition (Notes-Bibliography or Author-Date)",
    IEEE: "IEEE citation style (numbered references)",
    Harvard: "Harvard referencing style",
    Vancouver: "Vancouver citation style (numbered, biomedical)",
  };

  const inputLabel =
    type === "doi" ? "DOI"
    : type === "url" ? "URL"
    : "manual metadata (title, authors, year, journal/publisher, volume, issue, pages)";

  const systemPrompt = isAr
    ? `أنت خبير في توثيق المراجع الأكاديمية. مهمتك توليد اقتباسات علمية صحيحة بالتنسيق المطلوب.

أسلوب الاقتباس المطلوب: ${styleGuides[style]}
نوع المدخل: ${inputLabel}

إذا كان المدخل DOI، استخرج المعلومات من شكل DOI المعروف (مثل 10.XXXX/...) وأنتج الاقتباس.
إذا كان URL، حلّل الرابط لاستنتاج أكبر قدر ممكن من المعلومات.
إذا كان إدخالاً يدوياً، استخدم البيانات المتاحة.

أجب بـ JSON فقط بهذه البنية:
{
  "formatted": "<الاقتباس المنسّق بشكل كامل>",
  "fields": {
    "authors": "<المؤلفون>",
    "year": "<السنة>",
    "title": "<العنوان>",
    "journal": "<المجلة أو الناشر>",
    "volume": "<المجلد>",
    "issue": "<العدد>",
    "pages": "<الصفحات>",
    "doi": "<DOI إن وجد>",
    "url": "<URL إن وجد>"
  },
  "notes": "<أي ملاحظات أو تحذيرات بشأن المعلومات الناقصة>",
  "inText": "<صيغة الاقتباس داخل النص (in-text citation)>"
}`
    : `You are an expert in academic reference formatting. Your task is to generate a correctly formatted academic citation.

Required citation style: ${styleGuides[style]}
Input type: ${inputLabel}

If the input is a DOI, extract information from the DOI format (e.g., 10.XXXX/...) and produce the citation.
If the input is a URL, parse it to infer as much metadata as possible.
If it is manual input, use the provided data.

Respond with ONLY valid JSON in this structure:
{
  "formatted": "<fully formatted citation string>",
  "fields": {
    "authors": "<authors>",
    "year": "<year>",
    "title": "<title>",
    "journal": "<journal or publisher>",
    "volume": "<volume>",
    "issue": "<issue>",
    "pages": "<pages>",
    "doi": "<DOI if available>",
    "url": "<URL if available>"
  },
  "notes": "<any notes or warnings about missing information>",
  "inText": "<in-text citation format>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Input: ${input.slice(0, 2000)}` },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    res.json(JSON.parse(raw));
  } catch (err) {
    req.log.error(err, "Citation formatting failed");
    res.status(500).json({ error: "Citation formatting failed" });
  }
});

export default router;
