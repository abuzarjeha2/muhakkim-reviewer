import { getStripeSync } from "./stripeClient";

// Minimal webhook handler: validate the raw payload and hand it to StripeSync.
// No custom business logic lives here — plan mapping is derived on read.
export async function processStripeWebhook(
  payload: Buffer,
  signature: string,
): Promise<void> {
  if (!Buffer.isBuffer(payload)) {
    throw new Error(
      "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Received: " +
        typeof payload +
        ". Ensure the webhook route is registered BEFORE express.json().",
    );
  }

  const sync = await getStripeSync();
  await sync.processWebhook(payload, signature);
}
