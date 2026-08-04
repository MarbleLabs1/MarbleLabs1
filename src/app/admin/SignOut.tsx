"use client";

import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        router.refresh();
      }}
      className="rounded-md border border-line px-3 py-1.5 font-mono text-xs text-muted hover:border-acid hover:text-acid"
    >
      sign out
    </button>
  );
}
