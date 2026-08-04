import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySession } from "./admin-token";

/**
 * The Next-aware half of moderator access. All the crypto lives in `admin-token.ts`,
 * which imports nothing from Next so it can be unit-tested.
 */

export {
  ADMIN_COOKIE,
  SESSION_HOURS,
  adminEnabled,
  sessionCookie,
  signSession,
  tokenMatches,
  verifySession,
} from "./admin-token";

export async function isModerator(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(ADMIN_COOKIE)?.value);
}
