import { getUncachableStripeClient } from "./stripeClient";

// Direct Stripe write operations. Reads are served from the synced stripe.*
// tables via stripeStorage.
export async function createCustomer(email: string | undefined, userId: string) {
  const stripe = await getUncachableStripeClient();
  return stripe.customers.create({
    email: email || undefined,
    metadata: { userId },
  });
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
}) {
  const stripe = await getUncachableStripeClient();
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    metadata: { userId: params.userId },
    subscription_data: { metadata: { userId: params.userId } },
    allow_promotion_codes: true,
  });
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
) {
  const stripe = await getUncachableStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
