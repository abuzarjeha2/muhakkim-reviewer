import { Router, type Request, type Response, type NextFunction } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

const ALLOWED_MODELS = new Set([
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
]);

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_CAP = 8192;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;

function allowedHosts(): Set<string> {
  const hosts = new Set<string>(["localhost"]);
  for (const d of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const h = d.trim();
    if (h) hosts.add(h);
  }
  const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (dev) hosts.add(dev);
  return hosts;
}

const ORIGIN_HOSTS = allowedHosts();

function originGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }
  if (ORIGIN_HOSTS.has(host)) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden origin" });
}

const hits = new Map<string, { count: number; reset: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip ?? "unknown";
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= RATE_MAX) {
    res
      .status(429)
      .json({ error: "Too many requests, please slow down." });
    return;
  }
  entry.count += 1;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.reset) hits.delete(key);
  }
}, RATE_WINDOW_MS).unref();

type AnthropicBody = {
  model?: string;
  max_tokens?: number;
  system?: string;
  messages?: unknown;
};

router.post("/ai", originGuard, rateLimit, async (req, res) => {
  const body = (req.body ?? {}) as AnthropicBody;
  const messages = body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const model =
    body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const requested = Number(body.max_tokens);
  const max_tokens =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_TOKENS_CAP)
      : 2000;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens,
      ...(typeof body.system === "string" ? { system: body.system } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
    });
    res.json(message);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    const status = typeof e.status === "number" ? e.status : 500;
    req.log.error({ err }, "anthropic proxy failed");
    res
      .status(status)
      .json({ error: e.message || "AI request failed", status });
  }
});

export default router;
