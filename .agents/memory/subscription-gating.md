---
name: Subscription plan gating
description: How Muhakkim derives a user's plan/limit and wires Stripe checkout from the pricing page.
---

# Subscription plan gating (Muhakkim)

- **Effective plan is derived live, not from cached `users.plan`.** `resolveEffectivePlan(userId)` reads the active Stripe subscription (synced into the `stripe` schema by webhooks) first, then falls back to cached `users.plan`, then `"free"`. Quota middleware and `/api/me` both use it.
  - **Why:** webhooks keep the `stripe` schema authoritative; trusting only the cached column drifts when a subscription changes. Treat the synced subscription as source of truth for entitlement.
- **Owner bypass is by email allowlist** (`isOwnerEmail` in plans.ts), checked *before* metering — owner is never counted and `/api/me` reports plan `"owner"` with `limit: null`.
- **`/api/stripe/checkout` must validate the submitted `priceId` against the catalog** (`listProductsWithPrices`) before creating a session — clients send the priceId, so never trust it blindly.
- **Pricing page → checkout is event-driven.** Pricing CTA in the vendored `MuhakkimProV4.jsx` only dispatches a `muhakkim:checkout` CustomEvent `{plan,cycle}`; all Clerk-aware logic (sign-in redirect, plan→priceId mapping, redirect to Stripe, `?checkout=success|cancel` toast) lives in `App.tsx` `BillingManager`. Keeps payment logic out of the verbatim vendored file.
  - free plan → sign-up / "already free" toast; enterprise/government → mailto owner; paid → fetch products, map plan+cycle to priceId, POST checkout, redirect.
