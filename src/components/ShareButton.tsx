"use client";

import { useState } from "react";

/**
 * Anonymous posts share the same way any social post does — the difference is what
 * you're sharing: a link to somebody's account of a company, not a profile.
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  async function share() {
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl });
        return;
      } catch {
        // User cancelled the native share sheet, or the platform refused it — clipboard
        // fallback below still gets them a link either way.
      }
    }
    try {
      await navigator.clipboard.writeText(fullUrl);
      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      // Nothing left to fall back to; silently do nothing rather than throw.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-acid hover:text-acid"
    >
      <span aria-hidden>{state === "copied" ? "✓" : "⟲"}</span>
      <span>{state === "copied" ? "link copied" : "share"}</span>
    </button>
  );
}
