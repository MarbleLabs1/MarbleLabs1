import { z } from "zod";
import { adminEnabled, sessionCookie, signSession, tokenMatches } from "@/lib/admin";
import { anonHash } from "@/lib/db";
import { json, requesterHash } from "@/lib/request";

export const dynamic = "force-dynamic";

const Login = z.object({ token: z.string().min(1).max(200) });

/**
 * Naive in-memory throttle on wrong tokens. It resets on deploy and does not survive
 * multiple instances — good enough to make an online guessing attack tedious, and not
 * a substitute for a long random token.
 */
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

function throttled(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.n >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(key, { n: 1, first: Date.now() });
  } else {
    rec.n += 1;
  }
}

export async function POST(req: Request) {
  if (!adminEnabled()) {
    return json({ error: "Moderation is not configured on this deployment." }, 404);
  }

  const key = anonHash(requesterHash(req));
  if (throttled(key)) {
    return json({ error: "Too many attempts. Wait fifteen minutes." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  const parsed = Login.safeParse(body);
  if (!parsed.success || !tokenMatches(parsed.data.token)) {
    recordFailure(key);
    return json({ error: "That token is not right." }, 401);
  }

  attempts.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionCookie(signSession(), 12 * 3600),
    },
  });
}

/** Sign out by expiring the cookie. */
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": sessionCookie("", 0) },
  });
}
