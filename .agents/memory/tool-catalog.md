---
name: Muhakkim V4 tool catalog architecture
description: How tools are defined/routed in MuhakkimProV4.jsx, and which tools are genuinely redundant vs unique — read before any "merge/reduce tools" work.
---

# Tool catalog & routing (MuhakkimProV4.jsx)

Three layers define the tool suite:

- **`GROUPS`** — top-level catalog: 6 categories, each `tools:[{key,icon,ar,en,badge}]`. This is what shows on the home page (grouped cards) and nav. Removing a `{key:...}` line here hides the tool; it does NOT delete its component (reversible).
- **`HUBS` + `ToolHub`** — several catalog entries are *hubs* that bundle many sub-tools as `options:[{key,label,hint,render:T=><Comp/>}]` (e.g. `review_center`, `committee_hub`, `assess_hub`, `text_hub`, `data_quality_hub`, `research_hub`, `rev_roles`). Sub-tool guidance is the short `hint`, not the rich guide card.
- **Router** — a long `if(key===...) return <Comp/>` chain maps `activeTool` → component. Unmatched keys fall through to `return <StdTool toolKey={key}/>` (a generic single-prompt tool driven by a config list, e.g. the `{id:"report", sys:"..."}` entries).
- **`TOOL_GUIDE`** — `{key:{what,need,out,diff}}`. The **rich guide card** is rendered ONLY for top-level `GROUPS` tools (via `ToolCatalogCard ... guide={TOOL_GUIDE[t.key]}`). Hub `options` do NOT get this card — so nesting a top-level tool into a hub LOSES its rich guide unless you also move/replicate that guide.

## Redundancy reality (verified — do not assume)
- The catalog is **already well-consolidated** via hubs. Top-level entries are mostly distinct from hub internals. Heavy further "merging" mostly removes real features.
- The three **«أجنحة التميّز» / Pro Suites** (`review_suite`, `writing_suite`, `analysis_suite`) are **NOT duplicates** — each bundles 3 *exclusive* features (rebuttal-letter / tracked-corrections / verified-certificate; academic translation / publishing pack / Q1-style simulator; results-chapter maker / methodology planner / APA7 tables). Deleting them loses unique tools.
- The one genuinely redundant top-level entry was **`report` («تقرير التحكيم الرسمي»)** — a simple `StdTool` prompt fully covered by **`master_report` («التقرير الشامل الموحّد», 4-angle unified report)**. Retired from `GROUPS`.

**Why:** user wanted to "reduce/merge similar tools" but also "lose no functionality"; an early assumption that suites/hubs were redundant was wrong. **How to apply:** before hiding/merging any tool, read its `TOOL_GUIDE` + component; only merge true subsets, and if moving a tool into a hub, carry its guide or the rich guide card disappears.

## Adding a new top-level tool (wiring pattern — keep all in sync)
Adding a tool requires editing 3 places + (for a vendored module) a splice point:
1. Add the component(s) — paste a vendored module **before the `// ── MAIN APP` marker** so it sits in module scope alongside the other tool components.
2. `GROUPS` — add `{key,icon,ar,en,badge}` to the chosen category's `tools:[]` (controls home card + nav).
3. Router `renderTool` — add `if(key==="<key>") return <Comp T={T}/>;` (else it falls through to `StdTool`).
4. `TOOL_GUIDE` — add `<key>:{what,need,out,diff}` for the rich guide card.
**Why:** these 4 are decoupled; miss one and the tool silently misbehaves (no card / no route / no guide). **How to apply:** vendored modules reuse in-file deps (`Card`,`Btn`,`Spin`,`Tag`,`FileZone`,`callAIJson`,`readFile`,`ReportBtn`) — grep new symbol names for collisions first. EDIT THIS FILE WITH grep/sed line numbers, NOT `read` offsets — long lines make `read` offsets diverge from real line numbers.
