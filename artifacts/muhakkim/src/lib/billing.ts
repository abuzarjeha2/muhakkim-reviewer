// Stripe billing helpers for the Muhakkim frontend. All requests are
// same-origin (relative URLs), so the Clerk session cookie is sent
// automatically — no Authorization header needed.

const API = (import.meta.env.BASE_URL || "/") + "api/";

export const CHECKOUT_EVENT = "muhakkim:checkout";

export type PriceInfo = {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval?: string } | null;
  metadata?: { plan?: string; interval?: string };
};

export type ProductInfo = {
  id: string;
  name: string;
  description: string | null;
  metadata?: { plan?: string };
  prices: PriceInfo[];
};

export type AccountInfo = {
  authenticated: boolean;
  email?: string | null;
  plan?: string;
  used?: number;
  limit?: number | null;
};

export type SubscriptionInfo = {
  id: string;
  status: string;
  current_period_end: unknown;
  cancel_at_period_end: boolean;
  plan: string | null;
} | null;

// Plans that don't map to a Stripe product (handled outside checkout).
export const CONTACT_PLANS = new Set(["enterprise", "government"]);

export async function fetchProducts(): Promise<ProductInfo[]> {
  try {
    const r = await fetch(API + "stripe/products-with-prices");
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data as ProductInfo[]) || [];
  } catch {
    return [];
  }
}

export function findPriceId(
  products: ProductInfo[],
  plan: string,
  cycle: "monthly" | "yearly",
): string | null {
  const interval = cycle === "yearly" ? "year" : "month";
  const prod = products.find((p) => p.metadata?.plan === plan);
  if (!prod) return null;
  const price = prod.prices.find(
    (pr) => (pr.recurring?.interval || pr.metadata?.interval) === interval,
  );
  return price?.id || null;
}

export async function startCheckout(
  priceId: string,
): Promise<{ url?: string; error?: string; status?: number }> {
  try {
    const r = await fetch(API + "stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.error, status: r.status };
    return { url: d.url };
  } catch {
    return { error: "network_error" };
  }
}

export async function fetchAccount(): Promise<AccountInfo | null> {
  try {
    const r = await fetch(API + "me");
    if (!r.ok) return null;
    return (await r.json()) as AccountInfo;
  } catch {
    return null;
  }
}

export async function fetchSubscription(): Promise<SubscriptionInfo> {
  try {
    const r = await fetch(API + "stripe/subscription");
    if (!r.ok) return null;
    const d = await r.json();
    return (d.subscription as SubscriptionInfo) ?? null;
  } catch {
    return null;
  }
}

export async function openBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  try {
    const r = await fetch(API + "stripe/portal", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.error };
    return { url: d.url };
  } catch {
    return { error: "network_error" };
  }
}

// Arabic display name per plan id (mirrors the pricing page labels).
export const PLAN_AR: Record<string, string> = {
  free: "المجانية",
  student: "الطالب",
  researcher: "الباحث",
  faculty: "الأكاديمي",
  reviewer: "المحكّم والاستشاري",
  enterprise: "المؤسسات",
  government: "الجهات الحكومية",
  owner: "مالك المنصة",
};
