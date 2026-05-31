#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "tests", "ui"];
const SOURCE_PATTERN = /\.(?:ts|tsx)$/;
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".next", "coverage"]);
const CANONICAL_PREFIXES = [
  "https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/",
  "https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_en/",
];

const findings = [];

for (const root of ROOTS) {
  if (!existsSync(root)) {
    continue;
  }
  walk(root);
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}

function walk(current) {
  for (const entry of readdirSync(current).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const path = join(current, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    if (!stats.isFile() || !SOURCE_PATTERN.test(path)) {
      continue;
    }
    auditFile(path);
  }
}

function auditFile(path) {
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.includes("@see") && !line.includes("{@link")) {
      continue;
    }
    const urls = line.match(/https?:\/\/[^\s|}]+/g) ?? [];
    for (const url of urls) {
      if (url.includes("raw.githubusercontent.com") || url.includes("githubusercontent.com")) {
        findings.push(`${path}:${index + 1} uses raw GitHub doc link: ${url}`);
        continue;
      }
      if (!url.includes("github.com/")) {
        continue;
      }
      if (url.includes("automatic-agent-system")) {
        findings.push(`${path}:${index + 1} uses stale repository name: ${url}`);
        continue;
      }
      if (url.includes("/tree/")) {
        findings.push(`${path}:${index + 1} uses non-canonical tree doc link: ${url}`);
        continue;
      }
      if (url.includes("github.com/automatic-agent/automatic-agent-platform/")) {
        const isCanonical = CANONICAL_PREFIXES.some((prefix) => url.startsWith(prefix));
        if (!isCanonical) {
          findings.push(`${path}:${index + 1} uses non-canonical GitHub doc link: ${url}`);
        }
      }
    }
  }
}
