import { test } from "node:test";
import assert from "node:assert/strict";
import { looksAfterHours } from "../src/lib/receipts.ts";

test("the canonical 6:47pm quick call is after hours", () => {
  // Working hours end at 18:00, so 18:47 must flag. A 19:00 bound would miss exactly
  // the case this feature exists for.
  assert.equal(looksAfterHours("Friday 6:47 PM"), true);
});

test("evening and night times flag", () => {
  for (const label of ["Sunday 11:20 PM", "10:58 PM", "23:14", "18:30", "6:00 PM", "12:30 AM"]) {
    assert.equal(looksAfterHours(label), true, label);
  }
});

test("working-hours times do not flag", () => {
  for (const label of ["Monday 9:03 AM", "Tuesday 2:15 PM", "17:59", "7:00 AM", "12:00 PM"]) {
    assert.equal(looksAfterHours(label), false, label);
  }
});

test("early mornings flag", () => {
  assert.equal(looksAfterHours("Saturday 5:40 AM"), true);
  assert.equal(looksAfterHours("6:59 AM"), true);
});

test("weekend words flag with no time at all", () => {
  for (const label of ["Saturday", "Sunday afternoon", "over the weekend", "bank holiday Monday"]) {
    assert.equal(looksAfterHours(label), true, label);
  }
});

test("labels with no time signal do not flag", () => {
  for (const label of ["", "All-hands, Q2", "Annual review", "Break room noticeboard"]) {
    assert.equal(looksAfterHours(label), false, label);
  }
});

test("an invalid 12-hour clock value is not classified at all", () => {
  for (const label of ["18:99 pm", "13:00 pm", "0:30 am", "99 pm"]) {
    assert.equal(looksAfterHours(label), false, label);
  }
});

test("an invalid 24-hour clock value is not classified at all", () => {
  for (const label of ["25:00", "18:99", "23:61"]) {
    assert.equal(looksAfterHours(label), false, label);
  }
});

test("valid boundary clock values still classify correctly", () => {
  assert.equal(looksAfterHours("12:00 pm"), false);
  assert.equal(looksAfterHours("12:00 am"), true);
  assert.equal(looksAfterHours("23:59"), true);
  assert.equal(looksAfterHours("00:00"), true);
});
