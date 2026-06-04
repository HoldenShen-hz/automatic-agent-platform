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
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");
const includeFixtures = process.argv.includes("--include-fixtures");

const CONTROL_REF_PREFIXES = [
  "AUDIT-TOOL-",
  "ASSURANCE-",
  "CHAOS-",
  "CONTRACT-",
  "EVAL-",
  "REDTEAM-",
  "REGRESSION-",
  "RELEASE-",
];
const GATE_ALIASES = new Map([
  ["audit:recovery-replay", ["audit:execution-invariants"]],
  ["audit:event-outbox", ["audit:execution-invariants"]],
  ["audit:receipt-verification", ["audit:execution-invariants"]],
  ["audit:audit-chain", ["audit:execution-invariants"]],
]);

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

function writeJsonAtomic(path, value) {
  const tmpPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify(value, null, 2));
  renameSync(tmpPath, path);
}

function isFixturePath(testPath) {
  return testPath.startsWith("tests/fixtures/");
}

function isSyntheticControlRef(issueId) {
  return CONTROL_REF_PREFIXES.some((prefix) => issueId.startsWith(prefix));
}

function shouldRequireCoverage(issue) {
  if (issue?.coverageRequired === false) {
    return false;
  }
  return !["verified", "closed", "accepted_risk", "needs_revalidation"].includes(issue?.status);
}

function addToMultiMap(map, key, value) {
  if (typeof key !== "string" || key.length === 0) {
    return;
  }
  const bucket = map.get(key) ?? [];
  if (!bucket.includes(value)) {
    bucket.push(value);
    map.set(key, bucket);
  }
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  // Cap per-finding output to keep the report JSON manageable; counts are
  // always reported in summary.
  const MAX_PER_FINDING = 100;

  // 1. Load inputs.
  const testToIssue = loadJson(join(outputRoot, "test-to-issue-map.json"));
  const issueToTest = loadJson(join(outputRoot, "issue-to-test-map.json"));
  const testMetadata = loadJson(join(outputRoot, "test-metadata.json"));
  const issues = loadJsonl(join(outputRoot, "issues.deduped.jsonl"));

  const bindings = testToIssue?.bindings ?? {};
  const issueBindings = issueToTest?.bindings ?? {};
  const metaEntries = testMetadata?.entries ?? [];
  const scopedMetaEntries = metaEntries.filter((entry) => includeFixtures || !isFixturePath(entry.path));
  const gateToTests = new Map();
  const invariantToTests = new Map();
  for (const entry of scopedMetaEntries) {
    addToMultiMap(gateToTests, entry.gate ?? "", entry.path);
    addToMultiMap(invariantToTests, entry.invariant ?? "", entry.path);
  }

  function bindingsForIssue(issue) {
    const direct = issueBindings[issue.issueId] ?? [];
    const gates = (issue.requiredGate ?? []).flatMap((gate) => [gate, ...(GATE_ALIASES.get(gate) ?? [])]);
    const gateBound = gates.flatMap((gate) => gateToTests.get(gate) ?? []);
    const invariantBound = issue.invariantViolated ? (invariantToTests.get(issue.invariantViolated) ?? []) : [];
    return [...new Set([...direct, ...gateBound, ...invariantBound])];
  }

  // 2. Categorize issues.
  const coverageRequiredIssues = issues.filter((i) => shouldRequireCoverage(i));
  const p0Issues = coverageRequiredIssues.filter((i) => i.severity === "P0");
  const p0IssueIds = new Set(p0Issues.map((i) => i.issueId));
  const p0BoundIds = p0Issues
    .map((i) => i.issueId)
    .filter((id) => {
      const issue = p0Issues.find((record) => record.issueId === id);
      return issue != null && bindingsForIssue(issue).length > 0;
    });
  const knownIds = new Set(issues.map((i) => i.issueId));

  // 3. Findings (collect full lists in a counter form, but truncate the
  //    stored report so it stays small).
  const findingsFull = {
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
    const bound = bindingsForIssue(i).length > 0;
    if (!bound) {
      findingsFull.unboundP0Issues.push({
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
  const p1Issues = coverageRequiredIssues.filter((i) => i.severity === "P1");
  for (const i of p1Issues) {
    const bound = bindingsForIssue(i).length > 0;
    if (!bound) {
      findingsFull.unboundP1Issues.push({
        issueId: i.issueId,
        description: i.description,
        sourceRef: i.sourceRef,
        reason: "P1 issue has no test binding (informational)",
      });
    }
  }

  // 3c. Issues with linkedPromiseIds non-empty should have tests.
  for (const i of coverageRequiredIssues) {
    if ((i.linkedPromiseIds ?? []).length === 0) continue;
    const bound = bindingsForIssue(i).length > 0;
    if (!bound) {
      findingsFull.unboundPromiseLinkedIssues.push({
        issueId: i.issueId,
        severity: i.severity,
        linkedPromiseIds: i.linkedPromiseIds,
        reason: "issue has linkedPromiseIds but no test binding",
      });
    }
  }

  // 3d. P0 issues with invariantViolated != "unspecified" must have tests.
  for (const i of coverageRequiredIssues) {
    if (i.severity !== "P0") continue;
    if (!i.invariantViolated || i.invariantViolated === "unspecified") continue;
    const bound = bindingsForIssue(i).length > 0;
    if (!bound) {
      findingsFull.unboundInvariantIssues.push({
        issueId: i.issueId,
        severity: i.severity,
        invariantViolated: i.invariantViolated,
        reason: "P0 issue with named invariant has no test binding",
      });
    }
  }

  // 3e. Unbound tests: P0 tests that reference no P0 issue.
  for (const entry of scopedMetaEntries) {
    if (entry.severity !== "P0") continue;
    const refs = entry.issueIds ?? [];
    const p0Refs = refs.filter((id) => p0IssueIds.has(id));
    const controlRefs = refs.filter((id) => isSyntheticControlRef(id));
    const controlBound = controlRefs.length > 0 && Boolean(entry.invariant || entry.gate);
    if (p0Refs.length === 0 && !controlBound) {
      findingsFull.unboundTests.push({
        testPath: entry.path,
        issueRefs: refs,
        knownIssueRefs: refs.filter((id) => knownIds.has(id)),
        unknownIssueRefs: refs.filter((id) => !knownIds.has(id) && !isSyntheticControlRef(id)),
        invariant: entry.invariant,
        reason: refs.length === 0
          ? "P0 test has no @issue tag"
          : !refs.some((id) => knownIds.has(id) || isSyntheticControlRef(id))
            ? "P0 test references only unknown issue ids"
            : "P0 test references no P0 issue from the ledger",
      });
    }
  }

  // 3f. Orphan tests: any test whose @issue references do not exist in the ledger.
  for (const entry of scopedMetaEntries) {
    const refs = entry.issueIds ?? [];
    const unknown = refs.filter((id) => !knownIds.has(id) && !isSyntheticControlRef(id));
    if (unknown.length > 0) {
      findingsFull.orphanTests.push({
        testPath: entry.path,
        unknownRefs: unknown,
        knownRefs: refs.filter((id) => knownIds.has(id)),
      });
    }
  }

  // 3g. Unknown issue refs from the binding file (any test mapping to unknown id).
  for (const [issueId, tests] of Object.entries(issueBindings)) {
    if (!knownIds.has(issueId) && !isSyntheticControlRef(issueId)) {
      findingsFull.unknownIssueRefs.push({ issueId, tests });
    }
  }

  // 3h. Bidirectional consistency: reverse of test-to-issue must be a subset of issue-to-test.
  const reverseUnion = new Set();
  for (const ids of Object.values(bindings)) for (const id of ids) reverseUnion.add(id);
  for (const id of reverseUnion) {
    if (!issueBindings[id]) {
      findingsFull.bidirectionalInconsistencies.push({ issueId: id, reason: "present in test-to-issue but missing from issue-to-test" });
    }
  }

  // 4. Status.
  const p0Unbound = findingsFull.unboundP0Issues.length;
  const p0Bound = p0Issues.length - p0Unbound;
  const invariantUnbound = findingsFull.unboundInvariantIssues.length;
  const orphanCount = findingsFull.orphanTests.length;
  const unboundTestCount = findingsFull.unboundTests.length;
  const bindingBroken = findingsFull.bidirectionalInconsistencies.length > 0;

  const status = (p0Unbound > 0 || invariantUnbound > 0 || bindingBroken) ? "fail" : "warn";

  // Truncate findings for the stored/printed report to keep it readable;
  // counts are always present in summary.
  const findings = {
    unboundP0Issues: findingsFull.unboundP0Issues.slice(0, MAX_PER_FINDING),
    unboundP1Issues: findingsFull.unboundP1Issues.slice(0, MAX_PER_FINDING),
    unboundPromiseLinkedIssues: findingsFull.unboundPromiseLinkedIssues.slice(0, MAX_PER_FINDING),
    unboundInvariantIssues: findingsFull.unboundInvariantIssues.slice(0, MAX_PER_FINDING),
    unboundTests: findingsFull.unboundTests.slice(0, MAX_PER_FINDING),
    orphanTests: findingsFull.orphanTests.slice(0, MAX_PER_FINDING),
    unknownIssueRefs: findingsFull.unknownIssueRefs.slice(0, MAX_PER_FINDING),
    bidirectionalInconsistencies: findingsFull.bidirectionalInconsistencies.slice(0, MAX_PER_FINDING),
  };

  const report = {
    generatedAt: stamp,
    status,
    releaseBlocked: p0Unbound > 0 || bindingBroken,
    summary: {
      issuesTotal: issues.length,
      coverageRequiredIssueCount: coverageRequiredIssues.length,
      p0IssueCount: p0Issues.length,
      p0BoundCount: p0BoundIds.length,
      p1IssueCount: p1Issues.length,
      testsWithMetadata: scopedMetaEntries.length,
      p0TestCount: scopedMetaEntries.filter((e) => e.severity === "P0").length,
      p0BoundCount: p0Bound,
      p0UnboundIssues: p0Unbound,
      p1UnboundIssues: findingsFull.unboundP1Issues.length,
      unboundPromiseLinkedIssues: findingsFull.unboundPromiseLinkedIssues.length,
      unboundInvariantIssues: invariantUnbound,
      unboundTests: unboundTestCount,
      orphanTests: orphanCount,
      unknownIssueRefs: findingsFull.unknownIssueRefs.length,
      bidirectionalInconsistencies: findingsFull.bidirectionalInconsistencies.length,
    },
    findings,
  };

  writeJsonAtomic(join(outputRoot, "test-coverage-report.json"), report);

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (p0Unbound > 0) {
    process.exitCode = 1;
  }
}

main();
