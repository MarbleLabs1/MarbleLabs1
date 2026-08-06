"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Following costs the company nothing to have happen and the follower nothing to
 * undo — no email, no login, just a cookie. See src/lib/follows.ts for why that's
 * safe to leave unsigned and unthrottled, unlike echoes and reports.
 */
export function FollowButton({ companySlug, initial }: { companySlug: string; initial: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      if (res.ok) {
        setFollowing(!following);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border-acid bg-acid/10 text-acid"
          : "border-line text-paper hover:border-acid hover:text-acid"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
