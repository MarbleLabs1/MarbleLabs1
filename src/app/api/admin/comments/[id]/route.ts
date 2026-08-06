import { z } from "zod";
import { isModerator } from "@/lib/admin";
import { moderateComment } from "@/lib/db";
import { json } from "@/lib/request";

export const dynamic = "force-dynamic";

const Decision = z.object({
  action: z.enum(["approve", "remove"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isModerator())) {
    return json({ error: "Not found." }, 404);
  }

  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId)) return json({ error: "Not found." }, 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }

  const parsed = Decision.safeParse(body);
  if (!parsed.success) return json({ error: "Pick an action." }, 422);

  const { action, note } = parsed.data;
  if (action === "remove" && !note) {
    return json({ error: "Removals need a reason — it goes in the audit log." }, 422);
  }

  const result = moderateComment(commentId, action, note ?? null);
  if (!result.ok) return json({ error: result.error }, 409);

  return json({ ok: true, status: result.status });
}
