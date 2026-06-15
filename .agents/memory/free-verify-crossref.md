---
name: Free Crossref verification & client-side checks in V4
description: Why reference verification can run with no backend, and the file-text gotcha for V4 tools
---

# Free deterministic checks inside محكّم برو V4

- **Crossref is CORS-enabled.** `https://api.crossref.org/works/{doi}` returns `Access-Control-Allow-Origin: *`, so real DOI/reference verification (catching fabricated refs) can run entirely in the browser from the vendored `.jsx` — no backend route, no API key, no cost. Prefer this over routing through `/api`. Throttle (~150ms/req) and cap batch size to be polite to the free pool.
- **`ref_verify` is already taken** in V4 as an AI-based verification sub-tool (IN_MODULES, hallucination-prone). Deterministic Crossref tool uses key `free_verify` (component `FreeVerifyCostSystem`, deep_review group).

## Gotcha: uploaded-file text is async
- `readFile(file)` is async, so a click-time `await loadText()` does NOT make file content available to synchronous UI (button enable/disable gates, live cost estimates). **Mirror uploaded file text into state** via `useEffect(...,[files])` → `setFileText(...)`, then compute `fullText = text + fileText` synchronously and drive all gating/estimates off it.
- **Why:** architect review failed the first cut because similarity gate and cost estimator only read the textarea, silently ignoring upload-only flows.

## Cost estimation
- Anthropic tiers used for estimates: Haiku ~$0.80/$4, Sonnet ~$3/$15, Opus ~$15/$75 per Mtok. Token est ≈ chars/3.3. SAR = USD×3.75. Always label تقديري — these are public approximate prices, not billed numbers.
