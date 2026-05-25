import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

type PageChunk = { page: number; text: string };

router.post("/ai/smart-review", async (req, res) => {
  const { text, pages, role, sections, lang } = req.body as {
    text?: string;
    pages?: PageChunk[];
    role: string;
    sections: string[];
    lang?: "ar" | "en";
  };

  const isAr = lang !== "en";

  // Build per-page block from `pages` (preferred) or fall back to flat `text` as page 1
  let pageBlocks = "";
  let totalLen = 0;
  const MAX_LEN = 60000;
  const validPageNums = new Set<number>();
  if (Array.isArray(pages) && pages.length > 0) {
    const chunks: string[] = [];
    for (const p of pages) {
      if (!p || typeof p.text !== "string" || !p.text.trim()) continue;
      const pageNum = typeof p.page === "number" && Number.isFinite(p.page) ? Math.max(1, Math.floor(p.page)) : null;
      if (pageNum == null) continue;
      const header = isAr ? `[صفحة ${pageNum}]` : `[Page ${pageNum}]`;
      const remaining = MAX_LEN - totalLen;
      if (remaining <= 0) break;
      const slice = p.text.length > remaining ? p.text.slice(0, remaining) : p.text;
      chunks.push(`${header}\n${slice}`);
      totalLen += slice.length + header.length + 1;
      validPageNums.add(pageNum);
    }
    pageBlocks = chunks.join("\n\n");
  } else if (typeof text === "string") {
    pageBlocks = `${isAr ? "[صفحة 1]" : "[Page 1]"}\n${text.slice(0, MAX_LEN)}`;
    validPageNums.add(1);
  }

  if (!pageBlocks.trim() || pageBlocks.trim().length < 100) {
    res.status(400).json({
      error: isAr
        ? "النص قصير جداً. يرجى رفع ملف يحتوي على نصوص كافية."
        : "Text too short. Please upload a file with sufficient content.",
    });
    return;
  }
  if (!sections || sections.length === 0) {
    res.status(400).json({
      error: isAr
        ? "يرجى اختيار محور واحد على الأقل للمراجعة."
        : "Please select at least one section to review.",
    });
    return;
  }

  const systemPrompt = isAr
    ? `أنت بروفيسور ومحكم أكاديمي خبير في نقد الرسائل العلمية. ترصد الفجوات والأخطاء بدقة عالية وتقترح حلولاً عملية.
ستحصل على نصوص الرسالة مقسّمة إلى صفحات معنونة بـ [صفحة N]. يجب أن تُنسب كل ملاحظة إلى رقم الصفحة الفعلي الذي وردت فيه.
أعد الإجابة JSON صرفاً بالشكل التالي بدون أي نص خارجه:

{
  "overallAssessment": "تقييم رصين شامل (3-5 أسطر) لجودة الرسالة ومستواها المنهجي",
  "score": 0-100,
  "findings": [
    {
      "section": "اسم المحور الذي تنتمي إليه الملاحظة (من المحاور المختارة)",
      "severity": "high|medium|low",
      "page": رقم الصفحة (عدد صحيح، من [صفحة N] التي وردت فيها الملاحظة),
      "quote": "اقتباس قصير (15-30 كلمة) من النص يحدّد موقع الملاحظة",
      "note": "وصف الملاحظة بدقة أكاديمية صارمة (1-3 أسطر)",
      "suggestion": "الحل المقترح بالذكاء الاصطناعي — عملي ومحدد وقابل للتطبيق فوراً (2-4 أسطر، يمكن تضمين صياغة بديلة مقترحة)"
    }
  ],
  "recommendations": ["توصية نهائية 1", "توصية نهائية 2"]
}

قواعد صارمة:
- لكل ملاحظة يجب أن يكون هناك "page" برقم صفحة محدد (لا تستخدم 0 أو نص).
- "suggestion" يجب أن تكون عملية وليست عامة — اقترح صياغة بديلة، اختباراً إحصائياً محدداً، مرجعاً، أو خطوة منهجية.
- امسح الرسالة صفحةً صفحةً بالترتيب من الأولى إلى الأخيرة، وارصد كل ملاحظة في موضعها الفعلي.
- رتّب مصفوفة "findings" تصاعدياً حسب رقم الصفحة (صفحة 1 أولاً، ثم 2، ثم 3 ... إلخ).
- لا تتجاوز أي صفحة فيها مشكلة واضحة. يمكن أن تحتوي الصفحة الواحدة على أكثر من ملاحظة.
- استخرج 12-25 ملاحظة موزعة على كامل الصفحات وعلى المحاور المختارة.
- "section" يجب أن تطابق إحدى المحاور المختارة حرفياً.`
    : `You are an expert academic professor reviewing theses. You identify methodological gaps and errors with high precision and suggest practical fixes.
You will receive thesis text divided into pages headed by [Page N]. Every finding MUST cite the actual page number where the issue appears.
Reply with pure JSON only, no prose outside:

{
  "overallAssessment": "Rigorous overall assessment (3-5 lines)",
  "score": 0-100,
  "findings": [
    {
      "section": "Selected section name this finding belongs to",
      "severity": "high|medium|low",
      "page": integer page number (from [Page N] where the issue appears),
      "quote": "Short (15-30 word) quote from the text locating the issue",
      "note": "Precise academic description of the issue (1-3 lines)",
      "suggestion": "AI-suggested fix — practical, specific, immediately actionable (2-4 lines, may include suggested replacement wording)"
    }
  ],
  "recommendations": ["Final recommendation 1", "Final recommendation 2"]
}

Strict rules:
- Every finding MUST have an integer "page" (no 0, no string).
- "suggestion" must be specific and actionable — propose alternative wording, a concrete statistical test, a reference, or a methodological step.
- Scan the thesis page-by-page from first to last; record each finding at its true page.
- ORDER the "findings" array by ascending page number (page 1 first, then 2, then 3 ...).
- Do not skip any page that has a clear issue. A single page may contain multiple findings.
- Extract 12-25 findings spanning the full document and the selected sections.
- "section" must exactly match one of the selected sections.`;

  const userPrompt = isAr
    ? `بصفتك خبيراً أكاديمياً (دور: ${role})، راجع نص الرسالة المقسّم إلى صفحات.

المحاور المطلوب التركيز عليها:
${sections.map(s => `- ${s}`).join("\n")}

نص الرسالة (مقسّم إلى صفحات):
${pageBlocks}`
    : `As an academic expert (role: ${role}), review the thesis text below, divided into pages.

Sections to focus on:
${sections.map(s => `- ${s}`).join("\n")}

Thesis text (page-segmented):
${pageBlocks}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 5000,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: {
      overallAssessment?: string;
      score?: number;
      findings?: Array<{ section?: string; severity?: string; page?: number | string; quote?: string; note?: string; suggestion?: string }>;
      recommendations?: string[];
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.error({ raw: raw.slice(0, 500) }, "smart-review: model returned non-JSON");
      res.status(502).json({
        error: isAr
          ? "تعذّر تحليل استجابة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى."
          : "Failed to parse AI response. Please try again.",
      });
      return;
    }

    const SEV_OK = new Set(["high", "medium", "low"]);
    const minPage = validPageNums.size > 0 ? Math.min(...validPageNums) : 1;
    const maxPage = validPageNums.size > 0 ? Math.max(...validPageNums) : 1;
    const clampPage = (n: number): number => {
      if (validPageNums.has(n)) return n;
      // Clamp to known range; pick nearest known page
      if (n < minPage) return minPage;
      if (n > maxPage) return maxPage;
      let nearest = minPage;
      let bestDist = Infinity;
      for (const v of validPageNums) {
        const d = Math.abs(v - n);
        if (d < bestDist) { bestDist = d; nearest = v; }
      }
      return nearest;
    };

    const findings = (parsed.findings ?? [])
      .map(f => {
        const note = typeof f.note === "string" ? f.note.trim() : "";
        const suggestion = typeof f.suggestion === "string" ? f.suggestion.trim() : "";
        if (!note || !suggestion) return null;
        const rawPage = typeof f.page === "number"
          ? Math.floor(f.page)
          : typeof f.page === "string"
            ? parseInt(f.page, 10)
            : NaN;
        if (!Number.isFinite(rawPage) || rawPage < 1) return null;
        const page = clampPage(rawPage);
        const sev = typeof f.severity === "string" && SEV_OK.has(f.severity.toLowerCase()) ? f.severity.toLowerCase() : "medium";
        return {
          section: typeof f.section === "string" ? f.section : "",
          severity: sev as "high" | "medium" | "low",
          page,
          quote: typeof f.quote === "string" ? f.quote.trim() : "",
          note,
          suggestion,
        };
      })
      .filter((x): x is { section: string; severity: "high" | "medium" | "low"; page: number; quote: string; note: string; suggestion: string } => x !== null)
      .sort((a, b) => a.page - b.page);

    const rawCount = Array.isArray(parsed.findings) ? parsed.findings.length : 0;
    if (rawCount > 0 && findings.length === 0) {
      req.log.error({ rawCount }, "smart-review: all findings rejected by validation");
      res.status(502).json({
        error: isAr
          ? "استجابة الذكاء الاصطناعي لم تتضمن ملاحظات صالحة (تفتقر لرقم صفحة أو حل مقترح). يرجى المحاولة مرة أخرى."
          : "AI response contained no valid findings (missing page or suggestion). Please try again.",
      });
      return;
    }

    res.json({
      overallAssessment: typeof parsed.overallAssessment === "string" ? parsed.overallAssessment : "",
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : null,
      findings,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter(r => typeof r === "string" && r.trim().length > 0)
        : [],
    });
  } catch (err) {
    req.log.error(err, "smart-review failed");
    res.status(500).json({
      error: isAr ? "فشل توليد التقرير. يرجى المحاولة مرة أخرى." : "Report generation failed. Please try again.",
    });
  }
});

export default router;
