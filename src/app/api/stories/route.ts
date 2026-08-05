import { nanoid } from "nanoid";
import { z } from "zod";
import {
  db,
  insertReceipts,
  insertStory,
  listStories,
  recentPostCount,
  upsertCompany,
} from "@/lib/db";
import { screen } from "@/lib/moderation";
import { looksAfterHours } from "@/lib/receipts";
import { json, requesterHash } from "@/lib/request";
import { REASON_CODES, ROLE_FAMILIES, SENIORITIES, SIZE_BUCKETS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const MAX_POSTS_PER_DAY = 3;
const MAX_RECEIPTS = 8;

const ReceiptInput = z.object({
  kind: z.enum(["chat", "email", "invite", "policy", "review"]),
  senderRole: z.string().trim().min(2).max(60),
  sentAtLabel: z.string().trim().max(60).optional(),
  subject: z.string().trim().max(140).optional(),
  content: z.string().trim().min(2).max(1200),
  /** Poster can override the parsed guess — they were there, we were not. */
  afterHours: z.boolean().optional(),
});

const CreateStory = z.object({
  company: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(60).optional(),
  sizeBucket: z.enum(SIZE_BUCKETS).optional(),
  headline: z.string().trim().min(8).max(120),
  body: z.string().min(1).max(8000),
  roleFamily: z.enum(ROLE_FAMILIES),
  seniority: z.enum(SENIORITIES),
  tenureMonths: z.coerce.number().int().min(0).max(600),
  // Deduplicated after the length check: three copies of the same reason should not
  // count as three data points in reasonCounts()/topReasons(), which tally one JSON
  // array entry per row. A duplicate submission is still a valid 1-6 length submission
  // pre-dedup, so the min/max bounds apply to what the poster picked, not the stored set.
  reasons: z
    .array(z.enum(REASON_CODES as [string, ...string[]]))
    .min(1)
    .max(6)
    .transform((codes) => [...new Set(codes)]),
  severity: z.coerce.number().int().min(1).max(5),
  warnFriend: z.boolean(),
  region: z.string().trim().max(60).optional(),
  /**
   * Not decoration. The poster confirms this is their own experience and their own
   * opinion, which is what makes the moderation policy enforceable rather than
   * aspirational.
   */
  attest: z.literal(true),
  receipts: z.array(ReceiptInput).max(MAX_RECEIPTS).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const stories = listStories({
    reason: url.searchParams.get("reason") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    companySlug: url.searchParams.get("company") ?? undefined,
    sort: (url.searchParams.get("sort") as "recent" | "echoed" | "severe" | null) ?? "recent",
    limit: Number(url.searchParams.get("limit") ?? 25),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return json({ stories });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }

  const parsed = CreateStory.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        error: "Some fields need fixing.",
        fields: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      422,
    );
  }
  const input = parsed.data;

  const authorHash = requesterHash(req);
  if (recentPostCount(authorHash) >= MAX_POSTS_PER_DAY) {
    return json(
      {
        error: `You can post ${MAX_POSTS_PER_DAY} stories a day. This keeps one angry afternoon from becoming a campaign against one company.`,
      },
      429,
    );
  }

  const verdict = screen({ headline: input.headline, body: input.body });

  // Receipts get screened as hard as the story: a quoted chat message is exactly where a
  // real name or an email address slips through.
  const receiptFindings = (input.receipts ?? []).flatMap((r, i) => {
    const res = screen({ headline: r.subject ?? "Receipt", body: r.content.padEnd(120, " ") });
    return res.findings
      .filter((f) => f.code !== "too_short")
      .map((f) => ({ ...f, message: `Receipt ${i + 1}: ${f.message}` }));
  });

  const allFindings = [...verdict.findings, ...receiptFindings];
  if (!verdict.ok || receiptFindings.some((f) => f.action === "block")) {
    return json({ error: "This post needs changes before it can go up.", findings: allFindings }, 422);
  }

  const id = nanoid(12);
  const flagged = allFindings.some((f) => f.action === "flag");

  // One transaction: a receipt-insert failure after the story is already written would
  // otherwise leave a published story missing the receipts it was submitted with, with
  // no error surfaced to the poster to explain why.
  const companySlug = db().transaction(() => {
    const company = upsertCompany({
      name: input.company,
      industry: input.industry ?? null,
      size_bucket: input.sizeBucket ?? null,
    });

    insertStory({
      id,
      company_id: company.id,
      headline: input.headline,
      body: verdict.redacted,
      role_family: input.roleFamily,
      seniority: input.seniority,
      tenure_months: input.tenureMonths,
      reasons: input.reasons,
      severity: input.severity,
      warn_friend: input.warnFriend,
      region: input.region ?? null,
      status: flagged ? "review" : "published",
      findings: allFindings,
      author_hash: authorHash,
    });

    if (input.receipts?.length) {
      insertReceipts(
        id,
        input.receipts.map((r) => ({
          kind: r.kind,
          sender_role: r.senderRole,
          sent_at_label: r.sentAtLabel ?? null,
          subject: r.subject ?? null,
          content: r.content,
          after_hours: r.afterHours ?? looksAfterHours(r.sentAtLabel ?? ""),
        })),
      );
    }

    return company.slug;
  })();

  return json(
    {
      id,
      status: flagged ? "review" : "published",
      companySlug,
      findings: allFindings,
    },
    201,
  );
}
