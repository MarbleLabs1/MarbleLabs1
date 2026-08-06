import Link from "next/link";
import { commentCounts, firstReceipts, globalStats, listStories, receiptCounts, receiptWall } from "@/lib/db";
import { REASONS, ROLE_FAMILIES, reasonLabel } from "@/lib/taxonomy";
import { StoryCard } from "@/components/StoryCard";
import { ReceiptCard } from "@/components/ReceiptCard";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const SORTS = [
  { key: "recent", label: "Newest" },
  { key: "echoed", label: "Most corroborated" },
  { key: "severe", label: "Most severe" },
] as const;

function Hero({ stats }: { stats: ReturnType<typeof globalStats> }) {
  return (
    <section className="card mb-8 overflow-hidden">
      <div className="border-b border-line p-6 sm:p-8">
        <p className="label-xs">Exit interviews nobody edits</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
          The exit interview said <span className="text-muted line-through">&ldquo;pursuing a new opportunity&rdquo;</span>
          <br />
          This is what they actually said afterwards.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-paper/75">
          Anonymous, structured accounts of why people really left. Every story is tagged with
          reasons, tenure and role, so a hundred separate resignations turn into something you can
          search before you sign an offer.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/submit"
            className="rounded-md bg-acid px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-85"
          >
            Tell your story — anonymously
          </Link>
          <Link
            href="/companies"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold hover:border-acid hover:text-acid"
          >
            Look up a company
          </Link>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        {[
          { k: "Stories", v: stats.stories.toLocaleString() },
          { k: "Companies", v: stats.companies.toLocaleString() },
          { k: "Average tenure", v: `${stats.avgTenureMonths} mo` },
          { k: "Would warn a friend", v: pct(stats.warnRate) },
        ].map((s) => (
          <div key={s.k} className="border-t border-line p-4 sm:border-t-0">
            <dt className="label-xs">{s.k}</dt>
            <dd className="mt-1 font-mono text-2xl">{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; role?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "recent") as
    | "recent"
    | "echoed"
    | "severe";
  const stats = globalStats();
  const stories = listStories({ reason: sp.reason, role: sp.role, sort, limit: 30 });
  const ids = stories.map((s) => s.id);
  const counts = receiptCounts(ids);
  const cComments = commentCounts(ids);
  const previews = firstReceipts(ids);
  const wall = receiptWall(6);

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { reason: sp.reason, role: sp.role, sort: sp.sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <Hero stats={stats} />

      {wall.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">The wall of receipts</h2>
              <p className="mt-1 text-sm text-muted">
                Not paraphrased. What was actually said, transcribed by the person it was said to.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {wall.map((r) => (
              <div key={r.id} className="card flex flex-col gap-3 p-4">
                <ReceiptCard receipt={r} />
                <Link
                  href={`/stories/${r.story_id}`}
                  className="mt-auto border-t border-line pt-3 font-mono text-[11px] text-muted hover:text-acid"
                >
                  {r.company_name} — {r.headline} →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div>
          <Link
            href="/submit"
            className="card mb-4 flex items-center gap-3 p-3.5 text-sm text-muted transition-colors hover:border-acid hover:text-paper"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-line font-mono text-[11px] text-muted"
            >
              ??
            </span>
            What happened at your last job?
          </Link>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={qs({ sort: s.key })}
                className={`rounded-md px-3 py-1.5 font-mono text-xs ${
                  sort === s.key ? "bg-paper text-ink" : "border border-line text-muted hover:text-paper"
                }`}
              >
                {s.label}
              </Link>
            ))}
            {(sp.reason || sp.role) && (
              <Link href={qs({ reason: undefined, role: undefined })} className="ml-auto text-xs text-acid hover:underline">
                clear filters ✕
              </Link>
            )}
          </div>

          {(sp.reason || sp.role) && (
            <p className="mb-4 font-mono text-xs text-muted">
              Filtered to{" "}
              {sp.reason && <span className="text-acid">{reasonLabel(sp.reason)}</span>}
              {sp.reason && sp.role && " · "}
              {sp.role && <span className="text-acid">{sp.role}</span>} — {stories.length} stories
            </p>
          )}

          {stories.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-lg font-semibold">Nothing here yet.</p>
              <p className="mt-2 text-sm text-muted">
                {sp.reason || sp.role
                  ? "No stories match that filter."
                  : "Seed the database with `npm run seed`, or be the first to post."}
              </p>
              <Link href="/submit" className="mt-4 inline-block text-sm text-acid hover:underline">
                Tell your story →
              </Link>
            </div>
          ) : (
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
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <div className="card p-5">
            <h2 className="label-xs">Why people are leaving</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {stats.topReasons.map((r) => {
                const max = stats.topReasons[0]?.count || 1;
                return (
                  <li key={r.code}>
                    <Link href={qs({ reason: r.code })} className="group block">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className={sp.reason === r.code ? "text-acid" : "group-hover:text-acid"}>
                          {reasonLabel(r.code)}
                        </span>
                        <span className="font-mono text-xs text-muted">{r.count}</span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-line">
                        <div
                          className="h-1 rounded-full bg-acid/70"
                          style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
              {stats.topReasons.length === 0 && (
                <li className="text-sm text-muted">No data yet.</li>
              )}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="label-xs">By department</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ROLE_FAMILIES.map((r) => (
                <Link
                  key={r}
                  href={qs({ role: r })}
                  className={`rounded border px-2 py-1 font-mono text-[11px] ${
                    sp.role === r
                      ? "border-acid text-acid"
                      : "border-line text-muted hover:border-acid hover:text-acid"
                  }`}
                >
                  {r}
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="label-xs">All reasons</h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {REASONS.filter((r) => r.weight > 0).map((r) => (
                <li key={r.code}>
                  <Link href={qs({ reason: r.code })} className="text-muted hover:text-acid">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
