import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

type ColInfo = { name: string; type: "numeric" | "categorical" | "datetime" | "binary" | "text"; unique?: number; sample?: (string | number)[] };

const VALID_KEYS = new Set([
  "desctable", "freq", "likert", "timeseries", "tsadvanced", "meta", "pca", "survival", "cluster",
  "effectsize", "outlier", "corr", "crosstab", "regression", "regdiag", "mediation", "moderation",
  "groups", "posthoc", "ttests", "cronbach", "itemanalysis", "efa", "normality", "nonparam",
  "chigof", "anovasum", "ci", "icc", "kappa", "hierreg", "partialcorr", "twoprop", "logreg",
  "omega", "rmmanova", "fisher", "binomtest", "ancova", "diagacc", "twoway", "blandaltman",
  "polyreg", "roc", "samplesize", "apa", "stats", "equations",
]);

router.post("/ai/recommend-analysis", async (req, res) => {
  const { columns, rowCount, goal, lang } = req.body as {
    columns?: ColInfo[];
    rowCount?: number;
    goal?: string;
    lang: "ar" | "en";
  };

  const isAr = lang === "ar";

  if ((!columns || columns.length === 0) && (!goal || goal.trim().length < 5)) {
    res.status(400).json({
      error: isAr
        ? "يرجى رفع بياناتك أو وصف هدف التحليل."
        : "Please upload your data or describe your analysis goal.",
    });
    return;
  }

  const colsSummary = (columns ?? [])
    .slice(0, 40)
    .map(c => {
      const samples = (c.sample ?? []).slice(0, 5).join(", ");
      return `- ${c.name} [${c.type}${c.unique != null ? `, unique=${c.unique}` : ""}]${samples ? ` e.g. ${samples}` : ""}`;
    })
    .join("\n");

  const system = isAr
    ? `أنت خبير إحصائي. مهمتك توصية المستخدم بأنسب التحليلات الإحصائية بناءً على وصف بياناته وهدفه البحثي.
يجب أن تختار **فقط** من قائمة المفاتيح التالية، ولا تخترع مفاتيح أخرى:

desctable=الإحصاء الوصفي، freq=جداول تكرارية، likert=ليكرت، timeseries=سلاسل زمنية بسيطة، tsadvanced=ARIMA/SARIMA،
meta=تحليل ميتا، pca=المكوّنات الرئيسية، survival=Kaplan-Meier، cluster=K-Means،
effectsize=حجم الأثر، outlier=قيم شاذة، corr=ارتباط Pearson، crosstab=جدول تقاطع χ²،
regression=انحدار خطي، regdiag=تشخيص الانحدار VIF، mediation=وساطة، moderation=اعتدال،
groups=One-Way ANOVA، posthoc=مقارنات بعدية، ttests=اختبارات t الثلاثة،
cronbach=كرونباخ، itemanalysis=تحليل الفقرات، efa=التحليل العاملي،
normality=الاعتدالية، nonparam=اختبارات لابارامترية، chigof=χ² حسن مطابقة،
anovasum=ANOVA من الملخصات، ci=فترات الثقة، icc=ICC، kappa=Kappa،
hierreg=انحدار تسلسلي، partialcorr=ارتباط جزئي، twoprop=z نسبتَين، logreg=انحدار لوجستي،
omega=ω McDonald، rmmanova=مقاييس متكررة، fisher=Fisher Exact، binomtest=ثنائي الحد،
ancova=ANCOVA، diagacc=دقة التشخيص، twoway=ANOVA ثنائي، blandaltman=Bland-Altman،
polyreg=انحدار متعدد الحدود، roc=ROC/AUC، samplesize=حجم العيّنة،
apa=منسّق APA، stats=ملخصات إحصائية، equations=المعادلات.

أعد JSON فقط:
{
  "summary": "وصف مختصر لطبيعة البيانات وما يناسبها",
  "recommendations": [
    { "key": "ttests", "name": "اختبار t المستقل", "reason": "لأن لديك متغير رقمي تابع ومتغير فئوي بمجموعتين", "confidence": "عالية" }
  ]
}
أعطِ 3–5 توصيات مرتبة من الأعلى ملاءمة. اشرح السبب بوضوح ومراعاة لطبيعة البيانات.`
    : `You are an expert statistician. Recommend the most appropriate statistical analyses based on the user's data description and research goal.
You must choose **only** from the following tool keys, never invent new ones:

desctable=Descriptive table, freq=Frequency tables, likert=Likert analyzer, timeseries=Simple time series, tsadvanced=ARIMA/SARIMA,
meta=Meta-analysis, pca=PCA, survival=Kaplan-Meier, cluster=K-Means,
effectsize=Effect size converter, outlier=Outliers, corr=Pearson correlation, crosstab=χ² cross-tab,
regression=Linear regression, regdiag=Regression diagnostics VIF, mediation=Mediation, moderation=Moderation,
groups=One-Way ANOVA, posthoc=Post-hoc, ttests=t-Tests,
cronbach=Cronbach alpha, itemanalysis=Item analysis, efa=Factor analysis,
normality=Normality test, nonparam=Non-parametric, chigof=χ² goodness-of-fit,
anovasum=ANOVA from summary, ci=Confidence intervals, icc=ICC, kappa=Cohen's Kappa,
hierreg=Hierarchical regression, partialcorr=Partial correlation, twoprop=Two-proportion z, logreg=Logistic regression,
omega=McDonald's ω, rmmanova=Repeated measures ANOVA, fisher=Fisher Exact, binomtest=Binomial test,
ancova=ANCOVA, diagacc=Diagnostic accuracy, twoway=Two-way ANOVA, blandaltman=Bland-Altman,
polyreg=Polynomial regression, roc=ROC/AUC, samplesize=Sample size,
apa=APA formatter, stats=Stats summary, equations=Equations.

Respond with ONLY JSON:
{
  "summary": "Brief description of the data and what it suits",
  "recommendations": [
    { "key": "ttests", "name": "Independent t-test", "reason": "Because you have a continuous outcome and a 2-level categorical predictor", "confidence": "high" }
  ]
}
Provide 3–5 ranked recommendations. Be clear about why each fits the data.`;

  const user = isAr
    ? `بيانات المستخدم:
${rowCount ? `عدد الصفوف: ${rowCount}` : ""}
${colsSummary ? `الأعمدة:\n${colsSummary}` : ""}
${goal ? `هدف التحليل: ${goal}` : "(لم يحدد المستخدم هدفاً صريحاً — استنتج بناءً على طبيعة الأعمدة)"}`
    : `User's data:
${rowCount ? `Row count: ${rowCount}` : ""}
${colsSummary ? `Columns:\n${colsSummary}` : ""}
${goal ? `Analysis goal: ${goal}` : "(No explicit goal — infer from column structure)"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      recommendations?: { key?: string; name?: string; reason?: string; confidence?: string }[];
    };
    const recommendations = (parsed.recommendations ?? [])
      .filter(r => r && typeof r.key === "string" && VALID_KEYS.has(r.key))
      .slice(0, 6);
    res.json({ summary: parsed.summary ?? "", recommendations });
  } catch (err) {
    req.log.error(err, "AI recommend-analysis failed");
    res.status(500).json({
      error: isAr ? "فشل في توليد التوصيات" : "Failed to generate recommendations",
    });
  }
});

export default router;
