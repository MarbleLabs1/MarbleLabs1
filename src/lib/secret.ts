/**
 * Every signing/hashing key in this app falls back to LINKEDOUT_SALT when its more
 * specific env var is unset. That fallback is a real convenience in development — the
 * app runs with zero setup — but the fixed placeholder it resolves to is sitting in
 * `.env.example`, which is public the moment this repo is. Silently using it in
 * production would mean anyone who has read the source can forge a signed cookie or
 * recompute an anonymous hash. Fail loud instead: production with no secret configured
 * does not start serving requests, it throws.
 */
export function resolveSecret(specific: string | undefined, fallback: string | undefined): string {
  const value = specific?.trim() || fallback?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No signing/hashing secret configured. Set LINKEDOUT_SALT (or the more specific " +
        "LINKEDOUT_HASH_KEY / LINKEDOUT_COOKIE_SECRET) before running in production.",
    );
  }
  return "dev-salt-change-me";
}
