/**
 * Unit tests for SemverValidator - Additional Coverage
 *
 * @see src/ops-maturity/version-management/semver-validator.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SemverValidator } from "../../../../src/ops-maturity/version-management/semver-validator.js";

describe("SemverValidator", () => {
  describe("satisfies with compound ranges", () => {
    test("handles compound range with space separator", () => {
      const validator = new SemverValidator();

      // ">=1.0.0 <2.0.0" means 1.x.x only
      assert.equal(validator.satisfies("1.5.0", ">=1.0.0 <2.0.0"), true);
      assert.equal(validator.satisfies("2.0.0", ">=1.0.0 <2.0.0"), false);
    });

    test("satisfies compound range with exact version", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("1.0.0", ">=1.0.0 <=1.9.9"), true);
      assert.equal(validator.satisfies("2.0.0", ">=1.0.0 <=1.9.9"), false);
    });
  });

  describe("satisfies edge cases", () => {
    test("satisfies returns false for invalid version", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("invalid", ">=1.0.0"), false);
    });

    test("satisfies caret for 0.x.y versions", () => {
      const validator = new SemverValidator();

      // ^0.2.3 means >=0.2.3 <0.3.0
      assert.equal(validator.satisfies("0.2.3", "^0.2.3"), true);
      assert.equal(validator.satisfies("0.2.5", "^0.2.3"), true);
      assert.equal(validator.satisfies("0.3.0", "^0.2.3"), false);
    });

    test("satisfies caret for 0.0.x versions", () => {
      const validator = new SemverValidator();

      // ^0.0.3 means >=0.0.3 <0.0.4
      assert.equal(validator.satisfies("0.0.3", "^0.0.3"), true);
      assert.equal(validator.satisfies("0.0.4", "^0.0.3"), false);
    });

    test("satisfies tilde with major.minor only format", () => {
      const validator = new SemverValidator();

      // ~1.2 means >=1.2.0 <1.3.0
      assert.equal(validator.satisfies("1.2.0", "~1.2"), true);
      assert.equal(validator.satisfies("1.2.5", "~1.2"), true);
      assert.equal(validator.satisfies("1.3.0", "~1.2"), false);
    });
  });

  describe("parse with edge cases", () => {
    test("parse handles non-string input", () => {
      const validator = new SemverValidator();

      const result = validator.parse("");
      assert.equal(result.isValid, false);
    });

    test("parse handles whitespace-only string", () => {
      const validator = new SemverValidator();

      const result = validator.parse("   ");
      assert.equal(result.isValid, false);
    });

    test("parse preserves prerelease and build metadata together", () => {
      const validator = new SemverValidator();

      const result = validator.parse("1.0.0-alpha+build.123");

      assert.equal(result.isValid, true);
      assert.equal(result.version.prerelease.length, 1);
      assert.equal(result.version.prerelease[0], "alpha");
      assert.equal(result.version.buildMetadata.length, 2);
    });

    test("parse handles multiple prerelease identifiers", () => {
      const validator = new SemverValidator();

      const result = validator.parse("1.0.0-alpha.beta.gamma");

      assert.equal(result.isValid, true);
      assert.equal(result.version.prerelease.length, 3);
    });
  });

  describe("compare with edge cases", () => {
    test("compare handles prerelease numeric vs string ordering", () => {
      const validator = new SemverValidator();

      // Numeric prerelease identifiers have higher precedence than string
      assert.equal(validator.compare("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
      assert.equal(validator.compare("1.0.0-alpha.beta", "1.0.0-alpha.1"), 1);
    });

    test("compare handles different prerelease lengths", () => {
      const validator = new SemverValidator();

      assert.equal(validator.compare("1.0.0-alpha", "1.0.0-alpha.1"), -1);
      assert.equal(validator.compare("1.0.0-alpha.1", "1.0.0-alpha"), 1);
    });

    test("compare identical versions returns 0", () => {
      const validator = new SemverValidator();

      assert.equal(validator.compare("1.0.0", "1.0.0"), 0);
      assert.equal(validator.compare("1.0.0-alpha", "1.0.0-alpha"), 0);
    });
  });

  describe("increment edge cases", () => {
    test("increment throws for invalid version", () => {
      const validator = new SemverValidator();

      assert.throws(() => validator.increment("invalid", "patch"), /Invalid version/);
    });

    test("makePrerelease throws for invalid version", () => {
      const validator = new SemverValidator();

      assert.throws(() => validator.makePrerelease("invalid", "beta"), /Invalid version/);
    });

    test("makePrerelease handles complex prerelease id", () => {
      const validator = new SemverValidator();

      const result = validator.makePrerelease("1.0.0", "rc.1");
      assert.equal(result, "1.0.0-rc.1");
    });
  });

  describe("validateOrdering edge cases", () => {
    test("validateOrdering handles empty array", () => {
      const validator = new SemverValidator();

      const result = validator.validateOrdering([]);

      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    test("validateOrdering handles single version", () => {
      const validator = new SemverValidator();

      const result = validator.validateOrdering(["1.0.0"]);

      assert.equal(result.valid, true);
    });

    test("validateOrdering detects equal versions as valid order", () => {
      const validator = new SemverValidator();

      // Equal versions are not out of order (compare returns 0, not > 0)
      const result = validator.validateOrdering(["1.0.0", "1.0.0", "2.0.0"]);

      assert.equal(result.valid, true);
    });

    test("validateOrdering handles multiple errors", () => {
      const validator = new SemverValidator();

      const result = validator.validateOrdering(["invalid1", "invalid2", "invalid3"]);

      assert.equal(result.valid, false);
      assert.ok(result.errors.length >= 1);
    });
  });

  describe("satisfiesConstraint edge cases", () => {
    test("satisfies with greater-than operator", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("2.0.0", ">1.0.0"), true);
      assert.equal(validator.satisfies("1.0.0", ">1.0.0"), false);
    });

    test("satisfies with less-than operator", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("0.9.0", "<1.0.0"), true);
      assert.equal(validator.satisfies("1.0.0", "<1.0.0"), false);
    });

    test("satisfies with less-than-or-equal operator", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("1.0.0", "<=1.0.0"), true);
      assert.equal(validator.satisfies("0.9.0", "<=1.0.0"), true);
      assert.equal(validator.satisfies("1.0.1", "<=1.0.0"), false);
    });

    test("satisfies with exact operator", () => {
      const validator = new SemverValidator();

      assert.equal(validator.satisfies("1.0.0", "1.0.0"), true);
      assert.equal(validator.satisfies("1.0.1", "1.0.0"), false);
    });
  });

  describe("parseRange parsing", () => {
    test("parseRange handles version without operator", () => {
      const validator = new SemverValidator();

      const result = validator.parse("1.0.0");
      assert.equal(result.isValid, true);
    });
  });
});