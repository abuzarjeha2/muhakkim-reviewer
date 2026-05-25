import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface ChatMsg { role: "user" | "assistant"; content: string; }

router.post("/ai/chat-pdf", async (req, res) => {
  const { documentText, messages, lang } = req.body as {
    documentText: string;
    messages: ChatMsg[];
    lang: "ar" | "en";
  };

  const isArEarly = lang === "ar";
  if (!documentText || documentText.trim().length < 50) {
    res.status(400).json({ error: isArEarly ? "نص المستند قصير جداً." : "Document text is too short." });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: isArEarly ? "لم يُرسَل أي سؤال." : "No messages provided." });
    return;
  }
  const validMessages = messages.filter(
    m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
  );
  if (validMessages.length === 0) {
    res.status(400).json({ error: isArEarly ? "الرسائل غير صالحة." : "Invalid messages." });
    return;
  }

  const isAr = lang === "ar";
  // Trim doc to fit in context — keep first ~10000 chars
  const docExcerpt = documentText.slice(0, 12000);

  const system = isAr
    ? `أنت مساعد بحثي خبير. ستجيب على أسئلة المستخدم بناءً على محتوى المستند المرفق فقط.
- استخدم اللغة العربية الفصحى.
- إذا لم تكن المعلومة موجودة في المستند، قل صراحةً: "المعلومة غير متوفرة في المستند".
- استشهد بمقاطع قصيرة من المستند بين علامتي اقتباس عند الضرورة.
- اجعل إجاباتك مباشرة وموجزة (لا تتجاوز 300 كلمة عادة).

محتوى المستند:
"""
${docExcerpt}
"""`
    : `You are an expert research assistant. Answer the user's questions strictly based on the attached document.
- Respond in clear formal English.
- If the information is not in the document, say explicitly: "This information is not in the document."
- Cite short excerpts in quotes when relevant.
- Keep answers direct and concise (under 300 words usually).

Document content:
"""
${docExcerpt}
"""`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 800,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        ...validMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ reply });
  } catch (err) {
    req.log.error(err, "AI chat-pdf failed");
    res.status(500).json({ error: lang === "ar" ? "فشل الرد على السؤال" : "Failed to answer question" });
  }
});

export default router;
