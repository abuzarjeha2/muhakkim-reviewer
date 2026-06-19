// server.js — Muhakkim AI proxy server (Express)
// يحمي مفتاح Anthropic API على الخادم ويوفّر بروكسي /api/ai

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// مفتاح API يُقرأ من متغيرات البيئة (Replit Secrets) — لا يُكتب في الكود إطلاقاً
const API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

app.use(express.json({ limit: "12mb" })); // حد مرتفع لدعم الملفات/الصور base64
app.use(express.static(path.join(__dirname, "public"))); // يخدم ملفات الواجهة

// CORS بسيط (مفيد أثناء التطوير)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// نقطة البروكسي: تستقبل نفس جسم طلب Anthropic من الواجهة
app.post("/api/ai", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: "مفتاح API غير مُعرّف. أضِف ANTHROPIC_API_KEY في Replit Secrets."
    });
  }
  try {
    const body = {
      model: req.body.model || "claude-sonnet-4-6",
      max_tokens: req.body.max_tokens || 1500,
      messages: req.body.messages || []
    };
    if (req.body.system) body.system = req.body.system;
    if (req.body.tools) body.tools = req.body.tools;
    if (req.body.mcp_servers) body.mcp_servers = req.body.mcp_servers;

    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic error:", data);
      return res.status(r.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "خطأ في الخادم", detail: String(err) });
  }
});

// فحص صحة الخادم
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", keyConfigured: !!API_KEY });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Muhakkim AI server running on port ${PORT}`);
  console.log(`✓ API key configured: ${!!API_KEY}`);
});