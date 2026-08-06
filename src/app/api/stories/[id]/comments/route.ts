import { z } from "zod";
import {
  getComments,
  getStory,
  insertComment,
  recentCommentCount,
} from "@/lib/db";
import { screenShort } from "@/lib/moderation";
import { json, requesterHash } from "@/lib/request";

export const dynamic = "force-dynamic";

const MAX_COMMENTS_PER_DAY = 20;

const CreateComment = z.object({
  body: z.string().trim().min(2).max(600),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getStory(id);
  // Matches the boundary POST already enforces: once a story is held or removed,
  // nothing about it — including its comments — should still be fetchable here.
  if (!story || story.status !== "published") return json({ error: "No such story." }, 404);
  return json({ comments: getComments(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getStory(id);
  if (!story || story.status !== "published") return json({ error: "No such story." }, 404);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  const parsed = CreateComment.safeParse(payload);
  if (!parsed.success) return json({ error: "Comment can't be empty." }, 422);

  const authorHash = requesterHash(req);
  if (recentCommentCount(authorHash) >= MAX_COMMENTS_PER_DAY) {
    return json(
      { error: `You can post ${MAX_COMMENTS_PER_DAY} comments a day.` },
      429,
    );
  }

  const verdict = screenShort({ label: "Comment", body: parsed.data.body });
  if (!verdict.ok) {
    return json({ error: "This comment needs changes before it can go up.", findings: verdict.findings }, 422);
  }

  const flagged = verdict.findings.some((f) => f.action === "flag");
  const commentId = insertComment({
    story_id: id,
    body: verdict.redacted,
    status: flagged ? "review" : "published",
    findings: verdict.findings,
    author_hash: authorHash,
  });

  return json({ id: commentId, status: flagged ? "review" : "published" }, 201);
}
