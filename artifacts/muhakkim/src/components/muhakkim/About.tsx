import { useLanguage } from "../../lib/i18n";

// ─── Data ────────────────────────────────────────────────────────────────────
const EDUCATION = [
  { year: "2014", icon: "🎓", degreeAr: "دكتوراه في الإحصاء",    degreeEn: "Ph.D. in Statistics",    instAr: "جامعة السودان للعلوم والتكنولوجيا", instEn: "Sudan University of Science & Technology" },
  { year: "2009", icon: "📜", degreeAr: "ماجستير في الإحصاء",    degreeEn: "M.Sc. in Statistics",    instAr: "جامعة كردفان، الأبيض",              instEn: "Kordofan University, El-Obeid" },
  { year: "2003", icon: "📃", degreeAr: "بكالوريوس في الإحصاء",  degreeEn: "B.Sc. in Statistics",    instAr: "جامعة أم درمان الإسلامية",          instEn: "Omdurman Islamic University" },
];

const EXPERIENCE = [
  { period: "2024 — الحاضر", roleAr: "أستاذ مساعد في الإحصاء",         roleEn: "Assistant Professor of Statistics",     placeAr: "الجامعة الإسلامية في مينيسوتا",              placeEn: "Islamic University of Minnesota",       dot: "#b45309" },
  { period: "2024 — الحاضر", roleAr: "أستاذ مساعد",                    roleEn: "Assistant Professor",                    placeAr: "كلية الغد للعلوم التطبيقية، القصيم",          placeEn: "Al-Ghad College, Al-Qassim",            dot: "#b45309" },
  { period: "2022 — 2023",   roleAr: "خبير بحثي",                      roleEn: "Research Expert",                        placeAr: "المركز الوطني للنخيل والتمور، السعودية",     placeEn: "National Center for Palms & Dates, KSA", dot: "#1d4ed8" },
  { period: "2022 — 2023",   roleAr: "محاضر جامعي",                    roleEn: "University Lecturer",                    placeAr: "قسم الإحصاء، جامعة الجوف",                  placeEn: "Statistics Dept., Al-Jouf University",  dot: "#1d4ed8" },
  { period: "2020 — 2022",   roleAr: "أستاذ مساعد — منسق الجودة",      roleEn: "Assistant Prof. — Quality Coordinator", placeAr: "قسم الإحصاء، جامعة الملك سعود",             placeEn: "Statistics Dept., King Saud University", dot: "#5b21b6" },
  { period: "2016 — 2019",   roleAr: "أستاذ مساعد — مستشار إداري",     roleEn: "Assistant Prof. — Admin Advisor",        placeAr: "جامعة جدة",                                 placeEn: "Jeddah University",                     dot: "#5b21b6" },
  { period: "2015 — 2016",   roleAr: "محاضر — منسق الجودة والتعليم",   roleEn: "Lecturer — Quality & e-Learning Coord.", placeAr: "جامعة الجوف",                               placeEn: "Al-Jouf University",                    dot: "#065f46" },
  { period: "2011 — 2014",   roleAr: "محاضر — منسق السنة التحضيرية",   roleEn: "Lecturer — Prep Year Coordinator",       placeAr: "كليات الغد الدولية",                        placeEn: "Al-Ghad International Colleges",        dot: "#065f46" },
];

const SKILLS = [
  { icon: "📊", ar: "تحليل السلاسل الزمنية (ARIMA)",   en: "Time Series Analysis (ARIMA)" },
  { icon: "📉", ar: "تحليل الانحدار والإحصاء التطبيقي", en: "Regression & Applied Statistics" },
  { icon: "🔬", ar: "تصميم المسوحات الإحصائية",        en: "Statistical Survey Design" },
  { icon: "📝", ar: "مناهج البحث العلمي",              en: "Research Methodology" },
  { icon: "🎓", ar: "التدريس الجامعي والتدريب",         en: "University Teaching & Training" },
];

const SOFTWARE = ["SPSS", "Minitab", "EViews", "Stata", "Excel", "Word"];

const PUBS = [
  "Box-Jenkins Models to Predict Sesame Produce (1960–2012)",
  "Forecasting Sudan Inflation Rates Using ARIMA",
  "Measuring & Analysing Saudi Dates Exports to Indonesia",
  "GDP Modelling — Agriculture, Petroleum, Electricity (KSA)",
  "Wholesale & Retail Trade GDP Prediction — KSA",
  "Gum Arabic Production Prediction Using Time Series",
];

// ─── Section title helper ─────────────────────────────────────────────────────
function SecTitle({ icon, ar, en, isAr, color }: { icon: string; ar: string; en: string; isAr: boolean; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: color + "14", border: `1.5px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>{isAr ? ar : en}</span>
      <div style={{ flex: 1, height: 1.5, background: color + "18", borderRadius: 2 }} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function About() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const W = "#ffffff";

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ padding: "16px 14px 48px", maxWidth: 720, margin: "0 auto", fontFamily: isAr ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>

      {/* ── PROFILE CARD ── */}
      <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7ed)", border: "1.5px solid #fde68a", borderRadius: 20, padding: "22px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg,#C9A84C,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 4px 16px #C9A84C33", flexShrink: 0 }}>
          👨‍🏫
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#1e293b" }}>
            {isAr ? "د. أبوذر يوسف علي أحمد" : "Dr. Abuzar Yousef Ali Ahmed"}
          </h1>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
            {isAr ? "أستاذ مساعد في الإحصاء" : "Assistant Professor of Statistics"}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { e: "🇸🇩", t: isAr ? "سوداني" : "Sudanese" },
              { e: "📅", t: isAr ? "خبرة +٢٠ سنة" : "20+ Yrs Exp." },
              { e: "📚", t: isAr ? "١٢ بحثاً" : "12 Pubs." },
              { e: "🌐", t: isAr ? "عربي · إنجليزي" : "Ar · En" },
            ].map(b => (
              <span key={b.t} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: W, border: "1.5px solid #fde68a", borderRadius: 8, padding: "3px 9px", fontSize: 11, color: "#78350f", fontWeight: 600 }}>
                {b.e} {b.t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHANNELS — يوتيوب وتيك توك فقط ── */}
      <div style={{ marginBottom: 14 }}>
        <SecTitle icon="📡" ar="تواصل معي" en="Connect With Me" isAr={isAr} color="#b45309" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* YouTube */}
          <a href="https://www.youtube.com/@D.Abuzar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ background: "linear-gradient(135deg,#fff5f5,#ffe4e6)", border: "1.5px solid #fecaca", borderRadius: 16, padding: "18px 14px", textAlign: "center", cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px #ef444422"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>▶️</div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#991b1b", marginBottom: 3 }}>YouTube</div>
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>@D.Abuzar</div>
              <div style={{ fontSize: 11, color: "#f87171", marginBottom: 12 }}>{isAr ? "دروس إحصاء وتحليل بيانات" : "Statistics & data analysis"}</div>
              <span style={{ display: "inline-block", background: "#ef4444", color: W, borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 800 }}>
                {isAr ? "تابع الآن" : "Follow Now"}
              </span>
            </div>
          </a>
          {/* TikTok */}
          <a href="https://www.tiktok.com/@dr.abuzar79" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ background: "linear-gradient(135deg,#f0fdfa,#ccfbf1)", border: "1.5px solid #99f6e4", borderRadius: 16, padding: "18px 14px", textAlign: "center", cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px #0d948822"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎵</div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f766e", marginBottom: 3 }}>TikTok</div>
              <div style={{ fontSize: 12, color: "#0d9488", fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>@dr.abuzar79</div>
              <div style={{ fontSize: 11, color: "#2dd4bf", marginBottom: 12 }}>{isAr ? "محتوى تعليمي سريع" : "Short educational content"}</div>
              <span style={{ display: "inline-block", background: "#0d9488", color: W, borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 800 }}>
                {isAr ? "تابع الآن" : "Follow Now"}
              </span>
            </div>
          </a>
        </div>
      </div>

      {/* ── EDUCATION ── */}
      <div style={{ marginBottom: 14 }}>
        <SecTitle icon="🎓" ar="المؤهلات العلمية" en="Education" isAr={isAr} color="#1d4ed8" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EDUCATION.map((e, i) => (
            <div key={i} style={{ background: W, border: "1.5px solid #e8ecf4", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "#eff6ff", border: "1.5px solid #bfdbfe", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>{e.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>{e.year}</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", marginBottom: 2 }}>{isAr ? e.degreeAr : e.degreeEn}</div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>{isAr ? e.instAr : e.instEn}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EXPERIENCE ── */}
      <div style={{ marginBottom: 14 }}>
        <SecTitle icon="💼" ar="الخبرات المهنية" en="Professional Experience" isAr={isAr} color="#5b21b6" />
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 6, bottom: 6, [isAr ? "right" : "left"]: 20, width: 2, background: "linear-gradient(to bottom,#e8ecf4,transparent)", borderRadius: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 7, [isAr ? "paddingRight" : "paddingLeft"]: 44 }}>
            {EXPERIENCE.map((ex, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ position: "absolute", [isAr ? "right" : "left"]: -32, top: 14, width: 10, height: 10, borderRadius: "50%", background: ex.dot, boxShadow: `0 0 6px ${ex.dot}60` }} />
                <div style={{ background: W, border: "1.5px solid #e8ecf4", borderRadius: 11, padding: "10px 13px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: "#1e293b", marginBottom: 2 }}>{isAr ? ex.roleAr : ex.roleEn}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{isAr ? ex.placeAr : ex.placeEn}</div>
                  </div>
                  <span style={{ background: ex.dot + "12", border: `1px solid ${ex.dot}25`, borderRadius: 6, padding: "2px 7px", color: ex.dot, fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {ex.period}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SKILLS + SOFTWARE + LANGUAGES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {/* Skills */}
        <div>
          <SecTitle icon="⚡" ar="المهارات" en="Skills" isAr={isAr} color="#065f46" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SKILLS.map((s, i) => (
              <div key={i} style={{ background: W, border: "1.5px solid #d1fae5", borderRadius: 10, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.4 }}>{isAr ? s.ar : s.en}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Software + Languages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <SecTitle icon="🖥️" ar="البرامج" en="Software" isAr={isAr} color="#0369a1" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {SOFTWARE.map(sw => (
                <div key={sw} style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 9, padding: "8px", textAlign: "center" }}>
                  <span style={{ color: "#0369a1", fontWeight: 800, fontSize: 12, fontFamily: "monospace" }}>{sw}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SecTitle icon="🌍" ar="اللغات" en="Languages" isAr={isAr} color="#86198f" />
            <div style={{ display: "flex", gap: 7 }}>
              {[{ f: "🇸🇦", n: isAr ? "العربية" : "Arabic" }, { f: "🇬🇧", n: isAr ? "الإنجليزية" : "English" }].map(l => (
                <div key={l.n} style={{ flex: 1, background: "#fdf4ff", border: "1.5px solid #f0abfc", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{l.f}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#86198f" }}>{l.n}</div>
                  <div style={{ fontSize: 10, color: "#a21caf" }}>{isAr ? "طلاقة" : "Fluent"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── PUBLICATIONS ── */}
      <div>
        <SecTitle icon="📖" ar="أبرز الأبحاث المنشورة" en="Selected Publications" isAr={isAr} color="#5b21b6" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PUBS.map((p, i) => (
            <div key={i} style={{ background: W, border: "1.5px solid #e8ecf4", borderRadius: 10, padding: "10px 13px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "#f5f3ff", border: "1.5px solid #ddd6fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#5b21b6", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{p}</span>
            </div>
          ))}
          <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "9px 13px", textAlign: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6" }}>📚 {isAr ? "وأبحاث أخرى — إجمالي ١٢ بحثاً منشوراً" : "And more — 12 publications in total"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
