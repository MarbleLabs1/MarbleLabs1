import { anonHash } from "./db.ts";

/**
 * Number of reverse proxies between the internet and this app that are trusted to
 * append their own hop to `x-forwarded-for` (and to strip/overwrite any client-sent
 * `cf-connecting-ip` or `x-real-ip`) before it reaches this code. Defaults to 0 —
 * trust nothing — because the wrong default in the other direction is a security
 * hole, not a usability regression: an unset/misconfigured value should degrade to
 * "share one identity bucket", never to "trust whatever the client claims".
 *
 * Vercel, a single nginx or Cloudflare edge, and most standard setups are exactly one
 * hop, so set this to 1 for those. Get it wrong in the other direction — trusting a
 * hop or header nothing actually strips — and requesterHash() below becomes spoofable.
 *
 * Read inside the function, not hoisted to a module-level constant: a constant would
 * freeze whatever the env var happened to be at first import, which is invisible in
 * production (the process just never picks up a later change) and breaks tests that
 * set the var per case.
 */
function trustedProxyDepth(): number {
  const raw = Number(process.env.LINKEDOUT_TRUSTED_PROXIES ?? "0");
  // A typo'd non-numeric value must not silently become 0 via NaN falling through
  // comparisons — that would still collapse every caller into one shared bucket, just
  // via a different path, and do it invisibly. Fail the same safe way on purpose.
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
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
 * `cf-connecting-ip` and `x-real-ip` are single-value headers a well-configured edge
 * sets and strips any client-sent copy of — but that guarantee only exists once a
 * trusted proxy is actually configured. With no proxy in front (depth 0), a direct
 * caller can set either header to anything, so they get exactly the same trust
 * treatment as x-forwarded-for: none, unless depth says otherwise.
 *
 * User-Agent is deliberately excluded from the hash. It looks like it reduces
 * shared-NAT false collisions, but it does the opposite for security: once the IP hop
 * is trustworthy, a caller behind one real IP could still mint a new identity per
 * request just by varying the UA string, which is the exact bypass this function
 * exists to close.
 */
export function requesterHash(req: Request): string {
  const depth = trustedProxyDepth();
  if (depth > 0) {
    const direct = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim();
    if (direct) return anonHash(direct);
  }

  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const ip = depth > 0 && hops.length >= depth ? hops[hops.length - depth] : "unknown";
  return anonHash(ip);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
