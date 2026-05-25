import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const TYPE_PROMPTS: Record<string, { ar: string; en: string }> = {
  intro:        { ar: "مقدمة بحثية أكاديمية", en: "academic research introduction" },
  litreview:    { ar: "مراجعة أدبيات (إطار نظري)", en: "literature review" },
  methodology:  { ar: "وصف منهجية البحث", en: "research methodology description" },
  results:      { ar: "عرض نتائج الدراسة", en: "study results presentation" },
  discussion:   { ar: "مناقشة وتفسير النتائج", en: "discussion and interpretation of results" },
  conclusion:   { ar: "خاتمة بحثية", en: "research conclusion" },
  abstract:     { ar: "مستخلص بحثي علمي", en: "scientific research abstract" },
  paragraph:    { ar: "فقرة أكاديمية عامة", en: "general academic paragraph" },
};

const TONE_LABELS: Record<string, { ar: string; en: string }> = {
  academic: { ar: "أكاديمية رصينة", en: "formal academic" },
  concise:  { ar: "موجزة ومختصرة", en: "concise" },
  detailed: { ar: "تفصيلية ومعمّقة", en: "detailed and in-depth" },
};

type Reference = { title: string; url: string; snippet?: string; verified: boolean };

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 Muhakkim/1.0" },
    });
    clearTimeout(timeout);
    // Some servers reject HEAD; retry GET
    if (r.status === 405 || r.status === 403) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 4000);
      const r2 = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller2.signal,
        headers: { "User-Agent": "Mozilla/5.0 Muhakkim/1.0" },
      });
      clearTimeout(timeout2);
      return r2.ok;
    }
    return r.ok;
  } catch {
    return false;
  }
}

router.post("/ai/writer", async (req, res) => {
  const { topic, type, tone, words, lang, withReferences } = req.body as {
    topic: string; type: string; tone: string; words: number; lang: "ar" | "en"; withReferences?: boolean;
  };

  if (!topic || topic.trim().length < 5) {
    res.status(400).json({ error: lang === "ar" ? "يرجى إدخال الموضوع (5 أحرف على الأقل)." : "Please enter a topic (min 5 chars)." });
    return;
  }
  const t = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.paragraph;
  const tn = TONE_LABELS[tone] ?? TONE_LABELS.academic;
  const wordsNum = Number(words);
  const targetWords = Math.max(80, Math.min(800, Number.isFinite(wordsNum) && wordsNum > 0 ? wordsNum : 250));
  const isAr = lang === "ar";

  const baseSystem = isAr
    ? `أنت كاتب أكاديمي محترف. اكتب فقرات بحثية باللغة العربية الفصحى، بأسلوب علمي رصين، مع تدفق منطقي، واستخدام مصطلحات تخصصية دقيقة. لا تستخدم عبارات افتتاحية مثل "إليك..." بل ابدأ مباشرة بالنص.`
    : `You are a professional academic writer. Write research-grade content in formal English with logical flow and precise terminology. Do not include preambles like "Here is..." — start directly with the content.`;

  try {
    // ── Path A: With verified web references via Responses API + web_search ──
    if (withReferences) {
      const systemWithRefs = isAr
        ? `${baseSystem}

تعليمات إضافية:
- استخدم أداة البحث في الويب لاسترجاع مصادر حقيقية حديثة (مقالات علمية محكّمة، مواقع جامعية، منظمات رسمية).
- اعتمد فقط على المصادر التي ترجعها الأداة. ممنوع منعاً باتاً اختراع أي مرجع أو رابط أو مؤلف أو سنة.
- ادمج الاستشهادات داخل النص بصيغة (Smith, 2023) أو [1] متسلسلة، بحيث يمكن للقارئ تتبّع المرجع.
- في نهاية النص أضف قسماً بعنوان "المراجع" يحتوي قائمة مرقّمة بكل المراجع المستخدمة (المؤلف، السنة، العنوان، الرابط).
- إذا تعذّر العثور على مصادر كافية، اذكر ذلك بصراحة بدلاً من الاختلاق.`
        : `${baseSystem}

Additional rules:
- Use the web search tool to retrieve real, recent sources (peer-reviewed articles, university sites, official organizations).
- Only rely on sources returned by the tool. Absolutely no invented references, URLs, authors, or years.
- Embed citations inline as (Smith, 2023) or numbered [1], traceable to the references list.
- End with a "References" section listing every cited source (author, year, title, URL).
- If insufficient sources are found, state it explicitly rather than fabricating.`;

      const userWithRefs = isAr
        ? `اكتب ${t.ar} حول الموضوع التالي بأسلوب ${tn.ar}، بطول حوالي ${targetWords} كلمة، مع استشهادات داخل النص ومراجع موثقة في النهاية.

الموضوع: ${topic}`
        : `Write a ${t.en} on the following topic in a ${tn.en} style, approximately ${targetWords} words long, with in-text citations and a verified references list at the end.

Topic: ${topic}`;

      const response = await openai.responses.create({
        model: "gpt-4.1",
        max_output_tokens: Math.min(4000, targetWords * 6),
        tools: [{ type: "web_search_preview" }],
        tool_choice: { type: "web_search_preview" },
        input: [
          { role: "system", content: systemWithRefs },
          { role: "user", content: userWithRefs },
        ],
      });

      const content = (response.output_text ?? "").trim();

      // Extract URL citations: prefer response annotations, then fall back to URLs in the text
      const refsMap = new Map<string, Reference>();
      for (const item of response.output ?? []) {
        if (item.type !== "message") continue;
        for (const part of item.content ?? []) {
          if (part.type !== "output_text") continue;
          for (const ann of part.annotations ?? []) {
            if (ann.type === "url_citation" && ann.url) {
              const key = ann.url;
              if (!refsMap.has(key)) {
                refsMap.set(key, {
                  title: ann.title || ann.url,
                  url: ann.url,
                  verified: false,
                });
              }
            }
          }
        }
      }
      // Fallback: scan the generated text for URLs (covers cases where model embeds links inline)
      const urlRegex = /https?:\/\/[^\s)\]<>"'،]+/g;
      const cleanUrl = (u: string) => u.replace(/[.,;:!?»"')\]]+$/, "");
      for (const m of content.matchAll(urlRegex)) {
        const url = cleanUrl(m[0]);
        if (!url || refsMap.has(url)) continue;
        // Try to infer a title: take the line/sentence containing the URL up to the URL
        const idx = content.indexOf(m[0]);
        const lineStart = content.lastIndexOf("\n", idx) + 1;
        const before = content.slice(lineStart, idx).trim().replace(/\s+/g, " ");
        const title = before.length > 5 ? before.slice(0, 180) : url;
        refsMap.set(url, { title, url, verified: false });
      }

      const references = Array.from(refsMap.values()).slice(0, 15);

      // Verify each URL in parallel (HEAD requests with timeout)
      const verified = await Promise.all(references.map(r => verifyUrl(r.url)));
      references.forEach((r, i) => { r.verified = verified[i] ?? false; });

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      res.json({ content, wordCount, references });
      return;
    }

    // ── Path B: Original behavior (no references) ──
    const user = isAr
      ? `اكتب ${t.ar} حول الموضوع التالي بأسلوب ${tn.ar}، بطول حوالي ${targetWords} كلمة.

الموضوع: ${topic}

أنتج النص مباشرة دون عناوين فرعية ودون مقدمات.`
      : `Write a ${t.en} on the following topic in a ${tn.en} style, approximately ${targetWords} words long.

Topic: ${topic}

Produce the text directly without subheadings or preambles.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: Math.min(2000, targetWords * 4),
      temperature: 0.7,
      messages: [
        { role: "system", content: baseSystem },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    res.json({ content, wordCount, references: [] });
  } catch (err) {
    req.log.error(err, "AI writer failed");
    res.status(500).json({ error: lang === "ar" ? "فشل توليد النص" : "Text generation failed" });
  }
});

export default router;
