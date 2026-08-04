import Link from "next/link";
import type { Receipt, Story } from "@/lib/db";
import { REASON_MAP, tenureLabel } from "@/lib/taxonomy";
import { EchoButton } from "./EchoButton";
import { ReceiptCard } from "./ReceiptCard";
import { relativeTime } from "@/lib/format";

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

export function StoryCard({
  story,
  excerpt = true,
  receiptCount = 0,
  previewReceipt,
}: {
  story: Story;
  excerpt?: boolean;
  receiptCount?: number;
  /** First receipt, shown inline — a 6:47pm invite stops the scroll where a paragraph does not. */
  previewReceipt?: Receipt;
}) {
  const body = excerpt && story.body.length > 420 ? `${story.body.slice(0, 420).trimEnd()}…` : story.body;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 label-xs">
        <Link href={`/companies/${story.company_slug}`} className="text-acid hover:underline">
          {story.company_name}
        </Link>
        <span aria-hidden>/</span>
        <span>{story.role_family}</span>
        <span aria-hidden>/</span>
        <span>{story.seniority}</span>
        <span aria-hidden>/</span>
        <span>stayed {tenureLabel(story.tenure_months)}</span>
        <span className="ml-auto flex items-center gap-3">
          {receiptCount > 0 && !previewReceipt && (
            <span className="rounded-full border border-acid/50 bg-acid/10 px-2 py-0.5 text-[10px] text-acid">
              {receiptCount} receipt{receiptCount === 1 ? "" : "s"}
            </span>
          )}
          <SeverityBar value={story.severity} />
          <time dateTime={story.created_at}>{relativeTime(story.created_at)}</time>
        </span>
      </div>

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

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <EchoButton storyId={story.id} initial={story.echoes} />
        {story.warn_friend && (
          <span className="font-mono text-[11px] text-ember">would warn a friend off</span>
        )}
      </div>
    </article>
  );
}
