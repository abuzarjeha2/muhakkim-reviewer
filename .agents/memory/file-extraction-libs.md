---
name: File extraction libraries (PDF/Excel)
description: Why client-side file parsing in Muhakkim must use bundled npm packages, never runtime CDN imports.
---

# Client-side file extraction must be bundled, not CDN

محكّم برو V4 extracts text/tables from uploaded files in the browser:
- Excel (.xlsx/.xls) → `xlsx`
- PDF → `pdfjs-dist` (main + worker)
- docx/pptx → manual zip/inflate in `extractOfficeText` (no external lib)
- txt/csv → FileReader

**Rule:** import these from the bundled npm packages, never via runtime `import("https://cdnjs.cloudflare.com/...")`.

```js
const XLSX = await import("xlsx");
const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
```

**Why:** runtime CDN imports silently fail for real users — CSP, ad-blockers, mobile browsers, and regional network blocks all break `cdnjs.cloudflare.com`. The picker shows the file attached (✅) but extraction throws, so users perceive it as "the file won't attach." This caused a production incident where PDF/Excel attach appeared broken on mobile and the custom domain. Excel and PDF were the affected formats; txt/docx were never CDN-dependent.

**How to apply:** the packages are already in `artifacts/muhakkim/package.json` (`pdfjs-dist`, `xlsx`, `jspdf`). Vite bundles them and emits a local worker asset via `?url` (main+worker share one version, so no API/worker mismatch). If you ever see a `cdnjs.cloudflare.com` import in frontend extraction paths, replace it. A frontend-only fix like this only reaches the live site after the user re-publishes.
