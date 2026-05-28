#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const ALLOWLIST_PATH = "config/quality/public-entrypoint-allowlist.json";
const ENTRYPOINTS = ["src/index.ts", "src/platform/index.ts", "src/sdk/index.ts"];
const SPECIFIER_PATTERN = /(?:from\s+["']([^"']+)["']|export\s+\*\s+from\s+["']([^"']+)["'])/g;

function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { version: 1, entries: {} };
  }
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    version: parsed.version ?? 1,
    entries: parsed.entries ?? {},
  };
}

function isDeepInternalSpecifier(specifier) {
  if (!specifier.startsWith("./")) {
    return false;
  }
  const segments = specifier.slice(2).split("/");
  if (segments.length <= 1) {
    return false;
  }
  if (segments.length === 2 && segments[1] === "index.js") {
    return false;
  }
  return true;
}

const allowlist = readAllowlist();
const hits = [];

for (const file of ENTRYPOINTS) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier == null || !isDeepInternalSpecifier(specifier)) {
      continue;
    }
    hits.push({ file, specifier });
  }
}

const matchedAllowlist = new Set();
const unexpected = [];

for (const hit of hits) {
  const allowedSpecifiers = Array.isArray(allowlist.entries[hit.file]) ? allowlist.entries[hit.file] : [];
  if (allowedSpecifiers.includes(hit.specifier)) {
    matchedAllowlist.add(`${hit.file}::${hit.specifier}`);
  } else {
    unexpected.push(hit);
  }
}

const staleAllowlist = [];
for (const [file, specifiers] of Object.entries(allowlist.entries)) {
  for (const specifier of Array.isArray(specifiers) ? specifiers : []) {
    const key = `${file}::${specifier}`;
    if (!matchedAllowlist.has(key)) {
      staleAllowlist.push({ file, specifier });
    }
  }
}

const summary = {
  allowlistPath: ALLOWLIST_PATH,
  scannedEntrypoints: ENTRYPOINTS,
  totalDeepSpecifierHits: hits.length,
  unexpected,
  staleAllowlist,
};

console.log(JSON.stringify(summary, null, 2));

if (unexpected.length > 0 || staleAllowlist.length > 0) {
  console.error("public entrypoint audit failed");
  process.exit(1);
}
