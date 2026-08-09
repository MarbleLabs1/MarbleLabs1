import Link from "next/link";
import type { Receipt, Story } from "@/lib/db";
import { REASON_MAP, tenureLabel } from "@/lib/taxonomy";
import { EchoButton } from "./EchoButton";
import { ReceiptCard } from "./ReceiptCard";
import { ShareButton } from "./ShareButton";
import { relativeTime } from "@/lib/format";
import { avatarGradientFor, initialsFromPseudonym } from "@/lib/identity";

function SeverityBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Severity ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`h-3 w-1.5 rounded-sm ${
            i <= value ? (value >= 4 ? "bg-alarm" : "bg-ember") : "bg-line"
          }`}
        />
      ))}
      <span className="sr-only">Severity {value} of 5</span>
    </span>
  );
}

export function ReasonChip({ code }: { code: string }) {
  const reason = REASON_MAP[code];
  if (!reason) return null;
  return (
    <Link
      href={`/?reason=${code}`}
      className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:border-acid hover:text-acid"
    >
      {reason.label}
    </Link>
  );
}

/** The pseudonym + role/tenure line that makes a card read as "someone posted this",
 *  not "a database row rendered this" — see src/lib/identity.ts for what it is and isn't. */
function PostHeader({ story }: { story: Story }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full p-[2px]"
        style={{ backgroundImage: avatarGradientFor(story.pseudonym) }}
      >
        <span className="grid size-full place-items-center rounded-full bg-ink font-mono text-[11px] text-paper">
          {initialsFromPseudonym(story.pseudonym)}
        </span>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{story.pseudonym}</p>
        <p className="mt-0.5 label-xs">
          {story.seniority} {story.role_family} at{" "}
          <Link href={`/companies/${story.company_slug}`} className="text-acid hover:underline">
            {story.company_name}
          </Link>{" "}
          · stayed {tenureLabel(story.tenure_months)}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2.5 pt-0.5">
        <SeverityBar value={story.severity} />
        <time dateTime={story.created_at} className="label-xs whitespace-nowrap">
          {relativeTime(story.created_at)}
        </time>
      </div>
    </div>
  );
}

export function StoryCard({
  story,
  excerpt = true,
  receiptCount = 0,
  commentCount = 0,
  previewReceipt,
}: {
  story: Story;
  excerpt?: boolean;
  receiptCount?: number;
  commentCount?: number;
  /** First receipt, shown inline — a 6:47pm invite stops the scroll where a paragraph does not. */
  previewReceipt?: Receipt;
}) {
  const body = excerpt && story.body.length > 420 ? `${story.body.slice(0, 420).trimEnd()}…` : story.body;

  return (
    <article className="card p-5">
      <PostHeader story={story} />

      {receiptCount > 0 && !previewReceipt && (
        <span className="mt-3 inline-block rounded-full border border-acid/50 bg-acid/10 px-2 py-0.5 font-mono text-[10px] text-acid">
          {receiptCount} receipt{receiptCount === 1 ? "" : "s"}
        </span>
      )}

      <h2 className="mt-3 text-lg font-semibold leading-snug">
        <Link href={`/stories/${story.id}`} className="hover:text-acid">
          {story.headline}
        </Link>
      </h2>

      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-paper/80">{body}</p>

      {excerpt && story.body.length > 420 && (
        <Link href={`/stories/${story.id}`} className="mt-2 inline-block text-sm text-acid hover:underline">
          Read the rest →
        </Link>
      )}

      {previewReceipt && (
        <div className="mt-4 rounded-md border border-line/70 bg-ink/40 p-4">
          <ReceiptCard receipt={previewReceipt} />
          {receiptCount > 1 && (
            <Link
              href={`/stories/${story.id}`}
              className="mt-3 inline-block font-mono text-[11px] text-acid hover:underline"
            >
              + {receiptCount - 1} more receipt{receiptCount - 1 === 1 ? "" : "s"} →
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {story.reasons.map((code) => (
          <ReasonChip key={code} code={code} />
        ))}
      </div>

      {story.warn_friend && (
        <p className="mt-3 font-mono text-[11px] text-ember">would warn a friend off</p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
        <EchoButton storyId={story.id} initial={story.echoes} />
        <Link
          href={`/stories/${story.id}#comments`}
          className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-acid hover:text-acid"
        >
          <span aria-hidden>◇</span>
          <span>{commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : "comment"}</span>
        </Link>
        <ShareButton url={`/stories/${story.id}`} title={story.headline} />
      </div>
    </article>
  );
}
