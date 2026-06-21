// Subscription tiers and their monthly AI-call quotas. Server-authoritative.
// Plan ids mirror the pricing page (PricingSystem in MuhakkimProV4.jsx).
export type Plan =
  | "free"
  | "student"
  | "researcher"
  | "faculty"
  | "reviewer"
  | "enterprise"
  | "government";

const UNLIMITED = Number.POSITIVE_INFINITY;

// Free tier matches the page copy ("100 طلب ذكاء اصطناعي شهرياً").
// All paid tiers advertise unlimited usage.
export const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  student: UNLIMITED,
  researcher: UNLIMITED,
  faculty: UNLIMITED,
  reviewer: UNLIMITED,
  enterprise: UNLIMITED,
  government: UNLIMITED,
};

export function getLimit(plan: string | null | undefined): number {
  if (!plan) return PLAN_LIMITS.free;
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

// Current billing period key, "YYYY-MM" in UTC.
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
