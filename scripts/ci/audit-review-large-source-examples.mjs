#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASELINE_PATH = "config/quality/large-source-file-allowlist.json";
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);

if (!existsSync(BASELINE_PATH)) {
  throw new Error(`missing baseline: ${BASELINE_PATH}`);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const maximumLines = Number(baseline.maximumLines ?? 1000);
const trackedLargeSources = new Map(
  (baseline.trackedLargeSources ?? []).map((entry) => [entry.path, Number(entry.maxLines)]),
);

const actualLargeSources = walk("src")
  .map((path) => ({ path, lineCount: readFileSync(path, "utf8").split("\n").length }))
  .filter((entry) => entry.lineCount > maximumLines)
  .sort((left, right) => right.lineCount - left.lineCount || left.path.localeCompare(right.path));

const actualPaths = new Set(actualLargeSources.map((entry) => entry.path));
const failures = [];

for (const entry of actualLargeSources) {
  if (!trackedLargeSources.has(entry.path)) {
    failures.push({
      rule: "untracked-large-source",
      path: entry.path,
      lineCount: entry.lineCount,
    });
    continue;
  }
  const allowedLineCount = trackedLargeSources.get(entry.path);
  if (entry.lineCount > allowedLineCount) {
    failures.push({
      rule: "large-source-grew-without-baseline-update",
      path: entry.path,
      lineCount: entry.lineCount,
      allowedLineCount,
    });
  }
}

for (const [path] of trackedLargeSources) {
  if (!actualPaths.has(path)) {
    failures.push({
      rule: "baseline-entry-no-longer-large",
      path,
    });
  }
}

console.log(JSON.stringify({
  baselinePath: BASELINE_PATH,
  maximumLines,
  trackedCount: trackedLargeSources.size,
  actualCount: actualLargeSources.length,
  actualLargeSources,
  failures,
}, null, 2));

if (failures.length > 0) {
  console.error("review large source audit failed");
  process.exit(1);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (stats.isFile() && /\.(ts|tsx)$/.test(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}
