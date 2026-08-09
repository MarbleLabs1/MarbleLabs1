import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guidelines",
  description: "What belongs here, what does not, and how moderation actually works.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Criticise companies, never individuals",
    body: (
      <>
        <p>
          Write &ldquo;my manager&rdquo;, &ldquo;a director&rdquo;, &ldquo;HR&rdquo;. Never a name, never
          an unmistakable description. A company is a public actor that can answer publicly; a named
          middle manager is a private person with no comparable way to respond.
        </p>
        <p>
          Posts that name individuals are rejected automatically, and any that get through are removed
          on the first report — no argument, no appeal needed from the company.
        </p>
      </>
    ),
  },
  {
    title: "Receipts are transcribed, not screenshotted",
    body: (
      <>
        <p>
          We do not accept image uploads, and this is not a technical limitation. A screenshot of a work
          chat carries the sender&rsquo;s real name, their profile photo, unrelated colleagues in the
          thread, and very often your own display name in the corner. There is no way to redact that
          reliably at volume.
        </p>
        <p>
          So you type out what was said and tag who said it by role. It reads exactly as damning, it is
          searchable and quotable, and it cannot out you or anyone else.
        </p>
      </>
    ),
  },
  {
    title: "Describe what happened, do not deliver a verdict",
    body: (
      <>
        <p>
          &ldquo;I was told to backdate the report and I refused&rdquo; is your account of an event.
          &ldquo;They commit fraud&rdquo; is a legal conclusion you are not in a position to publish. The
          first is protected opinion grounded in experience; the second is the sentence that gets a
          letter sent.
        </p>
        <p>
          Posts containing allegations of unlawful conduct are held for human review before publication.
          They are not automatically rejected — sometimes that is exactly what happened — but they are
          not published on autopilot either.
        </p>
      </>
    ),
  },
  {
    title: "Protect yourself before you post",
    body: (
      <>
        <p>
          No account, no email, no IP stored in the clear — only a salted hash, so we can rate-limit
          without being able to identify you. We cannot tell a company who posted something because we
          do not know.
        </p>
        <p>
          What can still identify you is your own detail: an unusual job title, a specific date, one
          memorable project, a team of three. Blur those. And if you signed a settlement or an NDA on
          the way out, it may cover what you are about to write — this site cannot make that not apply.
        </p>
      </>
    ),
  },
  {
    title: "What gets a story removed",
    body: (
      <ul className="list-disc pl-5">
        <li>It names or unmistakably identifies an individual</li>
        <li>It contains contact details for anyone, including you</li>
        <li>It contains details that could identify the poster</li>
        <li>It is demonstrably fabricated — a company that can show this gets it taken down</li>
        <li>It is harassment rather than an account of a job</li>
        <li>It is not about leaving a job at all</li>
      </ul>
    ),
  },
  {
    title: "How enforcement works",
    body: (
      <>
        <p>
          Every post is screened before publication for contact details and named individuals. Three
          independent reports hide a story pending human review. Anyone can report anything, with no
          account, and a company does not need a lawyer or a subscription to get something removed under
          the rules above.
        </p>
        <p>
          Employers cannot pay to remove unflattering stories or change a score, at any price. That is
          not a moral posture — the moment scores are purchasable, candidates stop trusting the index,
          and an index candidates do not trust is worth nothing to employers either.
        </p>
      </>
    ),
  },
];

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="label-xs">Guidelines</p>
        <h1 className="mt-2 text-3xl font-bold">The rules, and why they exist</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-paper/75">
          A site where people describe their worst jobs is one careless post away from doxxing a
          stranger, and one careless post away from a letter. These rules are what let it be honest and
          survive.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((s, i) => (
          <section key={s.title} className="card p-6">
            <p className="label-xs">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 text-lg font-bold">{s.title}</h2>
            <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-paper/80">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/submit"
          className="rounded-md bg-acid px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-85"
        >
          Tell your story
        </Link>
        <Link
          href="/right-of-reply"
          className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold hover:border-acid hover:text-acid"
        >
          I represent a company on here
        </Link>
      </div>
    </div>
  );
}
