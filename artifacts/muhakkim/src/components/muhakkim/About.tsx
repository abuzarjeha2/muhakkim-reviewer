import { useLanguage } from "../../lib/i18n";

// ─── Data ────────────────────────────────────────────────────────────────────
const EDUCATION = [
  { year: "2014", degreeAr: "دكتوراه في الإحصاء", degreeEn: "Ph.D. in Statistics", instAr: "جامعة السودان للعلوم والتكنولوجيا، الخرطوم", instEn: "Sudan University of Science and Technology, Khartoum" },
  { year: "2009", degreeAr: "ماجستير في الإحصاء", degreeEn: "M.Sc. in Statistics", instAr: "جامعة كردفان، الأبيض", instEn: "Kordofan University, El-Obeid" },
  { year: "2003", degreeAr: "بكالوريوس في الإحصاء", degreeEn: "B.Sc. in Statistics", instAr: "جامعة أم درمان الإسلامية، الخرطوم", instEn: "Omdurman Islamic University, Khartoum" },
];

const EXPERIENCE = [
  { period: "2024 — الحاضر", roleAr: "أستاذ مساعد في الإحصاء", roleEn: "Assistant Professor of Statistics", placeAr: "الجامعة الإسلامية في مينيسوتا", placeEn: "Islamic University of Minnesota", color: "#C9A84C" },
  { period: "2024 — الحاضر", roleAr: "أستاذ مساعد", roleEn: "Assistant Professor", placeAr: "كلية الغد للعلوم التطبيقية، القصيم", placeEn: "Al-Ghad College for Applied Medical Sciences, Al-Qassim", color: "#C9A84C" },
  { period: "2022 — 2023", roleAr: "خبير بحثي", roleEn: "Research Expert", placeAr: "المركز الوطني للنخيل والتمور، المملكة العربية السعودية", placeEn: "National Center for Palms & Dates, KSA", color: "#60a5fa" },
  { period: "2022 — 2023", roleAr: "محاضر جامعي", roleEn: "University Lecturer", placeAr: "قسم الإحصاء، جامعة الجوف", placeEn: "Statistics Dept., Al-Jouf University", color: "#60a5fa" },
  { period: "2020 — 2022", roleAr: "أستاذ مساعد — منسق الجودة", roleEn: "Assistant Professor — Quality Coordinator", placeAr: "قسم الإحصاء، جامعة الملك سعود", placeEn: "Statistics Dept., King Saud University", color: "#a78bfa" },
  { period: "2016 — 2019", roleAr: "أستاذ مساعد — مستشار إداري", roleEn: "Assistant Professor — Admin Advisor", placeAr: "جامعة جدة", placeEn: "Jeddah University", color: "#a78bfa" },
  { period: "2015 — 2016", roleAr: "محاضر جامعي — منسق الجودة والتعليم الإلكتروني", roleEn: "Lecturer — Quality & e-Learning Coordinator", placeAr: "جامعة الجوف", placeEn: "Al-Jouf University", color: "#34d399" },
  { period: "2011 — 2014", roleAr: "محاضر — منسق السنة التحضيرية", roleEn: "Lecturer — Prep Year Coordinator", placeAr: "كليات الغد الدولية", placeEn: "Al-Ghad International Colleges", color: "#34d399" },
];

const SKILLS = [
  { icon: "📊", ar: "تحليل السلاسل الزمنية (ARIMA)", en: "Time Series Analysis (ARIMA)" },
  { icon: "📉", ar: "تحليل الانحدار", en: "Regression Analysis" },
  { icon: "🔬", ar: "تصميم المسوحات الإحصائية", en: "Statistical Survey Design" },
  { icon: "📝", ar: "مناهج البحث العلمي", en: "Research Methodology" },
  { icon: "🎓", ar: "التدريس الجامعي والتدريب", en: "University Teaching & Training" },
];

const SOFTWARE = ["SPSS", "Minitab", "EViews", "Stata", "Excel", "Word"];

const PUBS_SHORT = [
  "Box-Jenkins Models to Predict Sesame Produce (1960–2012)",
  "Forecasting of Sudan Inflation Rates Using ARIMA",
  "Measuring Saudi Dates Exports to Indonesia",
  "GDP Modelling — Agriculture, Petroleum, Electricity (KSA)",
  "Wholesale & Retail Trade GDP Prediction — KSA",
  "Gum Arabic Production Prediction Using Time Series",
];

// ─── Channel Card ─────────────────────────────────────────────────────────────
function ChannelCard({ href, icon, name, handleAr, handleEn, color, gradient, desc }: {
  href: string; icon: React.ReactNode; name: string; handleAr: string; handleEn: string;
  color: string; gradient: string; desc: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", flex: 1, minWidth: 200 }}>
      <div style={{
        background: `linear-gradient(135deg,${gradient})`,
        border: `1.5px solid ${color}30`,
        borderRadius: 20, padding: "28px 24px",
        textAlign: "center", cursor: "pointer",
        transition: "transform .15s, box-shadow .15s",
        boxShadow: `0 8px 32px ${color}18`,
        height: "100%",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 60px ${color}30`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${color}18`; }}
      >
        <div style={{ fontSize: 48, marginBottom: 14, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>{icon}</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#fff", marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 13, color: color, fontWeight: 700, marginBottom: 10, fontFamily: "monospace" }}>{handleAr}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>{handleEn}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, marginBottom: 20 }}>{desc}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: color + "25", border: `1px solid ${color}50`, borderRadius: 100, padding: "7px 16px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 8px ${color}` }} />
          <span style={{ fontSize: 12, fontWeight: 700, color }}>تابع الآن</span>
        </div>
      </div>
    </a>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function About() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ padding: "32px 20px 80px", maxWidth: 820, margin: "0 auto", fontFamily: isAr ? "'Tajawal',sans-serif" : "'Inter',sans-serif" }}>

      {/* ── HERO PROFILE ── */}
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        {/* Avatar */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg,#C9A84C,#a07830)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, boxShadow: "0 0 40px #C9A84C33, 0 0 0 4px rgba(201,168,76,0.15)", margin: "0 auto" }}>
            👨‍🏫
          </div>
          <div style={{ position: "absolute", bottom: 2, right: 2, width: 22, height: 22, borderRadius: "50%", background: "#10b981", border: "3px solid #050913", boxShadow: "0 0 8px #10b981" }} />
        </div>

        {/* Name */}
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {isAr ? "د. أبوذر يوسف علي أحمد" : "Dr. Abuzar Yousef Ali Ahmed"}
        </h1>

        {/* Title badge */}
        <div style={{ display: "inline-block", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 100, padding: "5px 18px", marginBottom: 14 }}>
          <span style={{ color: "#C9A84C", fontSize: 13, fontWeight: 700 }}>
            {isAr ? "أستاذ مساعد في الإحصاء" : "Assistant Professor of Statistics"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: "🇸🇩", label: isAr ? "سوداني" : "Sudanese" },
            { icon: "🎓", label: isAr ? "+٢٠ سنة خبرة" : "20+ Years Exp." },
            { icon: "📚", label: isAr ? "١٢ بحثاً منشوراً" : "12 Publications" },
            { icon: "🌐", label: isAr ? "عربي · إنجليزي" : "Arabic · English" },
          ].map(b => (
            <span key={b.label} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#64748b" }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── CHANNELS — تواصل معي ── */}
      <section style={{ marginBottom: 44 }}>
        <SectionTitle icon="📡" ar="تواصل معي عبر قنواتي" en="Connect With Me" isAr={isAr} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <ChannelCard
            href="https://www.youtube.com/@D.Abuzar"
            icon="▶️"
            name="YouTube"
            handleAr="@D.Abuzar"
            handleEn="youtube.com/@D.Abuzar"
            color="#FF0000"
            gradient="#1a0000,#2d0808"
            desc={isAr ? "دروس إحصاء، تحليل بيانات، SPSS، وأبحاث علمية" : "Statistics tutorials, data analysis, SPSS & research"}
          />
          <ChannelCard
            href="https://www.tiktok.com/@dr.abuzar79"
            icon="🎵"
            name="TikTok"
            handleAr="@dr.abuzar79"
            handleEn="tiktok.com/@dr.abuzar79"
            color="#69C9D0"
            gradient="#00111a,#001a1a"
            desc={isAr ? "محتوى تعليمي سريع في الإحصاء والبحث العلمي" : "Short educational content in statistics & research"}
          />
        </div>
      </section>

      {/* ── EDUCATION ── */}
      <section style={{ marginBottom: 40 }}>
        <SectionTitle icon="🎓" ar="المؤهلات العلمية" en="Education" isAr={isAr} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EDUCATION.map((e, i) => (
            <div key={i} style={{ background: "#0e1829", border: "1.5px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ minWidth: 52, height: 52, borderRadius: 13, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "column" }}>
                <span style={{ color: "#C9A84C", fontSize: 11, fontWeight: 900 }}>{e.year}</span>
              </div>
              <div>
                <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{isAr ? e.degreeAr : e.degreeEn}</div>
                <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.6 }}>{isAr ? e.instAr : e.instEn}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EXPERIENCE ── */}
      <section style={{ marginBottom: 40 }}>
        <SectionTitle icon="💼" ar="الخبرات المهنية" en="Professional Experience" isAr={isAr} />
        <div style={{ position: "relative" }}>
          {/* Timeline line */}
          <div style={{ position: "absolute", top: 0, bottom: 0, [isAr ? "right" : "left"]: 23, width: 2, background: "linear-gradient(to bottom,#C9A84C44,transparent)", borderRadius: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, [isAr ? "paddingRight" : "paddingLeft"]: 54 }}>
            {EXPERIENCE.map((ex, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Dot */}
                <div style={{ position: "absolute", [isAr ? "right" : "left"]: -40, top: 18, width: 10, height: 10, borderRadius: "50%", background: ex.color, boxShadow: `0 0 8px ${ex.color}` }} />
                <div style={{ background: "#0e1829", border: `1.5px solid ${ex.color}15`, borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{isAr ? ex.roleAr : ex.roleEn}</div>
                      <div style={{ color: "#475569", fontSize: 11.5, lineHeight: 1.6 }}>{isAr ? ex.placeAr : ex.placeEn}</div>
                    </div>
                    <span style={{ background: ex.color + "14", border: `1px solid ${ex.color}28`, borderRadius: 6, padding: "2px 8px", color: ex.color, fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {ex.period}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SKILLS + SOFTWARE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 40 }}>
        <section>
          <SectionTitle icon="⚡" ar="المهارات" en="Skills" isAr={isAr} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SKILLS.map((s, i) => (
              <div key={i} style={{ background: "#0e1829", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>{isAr ? s.ar : s.en}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle icon="🖥️" ar="البرامج الإحصائية" en="Statistical Software" isAr={isAr} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SOFTWARE.map(sw => (
              <div key={sw} style={{ background: "#0e1829", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: 13, fontFamily: "monospace" }}>{sw}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <SectionTitle icon="🌍" ar="اللغات" en="Languages" isAr={isAr} />
            <div style={{ display: "flex", gap: 8 }}>
              {[{ flag: "🇸🇦", name: isAr ? "العربية" : "Arabic" }, { flag: "🇬🇧", name: isAr ? "الإنجليزية" : "English" }].map(l => (
                <div key={l.name} style={{ flex: 1, background: "#0e1829", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{l.flag}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                  <div style={{ color: "#334155", fontSize: 10 }}>{isAr ? "طلاقة" : "Fluent"}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── PUBLICATIONS ── */}
      <section style={{ marginBottom: 40 }}>
        <SectionTitle icon="📖" ar="أبرز الأبحاث المنشورة" en="Selected Publications" isAr={isAr} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PUBS_SHORT.map((pub, i) => (
            <div key={i} style={{ background: "#0e1829", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(167,139,250,0.15)", color: "#a78bfa", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ color: "#64748b", fontSize: 12.5, lineHeight: 1.65 }}>{pub}</span>
            </div>
          ))}
          <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700 }}>📚 {isAr ? "وأبحاث أخرى — إجمالي ١٢ بحثاً منشوراً" : "And more — 12 publications in total"}</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: "center", padding: "20px 0 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ color: "#1e2d40", fontSize: 12, margin: 0 }}>
          {isAr ? "© 2025 منصة محكّم — جميع الحقوق محفوظة" : "© 2025 Muhakkim Platform — All Rights Reserved"}
        </p>
      </div>
    </div>
  );
}

// ─── Section Title helper ─────────────────────────────────────────────────────
function SectionTitle({ icon, ar, en, isAr }: { icon: string; ar: string; en: string; isAr: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h2 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#C9A84C" }}>{isAr ? ar : en}</h2>
      <div style={{ flex: 1, height: 1, background: "rgba(201,168,76,0.12)" }} />
    </div>
  );
}
