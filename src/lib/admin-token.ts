import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Moderator token and session crypto. Deliberately free of any Next.js import so it can
 * be unit-tested directly — `next/headers` only resolves inside the framework runtime,
 * and this is the half that most needs testing.
 *
 * There is no user system on this site by design: posters are anonymous and readers need
 * no account. So the moderation queue is gated by a single shared token rather than a
 * login. That is the right trade for one or two moderators and the wrong one the moment
 * there are five — at that point you want per-moderator accounts so the audit log can
 * record *who* decided, not just what was decided.
 *
 * Fails closed. With LINKEDOUT_ADMIN_TOKEN unset the queue is unreachable, because the
 * alternative — an admin surface with no password because someone forgot an env var — is
 * how moderation tools end up publicly writable.
 */

export const ADMIN_COOKIE = "lo_mod";

/** How long a moderator session lasts. Short: this cookie approves and deletes content. */
export const SESSION_HOURS = 12;

export function adminEnabled(): boolean {
  return Boolean(process.env.LINKEDOUT_ADMIN_TOKEN);
}

function signingKey(): string {
  return process.env.LINKEDOUT_SALT ?? "dev-salt-change-me";
}

/** Constant-time compare, so a wrong token cannot be discovered one character at a time. */
export function tokenMatches(candidate: string): boolean {
  const expected = process.env.LINKEDOUT_ADMIN_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signSession(): string {
  const expiry = Date.now() + SESSION_HOURS * 3_600_000;
  const sig = createHmac("sha256", signingKey()).update(`mod.${expiry}`).digest("base64url");
  return `${expiry}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!adminEnabled() || !token) return false;
  const [expiryRaw, sig] = token.split(".");
  if (!expiryRaw || !sig) return false;
  const expected = createHmac("sha256", signingKey()).update(`mod.${expiryRaw}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(expiryRaw) > Date.now();
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}
