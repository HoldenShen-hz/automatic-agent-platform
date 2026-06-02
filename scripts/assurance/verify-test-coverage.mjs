#!/usr/bin/env node
/**
 * Assurance Layer: verify test-to-issue coverage
 *
 * Per methodology §44.18 and docs_zh/contracts/issue-ledger-contract.md §7.
 *
 * Loads artifacts/assurance/test-to-issue-map.json and
 * artifacts/assurance/issue-to-test-map.json, cross-references them with
 * artifacts/assurance/issues.deduped.jsonl, and verifies the bidirectional
 * binding contract:
 *
 *   1. Every P0 issue must be bound by at least one test.
 *   2. Every P0 test (severity P0 in its header) must reference at least one
 *      P0 issue from the ledger.
 *   3. Any issue with non-empty `linkedPromiseIds` should have a test.
 *   4. Any P0 issue with `invariantViolated` != "unspecified" must have a test.
 *
 * Outputs artifacts/assurance/test-coverage-report.json with
 *   { status, findings: { unboundIssues, unboundTests, orphanTests, ... } }
 *
 * Exit code is 1 if any P0 issue is unbound.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

function loadJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function loadJsonl(path) {
  const records = [];
  if (!existsSync(path)) return records;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch { /* ignore */ }
  }
  return records;
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  // 1. Load inputs.
  const testToIssue = loadJson(join(outputRoot, "test-to-issue-map.json"));
  const issueToTest = loadJson(join(outputRoot, "issue-to-test-map.json"));
  const testMetadata = loadJson(join(outputRoot, "test-metadata.json"));
  const issues = loadJsonl(join(outputRoot, "issues.deduped.jsonl"));

  const bindings = testToIssue?.bindings ?? {};
  const issueBindings = issueToTest?.bindings ?? {};
  const metaEntries = testMetadata?.entries ?? [];

  // 2. Categorize issues.
  const p0Issues = issues.filter((i) => i.severity === "P0");
  const p0IssueIds = new Set(p0Issues.map((i) => i.issueId));

  // 3. Findings.
  const findings = {
    unboundP0Issues: [],
    unboundP1Issues: [],
    unboundPromiseLinkedIssues: [],
    unboundInvariantIssues: [],
    unboundTests: [],
    orphanTests: [],
    unknownIssueRefs: [],
    bidirectionalInconsistencies: [],
  };

  // 3a. Unbound P0 issues (must be at least 1 test).
  for (const i of p0Issues) {
    const bound = (issueBindings[i.issueId] ?? []).length > 0;
    if (!bound) {
      findings.unboundP0Issues.push({
        issueId: i.issueId,
        severity: i.severity,
        description: i.description,
        sourceRef: i.sourceRef,
        category: i.category,
        invariantViolated: i.invariantViolated,
        linkedPromiseIds: i.linkedPromiseIds ?? [],
        linkedReviewIds: i.linkedReviewIds ?? [],
        reason: "P0 issue has no test binding",
      });
    }
  }

  // 3b. Unbound P1 issues (informational; not a blocker).
  const p1Issues = issues.filter((i) => i.severity === "P1");
  for (const i of p1Issues) {
    const bound = (issueBindings[i.issueId] ?? []).length > 0;
    if (!bound) {
      findings.unboundP1Issues.push({
        issueId: i.issueId,
        description: i.description,
        sourceRef: i.sourceRef,
        reason: "P1 issue has no test binding (informational)",
      });
    }
  }

  // 3c. Issues with linkedPromiseIds non-empty should have tests.
  for (const i of issues) {
    if ((i.linkedPromiseIds ?? []).length === 0) continue;
    const bound = (issueBindings[i.issueId] ?? []).length > 0;
    if (!bound) {
      findings.unboundPromiseLinkedIssues.push({
        issueId: i.issueId,
        severity: i.severity,
        linkedPromiseIds: i.linkedPromiseIds,
        reason: "issue has linkedPromiseIds but no test binding",
      });
    }
  }

  // 3d. P0 issues with invariantViolated != "unspecified" must have tests.
  for (const i of issues) {
    if (i.severity !== "P0") continue;
    if (!i.invariantViolated || i.invariantViolated === "unspecified") continue;
    const bound = (issueBindings[i.issueId] ?? []).length > 0;
    if (!bound) {
      findings.unboundInvariantIssues.push({
        issueId: i.issueId,
        severity: i.severity,
        invariantViolated: i.invariantViolated,
        reason: "P0 issue with named invariant has no test binding",
      });
    }
  }

  // 3e. Unbound tests: P0 tests that reference no P0 issue.
  const knownIds = new Set(issues.map((i) => i.issueId));
  for (const entry of metaEntries) {
    if (entry.severity !== "P0") continue;
    const refs = entry.issueIds ?? [];
    const p0Refs = refs.filter((id) => p0IssueIds.has(id));
    if (p0Refs.length === 0) {
      findings.unboundTests.push({
        testPath: entry.path,
        issueRefs: refs,
        knownIssueRefs: refs.filter((id) => knownIds.has(id)),
        unknownIssueRefs: refs.filter((id) => !knownIds.has(id)),
        invariant: entry.invariant,
        reason: refs.length === 0
          ? "P0 test has no @issue tag"
          : !refs.some((id) => knownIds.has(id))
            ? "P0 test references only unknown issue ids"
            : "P0 test references no P0 issue from the ledger",
      });
    }
  }

  // 3f. Orphan tests: any test whose @issue references do not exist in the ledger.
  for (const entry of metaEntries) {
    const refs = entry.issueIds ?? [];
    const unknown = refs.filter((id) => !knownIds.has(id));
    if (unknown.length > 0) {
      findings.orphanTests.push({
        testPath: entry.path,
        unknownRefs: unknown,
        knownRefs: refs.filter((id) => knownIds.has(id)),
      });
    }
  }

  // 3g. Unknown issue refs from the binding file (any test mapping to unknown id).
  for (const [issueId, tests] of Object.entries(issueBindings)) {
    if (!knownIds.has(issueId)) {
      findings.unknownIssueRefs.push({ issueId, tests });
    }
  }

  // 3h. Bidirectional consistency: reverse of test-to-issue must be a subset of issue-to-test.
  const reverseUnion = new Set();
  for (const ids of Object.values(bindings)) for (const id of ids) reverseUnion.add(id);
  for (const id of reverseUnion) {
    if (!issueBindings[id]) {
      findings.bidirectionalInconsistencies.push({ issueId: id, reason: "present in test-to-issue but missing from issue-to-test" });
    }
  }

  // 4. Status.
  const p0Unbound = findings.unboundP0Issues.length;
  const invariantUnbound = findings.unboundInvariantIssues.length;
  const orphanCount = findings.orphanTests.length;
  const unboundTestCount = findings.unboundTests.length;
  const bindingBroken = findings.bidirectionalInconsistencies.length > 0;

  const status = (p0Unbound > 0 || invariantUnbound > 0 || bindingBroken) ? "fail" : "warn";

  const report = {
    generatedAt: stamp,
    status,
    releaseBlocked: p0Unbound > 0 || bindingBroken,
    summary: {
      issuesTotal: issues.length,
      p0IssueCount: p0Issues.length,
      p1IssueCount: p1Issues.length,
      testsWithMetadata: metaEntries.length,
      p0TestCount: metaEntries.filter((e) => e.severity === "P0").length,
      p0UnboundIssues: p0Unbound,
      p1UnboundIssues: findings.unboundP1Issues.length,
      unboundPromiseLinkedIssues: findings.unboundPromiseLinkedIssues.length,
      unboundInvariantIssues: invariantUnbound,
      unboundTests: unboundTestCount,
      orphanTests: orphanCount,
      unknownIssueRefs: findings.unknownIssueRefs.length,
      bidirectionalInconsistencies: findings.bidirectionalInconsistencies.length,
    },
    findings,
  };

  writeFileSync(
    join(outputRoot, "test-coverage-report.json"),
    JSON.stringify(report, null, 2),
  );

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (p0Unbound > 0) {
    process.exitCode = 1;
  }
}

main();
