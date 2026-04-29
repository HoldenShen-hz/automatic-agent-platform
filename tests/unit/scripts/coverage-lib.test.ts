import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const { buildCoverageReport, buildBaseline, compareAgainstBaseline } = await import(
  "../../../scripts/ci/coverage-lib.mjs"
);

test("buildCoverageReport aggregates metrics by directory", () => {
  const summary = {
    total: {
      lines: { covered: 80, total: 100, pct: 80 },
      statements: { covered: 80, total: 100, pct: 80 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 20, total: 30, pct: 66.7 },
    },
    "src/platform/index.ts": {
      lines: { covered: 50, total: 60, pct: 83.3 },
      statements: { covered: 50, total: 60, pct: 83.3 },
      functions: { covered: 5, total: 5, pct: 100 },
      branches: { covered: 10, total: 15, pct: 66.7 },
    },
    "src/domains/index.ts": {
      lines: { covered: 30, total: 40, pct: 75 },
      statements: { covered: 30, total: 40, pct: 75 },
      functions: { covered: 5, total: 5, pct: 100 },
      branches: { covered: 10, total: 15, pct: 66.7 },
    },
    "tests/helper.ts": {
      lines: { covered: 100, total: 100, pct: 100 },
      statements: { covered: 100, total: 100, pct: 100 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 20, total: 20, pct: 100 },
    },
  };

  const report = buildCoverageReport(summary);

  assert.ok(report.global);
  assert.ok(report.directories.length >= 2);

  const platformDir = report.directories.find((d) => d.directory === "src/platform");
  assert.ok(platformDir, "src/platform should be in directories");
  assert.equal(platformDir.fileCount, 1);

  const domainsDir = report.directories.find((d) => d.directory === "src/domains");
  assert.ok(domainsDir, "src/domains should be in directories");
  assert.equal(domainsDir.fileCount, 1);
});

test("buildCoverageReport ignores files outside src/", () => {
  const summary = {
    total: {
      lines: { covered: 50, total: 100, pct: 50 },
      statements: { covered: 50, total: 100, pct: 50 },
      functions: { covered: 5, total: 10, pct: 50 },
      branches: { covered: 10, total: 20, pct: 50 },
    },
    "tests/helper.ts": {
      lines: { covered: 100, total: 100, pct: 100 },
      statements: { covered: 100, total: 100, pct: 100 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 20, total: 20, pct: 100 },
    },
    "src/core/index.ts": {
      lines: { covered: 50, total: 50, pct: 100 },
      statements: { covered: 50, total: 50, pct: 100 },
      functions: { covered: 5, total: 5, pct: 100 },
      branches: { covered: 10, total: 10, pct: 100 },
    },
  };

  const report = buildCoverageReport(summary);

  const srcCoreDir = report.directories.find((d) => d.directory === "src/core");
  assert.ok(srcCoreDir, "src/core should be included");
  const testDir = report.directories.find((d) => d.directory === "tests");
  assert.ok(!testDir, "tests should not be included");
});

test("buildBaseline creates valid baseline structure", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    global: {
      lines: { covered: 80, total: 100, pct: 80, skipped: 0 },
      statements: { covered: 80, total: 100, pct: 80, skipped: 0 },
      functions: { covered: 10, total: 10, pct: 100, skipped: 0 },
      branches: { covered: 20, total: 30, pct: 66.7, skipped: 0 },
    },
    directories: [
      {
        directory: "src/platform",
        fileCount: 2,
        metrics: {
          lines: { covered: 50, total: 60, pct: 83.3 },
          statements: { covered: 50, total: 60, pct: 83.3 },
          functions: { covered: 5, total: 5, pct: 100 },
          branches: { covered: 10, total: 15, pct: 66.7 },
        },
      },
    ],
  };

  const baseline = buildBaseline(report);

  assert.equal(baseline.version, 1);
  assert.ok(baseline.minimums);
  assert.ok(baseline.global);
  assert.ok(baseline.directories);
  assert.equal(baseline.directories["src/platform"].fileCount, 2);
});

test("compareAgainstBaseline detects missing coverage", () => {
  const report = {
    global: {
      lines: { covered: 80, total: 100, pct: 80 },
      statements: { covered: 80, total: 100, pct: 80 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 20, total: 30, pct: 66.7 },
    },
    directories: [
      {
        directory: "src/platform",
        fileCount: 1,
        metrics: {
          lines: { covered: 50, total: 60, pct: 83.3 },
          statements: { covered: 50, total: 60, pct: 83.3 },
          functions: { covered: 5, total: 5, pct: 100 },
          branches: { covered: 10, total: 15, pct: 66.7 },
        },
      },
    ],
  };

  const baseline = {
    minimums: { lines: 85, statements: 85, functions: 100, branches: 70 },
    global: { lines: 85, statements: 85, functions: 100, branches: 70 },
    directories: {
      "src/platform": {
        fileCount: 1,
        metrics: { lines: 90, statements: 90, functions: 100, branches: 75 },
      },
    },
  };

  const result = compareAgainstBaseline(report, baseline);

  assert.ok(result.failures.length > 0, "should have failures");
  assert.ok(result.failures.some((f) => f.includes("global lines")));
});

test("compareAgainstBaseline passes when coverage meets baseline", () => {
  const report = {
    global: {
      lines: { covered: 90, total: 100, pct: 90 },
      statements: { covered: 90, total: 100, pct: 90 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 25, total: 30, pct: 83.3 },
    },
    directories: [
      {
        directory: "src/platform",
        fileCount: 1,
        metrics: {
          lines: { covered: 55, total: 60, pct: 91.7 },
          statements: { covered: 55, total: 60, pct: 91.7 },
          functions: { covered: 5, total: 5, pct: 100 },
          branches: { covered: 14, total: 15, pct: 93.3 },
        },
      },
    ],
  };

  const baseline = {
    minimums: { lines: 85, statements: 85, functions: 100, branches: 70 },
    global: { lines: 85, statements: 85, functions: 100, branches: 70 },
    directories: {
      "src/platform": {
        fileCount: 1,
        metrics: { lines: 90, statements: 90, functions: 100, branches: 75 },
      },
    },
  };

  const result = compareAgainstBaseline(report, baseline);

  assert.ok(result.failures.length === 0, "should have no failures");
});

test("compareAgainstBaseline tracks untracked directories", () => {
  const report = {
    global: {
      lines: { covered: 90, total: 100, pct: 90 },
      statements: { covered: 90, total: 100, pct: 90 },
      functions: { covered: 10, total: 10, pct: 100 },
      branches: { covered: 25, total: 30, pct: 83.3 },
    },
    directories: [
      {
        directory: "src/new-directory",
        fileCount: 1,
        metrics: {
          lines: { covered: 50, total: 50, pct: 100 },
          statements: { covered: 50, total: 50, pct: 100 },
          functions: { covered: 5, total: 5, pct: 100 },
          branches: { covered: 10, total: 10, pct: 100 },
        },
      },
    ],
  };

  const baseline = {
    minimums: { lines: 80, statements: 80, functions: 100, branches: 70 },
    global: { lines: 80, statements: 80, functions: 100, branches: 70 },
    directories: {},
  };

  const result = compareAgainstBaseline(report, baseline);

  assert.ok(result.untrackedDirectories.includes("src/new-directory"));
});