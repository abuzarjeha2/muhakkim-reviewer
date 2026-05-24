import { useState, useCallback } from "react";
import { useLanguage } from "../../lib/i18n";
import { useToast } from "../../hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── External platforms ──────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "consensus",       nameAr: "Consensus",       nameEn: "Consensus",       icon: "🧠", color: "#6366f1", url: "https://consensus.app/search/?q=" },
  { id: "perplexity",      nameAr: "Perplexity",      nameEn: "Perplexity",      icon: "✨", color: "#3b82f6", url: "https://www.perplexity.ai/search?q=" },
  { id: "scholar",         nameAr: "Google Scholar",  nameEn: "Google Scholar",  icon: "🎓", color: "#10b981", url: "https://scholar.google.com/scholar?q=" },
  { id: "semscholar",      nameAr: "Semantic Scholar", nameEn: "Semantic Scholar",icon: "📚", color: "#C9A84C", url: "https://www.semanticscholar.org/search?q=" },
  { id: "arxiv",           nameAr: "arXiv",           nameEn: "arXiv",           icon: "📄", color: "#f59e0b", url: "https://arxiv.org/search/?searchtype=all&query=" },
  { id: "pubmed",          nameAr: "PubMed",          nameEn: "PubMed",          icon: "🔬", color: "#ef4444", url: "https://pubmed.ncbi.nlm.nih.gov/?term=" },
  { id: "core",            nameAr: "CORE",            nameEn: "CORE",            icon: "🌐", color: "#8b5cf6", url: "https://core.ac.uk/search?q=" },
  { id: "researchgate",    nameAr: "ResearchGate",    nameEn: "ResearchGate",    icon: "🏛️", color: "#38bdf8", url: "https://www.researchgate.net/search?q=" },
  { id: "scite",           nameAr: "Scite",           nameEn: "Scite",           icon: "🔗", color: "#a78bfa", url: "https://scite.ai/search?q=" },
  { id: "openalex",        nameAr: "OpenAlex",        nameEn: "OpenAlex",        icon: "🗂️", color: "#34d399", url: "https://openalex.org/works?filter=default.search:" },
];

const SOURCE_META: Record<Paper["source"], { label: string; color: string; bg: string }> = {
  semantic_scholar: { label: "Semantic Scholar", color: "#C9A84C", bg: "#C9A84C18" },
  openalex:         { label: "OpenAlex",         color: "#34d399", bg: "#34d39918" },
  crossref:         { label: "CrossRef",         color: "#60a5fa", bg: "#60a5fa18" },
};

const SOURCES_LIST: Paper["source"][] = ["semantic_scholar", "openalex", "crossref"];

// ─── Component ───────────────────────────────────────────────────────────────
export default function ResearchSearch() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAr = lang === "ar";

  const [query, setQuery]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<Paper[]>([]);
  const [errors, setErrors]         = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<Paper["source"]>>(
    new Set(SOURCES_LIST)
  );

  const toggleSource = (s: Paper["source"]) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(s)) { if (next.size > 1) next.delete(s); }
      else next.add(s);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openPlatform = (baseUrl: string) => {
    if (!query.trim()) {
      toast({ title: isAr ? "اكتب استعلاماً أولاً" : "Type a query first", variant: "destructive" });
      return;
    }
    window.open(baseUrl + encodeURIComponent(query.trim()), "_blank", "noopener");
  };

  const runSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 3) {
      toast({ title: isAr ? "يجب أن يكون البحث 3 أحرف على الأقل" : "Query must be at least 3 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setErrors([]);
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources: [...activeSources] }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json() as { results: Paper[]; errors: string[]; total: number };
      setResults(data.results ?? []);
      setErrors(data.errors ?? []);
    } catch {
      toast({ title: isAr ? "فشل الاتصال بالخادم" : "Connection failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [query, activeSources, isAr, toast]);

  const s = {
    card: {
      background: "#0e1829",
      border: "1px solid #ffffff0e",
      borderRadius: 16,
      overflow: "hidden" as const,
    } as React.CSSProperties,
    section: { padding: "22px 20px" } as React.CSSProperties,
    label: { color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 },
    chip: (active: boolean, color: string): React.CSSProperties => ({
      background: active ? color + "22" : "#060d1a",
      border: `1px solid ${active ? color + "66" : "#ffffff11"}`,
      borderRadius: 8, padding: "5px 12px",
      color: active ? color : "#475569",
      fontWeight: active ? 700 : 500,
      fontSize: 11, cursor: "pointer", transition: "all .15s",
      fontFamily: "inherit", flexShrink: 0,
    }),
  };

  return (
    <div style={{ padding: "20px 20px 60px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── Section Title ── */}
      <h2 style={{ color: "#C9A84C", fontWeight: 900, fontSize: 18, margin: "0 0 4px" }}>
        🔭 {isAr ? "البحث في المصادر العلمية" : "Search Scientific Sources"}
      </h2>
      <p style={{ color: "#475569", fontSize: 13, margin: "0 0 22px", lineHeight: 1.7 }}>
        {isAr
          ? "ابحث داخل التطبيق عبر Semantic Scholar وOpenAlex وCrossRef، أو افتح المنصات الخارجية مباشرة"
          : "Search in-app via Semantic Scholar, OpenAlex & CrossRef, or open external platforms directly"}
      </p>

      {/* ── Search bar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
          placeholder={isAr ? "ابحث عن ورقة بحثية، موضوع، أو مؤلف…" : "Search for a paper, topic, or author…"}
          style={{
            flex: 1, background: "#060d1a", border: "1.5px solid #ffffff18",
            borderRadius: 12, color: "#e2e8f0", fontSize: 14,
            padding: "12px 16px", fontFamily: "inherit", outline: "none",
            textAlign: isAr ? "right" : "left",
            transition: "border-color .15s",
          }}
          onFocus={e => (e.target.style.borderColor = "#C9A84C55")}
          onBlur={e => (e.target.style.borderColor = "#ffffff18")}
        />
        <button
          onClick={runSearch}
          disabled={loading}
          style={{
            background: "linear-gradient(135deg,#C9A84C,#a07830)",
            border: "none", borderRadius: 12,
            color: "#080e1c", fontWeight: 800, fontSize: 13,
            padding: "12px 22px", cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", flexShrink: 0,
            opacity: loading ? 0.75 : 1,
            display: "flex", alignItems: "center", gap: 7,
            boxShadow: "0 4px 18px #C9A84C33",
          }}
        >
          {loading
            ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #080e1c44", borderTopColor: "#080e1c", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> {isAr ? "جاري…" : "Searching…"}</>
            : <>{isAr ? "🔍 بحث" : "🔍 Search"}</>
          }
        </button>
      </div>

      {/* ── Source filters ── */}
      <div style={{ marginBottom: 20 }}>
        <p style={s.label}>{isAr ? "مصادر البحث الداخلي" : "In-app sources"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SOURCES_LIST.map(src => {
            const m = SOURCE_META[src];
            return (
              <button key={src} onClick={() => toggleSource(src)} style={s.chip(activeSources.has(src), m.color)}>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── External platforms ── */}
      <div style={{ ...s.card, marginBottom: 24 }}>
        <div style={s.section}>
          <p style={s.label}>{isAr ? "فتح في منصات بحثية خارجية" : "Open in external research platforms"}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => openPlatform(p.url)}
                title={isAr ? `فتح "${query || "البحث"}" في ${p.nameAr}` : `Open in ${p.nameEn}`}
                style={{
                  background: p.color + "15",
                  border: `1px solid ${p.color}33`,
                  borderRadius: 10, padding: "8px 14px",
                  color: p.color, fontWeight: 700, fontSize: 12,
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all .15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = p.color + "28";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = p.color + "66";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = p.color + "15";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = p.color + "33";
                }}
              >
                <span>{p.icon}</span>
                <span>{isAr ? p.nameAr : p.nameEn}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
              </button>
            ))}
          </div>
          {!query.trim() && (
            <p style={{ color: "#334155", fontSize: 11, marginTop: 10 }}>
              {isAr ? "💡 اكتب استعلاماً ثم اضغط أي زر لفتح النتائج مباشرة" : "💡 Type a query then click any button to open results directly"}
            </p>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: "pulse 1.5s ease infinite" }}>🔭</div>
          <p style={{ color: "#C9A84C", fontWeight: 700 }}>
            {isAr ? "جاري البحث في المصادر العلمية…" : "Searching scientific sources…"}
          </p>
          <p style={{ color: "#334155", fontSize: 12, marginTop: 4 }}>
            Semantic Scholar · OpenAlex · CrossRef
          </p>
        </div>
      )}

      {!loading && errors.length > 0 && (
        <div style={{ background: "#1f0a0a", border: "1px solid #ef444422", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ color: "#f87171", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            ⚠️ {isAr ? "مصادر لم تستجب:" : "Sources that failed:"}
          </p>
          {errors.map((e, i) => <p key={i} style={{ color: "#64748b", fontSize: 11 }}>• {e}</p>)}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <p style={{ color: "#64748b", fontWeight: 600 }}>
            {isAr ? "لا نتائج. جرّب استعلاماً مختلفاً أو افتح منصة خارجية" : "No results. Try a different query or open an external platform."}
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div>
          <p style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>
            {isAr ? `وُجد ${results.length} نتيجة` : `Found ${results.length} results`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map(paper => {
              const m = SOURCE_META[paper.source];
              const isOpen = expanded.has(paper.id);
              const hasAbstract = paper.abstract.trim().length > 0;
              return (
                <div key={paper.id} style={{ ...s.card, border: `1px solid ${m.color}22` }}>
                  <div style={{ padding: "16px 18px" }}>
                    {/* Source + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ background: m.bg, color: m.color, borderRadius: 6, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>
                        {m.label}
                      </span>
                      {paper.year && (
                        <span style={{ color: "#475569", fontSize: 11 }}>{paper.year}</span>
                      )}
                      {paper.openAccess && (
                        <span style={{ background: "#10b98118", color: "#10b981", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                          🔓 Open Access
                        </span>
                      )}
                      <span style={{ color: "#334155", fontSize: 11, marginInlineStart: "auto" }}>
                        📊 {paper.citationCount.toLocaleString()} {isAr ? "اقتباس" : "citations"}
                      </span>
                    </div>

                    {/* Title */}
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#e2e8f0", fontWeight: 700, fontSize: 14, lineHeight: 1.5,
                        textDecoration: "none", display: "block", marginBottom: 6,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = m.color)}
                      onMouseLeave={e => (e.currentTarget.style.color = "#e2e8f0")}
                    >
                      {paper.title || (isAr ? "(بدون عنوان)" : "(No title)")}
                    </a>

                    {/* Authors */}
                    {paper.authors.length > 0 && (
                      <p style={{ color: "#475569", fontSize: 12, marginBottom: hasAbstract ? 10 : 0, lineHeight: 1.6 }}>
                        👤 {paper.authors.join(" · ")}{paper.authors.length >= 4 ? " …" : ""}
                      </p>
                    )}

                    {/* Abstract toggle */}
                    {hasAbstract && (
                      <div>
                        <p
                          style={{
                            color: "#64748b", fontSize: 12, lineHeight: 1.75,
                            maxHeight: isOpen ? "none" : 60,
                            overflow: "hidden",
                            marginBottom: 6,
                          }}
                        >
                          {paper.abstract}
                        </p>
                        <button
                          onClick={() => toggleExpand(paper.id)}
                          style={{
                            background: "transparent", border: "none",
                            color: m.color, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", padding: 0, fontFamily: "inherit",
                          }}
                        >
                          {isOpen
                            ? (isAr ? "▲ طيّ الملخص" : "▲ Collapse abstract")
                            : (isAr ? "▼ قراءة الملخص" : "▼ Read abstract")}
                        </button>
                      </div>
                    )}

                    {/* Footer links */}
                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      <a href={paper.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: m.color, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        {isAr ? "↗ افتح الورقة" : "↗ Open paper"}
                      </a>
                      {paper.doi && (
                        <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "#475569", fontSize: 12, textDecoration: "none" }}>
                          DOI: {paper.doi.slice(0, 30)}{paper.doi.length > 30 ? "…" : ""}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hasSearched && !loading && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔭</div>
          <h3 style={{ color: "#C9A84C", fontWeight: 800, fontSize: 17, margin: "0 0 8px" }}>
            {isAr ? "ابحث في ملايين الأوراق البحثية" : "Search millions of research papers"}
          </h3>
          <p style={{ color: "#334155", fontSize: 13, lineHeight: 1.8, maxWidth: 420, margin: "0 auto" }}>
            {isAr
              ? "يستعلم محكّم في ٣ قواعد بيانات علمية مجانية في وقت واحد: Semantic Scholar وOpenAlex وCrossRef"
              : "Muhakkim queries 3 free scientific databases simultaneously: Semantic Scholar, OpenAlex, and CrossRef"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
            {[
              { name: "Semantic Scholar", stat: "+200M", color: "#C9A84C" },
              { name: "OpenAlex",         stat: "+250M", color: "#34d399" },
              { name: "CrossRef",         stat: "+150M", color: "#60a5fa" },
            ].map(db => (
              <div key={db.name} style={{ textAlign: "center" }}>
                <div style={{ color: db.color, fontWeight: 900, fontSize: 18 }}>{db.stat}</div>
                <div style={{ color: "#334155", fontSize: 11, marginTop: 2 }}>{db.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
