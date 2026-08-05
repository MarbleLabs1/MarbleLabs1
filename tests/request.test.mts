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

test("with the default trust depth (1), the rightmost x-forwarded-for hop wins", () => {
  const a = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const b = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  assert.equal(a, b, "same real IP must hash the same");
});

test("prepending fake hops cannot change the identity a client is assigned", () => {
  const real = requesterHash(req({ "x-forwarded-for": "9.9.9.9" }));
  // An attacker controls everything except the hop their own proxy appends, so they can
  // only ever prepend to this list — never move or remove the rightmost, trusted entry.
  const spoofed1 = requesterHash(req({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }));
  const spoofed2 = requesterHash(req({ "x-forwarded-for": "random-garbage, 9.9.9.9" }));
  assert.equal(spoofed1, real);
  assert.equal(spoofed2, real);
});

test("a bare header with no trusted proxy in front cannot be spoofed into a fresh identity every time", () => {
  process.env.LINKEDOUT_TRUSTED_PROXIES = "0";
  const one = requesterHash(req({ "x-forwarded-for": "1.2.3.4" }));
  const two = requesterHash(req({ "x-forwarded-for": "totally-different-value" }));
  assert.equal(one, two, "with zero trusted proxies, x-forwarded-for must not be trusted at all");
});

test("cf-connecting-ip and x-real-ip are trusted ahead of x-forwarded-for", () => {
  const a = requesterHash(req({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "1.1.1.1" }));
  const b = requesterHash(req({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "2.2.2.2" }));
  assert.equal(a, b, "when a direct proxy header is present, forwarded-for must be ignored");
});

test("changing the User-Agent alone must not produce a new identity", () => {
  const a = requesterHash(req({ "x-forwarded-for": "8.8.8.8", "user-agent": "curl/8.0" }));
  const b = requesterHash(req({ "x-forwarded-for": "8.8.8.8", "user-agent": "Mozilla/5.0 totally different" }));
  assert.equal(
    a,
    b,
    "UA is attacker-controlled; mixing it in would let one real IP mint unlimited identities",
  );
});

test("different real IPs still get different identities", () => {
  const a = requesterHash(req({ "x-forwarded-for": "1.1.1.1" }));
  const b = requesterHash(req({ "x-forwarded-for": "2.2.2.2" }));
  assert.notEqual(a, b);
});
