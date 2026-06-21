import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { ensureUser } from "../lib/userStore";
import {
  listProductsWithPrices,
  getUser,
  updateUserStripeInfo,
  getActiveSubscriptionForCustomer,
} from "../lib/stripeStorage";
import {
  createCustomer,
  createCheckoutSession,
  createCustomerPortalSession,
} from "../lib/stripeService";

const router: IRouter = Router();

function appOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) return origin;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  return `${proto}://${req.get("host")}`;
}

async function userEmail(userId: string): Promise<string | undefined> {
  try {
    const u = await clerkClient.users.getUser(userId);
    return (
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      undefined
    );
  } catch {
    return undefined;
  }
}

// Public: products + prices for the pricing page.
router.get("/stripe/products-with-prices", async (_req, res: Response) => {
  const products = await listProductsWithPrices();
  res.json({ data: products });
});

// Authenticated: current user's active subscription (derived from synced data).
router.get("/stripe/subscription", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "auth_required" });
    return;
  }
  const user = await getUser(userId);
  if (!user?.stripeCustomerId) {
    res.json({ subscription: null });
    return;
  }
  const subscription = await getActiveSubscriptionForCustomer(
    user.stripeCustomerId,
  );
  res.json({ subscription });
});

// Authenticated: start a subscription checkout for the given priceId.
router.post("/stripe/checkout", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "auth_required" });
    return;
  }
  const priceId = (req.body?.priceId ?? "").toString().trim();
  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  // Only allow prices that belong to our active subscription catalog.
  const catalog = await listProductsWithPrices();
  const known = catalog.some((p) => p.prices.some((pr) => pr.id === priceId));
  if (!known) {
    res.status(400).json({ error: "unknown_price" });
    return;
  }

  try {
    const email = await userEmail(userId);
    await ensureUser(userId, email ?? null);

    let user = await getUser(userId);
    let customerId = user?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await createCustomer(email, userId);
      await updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const origin = appOrigin(req);
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId,
      successUrl: `${origin}/?checkout=success`,
      cancelUrl: `${origin}/?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "checkout session failed");
    res.status(502).json({ error: "checkout_failed" });
  }
});

// Authenticated: open the Stripe billing portal to manage/cancel.
router.post("/stripe/portal", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "auth_required" });
    return;
  }
  const user = await getUser(userId);
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "no_customer" });
    return;
  }
  try {
    const session = await createCustomerPortalSession(
      user.stripeCustomerId,
      `${appOrigin(req)}/`,
    );
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "portal session failed");
    res.status(502).json({ error: "portal_failed" });
  }
});

export default router;
