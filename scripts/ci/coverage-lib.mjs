import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const COVERAGE_DIR = path.join(REPO_ROOT, "coverage");
const COVERAGE_SUMMARY_PATH = path.join(COVERAGE_DIR, "coverage-summary.json");
const COVERAGE_DIRECTORY_SUMMARY_JSON_PATH = path.join(COVERAGE_DIR, "coverage-directory-summary.json");
const COVERAGE_DIRECTORY_SUMMARY_MD_PATH = path.join(COVERAGE_DIR, "coverage-directory-summary.md");
export const BASELINE_PATH = path.join(REPO_ROOT, ".coverage-baseline.json");

const METRIC_KEYS = ["lines", "statements", "functions", "branches"];
const ROUNDING_PRECISION = 10;
const COMPARISON_EPSILON = 0.05;

function roundMetric(value) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function emptyMetricTotals() {
  return {
    covered: 0,
    total: 0,
    skipped: 0,
    pct: 100,
  };
}

function cloneMetric(metric) {
  return {
    covered: metric.covered,
    total: metric.total,
    skipped: metric.skipped ?? 0,
    pct: roundMetric(metric.pct),
  };
}

function computePct(covered, total) {
  if (total === 0) {
    return 100;
  }

  return roundMetric((covered / total) * 100);
}

function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureCoverageDir() {
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
}

function toRepoRelativePath(filePath) {
  const relativePath = path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
  if (relativePath === "" || relativePath.startsWith("../")) {
    return null;
  }

  return relativePath;
}

function isExecutableCoverageEntry(entry) {
  return METRIC_KEYS.some((key) => (entry[key]?.total ?? 0) > 0);
}

function shouldIncludeFile(relativePath, entry) {
  return relativePath.startsWith("src/") && isExecutableCoverageEntry(entry);
}

function createDirectoryAccumulator(directory) {
  return {
    directory,
    fileCount: 0,
    metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, emptyMetricTotals()])),
  };
}

function finalizeDirectoryAccumulator(accumulator) {
  const metrics = Object.fromEntries(METRIC_KEYS.map((key) => {
    const metric = accumulator.metrics[key];
    return [key, {
      covered: metric.covered,
      total: metric.total,
      skipped: metric.skipped,
      pct: computePct(metric.covered, metric.total),
    }];
  }));

  return {
    directory: accumulator.directory,
    fileCount: accumulator.fileCount,
    metrics,
  };
}

export function loadCoverageSummary() {
  return readJsonFile(COVERAGE_SUMMARY_PATH);
}

export function buildCoverageReport(summary) {
  const directoryAccumulators = new Map();

  for (const [filePath, entry] of Object.entries(summary)) {
    if (filePath === "total") {
      continue;
    }

    const relativePath = toRepoRelativePath(filePath);
    if (relativePath == null || !shouldIncludeFile(relativePath, entry)) {
      continue;
    }

    const directory = path.posix.dirname(relativePath);
    const accumulator = directoryAccumulators.get(directory) ?? createDirectoryAccumulator(directory);
    accumulator.fileCount += 1;

    for (const key of METRIC_KEYS) {
      const metric = entry[key] ?? emptyMetricTotals();
      accumulator.metrics[key].covered += metric.covered ?? 0;
      accumulator.metrics[key].total += metric.total ?? 0;
      accumulator.metrics[key].skipped += metric.skipped ?? 0;
    }

    directoryAccumulators.set(directory, accumulator);
  }

  const directories = [...directoryAccumulators.values()]
    .map(finalizeDirectoryAccumulator)
    .sort((left, right) => {
      if (left.metrics.lines.pct !== right.metrics.lines.pct) {
        return left.metrics.lines.pct - right.metrics.lines.pct;
      }

      return left.directory.localeCompare(right.directory);
    });

  return {
    generatedAt: new Date().toISOString(),
    global: Object.fromEntries(METRIC_KEYS.map((key) => [key, cloneMetric(summary.total[key])])),
    directories,
  };
}

export function writeCoverageArtifacts(report) {
  ensureCoverageDir();
  writeJsonFile(COVERAGE_DIRECTORY_SUMMARY_JSON_PATH, report);

  const markdown = [
    "# Coverage Directory Summary",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "| Directory | Files | Lines | Statements | Functions | Branches |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.directories.map((directory) => [
      `| ${directory.directory}`,
      `${directory.fileCount}`,
      formatPct(directory.metrics.lines.pct),
      formatPct(directory.metrics.statements.pct),
      formatPct(directory.metrics.functions.pct),
      `${formatPct(directory.metrics.branches.pct)} |`,
    ].join(" | ")),
    "",
    "## Global",
    "",
    `- Lines: ${formatPct(report.global.lines.pct)}`,
    `- Statements: ${formatPct(report.global.statements.pct)}`,
    `- Functions: ${formatPct(report.global.functions.pct)}`,
    `- Branches: ${formatPct(report.global.branches.pct)}`,
    "",
  ].join("\n");

  fs.writeFileSync(COVERAGE_DIRECTORY_SUMMARY_MD_PATH, markdown);
}

export function buildBaseline(report) {
  return {
    version: 1,
    generatedAt: report.generatedAt,
    minimums: Object.fromEntries(METRIC_KEYS.map((key) => [key, report.global[key].pct])),
    global: Object.fromEntries(METRIC_KEYS.map((key) => [key, report.global[key].pct])),
    directories: Object.fromEntries(report.directories.map((directory) => [directory.directory, {
      fileCount: directory.fileCount,
      metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, directory.metrics[key].pct])),
    }])),
  };
}

export function writeBaseline(baseline) {
  writeJsonFile(BASELINE_PATH, baseline);
}

export function loadBaseline() {
  return readJsonFile(BASELINE_PATH);
}

function findDirectoryReport(report, directory) {
  return report.directories.find((entry) => entry.directory === directory) ?? null;
}

export function compareAgainstBaseline(report, baseline) {
  const failures = [];

  for (const key of METRIC_KEYS) {
    const current = report.global[key].pct;
    const minimum = baseline.minimums?.[key] ?? baseline.global?.[key];
    if (typeof minimum === "number" && current + COMPARISON_EPSILON < minimum) {
      failures.push(`global ${key} ${formatPct(current)} is below baseline ${formatPct(minimum)}`);
    }
  }

  for (const [directory, expected] of Object.entries(baseline.directories ?? {})) {
    const current = findDirectoryReport(report, directory);
    if (current == null) {
      continue;
    }

    for (const key of METRIC_KEYS) {
      const currentPct = current.metrics[key].pct;
      const expectedPct = expected.metrics?.[key];
      if (typeof expectedPct === "number" && currentPct + COMPARISON_EPSILON < expectedPct) {
        failures.push(`${directory} ${key} ${formatPct(currentPct)} is below baseline ${formatPct(expectedPct)}`);
      }
    }
  }

  const trackedDirectories = new Set(Object.keys(baseline.directories ?? {}));
  const untrackedDirectories = report.directories
    .map((directory) => directory.directory)
    .filter((directory) => !trackedDirectories.has(directory));

  return {
    failures,
    untrackedDirectories,
  };
}
