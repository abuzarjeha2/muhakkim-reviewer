# Muhakkim (محكّم)

Bilingual (Arabic-first, RTL) academic peer-review and research platform. The live app is محكّم برو V4 — a single-page suite of 25+ AI-assisted tools for review, writing, analysis, and publishing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run revendor-muqyas` — regenerate the embedded Muqyas copy from the standalone source (see «Re-vendoring embedded Muqyas» below)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/muhakkim/` — the live web app (React + Vite, served at `/`, i.e. muhakkim.com root).
  - `src/MuhakkimProV4.jsx` — the entire محكّم برو V4 tool suite, vendored as one self-contained file. Rendered by `src/App.tsx`.
  - `src/MuhakkimProV4.d.ts` — type shim for the `.jsx` (see Architecture decisions).
- `artifacts/api-server/` — Express API (served at `/api`).
  - `src/routes/ai/proxy.ts` — `POST /api/ai` Anthropic relay used by the frontend tools.
- `lib/integrations-anthropic-ai/` — Replit-managed Anthropic client wrapper.

## Architecture decisions

- AI never calls Anthropic from the browser. The frontend posts the raw Anthropic Messages body to `POST /api/ai`; the server forwards it via the SDK so the key stays server-side. Frontend endpoint: `AI_ENDPOINT = (import.meta.env.BASE_URL||"/")+"api/ai"`.
- `/api/ai` is hardened with an Origin allowlist + per-IP rate limit (not auth — auth/quotas are a deferred phase). Requires `app.set("trust proxy", true)`.
- محكّم برو V4 is kept verbatim as a single `.jsx`. `tsc` skips it (`allowJs` is false); a `.d.ts` shim types the import; Vite compiles it.

## Product

محكّم برو V4: 25+ Arabic-first academic tools across review/refereeing, smart research lifecycle, writing, data analysis, journal management, and publishing — all powered by the server AI proxy.

## User preferences

- Communicate in Arabic, concise.
- Preserve محكّم برو V4 behavior literally; do NOT change its Arabic UI text.
- Brand accents: gold `#b45309`, navy `#1e293b`.

## Re-vendoring embedded Muqyas

`artifacts/muhakkim/src/MuqyasEmbedded.jsx` is a vendored copy of the standalone `artifacts/muqyas/src/MuqyasProV1.jsx`, plus a small fixed set of "embed-mode" patches (props `{embed, initialTool, dark}`, hidden header/footer, transparent root, host theme/tool sync effects, and an exported `MUQYAS_GROUPS`). When the standalone Muqyas app changes, do NOT hand-merge — re-vendor instead:

1. Run `pnpm --filter @workspace/scripts run revendor-muqyas`. This reads the standalone source, re-applies every embed patch, and overwrites `MuqyasEmbedded.jsx`.
2. If the script aborts (`anchor not found` / `matched N times`), an upstream change moved or duplicated a patched line. Open `scripts/src/revendor-muqyas.ts`, update the failing patch's `find`/`replace` to match the new upstream code, then re-run.
3. The patch list in `scripts/src/revendor-muqyas.ts` is the single source of truth for what embed mode changes — keep new embed edits there, never only in the generated file (they would be lost on the next re-vendor).
4. After re-vendoring, restart `artifacts/muhakkim: web` and sanity-check the embedded Muqyas inside Muhakkim's navbar.

## Gotchas

- After backend edits, restart the `artifacts/api-server: API Server` workflow.
- Anthropic models are allow-listed: `claude-opus-4-8`, `claude-sonnet-4-6` (default), `claude-haiku-4-5`.
- `artifacts/stats-site` has a pre-existing, unrelated typecheck failure (missing `../lib/translations`); it is a separate app, not part of Muhakkim.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
