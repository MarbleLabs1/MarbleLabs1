import Link from "next/link";

/**
 * The stories stay free, always. What is paid is the *analysis* — the cut by department,
 * level and tenure that tells you whether the problem is the company or one team, and
 * whether it is getting worse. Paywalling the stories themselves would kill the supply
 * of stories, which is the only asset here.
 */
export function Paywall({ companyName }: { companyName: string }) {
  return (
    <div className="card relative overflow-hidden border-acid/40 p-5">
      {/* Wash only, no bars: decoration behind body text reads as strikethrough. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-acid/10 via-transparent to-transparent"
      />
      <div className="relative">
        <p className="label-xs text-acid">Candidate plan</p>
        <h2 className="mt-2 text-lg font-bold leading-snug">
          Which team is the problem at {companyName}?
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-paper/75">
          <li>Exits broken out by department and level</li>
          <li>How long people lasted, bucketed</li>
          <li>Whether it is getting worse quarter on quarter</li>
          <li>Interview questions built from these exact exit reasons</li>
        </ul>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-md bg-acid px-3.5 py-2 text-sm font-semibold text-ink hover:opacity-85"
        >
          Unlock full reports — £9/mo
        </Link>
        <p className="mt-3 text-xs text-muted">
          Every story on this page stays free to read. The paid part is the analysis.
        </p>
      </div>
    </div>
  );
}
