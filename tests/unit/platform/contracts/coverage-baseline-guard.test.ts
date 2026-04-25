import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore - coverage-lib.mjs does not have type declarations
import { compareAgainstBaseline } from "../../../../scripts/ci/coverage-lib.mjs";

function createMetric(pct: number) {
  return { pct };
}

test("coverage baseline guard rejects missing global and directory thresholds", () => {
  const report = {
    generatedAt: "2026-04-24T00:00:00.000Z",
    global: {
      lines: createMetric(80),
      statements: createMetric(80),
      functions: createMetric(80),
      branches: createMetric(80),
    },
    directories: [
      {
        directory: "src/platform/example",
        metrics: {
          lines: createMetric(75),
          statements: createMetric(75),
          functions: createMetric(75),
          branches: createMetric(75),
        },
      },
    ],
  };
  const baseline = {
    minimums: {
      lines: null,
      statements: 80,
      functions: 80,
      branches: 80,
    },
    directories: {
      "src/platform/example": {
        metrics: {
          lines: null,
          statements: 75,
          functions: 75,
          branches: 75,
        },
      },
    },
  };

  const comparison = compareAgainstBaseline(report as never, baseline as never);

  assert.deepEqual(comparison.untrackedDirectories, []);
  assert.ok(comparison.failures.includes("global lines baseline is missing or invalid"));
  assert.ok(comparison.failures.includes("src/platform/example lines baseline is missing or invalid"));
});
