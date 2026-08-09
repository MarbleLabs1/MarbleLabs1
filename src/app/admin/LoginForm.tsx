"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not sign in.");
        return;
      }
      setToken("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 flex flex-col gap-3 p-5">
      <label className="block">
        <span className="label-xs">Moderator token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          required
          className="mt-2 w-full rounded-md border border-line bg-ink-2 px-3 py-2 font-mono text-sm focus:border-acid focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-alarm">{error}</p>}
      <button
        type="submit"
        disabled={busy || !token}
        className="rounded-md bg-acid px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
      <p className="text-xs text-muted">
        Set as <code className="font-mono text-acid">LINKEDOUT_ADMIN_TOKEN</code>. Eight wrong
        attempts locks this out for fifteen minutes.
      </p>
    </form>
  );
}
