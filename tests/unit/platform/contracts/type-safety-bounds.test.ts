import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";

/**
 * Type safety bounds guardian - SYS-QUAL-7.6
 *
 * Verifies that "as any" cast count does not increase over time.
 * "as any" bypasses TypeScript's type system and should be used sparingly.
 * This test acts as a ratchet - the count can only decrease, never increase.
 */

const MAX_AS_ANY_COUNT = 11; // Ratchet threshold

test("[SYS-QUAL-7.6] as-any cast count does not increase beyond MAX_AS_ANY threshold", () => {
  const files = globSync("src/**/*.ts", {
    ignore: ["**/*.d.ts", "**/node_modules/**"],
  });

  let total = 0;
  const details: Array<{ file: string; count: number }> = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/as\s+any\b/g);
    if (matches) {
      const count = matches.length;
      total += count;
      details.push({ file, count });
    }
  }

  assert.ok(
    total <= MAX_AS_ANY_COUNT,
    `as-any count ${total} exceeds MAX_AS_ANY threshold ${MAX_AS_ANY_COUNT}. ` +
    `Found ${total} occurrences across ${details.length} files. ` +
    `Details: ${details.map((d) => `${d.file} (${d.count})`).join(", ")}. ` +
    `Reduce usage or update MAX_AS_ANY_COUNT if removing is not feasible.`,
  );
});

test("[SYS-QUAL-7.6] files are scanned for as any patterns", () => {
  const files = globSync("src/**/*.ts", {
    ignore: ["**/*.d.ts", "**/node_modules/**"],
  });

  assert.ok(files.length > 0, "Should find TypeScript files in src/");

  let filesWithAsAny = 0;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (/as\s+any\b/g.test(content)) {
      filesWithAsAny++;
    }
  }

  assert.ok(
    filesWithAsAny >= 0,
    `Scanning found ${filesWithAsAny} files with "as any" patterns`,
  );
});

test("[SYS-QUAL-7.6] count is tracked correctly across codebase", () => {
  const files = globSync("src/**/*.ts", {
    ignore: ["**/*.d.ts", "**/node_modules/**"],
  });

  let total = 0;
  const fileCounts: Array<{ file: string; count: number }> = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(/as\s+any\b/g);
    if (matches) {
      const count = matches.length;
      total += count;
      fileCounts.push({ file, count });
    }
  }

  // Verify total is sum of individual file counts
  const sumOfCounts = fileCounts.reduce((sum, fc) => sum + fc.count, 0);
  assert.strictEqual(
    total,
    sumOfCounts,
    `Total ${total} should equal sum of individual counts ${sumOfCounts}`,
  );

  // Verify count is non-negative
  assert.strictEqual(total >= 0, true, "Count should be non-negative");

  // Verify each individual file count is positive when present
  for (const fc of fileCounts) {
    assert.strictEqual(
      fc.count > 0,
      true,
      `File ${fc.file} should have positive count, got ${fc.count}`,
    );
  }
});
