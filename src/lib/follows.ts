import { cookies } from "next/headers";

/**
 * Following a company needs a way to recognise "this browser, again" — but unlike
 * echoes and reports, there is no adversarial reason to defend it: following twice,
 * from ten browsers, or with a forged id just means someone sees the wrong button
 * state for themselves. So this is a plain opaque random cookie, not signed and not
 * derived from anything identifying, deliberately lighter than requesterHash().
 */

export const FOLLOWER_COOKIE = "lo_follow";

export async function currentFollowerId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(FOLLOWER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed cookie value is not a valid follower id either way.
    return null;
  }
}

export function followerCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  // encodeURIComponent: the only caller today passes crypto.randomUUID(), which needs
  // no escaping, but this is an exported function and a future caller passing a value
  // containing ";" or a newline would otherwise inject into the Set-Cookie header.
  // HttpOnly: nothing on the client ever reads this cookie directly — every follow
  // state check goes through the API, which reads it server-side.
  return `${FOLLOWER_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${400 * 86400}`;
}
