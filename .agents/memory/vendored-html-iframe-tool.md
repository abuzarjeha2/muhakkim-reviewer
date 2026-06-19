---
name: Vendored standalone HTML tool integration
description: How to embed a self-contained vanilla-JS HTML tool into the Muhakkim React app without rewriting it.
---

# Embedding a standalone HTML tool into Muhakkim

Pattern used to "insert" (ادراج) a complete self-contained vanilla-JS + localStorage HTML tool into the React app without porting it to React.

**The pattern:**
- Copy the HTML **verbatim** to `artifacts/muhakkim/public/<name>.html` (Vite serves `public/` at `base`).
- Add a tool entry to the relevant `GROUPS` group, a `renderTool` case, and (optional but nice) a `TOOL_GUIDE` entry.
- Render it with a small component returning `<iframe src={(import.meta.env.BASE_URL||"/")+"<name>.html"}>`. Muhakkim's `BASE_URL` is `/`, and the API is same-origin at `/api`, so the iframe's relative `fetch("/api/ai")` works in both dev and prod.

**Why iframe + static file:** preserves the tool's behavior literally (matches the project's vendored-verbatim philosophy) and isolates its global JS/CSS from the React bundle.

**Mandatory security patch:** these attached tools often ship a browser→Anthropic *direct* fallback (`fetch("https://api.anthropic.com/v1/messages")`). Remove every such direct call and route AI **only** through `/api/ai`. Core rule: AI never calls Anthropic from the browser; the key stays server-side.

**Gotcha:** a single self-contained `<script>` can have **duplicate top-level `let`/`const`** of the same identifier (e.g. two `let uploadedFile=...`). Browsers throw "already been declared" and halt the *entire* script — the iframe shows static HTML but nothing works. Always smoke-test the embedded page in the browser (check console) after embedding; typecheck won't catch it since the file is plain JS in `public/`.

**Translating/localizing the tool's UI breaks any JS that matches on the old text.** These vanilla tools commonly infer meaning from human-readable strings — e.g. `key.toLowerCase().includes('satisf'|'age'|'recommend')` against question text used as answer-object keys, or `val.includes('yes')` to color a "recommend" badge. After you translate the visible strings, those substring checks silently fail (columns show "—", metrics/percentages stay at defaults) even though the UI renders perfectly. Fix: add localized synonyms to every such predicate (`||key.includes('رضا'/'عمر'/'توصي')`, `||val.includes('نعم')`), or refactor to canonical field IDs. Grep the `<script>` for `.includes(` + English literals before declaring a translation done; verify the *interactive data path* (load sample → generate responses → check computed columns), not just a screenshot.

**Beware: a delegated translation subagent may keep running after the call returns `null`/times out.** Its file edits land asynchronously, so a region you grep as "still English" right after the call may already be Arabic minutes later. Don't trust the return value — re-grep the file's actual state before/after your own bulk edits, and design bulk string-replace scripts to no-op (count==0) gracefully on already-translated strings.
