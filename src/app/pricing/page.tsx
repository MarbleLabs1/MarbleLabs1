import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/billing";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Stories are free. The analysis is paid. Nobody can pay to change their score.",
};

export default function PricingPage() {
  return (
    <>
      <header className="mb-10 max-w-2xl">
        <p className="label-xs">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold">Stories are free. Analysis is paid.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/75">
          Every exit story on this site is readable by anyone, forever, with no account. That is not
          generosity — a paywall on the stories would stop people posting them, and the stories are the
          entire asset. What costs money is the work done on top: the breakdowns, the benchmarks, the
          alerts.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`card flex flex-col p-6 ${plan.featured ? "border-acid/60" : ""}`}
          >
            {plan.featured && <p className="label-xs mb-3 text-acid">Most people want this</p>}
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted">{plan.pitch}</p>
            <p className="mt-4 font-mono text-3xl">
              {plan.price}
              <span className="ml-2 text-sm text-muted">{plan.cadence}</span>
            </p>
            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-paper/80">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-acid">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {plan.id === "free" ? (
                <Link
                  href="/"
                  className="block rounded-md border border-line px-4 py-2.5 text-center text-sm font-semibold hover:border-acid hover:text-acid"
                >
                  {plan.cta}
                </Link>
              ) : (
                <CheckoutForm plan={plan.id} cta={plan.cta} featured={plan.featured} />
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="card mt-10 p-6">
        <h2 className="text-lg font-bold">What money cannot buy here</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label-xs text-alarm">Not for sale</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-paper/80">
              <li>Removing a story for being unflattering</li>
              <li>Changing an Exit Index score</li>
              <li>Ranking above another company</li>
              <li>Finding out who posted something</li>
            </ul>
          </div>
          <div>
            <p className="label-xs">Free to every company, paying or not</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-paper/80">
              <li>A published right of reply on your company page</li>
              <li>Removal of anything that names an individual</li>
              <li>Removal of anything that could identify the poster</li>
              <li>Review of a story you can show to be fabricated</li>
            </ul>
          </div>
        </div>
        <p className="mt-5 max-w-3xl text-sm text-muted">
          The second a score can be bought, the index is worth nothing to candidates, which makes it
          worth nothing to employers either. Keeping it unbuyable is the business model, not a
          constraint on it.
        </p>
      </section>
    </>
  );
}
