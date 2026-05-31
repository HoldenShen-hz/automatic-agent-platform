#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["tests", "ui/tests"];
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);
const MIN_DELAY_MS = 50;
const ALLOWED_FILE_PATTERNS = [
  /\/performance\//,
  /\/timeout\.test\.ts$/,
  /\/calculate-backoff\.test\.ts$/,
  /\/runtime\/graceful-shutdown\.test\.ts$/,
  /\/startup\/graceful-shutdown\.test\.ts$/,
  /\/plugin-executor(?:\.service)?(?:\.extended)?\.test\.ts$/,
  /\/effect-buffer\.test\.ts$/,
  /tests\/helpers\/wait\.ts$/,
];
const findings = [];

for (const root of ROOTS) {
  if (existsSync(root)) {
    walk(root);
  }
}

console.log(JSON.stringify({
  roots: ROOTS,
  minimumDelayMs: MIN_DELAY_MS,
  findingCount: findings.length,
  findings,
}, null, 2));

if (findings.length > 0) {
  console.error("test hard-wait audit failed");
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

function scanFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const previous = lines[index - 1] ?? "";
    if (hasTimingContract(line) || hasTimingContract(previous)) {
      continue;
    }
    const delayMs = extractDelayMs(line);
    if (delayMs === null || delayMs < MIN_DELAY_MS) {
      continue;
    }
    findings.push({
      file: filePath,
      line: index + 1,
      delayMs,
      snippet: line.trim(),
    });
  }
}

function isAllowedFile(filePath) {
  return ALLOWED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function hasTimingContract(line) {
  return line.includes("timing-contract");
}

function extractDelayMs(line) {
  const promiseMatch = line.match(/await\s+new\s+Promise\s*\([^)]*setTimeout\([^,]+,\s*(\d+)\)\)/);
  if (promiseMatch) {
    return Number(promiseMatch[1]);
  }
  const helperMatch = line.match(/await\s+(?:sleep|delay)\((\d+)\)/);
  if (helperMatch) {
    return Number(helperMatch[1]);
  }
  return null;
}
