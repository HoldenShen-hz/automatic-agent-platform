import { existsSync } from "node:fs";
import { join } from "node:path";

import { buildDivisionInventory } from "./audit-division-inventory.mjs";
import {
  P0_DIVISION_IDS,
  ensureDir,
  listFiles,
  loadYamlObject,
  parseCliArgs,
  readJsonFile,
  resolvePlatformRoot,
  toIsoDate,
  toObjectArray,
  writeJsonFile,
  writeTextFile,
} from "./division-coverage-lib.mjs";

const PRODUCTION_READY_EVIDENCE_MAX_AGE_DAYS = 90;
const PRODUCTION_READY_EVIDENCE_MAX_AGE_MS = PRODUCTION_READY_EVIDENCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function readEvalDatasetCards(platformRoot) {
  const root = join(platformRoot, "eval", "datasets");
  if (!existsSync(root)) {
    return [];
  }
  return listFiles(root, 5)
    .filter((path) => path.endsWith("dataset-card.json"))
    .map((path) => readJsonFile(path, null))
    .filter(Boolean);
}

function normalizeIsoOrNull(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function isEvidenceExpired(iso, now) {
  if (iso == null) {
    return true;
  }
  return Date.parse(iso) + PRODUCTION_READY_EVIDENCE_MAX_AGE_MS < now.getTime();
}

function readClaimStatusOverrides(platformRoot) {
  const overridesPath = join(platformRoot, "data", "governance", "leadership-claim-status-overrides.json");
  const overrides = readJsonFile(overridesPath, []);
  return new Set(
    toObjectArray(overrides)
      .filter((entry) => entry.status === "revoked" && typeof entry.claimId === "string")
      .map((entry) => entry.claimId),
  );
}

function readApprovedClaims(platformRoot, now) {
  const revokedClaimIds = readClaimStatusOverrides(platformRoot);
  const claims = loadYamlObject(join(platformRoot, "config", "division-coverage", "claims", "records.yaml"));
  return toObjectArray(claims.claims)
    .map((entry) => ({
      claimId: typeof entry.claimId === "string" ? entry.claimId : "unknown-claim",
      familyId: typeof entry.familyId === "string" ? entry.familyId : null,
      divisionId: typeof entry.divisionId === "string" ? entry.divisionId : null,
      status: typeof entry.status === "string" ? entry.status : "draft",
      expiresAt: normalizeIsoOrNull(entry.expiresAt),
    }))
    .filter((entry) => {
      if (entry.status !== "approved" || revokedClaimIds.has(entry.claimId)) {
        return false;
      }
      return entry.expiresAt == null || Date.parse(entry.expiresAt) >= now.getTime();
    });
}

function flattenEvidenceRefs(card) {
  return Object.values(card.evidence ?? {}).flatMap((entry) => Array.isArray(entry?.refs) ? entry.refs : []);
}

function validateCoverageCard(card, relativePath) {
  const issues = [];
  if (typeof card.divisionId !== "string") issues.push(`${relativePath}:missing_division_id`);
  if (typeof card.familyId !== "string") issues.push(`${relativePath}:missing_family_id`);
  if (typeof card.status !== "string") issues.push(`${relativePath}:missing_status`);
  if (card.status === "production_ready") {
    const evidenceRefs = Object.values(card.evidence ?? {}).flatMap((entry) => Array.isArray(entry?.refs) ? entry.refs : []);
    if (evidenceRefs.length === 0) {
      issues.push(`${relativePath}:production_ready_without_evidence`);
    }
  }
  return issues;
}

function readToolDescriptor(platformRoot, toolId, actionId) {
  const descriptorPath = join(platformRoot, "config", "tool-risk", "tool-action-descriptors", `${toolId}.yaml`);
  const descriptor = loadYamlObject(descriptorPath);
  return toObjectArray(descriptor.actions).find((entry) => entry.actionId === actionId && typeof entry.riskClass === "string") ?? null;
}

function hasToolDescriptor(platformRoot, toolId, actionId) {
  return readToolDescriptor(platformRoot, toolId, actionId) != null;
}

function validateProductionReadyCard(card, path, scenarios, approvedClaims, now, platformRoot) {
  const blockers = [];
  const divisionId = typeof card.divisionId === "string" ? card.divisionId : null;
  const familyId = typeof card.familyId === "string" ? card.familyId : null;
  if (divisionId == null || familyId == null) {
    return blockers;
  }
  if (flattenEvidenceRefs(card).length === 0) {
    blockers.push(`${path}:production_ready_without_evidence`);
  }
  const hasApprovedClaim = approvedClaims.some((claim) => claim.divisionId === divisionId || (claim.divisionId == null && claim.familyId === familyId));
  if (!hasApprovedClaim) {
    blockers.push(`${path}:production_ready_without_claim_record`);
  }
  const evalUpdatedAt = normalizeIsoOrNull(card.evidence?.evaluation?.lastUpdatedAt);
  if (isEvidenceExpired(evalUpdatedAt, now)) {
    blockers.push(`${path}:expired_eval`);
  }
  const redTeamUpdatedAt = normalizeIsoOrNull(card.evidence?.operation?.lastUpdatedAt);
  if (isEvidenceExpired(redTeamUpdatedAt, now)) {
    blockers.push(`${path}:expired_redteam`);
  }
  for (const scenario of scenarios.filter((entry) => entry.value.divisionId === divisionId)) {
    for (const action of toObjectArray(scenario.value.toolActions)) {
      const toolId = typeof action.toolId === "string" ? action.toolId : null;
      const actionId = typeof action.actionId === "string" ? action.actionId : null;
      if (toolId == null || actionId == null) {
        continue;
      }
      const descriptor = readToolDescriptor(platformRoot, toolId, actionId);
      if (descriptor == null) {
        continue;
      }
      const riskClass = descriptor.riskClass;
      const requiresHitl = descriptor.requiresHITL === true;
      const requiresPreparedAction = descriptor.requiresPreparedAction === true;
      if (["R4", "R5"].includes(riskClass) && !requiresHitl) {
        blockers.push(`${scenario.path}:r3plus_without_hitl:${toolId}:${actionId}`);
        continue;
      }
      if (["R3", "R4", "R5"].includes(riskClass) && !requiresHitl && !requiresPreparedAction) {
        blockers.push(`${scenario.path}:r3plus_without_hitl:${toolId}:${actionId}`);
      }
    }
  }
  return blockers;
}

export function buildDomainCoverageReport(options = {}) {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const mode = options.mode ?? "warning";
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? process.env.AA_FIXED_NOW ?? Date.now());
  const inventory = buildDivisionInventory({ platformRoot, now });
  const coverageCards = listFiles(join(platformRoot, "config", "division-coverage", "divisions"), 2)
    .filter((path) => path.endsWith(".yaml"));
  const familyPolicies = listFiles(join(platformRoot, "config", "division-coverage", "families"), 2)
    .filter((path) => path.endsWith(".yaml"));
  const scenarios = listFiles(join(platformRoot, "config", "division-coverage", "scenarios"), 2)
    .filter((path) => path.endsWith(".yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const evalDatasetCards = readEvalDatasetCards(platformRoot);
  const redTeamSuites = listFiles(join(platformRoot, "redteam", "divisions"), 3)
    .filter((path) => path.endsWith("redteam-suite.yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const trainingPolicies = listFiles(join(platformRoot, "training-data-policy", "divisions"), 2)
    .filter((path) => path.endsWith(".yaml"));
  const approvedClaims = readApprovedClaims(platformRoot, now);

  const warnings = [];
  const blockers = [];

  for (const path of coverageCards) {
    const card = loadYamlObject(path);
    warnings.push(...validateCoverageCard(card, path));
    if (mode === "production-ready" && card.status === "production_ready") {
      blockers.push(...validateProductionReadyCard(card, path, scenarios, approvedClaims, now, platformRoot));
    }
  }

  for (const divisionId of P0_DIVISION_IDS) {
    const inventoryRecord = inventory.records.find((entry) => entry.divisionId === divisionId);
    if (inventoryRecord == null) {
      blockers.push(`p0:${divisionId}:missing_inventory`);
      continue;
    }
    if (!inventoryRecord.hasCoverageCard) blockers.push(`p0:${divisionId}:missing_coverage_card`);
    if (!inventoryRecord.hasScenarioCard) blockers.push(`p0:${divisionId}:missing_scenario_card`);
    if (!inventoryRecord.hasEval) blockers.push(`p0:${divisionId}:missing_eval`);
    if (!inventoryRecord.hasRedTeam) blockers.push(`p0:${divisionId}:missing_redteam`);
    if (!inventoryRecord.hasTrainingPolicy) blockers.push(`p0:${divisionId}:missing_training_policy`);
  }

  for (const scenario of scenarios) {
    for (const action of toObjectArray(scenario.value.toolActions)) {
      const toolId = typeof action.toolId === "string" ? action.toolId : null;
      const actionId = typeof action.actionId === "string" ? action.actionId : null;
      if (toolId == null || actionId == null) {
        warnings.push(`${scenario.path}:invalid_tool_action`);
        continue;
      }
      if (!hasToolDescriptor(platformRoot, toolId, actionId)) {
        blockers.push(`${scenario.path}:missing_descriptor:${toolId}:${actionId}`);
      }
    }
  }

  for (const suite of redTeamSuites) {
    const cases = toObjectArray(suite.value.cases);
    const missingSeverity = cases.some((entry) => typeof entry.severity !== "string");
    if (missingSeverity) {
      blockers.push(`${suite.path}:missing_severity`);
    }
  }

  for (const card of evalDatasetCards) {
    if (card.contaminationStatus === "unknown" && card.allowedForReleaseGate === true) {
      blockers.push(`eval:${card.datasetId}:unknown_contamination_release_gate`);
    }
  }

  if (familyPolicies.length < 6) {
    blockers.push("family_policy:missing_coverage");
  }

  if (trainingPolicies.length === 0) {
    blockers.push("training_policy:missing_all");
  }

  const report = {
    generatedAt: toIsoDate(now),
    mode,
    inventorySummary: inventory.summary,
    warnings: [...new Set(warnings)].sort((left, right) => left.localeCompare(right)),
    blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)),
  };
  return report;
}

export function writeDomainCoverageReport(report, options = {}) {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const reportRoot = join(platformRoot, "config", "division-coverage", "reports");
  ensureDir(reportRoot);
  writeJsonFile(join(reportRoot, "domain-coverage-report.json"), report);
  writeTextFile(join(reportRoot, "domain-coverage-report.md"), [
    "# Domain Coverage Report",
    "",
    `Generated at: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    `Warnings: ${report.warnings.length}`,
    `Blockers: ${report.blockers.length}`,
    "",
    "## Blockers",
    ...report.blockers.map((entry) => `- ${entry}`),
    "",
    "## Warnings",
    ...report.warnings.map((entry) => `- ${entry}`),
  ].join("\n"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flags = parseCliArgs(process.argv.slice(2));
  const mode = flags.mode ?? "warning";
  const report = buildDomainCoverageReport({
    platformRoot: flags.root,
    now: flags.now,
    mode,
  });
  writeDomainCoverageReport(report, { platformRoot: flags.root });
  console.log(`domain_coverage.${mode}:warnings=${report.warnings.length}:blockers=${report.blockers.length}`);
  if (mode !== "warning" && report.blockers.length > 0) {
    process.exitCode = 1;
  }
}
