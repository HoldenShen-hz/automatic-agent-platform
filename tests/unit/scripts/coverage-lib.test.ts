import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

type CoverageMetric = {
  covered: number;
  total: number;
  pct: number;
  skipped?: number;
};

type CoverageMetricSet = {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
};

type CoverageDirectoryReport = {
  directory: string;
  fileCount: number;
  metrics: CoverageMetricSet;
};

type CoverageReport = {
  generatedAt?: string;
  global: CoverageMetricSet;
  directories: CoverageDirectoryReport[];
};

type CoverageBaseline = {
  version?: number;
  minimums: Record<keyof CoverageMetricSet, number>;
  global: Record<keyof CoverageMetricSet, number>;
  directories: Record<
    string,
    {
      fileCount: number;
      metrics: Record<keyof CoverageMetricSet, number>;
    }
  >;
};

type CoverageComparison = {
  failures: string[];
  untrackedDirectories: string[];
};

type CoverageLibModule = {
  buildCoverageReport: (summary: Record<string, CoverageMetricSet>) => CoverageReport;
  buildBaseline: (report: CoverageReport) => CoverageBaseline;
  compareAgainstBaseline: (report: CoverageReport, baseline: CoverageBaseline) => CoverageComparison;
  mergeCoverageSummaries: (
    summaries: Array<Record<string, CoverageMetricSet>>,
  ) => Record<string, CoverageMetricSet>;
};

type DivisionCoverageLibModule = {
  parseLimitedYaml: (raw: string, sourcePath?: string) => unknown;
  parseCliArgs: (argv: string[], options?: { cwd?: string }) => Record<string, string>;
  resolvePlatformRoot: (platformRoot?: string) => string;
};

const coverageLib = await import(
  new URL("../../../scripts/ci/coverage-lib.mjs", import.meta.url).href
) as CoverageLibModule;
const { buildCoverageReport, buildBaseline, compareAgainstBaseline, mergeCoverageSummaries } = coverageLib;
const divisionCoverageLib = await import(
  new URL("../../../scripts/ci/division-coverage-lib.mjs", import.meta.url).href
) as DivisionCoverageLibModule;
const { parseLimitedYaml, parseCliArgs, resolvePlatformRoot } = divisionCoverageLib;

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

test("buildCoverageReport normalizes dist/src coverage entries", () => {
  const summary = {
    total: {
      lines: { covered: 10, total: 20, pct: 50 },
      statements: { covered: 10, total: 20, pct: 50 },
      functions: { covered: 2, total: 4, pct: 50 },
      branches: { covered: 4, total: 8, pct: 50 },
    },
    [join(process.cwd(), "dist", "src", "platform", "index.js")]: {
      lines: { covered: 10, total: 20, pct: 50 },
      statements: { covered: 10, total: 20, pct: 50 },
      functions: { covered: 2, total: 4, pct: 50 },
      branches: { covered: 4, total: 8, pct: 50 },
    },
  };

  const report = buildCoverageReport(summary);
  const platformDir = report.directories.find((d) => d.directory === "src/platform");
  assert.ok(platformDir, "dist/src entries should be normalized to src/");
});

test("mergeCoverageSummaries aggregates per-layer totals and file metrics", () => {
  const merged = mergeCoverageSummaries([
    {
      total: {
        lines: { covered: 10, total: 20, pct: 50 },
        statements: { covered: 10, total: 20, pct: 50 },
        functions: { covered: 4, total: 8, pct: 50 },
        branches: { covered: 6, total: 12, pct: 50 },
      },
      "src/platform/index.ts": {
        lines: { covered: 10, total: 20, pct: 50 },
        statements: { covered: 10, total: 20, pct: 50 },
        functions: { covered: 4, total: 8, pct: 50 },
        branches: { covered: 6, total: 12, pct: 50 },
      },
    },
    {
      total: {
        lines: { covered: 15, total: 30, pct: 50 },
        statements: { covered: 15, total: 30, pct: 50 },
        functions: { covered: 6, total: 12, pct: 50 },
        branches: { covered: 8, total: 16, pct: 50 },
      },
      "src/platform/index.ts": {
        lines: { covered: 5, total: 10, pct: 50 },
        statements: { covered: 5, total: 10, pct: 50 },
        functions: { covered: 2, total: 4, pct: 50 },
        branches: { covered: 2, total: 4, pct: 50 },
      },
      "src/domains/index.ts": {
        lines: { covered: 10, total: 20, pct: 50 },
        statements: { covered: 10, total: 20, pct: 50 },
        functions: { covered: 4, total: 8, pct: 50 },
        branches: { covered: 6, total: 12, pct: 50 },
      },
    },
  ]);

  assert.equal(merged.total.lines.covered, 25);
  assert.equal(merged.total.lines.total, 50);
  assert.equal(merged["src/platform/index.ts"]!.functions.covered, 6);
  assert.equal(merged["src/platform/index.ts"]!.functions.total, 12);
  assert.equal(merged["src/domains/index.ts"]!.branches.covered, 6);
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
  assert.equal(baseline.directories["src/platform"]!.fileCount, 2);
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

test("parseLimitedYaml accepts quoted scalars containing colons", () => {
  const parsed = parseLimitedYaml([
    "divisionId: coding",
    "notes: \"contains: colon and path /tmp/example\"",
    "toolActions:",
    "  - toolId: github",
    "    actionId: create_pr_draft",
  ].join("\n"), "inline.yaml") as {
    notes?: string;
    toolActions?: Array<{ actionId?: string }>;
  };

  assert.equal(parsed.notes, "contains: colon and path /tmp/example");
  assert.equal(parsed.toolActions?.[0]?.actionId, "create_pr_draft");
});

test("parseCliArgs rejects unknown flags and roots escaping the working tree", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-division-coverage-cli-"));
  try {
    assert.throws(
      () => parseCliArgs(["--unsupported=true"], { cwd: workspace }),
      /division_coverage\.unknown_flag/,
    );
    assert.throws(
      () => parseCliArgs(["--root=../../etc"], { cwd: join(workspace, "nested") }),
      /division_coverage\.invalid_root/,
    );
    const parsed = parseCliArgs(["--root=subdir", "--mode=warning"], { cwd: workspace });
    assert.equal(parsed.root, join(workspace, "subdir"));
    assert.equal(parsed.mode, "warning");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolvePlatformRoot defaults to the repository root instead of process.cwd", () => {
  assert.equal(resolvePlatformRoot(), process.cwd());
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

test("compareAgainstBaseline tolerates up to 0.5pt rounded drift between equivalent runs", () => {
  const report = {
    global: {
      lines: { covered: 895, total: 1000, pct: 89.5 },
      statements: { covered: 895, total: 1000, pct: 89.5 },
      functions: { covered: 90, total: 100, pct: 90 },
      branches: { covered: 833, total: 1000, pct: 83.3 },
    },
    directories: [
      {
        directory: "src/platform",
        fileCount: 1,
        metrics: {
          lines: { covered: 825, total: 1000, pct: 82.5 },
          statements: { covered: 825, total: 1000, pct: 82.5 },
          functions: { covered: 917, total: 1000, pct: 91.7 },
          branches: { covered: 867, total: 1000, pct: 86.7 },
        },
      },
    ],
  };

  const baseline = {
    minimums: { lines: 90, statements: 90, functions: 90, branches: 83.3 },
    global: { lines: 90, statements: 90, functions: 90, branches: 83.3 },
    directories: {
      "src/platform": {
        fileCount: 1,
        metrics: { lines: 83.0, statements: 83.0, functions: 91.7, branches: 86.9 },
      },
    },
  };

  const result = compareAgainstBaseline(report, baseline);

  assert.deepEqual(result.failures, []);
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
