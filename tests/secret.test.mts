import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSecret } from "../src/lib/secret.ts";

// NODE_ENV is typed read-only in @types/node; Object.assign sidesteps that for tests
// that need to flip it back and forth.
function withNodeEnv<T>(value: string, fn: () => T): T {
  const prev = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: value });
  try {
    return fn();
  } finally {
    Object.assign(process.env, { NODE_ENV: prev });
  }
}

test("prefers the specific secret over the fallback", () => {
  assert.equal(resolveSecret("specific", "fallback"), "specific");
});

test("falls back to the shared secret when the specific one is unset", () => {
  assert.equal(resolveSecret(undefined, "fallback"), "fallback");
});

test("outside production, no secret configured returns the dev placeholder", () => {
  withNodeEnv("test", () => {
    assert.equal(resolveSecret(undefined, undefined), "dev-salt-change-me");
    assert.equal(resolveSecret("  ", "  "), "dev-salt-change-me");
  });
});

test("in production, no secret configured throws instead of using the public placeholder", () => {
  withNodeEnv("production", () => {
    assert.throws(() => resolveSecret(undefined, undefined));
    assert.throws(() => resolveSecret("   ", undefined));
  });
});

test("in production, a configured secret is used and does not throw", () => {
  withNodeEnv("production", () => {
    assert.equal(resolveSecret(undefined, "real-secret"), "real-secret");
  });
});
