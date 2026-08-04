import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Right of reply",
  description:
    "If your company is on LinkedOut: what you can get removed for free, what you can respond to, and what is not for sale.",
};

export default function RightOfReplyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="label-xs">For employers</p>
        <h1 className="mt-2 text-3xl font-bold">Your company is on here. Now what?</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/75">
          Most sites like this treat employers as the enemy and then quietly sell them reputation
          management. This one does neither. Here is exactly what you can and cannot get.
        </p>
      </header>

      <section className="card border-acid/40 p-6">
        <h2 className="text-lg font-bold text-acid">Free, no subscription, no lawyer</h2>
        <ul className="mt-4 flex flex-col gap-3 text-[15px] text-paper/80">
          <li>
            <strong className="text-paper">Removal of any story naming an individual.</strong> Report it
            and it goes. This is not negotiable in either direction — we do not host it.
          </li>
          <li>
            <strong className="text-paper">Removal of identifying details.</strong> Including details
            that identify the poster, which is usually more urgent than anything about you.
          </li>
          <li>
            <strong className="text-paper">Review of anything you can show is fabricated.</strong> Not
            &ldquo;unfair&rdquo; or &ldquo;one-sided&rdquo; — fabricated. Bring what you have.
          </li>
          <li>
            <strong className="text-paper">A published response on your company page.</strong> Signed by
            a named person at your company, shown alongside the stories rather than buried.
          </li>
          <li>
            <strong className="text-paper">The full breakdown of your own exits.</strong> Every company
            can see its own report free. Charging you to see what your own leavers said would be
            grotesque.
          </li>
        </ul>
      </section>

      <section className="card mt-6 border-alarm/40 p-6">
        <h2 className="text-lg font-bold text-alarm">Not available at any price</h2>
        <ul className="mt-4 flex flex-col gap-3 text-[15px] text-paper/80">
          <li>Removing a story because it is unflattering or embarrassing</li>
          <li>Adjusting, capping, or hiding an Exit Index score</li>
          <li>Ranking above another company, or being left off the index</li>
          <li>Any information about who posted something — we do not have it</li>
          <li>Advance notice of a story before it publishes</li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          The paid employer plan buys benchmarking, alerts and a quarterly briefing. It does not buy
          influence over the data, and the pricing page says so on the record.
        </p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">How to reply</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/80">
          Responses are published as-is, attributed to a named person and role at the company, and shown
          on the company page above the stories. We do not edit them for tone. The only rules are the
          same ones posters follow: no naming of individual former employees, and no contact details.
        </p>
        <p className="mt-3 text-sm text-muted">
          A response that engages with the pattern lands. A response that questions the motives of
          anonymous former staff has never once landed, on any site, ever.
        </p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-lg font-bold">If you are about to send a legal letter</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/80">
          Read the story again first and check which of these it is: a statement of fact you can show to
          be false, or someone&rsquo;s honestly-held opinion of how it felt to work for you. The first we
          will act on. The second is what this site is for, and a letter about it will become the most
          widely read thing on your company page.
        </p>
      </section>

      <div className="mt-10">
        <Link href="/guidelines" className="text-acid hover:underline">
          The full moderation rules →
        </Link>
      </div>
    </div>
  );
}
