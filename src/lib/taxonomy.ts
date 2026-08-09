/**
 * The structured taxonomy of "why I actually quit".
 *
 * Free-text confessions are cathartic but worthless as data. The taxonomy is what
 * turns a wall of anonymous rants into something a candidate will pay $9/mo to read
 * and an employer will pay real money to benchmark against. Every code here is
 * append-only: never rename or delete one, or historical aggregates shift under you.
 */

export type ReasonCode =
  | "bad_manager"
  | "burnout"
  | "underpaid"
  | "no_growth"
  | "disrespect"
  | "discrimination"
  | "layoff_chaos"
  | "rto_mandate"
  | "values_mismatch"
  | "reorg_churn"
  | "unpaid_overtime"
  | "favoritism"
  | "micromanagement"
  | "broken_promises"
  | "no_flexibility"
  | "better_offer";

export type Reason = {
  code: ReasonCode;
  label: string;
  /** Short prompt shown under the checkbox so people self-classify accurately. */
  hint: string;
  /**
   * Contribution to the Exit Index (0-1). Weighted by how strongly the reason
   * predicts an environment problem rather than an ordinary career move —
   * "better offer" is a healthy exit and scores zero.
   */
  weight: number;
  group: "management" | "conditions" | "compensation" | "trust" | "neutral";
};

export const REASONS: Reason[] = [
  {
    code: "bad_manager",
    label: "Bad manager, no support",
    hint: "You left the manager, not the job.",
    weight: 0.9,
    group: "management",
  },
  {
    code: "micromanagement",
    label: "Micromanagement",
    hint: "Every decision needed approval.",
    weight: 0.7,
    group: "management",
  },
  {
    code: "favoritism",
    label: "Favoritism and politics",
    hint: "Who you knew beat what you shipped.",
    weight: 0.75,
    group: "management",
  },
  {
    code: "reorg_churn",
    label: "Constant reorgs, no strategy",
    hint: "New direction every quarter.",
    weight: 0.6,
    group: "management",
  },
  {
    code: "burnout",
    label: "Burnout, unsustainable workload",
    hint: "The pace was never going to be fixed.",
    weight: 0.95,
    group: "conditions",
  },
  {
    code: "unpaid_overtime",
    label: "Unpaid overtime as the default",
    hint: "Evenings and weekends were assumed.",
    weight: 0.85,
    group: "conditions",
  },
  {
    code: "no_flexibility",
    label: "No flexibility around real life",
    hint: "Illness, childcare, or caregiving was treated as a problem.",
    weight: 0.7,
    group: "conditions",
  },
  {
    code: "rto_mandate",
    label: "Return-to-office mandate",
    hint: "The terms of the job changed after you took it.",
    weight: 0.5,
    group: "conditions",
  },
  {
    code: "underpaid",
    label: "Underpaid, no raise in sight",
    hint: "Below market and the gap kept widening.",
    weight: 0.6,
    group: "compensation",
  },
  {
    code: "no_growth",
    label: "No growth or promotion path",
    hint: "The next step did not exist.",
    weight: 0.55,
    group: "compensation",
  },
  {
    code: "broken_promises",
    label: "Broken promises from hiring",
    hint: "The role you were sold was not the role you got.",
    weight: 0.8,
    group: "trust",
  },
  {
    code: "layoff_chaos",
    label: "Layoff chaos, no job security",
    hint: "Rolling cuts and silence from leadership.",
    weight: 0.75,
    group: "trust",
  },
  {
    code: "disrespect",
    label: "Disrespect, being belittled",
    hint: "Shouting, public dressing-down, contempt.",
    weight: 0.9,
    group: "trust",
  },
  {
    code: "values_mismatch",
    label: "Ethics or values mismatch",
    hint: "You were asked to do something you would not defend.",
    weight: 0.8,
    group: "trust",
  },
  {
    code: "discrimination",
    label: "Discrimination or harassment",
    hint: "Treated differently because of who you are.",
    weight: 1.0,
    group: "trust",
  },
  {
    code: "better_offer",
    label: "Simply a better offer",
    hint: "Nothing was wrong. Something better came along.",
    weight: 0.0,
    group: "neutral",
  },
];

export const REASON_MAP: Record<string, Reason> = Object.fromEntries(
  REASONS.map((r) => [r.code, r]),
);

export const REASON_CODES = REASONS.map((r) => r.code);

export function reasonLabel(code: string): string {
  return REASON_MAP[code]?.label ?? code;
}

export const ROLE_FAMILIES = [
  "Engineering",
  "Product",
  "Design",
  "Data & Analytics",
  "Sales",
  "Marketing",
  "Customer Support",
  "Operations",
  "Finance",
  "People / HR",
  "Legal",
  "Healthcare",
  "Education",
  "Retail & Hospitality",
  "Logistics & Warehouse",
  "Manufacturing",
  "Other",
] as const;

export const SENIORITIES = [
  "Intern",
  "Junior",
  "Mid",
  "Senior",
  "Lead / Staff",
  "Manager",
  "Director+",
] as const;

export const SIZE_BUCKETS = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
] as const;

/** Tenure buckets, used for display and for the "left within a year" retention signal. */
export function tenureLabel(months: number): string {
  if (months < 3) return "under 3 months";
  if (months < 6) return "3-6 months";
  if (months < 12) return "6-12 months";
  if (months < 24) return "1-2 years";
  if (months < 60) return "2-5 years";
  return "5+ years";
}
