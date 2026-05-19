/**
 * Golden Test Utilities
 *
 * Provides assertGolden() for snapshot assertion and supports UPDATE_GOLDEN=1
 * environment variable to regenerate snapshots.
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SNAPSHOTS_DIR = join(process.cwd(), "tests", "golden", "snapshots");
const UPDATE_MODE = process.env.UPDATE_GOLDEN === "1";

function stringifyGoldenValue(actual: unknown): string {
  return typeof actual === "string" ? actual : JSON.stringify(actual, null, 2);
}

/**
 * Assert that actual output matches the stored golden snapshot.
 *
 * Usage:
 * ```typescript
 * test("output matches golden", () => {
 *   const result = computeSomething();
 *   assertGolden("compute-something-v1", result);
 * });
 * ```
 *
 * To update snapshots:
 * ```bash
 * UPDATE_GOLDEN=1 npm run test:golden
 * ```
 */
export function assertGolden(snapshotName: string, actual: unknown): void {
  // Ensure snapshots directory exists
  if (UPDATE_MODE) {
    mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  const snapshotPath = join(SNAPSHOTS_DIR, `${snapshotName}.golden`);
  const actualJson = stringifyGoldenValue(actual);

  if (UPDATE_MODE) {
    writeFileSync(snapshotPath, actualJson, "utf-8");
    return;
  }

  // Read and compare snapshot
  const expected = readFileSync(snapshotPath, "utf-8").replace(/\n$/, "");
  assert.equal(
    actualJson,
    expected,
    `Golden snapshot mismatch for "${snapshotName}". ` +
    `Run UPDATE_GOLDEN=1 to update snapshots.`,
  );
}

/**
 * Assert that actual output matches a substring of the golden snapshot.
 * Useful when the snapshot contains partial content.
 */
export function assertGoldenContains(snapshotName: string, actual: string): void {
  assert.notEqual(actual.trim(), "", `Golden substring assertion for "${snapshotName}" requires non-empty actual content.`);
  const snapshotPath = join(SNAPSHOTS_DIR, `${snapshotName}.golden`);
  const expected = readFileSync(snapshotPath, "utf-8");
  assert.ok(
    expected.includes(actual),
    `Golden snapshot "${snapshotName}" does not contain expected content.\n` +
    `Expected to contain: ${actual}\n` +
    `Snapshot: ${expected}`,
  );
}

/**
 * Assert that actual output matches a regex pattern in the golden snapshot.
 */
export function assertGoldenMatches(snapshotName: string, actual: string, pattern: RegExp): void {
  const snapshotPath = join(SNAPSHOTS_DIR, `${snapshotName}.golden`);
  const expected = readFileSync(snapshotPath, "utf-8").replace(/\n$/, "");
  assert.equal(
    actual,
    expected,
    `Golden snapshot mismatch for "${snapshotName}" before regex assertion. ` +
    `Run UPDATE_GOLDEN=1 to update snapshots.`,
  );
  assert.ok(
    pattern.test(actual),
    `Golden snapshot "${snapshotName}" does not match pattern ${pattern}. Snapshot: ${actual}`,
  );
}
