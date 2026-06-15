---
name: AI proxy hardening
description: Why the /api/ai Anthropic relay is guarded by origin allowlist + per-IP rate limit instead of auth
---

The frontend (محكّم برو V4) calls Anthropic through a server proxy at `POST /api/ai`
(`artifacts/api-server/src/routes/ai/proxy.ts`) so the API key never reaches the browser.

**Decision:** the proxy is guarded by an Origin allowlist + per-IP in-memory rate limit, NOT by user auth.

**Why:** A server-side relay to a *paid* LLM that is publicly callable is an open
credit-burn / DoS vector. Phase 1 deliberately ships محكّم برو V4's tools to all
visitors with no login (auth + plan quotas are a deferred later phase per the rebuild
brief). So we cannot require auth yet — instead we add proportionate, UX-invisible
defenses.

**How to apply:**
- Allowed origins are built at module load from `REPLIT_DOMAINS` (comma-separated) +
  `REPLIT_DEV_DOMAIN` + `localhost`. Requests with no Origin header are allowed
  (same-origin / non-browser); requests with a foreign Origin get 403.
- CRITICAL: do NOT rely on `REPLIT_DOMAINS` containing the custom production domain.
  In practice the env baked into the deployment can omit a custom domain (e.g.
  muhakkim.com), so EVERY browser call from the live site sends `Origin: https://muhakkim.com`,
  fails the allowlist, returns 403, and ALL AI tools silently fail in production while
  dev works fine. This is the classic "all tools broken in production only" symptom.
- FIX (in place): the guard also accepts **same-origin** requests — `new URL(origin).hostname === req.hostname`.
  Since the call comes from our own served frontend, same-origin is always legitimate and
  covers any custom/production domain automatically, while foreign Origins still get 403.
  Relies on `app.set("trust proxy", true)` so `req.hostname` reflects the public host via
  X-Forwarded-Host. Verified: dev origin=200, custom same-origin=200, foreign origin=403, no-origin=200.
- Per-IP rate limit requires `app.set("trust proxy", true)` in `app.ts` — without it,
  all traffic behind Replit's reverse proxy shares one IP bucket and throttles everyone
  together.
- When the auth/quota phase lands, replace the origin guard with real authz + per-user
  budgets rather than layering on top.
- Note: Origin headers are spoofable by non-browser clients, so this is defense-in-depth,
  not a security boundary. Real protection comes with the auth phase.
