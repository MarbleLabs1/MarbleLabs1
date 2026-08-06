import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminEnabled, isModerator } from "@/lib/admin";
import { commentQueueSize, listCommentQueue, listQueue, queueSize, recentDecisions } from "@/lib/db";
import { reasonLabel, tenureLabel } from "@/lib/taxonomy";
import { relativeTime } from "@/lib/format";
import { LoginForm } from "./LoginForm";
import { QueueItemCard } from "./QueueItemCard";
import { CommentQueueCard } from "./CommentQueueCard";
import { SignOut } from "./SignOut";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moderation queue",
  robots: { index: false, follow: false },
};

const REPORT_LABELS: Record<string, string> = {
  names_individual: "Names an individual",
  false_or_fabricated: "False or fabricated",
  identifying_details: "Could identify the poster",
  harassment: "Harassment",
  not_an_exit_story: "Not an exit story",
  spam: "Spam",
};

export default async function AdminPage() {
  // No token configured means no moderation surface at all, not an open one.
  if (!adminEnabled()) notFound();

  if (!(await isModerator())) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="mt-2 text-sm text-muted">
          Stories held by screening and stories readers have flagged.
        </p>
        <LoginForm />
      </div>
    );
  }

  const queue = listQueue();
  const commentQueue = listCommentQueue();
  const decisions = recentDecisions(15);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">Moderation queue</p>
          <h1 className="mt-2 text-3xl font-bold">
            {queue.length === 0
              ? "Nothing waiting"
              : `${queue.length} ${queue.length === 1 ? "story" : "stories"} waiting`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-paper/75">
            Oldest first. A story sitting here is invisible to readers if screening held it, and
            visible-but-flagged if readers reported it. Every decision is written to the audit log
            below.
          </p>
        </div>
        <SignOut />
      </header>

      {queue.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-semibold">Queue is clear.</p>
          <p className="mt-2 text-sm text-muted">
            Stories arrive here when screening flags an allegation of unlawful conduct, or when three
            different readers report the same story.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-acid hover:underline">
            ← Back to the feed
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {queue.map((item) => (
            <QueueItemCard
              key={item.id}
              item={{
                id: item.id,
                headline: item.headline,
                body: item.body,
                company_name: item.company_name,
                company_slug: item.company_slug,
                role_family: item.role_family,
                seniority: item.seniority,
                tenure: tenureLabel(item.tenure_months),
                age: relativeTime(item.created_at),
                status: item.status,
                severity: item.severity,
                reasons: item.reasons.map(reasonLabel),
                findings: item.findings,
                reports: item.reports.map((r) => ({
                  id: r.id,
                  label: REPORT_LABELS[r.reason] ?? r.reason,
                  detail: r.detail,
                  age: relativeTime(r.created_at),
                })),
                reporterCount: item.reporter_count,
                cause: item.cause,
              }}
            />
          ))}
        </div>
      )}

      <section className="mt-12">
        <h2 className="label-xs">
          {commentQueue.length === 0
            ? "Held comments — none waiting"
            : `Held comments — ${commentQueue.length} waiting`}
        </h2>
        {commentQueue.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Comments screening flags land here for the same reason stories do — usually an
            allegation of unlawful conduct.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {commentQueue.map((c) => (
              <CommentQueueCard
                key={c.id}
                item={{
                  id: c.id,
                  story_id: c.story_id,
                  story_headline: c.story_headline,
                  company_name: c.company_name,
                  body: c.body,
                  pseudonym: c.pseudonym,
                  age: relativeTime(c.created_at),
                  findings: c.findings,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="label-xs">Audit log — last {decisions.length || 0} decisions</h2>
        {decisions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No decisions recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="label-xs border-b border-line text-left">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Story</th>
                  <th className="py-2">Reason given</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="py-2 pr-4 font-mono text-xs text-muted">
                      {relativeTime(d.created_at)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`font-mono text-xs ${
                          d.action === "remove" ? "text-alarm" : "text-acid"
                        }`}
                      >
                        {d.action}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-muted">
                        {d.from_status} → {d.to_status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/stories/${d.story_id}`} className="hover:text-acid">
                        {d.headline.length > 60 ? `${d.headline.slice(0, 60)}…` : d.headline}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-muted">{d.company_name}</span>
                    </td>
                    <td className="py-2 text-muted">{d.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 font-mono text-[11px] text-muted">
        {queueSize()} stories · {commentQueueSize()} comments in queue · session expires 12h after
        sign-in
      </p>
    </>
  );
}
