#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const ALLOWLIST_PATH = "config/quality/outbound-url-allowlist.json";
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRECTORIES = new Set(["dist", "node_modules", ".next", "coverage"]);
const URL_PATTERN = /https?:\/\//;
const COMMENT_PATTERNS = [/^(?:\/\/|\/\*|\*|\*\/)/, /@see\b/, /{@link\b/];
const INLINE_ALLOW_PATTERNS = [
  /defineProviderDefaultUrl\(/,
  /defineAdapterEndpoint\(/,
  /parseSafeOutboundUrl\(/,
  /new URL\(/,
  /\.startsWith\("http:\/\/"\)/,
  /\.startsWith\("https:\/\/"\)/,
  /json-schema\.org\/draft\/2020-12\/schema/,
  /w3\.org\/2001\/04\/xmldsig-more#rsa-sha256/,
  /https:\/\/example\.(?:com|invalid)\b/,
  /https:\/\/evil\.example\//,
  /`http:\/\/\$\{address\.(?:address|host)\}:/,
  /Mozilla\/5\.0\s+\(compatible;/,
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

function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { version: 1, entries: [] };
  }
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    version: parsed.version ?? 1,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
  };
}

function isCommentLike(content) {
  return COMMENT_PATTERNS.some((pattern) => pattern.test(content));
}

function isInlineAllowed(content) {
  return INLINE_ALLOW_PATTERNS.some((pattern) => pattern.test(content));
}

const files = walkFiles(ROOT);
const hits = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const content = line.trim();
    if (!URL_PATTERN.test(content) || isCommentLike(content) || isInlineAllowed(content)) {
      continue;
    }
    hits.push({
      file,
      line: index + 1,
      content,
    });
  }
}

const allowlist = readAllowlist();
const matchedAllowlistEntries = new Set();
const unexpected = [];

for (const hit of hits) {
  const matchIndex = allowlist.entries.findIndex((entry) => entry.file === hit.file && hit.content.includes(entry.fragment));
  if (matchIndex === -1) {
    unexpected.push(hit);
    continue;
  }
  matchedAllowlistEntries.add(matchIndex);
}

const staleAllowlist = allowlist.entries
  .map((entry, index) => ({ entry, index }))
  .filter(({ index }) => !matchedAllowlistEntries.has(index))
  .map(({ entry }) => entry);

const summary = {
  allowlistPath: ALLOWLIST_PATH,
  scannedFiles: files.length,
  totalHits: hits.length,
  unexpected,
  staleAllowlist,
};

console.log(JSON.stringify(summary, null, 2));

if (unexpected.length > 0 || staleAllowlist.length > 0) {
  console.error("outbound url audit failed");
  process.exit(1);
}
