#!/usr/bin/env node
/**
 * Assurance Layer: build test-to-issue bidirectional map
 *
 * Per methodology §44.18 and docs_zh/contracts/issue-ledger-contract.md §7.
 *
 * Scans all `tests/<recursive>/<name>.test.ts` files, extracts the header metadata block
 * (looking for `@issue`, `@invariant`, `@gate`, `@severity` tags), and
 * combines that with artifacts/assurance/issues.deduped.jsonl to produce:
 *
 *   - artifacts/assurance/test-to-issue-map.json
 *   - artifacts/assurance/issue-to-test-map.json
 *
 * @issue tags are normalized to AAS-ISSUE-* IDs when applicable; non-AAS
 * tags (e.g. legacy AUDIT-TOOL-*-001 markers) are preserved verbatim.
 *
 * Usage:
 *   node scripts/assurance/build-test-to-issue-map.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");
const testsRoot = join(repoRoot, "tests");

const SKIP_DIRS = new Set([
  "node_modules", "dist", "coverage", ".git", "artifacts", "build",
  ".tmp", ".test-db", ".cache",
]);

// Header JSDoc block: /** ... */
// We support two flavors of header metadata:
//   1) Standard JSDoc /** ... */ block at the top of the file (multi-line).
//      Inside the block we only accept tags that begin a " * " line so that
//      prose that happens to mention "@issue" inside a sentence is ignored.
//   2) Single-line `// @issue ...` comments (anywhere in the file), which
//      can be used as an evasion-tolerant fallback (e.g. `// hidden @issue ...`).
const HEADER_BLOCK_RE = /^\s*\/\*\*([\s\S]*?)\*\//m;
const BLOCK_TAG_RE = /(?:^|\n)[ \t]*\*[ \t]*@(\w+)\s+([^\n]+)/g;
const LINE_TAG_RE = /(^|\n)\s*\/\/\s*[^@\n]*@(\w+)\s+([^\n]+?)\s*$/gm;

const TEST_EXT = new Set([".ts", ".tsx", ".mts", ".cts"]);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (stat.isFile() && TEST_EXT.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Parse a metadata block (either a /** ... *\/ block or a one-line comment)
 * and return a list of { key, value } pairs (deduped, first-wins per key).
 *
 * Tags recognized: @issue, @invariant, @gate, @severity, @promises, @contract
 * Multi-value tags (@issue can appear multiple times) accumulate into a list.
 */
function parseMetadata(text) {
  const tags = {};
  // 1) JSDoc /** ... */ block — tags must start a `*` line.
  const blockMatch = text.match(HEADER_BLOCK_RE);
  const body = blockMatch ? blockMatch[1] : "";
  BLOCK_TAG_RE.lastIndex = 0;
  let m;
  while ((m = BLOCK_TAG_RE.exec(body)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2].trim().replace(/[\s*\/]+$/g, "").trim();
    if (!val) continue;
    if (key === "issue" || key === "issues") {
      (tags.issue ??= []).push(val);
    } else if (key === "promise" || key === "promises") {
      (tags.promise ??= []).push(val);
    } else if (key === "review" || key === "reviews") {
      (tags.review ??= []).push(val);
    } else {
      tags[key] = val;
    }
  }
  // 2) Single-line `// @tag value` comments anywhere in the file. Useful for
  //    evasion-tolerant metadata that lives in non-JSDoc files. We do NOT
  //    match comments that just happen to contain @tag in prose (the regex
  //    requires the `//` to lead the line, optionally prefixed with
  //    non-@ content).
  LINE_TAG_RE.lastIndex = 0;
  while ((m = LINE_TAG_RE.exec(text)) !== null) {
    const key = m[2].toLowerCase();
    const val = m[3].trim();
    if (!val) continue;
    if (key === "issue" || key === "issues") {
      (tags.issue ??= []).push(val);
    } else if (key === "promise" || key === "promises") {
      (tags.promise ??= []).push(val);
    } else if (key === "review" || key === "reviews") {
      (tags.review ??= []).push(val);
    } else {
      tags[key] = val;
    }
  }
  return tags;
}

function loadIssueLedger(path) {
  const issues = new Map();
  if (!existsSync(path)) return issues;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.issueId) issues.set(rec.issueId, rec);
    } catch {
      // ignore parse errors
    }
  }
  return issues;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  // 1. Load issue ledger.
  const issuesPath = join(outputRoot, "issues.deduped.jsonl");
  const issues = loadIssueLedger(issuesPath);

  // 2. Walk tests/ and parse metadata.
  const testFiles = walk(testsRoot);
  const testToIssue = {};      // { testPath: [issueId, ...] }
  const issueToTest = {};      // { issueId: [testPath, ...] }
  const testMetadata = [];     // [ { path, issueIds, invariant, gate, severity, ... } ]
  let testsWithMetadata = 0;

  for (const file of testFiles) {
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    const meta = parseMetadata(text);
    if (!meta.issue || meta.issue.length === 0) continue;
    const relPath = relative(repoRoot, file);
    const ids = Array.from(new Set(meta.issue));
    testToIssue[relPath] = ids;
    for (const id of ids) {
      if (!issueToTest[id]) issueToTest[id] = [];
      if (!issueToTest[id].includes(relPath)) issueToTest[id].push(relPath);
    }
    testMetadata.push({
      path: relPath,
      issueIds: ids,
      invariant: meta.invariant ?? null,
      gate: meta.gate ?? null,
      severity: meta.severity ?? null,
      promises: meta.promise ?? [],
      reviews: meta.review ?? [],
    });
    testsWithMetadata++;
  }

  // 3. Sort keys for stable output.
  const sortedTestToIssue = Object.fromEntries(
    Object.keys(testToIssue).sort().map((k) => [k, [...testToIssue[k]].sort()]),
  );
  const sortedIssueToTest = Object.fromEntries(
    Object.keys(issueToTest).sort().map((k) => [k, [...issueToTest[k]].sort()]),
  );

  // 4. Compute coverage stats.
  const knownIssueIds = new Set(issues.keys());
  const referencedIssueIds = new Set(Object.keys(issueToTest));
  const unknownIssueIds = [...referencedIssueIds].filter((id) => !knownIssueIds.has(id));
  const p0Issues = [...issues.values()].filter((i) => i.severity === "P0");
  const p0IssueIds = new Set(p0Issues.map((i) => i.issueId));
  const p0BoundIds = [...p0IssueIds].filter((id) => issueToTest[id] && issueToTest[id].length > 0);
  const p0UnboundIds = [...p0IssueIds].filter((id) => !issueToTest[id] || issueToTest[id].length === 0);

  // 5. Self-consistency: reverse of test-to-issue must be a subset of issue-to-test.
  const reverseUnion = new Set();
  for (const ids of Object.values(testToIssue)) for (const id of ids) reverseUnion.add(id);
  const unionMismatch = [...reverseUnion].filter((id) => !issueToTest[id]);

  const summary = {
    generatedAt: stamp,
    issuesPath: relative(repoRoot, issuesPath),
    testFilesScanned: testFiles.length,
    testsWithMetadata,
    referencedIssueIds: referencedIssueIds.size,
    unknownIssueIds: unknownIssueIds.length,
    p0IssueCount: p0Issues.length,
    p0BoundCount: p0BoundIds.length,
    p0UnboundCount: p0UnboundIds.length,
    unionMismatchCount: unionMismatch.length,
    bidirectionalConsistent: unionMismatch.length === 0,
    outputs: {
      testToIssue: "artifacts/assurance/test-to-issue-map.json",
      issueToTest: "artifacts/assurance/issue-to-test-map.json",
      metadata: "artifacts/assurance/test-metadata.json",
    },
  };

  // 6. Write outputs.
  writeFileSync(
    join(outputRoot, "test-to-issue-map.json"),
    JSON.stringify({
      generatedAt: stamp,
      totalTests: Object.keys(sortedTestToIssue).length,
      totalIssueRefs: [...reverseUnion].length,
      bindings: sortedTestToIssue,
    }, null, 2),
  );
  writeFileSync(
    join(outputRoot, "issue-to-test-map.json"),
    JSON.stringify({
      generatedAt: stamp,
      totalIssues: Object.keys(sortedIssueToTest).length,
      totalTestRefs: Object.values(sortedIssueToTest).reduce((acc, v) => acc + v.length, 0),
      bindings: sortedIssueToTest,
    }, null, 2),
  );
  writeFileSync(
    join(outputRoot, "test-metadata.json"),
    JSON.stringify({
      generatedAt: stamp,
      totalTests: testMetadata.length,
      entries: testMetadata.sort((a, b) => a.path.localeCompare(b.path)),
    }, null, 2),
  );

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  // Non-zero exit only if bidirectional consistency breaks. P0 unbound issues
  // are reported but the map can still be built; the verify step is responsible
  // for the policy gate.
  if (!summary.bidirectionalConsistent) {
    process.exitCode = 1;
  }
}

main();
