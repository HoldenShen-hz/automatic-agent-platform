#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "ui/packages/features";
const FILE_PATTERN = /\.(?:ts|tsx)$/;
const PROPERTY_PATTERN = /\b(title|summary|description|label|hint|emptyTitle|emptyMessage|badge|placeholder)\s*:\s*(["'])[^"'\\]*(?:\\.[^"'\\]*)*\2/g;
const MOBILE_CARD_PATTERN = /createMobileFeatureCard\(\s*(["'])[^"'\\]*(?:\\.[^"'\\]*)*\1\s*,\s*(["'])[^"'\\]*(?:\\.[^"'\\]*)*\2/g;
const findings = [];

if (existsSync(ROOT)) {
  walk(ROOT);
}

const summary = {
  root: ROOT,
  fileCount: new Set(findings.map((finding) => finding.file)).size,
  findingCount: findings.length,
  findings,
};

console.log(JSON.stringify(summary, null, 2));

if (findings.length > 0) {
  console.error("ui feature copy i18n audit failed");
  process.exit(1);
}

function walk(directory) {
  for (const entry of readdirSync(directory).sort()) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!stats.isFile() || !FILE_PATTERN.test(fullPath) || fullPath.endsWith(".d.ts")) {
      continue;
    }
    if (!fullPath.includes("/src/hooks/") && !fullPath.includes("/src/mobile/")) {
      continue;
    }
    scanFile(fullPath);
  }
}

function scanFile(file) {
  const source = readFileSync(file, "utf8");
  collectMatches(file, source, PROPERTY_PATTERN, "property-string");
  collectMatches(file, source, MOBILE_CARD_PATTERN, "mobile-card-string");
}

function collectMatches(file, source, pattern, kind) {
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    const line = source.slice(0, index).split("\n").length;
    findings.push({
      file,
      line,
      kind,
      snippet: match[0],
    });
  }
}
