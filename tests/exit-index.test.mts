import { test } from "node:test";
import assert from "node:assert/strict";
import { exitIndex, MIN_STORIES_FOR_INDEX, slugify } from "../src/lib/db.ts";
import { REASONS, REASON_MAP } from "../src/lib/taxonomy.ts";

const weights = (codes: string[]) => codes.map((c) => REASON_MAP[c].weight);

test("withholds a score below the evidence threshold", () => {
  assert.equal(
    exitIndex({ storyCount: MIN_STORIES_FOR_INDEX - 1, avgSeverity: 5, warnRate: 1, reasonWeights: [1] }),
    null,
    "one furious post must never produce a published score",
  );
});

test("a company whose people leave for better offers scores near zero", () => {
  const index = exitIndex({
    storyCount: 10,
    avgSeverity: 1,
    warnRate: 0,
    reasonWeights: weights(Array(10).fill("better_offer")),
  });
  assert.equal(index, 0);
});

test("volume alone does not raise the score", () => {
  const few = exitIndex({
    storyCount: 3,
    avgSeverity: 1,
    warnRate: 0,
    reasonWeights: weights(["better_offer", "better_offer", "better_offer"]),
  });
  const many = exitIndex({
    storyCount: 300,
    avgSeverity: 1,
    warnRate: 0,
    reasonWeights: weights(Array(300).fill("better_offer")),
  });
  assert.equal(few, many, "300 healthy exits must not score worse than 3");
});

test("severe environment reasons produce a high score", () => {
  const index = exitIndex({
    storyCount: 8,
    avgSeverity: 5,
    warnRate: 1,
    reasonWeights: weights(["discrimination", "burnout", "disrespect", "bad_manager"]),
  });
  assert.ok(index !== null && index >= 90, `expected >= 90, got ${index}`);
});

test("stays inside 0-100 at both extremes", () => {
  const max = exitIndex({ storyCount: 5, avgSeverity: 5, warnRate: 1, reasonWeights: [1, 1, 1] });
  const min = exitIndex({ storyCount: 5, avgSeverity: 1, warnRate: 0, reasonWeights: [0, 0, 0] });
  assert.equal(max, 100);
  assert.equal(min, 0);
});

test("handles a company with no reasons recorded without throwing", () => {
  assert.equal(exitIndex({ storyCount: 5, avgSeverity: 1, warnRate: 0, reasonWeights: [] }), 0);
});

test("every taxonomy weight is within range and only healthy exits are zero", () => {
  for (const r of REASONS) {
    assert.ok(r.weight >= 0 && r.weight <= 1, `${r.code} weight out of range`);
    if (r.weight === 0) assert.equal(r.group, "neutral", `${r.code} scores zero but is not neutral`);
  }
});

test("slugify produces stable, URL-safe company keys", () => {
  assert.equal(slugify("Northwind Dynamics"), "northwind-dynamics");
  assert.equal(slugify("  Acme Logistics Ltd.  "), "acme-logistics-ltd");
  assert.equal(slugify("Café Group"), "cafe-group");
  assert.equal(slugify("A & B / C"), "a-b-c");
  // Same company typed two ways must collide onto one page rather than fragmenting.
  assert.equal(slugify("Halcyon Financial Services"), slugify("halcyon financial services"));
});
