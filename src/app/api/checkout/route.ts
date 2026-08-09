import { z } from "zod";
import { anonHash, recordSubscriber } from "@/lib/db";
import { checkoutUrl, ENTITLEMENT_COOKIE, signEntitlement } from "@/lib/billing";
import { json } from "@/lib/request";

export const dynamic = "force-dynamic";

const Checkout = z.object({
  plan: z.enum(["candidate", "employer"]),
  // Not z.email().trim() — in this chain order trim runs after the format check, so it
  // rejects an address with surrounding whitespace instead of cleaning it up first.
  email: z.string().trim().max(200).pipe(z.email()),
});

/**
 * Checkout has three outcomes, in priority order:
 *
 *  1. A Stripe Payment Link is configured for the plan → send the caller there. Stripe
 *     handles the card, the tax, and the receipt. Entitlement is granted on return from
 *     Stripe by /api/entitlement, which must verify the session before trusting it.
 *  2. LINKEDOUT_DEMO_UNLOCK=1 → grant a signed entitlement immediately. For local dev
 *     and demos only; never set it on a deployment you charge people on.
 *  3. Neither → record the interest and say plainly that billing is not live yet.
 *     An email you can convert later beats a broken card form.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  const parsed = Checkout.safeParse(body);
  if (!parsed.success) {
    return json({ error: "That email does not look right." }, 422);
  }
  const { plan, email } = parsed.data;

  // Only the hash is stored: enough to dedupe and count demand, useless if leaked.
  recordSubscriber(anonHash(email.toLowerCase()), plan);

  const url = checkoutUrl(plan);
  if (url) {
    return json({ mode: "stripe", redirect: url });
  }

  // NODE_ENV check is deliberate, not a formality: the .env.example warning ("never set
  // this in production") only works if nobody ever makes that mistake. This makes the
  // mistake harmless instead — a stray LINKEDOUT_DEMO_UNLOCK=1 on a real deployment stops
  // granting free entitlements the moment NODE_ENV says production.
  if (process.env.LINKEDOUT_DEMO_UNLOCK === "1" && process.env.NODE_ENV !== "production") {
    return new Response(
      JSON.stringify({
        mode: "demo",
        granted: plan,
        message: "Demo unlock — paid views are now open in this browser.",
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": `${ENTITLEMENT_COOKIE}=${signEntitlement(plan)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${31 * 86400}`,
        },
      },
    );
  }

  return json({
    mode: "waitlist",
    message:
      "Billing is not switched on yet. You are on the list and will be first in when it is.",
  });
}
