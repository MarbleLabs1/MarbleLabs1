import { anonHash } from "./db";

/**
 * Derives a stable pseudonymous key for a request. Used for rate limiting and for
 * one-echo-per-person, never stored in the clear and never shown to anyone.
 *
 * Behind a proxy, trust only the leftmost x-forwarded-for hop — the rest is
 * attacker-controlled. Set LINKEDOUT_SALT in production or every deployment
 * shares the same hash space.
 */
export function requesterHash(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  // Mixing in the UA makes shared-NAT collisions less likely without adding identifiability.
  const ua = req.headers.get("user-agent") ?? "";
  return anonHash(`${ip}|${ua.slice(0, 80)}`);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
