"use client";

import { useState } from "react";

const OPTIONS: { value: string; label: string }[] = [
  { value: "names_individual", label: "Names or identifies an individual" },
  { value: "false_or_fabricated", label: "Factually false or fabricated" },
  { value: "identifying_details", label: "Could identify the poster" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "not_an_exit_story", label: "Not an exit story" },
  { value: "spam", label: "Spam" },
];

/**
 * The report path has to be as easy as posting. A site like this survives on the
 * strength of its takedown process, not the strength of its content.
 */
export function ReportButton({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(OPTIONS[0].value);
  const [detail, setDetail] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, detail: detail || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Failure keeps the form open and retryable — collapsing to a dead end here
        // means a legitimate report is lost with no way to try again short of a reload.
        setFailed(data.error ?? "Could not report that. Try again.");
        return;
      }
      setResult(data.message ?? "Reported.");
      setOpen(false);
    } catch {
      setFailed("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return <span className="font-mono text-xs text-muted">{result}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-muted underline decoration-line hover:text-ember"
      >
        report this
      </button>
    );
  }

  return (
    <div className="card w-full p-4">
      <p className="label-xs">Report this story</p>
      <div className="mt-3 flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="report-reason"
              value={o.value}
              checked={reason === o.value}
              onChange={() => setReason(o.value)}
              className="size-3.5 accent-acid"
            />
            {o.label}
          </label>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Anything a reviewer should know (optional)"
        maxLength={1000}
        className="mt-3 min-h-20 w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-acid focus:outline-none"
      />
      {failed && <p className="mt-3 text-sm text-alarm">{failed}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="rounded-md bg-paper px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-paper"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
