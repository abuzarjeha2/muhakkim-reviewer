import { useState } from "react";

const TOOLS = [
  { icon: "📂", ar: "رفع الملف",        en: "File Upload",       color: "#C9A84C", bg: "#C9A84C18" },
  { icon: "📝", ar: "التدقيق اللغوي",  en: "Proofreader",       color: "#60a5fa", bg: "#60a5fa18" },
  { icon: "🤖", ar: "تدقيق AI",         en: "AI Proofread",      color: "#a78bfa", bg: "#a78bfa18" },
  { icon: "🛡️", ar: "كشف AI",           en: "AI Detector",       color: "#34d399", bg: "#34d39918" },
  { icon: "📖", ar: "اقتباس وانتحال",  en: "Citation & Plagiarism", color: "#f87171", bg: "#f8717118" },
  { icon: "🔬", ar: "مختبر البيانات",  en: "Data Lab",           color: "#38bdf8", bg: "#38bdf818" },
  { icon: "📋", ar: "تقرير التحكيم",   en: "Review Report",     color: "#fb923c", bg: "#fb923c18" },
  { icon: "📷", ar: "مولّد QR",         en: "QR Generator",      color: "#e879f9", bg: "#e879f918" },
  { icon: "💬", ar: "لوحة المناقشة",   en: "Discussion",        color: "#4ade80", bg: "#4ade8018" },
  { icon: "🏢", ar: "خدماتنا",          en: "Our Services",      color: "#C9A84C", bg: "#C9A84C18" },
];

export function MuhakkimHome() {
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const isAr = lang === "ar";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#080e1c",
        fontFamily: isAr
          ? "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif"
          : "'Inter', 'Segoe UI', sans-serif",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          padding: "18px 20px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ffffff0a",
          background: "#080e1c",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg,#C9A84C,#a07830)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 0 16px #C9A84C44",
            }}
          >
            ⚖️
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#C9A84C", lineHeight: 1.2 }}>
              {isAr ? "محكّم" : "Muhakkim"}
            </div>
            <div style={{ fontSize: 10, color: "#475569" }}>
              {isAr ? "منصة التدقيق الأكاديمي الذكي" : "Smart Academic Review"}
            </div>
          </div>
        </div>

        {/* Language toggle */}
        <button
          onClick={() => setLang(isAr ? "en" : "ar")}
          style={{
            background: "#ffffff0d",
            border: "1px solid #ffffff18",
            borderRadius: 8,
            color: "#C9A84C",
            fontWeight: 700,
            fontSize: 12,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          {isAr ? "EN" : "AR"}
        </button>
      </header>

      {/* ── Scrollable Content ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "22px 16px 140px" }}>
        {/* Section title */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#f1f5f9",
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {isAr ? "استكشف أدوات محكّم" : "Explore Muhakkim"}
        </h1>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 22px", lineHeight: 1.7 }}>
          {isAr
            ? "اختر أداة للبدء · يدعم العربية والإنجليزية"
            : "Choose a tool to get started · Supports Arabic & English"}
        </p>

        {/* Tool Grid — 2 columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {TOOLS.map((tool, i) => {
            const isActive = active === i;
            return (
              <button
                key={i}
                onClick={() => setActive(isActive ? null : i)}
                style={{
                  background: isActive ? tool.bg + "cc" : "#0e1829",
                  border: `1.5px solid ${isActive ? tool.color + "88" : "#ffffff0e"}`,
                  borderRadius: 16,
                  padding: "18px 14px",
                  textAlign: isAr ? "right" : "left",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "all .18s",
                  outline: "none",
                  transform: isActive ? "scale(0.97)" : "scale(1)",
                  boxShadow: isActive ? `0 0 18px ${tool.color}22` : "none",
                }}
              >
                {/* Icon box */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: tool.bg,
                    border: `1px solid ${tool.color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {tool.icon}
                </div>
                {/* Label */}
                <div
                  style={{
                    color: isActive ? tool.color : "#cbd5e1",
                    fontWeight: 700,
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  {isAr ? tool.ar : tool.en}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick start link */}
        <div style={{ marginTop: 24, textAlign: isAr ? "right" : "left" }}>
          <span
            style={{
              color: "#C9A84C",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {isAr ? "ابدأ برفع ملف" : "Start by uploading a file"}
            <span style={{ display: "inline-block", transform: isAr ? "scaleX(-1)" : "none" }}>→</span>
          </span>
        </div>
      </main>

      {/* ── Sticky Bottom Input ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: "linear-gradient(to top, #080e1c 70%, transparent)",
          padding: "12px 16px 20px",
          zIndex: 20,
        }}
      >
        <div
          style={{
            background: "#0e1829",
            border: "1.5px solid #ffffff18",
            borderRadius: 16,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 -4px 30px #00000066",
          }}
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isAr ? "اكتب طلباً أو أسقط ملفاً…" : "Type a prompt or drop a file…"}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e2e8f0",
              fontSize: 13,
              fontFamily: "inherit",
              textAlign: isAr ? "right" : "left",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#ffffff0d",
                border: "1px solid #ffffff15",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              📎
            </button>
            <button
              style={{
                height: 32,
                borderRadius: 8,
                background: prompt
                  ? "linear-gradient(135deg,#C9A84C,#a07830)"
                  : "#ffffff0d",
                border: `1px solid ${prompt ? "#C9A84C44" : "#ffffff15"}`,
                color: prompt ? "#080e1c" : "#475569",
                fontWeight: 700,
                fontSize: 12,
                padding: "0 14px",
                cursor: "pointer",
                transition: "all .18s",
                fontFamily: "inherit",
              }}
            >
              {isAr ? "إرسال" : "Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
