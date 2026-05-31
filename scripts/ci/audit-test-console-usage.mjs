#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["tests", "ui/tests"];
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const ALLOWED_FILE_MARKERS = ["tests/performance/", "-perf.test.", "-performance.test.", "structured-logger-perf.test.ts"];
const ACTIVE_CONSOLE_PATTERN = /(^\s*console\.(?:log|warn)\()|(=>\s*console\.(?:log|warn)\()/gm;
const findings = [];

for (const root of ROOTS) {
  if (existsSync(root)) {
    walk(root);
  }
}

const summary = {
  roots: ROOTS,
  findingCount: findings.length,
  findings,
};

console.log(JSON.stringify(summary, null, 2));

if (findings.length > 0) {
  console.error("test console usage audit failed");
  process.exit(1);
}

function walk(directory) {
  for (const entry of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!stats.isFile() || !TEST_FILE_PATTERN.test(fullPath) || isAllowedFile(fullPath)) {
      continue;
    }
    scanFile(fullPath);
  }
}

function isAllowedFile(file) {
  return ALLOWED_FILE_MARKERS.some((marker) => file.includes(marker));
}

function scanFile(file) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(ACTIVE_CONSOLE_PATTERN)) {
    const index = match.index ?? 0;
    const line = source.slice(0, index).split("\n").length;
    findings.push({
      file,
      line,
      snippet: source.split("\n")[line - 1]?.trim() ?? "",
    });
  }
}
