import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { logger } from "./logger";

// Initialize the stripe.* schema, register the managed webhook, and backfill
// synced data. Guarded: if Stripe isn't connected yet, log and continue so the
// server keeps serving (auth/quotas/AI proxy work without payments).
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Stripe init skipped: DATABASE_URL not set");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const sync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      const result = await sync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ url: result?.url ?? webhookUrl }, "Stripe webhook configured");
    } else {
      logger.warn("REPLIT_DOMAINS not set; skipping managed webhook setup");
    }

    // Must pass { object: "all" }; calling syncBackfill() with no params
    // leaves `object` undefined and nothing gets synced.
    sync
      .syncBackfill({ object: "all" })
      .then(() => logger.info("Stripe data synced"))
      .catch((err) => logger.error({ err }, "Stripe backfill failed"));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Stripe not initialized (integration likely not connected yet)",
    );
  }
}
