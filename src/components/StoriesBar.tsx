import Link from "next/link";
import type { Story } from "@/lib/db";
import { avatarGradientFor, initialsFromPseudonym } from "@/lib/identity";

/**
 * A horizontal strip of recent posters, each a gradient-ringed circle — the shape
 * everyone already reads as "tap for the latest from this person." It's the fastest way
 * into the newest stories regardless of whatever the main feed is currently sorted or
 * filtered by, the same way a stories tray ignores your other app's filters.
 */
export function StoriesBar({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  return (
    <div className="mb-8 flex gap-4 overflow-x-auto pb-2" aria-label="Recent stories">
      {stories.map((s) => (
        <Link
          key={s.id}
          href={`/stories/${s.id}`}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
        >
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-full p-[2.5px]"
            style={{ backgroundImage: avatarGradientFor(s.pseudonym) }}
          >
            <span className="grid size-full place-items-center rounded-full bg-ink font-mono text-xs text-paper">
              {initialsFromPseudonym(s.pseudonym)}
            </span>
          </span>
          <span className="line-clamp-2 text-[10px] leading-tight text-muted">{s.company_name}</span>
        </Link>
      ))}
    </div>
  );
}
