import { addEcho, getStory } from "@/lib/db";
import { json, requesterHash } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getStory(id);
  if (!story || story.status !== "published") {
    return json({ error: "No such story." }, 404);
  }
  const { added, total } = addEcho(id, requesterHash(req));
  return json({ added, total });
}
