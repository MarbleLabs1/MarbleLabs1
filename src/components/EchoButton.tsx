"use client";

import { useState } from "react";

/**
 * "This happened to me too." The single most valuable signal on the site: it turns
 * one person's account into a corroborated pattern, and it costs the reader nothing.
 * One echo per story per browser, enforced server-side by hashed IP.
 */
export function EchoButton({ storyId, initial }: { storyId: string; initial: number }) {
  const [count, setCount] = useState(initial);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function echo() {
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const res = await fetch(`/api/stories/${storyId}/echo`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { total: number };
      setCount(data.total);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "done"
      ? `This happened to me too — recorded. ${count} in total.`
      : state === "error"
        ? "Could not record that you had the same experience. Try again."
        : `This happened to me too. ${count} so far.`;

  return (
    <button
      type="button"
      data-testid="echo-button"
      onClick={echo}
      disabled={state === "sending" || state === "done"}
      aria-label={label}
      // Announces the recorded count or the error to screen reader users, who otherwise
      // get no confirmation that the click did anything — the visible text changes but
      // a static aria-label would keep announcing the pre-click state forever.
      aria-live="polite"
      className={`group flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
        state === "done"
          ? "border-acid text-acid"
          : "border-line text-muted hover:border-acid hover:text-acid"
      }`}
    >
      <span aria-hidden>{state === "done" ? "✓" : "+1"}</span>
      <span>
        {state === "error"
          ? "try again"
          : state === "done"
            ? `${count} same here`
            : `${count} said "same here"`}
      </span>
    </button>
  );
}
