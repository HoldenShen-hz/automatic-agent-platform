#!/usr/bin/env node
/**
 * rc:check — release readiness aggregator
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §3.3.
 * Runs in order:
 *   1. assurance:full
 *   2. test:p0 (test:invariants + test:regression:p0)
 *   3. test:chaos:p0
 *   4. test:redteam:p0
 *   5. test:golden:strict
 *   6. test:audit-tools
 *   7. test:seeded-defects
 *   8. evidence:bundle:create
 *   9. evidence:bundle:verify
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(process.cwd());
const outputDir = join(repoRoot, "artifacts", "release");
const scriptPath = fileURLToPath(import.meta.url);

const STEPS = [
  { id: "assurance:full", required: true, command: "assurance:full" },
  { id: "test:p0", required: true, command: "test:p0" },
  { id: "test:chaos:p0", required: true, command: "test:chaos:p0" },
  { id: "test:redteam:p0", required: true, command: "test:redteam:p0" },
  { id: "test:golden:strict", required: true, command: "test:golden:strict" },
  { id: "test:audit-tools", required: true, command: "test:audit-tools" },
  { id: "test:seeded-defects", required: true, command: "test:seeded-defects" },
  { id: "evidence:bundle:create", required: true, command: "evidence:bundle:create" },
  { id: "evidence:bundle:verify", required: true, command: "evidence:bundle:verify" },
];
const ACTIVE_RELEASE_PATH_PREFIXES = [
  "src/",
  "ui/",
  "scripts/",
  "config/",
  "deploy/",
  ".github/",
  "docs_zh/",
  "docs_en/",
];
const NON_BLOCKING_RELEASE_PATH_PREFIXES = [
  "tests/",
  "artifacts/",
  "dist/",
];

function runStep(step) {
  const startedAt = new Date().toISOString();
  try {
    execFileSync("npm", ["run", step.command], {
      cwd: repoRoot,
      stdio: "inherit",
      encoding: "utf8",
    });
    return {
      id: step.id,
      required: step.required,
      command: `npm run ${step.command}`,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: 0,
      ok: true,
    };
  } catch (e) {
    return {
      id: step.id,
      required: step.required,
      command: `npm run ${step.command}`,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: e.status ?? 1,
      ok: false,
    };
  }
}

function buildPendingStep(step) {
  return {
    id: step.id,
    required: step.required,
    command: `npm run ${step.command}`,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    ok: null,
    pending: true,
  };
}

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readJsonlIfExists(path) {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function isValidIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function determineRcGateMode(env = process.env) {
  const raw = String(env.AA_ASSURANCE_GATE_MODE ?? "observe").trim().toLowerCase();
  if (raw === "enforce" || raw === "strict") {
    return "enforce";
  }
  return "observe";
}

export function isReleaseBlockingPath(path) {
  if (typeof path !== "string" || path.length === 0) {
    return false;
  }
  const normalized = path.replaceAll("\\", "/");
  if (NON_BLOCKING_RELEASE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return ACTIVE_RELEASE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function loadReleaseGateOverrides(rootDir = repoRoot) {
  const overridePath = join(rootDir, "data", "governance", "release-gate-overrides.json");
  const payload = readJsonIfExists(overridePath);
  if (payload == null) {
    return {
      path: overridePath,
      overrides: [],
      invalidOverrides: [],
    };
  }

  const overrides = [];
  const invalidOverrides = [];
  for (const record of Array.isArray(payload.overrides) ? payload.overrides : []) {
    const blockerIds = Array.isArray(record?.blockerIds)
      ? record.blockerIds.filter((value) => typeof value === "string" && value.trim().length > 0)
      : [];
    const expiryValid = isValidIsoDate(record?.expiry);
    const requiredStrings = ["overrideId", "owner", "reason", "riskAcceptance", "followUpIssue"]
      .every((field) => typeof record?.[field] === "string" && record[field].trim().length > 0);
    if (blockerIds.length === 0 || !expiryValid || !requiredStrings) {
      invalidOverrides.push({
        overrideId: typeof record?.overrideId === "string" ? record.overrideId : null,
        blockerIds,
        reason: "invalid_override_shape",
      });
      continue;
    }
    overrides.push({
      overrideId: record.overrideId,
      blockerIds,
      owner: record.owner,
      expiry: record.expiry,
      reason: record.reason,
      riskAcceptance: record.riskAcceptance,
      followUpIssue: record.followUpIssue,
      approvedAt: typeof record.approvedAt === "string" ? record.approvedAt : null,
    });
  }

  return { path: overridePath, overrides, invalidOverrides };
}

export function applyReleaseGateOverrides(releaseBlockers, overrideLedger, gateMode, now = new Date()) {
  const activeOverrideIds = new Set();
  const expiredOverrideIds = [];
  const invalidOverrideIds = overrideLedger.invalidOverrides.map((record) => record.overrideId).filter(Boolean);
  const blockers = releaseBlockers.blockers.map((blocker) => {
    const matching = overrideLedger.overrides.filter((override) => override.blockerIds.includes(blocker.blockerId));
    const active = matching.filter((override) => new Date(override.expiry).getTime() > now.getTime());
    const expired = matching.filter((override) => new Date(override.expiry).getTime() <= now.getTime());
    for (const record of active) {
      activeOverrideIds.add(record.overrideId);
    }
    for (const record of expired) {
      expiredOverrideIds.push(record.overrideId);
    }
    if (gateMode === "observe" && blocker.observeOnly !== true && active.length > 0) {
      return {
        ...blocker,
        overridden: true,
        overrideRefs: active.map((record) => record.overrideId),
        overrideMetadata: active,
      };
    }
    return {
      ...blocker,
      overridden: false,
      overrideRefs: active.map((record) => record.overrideId),
      overrideMetadata: active,
      expiredOverrideRefs: expired.map((record) => record.overrideId),
    };
  });

  const active = blockers.filter((blocker) => blocker.count > 0);
  const enforced = active.filter((blocker) =>
    (gateMode === "enforce" || blocker.observeOnly !== true) && blocker.overridden !== true,
  );
  return {
    ...releaseBlockers,
    blockers,
    blockerCount: active.length,
    overriddenBlockers: active.filter((blocker) => blocker.overridden === true).map((blocker) => blocker.blockerId),
    overriddenBy: [...activeOverrideIds],
    expiredOverrideIds: [...new Set(expiredOverrideIds)],
    invalidOverrideIds: [...new Set(invalidOverrideIds)],
    enforcedBlockers: enforced.map((blocker) => blocker.blockerId),
    status: enforced.length === 0 && invalidOverrideIds.length === 0 ? "pass" : "fail",
  };
}

function countStaticAuditFindings(staticAuditReport, auditId) {
  return (staticAuditReport?.findings ?? []).filter((finding) =>
    finding.auditId === auditId &&
    finding.severity === "P0" &&
    isReleaseBlockingPath(finding.path),
  ).length;
}

export function countP0AlertsWithoutRunbooks(rootDir = repoRoot) {
  const registryPath = join(rootDir, "config", "validation", "platform-validation-registry.json");
  const registry = readJsonIfExists(registryPath);
  if (registry == null) {
    return 1;
  }

  const metadataPathValue = registry?.sources?.runbookMetadata;
  if (typeof metadataPathValue !== "string" || metadataPathValue.trim().length === 0) {
    return 1;
  }
  const metadataPath = join(rootDir, metadataPathValue);
  const metadata = readJsonIfExists(metadataPath);
  if (metadata == null || !Array.isArray(metadata.runbooks)) {
    return 1;
  }

  const runbookEntries = Array.isArray(registry.runbooks) ? registry.runbooks : [];
  const gateEntries = Array.isArray(registry.gates) ? registry.gates : [];
  const runbookById = new Map(runbookEntries
    .filter((entry) => typeof entry?.runbookId === "string")
    .map((entry) => [entry.runbookId, entry]));
  const metadataById = new Map(metadata.runbooks
    .filter((entry) => typeof entry?.runbookId === "string")
    .map((entry) => [entry.runbookId, entry]));

  let blockerCount = 0;
  for (const gate of gateEntries) {
    if (typeof gate?.runbookId !== "string" || gate.runbookId.trim().length === 0) {
      blockerCount += 1;
      continue;
    }
    const runbookRef = runbookById.get(gate.runbookId);
    const runbookMeta = metadataById.get(gate.runbookId);
    const severity = typeof runbookMeta?.severity === "string" ? runbookMeta.severity : "unknown";
    const runbookPath = typeof runbookRef?.path === "string" ? runbookRef.path : null;
    const runbookExists = runbookPath != null && existsSync(join(rootDir, runbookPath));
    const missingLink = runbookRef == null || runbookMeta == null || runbookExists !== true;
    if ((severity === "P0" || severity === "unknown") && missingLink) {
      blockerCount += 1;
    }
  }

  return blockerCount;
}

export function countUnsignedEvidenceBundleIssues(rootDir = repoRoot, stepResults = [], reportPhase = "sealed") {
  if (reportPhase === "prebundle") {
    return 0;
  }

  const bundlePresent = existsSync(join(rootDir, "artifacts", "release", "evidence-bundle.json"));
  const signaturePresent = existsSync(join(rootDir, "artifacts", "release", "evidence-bundle.sig"));
  const createFailed = stepResults.some((result) => result.id === "evidence:bundle:create" && result.ok === false);
  const verifyFailed = stepResults.some((result) => result.id === "evidence:bundle:verify" && result.ok === false);

  return bundlePresent && signaturePresent && !createFailed && !verifyFailed ? 0 : 1;
}

export function collectReleaseBlockersFromArtifacts(rootDir = repoRoot, options = {}) {
  const assuranceRoot = join(rootDir, "artifacts", "assurance");
  const staticAuditReport = readJsonIfExists(join(assuranceRoot, "static-audit-report.json"));
  const evalOracleReport = readJsonIfExists(join(assuranceRoot, "eval-oracle-report.json"));
  const historicalPromiseDrift = readJsonIfExists(join(assuranceRoot, "historical-promise-drift-report.json"));
  const testCoverageReport = readJsonIfExists(join(assuranceRoot, "test-coverage-report.json"));
  const issueLedger = readJsonlIfExists(join(assuranceRoot, "issues.deduped.jsonl"));
  const seededDefectReport = readJsonIfExists(join(assuranceRoot, "seeded-defect-report.json"));
  const reportPhase = options.reportPhase ?? "sealed";
  const stepResults = Array.isArray(options.stepResults) ? options.stepResults : [];

  const blockers = [
    {
      blockerId: "open_p0_issues",
      count: issueLedger.filter((issue) =>
        issue.severity === "P0" &&
        issue.status === "open" &&
        isReleaseBlockingPath(String(issue.sourceRef ?? "").split(":")[0]),
      ).length,
      evidenceRefs: ["artifacts/assurance/issues.deduped.jsonl"],
      observeOnly: true,
    },
    {
      blockerId: "contract_drift_p0",
      count: countStaticAuditFindings(staticAuditReport, "contracts_sync"),
      evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
      observeOnly: false,
    },
    {
      blockerId: "secret_sink_p0",
      count: countStaticAuditFindings(staticAuditReport, "secret_sinks"),
      evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
      observeOnly: true,
    },
    {
      blockerId: "tenant_isolation_p0",
      count: countStaticAuditFindings(staticAuditReport, "tenant_isolation"),
      evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
      observeOnly: true,
    },
    {
      blockerId: "eval_oracle_fake_pass",
      count: (evalOracleReport?.findings ?? []).filter((finding) =>
        finding.severity === "P0" &&
        isReleaseBlockingPath(finding.path),
      ).length,
      evidenceRefs: ["artifacts/assurance/eval-oracle-report.json"],
      observeOnly: true,
    },
    {
      blockerId: "release_claim_unverified",
      count: historicalPromiseDrift?.strongClaimWithoutArtifacts ?? 0,
      evidenceRefs: ["artifacts/assurance/historical-promise-drift-report.json"],
      observeOnly: true,
    },
    {
      blockerId: "plugin_verification_fail_open",
      count: countStaticAuditFindings(staticAuditReport, "plugin_security"),
      evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
      observeOnly: true,
    },
    {
      blockerId: "side_effect_receipt_missing",
      count: countStaticAuditFindings(staticAuditReport, "side_effect_receipt"),
      evidenceRefs: ["artifacts/assurance/static-audit-report.json"],
      observeOnly: false,
    },
    {
      blockerId: "p0_issue_missing_test_binding",
      count: testCoverageReport?.summary?.p0UnboundIssues ?? 0,
      evidenceRefs: ["artifacts/assurance/test-coverage-report.json"],
      observeOnly: false,
    },
    {
      blockerId: "p0_audit_gate_lacks_seeded_defect_test",
      count: (seededDefectReport?.results ?? []).filter((result) =>
        Array.isArray(result.seeds) &&
        result.seeds.length > 0 &&
        result.seeds.some((seed) => seed.pass !== true),
      ).length,
      evidenceRefs: ["artifacts/assurance/seeded-defect-report.json"],
      observeOnly: false,
    },
    {
      blockerId: "unsigned_evidence_bundle",
      count: countUnsignedEvidenceBundleIssues(rootDir, stepResults, reportPhase),
      evidenceRefs: [
        "artifacts/release/evidence-bundle.json",
        "artifacts/release/evidence-bundle.sig",
      ],
      observeOnly: false,
    },
    {
      blockerId: "p0_alert_without_runbook",
      count: countP0AlertsWithoutRunbooks(rootDir),
      evidenceRefs: [
        "config/validation/platform-validation-registry.json",
      ],
      observeOnly: false,
    },
  ];

  return blockers;
}

function summarizeReleaseBlockers(blockers, gateMode) {
  const active = blockers.filter((blocker) => blocker.count > 0);
  const enforceable = active.filter((blocker) => gateMode === "enforce" || blocker.observeOnly !== true);
  return {
    gateMode,
    blockerCount: active.length,
    blockers: active,
    observeOnlyBlockers: active.filter((blocker) => blocker.observeOnly === true).map((blocker) => blocker.blockerId),
    enforcedBlockers: enforceable.map((blocker) => blocker.blockerId),
    status: enforceable.length === 0 ? "pass" : "fail",
  };
}

export function buildRcCheckReport(results, options = {}) {
  const stamp = options.generatedAt ?? new Date().toISOString();
  const failed = results.filter((r) => r.required && r.ok === false).map((r) => r.id);
  const gateMode = options.gateMode ?? determineRcGateMode();
  const releaseBlockers = options.releaseBlockers ?? applyReleaseGateOverrides(
    summarizeReleaseBlockers(
      collectReleaseBlockersFromArtifacts(options.repoRoot ?? repoRoot, {
        reportPhase: options.reportPhase ?? "final",
        stepResults: results,
      }),
      gateMode,
    ),
    options.overrideLedger ?? loadReleaseGateOverrides(options.repoRoot ?? repoRoot),
    gateMode,
  );
  const failedReleaseBlockers =
    releaseBlockers.status === "fail"
      ? releaseBlockers.enforcedBlockers
        : [];
  const failedReleaseOverrideIds = releaseBlockers.status === "fail"
    ? (releaseBlockers.invalidOverrideIds ?? [])
    : [];
  return {
    generatedAt: stamp,
    repoRoot,
    mode: "rc",
    gateMode,
    reportPhase: options.reportPhase ?? "final",
    status:
      failed.length === 0 &&
      failedReleaseBlockers.length === 0 &&
      failedReleaseOverrideIds.length === 0
        ? "pass"
        : "fail",
    failedSteps: failed,
    failedReleaseBlockers,
    failedReleaseOverrideIds,
    executedSteps: results,
    releaseBlockers,
    evidenceBundleRef:
      failed.length === 0 &&
      failedReleaseBlockers.length === 0 &&
      failedReleaseOverrideIds.length === 0 &&
      existsSync(join(outputDir, "evidence-bundle.json"))
        ? "artifacts/release/evidence-bundle.json"
        : null,
  };
}

function persistRcCheckReport(results, options = {}) {
  const report = buildRcCheckReport(results, options);
  writeFileSync(join(outputDir, "rc-check-report.json"), JSON.stringify(report, null, 2));
  return report;
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  const results = [];
  const evidenceStartIndex = STEPS.findIndex((step) => step.id === "evidence:bundle:create");
  const gateMode = determineRcGateMode();

  for (let index = 0; index < evidenceStartIndex; index++) {
    results.push(runStep(STEPS[index]));
  }

  const pendingEvidenceSteps = STEPS.slice(evidenceStartIndex).map(buildPendingStep);
  persistRcCheckReport([...results, ...pendingEvidenceSteps], {
    reportPhase: "prebundle",
    gateMode,
  });

  for (const step of STEPS.slice(evidenceStartIndex)) {
    const result = runStep(step);
    results.push(result);
  }

  const finalReport = persistRcCheckReport(results, {
    reportPhase: "preseal",
    gateMode,
  });

  const sealResults = [];
  for (const step of STEPS.slice(evidenceStartIndex)) {
    sealResults.push(runStep(step));
  }
  const sealFailed = sealResults.filter((result) => result.required && !result.ok).map((result) => result.id);

  const summary = {
    ...finalReport,
    reportPhase: sealFailed.length === 0 ? "sealed" : "seal_failed",
    finalSealResults: sealResults,
    status:
      finalReport.failedSteps.length === 0 &&
      finalReport.failedReleaseBlockers.length === 0 &&
      finalReport.failedReleaseOverrideIds.length === 0 &&
      sealFailed.length === 0
        ? "pass"
        : "fail",
    failedSteps: [...new Set([...finalReport.failedSteps, ...sealFailed])],
    failedReleaseBlockers: finalReport.failedReleaseBlockers,
    failedReleaseOverrideIds: finalReport.failedReleaseOverrideIds,
    evidenceBundleRef:
      finalReport.failedSteps.length === 0 &&
      finalReport.failedReleaseBlockers.length === 0 &&
      finalReport.failedReleaseOverrideIds.length === 0 &&
      sealFailed.length === 0 &&
      existsSync(join(outputDir, "evidence-bundle.json"))
        ? "artifacts/release/evidence-bundle.json"
        : null,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (
    summary.failedSteps.length > 0 ||
    summary.failedReleaseBlockers.length > 0 ||
    summary.failedReleaseOverrideIds.length > 0
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] != null && resolve(process.argv[1]).replaceAll("\\", "/") === scriptPath.replaceAll("\\", "/")) {
  main();
}
