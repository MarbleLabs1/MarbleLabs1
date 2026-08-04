import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Money.
 *
 * Three revenue lines, in the order they are worth building:
 *
 *  1. CANDIDATE (£9/mo) — the person weighing an offer. Highest intent moment there is:
 *     they have an offer letter open in another tab. Gets full company reports, the
 *     role-level breakdown, and alerts when new stories land on a company they follow.
 *
 *  2. EMPLOYER (£399/mo) — HR and leadership who want to know what their own exits say,
 *     and how it compares to their industry. They will pay a research-subscription price
 *     because the alternative is a consultancy at 20x the cost. Sold as benchmarking,
 *     never as "remove bad reviews" — the moment scores are for sale the data is worthless
 *     and so is the company.
 *
 *  3. LICENSING — aggregate, de-identified trend data to journalists, researchers, and
 *     workforce-analytics vendors. Zero marginal cost, but it only exists once lines 1-2
 *     have produced enough volume that the aggregates mean something.
 *
 * Wiring real payments: set STRIPE_CANDIDATE_LINK / STRIPE_EMPLOYER_LINK to Stripe
 * Payment Links and checkout works with no server-side Stripe code at all. Graduate to
 * the Checkout API when you need proration and seat management.
 */

export type PlanId = "free" | "candidate" | "employer";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  pitch: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Reader",
    price: "£0",
    cadence: "forever",
    pitch: "Read the feed. Post your own exit story. No account needed.",
    features: [
      "Full anonymous story feed",
      "Filter by reason and role",
      "Post your own exit story",
      "Company Exit Index headline score",
    ],
    cta: "Start reading",
  },
  {
    id: "candidate",
    name: "Candidate",
    price: "£9",
    cadence: "per month",
    pitch: "You have an offer in hand and forty-eight hours to decide.",
    features: [
      "Full company exit reports",
      "Breakdown by role, seniority and tenure",
      "Exit trend over time — is it getting worse?",
      "Follow a company, get alerted on new stories",
      "Interview questions generated from that company's actual exit reasons",
    ],
    cta: "Check a company before you sign",
    featured: true,
  },
  {
    id: "employer",
    name: "Employer",
    price: "£399",
    cadence: "per month",
    pitch: "Find out what your leavers say when there is nothing left to lose.",
    features: [
      "Your own exit pattern, quarter over quarter",
      "Benchmark against your industry and headcount band",
      "Early-warning alerts on reason clusters",
      "Right of reply published on your company page",
      "Quarterly retention briefing",
    ],
    cta: "Talk to us",
  },
];

export const PLAN_MAP: Record<PlanId, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
) as Record<PlanId, Plan>;

/** Returns the hosted checkout URL for a plan, or null when payments are not wired up. */
export function checkoutUrl(plan: PlanId): string | null {
  if (plan === "candidate") return process.env.STRIPE_CANDIDATE_LINK ?? null;
  if (plan === "employer") return process.env.STRIPE_EMPLOYER_LINK ?? null;
  return null;
}

export const ENTITLEMENT_COOKIE = "lo_ent";

function secret(): string {
  return process.env.LINKEDOUT_SALT ?? "dev-salt-change-me";
}

/**
 * Entitlements ride in an HMAC-signed cookie: `plan.expiry.signature`. Signed rather
 * than merely set, so a reader cannot grant themselves the paid tier by editing a
 * cookie value in devtools.
 */
export function signEntitlement(plan: PlanId, days = 31): string {
  const expiry = Date.now() + days * 86_400_000;
  const payload = `${plan}.${expiry}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyEntitlement(token: string | undefined): PlanId {
  if (!token) return "free";
  const parts = token.split(".");
  if (parts.length !== 3) return "free";
  const [plan, expiryRaw, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${plan}.${expiryRaw}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "free";
  if (Number(expiryRaw) < Date.now()) return "free";
  return plan === "candidate" || plan === "employer" ? plan : "free";
}
