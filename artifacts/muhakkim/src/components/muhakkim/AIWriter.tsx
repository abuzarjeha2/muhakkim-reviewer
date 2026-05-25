import { useState } from "react";
import { useLanguage } from "../../lib/i18n";

interface Result { content: string; wordCount: number; }

const TYPES: { key: string; ar: string; en: string; icon: string }[] = [
  { key: "intro",       ar: "مقدمة بحثية",        en: "Introduction",       icon: "📖" },
  { key: "litreview",   ar: "مراجعة أدبيات",      en: "Literature Review",  icon: "📚" },
  { key: "methodology", ar: "المنهجية",            en: "Methodology",        icon: "⚙️" },
  { key: "results",     ar: "عرض النتائج",         en: "Results",            icon: "📊" },
  { key: "discussion",  ar: "مناقشة وتفسير",       en: "Discussion",         icon: "💭" },
  { key: "conclusion",  ar: "خاتمة",                en: "Conclusion",         icon: "🏁" },
  { key: "abstract",    ar: "مستخلص",               en: "Abstract",           icon: "📄" },
  { key: "paragraph",   ar: "فقرة عامة",            en: "General paragraph",  icon: "✍️" },
];

const GOLD = "#b45309";
const NAVY = "#1e293b";

export default function AIWriter() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("intro");
  const [tone, setTone] = useState("academic");
  const [words, setWords] = useState(250);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setError(""); setResult(null);
    if (topic.trim().length < 5) { setError(isAr ? "أدخل موضوعاً (5 أحرف على الأقل)" : "Enter a topic (5+ chars)"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/ai/writer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, type, tone, words, lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "خطأ"); }
    finally { setLoading(false); }
  };

  const copyText = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div dir={isAr?"rtl":"ltr"} style={{ padding: "20px 16px 40px" }}>
      <div style={{ background: "#fff", border: "1.5px solid #e8ecf4", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(30,64,175,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{ width:42,height:42, borderRadius:11, background:"linear-gradient(135deg,#C9A84C,#b45309)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>✍️</div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:900, color:NAVY, margin:0 }}>{isAr?"كاتب أكاديمي ذكي":"AI Academic Writer"}</h2>
            <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0" }}>{isAr?"اكتب فقرات بحثية احترافية بأي أسلوب وطول":"Write professional research paragraphs in any style and length"}</p>
          </div>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?"الموضوع":"Topic"}</label>
        <textarea value={topic} onChange={e=>setTopic(e.target.value)}
          placeholder={isAr?"مثال: تأثير وسائل التواصل الاجتماعي على التحصيل الأكاديمي لطلاب الجامعات":"Example: The impact of social media on academic performance of university students"}
          style={{ width:"100%", minHeight:80, padding:"10px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", resize:"vertical" }} />

        <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6, marginTop:16 }}>{isAr?"نوع المحتوى":"Content type"}</label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8 }}>
          {TYPES.map(t => {
            const active = type === t.key;
            return (
              <button key={t.key} onClick={()=>setType(t.key)}
                style={{ background: active?"#fffbeb":"#fff", border: active?`1.5px solid #fde68a`:"1.5px solid #e8ecf4", color: active?GOLD:NAVY, borderRadius:9, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                <span>{t.icon}</span><span>{isAr?t.ar:t.en}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:16 }}>
          <div>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?"الأسلوب":"Tone"}</label>
            <select value={tone} onChange={e=>setTone(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }}>
              <option value="academic">{isAr?"أكاديمي رصين":"Formal academic"}</option>
              <option value="concise">{isAr?"موجز":"Concise"}</option>
              <option value="detailed">{isAr?"تفصيلي":"Detailed"}</option>
            </select>
          </div>
          <div>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?`الطول (${words} كلمة)`:`Length (${words} words)`}</label>
            <input type="range" min={80} max={800} step={10} value={words} onChange={e=>setWords(parseInt(e.target.value))}
              style={{ width:"100%", accentColor:GOLD }} />
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading}
          style={{ width:"100%", marginTop:16, background:"linear-gradient(135deg,#C9A84C,#b45309)", border:"none", borderRadius:10, color:"#fff", padding:"12px", fontWeight:800, fontSize:14, cursor: loading?"wait":"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px #C9A84C33", opacity: loading?0.7:1 }}>
          {loading ? (isAr?"⏳ جارٍ الكتابة...":"⏳ Writing...") : (isAr?"✨ ولّد النص":"✨ Generate")}
        </button>

        {error && <div style={{ marginTop:12, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", borderRadius:8, fontSize:13 }}>{error}</div>}
      </div>

      {result && (
        <div style={{ background:"#fff", border:"1.5px solid #fde68a", borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14, fontWeight:800, color:GOLD }}>{isAr?"النص المُنتَج":"Generated Text"}</span>
              <span style={{ background:"#fffbeb", color:GOLD, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12 }}>{result.wordCount} {isAr?"كلمة":"words"}</span>
            </div>
            <button onClick={copyText}
              style={{ background: copied?"#dcfce7":"#f1f5f9", border:`1px solid ${copied?"#86efac":"#e2e8f0"}`, color: copied?"#16a34a":NAVY, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {copied?(isAr?"✓ تم النسخ":"✓ Copied"):(isAr?"📋 نسخ":"📋 Copy")}
            </button>
          </div>
          <div style={{ background:"#fafbff", border:"1px solid #eef1f8", borderRadius:10, padding:"14px 16px", fontSize:14, lineHeight:1.9, color:NAVY, whiteSpace:"pre-wrap" }}>
            {result.content}
          </div>
        </div>
      )}
    </div>
  );
}
