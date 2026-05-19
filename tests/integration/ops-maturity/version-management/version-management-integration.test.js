/**
 * Integration Test: Version Management
 *
 * Tests semantic versioning and compatibility matrix:
 * - Semver parsing and validation
 * - Version comparison
 * - Range satisfaction (caret, tilde, compound)
 * - Version incrementing
 * - Compatibility matrix registration and checking
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createSemverValidator } from "../../../../src/ops-maturity/version-management/semver-validator.js";
import { VersionCompatibilityMatrix, createDefaultCompatibilityMatrix } from "../../../../src/ops-maturity/version-management/version-compatibility-matrix.js";
test("SemverValidator parses valid semver strings correctly", () => {
    const validator = createSemverValidator();
    const result = validator.parse("1.2.3");
    assert.equal(result.isValid, true);
    assert.ok(result.isValid);
    if (result.isValid) {
        assert.equal(result.version.major, 1);
        assert.equal(result.version.minor, 2);
        assert.equal(result.version.patch, 3);
        assert.deepEqual(result.version.prerelease, []);
        assert.deepEqual(result.version.buildMetadata, []);
    }
    const withPrerelease = validator.parse("1.0.0-alpha.1");
    assert.equal(withPrerelease.isValid, true);
    if (withPrerelease.isValid) {
        assert.deepEqual(withPrerelease.version.prerelease, ["alpha", "1"]);
    }
    const withBuild = validator.parse("1.0.0+build.123");
    assert.equal(withBuild.isValid, true);
    if (withBuild.isValid) {
        assert.deepEqual(withBuild.version.buildMetadata, ["build", "123"]);
    }
    const full = validator.parse("2.1.0-beta.1+build.456");
    assert.equal(full.isValid, true);
    if (full.isValid) {
        assert.equal(full.version.major, 2);
        assert.equal(full.version.minor, 1);
        assert.equal(full.version.patch, 0);
        assert.deepEqual(full.version.prerelease, ["beta", "1"]);
        assert.deepEqual(full.version.buildMetadata, ["build", "456"]);
    }
});
test("SemverValidator rejects invalid semver strings", () => {
    const validator = createSemverValidator();
    const invalidCases = [
        "",
        "1",
        "1.2",
        "1.2.3.4",
        "v1.2.3",
        "1.2.3.",
        ".1.2.3",
        "1..2.3",
        "a.b.c",
    ];
    for (const invalid of invalidCases) {
        const result = validator.parse(invalid);
        assert.equal(result.isValid, false, `Should reject: ${invalid}`);
    }
});
test("SemverValidator validates version strings", () => {
    const validator = createSemverValidator();
    assert.equal(validator.isValid("1.0.0"), true);
    assert.equal(validator.isValid("0.1.0"), true);
    assert.equal(validator.isValid("10.20.30"), true);
    assert.equal(validator.isValid("1.0.0-alpha"), true);
    assert.equal(validator.isValid("1.0.0+build"), true);
    assert.equal(validator.isValid(""), false);
    assert.equal(validator.isValid("1"), false);
    assert.equal(validator.isValid("v1.0.0"), false);
    assert.equal(validator.isValid("1.0"), false);
});
test("SemverValidator compares versions correctly", () => {
    const validator = createSemverValidator();
    assert.equal(validator.compare("1.0.0", "1.0.0"), 0);
    assert.equal(validator.compare("1.0.0", "2.0.0"), -1);
    assert.equal(validator.compare("2.0.0", "1.0.0"), 1);
    assert.equal(validator.compare("1.0.0", "1.1.0"), -1);
    assert.equal(validator.compare("1.1.0", "1.0.0"), 1);
    assert.equal(validator.compare("1.0.0", "1.0.1"), -1);
    assert.equal(validator.compare("1.0.1", "1.0.0"), 1);
    // Pre-release comparisons
    assert.equal(validator.compare("1.0.0-alpha", "1.0.0"), -1);
    assert.equal(validator.compare("1.0.0", "1.0.0-alpha"), 1);
    assert.equal(validator.compare("1.0.0-alpha", "1.0.0-beta"), -1);
    assert.equal(validator.compare("1.0.0-alpha.1", "1.0.0-alpha.2"), -1);
});
test("SemverValidator satisfies caret ranges", () => {
    const validator = createSemverValidator();
    // ^1.2.3 means >=1.2.3 <2.0.0
    assert.equal(validator.satisfies("1.2.3", "^1.2.3"), true);
    assert.equal(validator.satisfies("1.3.0", "^1.2.3"), true);
    assert.equal(validator.satisfies("1.9.9", "^1.2.3"), true);
    assert.equal(validator.satisfies("2.0.0", "^1.2.3"), false);
    assert.equal(validator.satisfies("1.2.2", "^1.2.3"), false);
    // ^0.2.3 means >=0.2.3 <0.3.0
    assert.equal(validator.satisfies("0.2.3", "^0.2.3"), true);
    assert.equal(validator.satisfies("0.2.10", "^0.2.3"), true);
    assert.equal(validator.satisfies("0.3.0", "^0.2.3"), false);
    // ^0.0.3 means >=0.0.3 <0.0.4
    assert.equal(validator.satisfies("0.0.3", "^0.0.3"), true);
    assert.equal(validator.satisfies("0.0.4", "^0.0.3"), false);
});
test("SemverValidator satisfies tilde ranges", () => {
    const validator = createSemverValidator();
    // ~1.2.3 means >=1.2.3 <1.3.0
    assert.equal(validator.satisfies("1.2.3", "~1.2.3"), true);
    assert.equal(validator.satisfies("1.2.10", "~1.2.3"), true);
    assert.equal(validator.satisfies("1.3.0", "~1.2.3"), false);
    // ~1.2 means >=1.2.0 <1.3.0
    assert.equal(validator.satisfies("1.2.0", "~1.2"), true);
    assert.equal(validator.satisfies("1.2.99", "~1.2"), true);
    assert.equal(validator.satisfies("1.3.0", "~1.2"), false);
});
test("SemverValidator satisfies comparison ranges", () => {
    const validator = createSemverValidator();
    assert.equal(validator.satisfies("2.0.0", ">=1.0.0"), true);
    assert.equal(validator.satisfies("0.5.0", ">=1.0.0"), false);
    assert.equal(validator.satisfies("2.0.0", ">1.0.0"), true);
    assert.equal(validator.satisfies("1.0.0", ">1.0.0"), false);
    assert.equal(validator.satisfies("0.5.0", "<1.0.0"), true);
    assert.equal(validator.satisfies("1.5.0", "<=1.0.0"), false);
    assert.equal(validator.satisfies("1.0.0", "<=1.0.0"), true);
});
test("SemverValidator increments versions correctly", () => {
    const validator = createSemverValidator();
    assert.equal(validator.increment("1.2.3", "major"), "2.0.0");
    assert.equal(validator.increment("1.2.3", "minor"), "1.3.0");
    assert.equal(validator.increment("1.2.3", "patch"), "1.2.4");
    assert.equal(validator.increment("0.1.0", "major"), "1.0.0");
    assert.equal(validator.increment("0.1.0", "minor"), "0.2.0");
    assert.equal(validator.increment("0.0.1", "patch"), "0.0.2");
    assert.throws(() => validator.increment("invalid", "patch"));
});
test("SemverValidator creates prerelease versions", () => {
    const validator = createSemverValidator();
    assert.equal(validator.makePrerelease("1.2.3", "alpha"), "1.2.3-alpha");
    assert.equal(validator.makePrerelease("1.2.3", "beta.1"), "1.2.3-beta.1");
    assert.equal(validator.makePrerelease("0.1.0", "rc.1"), "0.1.0-rc.1");
    assert.throws(() => validator.makePrerelease("invalid", "alpha"));
});
test("SemverValidator validates version ordering", () => {
    const validator = createSemverValidator();
    const validOrder = validator.validateOrdering(["1.0.0", "1.1.0", "2.0.0"]);
    assert.equal(validOrder.valid, true);
    assert.deepEqual(validOrder.errors, []);
    const invalidOrder = validator.validateOrdering(["2.0.0", "1.0.0"]);
    assert.equal(invalidOrder.valid, false);
    assert.ok(invalidOrder.errors.length > 0);
    const withInvalid = validator.validateOrdering(["1.0.0", "invalid", "2.0.0"]);
    assert.equal(withInvalid.valid, false);
});
test("VersionCompatibilityMatrix registers and retrieves entries", () => {
    const matrix = new VersionCompatibilityMatrix();
    matrix.register({
        sourcePackId: "pack-a",
        sourceVersion: "1.0.0",
        targetPackId: "pack-b",
        targetVersionRange: "^2.0.0",
        compatibilityLevel: "compatible",
        reason: "Test compatibility",
        deprecatedAt: null,
    });
    const entries = matrix.getEntriesForPack("pack-a");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.sourcePackId, "pack-a");
    assert.equal(entries[0]?.targetPackId, "pack-b");
});
test("VersionCompatibilityMatrix checks compatibility correctly", () => {
    const matrix = new VersionCompatibilityMatrix();
    matrix.register({
        sourcePackId: "pack-a",
        sourceVersion: "1.0.0",
        targetPackId: "pack-b",
        targetVersionRange: "^2.0.0",
        compatibilityLevel: "compatible",
        reason: "Compatible versions",
        deprecatedAt: null,
    });
    const result = matrix.checkCompatibility({ packId: "pack-a", version: "1.0.0" }, { packId: "pack-b", version: "2.0.0" });
    assert.equal(result.compatible, true);
    assert.equal(result.level, "compatible");
    assert.equal(result.sourcePackId, "pack-a");
    assert.equal(result.targetPackId, "pack-b");
});
test("VersionCompatibilityMatrix returns incompatible when no rule found in strict mode", () => {
    const matrix = new VersionCompatibilityMatrix({ strictMode: true });
    const result = matrix.checkCompatibility({ packId: "unknown-pack", version: "1.0.0" }, { packId: "another-pack", version: "2.0.0" });
    assert.equal(result.compatible, false);
    assert.equal(result.level, "incompatible");
});
test("VersionCompatibilityMatrix returns warning when no rule found in non-strict mode", () => {
    const matrix = new VersionCompatibilityMatrix({ strictMode: false });
    const result = matrix.checkCompatibility({ packId: "unknown-pack", version: "1.0.0" }, { packId: "another-pack", version: "2.0.0" });
    assert.equal(result.compatible, true);
    assert.equal(result.level, "warning");
});
test("VersionCompatibilityMatrix deprecates entries", () => {
    const matrix = new VersionCompatibilityMatrix();
    const entry = matrix.register({
        sourcePackId: "pack-x",
        sourceVersion: "1.0.0",
        targetPackId: "pack-y",
        targetVersionRange: "^1.0.0",
        compatibilityLevel: "compatible",
        reason: "Old compatibility",
        deprecatedAt: null,
    });
    const beforeDeprecate = matrix.getActiveEntries();
    assert.ok(beforeDeprecate.some(e => e.entryId === entry.entryId));
    const deprecated = matrix.deprecateEntry(entry.entryId);
    assert.equal(deprecated, true);
    const afterDeprecate = matrix.getActiveEntries();
    assert.ok(!afterDeprecate.some(e => e.entryId === entry.entryId));
});
test("VersionCompatibilityMatrix validates entries", () => {
    const matrix = new VersionCompatibilityMatrix();
    // Valid entry
    matrix.register({
        sourcePackId: "pack-valid",
        sourceVersion: "1.0.0",
        targetPackId: "pack-target",
        targetVersionRange: "^2.0.0",
        compatibilityLevel: "compatible",
        reason: "Valid",
        deprecatedAt: null,
    });
    const validResult = matrix.validateEntries();
    assert.equal(validResult.valid, true);
    assert.deepEqual(validResult.errors, []);
});
test("VersionCompatibilityMatrix provides summary statistics", () => {
    const matrix = new VersionCompatibilityMatrix();
    matrix.registerBatch([
        { sourcePackId: "pack-a", sourceVersion: "1.0.0", targetPackId: "pack-b", targetVersionRange: "^1.0.0", compatibilityLevel: "compatible", reason: "A", deprecatedAt: null },
        { sourcePackId: "pack-a", sourceVersion: "2.0.0", targetPackId: "pack-b", targetVersionRange: "^2.0.0", compatibilityLevel: "warning", reason: "B", deprecatedAt: null },
        { sourcePackId: "pack-x", sourceVersion: "1.0.0", targetPackId: "pack-y", targetVersionRange: "^1.0.0", compatibilityLevel: "incompatible", reason: "C", deprecatedAt: null },
    ]);
    const summary = matrix.getSummary();
    assert.equal(summary.totalEntries, 3);
    assert.equal(summary.activeEntries, 3);
    assert.equal(summary.deprecatedEntries, 0);
    assert.equal(summary.uniqueSourcePacks, 2);
    assert.equal(summary.uniqueTargetPacks, 2);
    assert.equal(summary.compatibilityBreakdown.compatible, 1);
    assert.equal(summary.compatibilityBreakdown.warning, 1);
    assert.equal(summary.compatibilityBreakdown.incompatible, 1);
});
test("VersionCompatibilityMatrix batch checks compatibility", () => {
    const matrix = new VersionCompatibilityMatrix();
    matrix.register({
        sourcePackId: "pack-a",
        sourceVersion: "1.0.0",
        targetPackId: "pack-b",
        targetVersionRange: "1.0.0",
        compatibilityLevel: "compatible",
        reason: "Direct match",
        deprecatedAt: null,
    });
    const packs = [
        { packId: "pack-a", version: "1.0.0" },
        { packId: "pack-b", version: "1.0.0" },
        { packId: "pack-c", version: "1.0.0" },
    ];
    const results = matrix.checkCompatibilityBatch(packs);
    // Should have 3 combinations: a-b, a-c, b-c
    assert.equal(results.length, 3);
});
test("VersionCompatibilityMatrix handles wildcard source versions", () => {
    const matrix = new VersionCompatibilityMatrix();
    matrix.register({
        sourcePackId: "pack-any",
        sourceVersion: "*",
        targetPackId: "pack-target",
        targetVersionRange: "^1.0.0",
        compatibilityLevel: "compatible",
        reason: "Wildcard source",
        deprecatedAt: null,
    });
    const result = matrix.checkCompatibility({ packId: "pack-any", version: "5.0.0" }, { packId: "pack-target", version: "1.2.0" });
    assert.equal(result.compatible, true);
    assert.equal(result.level, "compatible");
});
test("createDefaultCompatibilityMatrix creates a matrix instance", () => {
    const matrix = createDefaultCompatibilityMatrix();
    assert.ok(matrix instanceof VersionCompatibilityMatrix);
    // Should return empty matrix by default
    const summary = matrix.getSummary();
    assert.equal(summary.totalEntries, 0);
});
test("SemverValidator handles compound ranges", () => {
    const validator = createSemverValidator();
    // Version must satisfy both constraints
    assert.equal(validator.satisfies("1.5.0", ">=1.0.0 <2.0.0"), true);
    assert.equal(validator.satisfies("2.0.0", ">=1.0.0 <2.0.0"), false);
    assert.equal(validator.satisfies("0.9.0", ">=1.0.0 <2.0.0"), false);
});
test("SemverValidator throws on invalid version comparison", () => {
    const validator = createSemverValidator();
    assert.throws(() => validator.compare("invalid", "1.0.0"));
    assert.throws(() => validator.compare("1.0.0", "invalid"));
});
test("SemverValidator throws on invalid version increment", () => {
    const validator = createSemverValidator();
    assert.throws(() => validator.increment("invalid", "patch"));
});
test("SemverValidator handles zero major version correctly", () => {
    const validator = createSemverValidator();
    assert.equal(validator.isValid("0.1.0"), true);
    const result = validator.parse("0.1.0");
    assert.equal(result.isValid, true);
    if (result.isValid) {
        assert.equal(result.version.major, 0);
        assert.equal(result.version.minor, 1);
        assert.equal(result.version.patch, 0);
    }
});
//# sourceMappingURL=version-management-integration.test.js.map