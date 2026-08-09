"use client";

import { RECEIPT_KINDS, SENDER_ROLES, looksAfterHours } from "@/lib/receipts";
import type { ReceiptKind } from "@/lib/db";
import { ReceiptCard } from "@/components/ReceiptCard";

export type DraftReceipt = {
  /** Stable identity for React's list reconciliation — see the comment at the map below. */
  id: string;
  kind: ReceiptKind;
  senderRole: string;
  sentAtLabel: string;
  subject: string;
  content: string;
  afterHours: boolean | null;
};

export function emptyReceipt(kind: ReceiptKind = "chat"): DraftReceipt {
  return {
    id: crypto.randomUUID(),
    kind,
    senderRole: SENDER_ROLES[0],
    sentAtLabel: "",
    subject: "",
    content: "",
    afterHours: null,
  };
}

const fieldClass =
  "w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm text-paper placeholder:text-muted/70 focus:border-acid focus:outline-none";

const MAX_RECEIPTS = 8;

/**
 * The receipts composer. Deliberately typed rather than free-form: a receipt tagged
 * "calendar invite, my manager, Friday 6:47 PM" is aggregatable, and the after-hours
 * flag falls out of it for free. A screenshot would be none of those things and would
 * carry a real person's name and face.
 */
export function ReceiptComposer({
  receipts,
  onChange,
}: {
  receipts: DraftReceipt[];
  onChange: (next: DraftReceipt[]) => void;
}) {
  function update(i: number, patch: Partial<DraftReceipt>) {
    onChange(receipts.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  }

  function add(kind: ReceiptKind) {
    if (receipts.length >= MAX_RECEIPTS) return;
    onChange([...receipts, emptyReceipt(kind)]);
  }

  return (
    <fieldset className="card flex flex-col gap-5 p-5">
      <legend className="label-xs px-1">Receipts — optional, and the best part</legend>
      <p className="text-xs leading-relaxed text-muted">
        The 6:47pm &ldquo;quick call?&rdquo;. The &ldquo;per my last email&rdquo;. The all-hands slide
        about family. Type out what was said and tag who said it{" "}
        <strong className="text-paper">by role, never by name</strong> — we render it back as the thing
        it was.
      </p>
      <p className="rounded-md border border-line bg-ink-3/60 px-3 py-2 text-xs leading-relaxed text-muted">
        We do not take screenshots. A screenshot of a work chat carries someone&rsquo;s real name,
        their photo, and usually your own display name in the corner. Typed receipts are searchable,
        quotable, and cannot out you or anyone else.
      </p>

      {receipts.map((r, i) => {
        const spec = RECEIPT_KINDS.find((k) => k.kind === r.kind)!;
        const guessed = r.afterHours ?? looksAfterHours(r.sentAtLabel);
        return (
          // Keyed by id, not index: removing a middle row (below) would otherwise shift
          // every later row's index, and React would reuse their DOM nodes for a
          // different receipt — moving focus, selection and scroll to the wrong row.
          <div key={r.id} className="rounded-md border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <select
                value={r.kind}
                onChange={(e) => update(i, { kind: e.target.value as ReceiptKind })}
                className="rounded-md border border-line bg-ink-2 px-2 py-1 font-mono text-xs"
              >
                {RECEIPT_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(receipts.filter((_, j) => j !== i))}
                className="font-mono text-xs text-muted hover:text-alarm"
              >
                remove
              </button>
            </div>

            <p className="mt-2 text-xs text-muted">{spec.hint}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label-xs">Who sent it</span>
                <select
                  value={r.senderRole}
                  onChange={(e) => update(i, { senderRole: e.target.value })}
                  className={`mt-1.5 ${fieldClass}`}
                >
                  {SENDER_ROLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label-xs">When</span>
                <input
                  value={r.sentAtLabel}
                  onChange={(e) => update(i, { sentAtLabel: e.target.value, afterHours: null })}
                  placeholder="Friday 6:47 PM"
                  maxLength={60}
                  className={`mt-1.5 ${fieldClass}`}
                />
              </label>
            </div>

            {spec.wantsSubject && (
              <label className="mt-3 block">
                <span className="label-xs">
                  {r.kind === "invite" ? "Invite title" : r.kind === "email" ? "Subject line" : "Title"}
                </span>
                <input
                  value={r.subject}
                  onChange={(e) => update(i, { subject: e.target.value })}
                  placeholder={r.kind === "invite" ? "Quick sync" : "Re: Re: Re: Timeline"}
                  maxLength={140}
                  className={`mt-1.5 ${fieldClass}`}
                />
              </label>
            )}

            <label className="mt-3 block">
              <span className="label-xs">What it said</span>
              <textarea
                value={r.content}
                onChange={(e) => update(i, { content: e.target.value })}
                placeholder={spec.contentPlaceholder}
                maxLength={1200}
                className={`mt-1.5 min-h-20 resize-y ${fieldClass}`}
              />
            </label>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={guessed}
                onChange={(e) => update(i, { afterHours: e.target.checked })}
                className="size-3.5 accent-acid"
              />
              <span className={guessed ? "text-ember" : "text-muted"}>
                Outside working hours
                {r.afterHours === null && guessed && " (detected from the time you gave)"}
              </span>
            </label>

            {r.content.trim().length > 1 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="label-xs mb-3">Preview</p>
                <ReceiptCard
                  receipt={{
                    id: -i - 1,
                    story_id: "",
                    kind: r.kind,
                    sender_role: r.senderRole,
                    sent_at_label: r.sentAtLabel || null,
                    subject: r.subject || null,
                    content: r.content,
                    after_hours: guessed,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {receipts.length < MAX_RECEIPTS && (
        <div className="flex flex-wrap gap-2">
          {RECEIPT_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => add(k.kind)}
              className="rounded-md border border-line px-3 py-1.5 font-mono text-xs text-muted hover:border-acid hover:text-acid"
            >
              + {k.label}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
