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

interface Library {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  color: string;
  homeUrl: string;
  searchUrl?: string;           // if supports query param appended directly
  access: "free" | "institutional" | "mixed";
  lang: "ar" | "en" | "both";
}

// ─── Library catalogue ───────────────────────────────────────────────────────
const ARABIC_LIBS: Library[] = [
  {
    id: "sdl",
    nameAr: "المكتبة الرقمية السعودية",
    nameEn: "Saudi Digital Library",
    descAr: "أكبر مكتبة رقمية عربية — ملايين الكتب والأبحاث والدوريات",
    descEn: "Largest Arab digital library — millions of books, research & journals",
    icon: "🇸🇦",
    color: "#10b981",
    homeUrl: "https://sdl.edu.sa",
    searchUrl: "https://sdl.edu.sa/search?q=",
    access: "institutional",
    lang: "ar",
  },
  {
    id: "ekb",
    nameAr: "بنك المعرفة المصري",
    nameEn: "Egyptian Knowledge Bank",
    descAr: "بوابة المعرفة الوطنية المصرية — بحوث وكتب ودوريات دولية",
    descEn: "Egypt's national knowledge gateway — research, books & international journals",
    icon: "🇪🇬",
    color: "#f59e0b",
    homeUrl: "https://www.ekb.eg",
    searchUrl: "https://www.ekb.eg/search#?q=",
    access: "institutional",
    lang: "both",
  },
  {
    id: "mandumah",
    nameAr: "دار المنظومة",
    nameEn: "Dar Al-Mandumah",
    descAr: "أشمل قاعدة بيانات للرسائل والبحوث العربية والمجلات المحكّمة",
    descEn: "Most comprehensive Arabic theses, research, and peer-reviewed journals database",
    icon: "📖",
    color: "#6366f1",
    homeUrl: "https://search.mandumah.com",
    searchUrl: "https://search.mandumah.com/Search/Results?lookfor=",
    access: "mixed",
    lang: "ar",
  },
  {
    id: "almanhal",
    nameAr: "المنهل",
    nameEn: "Al-Manhal",
    descAr: "منصة للكتب والدوريات والبحوث الأكاديمية العربية والمترجمة",
    descEn: "Platform for Arabic & translated academic books, journals, and research",
    icon: "📚",
    color: "#8b5cf6",
    homeUrl: "https://platform.almanhal.com",
    searchUrl: "https://platform.almanhal.com/Reader/Search?term=",
    access: "mixed",
    lang: "ar",
  },
  {
    id: "nls",
    nameAr: "مكتبة الملك فهد الوطنية",
    nameEn: "King Fahd National Library",
    descAr: "المكتبة الوطنية للمملكة العربية السعودية — فهارس ومراجع وطنية",
    descEn: "Saudi Arabia's national library — national catalogues and references",
    icon: "🏛️",
    color: "#C9A84C",
    homeUrl: "https://www.nls.gov.sa",
    searchUrl: "https://catalogue.nls.gov.sa/cgi-bin/koha/opac-search.pl?q=",
    access: "free",
    lang: "ar",
  },
  {
    id: "marefa",
    nameAr: "موسوعة المعرفة",
    nameEn: "Marefa Encyclopedia",
    descAr: "موسوعة عربية حرة شاملة في جميع المجالات العلمية والثقافية",
    descEn: "Free comprehensive Arabic encyclopedia covering all scientific and cultural fields",
    icon: "🌐",
    color: "#38bdf8",
    homeUrl: "https://www.marefa.org",
    searchUrl: "https://www.marefa.org/index.php?search=",
    access: "free",
    lang: "ar",
  },
  {
    id: "alukah",
    nameAr: "شبكة الألوكة",
    nameEn: "Al-Alukah Network",
    descAr: "مكتبة ثقافية وعلمية شاملة — كتب ومقالات ودراسات متخصصة مجانية",
    descEn: "Comprehensive cultural & scientific library — free books, articles, and studies",
    icon: "📜",
    color: "#34d399",
    homeUrl: "https://www.alukah.net",
    searchUrl: "https://www.alukah.net/search/?q=",
    access: "free",
    lang: "ar",
  },
  {
    id: "jordan_nl",
    nameAr: "المكتبة الوطنية الأردنية",
    nameEn: "Jordan National Library",
    descAr: "مكتبة وطنية أردنية — كتب ومخطوطات وإصدارات رسمية",
    descEn: "Jordan's national library — books, manuscripts, and official publications",
    icon: "🇯🇴",
    color: "#fb923c",
    homeUrl: "https://www.nl.gov.jo",
    access: "free",
    lang: "ar",
  },
];

const ISLAMIC_LIBS: Library[] = [
  {
    id: "shamela",
    nameAr: "المكتبة الشاملة",
    nameEn: "Al-Shamela Library",
    descAr: "أضخم مكتبة إسلامية رقمية مجانية — آلاف الكتب والمراجع الإسلامية",
    descEn: "The largest free Islamic digital library — thousands of Islamic books & references",
    icon: "📗",
    color: "#10b981",
    homeUrl: "https://shamela.ws",
    searchUrl: "https://shamela.ws/search?q=",
    access: "free",
    lang: "ar",
  },
  {
    id: "islamweb",
    nameAr: "مكتبة إسلام ويب",
    nameEn: "IslamWeb Library",
    descAr: "مكتبة إسلامية شاملة مجانية — قرآن، حديث، فقه، تفسير وفتاوى",
    descEn: "Comprehensive free Islamic library — Quran, Hadith, Fiqh, Tafsir & Fatwas",
    icon: "☪️",
    color: "#34d399",
    homeUrl: "https://www.islamweb.net/ar/library/",
    searchUrl: "https://www.islamweb.net/ar/library/index.php?lang=A&src=",
    access: "free",
    lang: "ar",
  },
  {
    id: "dorar",
    nameAr: "الدرر السنية",
    nameEn: "Al-Dorar Al-Saniyya",
    descAr: "موسوعة إسلامية شاملة — فتاوى ومقالات وبحوث شرعية",
    descEn: "Comprehensive Islamic encyclopedia — fatwas, articles, and Sharia research",
    icon: "📿",
    color: "#C9A84C",
    homeUrl: "https://dorar.net",
    searchUrl: "https://dorar.net/search?q=",
    access: "free",
    lang: "ar",
  },
  {
    id: "noor",
    nameAr: "مكتبة نور",
    nameEn: "Noor Library",
    descAr: "مكتبة رقمية مجانية للكتب الإسلامية والعربية — تحميل مباشر",
    descEn: "Free digital library for Islamic and Arabic books — direct download",
    icon: "💡",
    color: "#fbbf24",
    homeUrl: "https://www.noor-book.com",
    searchUrl: "https://www.noor-book.com/?bookName=",
    access: "free",
    lang: "ar",
  },
  {
    id: "waqfeya",
    nameAr: "مكتبة الوقفية",
    nameEn: "Al-Waqfeya Library",
    descAr: "مكتبة وقفية مجانية — كتب ومخطوطات إسلامية نادرة",
    descEn: "Free endowment library — rare Islamic books and manuscripts",
    icon: "🕌",
    color: "#a78bfa",
    homeUrl: "https://www.al-waqfeya.com",
    searchUrl: "https://www.al-waqfeya.com/search/?q=",
    access: "free",
    lang: "ar",
  },
  {
    id: "qurancomplex",
    nameAr: "مجمع الملك فهد لطباعة المصحف",
    nameEn: "King Fahd Quran Printing Complex",
    descAr: "مكتبة إسلامية رقمية رسمية — ترجمات القرآن وإصدارات المجمع",
    descEn: "Official Islamic digital library — Quran translations and complex publications",
    icon: "🕋",
    color: "#10b981",
    homeUrl: "https://qurancomplex.gov.sa",
    access: "free",
    lang: "ar",
  },
];

const INTL_LIBS: Library[] = [
  {
    id: "archive",
    nameAr: "أرشيف الإنترنت",
    nameEn: "Internet Archive",
    descAr: "مستودع رقمي ضخم — ملايين الكتب والأفلام والموسيقى والمواقع مجاناً",
    descEn: "Massive digital repository — millions of free books, films, music, and websites",
    icon: "🗄️",
    color: "#f59e0b",
    homeUrl: "https://archive.org",
    searchUrl: "https://archive.org/search?query=",
    access: "free",
    lang: "both",
  },
  {
    id: "openlibrary",
    nameAr: "المكتبة المفتوحة",
    nameEn: "Open Library",
    descAr: "مكتبة رقمية مفتوحة — ملايين الكتب للاستعارة والقراءة مجاناً",
    descEn: "Open digital library — millions of books to borrow and read for free",
    icon: "📖",
    color: "#6366f1",
    homeUrl: "https://openlibrary.org",
    searchUrl: "https://openlibrary.org/search?q=",
    access: "free",
    lang: "both",
  },
  {
    id: "gutenberg",
    nameAr: "مشروع جوتنبرج",
    nameEn: "Project Gutenberg",
    descAr: "+70,000 كتاب إلكتروني مجاني — كلاسيكيات الأدب والعلوم",
    descEn: "+70,000 free eBooks — classics of literature and science",
    icon: "📜",
    color: "#10b981",
    homeUrl: "https://www.gutenberg.org",
    searchUrl: "https://www.gutenberg.org/ebooks/search/?query=",
    access: "free",
    lang: "en",
  },
  {
    id: "doaj",
    nameAr: "دليل المجلات المفتوحة",
    nameEn: "DOAJ",
    descAr: "دليل المجلات العلمية مفتوحة الوصول — أكثر من 20,000 مجلة مجانية",
    descEn: "Directory of Open Access Journals — 20,000+ free peer-reviewed journals",
    icon: "📰",
    color: "#38bdf8",
    homeUrl: "https://doaj.org",
    searchUrl: "https://doaj.org/search/articles?source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22",
    access: "free",
    lang: "both",
  },
  {
    id: "doab",
    nameAr: "دليل الكتب المفتوحة",
    nameEn: "DOAB",
    descAr: "دليل الكتب الأكاديمية مفتوحة الوصول — كتب علمية مجانية من دور نشر معترف بها",
    descEn: "Directory of Open Access Books — free academic books from verified publishers",
    icon: "📚",
    color: "#8b5cf6",
    homeUrl: "https://www.doabooks.org",
    searchUrl: "https://directory.doabooks.org/search?query=",
    access: "free",
    lang: "both",
  },
  {
    id: "worldcat",
    nameAr: "WorldCat",
    nameEn: "WorldCat",
    descAr: "أكبر فهرس مكتبي في العالم — ابحث في مقتنيات ملايين المكتبات",
    descEn: "World's largest library catalogue — search collections of millions of libraries",
    icon: "🌍",
    color: "#C9A84C",
    homeUrl: "https://www.worldcat.org",
    searchUrl: "https://www.worldcat.org/search?q=",
    access: "free",
    lang: "both",
  },
  {
    id: "hathitrust",
    nameAr: "HathiTrust",
    nameEn: "HathiTrust Digital Library",
    descAr: "مستودع رقمي لأكثر من 17 مليون كتاب ووثيقة أكاديمية",
    descEn: "Digital repository of 17+ million academic books and documents",
    icon: "🐘",
    color: "#34d399",
    homeUrl: "https://www.hathitrust.org",
    searchUrl: "https://catalog.hathitrust.org/Search/Home?lookfor=",
    access: "free",
    lang: "en",
  },
  {
    id: "europeana",
    nameAr: "يوروبيانا",
    nameEn: "Europeana",
    descAr: "منصة التراث الثقافي الأوروبي — ملايين الكتب والصور والمخطوطات",
    descEn: "European cultural heritage platform — millions of books, images & manuscripts",
    icon: "🇪🇺",
    color: "#60a5fa",
    homeUrl: "https://www.europeana.eu",
    searchUrl: "https://www.europeana.eu/en/search?query=",
    access: "free",
    lang: "en",
  },
  {
    id: "base",
    nameAr: "محرك BASE الأكاديمي",
    nameEn: "BASE Academic Search",
    descAr: "محرك بحث أكاديمي — +350 مليون وثيقة من مستودعات مؤسسية ومجلات",
    descEn: "Academic search engine — 350M+ documents from institutional repositories & journals",
    icon: "🔎",
    color: "#fb923c",
    homeUrl: "https://www.base-search.net",
    searchUrl: "https://www.base-search.net/Search/Results?query=",
    access: "free",
    lang: "both",
  },
  {
    id: "eric",
    nameAr: "ERIC التربوية",
    nameEn: "ERIC",
    descAr: "قاعدة بيانات التربية والتعليم — +1.9 مليون بحث تربوي مجاني",
    descEn: "Education resources database — 1.9M+ free education research papers",
    icon: "🎓",
    color: "#a78bfa",
    homeUrl: "https://eric.ed.gov",
    searchUrl: "https://eric.ed.gov/?q=",
    access: "free",
    lang: "en",
  },
  {
    id: "nlm",
    nameAr: "المكتبة الوطنية للطب (NLM)",
    nameEn: "National Library of Medicine",
    descAr: "أكبر مكتبة طبية في العالم — بحوث طبية وعلوم صحية مجانية",
    descEn: "World's largest medical library — free medical research and health sciences",
    icon: "🏥",
    color: "#ef4444",
    homeUrl: "https://www.nlm.nih.gov",
    searchUrl: "https://pubmed.ncbi.nlm.nih.gov/?term=",
    access: "free",
    lang: "en",
  },
  {
    id: "loc",
    nameAr: "مكتبة الكونغرس",
    nameEn: "Library of Congress",
    descAr: "أكبر مكتبة في العالم — ملايين الكتب والوثائق والمخطوطات",
    descEn: "World's largest library — millions of books, documents, and manuscripts",
    icon: "🏛️",
    color: "#38bdf8",
    homeUrl: "https://www.loc.gov",
    searchUrl: "https://www.loc.gov/search/?q=",
    access: "free",
    lang: "both",
  },
];

// ─── Research platforms ───────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "consensus",    nameAr: "Consensus",        nameEn: "Consensus",        icon: "🧠", color: "#6366f1", url: "https://consensus.app/search/?q=" },
  { id: "perplexity",   nameAr: "Perplexity",       nameEn: "Perplexity",       icon: "✨", color: "#3b82f6", url: "https://www.perplexity.ai/search?q=" },
  { id: "scholar",      nameAr: "Google Scholar",   nameEn: "Google Scholar",   icon: "🎓", color: "#10b981", url: "https://scholar.google.com/scholar?q=" },
  { id: "semscholar",   nameAr: "Semantic Scholar", nameEn: "Semantic Scholar", icon: "📚", color: "#C9A84C", url: "https://www.semanticscholar.org/search?q=" },
  { id: "arxiv",        nameAr: "arXiv",            nameEn: "arXiv",            icon: "📄", color: "#f59e0b", url: "https://arxiv.org/search/?searchtype=all&query=" },
  { id: "pubmed",       nameAr: "PubMed",           nameEn: "PubMed",           icon: "🔬", color: "#ef4444", url: "https://pubmed.ncbi.nlm.nih.gov/?term=" },
  { id: "core",         nameAr: "CORE",             nameEn: "CORE",             icon: "🌐", color: "#8b5cf6", url: "https://core.ac.uk/search?q=" },
  { id: "researchgate", nameAr: "ResearchGate",     nameEn: "ResearchGate",     icon: "🏛️", color: "#38bdf8", url: "https://www.researchgate.net/search?q=" },
  { id: "scite",        nameAr: "Scite",            nameEn: "Scite",            icon: "🔗", color: "#a78bfa", url: "https://scite.ai/search?q=" },
  { id: "openalex",     nameAr: "OpenAlex",         nameEn: "OpenAlex",         icon: "🗂️", color: "#34d399", url: "https://openalex.org/works?filter=default.search:" },
];

const SOURCE_META: Record<Paper["source"], { label: string; color: string; bg: string }> = {
  semantic_scholar: { label: "Semantic Scholar", color: "#C9A84C", bg: "#C9A84C18" },
  openalex:         { label: "OpenAlex",         color: "#34d399", bg: "#34d39918" },
  crossref:         { label: "CrossRef",         color: "#60a5fa", bg: "#60a5fa18" },
};
const SOURCES_LIST: Paper["source"][] = ["semantic_scholar", "openalex", "crossref"];

const ACCESS_BADGE: Record<Library["access"], { ar: string; en: string; color: string }> = {
  free:          { ar: "مجاني",          en: "Free",        color: "#10b981" },
  institutional: { ar: "مؤسسي",          en: "Institutional", color: "#f59e0b" },
  mixed:         { ar: "مجاني / مؤسسي", en: "Mixed",       color: "#60a5fa" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ResearchSearch() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAr = lang === "ar";

  // Main tabs: search | libraries
  const [mainTab, setMainTab] = useState<"search" | "libraries">("search");
  // Libraries sub-category
  const [libCat, setLibCat] = useState<"arabic" | "islamic" | "intl">("arabic");

  // Search state
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<Paper[]>([]);
  const [errors, setErrors]       = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<Paper["source"]>>(new Set(SOURCES_LIST));

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

  const openUrl = (url: string, searchable = false) => {
    if (searchable && !query.trim()) {
      toast({ title: isAr ? "اكتب استعلاماً أولاً" : "Type a query first", variant: "destructive" });
      return;
    }
    const finalUrl = searchable ? url + encodeURIComponent(query.trim()) : url;
    window.open(finalUrl, "_blank", "noopener");
  };

  const runSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 3) {
      toast({ title: isAr ? "يجب أن يكون البحث ٣ أحرف على الأقل" : "Query must be at least 3 characters", variant: "destructive" });
      return;
    }
    setLoading(true); setHasSearched(true); setResults([]); setErrors([]);
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sources: [...activeSources] }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json() as { results: Paper[]; errors: string[] };
      setResults(data.results ?? []);
      setErrors(data.errors ?? []);
    } catch {
      toast({ title: isAr ? "فشل الاتصال بالخادم" : "Connection failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [query, activeSources, isAr, toast]);

  // ── Shared styles ────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: "#0e1829", border: "1px solid #ffffff0e", borderRadius: 14 };
  const sectionLabel: React.CSSProperties = { color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 };

  const mainTabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, background: active ? "linear-gradient(135deg,#C9A84C22,#C9A84C11)" : "transparent",
    border: `1px solid ${active ? "#C9A84C44" : "transparent"}`,
    borderRadius: 10, padding: "10px", color: active ? "#C9A84C" : "#475569",
    fontWeight: active ? 800 : 500, fontSize: 13, cursor: "pointer",
    transition: "all .18s", fontFamily: "inherit",
  });

  const catBtn = (active: boolean, color: string): React.CSSProperties => ({
    background: active ? color + "22" : "#060d1a",
    border: `1px solid ${active ? color + "55" : "#ffffff0d"}`,
    borderRadius: 8, padding: "6px 14px",
    color: active ? color : "#475569",
    fontWeight: active ? 700 : 500,
    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  });

  // ── Library card renderer ────────────────────────────────────────────────
  const LibCard = ({ lib }: { lib: Library }) => {
    const badge = ACCESS_BADGE[lib.access];
    return (
      <div style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: lib.color + "18", border: `1px solid ${lib.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>{lib.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, lineHeight: 1.4, marginBottom: 2 }}>
              {isAr ? lib.nameAr : lib.nameEn}
            </div>
            <span style={{
              background: badge.color + "18", color: badge.color,
              border: `1px solid ${badge.color}33`,
              borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700,
            }}>
              {isAr ? badge.ar : badge.en}
            </span>
          </div>
        </div>
        {/* Description */}
        <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.65, margin: 0 }}>
          {isAr ? lib.descAr : lib.descEn}
        </p>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {lib.searchUrl && (
            <button
              onClick={() => openUrl(lib.searchUrl!, true)}
              style={{
                background: lib.color + "18", color: lib.color,
                border: `1px solid ${lib.color}33`,
                borderRadius: 7, padding: "5px 12px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {isAr ? "🔍 بحث فيها" : "🔍 Search"}
            </button>
          )}
          <button
            onClick={() => openUrl(lib.homeUrl)}
            style={{
              background: "transparent", color: "#475569",
              border: "1px solid #ffffff11",
              borderRadius: 7, padding: "5px 12px", fontSize: 11,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {isAr ? "↗ زيارة" : "↗ Visit"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 18px 60px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── Header ── */}
      <h2 style={{ color: "#C9A84C", fontWeight: 900, fontSize: 18, margin: "0 0 4px" }}>
        🔭 {isAr ? "البحث العلمي والمكتبات الرقمية" : "Research & Digital Libraries"}
      </h2>
      <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px", lineHeight: 1.7 }}>
        {isAr
          ? "ابحث في ملايين الأوراق البحثية أو استعرض المكتبات الرقمية العربية والإسلامية والدولية"
          : "Search millions of research papers or browse Arabic, Islamic, and international digital libraries"}
      </p>

      {/* ── Main tab bar ── */}
      <div style={{ display: "flex", gap: 6, background: "#060d1a", borderRadius: 12, padding: 5, border: "1px solid #ffffff08", marginBottom: 20 }}>
        <button style={mainTabBtn(mainTab === "search")}    onClick={() => setMainTab("search")}>
          🔍 {isAr ? "بحث أكاديمي" : "Academic Search"}
        </button>
        <button style={mainTabBtn(mainTab === "libraries")} onClick={() => setMainTab("libraries")}>
          📚 {isAr ? "المكتبات الرقمية" : "Digital Libraries"}
        </button>
      </div>

      {/* ══════════════════ SEARCH TAB ══════════════════ */}
      {mainTab === "search" && (
        <>
          {/* Search bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
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
              }}
              onFocus={e => (e.target.style.borderColor = "#C9A84C55")}
              onBlur={e => (e.target.style.borderColor = "#ffffff18")}
            />
            <button
              onClick={runSearch} disabled={loading}
              style={{
                background: "linear-gradient(135deg,#C9A84C,#a07830)", border: "none",
                borderRadius: 12, color: "#080e1c", fontWeight: 800, fontSize: 13,
                padding: "12px 22px", cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", flexShrink: 0, opacity: loading ? 0.75 : 1,
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: "0 4px 18px #C9A84C33",
              }}
            >
              {loading
                ? <><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #080e1c44", borderTopColor: "#080e1c", borderRadius: "50%", animation: "spin .7s linear infinite" }} />{isAr ? " جاري…" : " Searching…"}</>
                : isAr ? "🔍 بحث" : "🔍 Search"
              }
            </button>
          </div>

          {/* Source filters */}
          <div style={{ marginBottom: 18 }}>
            <p style={sectionLabel}>{isAr ? "مصادر البحث الداخلي" : "In-app sources"}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SOURCES_LIST.map(src => {
                const m = SOURCE_META[src];
                return (
                  <button key={src} onClick={() => toggleSource(src)} style={{
                    background: activeSources.has(src) ? m.color + "22" : "#060d1a",
                    border: `1px solid ${activeSources.has(src) ? m.color + "66" : "#ffffff11"}`,
                    borderRadius: 8, padding: "5px 12px",
                    color: activeSources.has(src) ? m.color : "#475569",
                    fontWeight: activeSources.has(src) ? 700 : 500,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}>{m.label}</button>
                );
              })}
            </div>
          </div>

          {/* Research platforms */}
          <div style={{ ...card, marginBottom: 22, padding: "16px 18px" }}>
            <p style={sectionLabel}>{isAr ? "فتح في منصات بحثية خارجية" : "Open in external research platforms"}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => openUrl(p.url, true)}
                  style={{ background: p.color + "15", border: `1px solid ${p.color}33`, borderRadius: 9, padding: "7px 13px", color: p.color, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{p.icon}</span><span>{isAr ? p.nameAr : p.nameEn}</span><span style={{ fontSize: 9, opacity: 0.5 }}>↗</span>
                </button>
              ))}
            </div>
            {!query.trim() && <p style={{ color: "#1e2e40", fontSize: 11, marginTop: 8 }}>
              {isAr ? "💡 اكتب استعلاماً أولاً لفتح نتائجه في أي منصة" : "💡 Type a query first to open results in any platform"}
            </p>}
          </div>

          {/* Results */}
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12, animation: "pulse 1.5s ease infinite" }}>🔭</div>
              <p style={{ color: "#C9A84C", fontWeight: 700 }}>{isAr ? "جاري البحث في المصادر العلمية…" : "Searching scientific sources…"}</p>
              <p style={{ color: "#334155", fontSize: 12, marginTop: 4 }}>Semantic Scholar · OpenAlex · CrossRef</p>
            </div>
          )}
          {!loading && errors.length > 0 && (
            <div style={{ background: "#1f0a0a", border: "1px solid #ef444422", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ color: "#f87171", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ {isAr ? "مصادر لم تستجب:" : "Sources that failed:"}</p>
              {errors.map((e, i) => <p key={i} style={{ color: "#64748b", fontSize: 11 }}>• {e}</p>)}
            </div>
          )}
          {!loading && hasSearched && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <p style={{ color: "#64748b", fontWeight: 600 }}>{isAr ? "لا نتائج. جرّب استعلاماً مختلفاً." : "No results. Try a different query."}</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div>
              <p style={{ color: "#475569", fontSize: 12, marginBottom: 12 }}>{isAr ? `وُجد ${results.length} نتيجة` : `Found ${results.length} results`}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {results.map(paper => {
                  const m = SOURCE_META[paper.source];
                  const isOpen = expanded.has(paper.id);
                  const hasAbstract = paper.abstract.trim().length > 0;
                  return (
                    <div key={paper.id} style={{ ...card, border: `1px solid ${m.color}22`, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ background: m.bg, color: m.color, borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{m.label}</span>
                        {paper.year && <span style={{ color: "#475569", fontSize: 11 }}>{paper.year}</span>}
                        {paper.openAccess && <span style={{ background: "#10b98118", color: "#10b981", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>🔓 Open Access</span>}
                        <span style={{ color: "#334155", fontSize: 11, marginInlineStart: "auto" }}>📊 {paper.citationCount.toLocaleString()} {isAr ? "اقتباس" : "cit."}</span>
                      </div>
                      <a href={paper.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, lineHeight: 1.5, textDecoration: "none", display: "block", marginBottom: 5 }}
                        onMouseEnter={e => (e.currentTarget.style.color = m.color)}
                        onMouseLeave={e => (e.currentTarget.style.color = "#e2e8f0")}>
                        {paper.title || (isAr ? "(بدون عنوان)" : "(No title)")}
                      </a>
                      {paper.authors.length > 0 && (
                        <p style={{ color: "#475569", fontSize: 11, marginBottom: hasAbstract ? 8 : 0 }}>👤 {paper.authors.join(" · ")}{paper.authors.length >= 4 ? " …" : ""}</p>
                      )}
                      {hasAbstract && (
                        <>
                          <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.7, maxHeight: isOpen ? "none" : 56, overflow: "hidden", marginBottom: 4 }}>{paper.abstract}</p>
                          <button onClick={() => toggleExpand(paper.id)}
                            style={{ background: "transparent", border: "none", color: m.color, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                            {isOpen ? (isAr ? "▲ طيّ" : "▲ Collapse") : (isAr ? "▼ الملخص" : "▼ Abstract")}
                          </button>
                        </>
                      )}
                      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                        <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ color: m.color, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>{isAr ? "↗ افتح الورقة" : "↗ Open paper"}</a>
                        {paper.doi && <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: "#334155", fontSize: 11, textDecoration: "none" }}>DOI ↗</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!hasSearched && !loading && (
            <div style={{ textAlign: "center", padding: "44px 16px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔭</div>
              <h3 style={{ color: "#C9A84C", fontWeight: 800, fontSize: 16, margin: "0 0 6px" }}>{isAr ? "ابحث في ملايين الأوراق البحثية" : "Search millions of research papers"}</h3>
              <p style={{ color: "#334155", fontSize: 13, lineHeight: 1.8, maxWidth: 400, margin: "0 auto 20px" }}>
                {isAr ? "يستعلم محكّم في ٣ قواعد بيانات علمية مجانية في آنٍ واحد" : "Muhakkim queries 3 free scientific databases simultaneously"}
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
                {[["Semantic Scholar", "+200M", "#C9A84C"], ["OpenAlex", "+250M", "#34d399"], ["CrossRef", "+150M", "#60a5fa"]].map(([n, s, c]) => (
                  <div key={n} style={{ textAlign: "center" }}>
                    <div style={{ color: c, fontWeight: 900, fontSize: 17 }}>{s}</div>
                    <div style={{ color: "#334155", fontSize: 11, marginTop: 2 }}>{n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════ LIBRARIES TAB ══════════════════ */}
      {mainTab === "libraries" && (
        <>
          {/* Query bar — still useful for "search in this library" */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isAr ? "اكتب موضوعاً للبحث في المكتبات…" : "Type a topic to search within libraries…"}
              style={{
                flex: 1, background: "#060d1a", border: "1.5px solid #ffffff18",
                borderRadius: 12, color: "#e2e8f0", fontSize: 13,
                padding: "10px 14px", fontFamily: "inherit", outline: "none",
                textAlign: isAr ? "right" : "left",
              }}
              onFocus={e => (e.target.style.borderColor = "#C9A84C55")}
              onBlur={e => (e.target.style.borderColor = "#ffffff18")}
            />
          </div>
          {!query.trim() && (
            <p style={{ color: "#334155", fontSize: 12, marginBottom: 14 }}>
              💡 {isAr ? "اكتب موضوعاً لتفعيل زر «بحث فيها» في كل مكتبة" : "Type a topic to enable «Search» button in each library"}
            </p>
          )}

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <button style={catBtn(libCat === "arabic",  "#C9A84C")} onClick={() => setLibCat("arabic")}>
              🇸🇦 {isAr ? "مكتبات عربية" : "Arabic Libraries"}
              <span style={{ marginInlineStart: 6, background: "#C9A84C22", borderRadius: 5, padding: "1px 6px", fontSize: 10 }}>{ARABIC_LIBS.length}</span>
            </button>
            <button style={catBtn(libCat === "islamic", "#10b981")} onClick={() => setLibCat("islamic")}>
              ☪️ {isAr ? "مكتبات إسلامية" : "Islamic Libraries"}
              <span style={{ marginInlineStart: 6, background: "#10b98122", borderRadius: 5, padding: "1px 6px", fontSize: 10 }}>{ISLAMIC_LIBS.length}</span>
            </button>
            <button style={catBtn(libCat === "intl",    "#60a5fa")} onClick={() => setLibCat("intl")}>
              🌍 {isAr ? "مكتبات دولية" : "International"}
              <span style={{ marginInlineStart: 6, background: "#60a5fa22", borderRadius: 5, padding: "1px 6px", fontSize: 10 }}>{INTL_LIBS.length}</span>
            </button>
          </div>

          {/* Library grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {(libCat === "arabic" ? ARABIC_LIBS : libCat === "islamic" ? ISLAMIC_LIBS : INTL_LIBS).map(lib => (
              <LibCard key={lib.id} lib={lib} />
            ))}
          </div>

          {/* Note about institutional */}
          <div style={{ marginTop: 18, background: "#0a1220", border: "1px solid #f59e0b22", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ color: "#78716c", fontSize: 12, lineHeight: 1.7, margin: 0 }}>
              <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚠️ {isAr ? "ملاحظة:" : "Note:"} </span>
              {isAr
                ? "المكتبات المصنّفة «مؤسسي» تتطلب اشتراك جامعتك أو مؤسستك. تواصل مع مكتبة مؤسستك للحصول على بيانات الدخول."
                : "Libraries marked «Institutional» require your university or institution subscription. Contact your library for access credentials."}
            </p>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
