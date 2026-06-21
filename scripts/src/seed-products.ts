import { getUncachableStripeClient } from "./stripeClient";

// Seeds the paid subscription plans (and SAR monthly/yearly prices) in Stripe.
// Plan ids and amounts mirror the pricing page (PricingSystem in
// MuhakkimProV4.jsx). Idempotent: existing products/prices are reused.
//
// Run: pnpm --filter @workspace/scripts run seed-stripe

type PlanSeed = {
  plan: string; // metadata.plan — links Stripe product to the app tier
  name: string;
  description: string;
  monthly: number; // SAR
  yearly: number; // SAR
};

const PLANS: PlanSeed[] = [
  {
    plan: "student",
    name: "الطالب — Student",
    description: "باقة الطلاب: استخدام غير محدود للمقررات والأدوات الأساسية.",
    monthly: 29,
    yearly: 290,
  },
  {
    plan: "researcher",
    name: "الباحث — Researcher",
    description: "باقة الباحثين: مراجعة عميقة وتحليل إحصائي متقدم وكاتب البحث.",
    monthly: 79,
    yearly: 790,
  },
  {
    plan: "faculty",
    name: "الأكاديمي — Faculty",
    description: "باقة أعضاء هيئة التدريس: إدارة المقررات والاختبارات والإرشاد.",
    monthly: 99,
    yearly: 990,
  },
  {
    plan: "reviewer",
    name: "المحكّم والاستشاري — Reviewer",
    description: "باقة المحكمين: تقارير تحكيم احترافية وشهادات جودة ومسار النشر.",
    monthly: 129,
    yearly: 1290,
  },
];

const CURRENCY = "sar";

async function findPriceByLookupKey(stripe: import("stripe").default, key: string) {
  const existing = await stripe.prices.list({
    lookup_keys: [key],
    active: true,
    limit: 1,
  });
  return existing.data[0] ?? null;
}

async function ensurePlan(stripe: import("stripe").default, p: PlanSeed) {
  // Find or create the product (matched by metadata.plan).
  const search = await stripe.products.search({
    query: `active:'true' AND metadata['plan']:'${p.plan}'`,
  });
  let product = search.data[0] ?? null;

  if (!product) {
    product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: { plan: p.plan },
    });
    console.log(`Created product ${p.plan} (${product.id})`);
  } else {
    console.log(`Product ${p.plan} exists (${product.id})`);
  }

  const intervals: Array<["month" | "year", number, string]> = [
    ["month", p.monthly, `${p.plan}_monthly`],
    ["year", p.yearly, `${p.plan}_yearly`],
  ];

  for (const [interval, amount, lookupKey] of intervals) {
    const existing = await findPriceByLookupKey(stripe, lookupKey);
    if (existing) {
      console.log(`  price ${lookupKey} exists (${existing.id})`);
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount * 100, // halalas
      currency: CURRENCY,
      recurring: { interval },
      lookup_key: lookupKey,
      metadata: { plan: p.plan, interval },
    });
    console.log(`  created price ${lookupKey} = ${amount} SAR (${price.id})`);
  }
}

async function main() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding Stripe products & prices (SAR)...");
  for (const p of PLANS) {
    await ensurePlan(stripe, p);
  }
  console.log("✓ Done. Webhooks will sync this data into the stripe.* tables.");
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
