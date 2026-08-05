import { anonHash } from "./db.ts";

/**
 * Number of reverse proxies between the internet and this app that are trusted to
 * append their own hop to `x-forwarded-for` without letting the client control it.
 * Vercel, a single nginx/Cloudflare edge, and most standard setups are exactly one
 * hop, hence the default. Set LINKEDOUT_TRUSTED_PROXIES=0 if this app is reachable
 * directly with nothing in front of it, or a higher number for a longer trusted
 * chain — get this wrong in either direction and requesterHash() below becomes
 * either spoofable or useless.
 *
 * Read inside the function, not hoisted to a module-level constant: a constant would
 * freeze whatever the env var happened to be at first import, which is invisible in
 * production (the process just never picks up a later change) and breaks tests that
 * set the var per case.
 */
function trustedProxyDepth(): number {
  return Number(process.env.LINKEDOUT_TRUSTED_PROXIES ?? "1");
}

/**
 * Derives a stable pseudonymous key for a request. This is what stands between an
 * anonymous poster and the rest of the world — never stored in the clear, never shown
 * to anyone — and it is also what the daily-post cap, the one-echo-per-person rule and
 * the three-distinct-reporters threshold all rely on to mean what they claim to mean.
 *
 * `x-forwarded-for` is a comma-separated list the client can prepend to arbitrarily;
 * only entries appended by proxies you actually run are trustworthy, and those are the
 * rightmost `TRUSTED_PROXIES` entries, not the leftmost one. Trusting the leftmost hop —
 * the more common mistake — lets any caller pick a fresh identity on every request by
 * sending a fresh header, which silently defeats every one of the checks above it.
 *
 * User-Agent is deliberately excluded from the hash. It looks like it reduces
 * shared-NAT false collisions, but it does the opposite for security: once the IP hop
 * is trustworthy, a caller behind one real IP could still mint a new identity per
 * request just by varying the UA string, which is the exact bypass this function
 * exists to close.
 */
export function requesterHash(req: Request): string {
  const direct = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim();
  if (direct) return anonHash(direct);

  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const depth = trustedProxyDepth();
  const ip = depth > 0 && hops.length >= depth ? hops[hops.length - depth] : "unknown";
  return anonHash(ip);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
