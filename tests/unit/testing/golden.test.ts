/**
 * Unit tests for golden test utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { assertGolden, assertGoldenContains, assertGoldenMatches } from "../../helpers/golden.js";

const SNAPSHOT_DIR = join(process.cwd(), "tests", "golden", "snapshots");

test("assertGolden validates matching snapshot", () => {
  const snapshotName = "test-golden-match";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  // Golden helper writes formatted JSON with JSON.stringify(actual, null, 2)
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    JSON.stringify({ value: 42 }, null, 2),
    "utf8",
  );

  assertGolden(snapshotName, { value: 42 });
});

test("assertGolden throws on mismatch", () => {
  const snapshotName = "test-golden-mismatch";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    JSON.stringify({ value: 42 }, null, 2),
    "utf8",
  );

  assert.throws(
    () => assertGolden(snapshotName, { value: 99 }),
    /Golden snapshot mismatch/,
  );
});

test("assertGoldenContains validates substring match", () => {
  const snapshotName = "test-golden-contains";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    "The quick brown fox jumps over the lazy dog",
    "utf8",
  );

  assertGoldenContains(snapshotName, "quick brown");
});

test("assertGoldenContains throws on missing substring", () => {
  const snapshotName = "test-golden-contains-missing";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    "The quick brown fox",
    "utf8",
  );

  assert.throws(
    () => assertGoldenContains(snapshotName, "lazy dog"),
    /does not contain/,
  );
});

test("assertGoldenMatches validates regex pattern", () => {
  const snapshotName = "test-golden-matches";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    "ERROR: something failed at line 42",
    "utf8",
  );

  assertGoldenMatches(snapshotName, /ERROR:.*at line \d+/);
});

test("assertGoldenMatches throws on no match", () => {
  const snapshotName = "test-golden-matches-no";

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(
    join(SNAPSHOT_DIR, `${snapshotName}.golden`),
    "Success: all good",
    "utf8",
  );

  assert.throws(
    () => assertGoldenMatches(snapshotName, /ERROR:/),
    /does not match/,
  );
});