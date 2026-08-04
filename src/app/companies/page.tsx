import type { Metadata } from "next";
import Link from "next/link";
import { listCompanyStats, MIN_STORIES_FOR_INDEX } from "@/lib/db";
import { REASON_MAP, reasonLabel } from "@/lib/taxonomy";
import { indexBand, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exit Index",
  description:
    "Companies ranked by why their people leave. Built from anonymous, structured exit stories.",
};

function weightFor(code: string) {
  return REASON_MAP[code]?.weight ?? 0.5;
}

export default async function CompaniesPage() {
  const companies = listCompanyStats(weightFor, { limit: 60 });

  return (
    <>
      <header className="mb-8">
        <p className="label-xs">Exit Index</p>
        <h1 className="mt-2 text-3xl font-bold">Where people leave, and why</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/75">
          The Exit Index scores the <em>kind</em> of reasons people gave for leaving, not the volume of
          complaints. 55% reason mix, 25% reported severity, 20% would-warn-a-friend rate. A company
          whose people leave for better offers scores near zero however many stories it has.
        </p>
        <p className="mt-2 text-sm text-muted">
          Companies with fewer than {MIN_STORIES_FOR_INDEX} stories are not scored or ranked.
        </p>
      </header>

      {companies.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">No company has reached the evidence threshold yet.</p>
          <p className="mt-2 text-sm text-muted">
            {MIN_STORIES_FOR_INDEX} independent stories are needed before a company is scored.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left label-xs">
                <th className="py-3 pr-4">#</th>
                <th className="py-3 pr-4">Company</th>
                <th className="py-3 pr-4">Exit Index</th>
                <th className="py-3 pr-4">Stories</th>
                <th className="py-3 pr-4">Warn a friend</th>
                <th className="py-3 pr-4">Left in year one</th>
                <th className="py-3">Top reason</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => {
                const band = indexBand(c.exit_index);
                return (
                  <tr key={c.slug} className="border-b border-line/60 hover:bg-ink-2">
                    <td className="py-3 pr-4 font-mono text-muted">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link href={`/companies/${c.slug}`} className="font-medium hover:text-acid">
                        {c.name}
                      </Link>
                      {c.industry && (
                        <span className="ml-2 font-mono text-[11px] text-muted">{c.industry}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`font-mono text-lg ${band.color}`}>{c.exit_index}</span>
                      <span className="ml-2 text-xs text-muted">{band.label}</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-muted">{c.story_count}</td>
                    <td className="py-3 pr-4 font-mono text-muted">{pct(c.warn_rate)}</td>
                    <td className="py-3 pr-4 font-mono text-muted">{pct(c.early_exit_rate)}</td>
                    <td className="py-3 text-muted">
                      {c.top_reasons[0] ? reasonLabel(c.top_reasons[0].code) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="card mt-10 p-6">
        <h2 className="label-xs">If your company is on this list</h2>
        <p className="mt-3 max-w-2xl text-sm text-paper/75">
          You can publish a response on your company page, and you can see the full breakdown of what
          your leavers said. What you cannot do, at any price, is have stories removed for being
          unflattering — the moment scores are for sale, the index is worth nothing to anyone.
        </p>
        <Link href="/right-of-reply" className="mt-4 inline-block text-sm text-acid hover:underline">
          Right of reply →
        </Link>
      </section>
    </>
  );
}
