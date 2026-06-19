---
name: Muqyas → Muhakkim merge
description: How the Muqyas tool suite is embedded inside Muhakkim as one unified platform.
---

# Muqyas embedded inside Muhakkim

محكّم and مُقياس are **forks of the same base codebase** (identical `renderTool`, helper
components, inline-style theme `T`, `GROUPS`/`TC`/`openTool` patterns, both call server `/api/ai`).
They differ only in their tool sets. They are now ONE platform: محكّم is the host.

**Rule:** artifacts cannot import across each other. So مُقياس is **vendored as a copy**
inside the host: `artifacts/muhakkim/src/MuqyasEmbedded.jsx` (+ `.d.ts` shim). The standalone
`artifacts/muqyas` app still exists and is NOT modified by the merge.

**Why this approach:** mounting مُقياس as a self-contained sibling component (its own module
scope) avoids all symbol-collision risk between the two large forks, and keeps the change
reversible. A full single-file code-merge would require deduping hundreds of shared helpers.

**How it works:**
- The embedded component takes props `{embed, initialTool, dark}`: in embed mode it hides its
  own navbar/footer/home, jumps straight to `initialTool`, and syncs dark theme from محكّم.
- It also exports `MUQYAS_GROUPS` so the host builds nav groups programmatically (keeps Arabic
  text verbatim — never hand-retype it).
- In محكّم, مُقياس's 3 groups (quality 🏆 / education 🎓 / erp 🏢) are inserted into محكّم's own
  `GROUPS` with **`mq_`-prefixed keys** and an `ext:true` flag. The prefix is essential: the two
  forks SHARE tool keys (`academic_journey`, `math_solver`, `supervision`, `grad_vision`, …), so
  without namespacing `findGroup`/`openTool` would collide.
- `ext` groups are auto-excluded from محكّم batch/global reports (those rely on `TC`, which has no
  ext entries). When an ext tool is active, محكّم renders `<MuqyasEmbedded embed initialTool=<key
  without mq_ prefix> dark=.../>` only (no double header/Card); the per-section "تقرير القسم"
  button is hidden for ext groups.
- The old external `/muqyas/` navbar link in محكّم was removed (real merge replaces it).

**Keeping in sync:** because مُقياس is a vendored copy, changes to the standalone app must be
re-copied into `MuqyasEmbedded.jsx` (a follow-up project task tracks this).
