import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../lib/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────
type Page = "home" | "about" | "services" | "pricing" | "testimonials" | "training" | "contact";

// ─── Bilingual Content ───────────────────────────────────────────────────────
const C = {
  ar: {
    nav: {
      home: "الرئيسية", about: "من نحن", services: "الخدمات",
      pricing: "الأسعار", testimonials: "آراء العملاء", training: "التدريب", contact: "تواصل معنا",
    },
    hero: {
      badge: "شركة استشارات إحصائية احترافية",
      title: "خدمات إحصائية متميزة لبحثك العلمي",
      subtitle: "نقدم حلولاً إحصائية متكاملة للباحثين وطلاب الدراسات العليا في المملكة العربية السعودية والوطن العربي",
      cta1: "تواصل معنا الآن",
      cta2: "استكشف خدماتنا",
    },
    stats: [
      { value: "500+", label: "عميل راضٍ" },
      { value: "1000+", label: "دراسة مكتملة" },
      { value: "99%", label: "رضا العملاء" },
      { value: "10+", label: "سنوات خبرة" },
    ],
    servicesTitle: "خدماتنا الإحصائية",
    servicesSubtitle: "نقدم مجموعة شاملة من الخدمات الإحصائية المتخصصة لدعم رحلتك البحثية",
    services: [
      { icon: "📊", title: "تحليل البيانات", desc: "تحليل إحصائي شامل باستخدام SPSS وR وSTATA — اختبارات t، ANOVA، انحدار، وأكثر", page: "services" as Page },
      { icon: "📋", title: "جمع البيانات", desc: "تصميم وتنفيذ أدوات جمع البيانات والاستبانات الإلكترونية والورقية", page: "services" as Page },
      { icon: "📈", title: "تفسير النتائج", desc: "شرح وتفسير النتائج الإحصائية وكتابة قسم النتائج بأسلوب علمي دقيق", page: "services" as Page },
      { icon: "🎯", title: "تصميم الاستبانات", desc: "بناء استبانات علمية محكّمة مع قياس الصدق والثبات", page: "services" as Page },
      { icon: "🎓", title: "التدريب الإحصائي", desc: "دورات تدريبية متخصصة في البرامج الإحصائية ومناهج البحث", page: "training" as Page },
      { icon: "🌐", title: "الترجمة العلمية", desc: "ترجمة دقيقة للأبحاث والدراسات بين العربية والإنجليزية", page: "services" as Page },
      { icon: "📚", title: "دراسات الحالة", desc: "إعداد وتحليل دراسات الحالة المعمّقة وفق المعايير الأكاديمية", page: "services" as Page },
      { icon: "👨‍🏫", title: "التدريس الخصوصي", desc: "جلسات فردية في مناهج البحث والإحصاء لطلاب الدراسات العليا", page: "services" as Page },
    ],
    testimonialsTitle: "ماذا يقول عملاؤنا",
    testimonialsSubtitle: "آراء حقيقية من باحثين استفادوا من خدماتنا",
    testimonials: [
      { name: "د. سارة المطيري", title: "أستاذة مساعدة - جامعة الملك سعود", text: "خدمة ممتازة ومهنية عالية. ساعدني الفريق في تحليل بيانات رسالتي الدكتورية بدقة متناهية ووفّروا عليّ الكثير من الوقت.", stars: 5 },
      { name: "م. خالد الغامدي", title: "باحث دكتوراه - جامعة الملك عبدالعزيز", text: "أفضل خدمة إحصائية تعاملت معها. الفريق محترف وملتزم بالمواعيد وشرح لي كل تفاصيل التحليل.", stars: 5 },
      { name: "أ. منى العمري", title: "طالبة ماجستير - جامعة الإمام", text: "ساعدوني في تصميم استبانتي وتحليل بياناتها. النتائج كانت واضحة ومنظمة. أنصح كل باحث بالتواصل معهم.", stars: 5 },
      { name: "د. فيصل السهلي", title: "مستشار إداري", text: "استخدمت خدماتهم في تحليل بيانات مشروع بحثي للشركة. دقة عالية وسرعة في التسليم. سأتعاون معهم مجدداً.", stars: 5 },
      { name: "أ. نوف الحربي", title: "باحثة - وزارة الصحة", text: "فريق متميز ساعدني في كتابة الفصل الرابع والخامس من رسالتي. الشرح كان واضحاً وفهمت التحليل بالكامل.", stars: 5 },
    ],
    pricing: {
      title: "باقات الأسعار", subtitle: "اختر الباقة المناسبة لاحتياجاتك البحثية",
      note: "* جميع الأسعار تشمل ضريبة القيمة المضافة | تواصل معنا للحصول على عرض مخصص",
      tiers: [
        {
          name: "الأساسية", price: "٢٩٩", currency: "ر.س", period: "للدراسة",
          color: "#64748b", features: ["تحليل وصفي أساسي", "حتى ٥٠٠ مفردة", "تقرير بسيط", "تسليم خلال ٣ أيام", "دعم بالواتساب"],
          notIncluded: ["تحليل تحريري", "اختبارات متقدمة", "تدريب"],
        },
        {
          name: "الاحترافية", price: "٥٩٩", currency: "ر.س", period: "للدراسة",
          color: "#C9A84C", featured: true,
          features: ["تحليل إحصائي شامل", "حتى ٢٠٠٠ مفردة", "تقرير مفصّل", "تسليم خلال يومين", "شرح النتائج", "مراجعة مجانية"],
          notIncluded: ["تدريب مخصص"],
        },
        {
          name: "المتقدمة", price: "٩٩٩", currency: "ر.س", period: "للدراسة",
          color: "#93c5fd",
          features: ["تحليل متقدم شامل", "عدد غير محدود للمفردات", "تقرير علمي احترافي", "تسليم خلال يوم", "جلسة شرح مباشرة", "مراجعتان مجانيتان", "دعم أولوية"],
          notIncluded: [],
        },
        {
          name: "المؤسسية", price: "حسب الطلب", currency: "", period: "",
          color: "#5eead4",
          features: ["لأبحاث الجهات والمراكز", "اتفاقية تعاون مستمر", "فريق متخصص", "تقارير دورية", "تدريب للفريق", "دعم على مدار الساعة"],
          notIncluded: [],
        },
      ],
    },
    training: {
      title: "برامج التدريب الإحصائي",
      subtitle: "دورات متخصصة تؤهلك للتعامل مع البيانات باحترافية",
      courses: [
        { icon: "📊", title: "SPSS للمبتدئين", desc: "مقدمة شاملة لبرنامج SPSS: الإدخال، التحليل الوصفي، والاختبارات الأساسية", duration: "١٠ ساعات", price: "٣٩٩ ر.س", level: "مبتدئ" },
        { icon: "📉", title: "R للباحثين", desc: "لغة R للتحليل الإحصائي: البيانات، المرئيات، والنمذجة الإحصائية", duration: "١٥ ساعة", price: "٥٩٩ ر.س", level: "متوسط" },
        { icon: "🔢", title: "الإحصاء الاستدلالي", desc: "اختبارات الفرضيات، ANOVA، الانحدار، وتحليل الارتباط بعمق", duration: "١٢ ساعة", price: "٤٩٩ ر.س", level: "متوسط" },
        { icon: "📐", title: "SEM - النمذجة بالمعادلات", desc: "تحليل المسار ونمذجة المعادلات الهيكلية باستخدام AMOS وSmartPLS", duration: "٢٠ ساعة", price: "٨٩٩ ر.س", level: "متقدم" },
        { icon: "🗂️", title: "تصميم الاستبانات", desc: "بناء أدوات قياس علمية وقياس الصدق والثبات بأساليب حديثة", duration: "٨ ساعات", price: "٣٤٩ ر.س", level: "مبتدئ" },
        { icon: "🧪", title: "مناهج البحث العلمي", desc: "التصاميم البحثية، اختيار العينة، وكتابة الفصول المنهجية", duration: "١٢ ساعة", price: "٤٩٩ ر.س", level: "متوسط" },
      ],
    },
    about: {
      title: "من نحن",
      subtitle: "فريق متخصص في الاستشارات الإحصائية والبحث العلمي",
      story: "تأسست شركتنا لخدمة الباحثين والأكاديميين في المملكة العربية السعودية والوطن العربي، بهدف تقديم دعم إحصائي احترافي يرتقي بمستوى الأبحاث العلمية. نؤمن بأن كل باحث يستحق التميّز.",
      mission: "رسالتنا",
      missionText: "تمكين الباحثين من تحقيق أعلى مستويات الجودة في أبحاثهم العلمية من خلال تقديم خدمات إحصائية متكاملة وموثوقة.",
      values: ["الدقة العلمية", "الأمانة والنزاهة", "الالتزام بالمواعيد", "السرية التامة", "الجودة المستمرة"],
      team: [
        { name: "د. محمد العنزي", role: "المؤسس والمدير التنفيذي", bg: "#C9A84C" },
        { name: "أ. ريم الشمري", role: "كبيرة المحللين الإحصائيين", bg: "#93c5fd" },
        { name: "د. علي القحطاني", role: "مستشار المناهج البحثية", bg: "#5eead4" },
        { name: "أ. دانة السعيد", role: "متخصصة الترجمة العلمية", bg: "#c4b5fd" },
      ],
    },
    contact: {
      title: "تواصل معنا",
      subtitle: "نحن هنا للإجابة على جميع استفساراتك",
      phone: "٠٥٤ ٦٥٣ ٠٢٦٤",
      phoneRaw: "+966546530264",
      whatsappMsg: "السلام عليكم، أود الاستفسار عن خدماتكم الإحصائية",
      address: "المملكة العربية السعودية",
      form: { name: "الاسم الكامل", email: "البريد الإلكتروني", service: "الخدمة المطلوبة", message: "رسالتك", submit: "إرسال الرسالة" },
      sent: "تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.",
      whatsappBtn: "تواصل عبر واتساب",
    },
    allServices: {
      title: "جميع خدماتنا",
      items: [
        { icon: "📊", title: "تحليل البيانات", desc: "تحليل إحصائي احترافي باستخدام SPSS وR وSTATA. اختبارات t وANOVA والانحدار الخطي والمتعدد وتحليل الارتباط والاختبارات اللابارامترية وغيرها." },
        { icon: "📋", title: "جمع البيانات", desc: "تصميم وتنفيذ أدوات جمع البيانات الإلكترونية والورقية. إدارة العينات وضبط الجودة في الميدان." },
        { icon: "📈", title: "تفسير النتائج", desc: "شرح مفصّل للنتائج الإحصائية وكتابة قسم النتائج والمناقشة بأسلوب علمي رصين متوافق مع معايير النشر." },
        { icon: "🎯", title: "تصميم الاستبانات", desc: "بناء استبانات علمية تقيس ما صُمّمت لقياسه. حساب معامل ألفا كرونباخ والاتساق الداخلي والصدق البنائي." },
        { icon: "🌐", title: "الترجمة العلمية", desc: "ترجمة احترافية للأبحاث والدراسات بين العربية والإنجليزية مع الحفاظ على الدقة المصطلحية والأسلوب الأكاديمي." },
        { icon: "📚", title: "دراسات الحالة", desc: "إعداد وتحليل دراسات الحالة المعمّقة وفق المنهج الكيفي والكمي والمختلط، مع توثيق علمي دقيق." },
        { icon: "📝", title: "تحليل الاستبانات", desc: "تفريغ وتحليل الاستبانات المكتملة واستخراج النتائج وإعداد تقرير شامل بالجداول والرسوم البيانية." },
        { icon: "👨‍🏫", title: "التدريس الخصوصي", desc: "جلسات فردية مخصصة في مناهج البحث والإحصاء لطلاب الدراسات العليا. بالسرعة التي تناسبك." },
      ],
    },
  },
  en: {
    nav: {
      home: "Home", about: "About", services: "Services",
      pricing: "Pricing", testimonials: "Testimonials", training: "Training", contact: "Contact",
    },
    hero: {
      badge: "Professional Statistical Consulting",
      title: "Expert Statistical Services for Your Research",
      subtitle: "Comprehensive statistical solutions for researchers and graduate students in Saudi Arabia and the Arab world",
      cta1: "Contact Us Now",
      cta2: "Explore Our Services",
    },
    stats: [
      { value: "500+", label: "Satisfied Clients" },
      { value: "1000+", label: "Studies Completed" },
      { value: "99%", label: "Client Satisfaction" },
      { value: "10+", label: "Years of Experience" },
    ],
    servicesTitle: "Our Statistical Services",
    servicesSubtitle: "A comprehensive suite of specialized statistical services to support your research journey",
    services: [
      { icon: "📊", title: "Data Analysis", desc: "Full statistical analysis using SPSS, R, and STATA — t-tests, ANOVA, regression, and more", page: "services" as Page },
      { icon: "📋", title: "Data Collection", desc: "Design and implementation of data collection tools and surveys (electronic & paper)", page: "services" as Page },
      { icon: "📈", title: "Results Interpretation", desc: "Clear explanation of statistical results and professional academic writing of findings chapters", page: "services" as Page },
      { icon: "🎯", title: "Survey Design", desc: "Scientifically validated questionnaires with reliability and validity measurement", page: "services" as Page },
      { icon: "🎓", title: "Statistical Training", desc: "Specialized workshops in statistical software and research methodologies", page: "training" as Page },
      { icon: "🌐", title: "Scientific Translation", desc: "Accurate Arabic↔English translation of research papers and academic documents", page: "services" as Page },
      { icon: "📚", title: "Case Studies", desc: "In-depth case study analysis following quantitative, qualitative, or mixed methods", page: "services" as Page },
      { icon: "👨‍🏫", title: "Private Tutoring", desc: "One-on-one sessions in research methodology and statistics for graduate students", page: "services" as Page },
    ],
    testimonialsTitle: "What Our Clients Say",
    testimonialsSubtitle: "Real feedback from researchers who benefited from our services",
    testimonials: [
      { name: "Dr. Sara Al-Mutairi", title: "Assistant Professor, King Saud University", text: "Excellent and highly professional service. The team helped me analyze my doctoral dissertation data with great precision and saved me considerable time.", stars: 5 },
      { name: "Eng. Khaled Al-Ghamdi", title: "PhD Researcher, King Abdulaziz University", text: "The best statistical service I've ever worked with. The team is professional, punctual, and thoroughly explained every detail of the analysis.", stars: 5 },
      { name: "Mona Al-Omari", title: "Masters Student, Imam University", text: "They helped me design my questionnaire and analyze its data. The results were clear and well-organized. I recommend every researcher to contact them.", stars: 5 },
      { name: "Dr. Faisal Al-Sahli", title: "Management Consultant", text: "Used their services for a company research project. High accuracy and fast delivery. I will definitely collaborate with them again.", stars: 5 },
      { name: "Noof Al-Harbi", title: "Researcher, Ministry of Health", text: "An outstanding team that helped me write chapters four and five of my thesis. The explanations were clear and I fully understood the analysis.", stars: 5 },
    ],
    pricing: {
      title: "Pricing Plans", subtitle: "Choose the plan that suits your research needs",
      note: "* All prices include VAT | Contact us for a custom quote",
      tiers: [
        {
          name: "Basic", price: "299", currency: "SAR", period: "per study",
          color: "#64748b", features: ["Basic descriptive analysis", "Up to 500 cases", "Simple report", "3-day delivery", "WhatsApp support"],
          notIncluded: ["Advanced inferential analysis", "Advanced tests", "Training"],
        },
        {
          name: "Professional", price: "599", currency: "SAR", period: "per study",
          color: "#C9A84C", featured: true,
          features: ["Full statistical analysis", "Up to 2000 cases", "Detailed report", "2-day delivery", "Results explanation", "Free revision"],
          notIncluded: ["Custom training"],
        },
        {
          name: "Advanced", price: "999", currency: "SAR", period: "per study",
          color: "#93c5fd",
          features: ["Comprehensive advanced analysis", "Unlimited cases", "Professional academic report", "1-day delivery", "Live explanation session", "2 free revisions", "Priority support"],
          notIncluded: [],
        },
        {
          name: "Enterprise", price: "Custom", currency: "", period: "",
          color: "#5eead4",
          features: ["For institutions & research centers", "Ongoing collaboration agreement", "Dedicated team", "Periodic reports", "Team training", "24/7 support"],
          notIncluded: [],
        },
      ],
    },
    training: {
      title: "Statistical Training Programs",
      subtitle: "Specialized courses to equip you with professional data handling skills",
      courses: [
        { icon: "📊", title: "SPSS for Beginners", desc: "Comprehensive introduction to SPSS: data entry, descriptive analysis, and basic tests", duration: "10 hours", price: "399 SAR", level: "Beginner" },
        { icon: "📉", title: "R for Researchers", desc: "R language for statistical analysis: data manipulation, visualizations, and statistical modeling", duration: "15 hours", price: "599 SAR", level: "Intermediate" },
        { icon: "🔢", title: "Inferential Statistics", desc: "Hypothesis testing, ANOVA, regression, and correlation analysis in depth", duration: "12 hours", price: "499 SAR", level: "Intermediate" },
        { icon: "📐", title: "SEM - Structural Equation Modeling", desc: "Path analysis and SEM using AMOS and SmartPLS", duration: "20 hours", price: "899 SAR", level: "Advanced" },
        { icon: "🗂️", title: "Survey Design", desc: "Building valid measurement instruments and assessing reliability and construct validity", duration: "8 hours", price: "349 SAR", level: "Beginner" },
        { icon: "🧪", title: "Research Methodology", desc: "Research designs, sampling, and writing methodology chapters", duration: "12 hours", price: "499 SAR", level: "Intermediate" },
      ],
    },
    about: {
      title: "About Us",
      subtitle: "A team specializing in statistical consulting and academic research",
      story: "Our company was founded to serve researchers and academics in Saudi Arabia and the Arab world, with the goal of providing professional statistical support that elevates the quality of scientific research. We believe every researcher deserves excellence.",
      mission: "Our Mission",
      missionText: "To empower researchers to achieve the highest quality in their scientific work through comprehensive, reliable statistical services.",
      values: ["Scientific Accuracy", "Integrity & Honesty", "Commitment to Deadlines", "Full Confidentiality", "Continuous Quality"],
      team: [
        { name: "Dr. Mohammed Al-Anzi", role: "Founder & CEO", bg: "#C9A84C" },
        { name: "Reem Al-Shamri", role: "Senior Statistical Analyst", bg: "#93c5fd" },
        { name: "Dr. Ali Al-Qahtani", role: "Research Methods Consultant", bg: "#5eead4" },
        { name: "Dana Al-Saeed", role: "Scientific Translation Specialist", bg: "#c4b5fd" },
      ],
    },
    contact: {
      title: "Contact Us",
      subtitle: "We are here to answer all your inquiries",
      phone: "+966 54 653 0264",
      phoneRaw: "+966546530264",
      whatsappMsg: "Hello, I would like to inquire about your statistical services",
      address: "Kingdom of Saudi Arabia",
      form: { name: "Full Name", email: "Email Address", service: "Service Requested", message: "Your Message", submit: "Send Message" },
      sent: "Your message was sent successfully! We will contact you shortly.",
      whatsappBtn: "Chat on WhatsApp",
    },
    allServices: {
      title: "All Our Services",
      items: [
        { icon: "📊", title: "Data Analysis", desc: "Professional statistical analysis using SPSS, R, and STATA. t-tests, ANOVA, linear and multiple regression, correlation, non-parametric tests, and more." },
        { icon: "📋", title: "Data Collection", desc: "Design and implementation of electronic and paper data collection tools. Sample management and field quality control." },
        { icon: "📈", title: "Results Interpretation", desc: "Detailed explanation of statistical results and writing findings and discussion sections in rigorous academic style." },
        { icon: "🎯", title: "Survey Design", desc: "Building scientifically validated questionnaires. Computing Cronbach's alpha, internal consistency, and construct validity." },
        { icon: "🌐", title: "Scientific Translation", desc: "Professional Arabic↔English translation of research and studies with accurate terminology and academic style." },
        { icon: "📚", title: "Case Studies", desc: "Preparation and analysis of in-depth case studies using qualitative, quantitative, or mixed methods." },
        { icon: "📝", title: "Survey Analysis", desc: "Coding and analyzing completed surveys, extracting results, and preparing comprehensive reports with tables and charts." },
        { icon: "👨‍🏫", title: "Private Tutoring", desc: "Personalized one-on-one sessions in research methodology and statistics for graduate students at your own pace." },
      ],
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const G = "#C9A84C";
const CARD = "rgba(13,23,45,0.88)";
const BORDER = "rgba(201,168,76,0.18)";

function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, ...extra };
}

function Stars({ n }: { n: number }) {
  return <span style={{ color: G, letterSpacing: 2 }}>{"★".repeat(n)}</span>;
}

function Avatar({ name, bg, size = 48 }: { name: string; bg: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${bg}44, ${bg}22)`,
      border: `2px solid ${bg}66`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.35, color: bg, fontWeight: 700,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { "مبتدئ": "#4ade80", "Beginner": "#4ade80", "متوسط": "#93c5fd", "Intermediate": "#93c5fd", "متقدم": "#f87171", "Advanced": "#f87171" };
  const c = colors[level] ?? G;
  return <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{level}</span>;
}

// ─── Floating WhatsApp Button ─────────────────────────────────────────────────
function FloatingWA({ msg, label }: { msg: string; label: string }) {
  const [hover, setHover] = useState(false);
  const url = `https://wa.me/966546530264?text=${encodeURIComponent(msg)}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed", bottom: 32, insetInlineEnd: 24, zIndex: 9999,
        display: "flex", alignItems: "center", gap: 8,
        background: hover ? "#128C7E" : "#25D366", color: "#fff",
        borderRadius: 28, padding: hover ? "10px 18px" : "12px",
        boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
        transition: "all 0.25s", textDecoration: "none", fontWeight: 600,
        fontSize: 14, whiteSpace: "nowrap",
        animation: "sp-wa-bounce 2.5s ease-in-out infinite",
      }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.570-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.523 5.839L0 24l6.334-1.499A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.017-1.373l-.36-.215-3.727.881.916-3.635-.234-.373A9.818 9.818 0 0 1 2.182 12C2.182 6.567 6.567 2.182 12 2.182S21.818 6.567 21.818 12 17.433 21.818 12 21.818z"/>
      </svg>
      {hover && <span>{label}</span>}
    </a>
  );
}

// ─── Page: Home ───────────────────────────────────────────────────────────────
function HomePage({ t, isAr, onNav }: { t: typeof C.ar; isAr: boolean; onNav: (p: Page) => void }) {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(147,197,253,0.05) 50%, rgba(94,234,212,0.05) 100%)",
        border: `1px solid ${BORDER}`, borderRadius: 16, padding: "48px 32px",
        textAlign: "center", marginBottom: 32,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "radial-gradient(circle at 20% 50%, #C9A84C 0%, transparent 50%), radial-gradient(circle at 80% 50%, #93c5fd 0%, transparent 50%)",
        }} />
        <span style={{ background: `${G}22`, color: G, border: `1px solid ${G}44`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600 }}>
          {t.hero.badge}
        </span>
        <h1 style={{ color: G, fontSize: "clamp(22px,4vw,36px)", fontWeight: 800, marginTop: 16, marginBottom: 12, lineHeight: 1.4 }}>
          {t.hero.title}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "clamp(13px,2vw,16px)", maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.7 }}>
          {t.hero.subtitle}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => onNav("contact")} style={{
            background: `linear-gradient(135deg,${G},#f5d78e)`, color: "#0a0f1e",
            border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700,
            cursor: "pointer", fontSize: 14,
          }}>{t.hero.cta1}</button>
          <button onClick={() => onNav("services")} style={{
            background: "transparent", color: G, border: `1px solid ${G}66`,
            borderRadius: 8, padding: "10px 24px", fontWeight: 600,
            cursor: "pointer", fontSize: 14,
          }}>{t.hero.cta2}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14, marginBottom: 32 }}>
        {t.stats.map((s, i) => (
          <div key={i} style={{ ...cardStyle({ padding: "20px 12px", textAlign: "center" }) }}>
            <div style={{ color: G, fontSize: 28, fontWeight: 800 }}>{s.value}</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Services Grid */}
      <h2 style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t.servicesTitle}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>{t.servicesSubtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 32 }}>
        {t.services.map((s, i) => (
          <div key={i} onClick={() => onNav(s.page)} style={{
            ...cardStyle({ padding: "20px 16px", cursor: "pointer", transition: "all 0.2s" }),
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${G}55`; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{s.title}</div>
            <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Testimonials Strip */}
      <h2 style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t.testimonialsTitle}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 32 }}>
        {t.testimonials.slice(0, 3).map((tm, i) => (
          <div key={i} style={cardStyle({ padding: "18px 16px" })}>
            <Stars n={tm.stars} />
            <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.7, margin: "10px 0" }}>"{tm.text}"</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={tm.name} bg={["#C9A84C","#93c5fd","#5eead4"][i % 3]} size={36} />
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{tm.name}</div>
                <div style={{ color: "#64748b", fontSize: 11 }}>{tm.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ ...cardStyle({ padding: "32px", textAlign: "center" }) }}>
        <h3 style={{ color: G, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {isAr ? "جاهز لرفع مستوى بحثك؟" : "Ready to elevate your research?"}
        </h3>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
          {isAr ? "تواصل معنا اليوم واحصل على استشارة مجانية" : "Contact us today for a free consultation"}
        </p>
        <button onClick={() => onNav("contact")} style={{
          background: `linear-gradient(135deg,${G},#f5d78e)`, color: "#0a0f1e",
          border: "none", borderRadius: 8, padding: "12px 32px", fontWeight: 700,
          cursor: "pointer", fontSize: 15,
        }}>{t.hero.cta1}</button>
      </div>
    </div>
  );
}

// ─── Page: Services ───────────────────────────────────────────────────────────
function ServicesPage({ t }: { t: typeof C.ar }) {
  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.allServices.title}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.servicesSubtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {t.allServices.items.map((s, i) => (
          <div key={i} style={cardStyle({ padding: "24px 20px" })}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
            <h3 style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page: Pricing ────────────────────────────────────────────────────────────
function PricingPage({ t, onContact }: { t: typeof C.ar; onContact: () => void }) {
  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.pricing.title}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.pricing.subtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16, marginBottom: 16 }}>
        {t.pricing.tiers.map((tier, i) => (
          <div key={i} style={{
            ...cardStyle({ padding: "24px 20px", position: "relative", overflow: "hidden" }),
            ...(tier.featured ? { border: `2px solid ${G}`, boxShadow: `0 0 24px ${G}22` } : {}),
          }}>
            {tier.featured && (
              <div style={{ position: "absolute", top: 12, insetInlineEnd: 12, background: G, color: "#0a0f1e", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 8px" }}>
                ★ {t.pricing.tiers[1].name === "الاحترافية" ? "الأكثر طلباً" : "Most Popular"}
              </div>
            )}
            <div style={{ width: 40, height: 4, background: tier.color, borderRadius: 2, marginBottom: 14 }} />
            <h3 style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{tier.name}</h3>
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: tier.color, fontSize: 28, fontWeight: 800 }}>{tier.price}</span>
              {tier.currency && <span style={{ color: "#94a3b8", fontSize: 13 }}> {tier.currency}</span>}
              {tier.period && <div style={{ color: "#64748b", fontSize: 11 }}>{tier.period}</div>}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
              {tier.features.map((f, j) => (
                <li key={j} style={{ color: "#94a3b8", fontSize: 12, padding: "4px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ color: "#4ade80", marginTop: 1 }}>✓</span> {f}
                </li>
              ))}
              {tier.notIncluded.map((f, j) => (
                <li key={j} style={{ color: "#475569", fontSize: 12, padding: "4px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ color: "#f87171", marginTop: 1 }}>✗</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={onContact} style={{
              width: "100%", background: tier.featured ? `linear-gradient(135deg,${G},#f5d78e)` : "transparent",
              color: tier.featured ? "#0a0f1e" : tier.color,
              border: `1px solid ${tier.featured ? "transparent" : tier.color + "66"}`,
              borderRadius: 8, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 13,
            }}>
              {t.pricing.tiers[2].name === "المتقدمة" ? "ابدأ الآن" : "Get Started"}
            </button>
          </div>
        ))}
      </div>
      <p style={{ color: "#475569", fontSize: 12, textAlign: "center" }}>{t.pricing.note}</p>
    </div>
  );
}

// ─── Page: Testimonials ───────────────────────────────────────────────────────
function TestimonialsPage({ t }: { t: typeof C.ar }) {
  const colors = ["#C9A84C", "#93c5fd", "#5eead4", "#c4b5fd", "#4ade80"];
  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.testimonialsTitle}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.testimonialsSubtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
        {t.testimonials.map((tm, i) => (
          <div key={i} style={cardStyle({ padding: "24px 20px" })}>
            <Stars n={tm.stars} />
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8, margin: "14px 0" }}>"{tm.text}"</p>
            <div style={{ height: 1, background: BORDER, margin: "14px 0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={tm.name} bg={colors[i % colors.length]} size={44} />
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{tm.name}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{tm.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page: Training ───────────────────────────────────────────────────────────
function TrainingPage({ t, onContact }: { t: typeof C.ar; onContact: () => void }) {
  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.training.title}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.training.subtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 24 }}>
        {t.training.courses.map((c, i) => (
          <div key={i} style={cardStyle({ padding: "22px 20px" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 30 }}>{c.icon}</span>
              <LevelBadge level={c.level} />
            </div>
            <h3 style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{c.title}</h3>
            <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>{c.desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>⏱ {c.duration}</span>
              <span style={{ color: G, fontWeight: 700, fontSize: 14 }}>{c.price}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle({ padding: "24px", textAlign: "center" }) }}>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
          {t.training.title === "برامج التدريب الإحصائي"
            ? "هل تريد تسجيل أو الاستفسار عن أي دورة؟"
            : "Want to register or inquire about a course?"}
        </p>
        <button onClick={onContact} style={{
          background: `linear-gradient(135deg,${G},#f5d78e)`, color: "#0a0f1e",
          border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 700,
          cursor: "pointer", fontSize: 14,
        }}>
          {t.contact.title === "تواصل معنا" ? "تواصل معنا" : "Contact Us"}
        </button>
      </div>
    </div>
  );
}

// ─── Page: About ──────────────────────────────────────────────────────────────
function AboutPage({ t }: { t: typeof C.ar }) {
  const valueColors = ["#C9A84C", "#93c5fd", "#5eead4", "#c4b5fd", "#4ade80"];
  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.about.title}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.about.subtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={cardStyle({ padding: "24px 20px" })}>
          <h3 style={{ color: G, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            {t.about.title === "من نحن" ? "قصتنا" : "Our Story"}
          </h3>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>{t.about.story}</p>
        </div>
        <div style={cardStyle({ padding: "24px 20px" })}>
          <h3 style={{ color: "#93c5fd", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t.about.mission}</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>{t.about.missionText}</p>
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: "#5eead4", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              {t.about.title === "من نحن" ? "قيمنا" : "Our Values"}
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {t.about.values.map((v, i) => (
                <span key={i} style={{ background: `${valueColors[i % valueColors.length]}18`, color: valueColors[i % valueColors.length], border: `1px solid ${valueColors[i % valueColors.length]}33`, borderRadius: 6, padding: "3px 10px", fontSize: 12 }}>{v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <h3 style={{ color: "#e2e8f0", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        {t.about.title === "من نحن" ? "فريق العمل" : "Our Team"}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
        {t.about.team.map((m, i) => (
          <div key={i} style={{ ...cardStyle({ padding: "20px 16px", textAlign: "center" }) }}>
            <Avatar name={m.name} bg={m.bg} size={60} />
            <div style={{ marginTop: 12, color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{m.name}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{m.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page: Contact ────────────────────────────────────────────────────────────
function ContactPage({ t, isAr }: { t: typeof C.ar; isAr: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", service: "", message: "" });
  const [sent, setSent] = useState(false);
  const waUrl = `https://wa.me/${t.contact.phoneRaw.replace(/\D/g, "")}?text=${encodeURIComponent(t.contact.whatsappMsg)}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name && form.email && form.message) setSent(true);
  };

  return (
    <div>
      <h2 style={{ color: G, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.contact.title}</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>{t.contact.subtitle}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ ...cardStyle({ padding: "20px 18px", textDecoration: "none", display: "flex", alignItems: "center", gap: 14 }), background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)" }}>
            <div style={{ fontSize: 28 }}>💬</div>
            <div>
              <div style={{ color: "#25D366", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t.contact.whatsappBtn}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{t.contact.phone}</div>
            </div>
          </a>
          <div style={cardStyle({ padding: "20px 18px", display: "flex", alignItems: "center", gap: 14 })}>
            <div style={{ fontSize: 24 }}>📞</div>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {isAr ? "الهاتف" : "Phone"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, direction: "ltr" }}>{t.contact.phoneRaw}</div>
            </div>
          </div>
          <div style={cardStyle({ padding: "20px 18px", display: "flex", alignItems: "center", gap: 14 })}>
            <div style={{ fontSize: 24 }}>📍</div>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                {isAr ? "العنوان" : "Address"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{t.contact.address}</div>
            </div>
          </div>
        </div>
        {/* Form */}
        <div style={cardStyle({ padding: "24px 20px" })}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
              <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 600 }}>{t.contact.sent}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "name" as const, label: t.contact.form.name, type: "text" },
                { key: "email" as const, label: t.contact.form.email, type: "email" },
                { key: "service" as const, label: t.contact.form.service, type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div>
                <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>{t.contact.form.message}</label>
                <textarea rows={4} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <button type="submit" style={{
                background: `linear-gradient(135deg,${G},#f5d78e)`, color: "#0a0f1e",
                border: "none", borderRadius: 8, padding: "11px", fontWeight: 700,
                cursor: "pointer", fontSize: 14, marginTop: 4,
              }}>{t.contact.form.submit}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ServicesPortal() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const t = isAr ? C.ar : C.en;
  const [page, setPage] = useState<Page>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [page]);

  const navItems: { key: Page; label: string }[] = [
    { key: "home", label: t.nav.home },
    { key: "about", label: t.nav.about },
    { key: "services", label: t.nav.services },
    { key: "pricing", label: t.nav.pricing },
    { key: "testimonials", label: t.nav.testimonials },
    { key: "training", label: t.nav.training },
    { key: "contact", label: t.nav.contact },
  ];

  const navToPage = (p: Page) => { setPage(p); setMenuOpen(false); };

  return (
    <div ref={scrollRef} style={{ direction: isAr ? "rtl" : "ltr", fontFamily: isAr ? "'Cairo', 'Segoe UI', sans-serif" : "'Inter', 'Segoe UI', sans-serif" }}>
      {/* keyframe for WhatsApp bounce */}
      <style>{`@keyframes sp-wa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>

      {/* Portal Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "rgba(5,9,26,0.95)",
        border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 24,
        flexWrap: "wrap", gap: 8, position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ color: G, fontWeight: 800, fontSize: 16, cursor: "pointer" }} onClick={() => navToPage("home")}>
          {isAr ? "⚙️ خدماتنا الإحصائية" : "⚙️ Statistical Services"}
        </div>
        {/* Desktop nav */}
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => navToPage(item.key)} style={{
              background: page === item.key ? `${G}22` : "transparent",
              color: page === item.key ? G : "#94a3b8",
              border: page === item.key ? `1px solid ${G}44` : "1px solid transparent",
              borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500,
              transition: "all 0.15s",
            }}>{item.label}</button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div>
        {page === "home"         && <HomePage         t={t} isAr={isAr} onNav={navToPage} />}
        {page === "about"        && <AboutPage        t={t} />}
        {page === "services"     && <ServicesPage     t={t} />}
        {page === "pricing"      && <PricingPage      t={t} onContact={() => navToPage("contact")} />}
        {page === "testimonials" && <TestimonialsPage t={t} />}
        {page === "training"     && <TrainingPage     t={t} onContact={() => navToPage("contact")} />}
        {page === "contact"      && <ContactPage      t={t} isAr={isAr} />}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "32px 0 16px", color: "#475569", fontSize: 12, marginTop: 40, borderTop: `1px solid ${BORDER}` }}>
        {isAr ? "© ٢٠٢٥ خدمات إحصائية احترافية. جميع الحقوق محفوظة." : "© 2025 Professional Statistical Services. All rights reserved."}
      </div>

      {/* Floating WhatsApp */}
      <FloatingWA msg={t.contact.whatsappMsg} label={t.contact.whatsappBtn} />
    </div>
  );
}
