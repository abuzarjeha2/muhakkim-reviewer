import { db, users, usage, type User } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

// Lazily create the user row on first authed request, then return it.
export async function ensureUser(
  userId: string,
  email?: string | null,
): Promise<User> {
  await db
    .insert(users)
    .values({ id: userId, email: email ?? null })
    .onConflictDoNothing({ target: users.id });

  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row;
}

// Atomically increment the user's AI-call counter for the period and return
// the new count.
export async function incrementUsage(
  userId: string,
  period: string,
): Promise<number> {
  const [row] = await db
    .insert(usage)
    .values({ userId, period, count: 1 })
    .onConflictDoUpdate({
      target: [usage.userId, usage.period],
      set: { count: sql`${usage.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: usage.count });
  return row.count;
}

// Read the current counter without mutating it.
export async function getUsageCount(
  userId: string,
  period: string,
): Promise<number> {
  const [row] = await db
    .select({ count: usage.count })
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.period, period)));
  return row?.count ?? 0;
}
