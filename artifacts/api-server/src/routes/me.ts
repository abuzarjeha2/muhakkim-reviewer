import { Router } from "express";
import { getAuth } from "@clerk/express";
import { ensureUser, getUsageCount } from "../lib/userStore";
import { getLimit, currentPeriod } from "../lib/plans";

const router = Router();

// Returns the signed-in user's plan and current AI usage. Used by the frontend
// to show remaining quota and gate the upgrade CTA. Does not increment usage.
router.get("/me", async (req, res) => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    res.json({ authenticated: false });
    return;
  }

  try {
    const email =
      (sessionClaims?.email as string | undefined) ??
      (sessionClaims?.["email_address"] as string | undefined) ??
      null;
    const user = await ensureUser(userId, email);
    const period = currentPeriod();
    const used = await getUsageCount(userId, period);
    const limit = getLimit(user.plan);

    res.json({
      authenticated: true,
      userId,
      email: user.email,
      plan: user.plan,
      period,
      used,
      limit: Number.isFinite(limit) ? limit : null,
    });
  } catch (err) {
    req.log.error({ err }, "/me failed");
    res.status(500).json({ error: "failed to load account" });
  }
});

export default router;
