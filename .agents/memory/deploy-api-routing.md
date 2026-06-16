---
name: API-server healthcheck / production routing
description: Why /api/* returned a platform 404 in the autoscale deployment while the static frontend worked.
---

# Runnable artifact must answer 200 at its service ROOT path

In the monorepo autoscale deployment, the platform probes a runnable artifact at its **service base path** (`GET /api`) to decide whether to route traffic to it. The api-server only had `GET /api/healthz`; `GET /api` returned 404. Result: the platform marked the api-server unhealthy and the edge router served the Replit "Page not found" 404 for **every** `/api/*` request in production — while the static frontend (served directly at `/`) still loaded. Symptom in the app: the site opens fine but every AI tool fails with "خطأ اتصال" (the frontend throws on any non-OK `/api/ai` response).

**Why:** `deploymentTarget = "autoscale"`; static handlers are served by the edge independently, but runnable artifacts only receive traffic once healthy. A non-2xx at the probed path = no routing. Deployment logs show `healthcheck /api returned status 500` even though `artifact.toml` set `health.startup.path = "/api/healthz"` — the routing probe hits the service root `/api`, not the configured startup path.

**How to apply:** any Express runnable mounted at `/api` must return 200 for `GET /api` (the service root), not only `/api/healthz`. Add a `router.get("/", ...)` to the health router. Dev never catches this (the shared dev proxy routes `/api/*` regardless of health); only production routing depends on it. To diagnose prod-only API failures: `curl https://<prod-domain>/api/healthz` — a Replit-styled HTML 404 means the runnable isn't being routed (unhealthy), NOT an app bug.
