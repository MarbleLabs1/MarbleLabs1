import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { adminEnabled, signSession, tokenMatches, verifySession } from "../src/lib/admin-token.ts";

beforeEach(() => {
  process.env.LINKEDOUT_SALT = "test-salt";
  process.env.LINKEDOUT_ADMIN_TOKEN = "correct-horse-battery-staple";
});

test("moderation is unreachable when no token is configured", () => {
  delete process.env.LINKEDOUT_ADMIN_TOKEN;
  assert.equal(adminEnabled(), false);
  assert.equal(tokenMatches("anything"), false, "no token must never mean any token");
  assert.equal(tokenMatches(""), false);
  // A session signed while enabled must stop working once the token is withdrawn.
  process.env.LINKEDOUT_ADMIN_TOKEN = "x";
  const token = signSession();
  delete process.env.LINKEDOUT_ADMIN_TOKEN;
  assert.equal(verifySession(token), false);
});

test("accepts the right token and nothing else", () => {
  assert.equal(tokenMatches("correct-horse-battery-staple"), true);
  for (const wrong of [
    "correct-horse-battery-stapl",
    "correct-horse-battery-staple ",
    "Correct-horse-battery-staple",
    "",
    "c",
  ]) {
    assert.equal(tokenMatches(wrong), false, JSON.stringify(wrong));
  }
});

test("a signed session verifies", () => {
  assert.equal(verifySession(signSession()), true);
});

test("a tampered or forged session does not", () => {
  const good = signSession();
  const [expiry, sig] = good.split(".");
  for (const bad of [
    undefined,
    "",
    "notatoken",
    expiry,
    `${expiry}.`,
    `${expiry}.${sig}x`,
    `${Number(expiry) + 86_400_000}.${sig}`, // extend the expiry, keep the old signature
    `${expiry}.${Buffer.from("forged").toString("base64url")}`,
  ]) {
    assert.equal(verifySession(bad as string | undefined), false, String(bad));
  }
});

test("an expired session does not verify", () => {
  // Sign, then jump the clock past the 12-hour window.
  const token = signSession();
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 13 * 3_600_000;
    assert.equal(verifySession(token), false);
  } finally {
    Date.now = realNow;
  }
});

test("sessions signed under a different salt do not verify", () => {
  const token = signSession();
  process.env.LINKEDOUT_SALT = "a-different-salt";
  assert.equal(verifySession(token), false, "rotating the salt must invalidate sessions");
});
