import { useState } from "react";
import { useLanguage } from "../../lib/i18n";

interface Topic { title: string; rationale: string; variables: string; method: string; feasibility: string; novelty: number; }

const GOLD = "#b45309";
const NAVY = "#1e293b";

export default function FindTopics() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [field, setField] = useState("");
  const [level, setLevel] = useState<"masters" | "phd">("masters");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleFind = async () => {
    setError(""); setTopics([]);
    if (field.trim().length < 3) { setError(isAr?"أدخل التخصص":"Enter field"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/ai/topics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, level, keywords, lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setTopics(data.topics || []);
    } catch (e) { setError(e instanceof Error ? e.message : "خطأ"); }
    finally { setLoading(false); }
  };

  const copyTitle = (idx: number, title: string) => {
    navigator.clipboard.writeText(title);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const feasColor = (f: string) => {
    const fl = f.toLowerCase();
    if (fl.includes("سهل") || fl.includes("easy")) return "#16a34a";
    if (fl.includes("متقدم") || fl.includes("advanced") || fl.includes("hard")) return "#dc2626";
    return "#d97706";
  };

  return (
    <div dir={isAr?"rtl":"ltr"} style={{ padding:"20px 16px 40px" }}>
      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16, boxShadow:"0 2px 12px rgba(30,64,175,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42,height:42, borderRadius:11, background:"linear-gradient(135deg,#C9A84C,#b45309)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎯</div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:900, color:NAVY, margin:0 }}>{isAr?"اكتشف موضوعات بحثية":"Find Research Topics"}</h2>
            <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0" }}>{isAr?"١٠ موضوعات مقترحة بناءً على تخصصك واهتماماتك":"10 suggested topics based on your field and interests"}</p>
          </div>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
          <div>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?"التخصص":"Field"}</label>
            <input value={field} onChange={e=>setField(e.target.value)}
              placeholder={isAr?"مثال: علم النفس التربوي":"e.g.: Educational Psychology"}
              style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6 }}>{isAr?"الدرجة":"Level"}</label>
            <select value={level} onChange={e=>setLevel(e.target.value as "masters"|"phd")}
              style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }}>
              <option value="masters">{isAr?"ماجستير":"Master's"}</option>
              <option value="phd">{isAr?"دكتوراه":"PhD"}</option>
            </select>
          </div>
        </div>

        <label style={{ display:"block", fontSize:13, fontWeight:700, color:NAVY, marginBottom:6, marginTop:12 }}>{isAr?"الكلمات المفتاحية أو الاهتمامات (اختياري)":"Keywords or interests (optional)"}</label>
        <input value={keywords} onChange={e=>setKeywords(e.target.value)}
          placeholder={isAr?"مثال: التعلم الإلكتروني، الدافعية، طلاب الجامعات":"e.g.: e-learning, motivation, university students"}
          style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />

        <button onClick={handleFind} disabled={loading}
          style={{ width:"100%", marginTop:16, background:"linear-gradient(135deg,#C9A84C,#b45309)", border:"none", borderRadius:10, color:"#fff", padding:"12px", fontWeight:800, fontSize:14, cursor:loading?"wait":"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px #C9A84C33", opacity:loading?0.7:1 }}>
          {loading?(isAr?"⏳ جارٍ البحث...":"⏳ Searching..."):(isAr?"🔍 اقترح موضوعات":"🔍 Suggest topics")}
        </button>

        {error && <div style={{ marginTop:12, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", borderRadius:8, fontSize:13 }}>{error}</div>}
      </div>

      {topics.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {topics.map((t, i) => (
            <div key={i} style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:13, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.03)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:8 }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start", flex:1 }}>
                  <div style={{ width:28,height:28, borderRadius:8, background:"#fffbeb", border:"1.5px solid #fde68a", display:"flex", alignItems:"center", justifyContent:"center", color:GOLD, fontWeight:800, fontSize:13, flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <h3 style={{ fontSize:14, fontWeight:800, color:NAVY, margin:"0 0 6px", lineHeight:1.5 }}>{t.title}</h3>
                    <p style={{ fontSize:12, color:"#64748b", lineHeight:1.7, margin:0 }}>{t.rationale}</p>
                  </div>
                </div>
                <button onClick={()=>copyTitle(i, t.title)}
                  style={{ background: copiedIdx===i?"#dcfce7":"#f1f5f9", border:`1px solid ${copiedIdx===i?"#86efac":"#e2e8f0"}`, color: copiedIdx===i?"#16a34a":NAVY, borderRadius:7, padding:"4px 9px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                  {copiedIdx===i?"✓":"📋"}
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:6, marginTop:8 }}>
                <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:7, padding:"5px 8px", fontSize:11 }}>
                  <div style={{ color:"#0369a1", fontWeight:700, marginBottom:1 }}>{isAr?"المتغيرات":"Variables"}</div>
                  <div style={{ color:"#475569" }}>{t.variables}</div>
                </div>
                <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:7, padding:"5px 8px", fontSize:11 }}>
                  <div style={{ color:"#5b21b6", fontWeight:700, marginBottom:1 }}>{isAr?"المنهج":"Method"}</div>
                  <div style={{ color:"#475569" }}>{t.method}</div>
                </div>
                <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:7, padding:"5px 8px", fontSize:11 }}>
                  <div style={{ color: feasColor(t.feasibility), fontWeight:700, marginBottom:1 }}>{isAr?"الصعوبة":"Feasibility"}</div>
                  <div style={{ color:"#475569" }}>{t.feasibility}</div>
                </div>
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:7, padding:"5px 8px", fontSize:11 }}>
                  <div style={{ color:GOLD, fontWeight:700, marginBottom:1 }}>{isAr?"الحداثة":"Novelty"}</div>
                  <div style={{ color:"#475569" }}>{"⭐".repeat(Math.max(1, Math.min(5, t.novelty || 3)))}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
