#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  { path: "src", scope: "src" },
  { path: "tests", scope: "tests" },
  { path: "ui", scope: "ui" },
];

const SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".next", "coverage"]);
const BASELINE_PATH = "config/quality/type-suppression-baseline.json";
const TOKENS = [
  { name: "@ts-expect-error", pattern: /@ts-expect-error/g, commentOnlySafe: false },
  { name: "@ts-ignore", pattern: /@ts-ignore/g, commentOnlySafe: false },
  { name: "as unknown as", pattern: /\bas unknown as\b/g, commentOnlySafe: true },
  { name: "as any", pattern: /\bas any\b/g, commentOnlySafe: true },
];

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
      } else if (stat.isFile() && SOURCE_FILE_PATTERN.test(path)) {
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
    return { version: 1, scopeTokenMaximums: {} };
  }
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return {
    version: parsed.version ?? 1,
    scopeTokenMaximums: parsed.scopeTokenMaximums ?? {},
  };
}

function countMatches(line, pattern) {
  return [...line.matchAll(pattern)].length;
}

function isCommentOnlyLine(trimmed) {
  return /^(?:\/\/|\/\*|\*|\*\/)/.test(trimmed);
}

const scopeTokenCounts = new Map();
const fileCounts = new Map();

for (const root of ROOTS) {
  for (const file of walkFiles(root.path)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      for (const token of TOKENS) {
        if (token.commentOnlySafe && isCommentOnlyLine(trimmed)) {
          continue;
        }
        const matches = countMatches(trimmed, token.pattern);
        if (matches === 0) {
          continue;
        }
        const scopeKey = `${root.scope}::${token.name}`;
        const fileKey = `${file}::${token.name}`;
        scopeTokenCounts.set(scopeKey, (scopeTokenCounts.get(scopeKey) ?? 0) + matches);
        fileCounts.set(fileKey, (fileCounts.get(fileKey) ?? 0) + matches);
      }
    }
  }
}

const baseline = readBaseline();
const regressions = [...scopeTokenCounts.entries()]
  .map(([key, actual]) => ({
    key,
    actual,
    allowed: Number(baseline.scopeTokenMaximums[key] ?? 0),
  }))
  .filter((entry) => entry.actual > entry.allowed)
  .sort((left, right) => left.key.localeCompare(right.key));

const baselineReductions = Object.entries(baseline.scopeTokenMaximums)
  .map(([key, allowed]) => ({
    key,
    allowed: Number(allowed),
    actual: Number(scopeTokenCounts.get(key) ?? 0),
  }))
  .filter((entry) => entry.actual < entry.allowed)
  .sort((left, right) => left.key.localeCompare(right.key));

const largestFiles = [...fileCounts.entries()]
  .map(([key, count]) => {
    const delimiter = key.lastIndexOf("::");
    return {
      file: key.slice(0, delimiter),
      token: key.slice(delimiter + 2),
      count,
    };
  })
  .sort((left, right) => right.count - left.count || left.file.localeCompare(right.file))
  .slice(0, 25);

const summary = {
  baselinePath: BASELINE_PATH,
  scopeTokenCounts: Object.fromEntries([...scopeTokenCounts.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
  regressions,
  baselineReductions,
  largestFiles,
};

console.log(JSON.stringify(summary, null, 2));

if (regressions.length > 0) {
  console.error("type suppression baseline regression detected");
  process.exit(1);
}
