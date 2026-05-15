import React, { createContext, useContext, useState, ReactNode } from 'react';

type Lang = 'ar' | 'en';
type Dir = 'rtl' | 'ltr';

const translations = {
  ar: {
    app_title: "محكّم | Muhakkim",
    toggle_lang: "EN",
    tab_upload: "رفع الملف",
    tab_proofread: "التدقيق اللغوي",
    tab_stats: "محلل المخرجات الإحصائية",
    tab_equations: "فاحص المعادلات",
    tab_qr: "مولّد رمز QR",
    tab_report: "تقرير التحكيم",
    tab_about: "عن البرنامج",
    upload_drag: "اسحب وأفلت الملف هنا أو انقر للتصفح",
    upload_accept: "يقبل ملفات PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD",
    upload_clear: "مسح",
    proofread_placeholder: "أدخل النص هنا للتدقيق...",
    proofread_run: "تشغيل التدقيق",
    proofread_copy: "نسخ النص",
    stats_placeholder: "الصق المخرجات الإحصائية هنا...",
    stats_run: "تحليل المخرجات",
    eq_placeholder: "الصق المعادلات هنا...",
    eq_run: "فحص المعادلات",
    qr_url: "الرابط أو النص",
    qr_size: "الحجم",
    qr_generate: "توليد الرمز",
    qr_download: "تحميل الرمز",
    report_title: "عنوان الورقة",
    report_author: "اسم المؤلف",
    report_reviewer: "اسم المحكم",
    report_date: "التاريخ",
    report_originality: "الأصالة",
    report_methodology: "المنهجية",
    report_lit: "مراجعة الأدبيات",
    report_clarity: "الوضوح",
    report_contrib: "الإسهام العلمي",
    report_rec: "التوصية",
    report_comments: "تعليقات للمؤلف",
    report_generate: "توليد التقرير",
    report_print: "طباعة / تحميل",
    about_desc: "محكّم هو أداة مساعدة للباحثين والمحكمين الأكاديميين، يقدم مجموعة من الأدوات التي تسهل عملية المراجعة الأكاديمية.",
    about_version: "الإصدار",
    about_features: "المميزات",
    about_link: "رابط التطبيق",
  },
  en: {
    app_title: "محكّم | Muhakkim",
    toggle_lang: "AR",
    tab_upload: "File Upload",
    tab_proofread: "Language Proofreading",
    tab_stats: "Statistical Output Parser",
    tab_equations: "Equation Checker",
    tab_qr: "QR Code Generator",
    tab_report: "Review Report",
    tab_about: "About",
    upload_drag: "Drag and drop file here or click to browse",
    upload_accept: "Accepts PDF, DOC, DOCX, TXT, HTML, RTF, ODT, MD files",
    upload_clear: "Clear",
    proofread_placeholder: "Enter text here to proofread...",
    proofread_run: "Run Proofreading",
    proofread_copy: "Copy Text",
    stats_placeholder: "Paste statistical output here...",
    stats_run: "Parse Output",
    eq_placeholder: "Paste equations here...",
    eq_run: "Check Equations",
    qr_url: "URL or Text",
    qr_size: "Size",
    qr_generate: "Generate QR",
    qr_download: "Download QR",
    report_title: "Paper Title",
    report_author: "Author Name",
    report_reviewer: "Reviewer Name",
    report_date: "Date",
    report_originality: "Originality",
    report_methodology: "Methodology",
    report_lit: "Literature Review",
    report_clarity: "Clarity",
    report_contrib: "Contribution",
    report_rec: "Recommendation",
    report_comments: "Comments to Author",
    report_generate: "Generate Report",
    report_print: "Print / Download",
    about_desc: "Muhakkim is an assistant tool for researchers and academic reviewers, providing a suite of tools to facilitate the peer-review process.",
    about_version: "Version",
    about_features: "Features",
    about_link: "App Link",
  }
};

type LanguageContextType = {
  lang: Lang;
  dir: Dir;
  setLang: (lang: Lang) => void;
  t: (key: keyof typeof translations['en']) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar');
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, t }}>
      <div dir={dir} className="min-h-screen w-full bg-background text-foreground transition-all duration-300">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}