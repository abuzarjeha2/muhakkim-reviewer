// ─────────────────────────────────────────────────────────────────────────────
// Pure statistical library — no external dependencies
// ─────────────────────────────────────────────────────────────────────────────

// ── Basic helpers ─────────────────────────────────────────────────────────────
export const sum  = (a: number[]) => a.reduce((s, v) => s + v, 0);
export const mean = (a: number[]) => a.length ? sum(a) / a.length : NaN;

export function sortAsc(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

export function median(a: number[]): number {
  const s = sortAsc(a); const n = s.length;
  return n % 2 ? s[Math.floor(n / 2)] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function mode(a: number[]): number {
  const f: Record<number, number> = {};
  a.forEach(v => { f[v] = (f[v] ?? 0) + 1; });
  return +Object.entries(f).sort((x, y) => y[1] - x[1])[0][0];
}

export function variance(a: number[], ddof = 1): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((acc, v) => acc + (v - m) ** 2, 0) / (a.length - ddof);
}
export const std = (a: number[], ddof = 1) => Math.sqrt(variance(a, ddof));

export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  const idx = p * (n - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function skewness(a: number[]): number {
  const n = a.length; if (n < 3) return NaN;
  const m = mean(a); const s = std(a, 1); if (s === 0) return 0;
  const m3 = a.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * m3;
}

export function kurtosis(a: number[]): number {
  const n = a.length; if (n < 4) return NaN;
  const m = mean(a); const s = std(a, 1); if (s === 0) return 0;
  const m4 = a.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4
       - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

export const sem = (a: number[]) => std(a, 1) / Math.sqrt(a.length);
export const cv  = (a: number[]) => { const m = mean(a); return m !== 0 ? (std(a, 1) / Math.abs(m)) * 100 : NaN; };

// ── Probability distributions ────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun 26.2.17) */
export function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** Inverse normal CDF (Peter Acklam's algorithm) */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return  Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
              1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
              6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    const q = p - 0.5; const r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
            (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/** Log-Gamma (Lanczos) */
function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const logBeta = (a: number, b: number) => logGamma(a) + logGamma(b) - logGamma(a + b);

/** Regularised incomplete beta I_x(a,b) via Lentz CF */
function betaCF(a: number, b: number, x: number): number {
  const EPS = 1e-10, FPMIN = 1e-30, MAX = 200;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAX; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
export function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const lb = logBeta(a, b);
  if (x < (a + 1) / (a + b + 2))
    return Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lb) * betaCF(a, b, x) / a;
  return 1 - Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lb) * betaCF(b, a, 1 - x) / b;
}

/** Regularised incomplete gamma P(a, x) — series */
function gammaSeries(a: number, x: number): number {
  if (x <= 0) return 0;
  const EPS = 1e-10;
  let ap = a, del = 1 / a, s = del;
  for (let n = 1; n <= 300; n++) {
    ap++; del *= x / ap; s += del;
    if (Math.abs(del) < Math.abs(s) * EPS) break;
  }
  return s * Math.exp(-x + a * Math.log(x) - logGamma(a));
}
function gammaCF(a: number, x: number): number {
  const EPS = 1e-10, FPMIN = 1e-30;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}
function gammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaCF(a, x);
}

/** Chi-square p-value (right tail) */
export function chiPValue(chi2: number, df: number): number {
  if (chi2 <= 0) return 1;
  return 1 - gammaP(df / 2, chi2 / 2);
}

/** t-distribution two-tailed p-value */
export function tPValue(t: number, df: number): number {
  return incBeta(df / 2, 0.5, df / (df + t * t));
}

/** F-distribution right-tail p-value */
export function fPValue(F: number, df1: number, df2: number): number {
  return incBeta(df2 / 2, df1 / 2, df2 / (df2 + df1 * F));
}

// ── Ranks ─────────────────────────────────────────────────────────────────────
export function rankArray(a: number[]): number[] {
  const idx = a.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
  const r = new Array<number>(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j < idx.length - 1 && idx[j + 1].v === idx[j].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k].i] = avg;
    i = j + 1;
  }
  return r;
}

// ── Correlation ───────────────────────────────────────────────────────────────
export function pearsonR(a: number[], b: number[]): number {
  const n = a.length, ma = mean(a), mb = mean(b);
  const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
  const den = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) *
                        b.reduce((s, v) => s + (v - mb) ** 2, 0));
  return den === 0 ? 0 : num / den;
}
export const spearmanR = (a: number[], b: number[]) => pearsonR(rankArray(a), rankArray(b));

export function corrTest(r: number, n: number): number {
  const t = r * Math.sqrt(n - 2) / Math.sqrt(Math.max(1e-14, 1 - r * r));
  return tPValue(Math.abs(t), n - 2);
}

export interface CorrCell { r: number; p: number; }

export function correlationMatrix(
  cols: { name: string; vals: number[] }[],
  method: 'pearson' | 'spearman' = 'pearson',
): CorrCell[][] {
  const fn = method === 'spearman' ? spearmanR : pearsonR;
  return cols.map(ci => cols.map(cj => {
    if (ci.name === cj.name) return { r: 1, p: 0 };
    const r = fn(ci.vals, cj.vals);
    return { r, p: corrTest(r, ci.vals.length) };
  }));
}

// ── Normality ─────────────────────────────────────────────────────────────────
export interface NormalityResult {
  test: string; testAr: string;
  statistic: number; pValue: number; isNormal: boolean;
}

/** Shapiro-Francia approximation */
export function shapiroFrancia(x: number[]): NormalityResult {
  const s = sortAsc(x); const n = s.length;
  if (n < 5) return { test: 'Shapiro-Francia', testAr: 'شابيرو-فرانسيا', statistic: NaN, pValue: NaN, isNormal: true };
  const m = mean(x);
  const c = s.map((_, i) => normalQuantile((i + 1 - 0.375) / (n + 0.25)));
  const cNorm = Math.sqrt(c.reduce((a, v) => a + v * v, 0));
  const a = c.map(v => v / cNorm);
  let b = 0;
  for (let i = 0; i < Math.floor(n / 2); i++)
    b += a[n - 1 - i] * (s[n - 1 - i] - s[i]);
  const ssT = s.reduce((acc, v) => acc + (v - m) ** 2, 0);
  const W = Math.max(0, Math.min(1, b * b / ssT));
  const mu    = -1.2725 + 1.0521 * Math.log(n);
  const sigma =  1.0308 - 0.26763 * Math.log(n);
  const z = (Math.log(1 - W) - mu) / sigma;
  const p = Math.max(0, Math.min(1, 1 - normalCDF(z)));
  return { test: 'Shapiro-Francia', testAr: 'شابيرو-فرانسيا', statistic: W, pValue: p, isNormal: p > 0.05 };
}

/** Kolmogorov-Smirnov one-sample normality test */
export function ksNormality(x: number[]): NormalityResult {
  const n = x.length; const s = sortAsc(x);
  const m = mean(x); const sd = std(x, 1);
  let D = 0;
  s.forEach((v, i) => {
    const F = normalCDF((v - m) / sd);
    D = Math.max(D, Math.abs((i + 1) / n - F), Math.abs(i / n - F));
  });
  const p = D < 1.36 / Math.sqrt(n) ? 0.2 : D < 1.63 / Math.sqrt(n) ? 0.05 : 0.01;
  return { test: 'Kolmogorov-Smirnov', testAr: 'كولموغوروف-سميرنوف', statistic: D, pValue: p, isNormal: p > 0.05 };
}

// ── Hypothesis tests ──────────────────────────────────────────────────────────
export interface HTestResult {
  name: string; nameAr: string;
  statLabel: string; stat: number;
  pValue: number; df?: number;
  conclusion: string; conclusionAr: string;
  extra?: Record<string, number | string>;
}

/** One-sample t-test */
export function oneSampleT(a: number[], mu0: number): HTestResult {
  const n = a.length, m = mean(a), s = std(a, 1);
  const t = (m - mu0) / (s / Math.sqrt(n));
  const p = tPValue(Math.abs(t), n - 1);
  const sig = p < 0.05;
  return {
    name: 'One-Sample t-Test', nameAr: 'اختبار t أحادي العينة',
    statLabel: 't', stat: t, pValue: p, df: n - 1,
    conclusion: sig ? `Reject H₀: μ ≠ ${mu0}` : `Fail to reject H₀: μ ≈ ${mu0}`,
    conclusionAr: sig ? `رفض H₀: المتوسط ≠ ${mu0}` : `عدم رفض H₀: المتوسط ≈ ${mu0}`,
    extra: { n, mean: m, sd: s, mu0 },
  };
}

/** Independent t-test (Welch's) */
export function twoSampleT(a: number[], b: number[]): HTestResult {
  const na = a.length, nb = b.length;
  const ma = mean(a), mb = mean(b);
  const va = variance(a, 1), vb = variance(b, 1);
  const pooled = va / na + vb / nb;
  const t = (ma - mb) / Math.sqrt(pooled);
  const df = pooled ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  const p = tPValue(Math.abs(t), df);
  const sig = p < 0.05;
  return {
    name: "Independent t-Test (Welch's)", nameAr: "اختبار t للعينتين المستقلتين",
    statLabel: 't', stat: t, pValue: p, df,
    conclusion: sig ? 'Reject H₀: means differ' : 'Fail to reject H₀: means equal',
    conclusionAr: sig ? 'رفض H₀: يوجد فرق معنوي' : 'عدم رفض H₀: لا فرق معنوي',
    extra: { n1: na, n2: nb, mean1: ma, mean2: mb, df },
  };
}

/** Paired t-test */
export function pairedT(a: number[], b: number[]): HTestResult {
  const diffs = a.map((v, i) => v - b[i]);
  const n = diffs.length, md = mean(diffs), sd2 = std(diffs, 1);
  const t = md / (sd2 / Math.sqrt(n));
  const p = tPValue(Math.abs(t), n - 1);
  const sig = p < 0.05;
  return {
    name: 'Paired t-Test', nameAr: 'اختبار t للعينات المرتبطة',
    statLabel: 't', stat: t, pValue: p, df: n - 1,
    conclusion: sig ? 'Reject H₀: mean difference ≠ 0' : 'Fail to reject H₀: mean difference ≈ 0',
    conclusionAr: sig ? 'رفض H₀: الفرق في المتوسطات ≠ صفر' : 'عدم رفض H₀: لا فرق معنوي في المتوسطات',
    extra: { n, meanDiff: md, sdDiff: sd2 },
  };
}

/** One-Way ANOVA */
export function oneWayANOVA(groups: number[][]): HTestResult {
  const k = groups.length;
  const all = groups.flat(); const N = all.length;
  const gm = mean(all);
  const ssBetween = groups.reduce((acc, g) => acc + g.length * (mean(g) - gm) ** 2, 0);
  const ssWithin  = groups.reduce((acc, g) => { const m = mean(g); return acc + g.reduce((s, v) => s + (v - m) ** 2, 0); }, 0);
  const dfB = k - 1, dfW = N - k;
  const F = (ssBetween / dfB) / (ssWithin / dfW);
  const p = fPValue(F, dfB, dfW);
  const sig = p < 0.05;
  return {
    name: 'One-Way ANOVA', nameAr: 'تحليل التباين أحادي الاتجاه',
    statLabel: 'F', stat: F, pValue: p, df: dfB,
    conclusion: sig ? 'Reject H₀: ≥1 group mean differs' : 'Fail to reject H₀: all means equal',
    conclusionAr: sig ? 'رفض H₀: يوجد فرق بين متوسط مجموعة على الأقل' : 'عدم رفض H₀: المتوسطات متساوية',
    extra: { k, N, dfBetween: dfB, dfWithin: dfW, ssBetween, ssWithin, msBetween: ssBetween/dfB, msWithin: ssWithin/dfW },
  };
}

/** Mann-Whitney U (normal approximation) */
export function mannWhitneyU(a: number[], b: number[]): HTestResult {
  const na = a.length, nb = b.length;
  const combined = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))];
  combined.sort((x, y) => x.v - y.v);
  const N = combined.length;
  const ranks = new Array<number>(N); let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && combined[j + 1].v === combined[j].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let R1 = 0;
  combined.forEach((item, idx) => { if (item.g === 0) R1 += ranks[idx]; });
  const U1 = R1 - na * (na + 1) / 2;
  const U2 = na * nb - U1;
  const U  = Math.min(U1, U2);
  const ties: Record<number, number> = {};
  combined.forEach(item => { ties[item.v] = (ties[item.v] ?? 0) + 1; });
  const tieCorr = Object.values(ties).reduce((s, t) => s + t ** 3 - t, 0);
  const sigma = Math.sqrt((na * nb / 12) * (N + 1 - tieCorr / (N * (N - 1))));
  const z = (U - na * nb / 2) / sigma;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const sig = p < 0.05;
  return {
    name: 'Mann-Whitney U', nameAr: 'اختبار مان-ويتني U',
    statLabel: 'U', stat: U, pValue: p,
    conclusion: sig ? 'Reject H₀: distributions differ' : 'Fail to reject H₀: distributions similar',
    conclusionAr: sig ? 'رفض H₀: يوجد فرق معنوي بين التوزيعين' : 'عدم رفض H₀: التوزيعان متشابهان',
    extra: { U1, U2, z, na, nb },
  };
}

/** Wilcoxon Signed-Rank (normal approximation) */
export function wilcoxonSignedRank(a: number[], b: number[]): HTestResult {
  const diffs = a.map((v, i) => v - b[i]).filter(d => d !== 0);
  const n = diffs.length;
  const abs = diffs.map((d, i) => ({ abs: Math.abs(d), sign: Math.sign(d), i }));
  abs.sort((x, y) => x.abs - y.abs);
  const ranks = new Array<number>(n); let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && abs[j + 1].abs === abs[j].abs) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let Wp = 0, Wm = 0;
  abs.forEach((item, idx) => { if (item.sign > 0) Wp += ranks[idx]; else Wm += ranks[idx]; });
  const W = Math.min(Wp, Wm);
  const mu = n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  const z = (W - mu) / sigma;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const sig = p < 0.05;
  return {
    name: 'Wilcoxon Signed-Rank', nameAr: 'اختبار ويلكوكسون للرتب الموقعة',
    statLabel: 'W', stat: W, pValue: p,
    conclusion: sig ? 'Reject H₀: significant median difference' : 'Fail to reject H₀: no significant difference',
    conclusionAr: sig ? 'رفض H₀: يوجد فرق معنوي في الوسيط' : 'عدم رفض H₀: لا فرق معنوي في الوسيط',
    extra: { W_plus: Wp, W_minus: Wm, z, n },
  };
}

/** Kruskal-Wallis */
export function kruskalWallis(groups: number[][]): HTestResult {
  const k = groups.length;
  const combined = groups.flatMap((g, gi) => g.map(v => ({ v, g: gi })));
  combined.sort((x, y) => x.v - y.v);
  const N = combined.length;
  const ranks = new Array<number>(N); let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && combined[j + 1].v === combined[j].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let m = i; m <= j; m++) ranks[m] = avg;
    i = j + 1;
  }
  const RS = new Array<number>(k).fill(0);
  combined.forEach((item, idx) => { RS[item.g] += ranks[idx]; });
  let H = (12 / (N * (N + 1))) * groups.reduce((acc, g, gi) => acc + RS[gi] ** 2 / g.length, 0) - 3 * (N + 1);
  const ties: Record<number, number> = {};
  combined.forEach(item => { ties[item.v] = (ties[item.v] ?? 0) + 1; });
  const C = 1 - Object.values(ties).reduce((s, t) => s + t ** 3 - t, 0) / (N ** 3 - N);
  H = C > 0 ? H / C : H;
  const df = k - 1;
  const p = chiPValue(H, df);
  const sig = p < 0.05;
  return {
    name: 'Kruskal-Wallis', nameAr: 'اختبار كروسكال-واليس',
    statLabel: 'H', stat: H, pValue: p, df,
    conclusion: sig ? 'Reject H₀: ≥1 group distribution differs' : 'Fail to reject H₀: groups similar',
    conclusionAr: sig ? 'رفض H₀: يوجد فرق معنوي بين توزيعات المجموعات' : 'عدم رفض H₀: المجموعات متشابهة',
    extra: { k, N, df },
  };
}

/** Chi-square test of independence from contingency table */
export function chiSquareIndependence(obs: number[][]): HTestResult {
  const rows = obs.length, cols = obs[0].length;
  const rT = obs.map(r => r.reduce((a, b) => a + b, 0));
  const cT = Array.from({ length: cols }, (_, j) => obs.reduce((a, r) => a + r[j], 0));
  const N  = rT.reduce((a, b) => a + b, 0);
  let chi2 = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const e = rT[r] * cT[c] / N;
      if (e > 0) chi2 += (obs[r][c] - e) ** 2 / e;
    }
  const df = (rows - 1) * (cols - 1);
  const p  = chiPValue(chi2, df);
  const sig = p < 0.05;
  return {
    name: 'Chi-Square Independence', nameAr: 'اختبار مربع كاي للاستقلالية',
    statLabel: 'χ²', stat: chi2, pValue: p, df,
    conclusion: sig ? 'Reject H₀: variables are associated' : 'Fail to reject H₀: variables are independent',
    conclusionAr: sig ? 'رفض H₀: يوجد ارتباط بين المتغيرين' : 'عدم رفض H₀: المتغيران مستقلان',
    extra: { chi2, df, N },
  };
}

/** Chi-square goodness of fit (uniform expected) */
export function chiSquareGoodnessOfFit(observed: number[]): HTestResult {
  const N = observed.reduce((a, b) => a + b, 0);
  const expected = N / observed.length;
  const chi2 = observed.reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0);
  const df = observed.length - 1;
  const p  = chiPValue(chi2, df);
  const sig = p < 0.05;
  return {
    name: 'Chi-Square Goodness of Fit', nameAr: 'اختبار مربع كاي لحسن الملاءمة',
    statLabel: 'χ²', stat: chi2, pValue: p, df,
    conclusion: sig ? 'Reject H₀: distribution is not uniform' : 'Fail to reject H₀: distribution is uniform',
    conclusionAr: sig ? 'رفض H₀: التوزيع ليس منتظماً' : 'عدم رفض H₀: التوزيع منتظم',
    extra: { chi2, df, N, expected },
  };
}

// ── Linear Regression ─────────────────────────────────────────────────────────
export interface RegressionResult {
  slope: number; intercept: number;
  r2: number; adjR2: number;
  seSlope: number; seIntercept: number;
  tSlope: number; tIntercept: number;
  pSlope: number; pIntercept: number;
  F: number; pF: number; n: number;
  residuals: number[]; fitted: number[];
  pearsonR: number;
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  const n = x.length, mx = mean(x), my = mean(y);
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  const sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const slope = sxy / sxx, intercept = my - slope * mx;
  const fitted   = x.map(v => intercept + slope * v);
  const residuals = y.map((v, i) => v - fitted[i]);
  const ssRes = residuals.reduce((s, r) => s + r ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const r2    = 1 - ssRes / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - 2);
  const mse   = ssRes / (n - 2);
  const seSlope     = Math.sqrt(mse / sxx);
  const seIntercept = Math.sqrt(mse * (1 / n + mx ** 2 / sxx));
  const tSlope     = slope / seSlope;
  const tIntercept = intercept / seIntercept;
  const pSlope     = tPValue(Math.abs(tSlope),     n - 2);
  const pIntercept = tPValue(Math.abs(tIntercept), n - 2);
  const F  = (ssTot - ssRes) / mse;
  const pF = fPValue(F, 1, n - 2);
  return { slope, intercept, r2, adjR2, seSlope, seIntercept, tSlope, tIntercept,
           pSlope, pIntercept, F, pF, n, residuals, fitted, pearsonR: pearsonR(x, y) };
}

// ── Column stats (full descriptive) ──────────────────────────────────────────
export interface ColStats {
  col: string; type: 'numeric' | 'text';
  count: number; missing: number;
  // numeric
  sum?: number; mean?: number; median?: number; mode?: number;
  variance?: number; std?: number; sem?: number; cv?: number;
  min?: number; max?: number; range?: number;
  q1?: number; q3?: number; iqr?: number;
  skewness?: number; kurtosis?: number;
  // text
  unique?: number; top?: string; topFreq?: number;
  freqMap?: Record<string, number>;
}

export function buildColStats(rows: Record<string, unknown>[]): ColStats[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map(col => {
    const raw  = rows.map(r => r[col]);
    const nonNull = raw.filter(v => v !== null && v !== undefined && v !== '');
    const nums = nonNull.map(v => +(v as number)).filter(v => !isNaN(v));
    const isNumeric = nums.length > nonNull.length * 0.7;

    if (isNumeric) {
      const s = sortAsc(nums), n = nums.length;
      const m = mean(nums);
      const v = variance(nums, 1);
      const sd = Math.sqrt(v);
      const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75);
      return {
        col, type: 'numeric', count: n, missing: rows.length - n,
        sum: sum(nums), mean: m, median: median(nums), mode: mode(nums),
        variance: v, std: sd, sem: sem(nums), cv: cv(nums),
        min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
        q1, q3, iqr: q3 - q1,
        skewness: skewness(nums), kurtosis: kurtosis(nums),
      };
    } else {
      const strs = nonNull.map(String);
      const fm: Record<string, number> = {};
      strs.forEach(v => { fm[v] = (fm[v] ?? 0) + 1; });
      const topEntry = Object.entries(fm).sort((a, b) => b[1] - a[1])[0];
      return {
        col, type: 'text', count: strs.length, missing: rows.length - strs.length,
        unique: new Set(strs).size, top: topEntry?.[0] ?? '', topFreq: topEntry?.[1] ?? 0,
        freqMap: fm,
      };
    }
  });
}
