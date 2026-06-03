#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "tests", "ui"];
const DOC_ROOTS = ["docs_zh", "docs_en"];
const SOURCE_PATTERN = /\.(?:ts|tsx)$/;
const DOC_PATTERN = /\.md$/;
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".next", "coverage"]);
const CANONICAL_PREFIXES = [
  "https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/",
  "https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_en/",
];
const ARXIV_URL_PATTERN = /^https?:\/\/arxiv\.org\/(?:abs|pdf)\/\d{4}\.\d{4,5}(?:v\d+)?(?:\.pdf)?$/;

const findings = [];

for (const root of ROOTS) {
  if (!existsSync(root)) {
    continue;
  }
  walk(root, "source");
}

for (const root of DOC_ROOTS) {
  if (!existsSync(root)) {
    continue;
  }
  walk(root, "doc");
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}

function walk(current, mode) {
  for (const entry of readdirSync(current).sort()) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const path = join(current, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path, mode);
      continue;
    }
    if (!stats.isFile()) {
      continue;
    }
    if (mode === "source") {
      if (!SOURCE_PATTERN.test(path)) {
        continue;
      }
      auditSourceFile(path);
      continue;
    }
    if (DOC_PATTERN.test(path)) {
      auditDocFile(path);
    }
  }
}

function auditSourceFile(path) {
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

function normalizeUrl(rawUrl) {
  return rawUrl.replace(/[),.;]+$/g, "");
}

function auditDocFile(path) {
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");
  for (const [index, line] of lines.entries()) {
    const urls = (line.match(/https?:\/\/[^\s)]+/g) ?? []).map((entry) => normalizeUrl(entry));
    for (const url of urls) {
      if (!url.includes("arxiv.org/")) {
        continue;
      }
      if (!ARXIV_URL_PATTERN.test(url)) {
        findings.push(`${path}:${index + 1} uses malformed arXiv link: ${url}`);
      }
    }
  }
}
