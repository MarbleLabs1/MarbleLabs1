import type { ReceiptKind } from "./db";

export const RECEIPT_KINDS: {
  kind: ReceiptKind;
  label: string;
  hint: string;
  senderPlaceholder: string;
  contentPlaceholder: string;
  wantsSubject: boolean;
}[] = [
  {
    kind: "chat",
    label: "Chat message",
    hint: "Slack, Teams, WhatsApp — the group chat.",
    senderPlaceholder: "My manager",
    contentPlaceholder: "you around? quick call?",
    wantsSubject: false,
  },
  {
    kind: "email",
    label: "Email",
    hint: "Complete with the subject line.",
    senderPlaceholder: "Head of department",
    contentPlaceholder: "Per my last email, this was already agreed.",
    wantsSubject: true,
  },
  {
    kind: "invite",
    label: "Calendar invite",
    hint: "The 6:47pm “quick sync” with no agenda.",
    senderPlaceholder: "My manager",
    contentPlaceholder: "No agenda. 15 minutes. Camera on please.",
    wantsSubject: true,
  },
  {
    kind: "policy",
    label: "Policy or announcement",
    hint: "The all-hands slide, the new handbook line.",
    senderPlaceholder: "Leadership",
    contentPlaceholder: "We are a family here, and families make sacrifices.",
    wantsSubject: true,
  },
  {
    kind: "review",
    label: "Performance review line",
    hint: "The sentence that told you everything.",
    senderPlaceholder: "My manager",
    contentPlaceholder: "Exceeds expectations. No budget for promotion this cycle.",
    wantsSubject: false,
  },
];

export const RECEIPT_KIND_MAP = Object.fromEntries(RECEIPT_KINDS.map((r) => [r.kind, r]));

/** Roles only. A receipt that names a person is the one thing this site will not host. */
export const SENDER_ROLES = [
  "My manager",
  "My manager's manager",
  "A director",
  "The CEO",
  "The founder",
  "HR",
  "A recruiter",
  "Leadership",
  "A colleague",
  "A client",
] as const;

/**
 * Works out whether a receipt landed outside working hours from a free-text time label.
 *
 * The label is free text on purpose — "Friday 6:47 PM", "Sunday morning", "23:14" are all
 * how people actually remember these, and demanding an exact timestamp would either get
 * a fabricated one or no receipt at all. We parse what we can and let the poster override.
 */
export function looksAfterHours(label: string): boolean {
  const text = label.toLowerCase();

  if (/\b(saturday|sunday|weekend|bank holiday|christmas|new year)\b/.test(text)) return true;
  if (/\b(midnight|late at night|small hours|3am|4am)\b/.test(text)) return true;

  // 12-hour clock: 6:47 pm, 11 pm
  const twelve = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (twelve) {
    const rawHour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? 0);
    // "18:99pm" and the like: an invalid clock value should not silently become a
    // (wrong) after-hours badge that then gets persisted and counted in company metrics.
    if (rawHour < 1 || rawHour > 12 || minute > 59) return false;
    const hour = (rawHour % 12) + (twelve[3] === "pm" ? 12 : 0);
    return outsideWorkingHours(hour, minute);
  }

  // 24-hour clock: 18:30, 23:14
  const twentyFour = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return false;
    return outsideWorkingHours(hour, minute);
  }

  return false;
}

/**
 * Working hours run 07:00–18:00. The bound matters more than it looks: the canonical
 * receipt on this site is the 6:47pm "quick call?", which is 18:47 — an hour boundary
 * of 19:00 would let exactly the wrong thing through.
 */
const DAY_START_MINUTES = 7 * 60;
const DAY_END_MINUTES = 18 * 60;

function outsideWorkingHours(hour: number, minute: number): boolean {
  const t = hour * 60 + minute;
  return t >= DAY_END_MINUTES || t < DAY_START_MINUTES;
}

/** Reader-facing caption for the after-hours badge. */
export function afterHoursNote(kind: ReceiptKind): string {
  return kind === "invite" ? "scheduled outside working hours" : "sent outside working hours";
}
