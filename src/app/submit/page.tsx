import type { Metadata } from "next";
import { SubmitForm } from "./SubmitForm";

export const metadata: Metadata = {
  title: "Tell your story",
  description:
    "Post the real reason you left, anonymously. No account, no email, no IP stored in the clear.",
};

export default function SubmitPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
      <div>
        <h1 className="text-3xl font-bold">Why did you actually leave?</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/75">
          No account. No email. We never store your IP address — only a salted hash of it, so we can
          rate-limit without being able to identify you. Write it as if the company will read it,
          because they might.
        </p>
        <SubmitForm />
      </div>

      <aside className="flex flex-col gap-5 text-sm">
        <div className="card p-5">
          <h2 className="label-xs">Two hard rules</h2>
          <ol className="mt-3 flex flex-col gap-3 text-paper/80">
            <li>
              <strong className="text-paper">No names.</strong> Roles only — &ldquo;my manager&rdquo;,
              &ldquo;a director&rdquo;. Naming someone who cannot answer back is how this site would
              become the thing it is criticising.
            </li>
            <li>
              <strong className="text-paper">No contact details.</strong> Not theirs and not yours.
              Links and handles get used to work out who posted.
            </li>
          </ol>
        </div>
        <div className="card p-5">
          <h2 className="label-xs">What makes a story land</h2>
          <ul className="mt-3 flex flex-col gap-2 text-paper/80">
            <li>Specific incidents beat adjectives.</li>
            <li>What you tried before you left.</li>
            <li>What you were told at hiring versus what happened.</li>
            <li>What would have kept you.</li>
          </ul>
        </div>
        <div className="card border-ember/40 p-5">
          <h2 className="label-xs text-ember">Before you post</h2>
          <p className="mt-3 text-paper/80">
            If you signed a settlement or an NDA on your way out, it may cover what you are about to
            write. That is between you and that agreement — this site cannot make it not apply. Details
            unique to you (an unusual title, a specific date, one memorable project) can identify you
            even with your name removed.
          </p>
        </div>
      </aside>
    </div>
  );
}
