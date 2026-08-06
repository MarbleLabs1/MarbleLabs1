import { createHash } from "node:crypto";

/**
 * A pseudonym for a story, derived from its author_hash — not a new identity, not
 * stored anywhere, just a deterministic label so a story reads like it came from a
 * person rather than a database row. The same author_hash always maps to the same
 * pseudonym, but nothing here makes the mapping reversible or lets two different
 * posters be told apart beyond what author_hash already permits (which is: not much,
 * on purpose — see requesterHash() in request.ts).
 *
 * Two different posters can land on the same pseudonym. That is a feature, not a
 * collision to fix: a supposedly-unique-looking anonymous handle is exactly the kind
 * of thing that quietly becomes a fingerprint across stories.
 */

const MOODS = [
  "Weary", "Blunt", "Tired", "Quiet", "Sharp", "Calm", "Restless", "Steady",
  "Wary", "Plain", "Direct", "Worn", "Level", "Dry", "Frank", "Grounded",
];

const ROLES = [
  "Engineer", "Analyst", "Manager", "Designer", "Coordinator", "Associate",
  "Specialist", "Lead", "Consultant", "Operator", "Technician", "Producer",
];

function seedFrom(hash: string): number {
  const digest = createHash("sha256").update(hash).digest();
  return digest.readUInt32BE(0);
}

export function pseudonymFor(authorHash: string): string {
  const seed = seedFrom(authorHash);
  const mood = MOODS[seed % MOODS.length];
  const role = ROLES[Math.floor(seed / MOODS.length) % ROLES.length];
  const tag = seed % 10000;
  return `${mood} ${role} #${String(tag).padStart(4, "0")}`;
}

export function initialsFor(authorHash: string): string {
  return initialsFromPseudonym(pseudonymFor(authorHash));
}

/** Works on the label itself — for client components, which only ever see the
 *  pseudonym string on Story, never the author_hash it was derived from. */
export function initialsFromPseudonym(pseudonym: string): string {
  const [mood, role] = pseudonym.split(" ");
  return `${mood?.[0] ?? "?"}${role?.[0] ?? ""}`;
}
