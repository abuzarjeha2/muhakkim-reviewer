---
name: Embedded full-app React tool
description: How to embed a standalone full-screen React app as a Muhakkim tool without layout/overlay bleed.
---

Standalone React screens (their own sidebar/tabs/loading overlay) can be vendored as a separate `.jsx` and surfaced as a Muhakkim tool via **direct component import** (precedent: `MuqyasEmbedded`), not an iframe. Three mirror edits in `MuhakkimProV4.jsx`: top import, a `GROUPS` entry, and a `renderTool` `if(key===...) return <Comp/>` branch.

Two mandatory adaptations when adapting an attached app file:
- Persistence: swap any `window.storage`/host bridge for `localStorage` (JSON serialize).
- AI: route ALL calls through `AI_ENDPOINT=(import.meta.env.BASE_URL||"/")+"api/ai"` with body `{model,max_tokens(<=8192),system,messages:[{role:"user",content}]}`; read `data.content[].text`. Never browser→Anthropic.

**Overlay containment rule:** a full-screen app's loading/modal overlay is usually `position:fixed inset:0` (covers the whole viewport, masking Muhakkim's chrome). Change it to `position:absolute` AND give the component's outermost wrapper `position:relative`. Without the relative ancestor the "absolute" overlay still anchors to the viewport — same bug. Also scope the injected `<style>` under a unique class and rename generic keyframes (e.g. `spin`→`accspin`) so they don't collide with the host.

**Why:** code review caught the overlay escaping the tool container because the root had no positioned ancestor. Internal identifiers (callAI, C, Card, STANDARDS…) are module-scoped so they don't collide with MuhakkimProV4, but CSS/keyframes are global and do.
