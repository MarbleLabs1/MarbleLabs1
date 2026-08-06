"use client";

import { useState } from "react";
import { relativeTime } from "@/lib/format";
import { initialsFromPseudonym } from "@/lib/identity";

export type CommentDTO = { id: number; body: string; created_at: string; pseudonym: string };

function Avatar({ pseudonym }: { pseudonym: string }) {
  return (
    <div
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-line font-mono text-[10px] text-muted"
    >
      {initialsFromPseudonym(pseudonym)}
    </div>
  );
}

export function CommentSection({
  storyId,
  initial,
}: {
  storyId: string;
  initial: CommentDTO[];
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setHeld(false);
    try {
      const res = await fetch(`/api/stories/${storyId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not post that comment.");
        return;
      }
      if (data.status === "review") {
        setHeld(true);
        setBody("");
        return;
      }
      // Optimistic: the label is a placeholder until the list is refetched, since the
      // server derives the real pseudonym from a hash this client never sees.
      setComments((prev) => [
        ...prev,
        { id: data.id, body, created_at: new Date().toISOString(), pseudonym: "You" },
      ]);
      setBody("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-t border-line pt-5">
      <h2 className="label-xs">
        {comments.length} comment{comments.length === 1 ? "" : "s"}
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar pseudonym={c.pseudonym} />
            <div className="min-w-0 flex-1">
              <div className="rounded-lg rounded-tl-sm bg-ink-3 px-3 py-2">
                <p className="font-mono text-[11px] text-muted">{c.pseudonym}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-paper/90">{c.body}</p>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {c.pseudonym === "You" ? "just now" : relativeTime(c.created_at)}
              </p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted">No comments yet — same-here or add what you know.</p>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2.5">
        <div
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-line font-mono text-[10px] text-muted"
        >
          ??
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment — roles only, no names, no contact details."
            maxLength={600}
            required
            minLength={2}
            disabled={busy}
            className="min-h-16 w-full resize-y rounded-md border border-line bg-ink-2 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-acid focus:outline-none disabled:opacity-60"
          />
          {error && <p className="mt-1.5 text-xs text-alarm">{error}</p>}
          {held && (
            <p className="mt-1.5 text-xs text-ember">
              Held for a human check — usually because it reads like an allegation. It will
              either come back or be removed.
            </p>
          )}
          <div className="mt-2">
            <button
              type="submit"
              disabled={busy || body.trim().length < 2}
              className="rounded-md bg-acid px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
            >
              {busy ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
