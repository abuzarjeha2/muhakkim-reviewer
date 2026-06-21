import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { ensureUser, incrementUsage } from "../lib/userStore";
import { getLimit, currentPeriod, isOwnerEmail } from "../lib/plans";
import { resolveEffectivePlan } from "../lib/effectivePlan";

// Gate paid AI calls behind authentication + per-user monthly quota.
// Responds with structured JSON the frontend can act on:
//   401 { code: "auth_required" }   — must sign in
//   402 { code: "quota_exceeded" }  — free limit reached, upgrade needed
export async function quotaGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId, sessionClaims } = getAuth(req);

  if (!userId) {
    res.status(401).json({
      error: "يجب تسجيل الدخول لاستخدام أدوات الذكاء الاصطناعي.",
      code: "auth_required",
    });
    return;
  }

  try {
    const email =
      (sessionClaims?.email as string | undefined) ??
      (sessionClaims?.["email_address"] as string | undefined) ??
      null;
    const user = await ensureUser(userId, email);

    // Platform owner: never metered.
    if (isOwnerEmail(user.email ?? email)) {
      next();
      return;
    }

    const plan = await resolveEffectivePlan(userId);
    const limit = getLimit(plan);
    const period = currentPeriod();
    const used = await incrementUsage(userId, period);

    if (Number.isFinite(limit) && used > limit) {
      res.status(402).json({
        error:
          "لقد بلغت الحد المجاني الشهري لاستخدام الذكاء الاصطناعي. الرجاء ترقية باقتك للمتابعة.",
        code: "quota_exceeded",
        plan,
        limit,
        used,
      });
      return;
    }

    next();
  } catch (err) {
    req.log.error({ err }, "quota guard failed");
    // Fail open on infrastructure errors so a DB hiccup doesn't block paying
    // users; abuse is still bounded by the per-IP rate limit.
    next();
  }
}
