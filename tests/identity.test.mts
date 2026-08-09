import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarGradientFor, initialsFor, initialsFromPseudonym, pseudonymFor } from "../src/lib/identity.ts";

test("the same hash always gets the same pseudonym", () => {
  const a = pseudonymFor("abc123");
  const b = pseudonymFor("abc123");
  assert.equal(a, b);
});

test("different hashes usually get different pseudonyms", () => {
  const names = new Set(["h1", "h2", "h3", "h4", "h5"].map(pseudonymFor));
  assert.ok(names.size > 1, "five different hashes should not all collide");
});

test("a pseudonym has the expected shape: Mood Role #NNNN", () => {
  const name = pseudonymFor("some-author-hash");
  assert.match(name, /^[A-Za-z]+ [A-Za-z]+ #\d{4}$/);
});

test("initialsFor matches initialsFromPseudonym for the same hash", () => {
  const hash = "consistency-check";
  assert.equal(initialsFor(hash), initialsFromPseudonym(pseudonymFor(hash)));
});

test("initials are two uppercase letters", () => {
  const initials = initialsFor("any-hash-value");
  assert.match(initials, /^[A-Z]{2}$/);
});

test("avatarGradientFor is deterministic for the same pseudonym", () => {
  const name = pseudonymFor("gradient-check");
  assert.equal(avatarGradientFor(name), avatarGradientFor(name));
});

test("avatarGradientFor returns a two-stop CSS linear-gradient", () => {
  const gradient = avatarGradientFor("Weary Engineer #0001");
  assert.match(gradient, /^linear-gradient\(135deg, hsl\(\d+ 85% 55%\), hsl\(\d+ 85% 50%\)\)$/);
});
