import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite via better-sqlite3. Single file, synchronous, no service to run — the right
 * call while the product is finding out whether anyone wants it.
 *
 * When you outgrow it (roughly: multiple app instances, or you deploy anywhere with an
 * ephemeral filesystem such as Vercel/Lambda), the migration is Postgres. Every query
 * lives in this file and nowhere else precisely so that swap stays a one-file job.
 */

const DB_PATH = process.env.LINKEDOUT_DB ?? "./data/linkedout.db";

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      industry    TEXT,
      size_bucket TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stories (
      id           TEXT PRIMARY KEY,
      company_id   INTEGER NOT NULL REFERENCES companies(id),
      headline     TEXT NOT NULL,
      body         TEXT NOT NULL,
      role_family  TEXT NOT NULL,
      seniority    TEXT NOT NULL,
      tenure_months INTEGER NOT NULL,
      reasons      TEXT NOT NULL,          -- JSON array of ReasonCode
      severity     INTEGER NOT NULL,       -- 1..5, how toxic it was
      warn_friend  INTEGER NOT NULL,       -- 0/1, would you warn a friend off
      region       TEXT,
      status       TEXT NOT NULL DEFAULT 'published', -- published | review | removed
      findings     TEXT NOT NULL DEFAULT '[]',        -- JSON moderation findings
      author_hash  TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stories_company ON stories(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);

    CREATE TABLE IF NOT EXISTS echoes (
      story_id   TEXT NOT NULL REFERENCES stories(id),
      voter_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (story_id, voter_hash)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id   TEXT NOT NULL REFERENCES stories(id),
      reason     TEXT NOT NULL,
      detail     TEXT,
      reporter_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT NOT NULL UNIQUE,
      plan       TEXT NOT NULL,           -- candidate | employer
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id      TEXT NOT NULL REFERENCES stories(id),
      kind          TEXT NOT NULL,
      sender_role   TEXT NOT NULL,
      sent_at_label TEXT,
      subject       TEXT,
      content       TEXT NOT NULL,
      after_hours   INTEGER NOT NULL DEFAULT 0,
      position      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_story ON receipts(story_id, position);

    CREATE TABLE IF NOT EXISTS moderation_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id   TEXT NOT NULL REFERENCES stories(id),
      action     TEXT NOT NULL,          -- approve | remove | restore
      note       TEXT,
      from_status TEXT NOT NULL,
      to_status   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_modlog_story ON moderation_log(story_id, created_at DESC);
  `);
}

/**
 * Posters are anonymous, so we never store an IP. We store a salted hash of it,
 * which is enough to rate-limit and to stop one person echoing their own story
 * a hundred times, and useless to anyone who steals the database.
 */
export function anonHash(value: string): string {
  const salt = process.env.LINKEDOUT_SALT ?? "dev-salt-change-me";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  if (slug) return slug;
  // A name with no ASCII alphanumerics (e.g. all emoji, or a non-Latin script NFKD
  // doesn't decompose) reduces to "". Without a fallback, every such company collides
  // on slug "" and their stories, receipts and Exit Index merge into one record.
  return `company-${createHash("sha256").update(name).digest("hex").slice(0, 12)}`;
}

export type CompanyRow = {
  id: number;
  slug: string;
  name: string;
  industry: string | null;
  size_bucket: string | null;
};

export function upsertCompany(input: {
  name: string;
  industry?: string | null;
  size_bucket?: string | null;
}): CompanyRow {
  const d = db();
  const slug = slugify(input.name);
  const existing = d
    .prepare(`SELECT id, slug, name, industry, size_bucket FROM companies WHERE slug = ?`)
    .get(slug) as CompanyRow | undefined;
  if (existing) {
    // Fill in metadata the first poster left blank without overwriting known values.
    if ((!existing.industry && input.industry) || (!existing.size_bucket && input.size_bucket)) {
      d.prepare(`UPDATE companies SET industry = COALESCE(industry, ?), size_bucket = COALESCE(size_bucket, ?) WHERE id = ?`)
        .run(input.industry ?? null, input.size_bucket ?? null, existing.id);
    }
    return existing;
  }
  const info = d
    .prepare(`INSERT INTO companies (slug, name, industry, size_bucket) VALUES (?, ?, ?, ?)`)
    .run(slug, input.name.trim().slice(0, 120), input.industry ?? null, input.size_bucket ?? null);
  return {
    id: Number(info.lastInsertRowid),
    slug,
    name: input.name.trim().slice(0, 120),
    industry: input.industry ?? null,
    size_bucket: input.size_bucket ?? null,
  };
}

export function getCompanyBySlug(slug: string): CompanyRow | undefined {
  return db()
    .prepare(`SELECT id, slug, name, industry, size_bucket FROM companies WHERE slug = ?`)
    .get(slug) as CompanyRow | undefined;
}

export type StoryRow = {
  id: string;
  company_id: number;
  company_name: string;
  company_slug: string;
  headline: string;
  body: string;
  role_family: string;
  seniority: string;
  tenure_months: number;
  reasons: string;
  severity: number;
  warn_friend: number;
  region: string | null;
  status: string;
  created_at: string;
  echoes: number;
};

export type Story = Omit<StoryRow, "reasons" | "warn_friend"> & {
  reasons: string[];
  warn_friend: boolean;
};

function hydrate(row: StoryRow): Story {
  const { reasons, warn_friend, ...rest } = row;
  let parsed: string[] = [];
  try {
    parsed = JSON.parse(reasons);
  } catch {
    parsed = [];
  }
  return { ...rest, reasons: parsed, warn_friend: warn_friend === 1 };
}

const STORY_SELECT = `
  SELECT s.id, s.company_id, c.name AS company_name, c.slug AS company_slug,
         s.headline, s.body, s.role_family, s.seniority, s.tenure_months,
         s.reasons, s.severity, s.warn_friend, s.region, s.status, s.created_at,
         (SELECT COUNT(*) FROM echoes e WHERE e.story_id = s.id) AS echoes
  FROM stories s JOIN companies c ON c.id = s.company_id
`;

export function insertStory(input: {
  id: string;
  company_id: number;
  headline: string;
  body: string;
  role_family: string;
  seniority: string;
  tenure_months: number;
  reasons: string[];
  severity: number;
  warn_friend: boolean;
  region: string | null;
  status: string;
  findings: unknown;
  author_hash: string;
}): void {
  db()
    .prepare(
      `INSERT INTO stories (id, company_id, headline, body, role_family, seniority,
        tenure_months, reasons, severity, warn_friend, region, status, findings, author_hash)
       VALUES (@id, @company_id, @headline, @body, @role_family, @seniority,
        @tenure_months, @reasons, @severity, @warn_friend, @region, @status, @findings, @author_hash)`,
    )
    .run({
      ...input,
      reasons: JSON.stringify(input.reasons),
      warn_friend: input.warn_friend ? 1 : 0,
      findings: JSON.stringify(input.findings ?? []),
    });
}

export type FeedQuery = {
  reason?: string;
  role?: string;
  companySlug?: string;
  sort?: "recent" | "echoed" | "severe";
  limit?: number;
  offset?: number;
};

export function listStories(q: FeedQuery = {}): Story[] {
  const where: string[] = [`s.status = 'published'`];
  const params: Record<string, unknown> = {};

  if (q.reason) {
    // reasons is a JSON array; EXISTS over json_each keeps this index-free but correct.
    where.push(`EXISTS (SELECT 1 FROM json_each(s.reasons) j WHERE j.value = @reason)`);
    params.reason = q.reason;
  }
  if (q.role) {
    where.push(`s.role_family = @role`);
    params.role = q.role;
  }
  if (q.companySlug) {
    where.push(`c.slug = @companySlug`);
    params.companySlug = q.companySlug;
  }

  const order =
    q.sort === "echoed"
      ? `echoes DESC, s.created_at DESC`
      : q.sort === "severe"
        ? `s.severity DESC, echoes DESC`
        : `s.created_at DESC`;

  params.limit = Math.min(q.limit ?? 25, 100);
  params.offset = q.offset ?? 0;

  const rows = db()
    .prepare(
      `${STORY_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT @limit OFFSET @offset`,
    )
    .all(params) as StoryRow[];
  return rows.map(hydrate);
}

export function getStory(id: string): Story | undefined {
  const row = db().prepare(`${STORY_SELECT} WHERE s.id = ?`).get(id) as StoryRow | undefined;
  return row ? hydrate(row) : undefined;
}

export function addEcho(storyId: string, voterHash: string): { added: boolean; total: number } {
  const d = db();
  const info = d
    .prepare(`INSERT OR IGNORE INTO echoes (story_id, voter_hash) VALUES (?, ?)`)
    .run(storyId, voterHash);
  const total = (
    d.prepare(`SELECT COUNT(*) AS n FROM echoes WHERE story_id = ?`).get(storyId) as { n: number }
  ).n;
  return { added: info.changes > 0, total };
}

const REPORTS_TO_HIDE = 3;

export function addReport(input: {
  storyId: string;
  reason: string;
  detail?: string | null;
  reporterHash: string;
}): { hidden: boolean } {
  const d = db();
  d.prepare(
    `INSERT INTO reports (story_id, reason, detail, reporter_hash) VALUES (?, ?, ?, ?)`,
  ).run(input.storyId, input.reason, input.detail ?? null, input.reporterHash);
  const distinct = (
    d
      .prepare(`SELECT COUNT(DISTINCT reporter_hash) AS n FROM reports WHERE story_id = ?`)
      .get(input.storyId) as { n: number }
  ).n;
  if (distinct >= REPORTS_TO_HIDE) {
    d.prepare(`UPDATE stories SET status = 'review' WHERE id = ? AND status = 'published'`).run(
      input.storyId,
    );
    return { hidden: true };
  }
  return { hidden: false };
}

/** Simple fixed-window rate limit, counted from the stories table itself. */
export function recentPostCount(authorHash: string, hours = 24): number {
  return (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM stories WHERE author_hash = ? AND created_at > datetime('now', ?)`,
      )
      .get(authorHash, `-${hours} hours`) as { n: number }
  ).n;
}

export type CompanyStats = {
  slug: string;
  name: string;
  industry: string | null;
  size_bucket: string | null;
  story_count: number;
  avg_severity: number;
  warn_rate: number;
  /** Share of posters who left inside their first year. */
  early_exit_rate: number;
  top_reasons: { code: string; count: number }[];
  /** null until MIN_STORIES_FOR_INDEX is met — see exitIndex(). */
  exit_index: number | null;
};

/**
 * A single angry post is not evidence, and publishing a company-level score off one
 * post is how you get sued. Below this threshold we show the stories but withhold
 * the number.
 */
export const MIN_STORIES_FOR_INDEX = 3;

/**
 * Exit Index, 0-100. Higher means more people left for reasons that say something
 * about the environment rather than about an ordinary career move.
 *
 *   55%  weighted reason mix — what kind of reasons, not how many
 *   25%  average severity as reported
 *   20%  share who would warn a friend away
 *
 * Deliberately boring and inspectable: anyone accused of a bad score can be shown
 * exactly how it was computed, which matters when they call to complain.
 */
export function exitIndex(input: {
  storyCount: number;
  avgSeverity: number;
  warnRate: number;
  reasonWeights: number[];
}): number | null {
  if (input.storyCount < MIN_STORIES_FOR_INDEX) return null;
  const reasonScore = input.reasonWeights.length
    ? input.reasonWeights.reduce((a, b) => a + b, 0) / input.reasonWeights.length
    : 0;
  const severityScore = (input.avgSeverity - 1) / 4; // 1..5 -> 0..1
  const raw = 0.55 * reasonScore + 0.25 * severityScore + 0.2 * input.warnRate;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

type AggRow = {
  slug: string;
  name: string;
  industry: string | null;
  size_bucket: string | null;
  story_count: number;
  avg_severity: number;
  warn_count: number;
  early_exits: number;
};

const AGG_SELECT = `
  SELECT c.slug, c.name, c.industry, c.size_bucket,
         COUNT(s.id) AS story_count,
         AVG(s.severity) AS avg_severity,
         SUM(s.warn_friend) AS warn_count,
         SUM(CASE WHEN s.tenure_months < 12 THEN 1 ELSE 0 END) AS early_exits
  FROM companies c JOIN stories s ON s.company_id = c.id AND s.status = 'published'
`;

function reasonCounts(slug: string): { code: string; count: number }[] {
  return db()
    .prepare(
      `SELECT j.value AS code, COUNT(*) AS count
       FROM stories s JOIN companies c ON c.id = s.company_id, json_each(s.reasons) j
       WHERE c.slug = ? AND s.status = 'published'
       GROUP BY j.value ORDER BY count DESC, code ASC`,
    )
    .all(slug) as { code: string; count: number }[];
}

/**
 * Same shape as reasonCounts(), for every slug in one query. listCompanyStats() ranks a
 * whole leaderboard at once, and reasonCounts() per row there would be an N+1 query per
 * page load; this bucket-in-memory version replaces that with one query regardless of N.
 */
function reasonCountsForSlugs(slugs: string[]): Map<string, { code: string; count: number }[]> {
  const buckets = new Map<string, { code: string; count: number }[]>();
  if (slugs.length === 0) return buckets;
  const placeholders = slugs.map(() => "?").join(",");
  const rows = db()
    .prepare(
      `SELECT c.slug AS slug, j.value AS code, COUNT(*) AS count
       FROM stories s JOIN companies c ON c.id = s.company_id, json_each(s.reasons) j
       WHERE c.slug IN (${placeholders}) AND s.status = 'published'
       GROUP BY c.slug, j.value ORDER BY c.slug, count DESC, code ASC`,
    )
    .all(...slugs) as { slug: string; code: string; count: number }[];
  for (const r of rows) {
    const bucket = buckets.get(r.slug) ?? [];
    bucket.push({ code: r.code, count: r.count });
    buckets.set(r.slug, bucket);
  }
  return buckets;
}

function buildStats(
  row: AggRow,
  weightFor: (code: string) => number,
  reasons?: { code: string; count: number }[],
): CompanyStats {
  const top = reasons ?? reasonCounts(row.slug);
  // Weight each *selected reason instance*, so a company whose exits are mostly
  // "better offer" scores near zero even with a high story count.
  const weights: number[] = [];
  for (const r of top) {
    for (let i = 0; i < r.count; i++) weights.push(weightFor(r.code));
  }
  const warnRate = row.story_count ? row.warn_count / row.story_count : 0;
  return {
    slug: row.slug,
    name: row.name,
    industry: row.industry,
    size_bucket: row.size_bucket,
    story_count: row.story_count,
    avg_severity: Number((row.avg_severity ?? 0).toFixed(2)),
    warn_rate: Number(warnRate.toFixed(3)),
    early_exit_rate: Number((row.story_count ? row.early_exits / row.story_count : 0).toFixed(3)),
    top_reasons: top.slice(0, 6),
    exit_index: exitIndex({
      storyCount: row.story_count,
      avgSeverity: row.avg_severity ?? 1,
      warnRate,
      reasonWeights: weights,
    }),
  };
}

export function getCompanyStats(
  slug: string,
  weightFor: (code: string) => number,
): CompanyStats | undefined {
  const row = db()
    .prepare(`${AGG_SELECT} WHERE c.slug = ? GROUP BY c.id`)
    .get(slug) as AggRow | undefined;
  if (!row) return undefined;
  return buildStats(row, weightFor);
}

/**
 * Leaderboard. Only companies past the evidence threshold get ranked; everything
 * below that is visible on its own page but not held up as a comparison.
 */
export function listCompanyStats(
  weightFor: (code: string) => number,
  opts: { limit?: number; minStories?: number; industry?: string } = {},
): CompanyStats[] {
  const min = opts.minStories ?? MIN_STORIES_FOR_INDEX;
  const limit = opts.limit ?? 50;
  const params: Record<string, unknown> = { min };
  let filter = "";
  if (opts.industry) {
    filter = `WHERE c.industry = @industry`;
    params.industry = opts.industry;
  }
  // No SQL LIMIT here: exit_index blends reason weight, severity and warn rate, so the
  // company that ranks #1 on it is not necessarily the one SQL's simpler ORDER BY would
  // keep. Rank every qualifying company in JS, then slice — the correct order, not a
  // guess at which rows the true order might have kept.
  const rows = db()
    .prepare(
      `${AGG_SELECT} ${filter} GROUP BY c.id HAVING COUNT(s.id) >= @min
       ORDER BY AVG(s.severity) DESC, COUNT(s.id) DESC`,
    )
    .all(params) as AggRow[];
  const reasonsBySlug = reasonCountsForSlugs(rows.map((r) => r.slug));
  return rows
    .map((r) => buildStats(r, weightFor, reasonsBySlug.get(r.slug) ?? []))
    .sort((a, b) => (b.exit_index ?? 0) - (a.exit_index ?? 0))
    .slice(0, limit);
}

/** Platform-wide numbers for the landing page and the free half of the reports. */
export function globalStats(): {
  stories: number;
  companies: number;
  topReasons: { code: string; count: number }[];
  /** Every reason selection across every story — the correct denominator for a share
   *  of topReasons, which is truncated to 8 rows and undercounts if used as the total. */
  totalReasonSelections: number;
  avgTenureMonths: number;
  warnRate: number;
} {
  const d = db();
  const base = d
    .prepare(
      `SELECT COUNT(*) AS stories, AVG(tenure_months) AS tenure, AVG(warn_friend) AS warn
       FROM stories WHERE status = 'published'`,
    )
    .get() as { stories: number; tenure: number | null; warn: number | null };
  const companies = (
    d
      .prepare(
        `SELECT COUNT(DISTINCT company_id) AS n FROM stories WHERE status = 'published'`,
      )
      .get() as { n: number }
  ).n;
  const topReasons = d
    .prepare(
      `SELECT j.value AS code, COUNT(*) AS count
       FROM stories s, json_each(s.reasons) j
       WHERE s.status = 'published'
       GROUP BY j.value ORDER BY count DESC LIMIT 8`,
    )
    .all() as { code: string; count: number }[];
  const totalReasonSelections = (
    d
      .prepare(
        `SELECT COUNT(*) AS n FROM stories s, json_each(s.reasons) j WHERE s.status = 'published'`,
      )
      .get() as { n: number }
  ).n;
  return {
    stories: base.stories,
    companies,
    topReasons,
    totalReasonSelections,
    avgTenureMonths: Math.round(base.tenure ?? 0),
    warnRate: Number((base.warn ?? 0).toFixed(3)),
  };
}

/**
 * The paid artefact: a company's exit pattern broken out by role and seniority.
 * This is the cut a hiring manager or a candidate weighing an offer actually wants,
 * and the reason the employer tier can be priced like a research subscription.
 */
export function exitBreakdown(slug: string): {
  byRole: { role_family: string; n: number; avg_severity: number }[];
  bySeniority: { seniority: string; n: number; avg_severity: number }[];
  byTenure: { bucket: string; n: number }[];
  timeline: { month: string; n: number }[];
} {
  const d = db();
  const byRole = d
    .prepare(
      `SELECT s.role_family, COUNT(*) AS n, ROUND(AVG(s.severity), 2) AS avg_severity
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE c.slug = ? AND s.status = 'published'
       GROUP BY s.role_family ORDER BY n DESC`,
    )
    .all(slug) as { role_family: string; n: number; avg_severity: number }[];
  const bySeniority = d
    .prepare(
      `SELECT s.seniority, COUNT(*) AS n, ROUND(AVG(s.severity), 2) AS avg_severity
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE c.slug = ? AND s.status = 'published'
       GROUP BY s.seniority ORDER BY n DESC`,
    )
    .all(slug) as { seniority: string; n: number; avg_severity: number }[];
  const byTenure = d
    .prepare(
      `SELECT CASE
                WHEN tenure_months < 6 THEN 'under 6 months'
                WHEN tenure_months < 12 THEN '6-12 months'
                WHEN tenure_months < 24 THEN '1-2 years'
                WHEN tenure_months < 60 THEN '2-5 years'
                ELSE '5+ years' END AS bucket,
              COUNT(*) AS n
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE c.slug = ? AND s.status = 'published'
       GROUP BY bucket ORDER BY MIN(tenure_months)`,
    )
    .all(slug) as { bucket: string; n: number }[];
  const timeline = d
    .prepare(
      `SELECT strftime('%Y-%m', s.created_at) AS month, COUNT(*) AS n
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE c.slug = ? AND s.status = 'published'
       GROUP BY month ORDER BY month`,
    )
    .all(slug) as { month: string; n: number }[];
  return { byRole, bySeniority, byTenure, timeline };
}

export function recordSubscriber(emailHash: string, plan: string): void {
  db()
    .prepare(`INSERT OR IGNORE INTO subscribers (email_hash, plan) VALUES (?, ?)`)
    .run(emailHash, plan);
}

/* ── Receipts ──────────────────────────────────────────────────────────────────
 *
 * The thing that separates this from a review site: the artefact itself. The 6:47pm
 * "quick call?" invite. The "per my last email". The all-hands slide about family.
 *
 * Deliberately NOT image uploads. A screenshot of a work chat carries the sender's
 * real name, their photo, unrelated colleagues in the thread, and often the poster's
 * own display name — you cannot redact that at scale, and hosting it unredacted is
 * both a doxxing engine and a subpoena magnet. So receipts are *transcribed*: the
 * poster types what was said and tags who said it by role. We render it back as the
 * artefact it was, which reads exactly as damning and is searchable, quotable, and
 * screenshot-proof in the way that matters.
 */

export type ReceiptKind = "chat" | "email" | "invite" | "policy" | "review";

export type ReceiptRow = {
  id: number;
  story_id: string;
  kind: ReceiptKind;
  sender_role: string;
  sent_at_label: string | null;
  subject: string | null;
  content: string;
  after_hours: number;
};

export type Receipt = Omit<ReceiptRow, "after_hours"> & { after_hours: boolean };

/**
 * The receipts table now ships in migrate(), which runs once when the connection opens.
 * Kept as a callable no-op — rather than deleted — because tests and scripts/seed.mts
 * call it directly to guarantee the schema exists before they touch the tables from a
 * fresh `db()` call, without needing to know that guarantee moved.
 */
export function migrateReceipts(): void {
  db();
}

export function insertReceipts(
  storyId: string,
  receipts: {
    kind: ReceiptKind;
    sender_role: string;
    sent_at_label?: string | null;
    subject?: string | null;
    content: string;
    after_hours: boolean;
  }[],
): void {
  migrateReceipts();
  const stmt = db().prepare(
    `INSERT INTO receipts (story_id, kind, sender_role, sent_at_label, subject, content, after_hours, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db().transaction(() => {
    receipts.forEach((r, i) =>
      stmt.run(
        storyId,
        r.kind,
        r.sender_role,
        r.sent_at_label ?? null,
        r.subject ?? null,
        r.content,
        r.after_hours ? 1 : 0,
        i,
      ),
    );
  });
  tx();
}

export function getReceipts(storyId: string): Receipt[] {
  migrateReceipts();
  const rows = db()
    .prepare(
      `SELECT id, story_id, kind, sender_role, sent_at_label, subject, content, after_hours
       FROM receipts WHERE story_id = ? ORDER BY position`,
    )
    .all(storyId) as ReceiptRow[];
  return rows.map((r) => ({ ...r, after_hours: r.after_hours === 1 }));
}

/** How many receipts each story carries — drives the "receipts" badge in the feed. */
export function receiptCounts(storyIds: string[]): Record<string, number> {
  if (storyIds.length === 0) return {};
  migrateReceipts();
  const placeholders = storyIds.map(() => "?").join(",");
  const rows = db()
    .prepare(
      `SELECT story_id, COUNT(*) AS n FROM receipts WHERE story_id IN (${placeholders}) GROUP BY story_id`,
    )
    .all(...storyIds) as { story_id: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.story_id, r.n]));
}

/**
 * "Everybody quit within six months" — detected rather than asserted.
 *
 * An exodus is a cluster of short-tenure exits from the same department at the same
 * company. It is the pattern that no individual story can show and no employer can
 * spin, so it gets its own badge.
 */
export type Exodus = {
  role_family: string;
  short_tenure_exits: number;
  total_exits: number;
  median_tenure_months: number;
};

const EXODUS_MIN_EXITS = 3;
const EXODUS_TENURE_MONTHS = 9;

export function detectExodus(slug: string): Exodus[] {
  const rows = db()
    .prepare(
      `SELECT s.role_family,
              SUM(CASE WHEN s.tenure_months <= @months THEN 1 ELSE 0 END) AS short_tenure_exits,
              COUNT(*) AS total_exits
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE c.slug = @slug AND s.status = 'published'
       GROUP BY s.role_family
       HAVING short_tenure_exits >= @min
       ORDER BY short_tenure_exits DESC`,
    )
    .all({ slug, months: EXODUS_TENURE_MONTHS, min: EXODUS_MIN_EXITS }) as {
    role_family: string;
    short_tenure_exits: number;
    total_exits: number;
  }[];

  return rows.map((r) => {
    const tenures = db()
      .prepare(
        `SELECT s.tenure_months AS m FROM stories s JOIN companies c ON c.id = s.company_id
         WHERE c.slug = ? AND s.role_family = ? AND s.status = 'published' ORDER BY m`,
      )
      .all(slug, r.role_family) as { m: number }[];
    const mid = Math.floor(tenures.length / 2);
    const median =
      tenures.length % 2 === 0 && tenures.length > 0
        ? Math.round((tenures[mid - 1].m + tenures[mid].m) / 2)
        : (tenures[mid]?.m ?? 0);
    return { ...r, median_tenure_months: median };
  });
}

/** Share of a company's receipts that were sent outside working hours. */
export function afterHoursRate(slug: string): { total: number; after_hours: number } {
  migrateReceipts();
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total, SUM(r.after_hours) AS after_hours
       FROM receipts r JOIN stories s ON s.id = r.story_id
       JOIN companies c ON c.id = s.company_id
       WHERE c.slug = ? AND s.status = 'published'`,
    )
    .get(slug) as { total: number; after_hours: number | null };
  return { total: row.total, after_hours: row.after_hours ?? 0 };
}

/** The wall of receipts — the most-quotable artefacts across the whole site. */
export function receiptWall(limit = 12): (Receipt & {
  company_name: string;
  company_slug: string;
  headline: string;
})[] {
  migrateReceipts();
  return db()
    .prepare(
      `SELECT r.id, r.story_id, r.kind, r.sender_role, r.sent_at_label, r.subject, r.content,
              r.after_hours, c.name AS company_name, c.slug AS company_slug, s.headline
       FROM receipts r JOIN stories s ON s.id = r.story_id
       JOIN companies c ON c.id = s.company_id
       WHERE s.status = 'published'
       ORDER BY r.after_hours DESC, s.created_at DESC LIMIT ?`,
    )
    .all(limit)
    .map((r) => {
      const row = r as ReceiptRow & { company_name: string; company_slug: string; headline: string };
      return { ...row, after_hours: row.after_hours === 1 };
    });
}

/** The first receipt for each story, for inline previews in the feed. */
export function firstReceipts(storyIds: string[]): Record<string, Receipt> {
  if (storyIds.length === 0) return {};
  migrateReceipts();
  const placeholders = storyIds.map(() => "?").join(",");
  const rows = db()
    .prepare(
      `SELECT id, story_id, kind, sender_role, sent_at_label, subject, content, after_hours
       FROM receipts r
       WHERE story_id IN (${placeholders})
         AND position = (SELECT MIN(position) FROM receipts x WHERE x.story_id = r.story_id)
       GROUP BY story_id`,
    )
    .all(...storyIds) as ReceiptRow[];
  return Object.fromEntries(
    rows.map((r) => [r.story_id, { ...r, after_hours: r.after_hours === 1 }]),
  );
}

/* ── Moderation queue ──────────────────────────────────────────────────────────
 *
 * Pre-publication screening buys you a lot, but it cannot judge. A story that reads
 * as an allegation of unlawful conduct, or one that three readers have flagged, needs
 * a person to decide. Without this the `status='review'` state is a black hole:
 * stories go in and nothing ever comes out.
 *
 * Every decision is written to moderation_log. An unauditable moderation system is
 * indistinguishable from censorship, and the log is what you show when someone asks
 * why their story went.
 */

export type ModerationAction = "approve" | "remove" | "restore";

/** See migrateReceipts() above — the DDL lives in migrate() now, this stays a no-op shim. */
export function migrateModeration(): void {
  db();
}

export type Report = {
  id: number;
  reason: string;
  detail: string | null;
  created_at: string;
};

export function getReports(storyId: string): Report[] {
  return db()
    .prepare(
      `SELECT id, reason, detail, created_at FROM reports WHERE story_id = ? ORDER BY created_at DESC`,
    )
    .all(storyId) as Report[];
}

export type QueueItem = Story & {
  findings: Finding[];
  reports: Report[];
  /** Distinct reporters, which is what actually triggers auto-hiding. */
  reporter_count: number;
  /** Why this is in front of a moderator: screening, reader reports, or both. */
  cause: "screening" | "reports" | "both";
};

/** Screening findings, stored as JSON at insert time. */
export type Finding = { action: string; code: string; message: string; excerpt?: string };

function parseFindings(raw: string): Finding[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Everything awaiting a decision: stories held by screening, plus published stories
 * that readers have flagged. Oldest first — a queue you work from the back of is a
 * queue that never gets worked.
 */
export function listQueue(): QueueItem[] {
  migrateModeration();
  const rows = db()
    .prepare(
      `SELECT s.id, s.company_id, c.name AS company_name, c.slug AS company_slug,
              s.headline, s.body, s.role_family, s.seniority, s.tenure_months,
              s.reasons, s.severity, s.warn_friend, s.region, s.status, s.created_at,
              s.findings AS raw_findings,
              (SELECT COUNT(*) FROM echoes e WHERE e.story_id = s.id) AS echoes
       FROM stories s JOIN companies c ON c.id = s.company_id
       WHERE s.status = 'review'
          OR (s.status = 'published' AND EXISTS (SELECT 1 FROM reports r WHERE r.story_id = s.id))
       ORDER BY s.created_at ASC`,
    )
    .all() as (StoryRow & { raw_findings: string })[];

  // Two queries for the whole queue rather than two per row: the queue only holds
  // content actively awaiting a decision, so it stays small, but "small" is exactly
  // the assumption an N+1 pattern quietly relies on until the backlog isn't.
  const ids = rows.map((r) => r.id);
  const reportsById = new Map<string, Report[]>();
  const reporterCountById = new Map<string, number>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const allReports = db()
      .prepare(
        `SELECT story_id, id, reason, detail, created_at FROM reports
         WHERE story_id IN (${placeholders}) ORDER BY story_id, created_at DESC`,
      )
      .all(...ids) as (Report & { story_id: string })[];
    for (const r of allReports) {
      const { story_id, ...rest } = r;
      reportsById.set(story_id, [...(reportsById.get(story_id) ?? []), rest]);
    }
    const counts = db()
      .prepare(
        `SELECT story_id, COUNT(DISTINCT reporter_hash) AS n FROM reports
         WHERE story_id IN (${placeholders}) GROUP BY story_id`,
      )
      .all(...ids) as { story_id: string; n: number }[];
    for (const c of counts) reporterCountById.set(c.story_id, c.n);
  }

  return rows.map((row) => {
    const { raw_findings, ...rest } = row;
    const story = hydrate(rest as StoryRow);
    const reports = reportsById.get(story.id) ?? [];
    const findings = parseFindings(raw_findings).filter((f) => f.action === "flag");
    return {
      ...story,
      findings,
      reports,
      reporter_count: reporterCountById.get(story.id) ?? 0,
      cause: findings.length && reports.length ? "both" : reports.length ? "reports" : "screening",
    };
  });
}

export function queueSize(): number {
  migrateModeration();
  return (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM stories s
         WHERE s.status = 'review'
            OR (s.status = 'published' AND EXISTS (SELECT 1 FROM reports r WHERE r.story_id = s.id))`,
      )
      .get() as { n: number }
  ).n;
}

/**
 * Applies a decision and records it.
 *
 * Approving also clears the reports, otherwise the story reappears in the queue
 * forever and the same reports get re-litigated on every pass. Removal keeps them:
 * they are the evidence for the decision.
 */
export function moderate(
  storyId: string,
  action: ModerationAction,
  note?: string | null,
): { ok: boolean; status?: string; error?: string } {
  // Enforced here, not only at the API route: moderate() is the one place every caller
  // (route, script, future admin tooling) goes through, and an unauditable removal is
  // indistinguishable from the censorship this log exists to rule out.
  if (action === "remove" && !note?.trim()) {
    return { ok: false, error: "Removals need a reason — it goes in the audit log." };
  }

  migrateModeration();
  const d = db();
  const row = d.prepare(`SELECT status FROM stories WHERE id = ?`).get(storyId) as
    | { status: string }
    | undefined;
  if (!row) return { ok: false, error: "No such story." };

  const to = action === "remove" ? "removed" : "published";
  if (row.status === to && action !== "approve") {
    return { ok: false, error: `Story is already ${to}.` };
  }

  const tx = d.transaction(() => {
    d.prepare(`UPDATE stories SET status = ? WHERE id = ?`).run(to, storyId);
    if (action === "approve" || action === "restore") {
      d.prepare(`DELETE FROM reports WHERE story_id = ?`).run(storyId);
    }
    d.prepare(
      `INSERT INTO moderation_log (story_id, action, note, from_status, to_status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(storyId, action, note ?? null, row.status, to);
  });
  tx();

  return { ok: true, status: to };
}

export type LogEntry = {
  id: number;
  story_id: string;
  action: string;
  note: string | null;
  from_status: string;
  to_status: string;
  created_at: string;
  headline: string;
  company_name: string;
};

export function recentDecisions(limit = 20): LogEntry[] {
  migrateModeration();
  return db()
    .prepare(
      `SELECT l.id, l.story_id, l.action, l.note, l.from_status, l.to_status, l.created_at,
              s.headline, c.name AS company_name
       FROM moderation_log l
       JOIN stories s ON s.id = l.story_id
       JOIN companies c ON c.id = s.company_id
       ORDER BY l.created_at DESC, l.id DESC LIMIT ?`,
    )
    .all(limit) as LogEntry[];
}
