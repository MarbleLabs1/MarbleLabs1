/**
 * Runs once when the server starts, before it serves any request. The one thing worth
 * checking that early: whether a production deployment has a real signing/hashing
 * secret configured. The alternative — finding out at first request, or never, because
 * the fallback silently works — is exactly the "someone forgot an env var" failure mode
 * this exists to catch before it reaches a user.
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  const hasHashKey = Boolean(process.env.LINKEDOUT_HASH_KEY?.trim() || process.env.LINKEDOUT_SALT?.trim());
  const hasCookieSecret = Boolean(
    process.env.LINKEDOUT_COOKIE_SECRET?.trim() || process.env.LINKEDOUT_SALT?.trim(),
  );

  if (!hasHashKey || !hasCookieSecret) {
    throw new Error(
      "LinkedOut refuses to start in production without a signing/hashing secret. Set " +
        "LINKEDOUT_SALT (covers both), or the more specific LINKEDOUT_HASH_KEY and " +
        "LINKEDOUT_COOKIE_SECRET — see .env.example.",
    );
  }
}
