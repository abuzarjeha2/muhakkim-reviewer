import { useState } from "react";
import { useLanguage } from "../../lib/i18n";

interface Variant { text: string; changeRatio: number; notes: string; }

const STYLES: { key: string; ar: string; en: string; icon: string }[] = [
  { key: "academic", ar: "أكاديمي",  en: "Academic",     icon: "🎓" },
  { key: "simple",   ar: "بسيط",     en: "Simple",       icon: "💡" },
  { key: "formal",   ar: "رسمي",     en: "Formal",       icon: "👔" },
  { key: "concise",  ar: "مختصر",    en: "Concise",      icon: "⚡" },
  { key: "creative", ar: "إبداعي",   en: "Creative",     icon: "🎨" },
];

const GOLD = "#b45309";
const NAVY = "#1e293b";

export default function Paraphraser() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [text, setText] = useState("");
  const [style, setStyle] = useState("academic");
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [error, setError] = useState("");
  const [originalWordCount, setOriginalWordCount] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleRun = async () => {
    setError(""); setVariants([]);
    if (text.trim().split(/\s+/).length < 5) { setError(isAr?"أدخل نصاً (5 كلمات على الأقل)":"Enter text (5+ words)"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/ai/paraphraser", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style, lang, variants: 3 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setVariants(data.variants || []);
      setOriginalWordCount(data.originalWordCount || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "خطأ"); }
    finally { setLoading(false); }
  };

  const copyVariant = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div dir={isAr?"rtl":"ltr"} style={{ padding:"20px 16px 40px" }}>
      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16, boxShadow:"0 2px 12px rgba(30,64,175,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42,height:42, borderRadius:11, background:"linear-gradient(135deg,#C9A84C,#b45309)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔄</div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:900, color:NAVY, margin:0 }}>{isAr?"معيد الصياغة الذكي":"Smart Paraphraser"}</h2>
            <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0" }}>{isAr?"أعد صياغة النص بأساليب مختلفة مع الحفاظ على المعنى":"Rewrite text in different styles while preserving meaning"}</p>
          </div>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?"النص الأصلي":"Original Text"}</label>
        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder={isAr?"الصق النص الذي تريد إعادة صياغته هنا...":"Paste the text you want to paraphrase here..."}
          style={{ width:"100%", minHeight:140, padding:"12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit", lineHeight:1.7, boxSizing:"border-box", resize:"vertical" }} />
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{text.trim().split(/\s+/).filter(Boolean).length} {isAr?"كلمة":"words"}</div>

        <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6, marginTop:14 }}>{isAr?"الأسلوب":"Style"}</label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:8 }}>
          {STYLES.map(s => {
            const active = style === s.key;
            return (
              <button key={s.key} onClick={()=>setStyle(s.key)}
                style={{ background: active?"#fffbeb":"#fff", border: active?"1.5px solid #fde68a":"1.5px solid #e8ecf4", color: active?GOLD:NAVY, borderRadius:9, padding:"10px 8px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:18 }}>{s.icon}</span><span>{isAr?s.ar:s.en}</span>
              </button>
            );
          })}
        </div>

        <button onClick={handleRun} disabled={loading}
          style={{ width:"100%", marginTop:16, background:"linear-gradient(135deg,#C9A84C,#b45309)", border:"none", borderRadius:10, color:"#fff", padding:"12px", fontWeight:800, fontSize:14, cursor:loading?"wait":"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px #C9A84C33", opacity:loading?0.7:1 }}>
          {loading?(isAr?"⏳ جارٍ الصياغة...":"⏳ Paraphrasing..."):(isAr?"🔄 أعد الصياغة":"🔄 Paraphrase")}
        </button>

        {error && <div style={{ marginTop:12, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", borderRadius:8, fontSize:13 }}>{error}</div>}
      </div>

      {variants.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {variants.map((v, i) => {
            const newWordCount = v.text.split(/\s+/).filter(Boolean).length;
            const pct = Math.round(v.changeRatio * 100);
            return (
              <div key={i} style={{ background:"#fff", border:"1.5px solid #fde68a", borderRadius:14, padding:18 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ background:"#fffbeb", color:GOLD, fontSize:12, fontWeight:800, padding:"3px 10px", borderRadius:12 }}>{isAr?`الصيغة ${i+1}`:`Variant ${i+1}`}</span>
                    <span style={{ fontSize:11, color:"#64748b" }}>{newWordCount} {isAr?"كلمة":"words"}</span>
                    <span style={{ fontSize:11, color: pct>50?"#16a34a":pct>30?"#d97706":"#dc2626", fontWeight:700 }}>{pct}% {isAr?"تغيير":"changed"}</span>
                  </div>
                  <button onClick={()=>copyVariant(i, v.text)}
                    style={{ background: copiedIdx===i?"#dcfce7":"#f1f5f9", border:`1px solid ${copiedIdx===i?"#86efac":"#e2e8f0"}`, color: copiedIdx===i?"#16a34a":NAVY, borderRadius:7, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {copiedIdx===i?(isAr?"✓ نُسخ":"✓ Copied"):(isAr?"📋 نسخ":"📋 Copy")}
                  </button>
                </div>
                <div style={{ fontSize:14, lineHeight:1.9, color:NAVY, whiteSpace:"pre-wrap", marginBottom:8 }}>{v.text}</div>
                {v.notes && <div style={{ fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>💡 {v.notes}</div>}
              </div>
            );
          })}
          <div style={{ fontSize:11, color:"#94a3b8", textAlign:"center" }}>{isAr?`النص الأصلي: ${originalWordCount} كلمة`:`Original: ${originalWordCount} words`}</div>
        </div>
      )}
    </div>
  );
}
