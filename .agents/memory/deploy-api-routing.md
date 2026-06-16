---
name: API-server production path routing
description: Why /api/* returned a platform 404 in the autoscale deployment while the static frontend worked.
---

# Every artifact (incl. runnable APIs) needs `router = "path"` in artifact.toml to be routed in production

In the monorepo autoscale deployment, an artifact's path is only registered in the production edge router if its `.replit-artifact/artifact.toml` has top-level `router = "path"`. The api-server (`kind = "api"`, paths `["/api"]`) was the ONLY artifact missing this line; both web artifacts had it. Result: the deploy registered static handlers for `/` and `/stats-site/` but **never registered any route for `/api`**, so every `/api/*` request hit the Replit edge default and returned an instant (~0.2s, no cold-start delay) "Page not found" 404 in production. Dev was unaffected (the shared dev proxy routes `/api/*` regardless). App symptom: site loads at `/`, but every AI tool fails with "خطأ اتصال" because the frontend throws on any non-OK `/api/ai` response.

**Why:** `router = "path"` is what opts an artifact into path-based registration in the production router. Without it the runnable process still starts and its port is detected, but no external route forwards traffic to it. Deploy logs are the tell: look for `registered static handler ... path=/X` lines — if there's no registration line for the runnable's path, it won't be reachable. The `healthcheck /api returned status 500` lines are a downstream symptom (the probe hits an unregistered path), NOT the root cause; adding a `GET /api` app route does not fix it.

**How to apply:** verify EVERY artifact's `artifact.toml` has `router = "path"`, especially runnable API/server artifacts. Fix via the `verifyAndReplaceArtifactToml` temp-file workflow (never edit `artifact.toml` directly). The change only reaches production on REPUBLISH. To diagnose prod-only API failures: `curl https://<prod-domain>/api/healthz` — a Replit-styled HTML 404 returned instantly means the runnable isn't routed at all (missing route registration), not an app bug.
