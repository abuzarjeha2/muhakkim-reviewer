---
name: Muqyas embedded inside Muhakkim
description: How the Muqyas Pro quality platform is vendored and routed inside the Muhakkim app's single navbar.
---

Muqyas Pro is vendored as a self-contained copy inside the Muhakkim artifact and exposed through Muhakkim's own navbar — there are NO cross-artifact imports and the two apps stay independent modules (identical component/const names like GROUPS, useTheme, Card live in separate file scopes, no collision).

**Rule:** Muqyas's groups appear in Muhakkim's GROUPS with `mq_`-prefixed tool keys and an `ext:true` group marker. The prefix prevents key collisions (both apps reuse keys like qa_platform, supervision, smart_orch) AND auto-excludes them from Muhakkim's batch/global reports (those are TC-gated: `TC[t.key]`, and prefixed keys aren't in Muhakkim's TC).

**Why:** Task required one unified app with a single navbar, literal Arabic preserved, no giant merged file, and Muqyas tools excluded from Muhakkim-specific collective reports.

**How to apply:**
- The embedded copy exports `MUQYAS_GROUPS` (its GROUPS) so Muhakkim builds nav entries programmatically — never hand-transcribe the Arabic group/tool labels.
- The embedded default component takes `{embed, initialTool, dark}`. When `embed` it hides its own header/footer/home (renders only the requested tool view), starts at `initialTool`, and syncs theme via an effect that calls `toggleTheme()` when `dark` prop != its own dark. Both apps already share the `mhk_theme` localStorage key, so theme is mostly synced anyway.
- Muhakkim routes ext tools in its TOOL VIEW: `curGroup?.ext ? <MuqyasEmbedded embed initialTool={curTool.ek} dark={dark}/> : <normal header+ToolGuide+Card>`. `curTool.ek` is the original (unprefixed) key. Rendering ONLY the embed avoids a duplicate tool header/Card.
- Muqyas calls root-relative `fetch("/api/ai")`, which works under any base path — no AI change needed when embedding.
- The standalone `artifacts/muqyas` app must NOT be modified; it's the source of the vendored copy only.
