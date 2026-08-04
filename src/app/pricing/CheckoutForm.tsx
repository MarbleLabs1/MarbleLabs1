"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutForm({
  plan,
  cta,
  featured,
}: {
  plan: "candidate" | "employer";
  cta: string;
  featured?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setMessage(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Something went wrong.");
        setState("idle");
        return;
      }
      if (data.mode === "stripe") {
        window.location.href = data.redirect;
        return;
      }
      setMessage(data.message);
      setState("done");
      // Demo unlock sets the entitlement cookie server-side; refresh so paid views appear.
      if (data.mode === "demo") router.refresh();
    } catch {
      setMessage("Could not reach the server.");
      setState("idle");
    }
  }

  if (state === "done") {
    return <p className="text-sm text-acid">{message}</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@wherever.com"
        className="w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm placeholder:text-muted/70 focus:border-acid focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className={`rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
          featured ? "bg-acid text-ink hover:opacity-85" : "border border-line hover:border-acid hover:text-acid"
        }`}
      >
        {state === "busy" ? "One moment…" : cta}
      </button>
      {message && <p className="text-xs text-ember">{message}</p>}
    </form>
  );
}
