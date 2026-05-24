import { Router } from "express";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  citationCount: number;
  url: string;
  source: "semantic_scholar" | "openalex" | "crossref";
  doi?: string;
  openAccess?: boolean;
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return "";
  const positions: string[] = [];
  for (const [word, locs] of Object.entries(invertedIndex)) {
    for (const pos of locs) {
      positions[pos] = word;
    }
  }
  return positions.filter(Boolean).join(" ").slice(0, 400);
}

const router = Router();

router.post("/research/search", async (req, res) => {
  const { query, sources } = req.body as {
    query: string;
    sources?: string[];
  };

  if (!query || query.trim().length < 3) {
    res.status(400).json({ error: "Query must be at least 3 characters." });
    return;
  }

  const q = encodeURIComponent(query.trim().slice(0, 300));
  const active = sources ?? ["semantic_scholar", "openalex", "crossref"];
  const results: Paper[] = [];
  const errors: string[] = [];

  await Promise.allSettled([
    /* ── Semantic Scholar ── */
    active.includes("semantic_scholar")
      ? (async () => {
          const url =
            `https://api.semanticscholar.org/graph/v1/paper/search` +
            `?query=${q}&fields=title,authors,year,abstract,citationCount,url,externalIds,isOpenAccess&limit=6`;
          const r = await fetch(url, {
            headers: { "User-Agent": "Muhakkim/1.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) throw new Error(`Semantic Scholar ${r.status}`);
          const data = (await r.json()) as { data?: Record<string, unknown>[] };
          for (const p of data.data ?? []) {
            results.push({
              id: `ss_${p.paperId as string}`,
              title: (p.title as string) ?? "",
              authors: ((p.authors as { name: string }[]) ?? [])
                .slice(0, 4)
                .map((a) => a.name),
              year: (p.year as number | null) ?? null,
              abstract: (p.abstract as string) ?? "",
              citationCount: (p.citationCount as number) ?? 0,
              url:
                (p.url as string) ??
                `https://www.semanticscholar.org/paper/${p.paperId as string}`,
              source: "semantic_scholar",
              doi: ((p.externalIds as Record<string, string>) ?? {}).DOI,
              openAccess: (p.isOpenAccess as boolean) ?? false,
            });
          }
        })()
      : Promise.resolve(),

    /* ── OpenAlex ── */
    active.includes("openalex")
      ? (async () => {
          const url =
            `https://api.openalex.org/works?search=${q}` +
            `&per-page=6&sort=cited_by_count:desc&mailto=info@muhakkim.app`;
          const r = await fetch(url, {
            headers: { "User-Agent": "Muhakkim/1.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) throw new Error(`OpenAlex ${r.status}`);
          const data = (await r.json()) as { results?: Record<string, unknown>[] };
          for (const w of data.results ?? []) {
            const authorships = (w.authorships as { author: { display_name: string } }[]) ?? [];
            results.push({
              id: `oa_${(w.id as string).split("/").pop()}`,
              title: (w.title as string) ?? "",
              authors: authorships.slice(0, 4).map((a) => a.author?.display_name ?? ""),
              year: (w.publication_year as number | null) ?? null,
              abstract: reconstructAbstract(
                (w.abstract_inverted_index as Record<string, number[]>) ?? null
              ),
              citationCount: (w.cited_by_count as number) ?? 0,
              url:
                ((w.primary_location as { landing_page_url?: string }) ?? {})
                  .landing_page_url ?? (w.id as string),
              source: "openalex",
              doi: ((w.doi as string) ?? "").replace("https://doi.org/", "") || undefined,
              openAccess: (w.open_access as { is_oa?: boolean })?.is_oa ?? false,
            });
          }
        })()
      : Promise.resolve(),

    /* ── CrossRef ── */
    active.includes("crossref")
      ? (async () => {
          const url =
            `https://api.crossref.org/works?query=${q}` +
            `&rows=6&sort=is-referenced-by-count&order=desc` +
            `&select=title,author,published,abstract,is-referenced-by-count,URL,DOI`;
          const r = await fetch(url, {
            headers: {
              "User-Agent": "Muhakkim/1.0 (mailto:info@muhakkim.app)",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) throw new Error(`CrossRef ${r.status}`);
          const data = (await r.json()) as {
            message?: { items?: Record<string, unknown>[] };
          };
          for (const item of data.message?.items ?? []) {
            const titleArr = item.title as string[] | string | undefined;
            const title = Array.isArray(titleArr) ? titleArr[0] : titleArr ?? "";
            const authors = ((item.author as { given?: string; family?: string }[]) ?? [])
              .slice(0, 4)
              .map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim());
            const yearArr = (item.published as { "date-parts"?: number[][] } | undefined)?.[
              "date-parts"
            ];
            const year = yearArr?.[0]?.[0] ?? null;
            const rawAbstract = (item.abstract as string) ?? "";
            results.push({
              id: `cr_${(item.DOI as string)}`,
              title,
              authors,
              year,
              abstract: rawAbstract.replace(/<[^>]*>/g, "").slice(0, 400),
              citationCount: (item["is-referenced-by-count"] as number) ?? 0,
              url: (item.URL as string) ?? `https://doi.org/${item.DOI as string}`,
              source: "crossref",
              doi: item.DOI as string | undefined,
            });
          }
        })()
      : Promise.resolve(),
  ]).then((settled) => {
    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        const names = ["Semantic Scholar", "OpenAlex", "CrossRef"];
        errors.push(`${names[i]}: ${(r.reason as Error)?.message ?? "failed"}`);
      }
    });
  });

  // Sort by citation count, dedupe by DOI
  const seen = new Set<string>();
  const deduped = results
    .sort((a, b) => b.citationCount - a.citationCount)
    .filter((p) => {
      const key = p.doi ?? p.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  res.json({ results: deduped, errors, total: deduped.length });
});

export default router;
