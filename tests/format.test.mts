import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeTime } from "../src/lib/format.ts";

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString().slice(0, 19).replace("T", " ");
}

test("60 seconds ago reads as minutes, not seconds", () => {
  // The unit table used to divide by the current threshold but label it with the
  // *previous* unit's suffix, so a value right at a boundary rendered one step small.
  assert.equal(relativeTime(ago(60_000)), "1m ago");
});

test("one hour ago reads as hours", () => {
  assert.equal(relativeTime(ago(3_600_000)), "1h ago");
});

test("one day ago reads as days, not hours", () => {
  assert.equal(relativeTime(ago(86_400_000)), "1d ago");
});

test("one month ago reads as months", () => {
  assert.equal(relativeTime(ago(2_592_000_000)), "1mo ago");
});

test("one year ago reads as years", () => {
  assert.equal(relativeTime(ago(31_536_000_000)), "1y ago");
});

test("under a minute reads as just now", () => {
  assert.equal(relativeTime(ago(30_000)), "just now");
});
