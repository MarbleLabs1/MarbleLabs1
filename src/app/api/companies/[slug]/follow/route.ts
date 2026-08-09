import { follow, isFollowing, unfollow } from "@/lib/db";
import { currentFollowerId, followerCookie } from "@/lib/follows";
import { json } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await currentFollowerId();
  return json({ following: isFollowing(id, slug) });
}

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let id = await currentFollowerId();
  const isNewFollower = !id;
  if (!id) id = crypto.randomUUID();

  const result = follow(id, slug);
  if (!result.ok) return json({ error: "No such company." }, 404);

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (isNewFollower) headers["set-cookie"] = followerCookie(id);
  return new Response(JSON.stringify({ following: true }), { status: 200, headers });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await currentFollowerId();
  if (id) unfollow(id, slug);
  return json({ following: false });
}
