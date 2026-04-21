import assert from "node:assert/strict";
import test from "node:test";

import { VersionCompatibilityMatrix, createDefaultCompatibilityMatrix } from "../../../../src/ops-maturity/version-management/version-compatibility-matrix.js";

test("VersionCompatibilityMatrix registers entry", () => {
  const matrix = new VersionCompatibilityMatrix();

  const entry = matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Test compatibility",
    deprecatedAt: null,
  });

  assert.ok(entry.entryId);
  assert.equal(entry.sourcePackId, "pack-a");
  assert.equal(entry.sourceVersion, "1.0.0");
  assert.equal(entry.targetPackId, "pack-b");
  assert.equal(entry.targetVersionRange, "^1.0.0");
});

test("VersionCompatibilityMatrix registers batch entries", () => {
  const matrix = new VersionCompatibilityMatrix();

  const entries = matrix.registerBatch([
    { sourcePackId: "pack-a", sourceVersion: "1.0.0", targetPackId: "pack-b", targetVersionRange: "^1.0.0", compatibilityLevel: "compatible", reason: "Test 1", deprecatedAt: null },
    { sourcePackId: "pack-a", sourceVersion: "1.0.0", targetPackId: "pack-c", targetVersionRange: "^2.0.0", compatibilityLevel: "warning", reason: "Test 2", deprecatedAt: null },
  ]);

  assert.equal(entries.length, 2);
  assert.ok(entries[0]!.entryId);
  assert.ok(entries[1]!.entryId);
});

test("VersionCompatibilityMatrix checks explicit compatibility", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "1.0.0",
    compatibilityLevel: "compatible",
    reason: "Direct compatible",
    deprecatedAt: null,
  });

  const result = matrix.checkCompatibility(
    { packId: "pack-a", version: "1.0.0" },
    { packId: "pack-b", version: "1.0.0" },
  );

  assert.equal(result.compatible, true);
  assert.equal(result.level, "compatible");
  assert.equal(result.reason, "Direct compatible");
});

test("VersionCompatibilityMatrix checks wildcard source compatibility", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "*",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "warning",
    reason: "Any version warning",
    deprecatedAt: null,
  });

  const result = matrix.checkCompatibility(
    { packId: "pack-a", version: "2.5.0" },
    { packId: "pack-b", version: "1.5.0" },
  );

  assert.equal(result.compatible, true);
  assert.equal(result.level, "warning");
});

test("VersionCompatibilityMatrix returns incompatible for incompatible pair", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "incompatible",
    reason: "Breaking change",
    deprecatedAt: null,
  });

  const result = matrix.checkCompatibility(
    { packId: "pack-a", version: "1.0.0" },
    { packId: "pack-b", version: "1.0.0" },
  );

  assert.equal(result.compatible, false);
  assert.equal(result.level, "incompatible");
});

test("VersionCompatibilityMatrix returns incompatible in strict mode when no rule found", () => {
  const matrix = new VersionCompatibilityMatrix({ strictMode: true });

  const result = matrix.checkCompatibility(
    { packId: "pack-a", version: "1.0.0" },
    { packId: "pack-b", version: "1.0.0" },
  );

  assert.equal(result.compatible, false);
  assert.equal(result.level, "incompatible");
});

test("VersionCompatibilityMatrix returns warning in non-strict mode when no rule found", () => {
  const matrix = new VersionCompatibilityMatrix({ strictMode: false });

  const result = matrix.checkCompatibility(
    { packId: "pack-a", version: "1.0.0" },
    { packId: "pack-b", version: "1.0.0" },
  );

  assert.equal(result.compatible, true);
  assert.equal(result.level, "warning");
});

test("VersionCompatibilityMatrix checks batch compatibility", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "1.0.0",
    compatibilityLevel: "compatible",
    reason: "A-B compatible",
    deprecatedAt: null,
  });

  matrix.register({
    sourcePackId: "pack-b",
    sourceVersion: "1.0.0",
    targetPackId: "pack-c",
    targetVersionRange: "1.0.0",
    compatibilityLevel: "incompatible",
    reason: "B-C incompatible",
    deprecatedAt: null,
  });

  const results = matrix.checkCompatibilityBatch([
    { packId: "pack-a", version: "1.0.0" },
    { packId: "pack-b", version: "1.0.0" },
    { packId: "pack-c", version: "1.0.0" },
  ]);

  assert.equal(results.length, 3); // 3 pairs: A-B, A-C, B-C
});

test("VersionCompatibilityMatrix gets entries for pack", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Test 1",
    deprecatedAt: null,
  });

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "2.0.0",
    targetPackId: "pack-c",
    targetVersionRange: "^2.0.0",
    compatibilityLevel: "compatible",
    reason: "Test 2",
    deprecatedAt: null,
  });

  const entries = matrix.getEntriesForPack("pack-a");

  assert.equal(entries.length, 2);
});

test("VersionCompatibilityMatrix gets active entries", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Active",
    deprecatedAt: null,
  });

  const entry = matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "2.0.0",
    targetPackId: "pack-c",
    targetVersionRange: "^2.0.0",
    compatibilityLevel: "compatible",
    reason: "Will deprecate",
    deprecatedAt: null,
  });

  matrix.deprecateEntry(entry.entryId);

  const active = matrix.getActiveEntries();

  assert.equal(active.length, 1);
  assert.equal(active[0].sourceVersion, "1.0.0");
});

test("VersionCompatibilityMatrix deprecates entry", () => {
  const matrix = new VersionCompatibilityMatrix();

  const entry = matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Test",
    deprecatedAt: null,
  });

  const result = matrix.deprecateEntry(entry.entryId);

  assert.equal(result, true);
  assert.ok(entry.deprecatedAt === null); // Original entry unchanged
  // The deprecation creates a new entry with deprecatedAt set
  const active = matrix.getActiveEntries();
  assert.equal(active.length, 0);
});

test("VersionCompatibilityMatrix returns false when deprecating non-existent entry", () => {
  const matrix = new VersionCompatibilityMatrix();

  const result = matrix.deprecateEntry("non-existent-id");

  assert.equal(result, false);
});

test("VersionCompatibilityMatrix gets summary", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Test 1",
    deprecatedAt: null,
  });

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "2.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^2.0.0",
    compatibilityLevel: "warning",
    reason: "Test 2",
    deprecatedAt: null,
  });

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "3.0.0",
    targetPackId: "pack-c",
    targetVersionRange: "^3.0.0",
    compatibilityLevel: "incompatible",
    reason: "Test 3",
    deprecatedAt: null,
  });

  const summary = matrix.getSummary();

  assert.equal(summary.totalEntries, 3);
  assert.equal(summary.activeEntries, 3);
  assert.equal(summary.deprecatedEntries, 0);
  assert.equal(summary.uniqueSourcePacks, 1);
  assert.equal(summary.uniqueTargetPacks, 2);
  assert.equal(summary.compatibilityBreakdown.compatible, 1);
  assert.equal(summary.compatibilityBreakdown.warning, 1);
  assert.equal(summary.compatibilityBreakdown.incompatible, 1);
});

test("VersionCompatibilityMatrix validates entries with valid versions", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Valid",
    deprecatedAt: null,
  });

  const result = matrix.validateEntries();

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("VersionCompatibilityMatrix validates entries with invalid source version", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "invalid",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Invalid source",
    deprecatedAt: null,
  });

  const result = matrix.validateEntries();

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("Invalid source version")));
});

test("createDefaultCompatibilityMatrix factory works", () => {
  const matrix = createDefaultCompatibilityMatrix();

  assert.ok(matrix);
  assert.equal(matrix.getSummary().totalEntries, 0);
});

test("VersionCompatibilityMatrix respects version range patterns", () => {
  const matrix = new VersionCompatibilityMatrix();

  matrix.register({
    sourcePackId: "pack-a",
    sourceVersion: "^1.0.0",
    targetPackId: "pack-b",
    targetVersionRange: "^1.0.0",
    compatibilityLevel: "compatible",
    reason: "Range pattern",
    deprecatedAt: null,
  });

  // Should match because 1.5.0 satisfies ^1.0.0
  const result1 = matrix.checkCompatibility(
    { packId: "pack-a", version: "1.5.0" },
    { packId: "pack-b", version: "1.5.0" },
  );
  assert.equal(result1.compatible, true);

  // Should not match because 2.0.0 does not satisfy ^1.0.0
  const result2 = matrix.checkCompatibility(
    { packId: "pack-a", version: "2.0.0" },
    { packId: "pack-b", version: "2.0.0" },
  );
  assert.equal(result2.compatible, false);
});

test("VersionCompatibilityMatrix returns entries for non-existent pack", () => {
  const matrix = new VersionCompatibilityMatrix();

  const entries = matrix.getEntriesForPack("non-existent");

  assert.equal(entries.length, 0);
});

test("VersionCompatibilityMatrix strict mode can be disabled", () => {
  const matrix = new VersionCompatibilityMatrix({ strictMode: false });

  const result = matrix.checkCompatibility(
    { packId: "pack-unknown", version: "1.0.0" },
    { packId: "pack-other", version: "1.0.0" },
  );

  // In non-strict mode without any rules, should return warning-compatible
  assert.equal(result.compatible, true);
  assert.equal(result.level, "warning");
});
