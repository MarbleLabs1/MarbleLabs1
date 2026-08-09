"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type QueueCardItem = {
  id: string;
  headline: string;
  body: string;
  company_name: string;
  company_slug: string;
  role_family: string;
  seniority: string;
  tenure: string;
  age: string;
  status: string;
  severity: number;
  reasons: string[];
  findings: { action: string; code: string; message: string; excerpt?: string }[];
  reports: { id: number; label: string; detail: string | null; age: string }[];
  reporterCount: number;
  cause: "screening" | "reports" | "both";
};

const CAUSE_COPY: Record<QueueCardItem["cause"], { label: string; tone: string }> = {
  screening: { label: "Held by screening", tone: "text-ember border-ember/50 bg-ember/10" },
  reports: { label: "Reported by readers", tone: "text-alarm border-alarm/50 bg-alarm/10" },
  both: { label: "Screened and reported", tone: "text-alarm border-alarm/50 bg-alarm/10" },
};

export function QueueItemCard({ item }: { item: QueueCardItem }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const cause = CAUSE_COPY[item.cause];
  const long = item.body.length > 600;
  const shown = expanded || !long ? item.body : `${item.body.slice(0, 600).trimEnd()}…`;

  async function decide(action: "approve" | "remove" | "restore") {
    if (action === "remove" && !note.trim()) {
      setError("Removals need a reason — it goes in the audit log.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stories/${item.id}`, {
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
          <span className={done === "Removed" ? "text-alarm" : "text-acid"}>{done}</span> ·{" "}
          {item.headline.length > 70 ? `${item.headline.slice(0, 70)}…` : item.headline}
        </p>
      </div>
    );
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cause.tone}`}
        >
          {cause.label}
        </span>
        <span className="label-xs">
          {item.company_name} / {item.seniority} {item.role_family} / stayed {item.tenure}
        </span>
        <span className="ml-auto label-xs">
          posted {item.age} · severity {item.severity}/5 · {item.status}
        </span>
      </div>

      <h2 className="mt-3 text-lg font-semibold leading-snug">{item.headline}</h2>

      <div className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-paper/80">
        {shown}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 font-mono text-xs text-acid hover:underline"
        >
          {expanded ? "show less" : "read the whole thing"}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.reasons.map((r) => (
          <span key={r} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">
            {r}
          </span>
        ))}
      </div>

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

      {item.reports.length > 0 && (
        <div className="mt-4 rounded-md border border-alarm/40 bg-alarm/5 p-3">
          <p className="label-xs text-alarm">
            {item.reports.length} report{item.reports.length === 1 ? "" : "s"} from{" "}
            {item.reporterCount} {item.reporterCount === 1 ? "person" : "people"}
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {item.reports.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.label}</span>
                <span className="ml-2 font-mono text-[11px] text-muted">{r.age}</span>
                {r.detail && <span className="mt-0.5 block text-muted">{r.detail}</span>}
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
            onClick={() => decide(item.status === "published" ? "restore" : "approve")}
            disabled={busy !== null}
            className="rounded-md bg-acid px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {busy === "approve" || busy === "restore"
              ? "Working…"
              : item.status === "published"
                ? "Keep it up, clear reports"
                : "Publish it"}
          </button>
          <button
            type="button"
            onClick={() => decide("remove")}
            disabled={busy !== null}
            className="rounded-md border border-alarm/60 px-4 py-2 text-sm font-semibold text-alarm hover:bg-alarm/10 disabled:opacity-40"
          >
            {busy === "remove" ? "Working…" : "Remove"}
          </button>
          <Link
            href={`/stories/${item.id}`}
            className="font-mono text-xs text-muted hover:text-acid"
            target="_blank"
          >
            open story ↗
          </Link>
          <Link
            href={`/companies/${item.company_slug}`}
            className="font-mono text-xs text-muted hover:text-acid"
            target="_blank"
          >
            company page ↗
          </Link>
        </div>
      </div>
    </article>
  );
}
