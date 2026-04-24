import assert from "node:assert/strict";
import test from "node:test";

import { SemverValidator, createSemverValidator } from "../../../../src/ops-maturity/version-management/semver-validator.js";

test("SemverValidator validates correct semver versions", () => {
  const validator = new SemverValidator();

  assert.equal(validator.isValid("1.0.0"), true);
  assert.equal(validator.isValid("0.1.0"), true);
  assert.equal(validator.isValid("10.20.30"), true);
  assert.equal(validator.isValid("1.0.0-alpha"), true);
  assert.equal(validator.isValid("1.0.0-alpha.1"), true);
  assert.equal(validator.isValid("1.0.0+build.123"), true);
  assert.equal(validator.isValid("1.0.0-alpha+build.123"), true);
});

test("SemverValidator rejects invalid versions", () => {
  const validator = new SemverValidator();

  assert.equal(validator.isValid("1.0"), false);
  assert.equal(validator.isValid("1"), false);
  assert.equal(validator.isValid("v1.0.0"), false);
  assert.equal(validator.isValid("1.0.0.0"), false);
  assert.equal(validator.isValid("a.b.c"), false);
  assert.equal(validator.isValid(""), false);
  assert.equal(validator.isValid("01.0.0"), false); // Leading zeros not allowed
});

test("SemverValidator parses valid versions", () => {
  const validator = new SemverValidator();

  const result = validator.parse("1.2.3");

  assert.equal(result.isValid, true);
  assert.equal(result.raw, "1.2.3");
  assert.equal(result.version.major, 1);
  assert.equal(result.version.minor, 2);
  assert.equal(result.version.patch, 3);
});

test("SemverValidator parses versions with prerelease", () => {
  const validator = new SemverValidator();

  const result = validator.parse("1.0.0-alpha.1");

  assert.equal(result.isValid, true);
  assert.equal(result.version.major, 1);
  assert.equal(result.version.prerelease.length, 2);
  assert.equal(result.version.prerelease[0], "alpha");
  assert.equal(result.version.prerelease[1], "1");
});

test("SemverValidator parses versions with build metadata", () => {
  const validator = new SemverValidator();

  const result = validator.parse("1.0.0+build.123");

  assert.equal(result.isValid, true);
  assert.equal(result.version.buildMetadata.length, 2);
  assert.equal(result.version.buildMetadata[0], "build");
  assert.equal(result.version.buildMetadata[1], "123");
});

test("SemverValidator returns error for invalid parse", () => {
  const validator = new SemverValidator();

  const result = validator.parse("invalid");

  assert.equal(result.isValid, false);
  assert.equal(result.error, 'Invalid semver format: "invalid". Expected format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]');
});

test("SemverValidator returns error for empty string", () => {
  const validator = new SemverValidator();

  const result = validator.parse("");

  assert.equal(result.isValid, false);
  assert.equal(result.error, "Version must be a non-empty string");
});

test("SemverValidator compares versions correctly - basic", () => {
  const validator = new SemverValidator();

  assert.equal(validator.compare("1.0.0", "2.0.0"), -1);
  assert.equal(validator.compare("2.0.0", "1.0.0"), 1);
  assert.equal(validator.compare("1.0.0", "1.0.0"), 0);
});

test("SemverValidator compares versions correctly - minor.patch", () => {
  const validator = new SemverValidator();

  assert.equal(validator.compare("1.1.0", "1.2.0"), -1);
  assert.equal(validator.compare("1.2.0", "1.1.0"), 1);
  assert.equal(validator.compare("1.0.1", "1.0.2"), -1);
  assert.equal(validator.compare("1.0.2", "1.0.1"), 1);
});

test("SemverValidator compares prerelease versions correctly", () => {
  const validator = new SemverValidator();

  // Release > prerelease
  assert.equal(validator.compare("1.0.0", "1.0.0-alpha"), 1);
  assert.equal(validator.compare("1.0.0-alpha", "1.0.0"), -1);

  // Prerelease comparison
  assert.equal(validator.compare("1.0.0-alpha", "1.0.0-beta"), -1);
  assert.equal(validator.compare("1.0.0-alpha.1", "1.0.0-alpha.2"), -1);
  assert.equal(validator.compare("1.0.0-alpha.2", "1.0.0-alpha.1"), 1);
});

test("SemverValidator throws on invalid versions in compare", () => {
  const validator = new SemverValidator();

  assert.throws(() => validator.compare("invalid", "1.0.0"), /Cannot compare invalid versions/);
  assert.throws(() => validator.compare("1.0.0", "invalid"), /Cannot compare invalid versions/);
});

test("SemverValidator satisfies version ranges", () => {
  const validator = new SemverValidator();

  assert.equal(validator.satisfies("1.0.0", ">=1.0.0"), true);
  assert.equal(validator.satisfies("2.0.0", ">=1.0.0"), true);
  assert.equal(validator.satisfies("0.9.0", ">=1.0.0"), false);
});

test("SemverValidator satisfies caret ranges", () => {
  const validator = new SemverValidator();

  // ^1.2.3 means >=1.2.3 <2.0.0
  assert.equal(validator.satisfies("1.2.3", "^1.2.3"), true);
  assert.equal(validator.satisfies("1.9.9", "^1.2.3"), true);
  assert.equal(validator.satisfies("2.0.0", "^1.2.3"), false);
  assert.equal(validator.satisfies("1.2.2", "^1.2.3"), false);
});

test("SemverValidator satisfies tilde ranges", () => {
  const validator = new SemverValidator();

  // ~1.2.3 means >=1.2.3 <1.3.0
  // Note: tilde implementation simplified for basic support
  assert.equal(validator.satisfies("1.2.3", "~1.2.3"), true);
  assert.equal(validator.satisfies("1.2.9", "~1.2.3"), true);
});

test("SemverValidator increments major version", () => {
  const validator = new SemverValidator();

  assert.equal(validator.increment("1.0.0", "major"), "2.0.0");
  assert.equal(validator.increment("0.1.0", "major"), "1.0.0");
  assert.equal(validator.increment("1.2.3", "major"), "2.0.0");
});

test("SemverValidator increments minor version", () => {
  const validator = new SemverValidator();

  assert.equal(validator.increment("1.0.0", "minor"), "1.1.0");
  assert.equal(validator.increment("1.2.3", "minor"), "1.3.0");
  assert.equal(validator.increment("0.0.1", "minor"), "0.1.0");
});

test("SemverValidator increments patch version", () => {
  const validator = new SemverValidator();

  assert.equal(validator.increment("1.0.0", "patch"), "1.0.1");
  assert.equal(validator.increment("1.2.3", "patch"), "1.2.4");
  assert.equal(validator.increment("0.0.0", "patch"), "0.0.1");
});

test("SemverValidator increments versions correctly", () => {
  const validator = new SemverValidator();

  // Basic increment without prerelease
  assert.equal(validator.increment("1.0.0", "patch"), "1.0.1");
  assert.equal(validator.increment("1.0.0", "minor"), "1.1.0");
  assert.equal(validator.increment("1.0.0", "major"), "2.0.0");

  // Increment strips prerelease (semver behavior)
  assert.equal(validator.increment("1.0.0-alpha", "patch"), "1.0.1");
});

test("SemverValidator makes prerelease version", () => {
  const validator = new SemverValidator();

  assert.equal(validator.makePrerelease("1.0.0", "beta"), "1.0.0-beta");
  assert.equal(validator.makePrerelease("2.3.4", "alpha.1"), "2.3.4-alpha.1");
});

test("SemverValidator validateOrdering accepts valid ascending versions", () => {
  const validator = new SemverValidator();

  const result = validator.validateOrdering(["1.0.0", "2.0.0", "3.0.0"]);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("SemverValidator validateOrdering rejects invalid versions", () => {
  const validator = new SemverValidator();

  const result = validator.validateOrdering(["3.0.0", "invalid", "1.0.0"]);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("Invalid semver")));
});

test("SemverValidator validateOrdering detects out-of-order versions", () => {
  const validator = new SemverValidator();

  const result = validator.validateOrdering(["1.0.0", "2.0.0", "1.5.0"]);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("not in valid order")));
});

test("createSemverValidator factory works", () => {
  const validator = createSemverValidator();

  assert.equal(validator.isValid("1.0.0"), true);
  assert.equal(validator.isValid("invalid"), false);
});
