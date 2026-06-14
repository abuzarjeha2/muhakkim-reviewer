---
name: Muhakkim icon system (emoji → Lucide)
description: How on-screen icons are rendered in the vendored MuhakkimProV4.jsx and the export-string caveat
---

Muhakkim's tools store icons as emoji strings in `icon:` props (~515 across the file). On-screen icons render through a single `EmIcon` component + `ICON_NAME` map at the top of `MuhakkimProV4.jsx`, using `import * as Lucide`.

**Rule:** never blanket-convert every `.icon` occurrence. Only JSX *children* renders (`>{x.icon}`) become `<EmIcon e={x.icon}/>`. Template-literal usages (`${x.icon}`, ~46 of them) build PDF/Word/Markdown export HTML and progress strings — they MUST stay raw emoji, or exports break.

**Why:** a React component rendered into a template string produces `[object Object]`; emojis render fine in exported documents.

**How to apply:** to add/adjust an icon, edit the `ICON_NAME` emoji→Lucide-name map. `EmIcon` strips U+FE0F/U+20E3 before lookup, defaults size to `1em` (inherits parent `fontSize`) and color to `currentColor`, and falls back to rendering the raw emoji if the name is unmapped or missing in lucide-react — so a wrong/missing name can never crash the app.
