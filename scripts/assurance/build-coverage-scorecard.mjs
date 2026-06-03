#!/usr/bin/env node
/**
 * Assurance Layer 7: coverage scorecard
 *
 * Computes the 10-dimension coverage scorecard per
 * docs_zh/contracts/coverage-scorecard-contract.md and emits
 * artifacts/assurance/audit-coverage-scorecard.{json,md}.
 *
 * The methodology explicitly forbids static scorecard text that pretends to be
 * a real evaluation. Every dimension below must therefore read live assurance
 * artifacts or current package/runtime wiring instead of assuming "script
 * exists => pass".
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");

const DEFAULT_THRESHOLDS = {
  sourceInventory: 1.0,
  historicalPromise: 0.95,
  contractSync: 1.0,
  securityAudit: 1.0,
  executionInvariant: 1.0,
  evalOracle: 1.0,
  ciGate: 1.0,
  regressionSeed: 1.0,
  releaseClaim: 1.0,
  auditToolSelfTest: 1.0,
};

const SECURITY_AUDITS = [
  { auditId: "tenant_isolation", script: "audit:tenant-isolation", seedGate: "audit-tenant-isolation" },
  { auditId: "secret_sinks", script: "audit:secret-sinks", seedGate: "audit-secret-sinks" },
  { auditId: "plugin_security", script: "audit:plugin-security", seedGate: "audit-plugin-security" },
  { auditId: "path_safety", script: "audit:path-safety", seedGate: "audit-path-safety" },
  { auditId: "ui_token_storage", script: "audit:ui-token-storage", seedGate: "audit-ui-token-storage" },
];

const EXECUTION_INVARIANT_AUDITS = [
  "execution_invariants",
  "idempotency",
  "queue",
  "lease_fencing",
  "side_effect_receipt",
  "recovery_replay",
  "audit_chain",
  "receipt_verification",
  "event_outbox",
];

const RC_GATED_COMMANDS = [
  "assurance:full",
  "test:p0",
  "test:chaos:p0",
  "test:redteam:p0",
  "test:golden:strict",
  "test:audit-tools",
  "test:seeded-defects",
  "evidence:bundle:create",
  "evidence:bundle:verify",
];

const ASSURANCE_REQUIRED_COMMANDS = [
  "assurance:inventory",
  "assurance:review-import:check",
  "audit:public-entrypoints",
  "assurance:historical-promises",
  "assurance:assumptions",
  "audit:leadership-claims",
  "audit:docs-sync",
  "assurance:static-audit",
  "assurance:issue-ledger",
  "assurance:test-to-issue",
  "assurance:historical-regression-map",
  "assurance:completeness-matrix",
  "assurance:coverage-scorecard",
];

const P0_COVERAGE_GATES = [
  "assurance:verify-test-coverage",
  "audit:dataset",
  "audit:redteam",
  "audit:golden",
  "audit:eval-oracle",
];

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readJsonlIfExists(path) {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const records = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // Ignore malformed JSONL records; the score should reflect usable output.
    }
  }
  return records;
}

function statusFromScore(score, threshold) {
  if (score >= threshold) return "pass";
  if (score >= threshold * 0.7) return "warn";
  return "fail";
}

function clampRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, numerator / denominator));
}

function gitTrackedFileCount() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 || typeof result.stdout !== "string") {
    return null;
  }
  if (result.stdout.length === 0) {
    return 0;
  }
  return result.stdout.split("\0").filter((entry) => entry.length > 0).length;
}

function listInvariantTests() {
  const invariantsDir = join(repoRoot, "tests", "invariants");
  if (!existsSync(invariantsDir)) {
    return [];
  }
  return readdirSync(invariantsDir).filter((file) => file.endsWith(".test.ts"));
}

function readStaticAuditMap() {
  const report = readJsonIfExists(join(outputRoot, "static-audit-report.json"));
  const map = new Map();
  for (const audit of report?.audits ?? []) {
    if (audit?.id) {
      map.set(audit.id, audit);
    }
  }
  return { report, map };
}

function findSeededCategory(report, expectedGate) {
  for (const result of report?.results ?? []) {
    if (result?.gate === expectedGate) {
      return result;
    }
  }
  return null;
}

function seededTripletPassed(category) {
  if (!category || !Array.isArray(category.seeds)) {
    return false;
  }
  const kinds = new Set(category.seeds.map((seed) => seed.kind));
  if (!kinds.has("positive") || !kinds.has("negative") || !kinds.has("evasion")) {
    return false;
  }
  return category.seeds.every((seed) => seed.pass === true);
}

function assuranceStepOk(report, stepId) {
  return report?.executedSteps?.find?.((step) => step.id === stepId)?.ok === true;
}

function commandCovered(command, packageScripts, rcCheckSource, assuranceFullSource, assuranceCommands) {
  const ciBaseline = packageScripts?.["ci:baseline"] ?? "";
  if (ciBaseline.includes(command)) {
    return true;
  }
  if (rcCheckSource.includes(`command: "${command}"`) || rcCheckSource.includes(`"npm run ${command}"`)) {
    return true;
  }
  if (!rcCheckSource.includes(`command: "assurance:full"`)) {
    return false;
  }
  if (!assuranceCommands.includes(command)) {
    return false;
  }
  return assuranceFullSource.includes(`"${command}"`);
}

function sourceInventoryScore() {
  const inv = readJsonIfExists(join(outputRoot, "source-inventory.json"));
  if (!inv) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.sourceInventory,
      details: "source-inventory.json not generated yet",
      evidenceRefs: [],
    };
  }
  const tracked = gitTrackedFileCount();
  const kinds = Object.keys(inv.byKind ?? {});
  const hasCode = kinds.includes("code");
  const hasTest = kinds.includes("test");
  const hasDoc = kinds.includes("doc");
  const ratio = tracked == null ? (hasCode && hasTest && hasDoc ? 1 : 0) : clampRatio(inv.totalFiles ?? 0, tracked);
  const score = hasCode && hasTest && hasDoc ? ratio : Math.min(ratio, 0.5);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.sourceInventory,
    details: tracked == null
      ? `git ls-files unavailable; code=${hasCode}, test=${hasTest}, doc=${hasDoc}, inventoried=${inv.totalFiles}`
      : `inventoried=${inv.totalFiles}, gitTracked=${tracked}, code=${hasCode}, test=${hasTest}, doc=${hasDoc}`,
    evidenceRefs: ["artifacts/assurance/source-inventory.json"],
  };
}

function historicalPromiseScore() {
  const driftReport = readJsonIfExists(join(outputRoot, "historical-promise-drift-report.json"));
  const records = readJsonlIfExists(join(outputRoot, "historical-promises.jsonl"));
  if (!driftReport || records.length === 0) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.historicalPromise,
      details: "historical promise artifacts missing or empty",
      evidenceRefs: [],
    };
  }
  const scannedFiles = Array.isArray(driftReport.files) ? driftReport.files.length : 0;
  const scannedMatches = Array.isArray(driftReport.files)
    ? driftReport.files.filter((file) => file.scanned === true).length
    : 0;
  const scannedRatio = scannedFiles === 0 ? 0 : clampRatio(scannedMatches, scannedFiles);
  const extractedRatio = clampRatio(records.length, driftReport.totalPromises ?? 0);
  const score = Math.min(scannedRatio, extractedRatio);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.historicalPromise,
    details: `promisesExtracted=${records.length}, reportTotal=${driftReport.totalPromises ?? 0}, scannedFiles=${scannedMatches}/${scannedFiles}`,
    evidenceRefs: [
      "artifacts/assurance/historical-promises.jsonl",
      "artifacts/assurance/historical-promise-drift-report.json",
    ],
  };
}

function contractSyncScore() {
  const report = readJsonIfExists(join(outputRoot, "contracts-sync-report.json"));
  if (!report) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.contractSync,
      details: "contracts-sync not run",
      evidenceRefs: [],
    };
  }
  const total = report.findingCount ?? 0;
  const score = total === 0 ? 1 : 0;
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.contractSync,
    details: `contract drift findings=${total}`,
    evidenceRefs: ["artifacts/assurance/contracts-sync-report.json"],
  };
}

function securityAuditScore() {
  const { map } = readStaticAuditMap();
  const seededReport = readJsonIfExists(join(outputRoot, "seeded-defect-report.json"));
  const results = [];
  for (const audit of SECURITY_AUDITS) {
    const staticAudit = map.get(audit.auditId);
    const p0Count = staticAudit?.bySeverity?.P0 ?? 0;
    const seededCategory = findSeededCategory(seededReport, audit.seedGate);
    const seededOk = seededTripletPassed(seededCategory);
    const passed = p0Count === 0 && seededOk;
    results.push({
      ...audit,
      p0Count,
      seededOk,
      passed,
    });
  }
  const passedCount = results.filter((result) => result.passed).length;
  const score = clampRatio(passedCount, results.length);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.securityAudit,
    details: results
      .map((result) => `${result.auditId}:P0=${result.p0Count},seeded=${result.seededOk ? "ok" : "missing"}`)
      .join("; "),
    evidenceRefs: [
      "artifacts/assurance/static-audit-report.json",
      "artifacts/assurance/seeded-defect-report.json",
    ],
  };
}

function executionInvariantScore() {
  const { map } = readStaticAuditMap();
  const invariantTests = listInvariantTests();
  const cleanAudits = EXECUTION_INVARIANT_AUDITS.filter((auditId) => (map.get(auditId)?.bySeverity?.P0 ?? 0) === 0);
  const auditRatio = clampRatio(cleanAudits.length, EXECUTION_INVARIANT_AUDITS.length);
  const testRatio = clampRatio(invariantTests.length, EXECUTION_INVARIANT_AUDITS.length);
  const score = Math.min(auditRatio, testRatio);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.executionInvariant,
    details: `cleanP0Audits=${cleanAudits.length}/${EXECUTION_INVARIANT_AUDITS.length}, invariantTests=${invariantTests.length}`,
    evidenceRefs: [
      "artifacts/assurance/static-audit-report.json",
      "tests/invariants/",
    ],
  };
}

function evalOracleScore() {
  const { map } = readStaticAuditMap();
  const seededReport = readJsonIfExists(join(outputRoot, "seeded-defect-report.json"));
  const assuranceFull = readJsonIfExists(join(outputRoot, "assurance-full-report.json"));
  const evalAuditP0 = map.get("eval_oracle")?.bySeverity?.P0 ?? 0;
  const evalSeededOk = seededTripletPassed(findSeededCategory(seededReport, "audit-eval-oracle"));
  const datasetOk = assuranceStepOk(assuranceFull, "audit_dataset");
  const redteamOk = assuranceStepOk(assuranceFull, "audit_redteam");
  const goldenOk = assuranceStepOk(assuranceFull, "audit_golden");
  const passedChecks = [
    evalAuditP0 === 0,
    evalSeededOk,
    datasetOk,
    redteamOk,
    goldenOk,
  ].filter(Boolean).length;
  const score = clampRatio(passedChecks, 5);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.evalOracle,
    details: `evalP0=${evalAuditP0}, seeded=${evalSeededOk ? "ok" : "missing"}, dataset=${datasetOk}, redteam=${redteamOk}, golden=${goldenOk}`,
    evidenceRefs: [
      "artifacts/assurance/static-audit-report.json",
      "artifacts/assurance/seeded-defect-report.json",
      "artifacts/assurance/assurance-full-report.json",
    ],
  };
}

function ciGateScore() {
  const packageJson = readJsonIfExists(join(repoRoot, "package.json"));
  const packageScripts = packageJson?.scripts ?? {};
  const rcCheckSource = readFileSync(join(repoRoot, "scripts", "assurance", "rc-check.mjs"), "utf8");
  const assuranceFullSource = readFileSync(join(repoRoot, "scripts", "assurance", "run-full-assurance.mjs"), "utf8");
  const assuranceCommands = [...ASSURANCE_REQUIRED_COMMANDS, ...P0_COVERAGE_GATES];
  const requiredCommands = [...new Set([...RC_GATED_COMMANDS, ...assuranceCommands])];
  const covered = requiredCommands.filter((command) =>
    commandCovered(command, packageScripts, rcCheckSource, assuranceFullSource, assuranceCommands),
  );
  const score = clampRatio(covered.length, requiredCommands.length);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.ciGate,
    details: `coveredCommands=${covered.length}/${requiredCommands.length}`,
    evidenceRefs: ["package.json", "scripts/assurance/run-full-assurance.mjs", "scripts/assurance/rc-check.mjs"],
  };
}

function regressionSeedScore() {
  const report = readJsonIfExists(join(outputRoot, "test-coverage-report.json"));
  if (!report) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.regressionSeed,
      details: "test-coverage-report.json missing",
      evidenceRefs: [],
    };
  }
  const score = clampRatio(report.summary?.p0BoundCount ?? 0, report.summary?.p0IssueCount ?? 0);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.regressionSeed,
    details: `p0IssueCoverage=${report.summary?.p0BoundCount ?? 0}/${report.summary?.p0IssueCount ?? 0}, unboundP0=${report.summary?.p0UnboundIssues ?? 0}`,
    evidenceRefs: ["artifacts/assurance/test-coverage-report.json"],
  };
}

function releaseClaimScore() {
  const driftReport = readJsonIfExists(join(outputRoot, "historical-promise-drift-report.json"));
  if (!driftReport) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.releaseClaim,
      details: "historical-promise-drift-report.json missing",
      evidenceRefs: [],
    };
  }
  const total = driftReport.releaseClaimCount ?? 0;
  const unsupported = driftReport.strongClaimWithoutArtifacts ?? total;
  const withArtifacts = Math.max(0, total - unsupported);
  const score = total === 0 ? 0 : clampRatio(withArtifacts, total);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.releaseClaim,
    details: `claimsWithArtifacts=${withArtifacts}/${total}, strongClaimWithoutArtifacts=${unsupported}`,
    evidenceRefs: ["artifacts/assurance/historical-promise-drift-report.json"],
  };
}

function auditToolSelfTestScore() {
  const report = readJsonIfExists(join(outputRoot, "seeded-defect-report.json"));
  if (!report) {
    return {
      score: 0,
      threshold: DEFAULT_THRESHOLDS.auditToolSelfTest,
      details: "seeded-defect-report.json missing",
      evidenceRefs: [],
    };
  }
  const categories = Array.isArray(report.results) ? report.results : [];
  const passedTriplets = categories.filter((category) => seededTripletPassed(category)).length;
  const skipped = categories.filter((category) => category.skipped).length;
  const score = clampRatio(passedTriplets, categories.length);
  return {
    score,
    threshold: DEFAULT_THRESHOLDS.auditToolSelfTest,
    details: `tripletCovered=${passedTriplets}/${categories.length}, skipped=${skipped}, failedSeeds=${report.failedSeedCount ?? 0}`,
    evidenceRefs: ["artifacts/assurance/seeded-defect-report.json"],
  };
}

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const stamp = new Date().toISOString();

  const dimensions = {
    sourceInventory: { status: "pass", ...sourceInventoryScore() },
    historicalPromise: { status: "pass", ...historicalPromiseScore() },
    contractSync: { status: "pass", ...contractSyncScore() },
    securityAudit: { status: "pass", ...securityAuditScore() },
    executionInvariant: { status: "pass", ...executionInvariantScore() },
    evalOracle: { status: "pass", ...evalOracleScore() },
    ciGate: { status: "pass", ...ciGateScore() },
    regressionSeed: { status: "pass", ...regressionSeedScore() },
    releaseClaim: { status: "pass", ...releaseClaimScore() },
    auditToolSelfTest: { status: "pass", ...auditToolSelfTestScore() },
  };

  for (const key of Object.keys(dimensions)) {
    const dimension = dimensions[key];
    dimension.status = statusFromScore(dimension.score, dimension.threshold);
  }

  const overallRank = { pass: 0, warn: 1, fail: 2 };
  const overall = Object.values(dimensions).reduce(
    (acc, dimension) => Math.max(acc, overallRank[dimension.status]),
    0,
  );
  const overallStatus = overall === 0 ? "pass" : overall === 1 ? "warn" : "fail";
  const blockingReasons = Object.entries(dimensions)
    .filter(([, dimension]) => dimension.status === "fail")
    .map(([key, dimension]) => `${key} score=${dimension.score.toFixed(2)} < threshold=${dimension.threshold}`);

  const report = {
    generatedAt: stamp,
    repoRoot,
    overallStatus,
    releaseBlocked: overallStatus === "fail",
    blockingReasons,
    dimensions,
  };

  writeFileSync(join(outputRoot, "audit-coverage-scorecard.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outputRoot, "coverage-scorecard.json"), JSON.stringify(report, null, 2));

  const markdown = [
    "# Audit Coverage Scorecard",
    "",
    `Generated: ${stamp}`,
    `Overall: **${overallStatus}** ${report.releaseBlocked ? "(release blocked)" : ""}`,
    "",
    "| Dimension | Status | Score | Threshold | Details |",
    "|---|---|---:|---:|---|",
    ...Object.entries(dimensions).map(([key, dimension]) =>
      `| ${key} | ${dimension.status} | ${dimension.score.toFixed(2)} | ${dimension.threshold} | ${dimension.details} |`,
    ),
    "",
    "## Blocking reasons",
    "",
    ...(blockingReasons.length === 0 ? ["(none)"] : blockingReasons.map((reason) => `- ${reason}`)),
  ].join("\n");

  writeFileSync(join(outputRoot, "audit-coverage-scorecard.md"), markdown + "\n");
  writeFileSync(join(outputRoot, "coverage-scorecard.md"), markdown + "\n");

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.releaseBlocked) {
    process.exitCode = 1;
  }
}

main();
