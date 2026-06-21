import { getUser, getActiveSubscriptionForCustomer } from "./stripeStorage";

// Resolve a user's effective plan from their active Stripe subscription (kept
// in sync by webhooks). Falls back to the cached users.plan, then "free".
export async function resolveEffectivePlan(userId: string): Promise<string> {
  const user = await getUser(userId);
  if (!user?.stripeCustomerId) return user?.plan ?? "free";
  const sub = await getActiveSubscriptionForCustomer(user.stripeCustomerId);
  return sub?.plan ?? user?.plan ?? "free";
}
