import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReceipts, getStory, listStories } from "@/lib/db";
import { ReasonChip, StoryCard } from "@/components/StoryCard";
import { EchoButton } from "@/components/EchoButton";
import { ReportButton } from "@/components/ReportButton";
import { ReceiptStack } from "@/components/ReceiptCard";
import { relativeTime } from "@/lib/format";
import { tenureLabel } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = getStory(id);
  if (!story) return { title: "Story not found" };
  return {
    title: story.headline,
    description: `${story.role_family} at ${story.company_name} — ${story.body.slice(0, 150)}…`,
  };
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const story = getStory(id);
  if (!story) notFound();

  if (story.status !== "published") {
    return (
      <div className="card mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-bold">This story is under review</h1>
        <p className="mt-3 text-paper/75">
          {sp.new
            ? "Your story was submitted. Something in it triggered a manual check — usually an allegation of unlawful conduct — so a human reads it before it goes live. Nothing more is needed from you."
            : "It was flagged and a human is reading it. It will either come back or be removed."}
        </p>
        <Link href="/" className="mt-6 inline-block text-acid hover:underline">
          ← Back to the feed
        </Link>
      </div>
    );
  }

  const receipts = getReceipts(story.id);
  const alsoAtCompany = listStories({ companySlug: story.company_slug, limit: 4 }).filter(
    (s) => s.id !== story.id,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
      <article>
        {sp.new && (
          <div className="card mb-6 border-acid/50 bg-acid/5 p-4">
            <p className="font-semibold text-acid">Published.</p>
            <p className="mt-1 text-sm text-paper/80">
              Your story is live and anonymous. Share this link — corroboration from colleagues is what
              makes it count.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 label-xs">
          <Link href={`/companies/${story.company_slug}`} className="text-acid hover:underline">
            {story.company_name}
          </Link>
          <span aria-hidden>/</span>
          <span>
            {story.seniority} · {story.role_family}
          </span>
          <span aria-hidden>/</span>
          <span>stayed {tenureLabel(story.tenure_months)}</span>
          {story.region && (
            <>
              <span aria-hidden>/</span>
              <span>{story.region}</span>
            </>
          )}
          <span aria-hidden>/</span>
          <time dateTime={story.created_at}>{relativeTime(story.created_at)}</time>
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-tight">{story.headline}</h1>

        <div className="mt-5 flex flex-wrap gap-2">
          {story.reasons.map((c) => (
            <ReasonChip key={c} code={c} />
          ))}
        </div>

        <div className="mt-6 whitespace-pre-line text-[17px] leading-relaxed text-paper/90">
          {story.body}
        </div>

        <ReceiptStack receipts={receipts} />

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <EchoButton storyId={story.id} initial={story.echoes} />
          <ReportButton storyId={story.id} />
          <span className="ml-auto font-mono text-xs text-muted">
            severity {story.severity}/5
            {story.warn_friend && <span className="text-ember"> · would warn a friend off</span>}
          </span>
        </div>

        {alsoAtCompany.length > 0 && (
          <section className="mt-12">
            <h2 className="label-xs">
              Others who left {story.company_name}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              {alsoAtCompany.map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
            </div>
            <Link
              href={`/companies/${story.company_slug}`}
              className="mt-4 inline-block text-sm text-acid hover:underline"
            >
              See the full exit report for {story.company_name} →
            </Link>
          </section>
        )}
      </article>

      <aside className="flex flex-col gap-5">
        <div className="card p-5">
          <h2 className="label-xs">Reading this as evidence</h2>
          <p className="mt-3 text-sm text-paper/75">
            One story is one person&rsquo;s experience, honestly given and impossible to verify. The
            number that matters is how many other people said &ldquo;same here&rdquo; — and whether the
            company&rsquo;s other stories say the same thing.
          </p>
        </div>
        <div className="card p-5">
          <h2 className="label-xs">Worked here too?</h2>
          <p className="mt-3 text-sm text-paper/75">
            Corroboration is the whole point. Post your own version — it takes four minutes and no
            account.
          </p>
          <Link
            href="/submit"
            className="mt-4 inline-block rounded-md bg-acid px-3.5 py-2 text-sm font-semibold text-ink hover:opacity-85"
          >
            Add your story
          </Link>
        </div>
      </aside>
    </div>
  );
}
