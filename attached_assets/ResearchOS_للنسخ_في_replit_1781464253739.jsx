/* ════════════════════════════════════════════════════════════════
   نظام البحث العلمي المتكامل — Research OS (بمعايير Q1)
   ملف للدمج في منصة محكّم (MuhakkimProV4.jsx)

   ⚠️ هذا المقطع يعتمد على مكوّنات موجودة في الملف الرئيسي:
   useState · Card · Btn · Spin · Tag · FileZone · callAIJson · readFile · ReportBtn
   لا يعمل وحده — يُدمج داخل MuhakkimProV4.jsx حسب الخطوات أدناه.

   ── خطوات الدمج في Replit ──
   1) الصق كامل هذا الملف قبل سطر "// ── MAIN APP" في MuhakkimProV4.jsx
   2) في مصفوفة GROUPS، داخل مجموعة writing (tools:[...])، أضف كأول عنصر:
      {key:"research_os", icon:"🔬", ar:"نظام البحث العلمي المتكامل", en:"Research OS (Q1 Grade)", badge:"عالمي"},
   3) في دالة renderTool، أضف:
      if(key==="research_os") return <ResearchOSSystem T={T}/>;
   4) في كائن TOOL_GUIDE، أضف مدخل الدليل (في نهاية هذا الملف بعد التعليق)
   ════════════════════════════════════════════════════════════════ */

// ═══ نظام البحث العلمي المتكامل (Research OS · بمعايير الجامعات العالمية ومجلات Q1) ═══
function ResearchRunner({ T, services, sysTitle, sysSub, sysIcon }) {
  const [sel, setSel] = useState(null);
  const [vals, setVals] = useState({});
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const svc = services.find(s=>s.id===sel);
  const soft = T.bgSec||T.bgS||T.inputBg||"#f0f3fa";
  const green=T.emerald||T.green||"#1f8a5b", amber=T.amber||T.orange||"#c47a0e";
  const td = T.textDim||T.textD||"#94a0b8", ts=T.textS||T.textSec||"#5b6b85";
  const inp = {padding:"12px 15px",borderRadius:11,border:`1.5px solid ${T.border}`,background:T.inputBg||soft,color:T.text,fontSize:13.5,fontFamily:"inherit",boxSizing:"border-box",outline:"none",width:"100%"};

  function quickStats(raw){
    const flat=(raw.match(/-?\d+\.?\d*/g)||[]).map(Number).filter(x=>!isNaN(x));
    if(flat.length<3) return null;
    const a=[...flat].sort((x,y)=>x-y),n=a.length,mean=a.reduce((s,x)=>s+x,0)/n;
    const sd=Math.sqrt(a.reduce((s,x)=>s+(x-mean)**2,0)/(n>1?n-1:1));
    return {n,mean,sd,min:a[0],max:a[n-1],median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
  }
  async function run(){
    setErr("");
    const fc = await Promise.all(files.map(readFile));
    const src = [text,...fc].join("\n").trim();
    if(!src && !svc.allowEmpty){ setErr("ارفع ملفاً أو الصق النص أولاً"); return; }
    setBusy(true); setRes(null);
    const st = quickStats(src);
    const meta = svc.fields.map(f=>f.ph+": "+(vals[f.k]||"—")).join(" · ");
    try {
      const data = await callAIJson(
        svc.sys+"\nاستند للمحتوى الفعلي فقط ولا تخترع مراجع أو أرقاماً. أخرج JSON بهذا الشكل فقط:\n"+svc.schema,
        meta+(st?"\nالإحصاء الوصفي المحسوب فعلياً: ن="+st.n+" متوسط="+st.mean.toFixed(2)+" انحراف="+st.sd.toFixed(2)+" مدى="+st.min+"–"+st.max:"")+"\n\nالمحتوى:\n"+(src?src.slice(0,13000):"(لا يوجد — قدّم الإطار الكامل)"), 3200);
      setRes({data, st, title:vals.title||svc.title});
    } catch(e){ setErr("تعذّر التحليل — أعد المحاولة."); }
    setBusy(false);
  }
  const stColor = s => /ضعيف|عال|مرفوض|غير/.test(s||"")?T.rose : /متوسط|جزئي|مشروط/.test(s||"")?amber : green;

  return <div style={{maxWidth:900,margin:"0 auto"}}>
    <Card T={T}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:27}}>{sysIcon}</span>
        <div><div style={{fontWeight:800,fontSize:17,color:T.text}}>{sysTitle}</div>
        <div style={{fontSize:12,color:ts}}>{sysSub}</div></div>
      </div>
    </Card>

    {!svc && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:12,marginTop:14}}>
      {services.map(x=>(
        <button key={x.id} onClick={()=>{setSel(x.id);setRes(null);setErr("");setVals({});setText("");setFiles([]);}}
          style={{background:T.card,border:`1.5px solid ${T.border}`,borderRadius:15,padding:"16px 15px",cursor:"pointer",fontFamily:"inherit",textAlign:"start",transition:"all .18s",display:"flex",flexDirection:"column",gap:8}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=x.color;e.currentTarget.style.boxShadow=T.shadowH;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
          <div style={{width:46,height:46,borderRadius:13,background:x.color+"1a",border:`1px solid ${x.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:23}}>{x.icon}</div>
          <div style={{fontWeight:800,fontSize:14,color:T.text}}>{x.title}</div>
          <div style={{fontSize:11.5,color:ts,lineHeight:1.6}}>{x.sub}</div>
        </button>
      ))}
    </div>}

    {svc && !res && !busy && <div style={{marginTop:14}}>
      <div style={{marginBottom:12}}><Btn ch="← كل الخدمات" v="ghost" T={T} onClick={()=>setSel(null)}/></div>
      <Card T={T}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}><span style={{fontSize:22}}>{svc.icon}</span><span style={{fontWeight:800,fontSize:15,color:svc.color}}>{svc.title}</span></div>
        <p style={{margin:"0 0 14px",fontSize:12.5,color:ts,lineHeight:1.7}}>{svc.long||svc.sub}</p>
        <div style={{display:"grid",gridTemplateColumns:svc.fields.length>1?"1fr 1fr":"1fr",gap:12,marginBottom:14}}>
          {svc.fields.map(f=><input key={f.k} value={vals[f.k]||""} onChange={e=>setVals({...vals,[f.k]:e.target.value})} placeholder={f.ph} style={inp}/>)}
        </div>
        <div style={{marginBottom:14}}><FileZone files={files} setFiles={setFiles} T={T}/></div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={7} placeholder={svc.placeholder||"أو الصق المحتوى / البيانات كاملاً هنا..."} style={{...inp,resize:"vertical",lineHeight:1.8,marginBottom:14}}/>
        {err && <div style={{fontSize:12.5,color:T.rose,marginBottom:10}}>{err}</div>}
        <Btn ch={<>{svc.icon} {svc.cta||"ولّد النتيجة"}</>} onClick={run} disabled={busy||(!text.trim()&&!files.length&&!svc.allowEmpty)} v="gold" T={T}/>
      </Card>
    </div>}

    {busy && <Card T={T} style={{padding:48,textAlign:"center",marginTop:14}}><div style={{marginBottom:14}}><Spin/></div><div style={{fontSize:14,color:T.text,fontWeight:700}}>جارٍ المعالجة الذكية...</div><div style={{fontSize:12,color:ts,marginTop:6}}>{svc.title}</div></Card>}

    {res && <div style={{marginTop:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Btn ch="← جديد" v="ghost" T={T} onClick={()=>setRes(null)}/>
        <Tag ch={svc.title} color={svc.color}/>
        {res.title && <span style={{fontSize:13.5,fontWeight:800,color:T.text}}>{res.title}</span>}
        <div style={{flex:1}}/>
        <ReportBtn T={T} title={res.title} body={svc.report(res.data,res.st)} opts={{icon:svc.icon,subtitle:sysTitle+" — "+svc.title,color:svc.color}}/>
        <Btn ch="📋 نسخ" v="ghost" T={T} onClick={()=>navigator.clipboard?.writeText(svc.report(res.data,res.st))}/>
      </div>
      {res.st && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:14}}>
        {[["المتوسط",res.st.mean.toFixed(2),T.blue],["الوسيط",res.st.median.toFixed(2),T.violet],["الانحراف",res.st.sd.toFixed(2),green],["عدد القيم",res.st.n,ts],["المدى",res.st.min+"–"+res.st.max,amber]].map((m,i)=>
          <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:12,textAlign:"center",boxShadow:T.shadow}}><div style={{fontSize:17,fontWeight:900,color:m[2]}}>{m[1]}</div><div style={{fontSize:10,color:td,marginTop:3}}>{m[0]}</div></div>)}
      </div>}
      {svc.view(res.data, {T,svc,soft,green,amber,td,ts,stColor})}
    </div>}
  </div>;
}

// مكوّنات عرض
function RSec({T,t,c,children}){ return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:16,marginBottom:12,boxShadow:T.shadow}}><h4 style={{margin:"0 0 10px",fontSize:13.5,color:c}}>{t}</h4>{children}</div>; }
function RList({T,items,pre}){ return (items||[]).map((x,i)=><p key={i} style={{margin:"5px 0",fontSize:12.5,color:T.text,lineHeight:1.7}}>{pre||"• "}{typeof x==="string"?x:JSON.stringify(x)}</p>); }
function RTbl({T,head,rows}){ return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{head.map(h=><th key={h} style={{padding:"7px",textAlign:"right",borderBottom:`2px solid ${T.border}`,color:T.textS||T.textSec}}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} style={{padding:"6px 7px",borderBottom:`1px solid ${T.border}`,color:T.text}}>{v}</td>)}</tr>)}</tbody></table></div>; }

const RESEARCH_SERVICES = [
  // 1) مولّد الفكرة والعنوان والمشكلة
  { id:"ideation", icon:"💡", color:"#B45309", title:"بلورة الفكرة والعنوان والمشكلة",
    sub:"من فكرة خام إلى عنوان ومشكلة وأسئلة وفرضيات بمعايير Q1",
    long:"حوّل فكرة بحثية خام أو مجالاً عاماً إلى عنوان احترافي، مشكلة بحثية محكمة، أسئلة وأهداف وفرضيات H₀/H₁ — بمعايير المجلات المصنّفة Q1.",
    cta:"بلْور الفكرة", allowEmpty:true,
    fields:[{k:"title",ph:"الفكرة/المجال البحثي"},{k:"extra",ph:"التخصص والمستوى"}],
    sys:"أنت أستاذ بحث بجامعة من التصنيف الأول ومحرّر بمجلة Q1. حوّل الفكرة لإطار بحثي محكم.",
    schema:`{"titles":["3 عناوين احترافية مقترحة"],"problem":"صياغة مشكلة الدراسة","gap":"الفجوة البحثية والإسهام","questions":["أسئلة البحث"],"objectives":["الأهداف"],"hypotheses":[{"h0":"الصفرية","h1":"البديلة"}],"significance":"الأهمية العلمية والتطبيقية","keywords":["كلمات مفتاحية"]}`,
    report:D=>"العناوين المقترحة:\n"+(D.titles||[]).map((t,i)=>(i+1)+". "+t).join("\n")+"\n\nمشكلة الدراسة:\n"+(D.problem||"")+"\n\nالفجوة البحثية:\n"+(D.gap||"")+"\n\nالأسئلة:\n"+(D.questions||[]).map(q=>"• "+q).join("\n")+"\n\nالأهداف:\n"+(D.objectives||[]).map(o=>"• "+o).join("\n")+"\n\nالفرضيات:\n"+(D.hypotheses||[]).map(h=>"H₀: "+h.h0+" | H₁: "+h.h1).join("\n")+"\n\nالأهمية:\n"+(D.significance||"")+"\n\nالكلمات المفتاحية: "+(D.keywords||[]).join("، "),
    view:(D,{T,svc,soft,ts})=><>
      <RSec T={T} t="📌 العناوين المقترحة" c={svc.color}>{(D.titles||[]).map((t,i)=><div key={i} style={{padding:"8px 11px",background:soft,borderRadius:9,marginBottom:6,fontSize:13,color:T.text}}>{i+1}. {t}</div>)}</RSec>
      <RSec T={T} t="🎯 مشكلة الدراسة والفجوة" c={svc.color}><p style={{margin:"0 0 8px",fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.problem}</p><p style={{margin:0,fontSize:12,color:ts,lineHeight:1.7}}><b>الفجوة: </b>{D.gap}</p></RSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><RSec T={T} t="❓ الأسئلة" c={svc.color}><RList T={T} items={D.questions}/></RSec><RSec T={T} t="🎯 الأهداف" c={T.teal}><RList T={T} items={D.objectives}/></RSec></div>
      <RSec T={T} t="🧪 الفرضيات" c={svc.color}>{(D.hypotheses||[]).map((h,i)=><div key={i} style={{padding:"9px 12px",background:soft,borderRadius:9,marginBottom:6,fontSize:12.5}}><div style={{color:T.text}}><b style={{color:T.rose}}>H₀:</b> {h.h0}</div><div style={{color:T.text}}><b style={{color:T.emerald||T.green}}>H₁:</b> {h.h1}</div></div>)}</RSec>
      <RSec T={T} t="⭐ الأهمية والكلمات المفتاحية" c={svc.color}><p style={{margin:"0 0 8px",fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.significance}</p><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(D.keywords||[]).map((k,i)=><Tag key={i} ch={k} color={svc.color}/>)}</div></RSec>
    </> },
  // 2) مراجعة الأدبيات والإطار النظري
  { id:"litreview", icon:"📚", color:"#0E7490", title:"مراجعة الأدبيات والإطار النظري",
    sub:"تلخيص ومقارنة الدراسات + بناء الإطار النظري + الفجوة",
    long:"حلّل الدراسات السابقة المرفوعة لبناء مراجعة أدبيات منظّمة: التلخيص، المقارنة النقدية، النظريات الحاكمة، والفجوة البحثية — بأسلوب مجلات Q1.",
    cta:"ابنِ المراجعة",
    fields:[{k:"title",ph:"موضوع البحث"},{k:"extra",ph:"التخصص"}],
    sys:"أنت باحث خبير بكتابة مراجعات الأدبيات لمجلات Q1. حلّل الدراسات المعطاة فعلياً دون اختلاق مراجع.",
    schema:`{"themes":[{"theme":"محور/تيار بحثي","summary":"تلخيصه","studies":"إشارة للدراسات ضمنه"}],"theories":["النظريات الحاكمة المناسبة"],"comparison":"مقارنة نقدية بين الاتجاهات","gap":"الفجوة البحثية المستخلصة","framework":"مقترح الإطار النظري والمتغيرات"}`,
    report:D=>"المحاور:\n"+(D.themes||[]).map(t=>"• "+t.theme+": "+t.summary+(t.studies?" ("+t.studies+")":"")).join("\n")+"\n\nالنظريات الحاكمة:\n"+(D.theories||[]).map(t=>"• "+t).join("\n")+"\n\nمقارنة نقدية:\n"+(D.comparison||"")+"\n\nالفجوة:\n"+(D.gap||"")+"\n\nالإطار النظري:\n"+(D.framework||""),
    view:(D,{T,svc,soft})=><>
      <RSec T={T} t="🗂️ محاور الأدبيات" c={svc.color}>{(D.themes||[]).map((t,i)=><div key={i} style={{padding:"9px 12px",background:soft,borderRadius:9,marginBottom:6}}><div style={{fontSize:12.5,fontWeight:700,color:T.text}}>{t.theme}</div><div style={{fontSize:11.5,color:T.textS||T.textSec,marginTop:2}}>{t.summary}</div></div>)}</RSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><RSec T={T} t="🧭 النظريات الحاكمة" c={svc.color}><RList T={T} items={D.theories}/></RSec><RSec T={T} t="🔍 الفجوة البحثية" c={T.rose}><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.gap}</p></RSec></div>
      <RSec T={T} t="⚖️ مقارنة نقدية" c={svc.color}><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.comparison}</p></RSec>
      <RSec T={T} t="🏗️ الإطار النظري المقترح" c={svc.color}><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.framework}</p></RSec>
    </> },
  // 3) مصمم المنهجية
  { id:"methodology", icon:"🔬", color:"#6d28d9", title:"تصميم المنهجية والعينة",
    sub:"المنهج + التصميم + العينة + الأدوات + الاختبار المناسب",
    long:"يصمم منهجية البحث المتكاملة بمعايير عالمية: نوع المنهج والتصميم، مجتمع وعينة البحث وحجمها المبرّر، أدوات جمع البيانات، والأساليب الإحصائية المناسبة للفرضيات.",
    cta:"صمّم المنهجية", allowEmpty:true,
    fields:[{k:"title",ph:"موضوع/أسئلة البحث"},{k:"extra",ph:"التخصص ونوع البيانات"}],
    sys:"أنت خبير مناهج بحث وإحصاء بمعايير الجامعات العالمية. صمّم منهجية دقيقة ومبرّرة.",
    schema:`{"approach":"المنهج المناسب ومبرره","design":"التصميم البحثي","population":"مجتمع البحث","sample":"العينة وحجمها المبرّر إحصائياً","instruments":["أدوات جمع البيانات"],"validity":"الصدق والثبات المقترح","statTests":[{"purpose":"الغرض","test":"الاختبار المناسب","why":"لماذا"}],"limitations":["حدود منهجية متوقعة"]}`,
    report:D=>"المنهج: "+(D.approach||"")+"\nالتصميم: "+(D.design||"")+"\nالمجتمع: "+(D.population||"")+"\nالعينة: "+(D.sample||"")+"\n\nالأدوات:\n"+(D.instruments||[]).map(i=>"• "+i).join("\n")+"\n\nالصدق والثبات: "+(D.validity||"")+"\n\nالأساليب الإحصائية:\n"+(D.statTests||[]).map(t=>"• "+t.purpose+" → "+t.test+" ("+t.why+")").join("\n")+"\n\nالحدود:\n"+(D.limitations||[]).map(l=>"• "+l).join("\n"),
    view:(D,{T,svc,soft})=><>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <RSec T={T} t="🧭 المنهج والتصميم" c={svc.color}><p style={{margin:"0 0 6px",fontSize:12.5,color:T.text,lineHeight:1.7}}><b>المنهج: </b>{D.approach}</p><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.7}}><b>التصميم: </b>{D.design}</p></RSec>
        <RSec T={T} t="👥 المجتمع والعينة" c={T.teal}><p style={{margin:"0 0 6px",fontSize:12.5,color:T.text,lineHeight:1.7}}><b>المجتمع: </b>{D.population}</p><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.7}}><b>العينة: </b>{D.sample}</p></RSec>
      </div>
      <RSec T={T} t="🧰 أدوات جمع البيانات" c={svc.color}><RList T={T} items={D.instruments}/><p style={{margin:"8px 0 0",fontSize:11.5,color:T.textS||T.textSec}}><b>الصدق والثبات: </b>{D.validity}</p></RSec>
      <RSec T={T} t="📊 الأساليب الإحصائية المناسبة" c={svc.color}><RTbl T={T} head={["الغرض","الاختبار","المبرر"]} rows={(D.statTests||[]).map(t=>[t.purpose,t.test,t.why])}/></RSec>
      {(D.limitations||[]).length>0 && <RSec T={T} t="⚠️ حدود منهجية" c={T.amber||T.orange}><RList T={T} items={D.limitations}/></RSec>}
    </> },
  // 4) المراجعة الشاملة للورقة (Q1 reviewer)
  { id:"paper_review", icon:"🛡️", color:"#B42318", title:"مراجعة الورقة بمعايير محكّم Q1",
    sub:"تحكيم شامل بأبعاد المجلات المرموقة + قرار + ردّ المحكّم",
    long:"يحاكي محكّم مجلة Q1: يقيّم الأصالة، المنهجية، النتائج، اللغة، والإسهام، ويصدر قراراً مع ملاحظات بالموضع ومسودة ردّ على المحكّمين.",
    cta:"حكّم الورقة",
    fields:[{k:"title",ph:"عنوان الورقة"},{k:"extra",ph:"المجلة المستهدفة (اختياري)"}],
    sys:"أنت محكّم بمجلة Q1 (مفهرسة Scopus/WoS). حكّم الورقة المعطاة فعلياً بصرامة ومعايير دولية.",
    schema:`{"overallScore":<0-100>,"recommendation":"<قبول|تعديلات طفيفة|تعديلات جوهرية|رفض>","criteria":[{"name":"المعيار","score":<0-100>,"note":"الملاحظة"}],"majorComments":["ملاحظات جوهرية للمحكّم"],"minorComments":["ملاحظات طفيفة"],"strengths":["نقاط القوة"],"reviewerResponse":"مسودة ردّ مقترح على المحكّمين"}`,
    report:D=>"الدرجة: "+D.overallScore+"/100 — "+D.recommendation+"\n\nالمعايير:\n"+(D.criteria||[]).map(c=>"• "+c.name+": "+c.score+"/100 — "+c.note).join("\n")+"\n\nملاحظات جوهرية:\n"+(D.majorComments||[]).map(c=>"• "+c).join("\n")+"\n\nملاحظات طفيفة:\n"+(D.minorComments||[]).map(c=>"• "+c).join("\n")+"\n\nالقوة:\n"+(D.strengths||[]).map(s=>"• "+s).join("\n")+"\n\nمسودة الردّ:\n"+(D.reviewerResponse||""),
    view:(D,{T,svc,soft,green,amber,stColor})=>{ const sc=D.overallScore>=80?green:D.overallScore>=60?amber:T.rose; return <>
      <div style={{background:`linear-gradient(135deg,${sc}15,transparent)`,border:`2px solid ${sc}`,borderRadius:16,padding:22,textAlign:"center",marginBottom:14}}><div style={{fontSize:13,color:T.textDim||T.textD}}>تقييم المحكّم</div><div style={{fontSize:44,fontWeight:900,color:sc}}>{D.overallScore}<span style={{fontSize:20,color:T.textDim||T.textD}}>/100</span></div><div style={{marginTop:8}}><Tag ch={D.recommendation} color={sc}/></div></div>
      <RSec T={T} t="📊 تقييم المعايير" c={svc.color}><RTbl T={T} head={["المعيار","الدرجة","الملاحظة"]} rows={(D.criteria||[]).map(c=>[c.name,c.score+"/100",c.note])}/></RSec>
      <RSec T={T} t="🔴 ملاحظات جوهرية" c={T.rose}><RList T={T} items={D.majorComments}/></RSec>
      <RSec T={T} t="🟡 ملاحظات طفيفة" c={amber}><RList T={T} items={D.minorComments}/></RSec>
      <RSec T={T} t="✉️ مسودة الردّ على المحكّمين" c={svc.color}><pre style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{D.reviewerResponse}</pre></RSec>
    </>; } },
  // 5) موجّه النشر Q1
  { id:"journal_match", icon:"🎯", color:"#0E7490", title:"موجّه النشر ومطابقة مجلات Q1",
    sub:"أنسب المجلات + احتمالية القبول + خطة النشر",
    long:"يحلّل ورقتك ويقترح أنسب المجلات المصنّفة Q1/Q2 بمعايير المطابقة (النطاق، التصنيف، معامل التأثير)، مع تقدير احتمالية القبول وخطة التقديم.",
    cta:"طابِق المجلات",
    fields:[{k:"title",ph:"عنوان/مجال الورقة"},{k:"extra",ph:"التخصص الدقيق"}],
    sys:"أنت خبير نشر علمي بمعايير Scopus/Web of Science. اقترح مجلات حقيقية واقعية بمجال البحث دون اختلاق أرقام دقيقة، ونبّه أن التحقق النهائي من الموقع الرسمي للمجلة.",
    schema:`{"journals":[{"name":"اسم المجلة","quartile":"Q1|Q2","scope":"مدى المطابقة","fit":"عالٍ|متوسط","note":"ملاحظة"}],"acceptanceTips":["عوامل ترفع احتمالية القبول"],"submissionPlan":["خطوات خطة التقديم"],"caution":"تنبيه التحقق من البيانات الرسمية للمجلة"}`,
    report:D=>"المجلات المقترحة:\n"+(D.journals||[]).map(j=>"• "+j.name+" ["+j.quartile+" · ملاءمة "+j.fit+"]: "+j.scope+(j.note?" ("+j.note+")":"")).join("\n")+"\n\nعوامل رفع القبول:\n"+(D.acceptanceTips||[]).map(t=>"• "+t).join("\n")+"\n\nخطة التقديم:\n"+(D.submissionPlan||[]).map(s=>"← "+s).join("\n")+"\n\nتنبيه: "+(D.caution||""),
    view:(D,{T,svc,soft,green,amber})=><>
      <RSec T={T} t="📰 المجلات المقترحة" c={svc.color}>{(D.journals||[]).map((j,i)=><div key={i} style={{padding:"10px 12px",background:soft,borderRadius:10,marginBottom:7}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:3}}><span style={{fontSize:13,fontWeight:700,color:T.text}}>{j.name}</span><Tag ch={j.quartile} color={j.quartile==="Q1"?green:amber}/><Tag ch={"ملاءمة "+j.fit} color={svc.color}/></div><div style={{fontSize:11.5,color:T.textS||T.textSec}}>{j.scope}{j.note?" · "+j.note:""}</div></div>)}</RSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><RSec T={T} t="📈 عوامل رفع القبول" c={green}><RList T={T} items={D.acceptanceTips}/></RSec><RSec T={T} t="🗺️ خطة التقديم" c={svc.color}><RList T={T} items={D.submissionPlan} pre="← "/></RSec></div>
      {D.caution && <div style={{background:(T.amber||T.orange)+"12",border:`1px solid ${(T.amber||T.orange)}40`,borderRadius:12,padding:13,fontSize:11.5,color:T.text,lineHeight:1.7}}>⚠️ {D.caution}</div>}
    </> },
  // 6) محرر اللغة الأكاديمية Q1
  { id:"language_edit", icon:"✍️", color:"#6d28d9", title:"التحرير اللغوي الأكاديمي (Q1)",
    sub:"رفع اللغة لمستوى المجلات المرموقة + تقرير التحسين",
    long:"يحسّن لغة الورقة لمستوى المجلات الدولية: الأسلوب الأكاديمي، الوضوح، الترابط، والدقة المصطلحية — مع تقرير بأبرز التحسينات (لا يخترع محتوى).",
    cta:"حسّن اللغة",
    fields:[{k:"title",ph:"عنوان القسم/الورقة"},{k:"extra",ph:"اللغة المستهدفة (عربي/إنجليزي)"}],
    sys:"أنت محرّر لغوي أكاديمي لمجلات Q1. حسّن النص المعطى دون تغيير معناه أو اختلاق محتوى.",
    schema:`{"improvedText":"النص المحسّن كاملاً","changes":[{"type":"نوع التحسين","example":"مثال قبل/بعد"}],"styleNotes":["ملاحظات أسلوبية عامة"],"readability":"تقييم الوضوح والمستوى الأكاديمي"}`,
    report:D=>"النص المحسّن:\n"+(D.improvedText||"")+"\n\nأبرز التحسينات:\n"+(D.changes||[]).map(c=>"• "+c.type+": "+c.example).join("\n")+"\n\nملاحظات أسلوبية:\n"+(D.styleNotes||[]).map(s=>"• "+s).join("\n")+"\n\nالوضوح: "+(D.readability||""),
    view:(D,{T,svc,soft})=><>
      <RSec T={T} t="✨ النص المحسّن" c={svc.color}><div style={{fontSize:13,color:T.text,lineHeight:2,whiteSpace:"pre-wrap"}}>{D.improvedText}</div></RSec>
      <RSec T={T} t="🔧 أبرز التحسينات" c={svc.color}>{(D.changes||[]).map((c,i)=><div key={i} style={{padding:"8px 11px",background:soft,borderRadius:9,marginBottom:6,fontSize:12,color:T.text}}><b>{c.type}: </b>{c.example}</div>)}</RSec>
      {(D.styleNotes||[]).length>0 && <RSec T={T} t="📝 ملاحظات أسلوبية" c={T.teal}><RList T={T} items={D.styleNotes}/></RSec>}
    </> },
  // 7) المستشار البحثي الذكي
  { id:"advisor", icon:"🧠", color:"#B45309", title:"المستشار البحثي الذكي",
    sub:"اسأل أي سؤال بحثي/إحصائي واحصل على إجابة بالتوصيات",
    long:"اطرح أي سؤال بحثي أو إحصائي (ما أفضل نموذج؟ ما حجم العينة؟ كيف أفسّر النتيجة؟ ما أفضل مجلة؟) واحصل على إجابة عملية بالتوصيات والخطوات.",
    cta:"اسأل المستشار", allowEmpty:true,
    placeholder:"اكتب سؤالك البحثي أو الإحصائي هنا...",
    fields:[{k:"title",ph:"موضوع الاستشارة"}],
    sys:"أنت مستشار بحثي وإحصائي خبير بمعايير عالمية. أجب على السؤال المعطى فعلياً بدقة وعملية.",
    schema:`{"answer":"الإجابة المباشرة","reasoning":"التبرير العلمي","steps":["خطوات عملية"],"recommendations":["توصيات"],"caveats":["تحفظات/شروط"]}`,
    report:D=>"الإجابة:\n"+(D.answer||"")+"\n\nالتبرير:\n"+(D.reasoning||"")+"\n\nخطوات عملية:\n"+(D.steps||[]).map(s=>"← "+s).join("\n")+"\n\nتوصيات:\n"+(D.recommendations||[]).map(r=>"• "+r).join("\n")+"\n\nتحفظات:\n"+(D.caveats||[]).map(c=>"• "+c).join("\n"),
    view:(D,{T,svc,soft})=><>
      <RSec T={T} t="💬 الإجابة" c={svc.color}><p style={{margin:0,fontSize:13.5,color:T.text,lineHeight:1.9}}>{D.answer}</p></RSec>
      <RSec T={T} t="🧩 التبرير العلمي" c={svc.color}><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.reasoning}</p></RSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><RSec T={T} t="🪜 خطوات عملية" c={T.teal}><RList T={T} items={D.steps} pre="← "/></RSec><RSec T={T} t="💡 توصيات" c={svc.color}><RList T={T} items={D.recommendations}/></RSec></div>
      {(D.caveats||[]).length>0 && <RSec T={T} t="⚠️ تحفظات" c={T.amber||T.orange}><RList T={T} items={D.caveats}/></RSec>}
    </> },
  // 8) المقترح البحثي / منحة
  { id:"proposal", icon:"📑", color:"#0E7490", title:"المقترح البحثي وخطة المنحة",
    sub:"مقترح متكامل جاهز للجان والمنح بمعايير دولية",
    long:"يبني مقترحاً بحثياً متكاملاً (Research Proposal / Grant) بمعايير لجان المنح الدولية: الملخص، المشكلة، الأهداف، المنهجية، الخطة الزمنية، الميزانية، والأثر المتوقع.",
    cta:"ابنِ المقترح", allowEmpty:true,
    fields:[{k:"title",ph:"عنوان المشروع البحثي"},{k:"extra",ph:"الجهة الممولة/التخصص"}],
    sys:"أنت خبير كتابة مقترحات بحثية ومنح بمعايير دولية (مثل Horizon/RDIA). ابنِ مقترحاً مقنعاً.",
    schema:`{"abstract":"ملخص تنفيذي","problem":"المشكلة والمبرر","objectives":["الأهداف"],"methodology":"ملخص المنهجية","timeline":[{"phase":"المرحلة","duration":"المدة","output":"المخرج"}],"budget":["بنود الميزانية الرئيسية"],"impact":"الأثر العلمي والمجتمعي المتوقع"}`,
    report:D=>"الملخص:\n"+(D.abstract||"")+"\n\nالمشكلة:\n"+(D.problem||"")+"\n\nالأهداف:\n"+(D.objectives||[]).map(o=>"• "+o).join("\n")+"\n\nالمنهجية:\n"+(D.methodology||"")+"\n\nالخطة الزمنية:\n"+(D.timeline||[]).map(t=>"• "+t.phase+" ("+t.duration+"): "+t.output).join("\n")+"\n\nالميزانية:\n"+(D.budget||[]).map(b=>"• "+b).join("\n")+"\n\nالأثر:\n"+(D.impact||""),
    view:(D,{T,svc,soft})=><>
      <RSec T={T} t="📄 الملخص التنفيذي" c={svc.color}><p style={{margin:0,fontSize:13,color:T.text,lineHeight:1.9}}>{D.abstract}</p></RSec>
      <RSec T={T} t="🎯 المشكلة والأهداف" c={svc.color}><p style={{margin:"0 0 8px",fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.problem}</p><RList T={T} items={D.objectives}/></RSec>
      <RSec T={T} t="🗓️ الخطة الزمنية" c={svc.color}><RTbl T={T} head={["المرحلة","المدة","المخرج"]} rows={(D.timeline||[]).map(t=>[t.phase,t.duration,t.output])}/></RSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><RSec T={T} t="💰 الميزانية" c={T.teal}><RList T={T} items={D.budget}/></RSec><RSec T={T} t="🌍 الأثر المتوقع" c={svc.color}><p style={{margin:0,fontSize:12.5,color:T.text,lineHeight:1.8}}>{D.impact}</p></RSec></div>
    </> },
];

function ResearchOSSystem({ T }){ return <ResearchRunner T={T} services={RESEARCH_SERVICES} sysIcon="🔬" sysTitle="نظام البحث العلمي المتكامل" sysSub="دورة البحث كاملة بمعايير الجامعات العالمية ومجلات Q1: الفكرة · الأدبيات · المنهجية · التحكيم · النشر · التحرير · الاستشارة · المنحة"/>; }

/* ════════════════════════════════════════════════════════════════
   مدخل الدليل — أضفه داخل كائن TOOL_GUIDE في الملف الرئيسي:
   ════════════════════════════════════════════════════════════════
  research_os: {
    what:"نظام بحث علمي متكامل يغطي دورة البحث كاملة بمعايير الجامعات العالمية ومجلات Q1، بثماني خدمات: بلورة الفكرة والعنوان والمشكلة والفرضيات، مراجعة الأدبيات وبناء الإطار النظري، تصميم المنهجية والعينة والاختبار المناسب، مراجعة الورقة بمعايير محكّم Q1، موجّه النشر ومطابقة مجلات Q1، التحرير اللغوي الأكاديمي، المستشار البحثي الذكي، وبناء المقترح البحثي وخطة المنحة.",
    need:"اختر الخدمة من البطاقات، اكتب موضوعك/سؤالك، ثم ارفع الملف (PDF/Word) أو الصق النص. بعض الخدمات (الفكرة، المنهجية، المقترح، المستشار) تعمل حتى بلا ملف.",
    out:"مخرج متخصص بحسب الخدمة: إطار بحثي كامل، مراجعة أدبيات، تصميم منهجي، تقرير تحكيم Q1، قائمة مجلات مطابقة، نص محرَّر، استشارة، أو مقترح منحة — كلها قابلة للطباعة كتقرير احترافي بترويسة محكّم.",
    diff:"يربط دورة البحث كاملة (فكرة ← أدبيات ← منهجية ← كتابة ← تحكيم ← نشر) في نظام واحد بمعايير Q1، ويستند للمحتوى الفعلي وحساب وصفي حقيقي دون اختلاق مراجع. للتحكيم العميق صفحة بصفحة: مركز المراجعة الموحّد."
  },
*/
