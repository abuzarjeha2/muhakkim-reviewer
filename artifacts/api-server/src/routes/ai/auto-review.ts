import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
interface ReviewResult {
  title_review: string;
  toc_review: string;
  abstract_review: string;
  theoretical_framework_review: string;
  methodology_review: string;
  data_analysis_review: string;
  results_review: string;
  recommendations_review: string;
  hypotheses_objectives_review: string;
  gaps: string;
  score: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 6000, overlap = 400): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end);
    // smart cut at sentence/paragraph boundary
    const cut = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("\n"), slice.lastIndexOf("؟"), slice.lastIndexOf("!"));
    if (cut > chunkSize * 0.4) {
      end = start + cut + 1;
    }
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }
  return chunks.length ? chunks : [text];
}

function safeParseJson(raw: string): Partial<ReviewResult> {
  // strip code fences
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const clean = m ? m[1].trim() : raw.trim();
  try { return JSON.parse(clean); } catch {
    try { return JSON.parse(clean.replace(/'/g, '"')); } catch { return {}; }
  }
}

const EMPTY_RESULT: ReviewResult = {
  title_review: "", toc_review: "", abstract_review: "",
  theoretical_framework_review: "", methodology_review: "",
  data_analysis_review: "", results_review: "",
  recommendations_review: "", hypotheses_objectives_review: "",
  gaps: "", score: 0,
};

const SECTION_SCHEMA = `{
  "title_review":"",
  "toc_review":"",
  "abstract_review":"",
  "theoretical_framework_review":"",
  "methodology_review":"",
  "data_analysis_review":"",
  "results_review":"",
  "recommendations_review":"",
  "hypotheses_objectives_review":"",
  "gaps":"",
  "score":0
}`;

async function reviewChunk(chunk: string, idx: number, total: number): Promise<Partial<ReviewResult>> {
  const prompt = `أنت خبير أكاديمي متخصص في مراجعة رسائل الماجستير والدكتوراه.
راجع الجزء ${idx + 1} من ${total} المرفق من الرسالة وأرجع JSON فقط باللغة العربية بهذا الهيكل الحرفي:
${SECTION_SCHEMA}

قواعد:
- إذا غاب قسم اكتب "غير موجود في هذا الجزء"
- score: تقييم من 0 إلى 10 لهذا الجزء فقط
- لا تضف مفاتيح إضافية

الجزء:
${chunk.slice(0, 5800)}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 2500,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  return safeParseJson(resp.choices[0]?.message?.content ?? "{}");
}

async function mergeReviews(partials: Partial<ReviewResult>[]): Promise<ReviewResult> {
  if (partials.length === 1) {
    return { ...EMPTY_RESULT, ...partials[0] };
  }

  const prompt = `أنت محرر أكاديمي. لديك ${partials.length} مراجعات جزئية لرسالة علمية واحدة.
ادمجها في تقرير موحّد نهائي: أزل التكرار، حسّن الصياغة، واحتفظ بأبرز النقاط.
أرجع JSON فقط بنفس هذا الهيكل:
${SECTION_SCHEMA}

- score: متوسط التقييمات العام (من 10)
- البيانات المدخلة:
${JSON.stringify(partials, null, 1)}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 3000,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  const merged = safeParseJson(resp.choices[0]?.message?.content ?? "{}");
  return { ...EMPTY_RESULT, ...merged };
}

// ── Route ────────────────────────────────────────────────────────────────────
// POST /api/ai/auto-review
// body: { text: string }
// Returns: { review: ReviewResult }
router.post("/ai/auto-review", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || text.trim().length < 150) {
    res.status(400).json({ error: "النص قصير جداً. يرجى رفع ملف يحتوي على نص كافٍ." });
    return;
  }

  try {
    const chunks = chunkText(text.slice(0, 60000)); // cap at ~60k chars
    // review all chunks in parallel (up to 5 concurrent to avoid rate limits)
    const batchSize = 4;
    const partials: Partial<ReviewResult>[] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((c, j) => reviewChunk(c, i + j, chunks.length))
      );
      partials.push(...results);
    }

    const review = await mergeReviews(partials);
    res.json({ review, chunks: chunks.length });
  } catch (err) {
    req.log.error(err, "auto-review failed");
    res.status(500).json({ error: "فشل تحليل الملف. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
