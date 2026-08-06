import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LINKEDOUT_DB = join(mkdtempSync(join(tmpdir(), "lo-social-")), "test.db");
process.env.LINKEDOUT_SALT = "test-salt";

const D = await import("../src/lib/db.ts");
const { screenShort } = await import("../src/lib/moderation.ts");

function makeStory(id: string) {
  const company = D.upsertCompany({ name: "Social Test Co" });
  D.insertStory({
    id,
    company_id: company.id,
    headline: `Story ${id}`,
    body: "A long enough body describing what happened at this job, written plainly and clearly.",
    role_family: "Engineering",
    seniority: "Mid",
    tenure_months: 12,
    reasons: ["burnout"],
    severity: 3,
    warn_friend: true,
    region: null,
    status: "published",
    findings: [],
    author_hash: D.anonHash(`author-${id}`),
  });
  return company;
}

before(() => {
  makeStory("social1");
  makeStory("social2");
});

test("screenShort passes ordinary short comments that would fail the full-length floor", () => {
  const r = screenShort({ label: "Comment", body: "Same thing happened to me at a different site." });
  assert.equal(r.ok, true);
  assert.deepEqual(r.findings, []);
});

test("screenShort still blocks a named individual in a short comment", () => {
  const r = screenShort({ label: "Comment", body: "My manager Karen still works there." });
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((f) => f.code === "named_individual"));
});

test("a comment appears under its story with a pseudonym, not a raw hash", () => {
  const id = D.insertComment({
    story_id: "social1",
    body: "Same here, different department.",
    status: "published",
    findings: [],
    author_hash: D.anonHash("commenter-1"),
  });
  const comments = D.getComments("social1");
  const posted = comments.find((c) => c.id === id);
  assert.ok(posted);
  assert.equal(posted.body, "Same here, different department.");
  assert.match(posted.pseudonym, /^[A-Za-z]+ [A-Za-z]+ #\d{4}$/);
});

test("a comment held for review does not appear in getComments", () => {
  const id = D.insertComment({
    story_id: "social1",
    body: "held comment",
    status: "review",
    findings: [{ action: "flag", code: "allegation", message: "x" }],
    author_hash: D.anonHash("commenter-2"),
  });
  assert.equal(D.getComments("social1").some((c) => c.id === id), false);
});

test("commentCounts batches counts for multiple stories in one call", () => {
  D.insertComment({
    story_id: "social2",
    body: "one comment on the second story",
    status: "published",
    findings: [],
    author_hash: D.anonHash("commenter-3"),
  });
  const counts = D.commentCounts(["social1", "social2", "does-not-exist"]);
  assert.equal(counts["social1"], 1);
  assert.equal(counts["social2"], 1);
  assert.equal(counts["does-not-exist"], undefined);
});

test("follow / unfollow / isFollowing round-trip", () => {
  const company = D.upsertCompany({ name: "Follow Test Co" });
  const follower = "follower-abc";
  assert.equal(D.isFollowing(follower, company.slug), false);

  assert.equal(D.follow(follower, company.slug).ok, true);
  assert.equal(D.isFollowing(follower, company.slug), true);

  D.unfollow(follower, company.slug);
  assert.equal(D.isFollowing(follower, company.slug), false);
});

test("isFollowing is false with no follower id, and false for an unknown company", () => {
  assert.equal(D.isFollowing(null, "social-test-co"), false);
  assert.equal(D.isFollowing("someone", "not-a-real-company"), false);
});

test("following twice is idempotent, not an error", () => {
  const company = D.upsertCompany({ name: "Idempotent Follow Co" });
  assert.equal(D.follow("f1", company.slug).ok, true);
  assert.equal(D.follow("f1", company.slug).ok, true);
  assert.equal(D.isFollowing("f1", company.slug), true);
});

test("newStoriesSinceFollow counts only stories published after the follow, not before", () => {
  const company = D.upsertCompany({ name: "Timeline Test Co" });
  const follower = "timeline-follower";

  const mkStoryAt = (id: string, createdAt: string) => {
    D.insertStory({
      id,
      company_id: company.id,
      headline: `Story ${id}`,
      body: "A long enough body describing what happened at this job, written plainly and clearly.",
      role_family: "Engineering",
      seniority: "Mid",
      tenure_months: 6,
      reasons: ["burnout"],
      severity: 3,
      warn_friend: true,
      region: null,
      status: "published",
      findings: [],
      author_hash: D.anonHash(`author-${id}`),
    });
    D.db().prepare(`UPDATE stories SET created_at = ? WHERE id = ?`).run(createdAt, id);
  };

  // Explicit timestamps, not wall-clock sequencing: real time moves in whole seconds
  // here, so "insert, follow, insert again" can tie instead of strictly ordering.
  mkStoryAt("before-follow", "2024-01-01 00:00:00");
  assert.equal(D.follow(follower, company.slug).ok, true);
  D.db()
    .prepare(`UPDATE follows SET created_at = ? WHERE follower_id = ?`)
    .run("2024-06-01 00:00:00", follower);

  assert.equal(
    D.newStoriesSinceFollow(follower, company.slug),
    0,
    "a story that existed before the follow is not 'new'",
  );

  mkStoryAt("after-follow", "2024-12-01 00:00:00");

  assert.equal(D.newStoriesSinceFollow(follower, company.slug), 1);
});

test("Story objects carry a pseudonym and never the raw author_hash", () => {
  const story = D.getStory("social1");
  assert.ok(story);
  assert.match(story.pseudonym, /^[A-Za-z]+ [A-Za-z]+ #\d{4}$/);
  assert.equal("author_hash" in story, false, "the raw hash must never reach callers of getStory");
});
