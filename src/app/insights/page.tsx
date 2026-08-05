import type { Metadata } from "next";
import Link from "next/link";
import { globalStats, listCompanyStats, receiptWall } from "@/lib/db";
import { REASON_MAP, REASONS, reasonLabel } from "@/lib/taxonomy";
import { ReceiptCard } from "@/components/ReceiptCard";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "What the aggregate says: which reasons dominate, which industries are worst, and how often work lands outside working hours.",
};

function weightFor(code: string) {
  return REASON_MAP[code]?.weight ?? 0.5;
}

export default async function InsightsPage() {
  const stats = globalStats();
  const companies = listCompanyStats(weightFor, { limit: 200 });
  const wall = receiptWall(8);

  // Industry roll-up. Computed here rather than in SQL because the set is small and the
  // shape is presentational — no need for another query path to maintain.
  const byIndustry = new Map<string, { n: number; index: number; stories: number }>();
  for (const c of companies) {
    if (!c.industry || c.exit_index === null) continue;
    const cur = byIndustry.get(c.industry) ?? { n: 0, index: 0, stories: 0 };
    byIndustry.set(c.industry, {
      n: cur.n + 1,
      index: cur.index + c.exit_index,
      stories: cur.stories + c.story_count,
    });
  }
  const industries = [...byIndustry.entries()]
    .map(([industry, v]) => ({
      industry,
      companies: v.n,
      stories: v.stories,
      avgIndex: Math.round(v.index / v.n),
    }))
    .sort((a, b) => b.avgIndex - a.avgIndex);

  // Not a sum over topReasons: that list is truncated to 8 rows, so summing it would
  // understate the total and inflate every displayed percentage.
  const totalReasonHits = stats.totalReasonSelections || 1;

  return (
    <>
      <header className="mb-10 max-w-2xl">
        <p className="label-xs">Insights</p>
        <h1 className="mt-2 text-3xl font-bold">What everyone is leaving over</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/75">
          Individual stories are anecdote. In aggregate they are the only public dataset on why people
          actually resign, as opposed to what they wrote in the leaving email.
        </p>
      </header>

      <dl className="card mb-10 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        {[
          { k: "Stories", v: stats.stories.toLocaleString() },
          { k: "Companies", v: stats.companies.toLocaleString() },
          { k: "Average tenure at exit", v: `${stats.avgTenureMonths} mo` },
          { k: "Would warn a friend", v: pct(stats.warnRate) },
        ].map((s) => (
          <div key={s.k} className="border-t border-line p-4 sm:border-t-0">
            <dt className="label-xs">{s.k}</dt>
            <dd className="mt-1 font-mono text-2xl">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-bold">Reasons, ranked</h2>
          <p className="mt-1 text-sm text-muted">Share of all reasons selected across every story.</p>
          <ul className="mt-5 flex flex-col gap-3">
            {stats.topReasons.map((r) => (
              <li key={r.code}>
                <Link href={`/?reason=${r.code}`} className="group block">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="group-hover:text-acid">{reasonLabel(r.code)}</span>
                    <span className="font-mono text-xs text-muted">
                      {pct(r.count / totalReasonHits)} · {r.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-line">
                    <div
                      className="h-2 rounded-full bg-acid/70"
                      style={{ width: `${Math.max(3, (r.count / stats.topReasons[0].count) * 100)}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
            {stats.topReasons.length === 0 && <li className="text-sm text-muted">No data yet.</li>}
          </ul>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-bold">By industry</h2>
          <p className="mt-1 text-sm text-muted">
            Mean Exit Index of scored companies in each industry.
          </p>
          {industries.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              Not enough scored companies yet. Industries appear once companies pass the evidence
              threshold.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {industries.map((i) => (
                <li key={i.industry}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{i.industry}</span>
                    <span className="font-mono text-xs text-muted">
                      {i.avgIndex} · {i.companies} co · {i.stories} stories
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-line">
                    <div
                      className="h-2 rounded-full bg-ember/70"
                      style={{ width: `${Math.max(3, i.avgIndex)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Receipts, unedited</h2>
        <p className="mt-1 text-sm text-muted">
          Sorted with after-hours messages first, because that is the pattern that repeats everywhere.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {wall.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 p-4">
              <ReceiptCard receipt={r} />
              <Link
                href={`/companies/${r.company_slug}`}
                className="mt-auto border-t border-line pt-3 font-mono text-[11px] text-muted hover:text-acid"
              >
                {r.company_name} →
              </Link>
            </div>
          ))}
          {wall.length === 0 && <p className="text-sm text-muted">No receipts posted yet.</p>}
        </div>
      </section>

      <section className="card mt-10 p-6">
        <h2 className="text-lg font-bold">How the Exit Index is calculated</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper/75">
          55% weighted reason mix, 25% average reported severity, 20% share who would warn a friend
          away. Every reason carries a fixed weight, published below, and the whole calculation is
          deliberately simple enough that a company accused of a bad score can be shown exactly how it
          was reached.
        </p>
        <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...REASONS]
            .sort((a, b) => b.weight - a.weight)
            .map((r) => (
              <div key={r.code} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 text-sm">
                <span className="text-paper/80">{r.label}</span>
                <span className="font-mono text-xs text-muted">{r.weight.toFixed(2)}</span>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
