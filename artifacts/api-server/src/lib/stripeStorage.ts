import { db, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type StripePriceRow = {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: unknown;
  active: boolean;
  metadata: Record<string, unknown> | null;
};

export type StripeProductRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
  prices: StripePriceRow[];
};

// List active products joined with their active prices. Returns [] if the
// stripe schema doesn't exist yet (integration not connected).
export async function listProductsWithPrices(): Promise<StripeProductRow[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id   AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.active AS product_active,
        p.metadata AS product_metadata,
        pr.id  AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active AS price_active,
        pr.metadata AS price_metadata
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount NULLS LAST
    `);

    const map = new Map<string, StripeProductRow>();
    for (const row of result.rows as Record<string, unknown>[]) {
      const pid = row.product_id as string;
      if (!map.has(pid)) {
        map.set(pid, {
          id: pid,
          name: row.product_name as string,
          description: (row.product_description as string) ?? null,
          active: row.product_active as boolean,
          metadata: (row.product_metadata as Record<string, unknown>) ?? null,
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(pid)!.prices.push({
          id: row.price_id as string,
          unit_amount: (row.unit_amount as number) ?? null,
          currency: row.currency as string,
          recurring: row.recurring,
          active: row.price_active as boolean,
          metadata: (row.price_metadata as Record<string, unknown>) ?? null,
        });
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

// Active subscription for a Stripe customer, joined with its plan metadata.
export async function getActiveSubscriptionForCustomer(
  customerId: string,
): Promise<{
  id: string;
  status: string;
  current_period_end: unknown;
  cancel_at_period_end: boolean;
  plan: string | null;
} | null> {
  try {
    const result = await db.execute(sql`
      SELECT
        s.id,
        s.status,
        s.current_period_end,
        s.cancel_at_period_end,
        prod.metadata->>'plan' AS plan
      FROM stripe.subscriptions s
      JOIN stripe.prices pr ON pr.id = (
        SELECT (item->'price'->>'id')
        FROM jsonb_array_elements(s.items->'data') AS item
        LIMIT 1
      )
      JOIN stripe.products prod ON prod.id = pr.product
      WHERE s.customer = ${customerId}
        AND s.status IN ('active', 'trialing', 'past_due')
      ORDER BY s.created DESC
      LIMIT 1
    `);
    const row = result.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      status: row.status as string,
      current_period_end: row.current_period_end,
      cancel_at_period_end: Boolean(row.cancel_at_period_end),
      plan: (row.plan as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function updateUserStripeInfo(
  userId: string,
  info: { stripeCustomerId?: string; stripeSubscriptionId?: string },
) {
  const [user] = await db
    .update(users)
    .set({ ...info, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}

export async function setUserPlan(userId: string, plan: string) {
  const [user] = await db
    .update(users)
    .set({ plan, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
