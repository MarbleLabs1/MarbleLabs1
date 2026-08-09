"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type CommentQueueCardItem = {
  id: number;
  story_id: string;
  story_headline: string;
  company_name: string;
  body: string;
  pseudonym: string;
  age: string;
  findings: { action: string; code: string; message: string; excerpt?: string }[];
};

export function CommentQueueCard({ item }: { item: CommentQueueCardItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(action: "approve" | "remove") {
    if (action === "remove" && !note.trim()) {
      setError("Removals need a reason — it goes in the audit log.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/comments/${item.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      setDone(action === "remove" ? "Removed" : "Published");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="card border-line/60 p-4">
        <p className="font-mono text-xs text-muted">
          <span className={done === "Removed" ? "text-alarm" : "text-acid"}>{done}</span> · comment
          on &ldquo;{item.story_headline.length > 50 ? `${item.story_headline.slice(0, 50)}…` : item.story_headline}
          &rdquo;
        </p>
      </div>
    );
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full border border-ember/50 bg-ember/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ember">
          Comment held by screening
        </span>
        <span className="label-xs">
          on{" "}
          <Link href={`/stories/${item.story_id}`} target="_blank" className="hover:text-acid">
            {item.story_headline}
          </Link>{" "}
          at {item.company_name}
        </span>
        <span className="ml-auto label-xs">{item.age}</span>
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted">{item.pseudonym}</p>
      <p className="mt-1 whitespace-pre-line text-[15px] text-paper/85">{item.body}</p>

      {item.findings.length > 0 && (
        <div className="mt-4 rounded-md border border-ember/40 bg-ember/5 p-3">
          <p className="label-xs text-ember">Screening flagged</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {item.findings.map((f, i) => (
              <li key={i}>
                {f.message}
                {f.excerpt && (
                  <span className="mt-0.5 block font-mono text-xs text-muted">
                    &ldquo;{f.excerpt}&rdquo;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <label className="block">
          <span className="label-xs">Reason for the decision</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required to remove. Recorded in the audit log."
            maxLength={500}
            className="mt-2 w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-acid focus:outline-none"
          />
        </label>

        {error && <p className="mt-3 text-sm text-alarm">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => decide("approve")}
            disabled={busy !== null}
            className="rounded-md bg-acid px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {busy === "approve" ? "Working…" : "Publish it"}
          </button>
          <button
            type="button"
            onClick={() => decide("remove")}
            disabled={busy !== null}
            className="rounded-md border border-alarm/60 px-4 py-2 text-sm font-semibold text-alarm hover:bg-alarm/10 disabled:opacity-40"
          >
            {busy === "remove" ? "Working…" : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
}
