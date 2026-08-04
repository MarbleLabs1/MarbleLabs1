import { z } from "zod";
import { addReport, getStory } from "@/lib/db";
import { json, requesterHash } from "@/lib/request";

export const dynamic = "force-dynamic";

export const REPORT_REASONS = [
  "names_individual",
  "false_or_fabricated",
  "identifying_details",
  "harassment",
  "not_an_exit_story",
  "spam",
] as const;

const Report = z.object({
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getStory(id)) return json({ error: "No such story." }, 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  const parsed = Report.safeParse(body);
  if (!parsed.success) return json({ error: "Pick a reason." }, 422);

  const { hidden } = addReport({
    storyId: id,
    reason: parsed.data.reason,
    detail: parsed.data.detail ?? null,
    reporterHash: requesterHash(req),
  });

  return json({
    received: true,
    hidden,
    message: hidden
      ? "Enough people flagged this that it is now hidden pending review."
      : "Reported. A human reviews every report.",
  });
}
