---
name: muhakkim.com prod API 404 — custom domain pointed at Netlify, not Replit
description: Why /api/* 404'd on muhakkim.com while the Replit deployment itself was fully healthy.
---

# When prod /api 404s, first confirm the domain actually resolves to the Replit deployment

The live custom domain `muhakkim.com` was being served by **Netlify** (DNS A record → `75.2.60.5`; responses carried `server: Netlify` / `cache-status: "Netlify Edge"`). Netlify hosted a static copy of the frontend, so the root page loaded, but it has no backend — every `/api/*` request returned a Netlify 404 ("Page not found"). The app surfaced this as "تعذّر: API 404" on every AI tool. The Replit deployment itself was 100% healthy the whole time: `https://<repl>--<user>.replit.app/api/healthz` → 200 (`server: Google Frontend`, `x-powered-by: Express`), and `/` → 200.

**Why:** `getDeploymentInfo()` reported `primaryUrl = https://muhakkim.com` (Replit still believed it was the verified custom domain), but live DNS pointed the domain at a separate Netlify site. Replit's recorded custom-domain state can be stale relative to actual DNS. None of the app-side fixes (api-server `router = "path"`, a `GET /api` health route) were relevant to this symptom — they were chasing a Replit-internal routing theory that didn't apply.

**How to apply:** For any "works in dev / replit.app but broken on the custom domain" report, FIRST `curl -i https://<custom-domain>/<path>` and check the `server:` response header + `getent hosts <domain>` / `nslookup`. If `server:` is not Google/Replit (e.g. Netlify, Vercel, Cloudflare Pages), the domain is pointed at another host and the fix is DNS/custom-domain config (point the domain at the Replit deployment via Publishing → custom domain), NOT app code or artifact.toml. Compare against the `.replit.app` URL to confirm the Replit deployment is healthy before touching any code.
