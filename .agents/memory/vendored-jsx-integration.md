---
name: Vendored single-file JSX integration
description: How large pre-built single-file React components are dropped into this strict-TS monorepo
---

محكّم برو V4 arrived as one ~16k-line self-contained `.jsx` file with its own theme/RTL.
It is kept verbatim as `artifacts/muhakkim/src/MuhakkimProV4.jsx` (do NOT rewrite or
restructure it — "preserve behavior literally" was an explicit instruction).

**Pattern for vendoring a big single-file React component here:**
- Keep the file as `.jsx`. `allowJs` is false in the shared TS config, so `tsc` SKIPS
  `.jsx` files entirely (no type errors from vendored code), while Vite's React plugin
  still compiles it.
- Add a sibling `.d.ts` shim (`declare const C: ComponentType; export default C;`) so
  `tsc` can resolve the extensionless import from `App.tsx` while Vite resolves the `.jsx`.
- Babel warns "code generator has deoptimised ... exceeds the max of 500KB" for such a
  large file — harmless.

**Why:** lets a huge vendored component pass strict typecheck and build without editing
it or loosening repo-wide TS settings.
