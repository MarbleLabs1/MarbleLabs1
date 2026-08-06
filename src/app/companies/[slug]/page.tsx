import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  afterHoursRate,
  commentCounts,
  detectExodus,
  exitBreakdown,
  firstReceipts,
  getCompanyBySlug,
  getCompanyStats,
  isFollowing,
  listStories,
  MIN_STORIES_FOR_INDEX,
  newStoriesSinceFollow,
  receiptCounts,
} from "@/lib/db";
import { REASON_MAP, reasonLabel, tenureLabel } from "@/lib/taxonomy";
import { StoryCard } from "@/components/StoryCard";
import { FollowButton } from "@/components/FollowButton";
import { indexBand, pct } from "@/lib/format";
import { hasPaidAccess } from "@/lib/access";
import { currentFollowerId } from "@/lib/follows";
import { Paywall } from "@/components/Paywall";

export const dynamic = "force-dynamic";

function weightFor(code: string) {
  return REASON_MAP[code]?.weight ?? 0.5;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.name} — exit report`,
    description: `Why people leave ${company.name}, from anonymous exit stories.`,
  };
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-t border-line p-4 sm:border-t-0">
      <p className="label-xs">{label}</p>
      <p className="mt-1 font-mono text-2xl">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Bars({
  rows,
  max,
}: {
  rows: { label: string; n: number; extra?: string }[];
  max: number;
}) {
  return (
    <ul className="mt-3 flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="font-mono text-xs text-muted">
              {r.n}
              {r.extra && ` · ${r.extra}`}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-line">
            <div
              className="h-1.5 rounded-full bg-acid/70"
              style={{ width: `${Math.max(3, (r.n / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);
  if (!company) notFound();

  const stats = getCompanyStats(slug, weightFor);
  const stories = listStories({ companySlug: slug, sort: "echoed", limit: 25 });
  const ids = stories.map((s) => s.id);
  const [counts, cComments, previews] = [receiptCounts(ids), commentCounts(ids), firstReceipts(ids)];
  const exodus = detectExodus(slug);
  const receipts = afterHoursRate(slug);
  const paid = await hasPaidAccess();
  const band = indexBand(stats?.exit_index ?? null);
  const followerId = await currentFollowerId();
  const following = isFollowing(followerId, slug);
  const newSinceFollow = following ? newStoriesSinceFollow(followerId, slug) : 0;

  if (!stats || stats.story_count === 0) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <p className="mt-3 text-paper/75">No published stories for this company yet.</p>
        <Link href="/submit" className="mt-6 inline-block text-acid hover:underline">
          Be the first →
        </Link>
      </div>
    );
  }

  const breakdown = paid ? exitBreakdown(slug) : null;

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold">{company.name}</h1>
          {company.industry && <span className="label-xs">{company.industry}</span>}
          {company.size_bucket && <span className="label-xs">{company.size_bucket} people</span>}
          <FollowButton companySlug={slug} initial={following} />
          {newSinceFollow > 0 && (
            <span className="rounded-full border border-acid/50 bg-acid/10 px-2 py-0.5 font-mono text-[11px] text-acid">
              {newSinceFollow} new since you followed
            </span>
          )}
        </div>
        <p className={`mt-3 max-w-2xl text-[15px] ${band.color}`}>
          <strong>{band.label}.</strong>{" "}
          <span className="text-paper/75">{band.caption}</span>
        </p>
      </header>

      {exodus.length > 0 && (
        <section className="card mb-8 border-alarm/50 bg-alarm/5 p-5">
          <h2 className="label-xs text-alarm">Exodus detected</h2>
          <p className="mt-2 text-sm text-paper/80">
            Whole teams leaving inside their first year is a pattern no single story can show — and the
            one an employer cannot explain away as a personality clash.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {exodus.map((e) => (
              <li key={e.role_family} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <Link href={`/?role=${encodeURIComponent(e.role_family)}`} className="font-semibold hover:text-acid">
                  {e.role_family}
                </Link>
                <span className="text-muted">
                  — {e.short_tenure_exits} of {e.total_exits} exits inside nine months, median tenure{" "}
                  <span className="font-mono text-alarm">{tenureLabel(e.median_tenure_months)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="card mb-8 grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
        <Stat
          label="Exit Index"
          value={stats.exit_index === null ? "—" : String(stats.exit_index)}
          note={stats.exit_index === null ? `needs ${MIN_STORIES_FOR_INDEX}+ stories` : band.label}
        />
        <Stat label="Stories" value={String(stats.story_count)} />
        <Stat label="Warn a friend" value={pct(stats.warn_rate)} note="would tell others not to" />
        <Stat label="Left in year one" value={pct(stats.early_exit_rate)} />
        <Stat
          label="After-hours receipts"
          value={receipts.total === 0 ? "—" : pct(receipts.after_hours / receipts.total)}
          note={receipts.total > 0 ? `${receipts.after_hours} of ${receipts.total}` : "no receipts yet"}
        />
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
        <div>
          <h2 className="mb-4 text-xl font-bold">What people said on the way out</h2>
          <div className="flex flex-col gap-4">
            {stories.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                receiptCount={counts[s.id] ?? 0}
                commentCount={cComments[s.id] ?? 0}
                previewReceipt={previews[s.id]}
              />
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="card p-5">
            <h2 className="label-xs">Reasons given</h2>
            <Bars
              rows={stats.top_reasons.map((r) => ({ label: reasonLabel(r.code), n: r.count }))}
              max={stats.top_reasons[0]?.count ?? 1}
            />
          </div>

          {breakdown ? (
            <>
              <div className="card p-5">
                <h2 className="label-xs">Exits by department</h2>
                <Bars
                  rows={breakdown.byRole.map((r) => ({
                    label: r.role_family,
                    n: r.n,
                    extra: `sev ${r.avg_severity}`,
                  }))}
                  max={breakdown.byRole[0]?.n ?? 1}
                />
              </div>
              <div className="card p-5">
                <h2 className="label-xs">Exits by level</h2>
                <Bars
                  rows={breakdown.bySeniority.map((r) => ({
                    label: r.seniority,
                    n: r.n,
                    extra: `sev ${r.avg_severity}`,
                  }))}
                  max={breakdown.bySeniority[0]?.n ?? 1}
                />
              </div>
              <div className="card p-5">
                <h2 className="label-xs">How long they lasted</h2>
                <Bars
                  rows={breakdown.byTenure.map((r) => ({ label: r.bucket, n: r.n }))}
                  max={Math.max(...breakdown.byTenure.map((r) => r.n), 1)}
                />
              </div>
            </>
          ) : (
            <Paywall companyName={company.name} />
          )}

          <div className="card p-5">
            <h2 className="label-xs">Worked here?</h2>
            <Link
              href="/submit"
              className="mt-3 inline-block rounded-md bg-acid px-3.5 py-2 text-sm font-semibold text-ink hover:opacity-85"
            >
              Add your story
            </Link>
            <p className="mt-3 text-xs text-muted">
              Are you {company.name}?{" "}
              <Link href="/right-of-reply" className="text-paper underline decoration-line">
                Respond on the record
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
