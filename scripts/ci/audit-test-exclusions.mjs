#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const baselinePath = join(process.cwd(), "config", "quality", "test-exclusion-allowlist.json");
const curatedPaths = [
  join(process.cwd(), "tsconfig.tests-curated.json"),
  join(process.cwd(), "tsconfig.coverage-curated.json"),
];
const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
const exclude = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
const testExcludes = exclude.filter((entry) => /test|tests|e2e|integration|golden/i.test(String(entry)));
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const allowlistEntries = Array.isArray(baseline) ? baseline.map(String) : [];
const allowlistSet = new Set(allowlistEntries);
const duplicateEntries = allowlistEntries
  .filter((entry, index) => allowlistEntries.indexOf(entry) !== index)
  .sort();
const missingAnchors = [...allowlistSet]
  .filter((entry) => /[*?[\]{}]/.test(entry) === false)
  .filter((entry) => existsSync(entry) === false)
  .sort();
const redundantEntries = [...allowlistSet]
  .filter((entry) => {
    if (/[*?[\]{}]/.test(entry)) {
      return false;
    }
    return [...allowlistSet]
      .filter((candidate) => candidate !== entry)
      .some((candidate) => globToRegExp(candidate).test(entry));
  })
  .sort();
const curatedDrift = curatedPaths.map((path) => {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const files = Array.isArray(parsed.files) ? parsed.files.map(String) : [];
  const expectedFiles = buildExpectedFiles([...allowlistSet]);
  const actualSet = new Set(files);
  return {
    path,
    missingFiles: expectedFiles.filter((file) => !actualSet.has(file)),
    unexpectedFiles: files.filter((file) => !expectedFiles.includes(file)),
  };
}).filter((entry) => entry.missingFiles.length > 0 || entry.unexpectedFiles.length > 0);

const summary = {
  totalExcludeEntries: exclude.length,
  testExcludeEntries: testExcludes.length,
  allowlistEntries: allowlistEntries.length,
  uniqueAllowlistEntries: allowlistSet.size,
  duplicateEntries,
  missingAnchors,
  redundantEntries,
  tsconfigHasTestExcludes: testExcludes.length > 0,
  curatedDrift,
};

console.log(JSON.stringify(summary, null, 2));

if (
  testExcludes.length > 0
  || duplicateEntries.length > 0
  || missingAnchors.length > 0
  || redundantEntries.length > 0
  || curatedDrift.length > 0
) {
  console.error("test exclusion allowlist drift detected");
  process.exit(1);
}

function buildExpectedFiles(excludePatterns) {
  const files = walkFiles(join(process.cwd(), "tests"))
    .map((path) => path.slice(process.cwd().length + 1).replaceAll("\\", "/"))
    .filter((path) => path.endsWith(".test.ts"))
    .filter((path) => !matchesAny(path, excludePatterns))
    .sort((left, right) => left.localeCompare(right));
  return files;
}

function walkFiles(root) {
  const results = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of readDirEntries(current)) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function readDirEntries(root) {
  return readdirSync(root, { withFileTypes: true });
}

function globToRegExp(pattern) {
  let normalized = pattern.replaceAll("\\", "/");
  normalized = normalized.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  normalized = normalized.replaceAll("/**/", "/(?:.*/)?");
  normalized = normalized.replaceAll("**/", "(?:.*/)?");
  normalized = normalized.replaceAll("/**", "/.*");
  normalized = normalized.replaceAll("**", ".*");
  normalized = normalized.replaceAll("*", "[^/]*");
  return new RegExp(`^${normalized}$`, "u");
}

function matchesAny(path, patterns) {
  const normalized = path.replaceAll("\\", "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}
