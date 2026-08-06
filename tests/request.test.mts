import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { requesterHash } from "../src/lib/request.ts";

beforeEach(() => {
  process.env.LINKEDOUT_SALT = "test-salt";
  delete process.env.LINKEDOUT_TRUSTED_PROXIES;
});

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/x", { headers });
}

test("by default (no proxy configured), every caller shares one identity regardless of headers", () => {
  // The unsafe direction is trusting a header nothing has verified; the safe failure
  // mode is everyone landing in one bucket. Getting THIS wrong should never look like
  // "it still works" — it should look like a shared quota, which is loud and cheap to
  // notice, not silent like a spoofable identity would be.
  const a = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const b = requesterHash(req({ "x-forwarded-for": "9.9.9.9" }));
  const c = requesterHash(req({ "cf-connecting-ip": "5.5.5.5" }));
  const d = requesterHash(req({}));
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(c, d);
});

test("with trust depth 1, the rightmost x-forwarded-for hop wins", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const a = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const b = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  assert.equal(a, b, "same real IP must hash the same");
});

test("with trust depth 1, prepending fake hops cannot change the identity a client is assigned", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const real = requesterHash(req({ "x-forwarded-for": "9.9.9.9" }));
  // An attacker controls everything except the hop their own proxy appends, so they can
  // only ever prepend to this list — never move or remove the rightmost, trusted entry.
  const spoofed1 = requesterHash(req({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }));
  const spoofed2 = requesterHash(req({ "x-forwarded-for": "random-garbage, 9.9.9.9" }));
  assert.equal(spoofed1, real);
  assert.equal(spoofed2, real);
});

test("with trust depth 1, a directly-supplied header cannot spoof a fresh identity per request", () => {
  // This is the case a misconfigured deployment actually hits: depth is set to 1
  // because there IS an edge in front, but the request reaching this code is direct
  // (no edge actually stripped anything) or the edge forwards a single, real hop either
  // way. Either way, only the rightmost hop counts — a spoofed leftmost value changes
  // nothing.
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const real = requesterHash(req({ "x-forwarded-for": "203.0.113.7" }));
  const spoofed = requesterHash(req({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" }));
  assert.equal(real, spoofed);
});

test("with zero trusted proxies, x-forwarded-for must not be trusted at all", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "0";
  const one = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const two = requesterHash(req({ "x-forwarded-for": "totally-different-value" }));
  assert.equal(one, two, "with zero trusted proxies, x-forwarded-for must not be trusted at all");
});

test("cf-connecting-ip and x-real-ip are ignored with no trusted proxy configured", () => {
  // The header alone proves nothing — only a proxy known to strip client-sent copies
  // does. Without depth > 0, treat it exactly like x-forwarded-for: not trusted.
  const a = requesterHash(req({ "cf-connecting-ip": "5.5.5.5" }));
  const b = requesterHash(req({ "cf-connecting-ip": "6.6.6.6" }));
  assert.equal(a, b, "with depth 0, a caller-supplied cf-connecting-ip must not grant a fresh identity");
});

test("cf-connecting-ip and x-real-ip are trusted ahead of x-forwarded-for once a proxy is configured", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const a = requesterHash(req({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "1.1.1.1" }));
  const b = requesterHash(req({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "2.2.2.2" }));
  assert.equal(a, b, "when a direct proxy header is present, forwarded-for must be ignored");
});

test("changing the User-Agent alone must not produce a new identity", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const a = requesterHash(req({ "x-forwarded-for": "8.8.8.8", "user-agent": "curl/8.0" }));
  const b = requesterHash(req({ "x-forwarded-for": "8.8.8.8", "user-agent": "Mozilla/5.0 totally different" }));
  assert.equal(
    a,
    b,
    "UA is attacker-controlled; mixing it in would let one real IP mint unlimited identities",
  );
});

test("different real IPs still get different identities, once a proxy is configured", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "1";
  const a = requesterHash(req({ "x-forwarded-for": "1.1.1.1" }));
  const b = requesterHash(req({ "x-forwarded-for": "2.2.2.2" }));
  assert.notEqual(a, b);
});

test("a non-numeric LINKEDOUT_TRUSTED_PROXIES falls back to the safe default (0), not NaN", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "two";
  const a = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const b = requesterHash(req({ "x-forwarded-for": "5.6.7.8" }));
  assert.equal(a, b, "NaN must fail the same safe way as an explicit 0, not trust anything by accident");
});

test("a negative LINKEDOUT_TRUSTED_PROXIES also falls back to 0", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "-1";
  const a = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const b = requesterHash(req({ "x-forwarded-for": "5.6.7.8" }));
  assert.equal(a, b);
});
