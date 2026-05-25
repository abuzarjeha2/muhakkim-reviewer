import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../../lib/i18n";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractRawText } from "mammoth/mammoth.browser.js";

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface Msg { role: "user" | "assistant"; content: string; }

const GOLD = "#b45309";
const NAVY = "#1e293b";

export default function ChatPDF() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [docText, setDocText] = useState("");
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, sending]);

  const handleFile = async (file: File) => {
    setError(""); setDocText(""); setMessages([]); setExtracting(true); setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      let text = "";
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdf = await getDocument({ data: buf }).promise;
        const pages: string[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          pages.push(content.items.map(i => ("str" in i ? i.str : "")).join(" "));
        }
        text = pages.join("\n\n");
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        const result = await extractRawText({ arrayBuffer: buf });
        text = result.value;
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        text = new TextDecoder().decode(buf);
      } else {
        throw new Error(isAr?"الملف غير مدعوم (PDF/DOCX/TXT)":"Unsupported file (PDF/DOCX/TXT)");
      }
      if (text.trim().length < 50) throw new Error(isAr?"تعذّر استخراج نص كافٍ":"Failed to extract enough text");
      setDocText(text);
      setMessages([{ role: "assistant", content: isAr
        ? `تم تحميل المستند بنجاح (${text.length.toLocaleString("ar-EG")} حرف). تفضل بسؤالك.`
        : `Document loaded (${text.length.toLocaleString()} chars). Ask your question.` }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
      setFileName("");
    } finally { setExtracting(false); }
  };

  const sendMessage = async () => {
    if (!input.trim() || !docText) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    setError("");
    try {
      // Drop the first bootstrap assistant greeting (index 0); keep the real chat history.
      const historyForApi = newMessages.slice(1);
      const r = await fetch("/api/ai/chat-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: docText, messages: historyForApi, lang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
      setMessages(prev => prev.slice(0, -1));
      setInput(userMsg.content);
    } finally { setSending(false); }
  };

  const reset = () => {
    setDocText(""); setFileName(""); setMessages([]); setInput(""); setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const suggestedQs = isAr
    ? ["ما هي مشكلة البحث؟", "اشرح المنهجية المستخدمة", "ما أهم النتائج؟", "ما التوصيات؟"]
    : ["What is the research problem?", "Explain the methodology", "What are the key findings?", "What are the recommendations?"];

  return (
    <div dir={isAr?"rtl":"ltr"} style={{ padding:"20px 16px 40px" }}>
      <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, padding:20, marginBottom:16, boxShadow:"0 2px 12px rgba(30,64,175,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42,height:42, borderRadius:11, background:"linear-gradient(135deg,#C9A84C,#b45309)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💬</div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:900, color:NAVY, margin:0 }}>{isAr?"دردشة مع PDF":"Chat with PDF"}</h2>
            <p style={{ fontSize:12, color:"#94a3b8", margin:"3px 0 0" }}>{isAr?"ارفع ورقة بحثية واسأل عن أي شيء فيها":"Upload a paper and ask anything about it"}</p>
          </div>
        </div>
      </div>

      {!docText ? (
        <div style={{ background:"#fff", border:"1.5px dashed #fde68a", borderRadius:16, padding:"40px 20px", textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
          <h3 style={{ fontSize:16, fontWeight:800, color:NAVY, margin:"0 0 6px" }}>{isAr?"ارفع مستنداً للبدء":"Upload a document to start"}</h3>
          <p style={{ fontSize:13, color:"#94a3b8", margin:"0 0 16px" }}>PDF · DOCX · TXT</p>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={()=>fileRef.current?.click()} disabled={extracting}
            style={{ background:"linear-gradient(135deg,#C9A84C,#b45309)", border:"none", borderRadius:10, color:"#fff", padding:"10px 24px", fontWeight:800, fontSize:14, cursor:extracting?"wait":"pointer", fontFamily:"inherit", boxShadow:"0 4px 12px #C9A84C33", opacity: extracting?0.7:1 }}>
            {extracting ? (isAr?"⏳ جارٍ الاستخراج...":"⏳ Extracting...") : (isAr?"📂 اختر ملفاً":"📂 Choose file")}
          </button>
          {error && <div style={{ marginTop:14, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", borderRadius:8, fontSize:13, display:"inline-block" }}>{error}</div>}
        </div>
      ) : (
        <div style={{ background:"#fff", border:"1.5px solid #e8ecf4", borderRadius:16, overflow:"hidden", display:"flex", flexDirection:"column", height:"70vh", minHeight:500 }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #eef1f8", background:"#fafbff", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0, flex:1 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>📄</span>
              <span style={{ fontSize:13, fontWeight:700, color:NAVY, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fileName}</span>
              <span style={{ fontSize:11, color:"#94a3b8", flexShrink:0 }}>· {docText.length.toLocaleString(isAr?"ar-EG":"en-US")} {isAr?"حرف":"chars"}</span>
            </div>
            <button onClick={reset}
              style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", borderRadius:7, padding:"4px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {isAr?"🗑️ إعادة":"🗑️ Reset"}
            </button>
          </div>

          <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"16px", background:"#fafbff", display:"flex", flexDirection:"column", gap:10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent: m.role==="user"?(isAr?"flex-start":"flex-end"):(isAr?"flex-end":"flex-start") }}>
                <div style={{ maxWidth:"80%", background: m.role==="user"?"linear-gradient(135deg,#C9A84C,#b45309)":"#fff", color: m.role==="user"?"#fff":NAVY, padding:"10px 14px", borderRadius:14, border: m.role==="user"?"none":"1px solid #e8ecf4", fontSize:13.5, lineHeight:1.7, whiteSpace:"pre-wrap", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display:"flex", justifyContent: isAr?"flex-end":"flex-start" }}>
                <div style={{ background:"#fff", border:"1px solid #e8ecf4", padding:"10px 14px", borderRadius:14, fontSize:13, color:"#94a3b8" }}>
                  {isAr?"⏳ جارٍ الإجابة...":"⏳ Thinking..."}
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6 }}>{isAr?"أسئلة مقترحة:":"Suggested questions:"}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {suggestedQs.map(q => (
                    <button key={q} onClick={()=>setInput(q)}
                      style={{ background:"#fff", border:"1px solid #fde68a", color:GOLD, borderRadius:14, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding:"12px 14px", borderTop:"1px solid #eef1f8", background:"#fff", display:"flex", gap:8 }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
              placeholder={isAr?"اكتب سؤالك...":"Type your question..."}
              disabled={sending}
              style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:14, fontFamily:"inherit" }} />
            <button onClick={sendMessage} disabled={sending || !input.trim()}
              style={{ background:"linear-gradient(135deg,#C9A84C,#b45309)", border:"none", borderRadius:10, color:"#fff", padding:"0 18px", fontWeight:800, fontSize:14, cursor: sending||!input.trim()?"not-allowed":"pointer", fontFamily:"inherit", opacity: sending||!input.trim()?0.5:1 }}>
              {isAr?"إرسال ↵":"Send ↵"}
            </button>
          </div>

          {error && <div style={{ padding:"8px 14px", background:"#fef2f2", borderTop:"1px solid #fecaca", color:"#dc2626", fontSize:12 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
