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
  return jar.get(FOLLOWER_COOKIE)?.value ?? null;
}

export function followerCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${FOLLOWER_COOKIE}=${id}; Path=/;${secure} SameSite=Lax; Max-Age=${400 * 86400}`;
}
