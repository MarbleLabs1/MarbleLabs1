import type { Receipt } from "@/lib/db";
import { afterHoursNote } from "@/lib/receipts";

/**
 * Receipts are rendered as the artefact they were — a chat bubble, an email header, a
 * calendar card. The format is the point: "quick call?" in a chat bubble at 6:47pm on a
 * Friday tells the story in a way a paragraph about poor boundaries never will.
 */

function AfterHours({ receipt }: { receipt: Receipt }) {
  if (!receipt.after_hours) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ember/50 bg-ember/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ember">
      <span aria-hidden>◷</span> {afterHoursNote(receipt.kind)}
    </span>
  );
}

function Meta({ receipt }: { receipt: Receipt }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
      <span>{receipt.sender_role}</span>
      {receipt.sent_at_label && (
        <>
          <span aria-hidden>·</span>
          <span>{receipt.sent_at_label}</span>
        </>
      )}
      <AfterHours receipt={receipt} />
    </div>
  );
}

function Chat({ receipt }: { receipt: Receipt }) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <div
          aria-hidden
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-line font-mono text-[10px] text-muted"
        >
          {receipt.sender_role.replace(/^(my|the|a)\s+/i, "").slice(0, 2).toUpperCase()}
        </div>
        <div className="max-w-lg whitespace-pre-line rounded-2xl rounded-tl-sm bg-ink-3 px-3.5 py-2.5 text-[15px] leading-relaxed">
          {receipt.content}
        </div>
      </div>
      <div className="pl-10">
        <Meta receipt={receipt} />
      </div>
    </div>
  );
}

function Email({ receipt }: { receipt: Receipt }) {
  return (
    <div className="rounded-md border border-line bg-ink-3/60">
      <div className="border-b border-line px-4 py-2.5">
        <p className="font-mono text-[11px] text-muted">
          From: {receipt.sender_role}
          {receipt.sent_at_label && ` · ${receipt.sent_at_label}`}
        </p>
        {receipt.subject && (
          <p className="mt-1 text-sm font-semibold">Subject: {receipt.subject}</p>
        )}
      </div>
      <p className="whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed">{receipt.content}</p>
      {receipt.after_hours && (
        <div className="px-4 pb-3">
          <AfterHours receipt={receipt} />
        </div>
      )}
    </div>
  );
}

function Invite({ receipt }: { receipt: Receipt }) {
  return (
    <div className="flex gap-0 overflow-hidden rounded-md border border-line bg-ink-3/60">
      <div
        className={`grid w-16 shrink-0 place-items-center border-r border-line px-2 py-3 text-center ${
          receipt.after_hours ? "bg-ember/10" : ""
        }`}
      >
        <div>
          <p aria-hidden className="font-mono text-xl leading-none">
            ◷
          </p>
          <p className="mt-1.5 font-mono text-[10px] leading-tight text-muted">
            {receipt.sent_at_label ?? "no time"}
          </p>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-semibold">{receipt.subject ?? "(no title)"}</p>
        <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-paper/80">
          {receipt.content}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
          <span>Organiser: {receipt.sender_role}</span>
          <AfterHours receipt={receipt} />
        </div>
      </div>
    </div>
  );
}

function Quote({ receipt }: { receipt: Receipt }) {
  return (
    <div className="border-l-2 border-acid pl-4">
      {receipt.subject && <p className="label-xs">{receipt.subject}</p>}
      <blockquote className="mt-1 whitespace-pre-line text-[17px] italic leading-relaxed">
        “{receipt.content}”
      </blockquote>
      <Meta receipt={receipt} />
    </div>
  );
}

export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  switch (receipt.kind) {
    case "chat":
      return <Chat receipt={receipt} />;
    case "email":
      return <Email receipt={receipt} />;
    case "invite":
      return <Invite receipt={receipt} />;
    default:
      return <Quote receipt={receipt} />;
  }
}

export function ReceiptStack({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <section className="card mt-8 p-5">
      <div className="flex items-center justify-between">
        <h2 className="label-xs">
          Receipts · {receipts.length}
        </h2>
        <span className="font-mono text-[11px] text-muted">transcribed by the poster</span>
      </div>
      <div className="mt-5 flex flex-col gap-5">
        {receipts.map((r) => (
          <ReceiptCard key={r.id} receipt={r} />
        ))}
      </div>
    </section>
  );
}
