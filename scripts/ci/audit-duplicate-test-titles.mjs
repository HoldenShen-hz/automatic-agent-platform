#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["tests", "ui", "src"];
const BASELINE_PATH = "config/quality/duplicate-test-title-allowlist.json";
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".next", "coverage"]);
const TEST_TITLE_PATTERN = /(?:^|[^A-Za-z0-9_])(test|it)\s*(?:<[^>]+>)?\(\s*(["'`])([\s\S]*?)\2\s*,/gm;
const DEFAULT_HIGH_FREQUENCY_THRESHOLD = 5;

function walkFiles(root) {
  const files = [];

  const visit = (current) => {
    for (const entry of readdirSync(current).sort()) {
      if (SKIP_DIRECTORIES.has(entry)) {
        continue;
      }
      const path = join(current, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && TEST_FILE_PATTERN.test(path)) {
        files.push(path);
      }
    }
  };

  if (existsSync(root)) {
    visit(root);
  }
  return files;
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    return {
      version: 1,
      maximumDuplicateTitles: 0,
      maximumDuplicateInstances: 0,
      highFrequencyDuplicateThreshold: DEFAULT_HIGH_FREQUENCY_THRESHOLD,
      maximumHighFrequencyDuplicateTitles: 0,
      maximumHighFrequencyDuplicateInstances: 0,
    };
  }
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return {
    version: parsed.version ?? 1,
    maximumDuplicateTitles: Number(parsed.maximumDuplicateTitles ?? 0),
    maximumDuplicateInstances: Number(parsed.maximumDuplicateInstances ?? 0),
    highFrequencyDuplicateThreshold: Number(parsed.highFrequencyDuplicateThreshold ?? DEFAULT_HIGH_FREQUENCY_THRESHOLD),
    maximumHighFrequencyDuplicateTitles: Number(parsed.maximumHighFrequencyDuplicateTitles ?? 0),
    maximumHighFrequencyDuplicateInstances: Number(parsed.maximumHighFrequencyDuplicateInstances ?? 0),
  };
}

function normalizeTitle(rawTitle) {
  return rawTitle.replace(/\s+/g, " ").trim();
}

const titleMap = new Map();
const files = ROOTS.flatMap((root) => walkFiles(root));

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(TEST_TITLE_PATTERN)) {
    const title = normalizeTitle(match[3] ?? "");
    if (title.length === 0 || title.includes("${")) {
      continue;
    }
    const bucket = titleMap.get(title) ?? [];
    bucket.push(file);
    titleMap.set(title, bucket);
  }
}

const duplicates = [...titleMap.entries()]
  .map(([title, fileSet]) => ({
    title,
    files: [...fileSet].sort(),
  }))
  .filter((entry) => entry.files.length > 1)
  .sort((left, right) => right.files.length - left.files.length || left.title.localeCompare(right.title));

const baseline = readBaseline();
const duplicateInstances = duplicates.reduce((total, duplicate) => total + duplicate.files.length - 1, 0);
const highFrequencyDuplicates = duplicates.filter((entry) => entry.files.length >= baseline.highFrequencyDuplicateThreshold);
const highFrequencyDuplicateInstances = highFrequencyDuplicates.reduce(
  (total, duplicate) => total + duplicate.files.length,
  0,
);
const regressions = [];
if (duplicates.length > baseline.maximumDuplicateTitles) {
  regressions.push({
    metric: "maximumDuplicateTitles",
    actual: duplicates.length,
    allowed: baseline.maximumDuplicateTitles,
  });
}
if (duplicateInstances > baseline.maximumDuplicateInstances) {
  regressions.push({
    metric: "maximumDuplicateInstances",
    actual: duplicateInstances,
    allowed: baseline.maximumDuplicateInstances,
  });
}
if (highFrequencyDuplicates.length > baseline.maximumHighFrequencyDuplicateTitles) {
  regressions.push({
    metric: "maximumHighFrequencyDuplicateTitles",
    actual: highFrequencyDuplicates.length,
    allowed: baseline.maximumHighFrequencyDuplicateTitles,
  });
}
if (highFrequencyDuplicateInstances > baseline.maximumHighFrequencyDuplicateInstances) {
  regressions.push({
    metric: "maximumHighFrequencyDuplicateInstances",
    actual: highFrequencyDuplicateInstances,
    allowed: baseline.maximumHighFrequencyDuplicateInstances,
  });
}

const baselineReductions = [
  {
    metric: "maximumDuplicateTitles",
    actual: duplicates.length,
    allowed: baseline.maximumDuplicateTitles,
  },
  {
    metric: "maximumDuplicateInstances",
    actual: duplicateInstances,
    allowed: baseline.maximumDuplicateInstances,
  },
  {
    metric: "maximumHighFrequencyDuplicateTitles",
    actual: highFrequencyDuplicates.length,
    allowed: baseline.maximumHighFrequencyDuplicateTitles,
  },
  {
    metric: "maximumHighFrequencyDuplicateInstances",
    actual: highFrequencyDuplicateInstances,
    allowed: baseline.maximumHighFrequencyDuplicateInstances,
  },
].filter((entry) => entry.actual < entry.allowed);

const summary = {
  baselinePath: BASELINE_PATH,
  scannedFiles: files.length,
  duplicateCount: duplicates.length,
  duplicateInstances,
  highFrequencyDuplicateThreshold: baseline.highFrequencyDuplicateThreshold,
  highFrequencyDuplicateCount: highFrequencyDuplicates.length,
  highFrequencyDuplicateInstances,
  regressions,
  baselineReductions,
  largestDuplicates: duplicates.slice(0, 25),
  largestHighFrequencyDuplicates: highFrequencyDuplicates.slice(0, 25),
};

console.log(JSON.stringify(summary, null, 2));

if (regressions.length > 0) {
  console.error("duplicate test title audit failed");
  process.exit(1);
}
