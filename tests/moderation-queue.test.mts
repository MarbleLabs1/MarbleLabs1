import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point at a throwaway database before anything opens the real one.
process.env.LINKEDOUT_DB = join(mkdtempSync(join(tmpdir(), "lo-mod-")), "test.db");
process.env.LINKEDOUT_SALT = "test-salt";

const D = await import("../src/lib/db.ts");

function makeStory(id: string, status: string, findings: unknown = []) {
  const company = D.upsertCompany({ name: "Queue Test Co" });
  D.insertStory({
    id,
    company_id: company.id,
    headline: `Story ${id}`,
    body: "A long enough body describing what happened at this job, written plainly.",
    role_family: "Engineering",
    seniority: "Mid",
    tenure_months: 12,
    reasons: ["burnout"],
    severity: 3,
    warn_friend: true,
    region: null,
    status,
    findings,
    author_hash: D.anonHash(`author-${id}`),
  });
}

before(() => {
  D.migrateReceipts();
  D.migrateModeration();
});

test("a clean published story is not in the queue", () => {
  makeStory("clean1", "published");
  assert.equal(
    D.listQueue().some((q) => q.id === "clean1"),
    false,
  );
});

test("a story held by screening appears, with its findings", () => {
  makeStory("held1", "review", [
    { action: "flag", code: "allegation", message: "fraud is an allegation", excerpt: "fraud" },
    { action: "block", code: "email", message: "should not be shown to a moderator" },
  ]);
  const item = D.listQueue().find((q) => q.id === "held1");
  assert.ok(item, "held story missing from queue");
  assert.equal(item.cause, "screening");
  // Only flags matter here: a block means the post never got written in the first place.
  assert.equal(item.findings.length, 1);
  assert.equal(item.findings[0].code, "allegation");
});

test("a reported published story appears with its reports", () => {
  makeStory("reported1", "published");
  D.addReport({ storyId: "reported1", reason: "spam", detail: "obvious spam", reporterHash: "r1" });
  D.addReport({ storyId: "reported1", reason: "harassment", detail: null, reporterHash: "r2" });
  const item = D.listQueue().find((q) => q.id === "reported1");
  assert.ok(item);
  assert.equal(item.cause, "reports");
  assert.equal(item.reports.length, 2);
  assert.equal(item.reporter_count, 2);
});

test("three distinct reporters auto-hide a story, and it lands in the queue", () => {
  makeStory("mobbed1", "published");
  for (const r of ["a", "b"]) {
    assert.equal(D.addReport({ storyId: "mobbed1", reason: "spam", reporterHash: r }).hidden, false);
  }
  assert.equal(D.addReport({ storyId: "mobbed1", reason: "spam", reporterHash: "c" }).hidden, true);
  assert.equal(D.getStory("mobbed1")?.status, "review");
  assert.ok(D.listQueue().some((q) => q.id === "mobbed1"));
});

test("the same person reporting repeatedly does not hide anything", () => {
  makeStory("solo1", "published");
  for (let i = 0; i < 6; i++) {
    D.addReport({ storyId: "solo1", reason: "spam", reporterHash: "same-person" });
  }
  assert.equal(D.getStory("solo1")?.status, "published", "one person must not be able to hide a story");
});

test("approving publishes, clears the reports, and leaves the queue", () => {
  makeStory("approve1", "review", [{ action: "flag", code: "allegation", message: "flagged" }]);
  D.addReport({ storyId: "approve1", reason: "spam", reporterHash: "r9" });

  const result = D.moderate("approve1", "approve", "read it, it is a first-hand account");
  assert.equal(result.ok, true);
  assert.equal(result.status, "published");
  assert.equal(D.getStory("approve1")?.status, "published");
  assert.equal(D.getReports("approve1").length, 0, "stale reports would requeue it forever");
  assert.equal(
    D.listQueue().some((q) => q.id === "approve1"),
    false,
  );
});

test("removing hides the story, keeps the reports as evidence, and is logged", () => {
  makeStory("remove1", "review");
  D.addReport({ storyId: "remove1", reason: "names_individual", reporterHash: "r10" });

  assert.equal(D.moderate("remove1", "remove", "names a manager by first name").ok, true);
  assert.equal(D.getStory("remove1")?.status, "removed");
  assert.equal(D.getReports("remove1").length, 1, "reports justify the removal, keep them");

  const entry = D.recentDecisions(50).find((l) => l.story_id === "remove1");
  assert.ok(entry, "removal was not logged");
  assert.equal(entry.action, "remove");
  assert.equal(entry.from_status, "review");
  assert.equal(entry.to_status, "removed");
  assert.equal(entry.note, "names a manager by first name");
});

test("a removed story stays out of the public feed", () => {
  assert.equal(
    D.listStories({ limit: 100 }).some((s) => s.id === "remove1"),
    false,
  );
});

test("moderating an unknown story fails instead of inventing one", () => {
  const result = D.moderate("does-not-exist", "approve");
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /No such story/);
});

test("every decision is recorded, in order, newest first", () => {
  const log = D.recentDecisions(50);
  assert.ok(log.length >= 2);
  const ids = log.map((l) => l.story_id);
  assert.ok(ids.indexOf("remove1") < ids.indexOf("approve1"), "log should be newest first");
});
