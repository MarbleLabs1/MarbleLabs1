/**
 * Pre-publication screening.
 *
 * A site that hosts "here is why my employer was awful" is one careless post away
 * from a defamation letter, and one careless post away from doxxing a named
 * individual. Two rules do most of the work:
 *
 *   1. Criticism attaches to the company, never to a named person.
 *   2. No contact details, ever — not the poster's, not anyone else's.
 *
 * `screen()` returns `block` findings (post is rejected, author gets told exactly
 * what to change) and `flag` findings (post is published but queued for review).
 * Nothing here is a substitute for a human reviewing the queue.
 */

export type Finding = {
  action: "block" | "flag";
  code: string;
  message: string;
  /** The offending excerpt, so the author can find and fix it. */
  excerpt?: string;
};

export type ScreenResult = {
  ok: boolean;
  findings: Finding[];
  /** Text with contact details redacted, safe to persist even when flagged. */
  redacted: string;
};

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL = /\bhttps?:\/\/\S+|\b(?:www\.)[\w-]+\.\w{2,}\S*/gi;
const HANDLE = /(?<![\w/])@[A-Za-z0-9_]{3,}\b/g;

/**
 * "my manager Dave", "our CEO Karen Smith" — the shape of a post that names an
 * individual. Deliberately narrow: a role word followed by a capitalised given name,
 * which is how people actually write these sentences.
 *
 * Two regexes rather than one because the case rules differ by half: the role word
 * matches in any case ("CEO", "ceo"), while the name must be capitalised — folding the
 * whole pattern to case-insensitive would match any word at all and block everything.
 */
const ROLE_WORDS =
  "manager|boss|supervisor|lead|director|ceo|cto|coo|cfo|vp|founder|owner|head of [a-z]+|team lead|recruiter|hr rep";
const ROLE_PREFIX = new RegExp(
  `\\b(?:${ROLE_WORDS})\\b(?:'s)?[,\\s]+(?:was|is|named|called)?\\s*`,
  "gi",
);
const CAPITALISED_NAME = /^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/;

/**
 * Capitalised words that follow a role word constantly and are not people. Without
 * this, "I told my manager Monday morning" reads as naming someone called Monday.
 */
const NOT_A_NAME =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December|Slack|Teams|Zoom|Google|Excel|Christmas|Easter|Engineering|Product|Design|Sales|Marketing|Finance|Legal|Operations|London|Manchester|Leeds|Bristol)$/;

/** Returns the offending "role + name" excerpt, or null when no individual is named. */
function findNamedIndividual(text: string): string | null {
  for (const prefix of text.matchAll(ROLE_PREFIX)) {
    const after = text.slice(prefix.index + prefix[0].length);
    const name = after.match(CAPITALISED_NAME);
    if (!name) continue;
    if (NOT_A_NAME.test(name[0].split(/\s+/)[0])) continue;
    return `${prefix[0].trim()} ${name[0]}`.replace(/\s+/g, " ");
  }
  return null;
}

/** Words that turn opinion into a factual allegation of a crime. */
const ALLEGATION_WORDS =
  /\b(fraud|embezzl\w*|stole|stealing|money launder\w*|tax evasion|assault\w*|rape|criminal|felony|illegal|bribe\w*|insider trading)\b/gi;

const MIN_BODY = 120;
const MAX_BODY = 6000;
const MAX_HEADLINE = 120;

function excerpt(text: string, match: string): string {
  const i = text.indexOf(match);
  if (i < 0) return match;
  const start = Math.max(0, i - 30);
  const end = Math.min(text.length, i + match.length + 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * The PHONE regex is loose on purpose (it has to catch "+44 7700 900123" and "(020) 7946
 * 0958" alike), which means it also matches ordinary text like "1, 2, 3, 4, 5" or "2019 -
 * 2021 (two years)". A real phone number has at least eight digits in it; apply that test
 * everywhere PHONE is used, or screening blocks stories that redaction would leave alone.
 */
function isPhoneLike(match: string): boolean {
  return match.replace(/\D/g, "").length >= 8;
}

/** Strips contact details and replaces them with a visible marker. */
export function redactContactDetails(text: string): string {
  return text
    .replace(EMAIL, "[email removed]")
    .replace(URL, "[link removed]")
    .replace(HANDLE, "[handle removed]")
    .replace(PHONE, (m) => (isPhoneLike(m) ? "[number removed]" : m));
}

/**
 * screen()'s findings that exist to validate a *headline* — meaningless here, because
 * screenShort() callers pass either a fixed placeholder ("Comment") or an optional
 * receipt subject that the API schema already bounds independently (max 140 chars,
 * allowed to be empty). An empty or 130-char subject is not a defect in the receipt;
 * treating it as one is what "too_short" alone used to miss — an empty subject still
 * tripped no_headline, and a 130-char one still tripped headline_long.
 */
const HEADLINE_ONLY_CODES = new Set(["too_short", "no_headline", "headline_long"]);

/**
 * Screens a short piece of text — a receipt, a comment — through the same checks a
 * full story gets (names, contact details, allegations), minus the length/headline
 * rules meant for a story's own headline and body, which do not apply to a comment or
 * a receipt's optional subject line.
 */
export function screenShort(input: { label: string; body: string }): ScreenResult {
  const result = screen({ headline: input.label, body: input.body });
  const findings = result.findings.filter((f) => !HEADLINE_ONLY_CODES.has(f.code));
  // ok has to be recomputed from the filtered list, not copied from screen()'s result:
  // every excluded code is a block-action finding, and if one was the only finding, the
  // stale ok would stay false even though nothing left in findings actually blocks anything.
  return { ...result, findings, ok: !findings.some((f) => f.action === "block") };
}

export function screen(input: { headline: string; body: string }): ScreenResult {
  const findings: Finding[] = [];
  const headline = input.headline.trim();
  const body = input.body.trim();
  const combined = `${headline}\n${body}`;

  if (body.length < MIN_BODY) {
    findings.push({
      action: "block",
      code: "too_short",
      message: `Tell the story properly — at least ${MIN_BODY} characters. Right now it is ${body.length}.`,
    });
  }
  if (body.length > MAX_BODY) {
    findings.push({
      action: "block",
      code: "too_long",
      message: `Keep it under ${MAX_BODY} characters.`,
    });
  }
  if (!headline) {
    findings.push({ action: "block", code: "no_headline", message: "Add a one-line summary." });
  }
  if (headline.length > MAX_HEADLINE) {
    findings.push({
      action: "block",
      code: "headline_long",
      message: `Summary must be under ${MAX_HEADLINE} characters.`,
    });
  }

  for (const [code, re, message] of [
    ["email", EMAIL, "Remove the email address — no contact details, including your own."],
    ["phone", PHONE, "Remove the phone number — no contact details, including your own."],
    ["link", URL, "Remove the link. Links get used to identify posters."],
    ["handle", HANDLE, "Remove the @handle."],
  ] as const) {
    const all = combined.match(re);
    const hit = code === "phone" ? (all?.filter(isPhoneLike) ?? null) : all;
    if (hit && hit.length) {
      findings.push({ action: "block", code, message, excerpt: excerpt(combined, hit[0]) });
    }
  }

  const named = findNamedIndividual(combined);
  if (named) {
    findings.push({
      action: "block",
      code: "named_individual",
      message:
        `Do not name individuals. Rewrite "${named}" as a role — "my manager", "a director" — ` +
        "so the story is about the company, not a person who cannot answer back.",
      excerpt: named,
    });
  }

  const allegation = combined.match(ALLEGATION_WORDS);
  if (allegation) {
    findings.push({
      action: "flag",
      code: "allegation",
      message:
        `"${allegation[0]}" is an allegation of unlawful conduct, so this post goes to human review ` +
        "before it is promoted anywhere. Describe what you personally saw and how it felt, not a verdict.",
      excerpt: excerpt(combined, allegation[0]),
    });
  }

  if (body === body.toUpperCase() && body.length > 40) {
    findings.push({
      action: "flag",
      code: "shouting",
      message: "All-caps posts read as noise and get fewer people believing you.",
    });
  }

  return {
    ok: !findings.some((f) => f.action === "block"),
    findings,
    redacted: redactContactDetails(body),
  };
}
