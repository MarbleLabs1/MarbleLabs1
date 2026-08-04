import { test } from "node:test";
import assert from "node:assert/strict";
import { redactContactDetails, screen } from "../src/lib/moderation.ts";

const LONG =
  "I was hired to run a team and the team was reassigned in my third week without anyone " +
  "telling me, and I found out by noticing the calendars had changed. I raised it four times.";

function codes(input: { headline: string; body: string }) {
  return screen(input).findings.map((f) => `${f.action}:${f.code}`);
}

test("a clean story passes", () => {
  const result = screen({ headline: "Reassigned without being told", body: LONG });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("blocks a named individual after a role word", () => {
  for (const body of [
    `My manager Dave told me to stay flexible. ${LONG}`,
    `Our CEO Karen Smith announced it at an all-hands. ${LONG}`,
    `The director was Susan and she said nothing. ${LONG}`,
  ]) {
    assert.ok(
      codes({ headline: "Summary line here", body }).includes("block:named_individual"),
      `expected a block for: ${body.slice(0, 40)}`,
    );
  }
});

test("does not block ordinary role-only writing", () => {
  const body = `My manager told me to stay flexible. A director asked HR to review it. ${LONG}`;
  assert.equal(screen({ headline: "Role words only", body }).ok, true);
});

test("blocks every kind of contact detail", () => {
  const cases: [string, string][] = [
    ["email", `Reach me at someone@example.com. ${LONG}`],
    ["phone", `Call 07700 900123 if you want detail. ${LONG}`],
    ["link", `Full thread at https://example.com/thread. ${LONG}`],
    ["handle", `I posted it as @someuser earlier. ${LONG}`],
  ];
  for (const [code, body] of cases) {
    assert.ok(
      codes({ headline: "Summary line here", body }).includes(`block:${code}`),
      `expected block:${code}`,
    );
  }
});

test("flags but does not block allegations of unlawful conduct", () => {
  const result = screen({
    headline: "Asked to move numbers at month end",
    body: `I believe what I was asked to do was fraud. ${LONG}`,
  });
  assert.equal(result.ok, true, "allegations publish to review, they are not rejected");
  assert.ok(result.findings.some((f) => f.action === "flag" && f.code === "allegation"));
});

test("enforces length bounds", () => {
  assert.ok(codes({ headline: "Long enough headline", body: "Too short." }).includes("block:too_short"));
  assert.ok(codes({ headline: "", body: LONG }).includes("block:no_headline"));
  assert.ok(codes({ headline: "x".repeat(200), body: LONG }).includes("block:headline_long"));
});

test("flags shouting", () => {
  const result = screen({ headline: "All caps story", body: LONG.toUpperCase() });
  assert.ok(result.findings.some((f) => f.code === "shouting"));
});

test("redaction leaves a visible marker and keeps the rest of the text", () => {
  const out = redactContactDetails("Mail me at a@b.com or see https://x.com/y or call 07700900123");
  assert.match(out, /\[email removed\]/);
  assert.match(out, /\[link removed\]/);
  assert.match(out, /\[number removed\]/);
  assert.doesNotMatch(out, /a@b\.com/);
});

test("redaction does not eat short numbers like tenure or headcount", () => {
  const out = redactContactDetails("I stayed 18 months on a team of 6 out of 11 people.");
  assert.equal(out, "I stayed 18 months on a team of 6 out of 11 people.");
});

test("does not mistake a weekday or a team name for a person", () => {
  for (const body of [
    `I told my manager Monday morning and nothing happened. ${LONG}`,
    `The director of Engineering was copied in. ${LONG}`,
    `My manager Slack messaged me about it that evening. ${LONG}`,
  ]) {
    assert.equal(screen({ headline: "Summary line here", body }).ok, true, body.slice(0, 45));
  }
});

test("catches names regardless of how the role word is capitalised", () => {
  for (const body of [
    `Our CEO Karen announced it. ${LONG}`,
    `our ceo Karen announced it. ${LONG}`,
    `My Manager Dave told me. ${LONG}`,
  ]) {
    assert.ok(codes({ headline: "Summary line here", body }).includes("block:named_individual"), body.slice(0, 40));
  }
});
