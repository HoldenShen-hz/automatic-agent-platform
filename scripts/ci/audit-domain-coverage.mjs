import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { buildDivisionInventory } from "./audit-division-inventory.mjs";
import {
  P0_DIVISION_IDS,
  ensureDir,
  listFiles,
  loadYamlObject,
  parseCliArgs,
  readJsonFile,
  toStringArray,
  resolvePlatformRoot,
  toIsoDate,
  toObjectArray,
  writeJsonFile,
  writeTextFile,
} from "./division-coverage-lib.mjs";

const PRODUCTION_READY_EVIDENCE_MAX_AGE_DAYS = 90;
const PRODUCTION_READY_EVIDENCE_MAX_AGE_MS = PRODUCTION_READY_EVIDENCE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const SUITE_STALENESS_MAX_AGE_DAYS = 90;
const SUITE_STALENESS_MAX_AGE_MS = SUITE_STALENESS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const DATASET_CARD_KEYS = [
  "datasetId",
  "divisionId",
  "scenarioId",
  "version",
  "source",
  "taskCount",
  "split",
  "samples",
  "sampleCount",
  "contaminationStatus",
  "contaminationEvidence",
  "privacyStatus",
  "labelingMethod",
  "allowedForTraining",
  "allowedForReleaseGate",
  "retentionPolicyRef",
  "frozenHash",
];
const REDTEAM_SEVERITY_ENUM = ["critical", "high", "medium", "low"];
const TRAINING_POLICY_MODE_ENUM = ["redacted_only", "restricted", "no_train"];
const ROI_METHOD_ENUM = ["before_after", "ab_test", "assisted_vs_manual", "cohort_comparison"];
const TRAINING_REVOCATION_STORE_ENUM = [
  "memory",
  "eval",
  "training_export",
  "analytics",
  "evidence_projection",
  "dashboard_cache",
  "state-evidence",
];

function readEvalDatasetCards(platformRoot) {
  const root = join(platformRoot, "eval", "datasets");
  if (!existsSync(root)) {
    return [];
  }
  return listFiles(root, 5)
    .filter((path) => path.endsWith("dataset-card.json"))
    .map((path) => ({ path, value: readJsonFile(path, null) }))
    .filter((entry) => entry.value != null);
}

function normalizeRelativePath(basePath, candidatePath) {
  return relative(basePath, candidatePath).replace(/\\/g, "/");
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value == null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortValue(entry)]),
  );
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function getUnexpectedKeys(value, allowedKeys) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return allowedKeys;
  }
  return Object.keys(value).filter((key) => !allowedKeys.includes(key));
}

function matchesIsoTimestamp(value) {
  return normalizeIsoOrNull(value) != null;
}

function readReportRefreshTimestamp(platformRoot, reportRef) {
  const reportPath = join(platformRoot, reportRef);
  if (!existsSync(reportPath)) {
    return null;
  }
  const match = readFileSync(reportPath, "utf8").match(/LastRefreshedAt:\s*`([^`]+)`/);
  return normalizeIsoOrNull(match?.[1] ?? null);
}

function computeDatasetFrozenHash(cardPath, card) {
  const datasetDir = dirname(cardPath);
  const extraFiles = listFiles(datasetDir, 3)
    .filter((entry) => entry !== cardPath)
    .map((entry) => ({
      path: normalizeRelativePath(datasetDir, entry),
      content: readFileSync(entry, "utf8"),
    }));
  const payload = {
    card: Object.fromEntries(Object.entries(card).filter(([key]) => key !== "frozenHash")),
    files: extraFiles,
  };
  return `sha256:${createHash("sha256").update(stableStringify(payload)).digest("hex")}`;
}

function readEvalRunnerRegistry(platformRoot, registryRef) {
  const registryPath = join(platformRoot, registryRef);
  const registry = readJsonFile(registryPath, null);
  if (registry == null || typeof registry !== "object") {
    return null;
  }
  const runners = Array.isArray(registry.runners)
    ? registry.runners.filter((entry) => entry != null && typeof entry === "object")
    : [];
  return {
    schema: registry.$schema,
    runners,
  };
}

function countDatasetSamples(platformRoot, samplesRef) {
  const samplesPath = join(platformRoot, samplesRef);
  if (!existsSync(samplesPath)) {
    return { count: 0, error: "missing_samples_path" };
  }
  const stats = statSync(samplesPath);
  if (stats.isFile()) {
    if (!samplesPath.endsWith(".json")) {
      return { count: 1, error: null };
    }
    const parsed = readJsonFile(samplesPath, null);
    if (Array.isArray(parsed)) {
      return { count: parsed.length, error: null };
    }
    if (parsed != null && typeof parsed === "object" && Array.isArray(parsed.samples)) {
      return { count: parsed.samples.length, error: null };
    }
    return { count: 0, error: "invalid_samples_file" };
  }
  const files = listFiles(samplesPath, 5).filter((path) => path.endsWith(".json"));
  return { count: files.length, error: null };
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

function validateEvalDatasetCard(card, path, platformRoot) {
  const blockers = [];
  const unexpectedKeys = getUnexpectedKeys(card, DATASET_CARD_KEYS);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  if (typeof card.datasetId !== "string" || card.datasetId.trim().length === 0) {
    blockers.push(`${path}:missing_dataset_id`);
  }
  if (typeof card.divisionId !== "string" || card.divisionId.trim().length === 0) {
    blockers.push(`${path}:missing_division_id`);
  }
  if (typeof card.taskCount !== "number" || !Number.isInteger(card.taskCount) || card.taskCount < 1) {
    blockers.push(`${path}:invalid_task_count`);
  }
  if (typeof card.sampleCount !== "number" || !Number.isInteger(card.sampleCount) || card.sampleCount < 1) {
    blockers.push(`${path}:invalid_sample_count`);
  }
  if (typeof card.samples !== "string" || card.samples.trim().length === 0) {
    blockers.push(`${path}:missing_samples_ref`);
  } else {
    const sampleSummary = countDatasetSamples(platformRoot, card.samples);
    if (sampleSummary.error != null) {
      blockers.push(`${path}:${sampleSummary.error}`);
    } else {
      if (sampleSummary.count !== card.sampleCount) {
        blockers.push(`${path}:sample_count_mismatch:${sampleSummary.count}:${card.sampleCount}`);
      }
      if (sampleSummary.count !== card.taskCount) {
        blockers.push(`${path}:task_count_mismatch:${sampleSummary.count}:${card.taskCount}`);
      }
    }
  }
  const actualFrozenHash = computeDatasetFrozenHash(join(platformRoot, path), card);
  if (typeof card.frozenHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(card.frozenHash)) {
    blockers.push(`${path}:invalid_frozen_hash_format`);
  } else if (card.frozenHash !== actualFrozenHash) {
    blockers.push(`${path}:frozen_hash_mismatch`);
  }
  if (card.contaminationStatus === "unknown" && card.allowedForReleaseGate === true) {
    blockers.push(`eval:${card.datasetId}:unknown_contamination_release_gate`);
  }
  if (typeof card.retentionPolicyRef !== "string" || !existsSync(join(platformRoot, card.retentionPolicyRef))) {
    blockers.push(`${path}:missing_retention_policy_ref`);
  }
  return blockers;
}

function validateEvalSuite(suite, path, platformRoot, now) {
  const blockers = [];
  const allowedKeys = ["$schema", "divisionId", "datasetCardRef", "runnerRegistryRef", "runner", "reportRef", "lastRefreshedAt", "metrics"];
  const unexpectedKeys = getUnexpectedKeys(suite, allowedKeys);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  const divisionId = typeof suite.divisionId === "string" ? suite.divisionId : null;
  if (suite.$schema !== "eval/schemas/eval-suite.schema.json") {
    blockers.push(`${path}:invalid_schema_ref`);
  }
  if (typeof suite.reportRef !== "string" || divisionId == null || suite.reportRef !== `docs_zh/divisions/${divisionId}/leadership-evidence/eval-report.md`) {
    blockers.push(`${path}:report_ref_mismatch`);
  }
  if (typeof suite.datasetCardRef !== "string" || !existsSync(join(platformRoot, suite.datasetCardRef))) {
    blockers.push(`${path}:missing_dataset_card_ref`);
  }
  if (suite.runnerRegistryRef !== "eval/runner-registry.json") {
    blockers.push(`${path}:invalid_runner_registry_ref`);
  }
  const runner = suite.runner;
  if (runner == null || typeof runner !== "object" || Array.isArray(runner)) {
    blockers.push(`${path}:missing_runner`);
  } else {
    const registry = readEvalRunnerRegistry(platformRoot, suite.runnerRegistryRef ?? "");
    if (registry == null || registry.schema !== "eval/schemas/eval-runner-registry.schema.json") {
      blockers.push(`${path}:invalid_runner_registry`);
    } else {
      const runnerId = typeof runner.runnerId === "string" ? runner.runnerId : null;
      const runnerVersion = typeof runner.runnerVersion === "string" ? runner.runnerVersion : null;
      const implementationRef = typeof runner.implementationRef === "string" ? runner.implementationRef : null;
      if (runnerId == null || runnerVersion == null || implementationRef == null) {
        blockers.push(`${path}:invalid_runner_descriptor`);
      } else {
        const registryEntry = registry.runners.find((entry) =>
          entry.runnerId === runnerId
          && entry.runnerVersion === runnerVersion
          && entry.implementationRef === implementationRef
        );
        if (registryEntry == null) {
          blockers.push(`${path}:unregistered_runner:${runnerId}`);
        }
        if (!existsSync(join(platformRoot, implementationRef))) {
          blockers.push(`${path}:missing_runner_implementation_ref:${runnerId}`);
        }
      }
    }
  }
  if (!matchesIsoTimestamp(suite.lastRefreshedAt)) {
    blockers.push(`${path}:invalid_last_refreshed_at`);
  }
  const reportRefreshTimestamp = typeof suite.reportRef === "string"
    ? readReportRefreshTimestamp(platformRoot, suite.reportRef)
    : null;
  if (reportRefreshTimestamp == null) {
    blockers.push(`${path}:missing_report_refresh_timestamp`);
  } else if (normalizeIsoOrNull(suite.lastRefreshedAt) !== reportRefreshTimestamp) {
    blockers.push(`${path}:last_refreshed_at_mismatch`);
  }
  const refreshedAt = normalizeIsoOrNull(suite.lastRefreshedAt);
  if (refreshedAt == null || Date.parse(refreshedAt) + SUITE_STALENESS_MAX_AGE_MS < now.getTime()) {
    blockers.push(`${path}:stale_eval_suite`);
  }
  if (toStringArray(suite.metrics).length === 0) {
    blockers.push(`${path}:missing_metrics`);
  }
  return blockers;
}

function validateRedTeamSuite(suite, path, platformRoot, now) {
  const blockers = [];
  const allowedKeys = [
    "$schema",
    "divisionId",
    "caseCount",
    "reportRef",
    "lastRefreshedAt",
    "runner",
    "result",
    "criticalSuccessCount",
    "releaseBlocking",
    "cases",
  ];
  const unexpectedKeys = getUnexpectedKeys(suite, allowedKeys);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  const divisionId = typeof suite.divisionId === "string" ? suite.divisionId : null;
  if (suite.$schema !== "redteam/schemas/redteam-suite.schema.json") {
    blockers.push(`${path}:invalid_schema_ref`);
  }
  if (typeof suite.reportRef !== "string" || divisionId == null || suite.reportRef !== `docs_zh/divisions/${divisionId}/leadership-evidence/redteam-report.md`) {
    blockers.push(`${path}:report_ref_mismatch`);
  }
  if (!matchesIsoTimestamp(suite.lastRefreshedAt)) {
    blockers.push(`${path}:invalid_last_refreshed_at`);
  }
  const reportRefreshTimestamp = typeof suite.reportRef === "string"
    ? readReportRefreshTimestamp(platformRoot, suite.reportRef)
    : null;
  if (reportRefreshTimestamp == null) {
    blockers.push(`${path}:missing_report_refresh_timestamp`);
  } else if (normalizeIsoOrNull(suite.lastRefreshedAt) !== reportRefreshTimestamp) {
    blockers.push(`${path}:last_refreshed_at_mismatch`);
  }
  const cases = toObjectArray(suite.cases);
  if (!Number.isInteger(suite.caseCount) || suite.caseCount !== cases.length || suite.caseCount < 1) {
    blockers.push(`${path}:invalid_case_count`);
  }
  const refreshedAt = normalizeIsoOrNull(suite.lastRefreshedAt);
  if (refreshedAt == null || Date.parse(refreshedAt) + SUITE_STALENESS_MAX_AGE_MS < now.getTime()) {
    blockers.push(`${path}:stale_redteam_suite`);
  }
  for (const entry of cases) {
    if (typeof entry.caseId !== "string" || entry.caseId.trim().length === 0) {
      blockers.push(`${path}:missing_case_id`);
    }
    if (!REDTEAM_SEVERITY_ENUM.includes(entry.severity)) {
      blockers.push(`${path}:invalid_severity:${entry.caseId ?? "unknown"}`);
    }
    if (typeof entry.objective !== "string" || entry.objective.trim().length === 0) {
      blockers.push(`${path}:missing_objective:${entry.caseId ?? "unknown"}`);
    }
    if (typeof entry.scope !== "string" || entry.scope.trim().length === 0) {
      blockers.push(`${path}:missing_scope:${entry.caseId ?? "unknown"}`);
    }
    if (toStringArray(entry.evidenceRefs).length === 0) {
      blockers.push(`${path}:missing_evidence_refs:${entry.caseId ?? "unknown"}`);
    }
  }
  return blockers;
}

function validateScenarioBindings(scenario, path, platformRoot) {
  const blockers = [];
  const outputActions = toStringArray(scenario.outputActions);
  const bindings = toObjectArray(scenario.outputActionBindings);
  if (outputActions.length === 0) {
    blockers.push(`${path}:missing_output_actions`);
    return blockers;
  }
  if (bindings.length === 0) {
    blockers.push(`${path}:missing_output_action_bindings`);
    return blockers;
  }
  const toolActionKeys = new Set(
    toObjectArray(scenario.toolActions)
      .map((entry) => {
        const toolId = typeof entry.toolId === "string" ? entry.toolId : null;
        const actionId = typeof entry.actionId === "string" ? entry.actionId : null;
        return toolId != null && actionId != null ? `${toolId}:${actionId}` : null;
      })
      .filter((entry) => entry != null),
  );
  for (const outputActionId of outputActions) {
    const binding = bindings.find((entry) => entry.outputActionId === outputActionId);
    if (binding == null) {
      blockers.push(`${path}:missing_output_binding:${outputActionId}`);
      continue;
    }
    if (typeof binding.bindingType !== "string") {
      blockers.push(`${path}:invalid_output_binding_type:${outputActionId}`);
      continue;
    }
    if (binding.bindingType === "tool_action") {
      const toolId = typeof binding.toolId === "string" ? binding.toolId : null;
      const actionId = typeof binding.actionId === "string" ? binding.actionId : null;
      if (toolId == null || actionId == null) {
        blockers.push(`${path}:invalid_tool_output_binding:${outputActionId}`);
        continue;
      }
      const actionKey = `${toolId}:${actionId}`;
      if (!toolActionKeys.has(actionKey)) {
        blockers.push(`${path}:missing_bound_tool_action:${outputActionId}:${actionKey}`);
        continue;
      }
      if (!hasToolDescriptor(platformRoot, toolId, actionId)) {
        blockers.push(`${path}:missing_descriptor:${toolId}:${actionId}`);
      }
    }
  }
  return blockers;
}

function validateRoiDivisionConfig(config, path, platformRoot) {
  const blockers = [];
  const allowedKeys = [
    "$schema",
    "divisionId",
    "protocolRef",
    "method",
    "sampleWindow",
    "minimumSampleSize",
    "metrics",
    "costDeltaMetrics",
    "qualityDeltaMetrics",
    "riskDeltaMetrics",
    "confidence",
    "confidenceCalculation",
  ];
  const unexpectedKeys = getUnexpectedKeys(config, allowedKeys);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  if (config.$schema !== "roi/schemas/division-roi.schema.json") {
    blockers.push(`${path}:invalid_schema_ref`);
  }
  if (config.protocolRef !== "roi/measurement-protocol.md" || !existsSync(join(platformRoot, "roi", "measurement-protocol.md"))) {
    blockers.push(`${path}:invalid_protocol_ref`);
  }
  if (!ROI_METHOD_ENUM.includes(config.method)) {
    blockers.push(`${path}:invalid_method`);
  }
  if (!Number.isInteger(config.minimumSampleSize) || config.minimumSampleSize < 1) {
    blockers.push(`${path}:invalid_minimum_sample_size`);
  }
  if (toStringArray(config.metrics).length === 0) {
    blockers.push(`${path}:missing_metrics`);
  }
  if (toStringArray(config.costDeltaMetrics).length === 0) {
    blockers.push(`${path}:missing_cost_delta_metrics`);
  }
  if (toStringArray(config.qualityDeltaMetrics).length === 0) {
    blockers.push(`${path}:missing_quality_delta_metrics`);
  }
  if (toStringArray(config.riskDeltaMetrics).length === 0) {
    blockers.push(`${path}:missing_risk_delta_metrics`);
  }
  if (typeof config.confidenceCalculation !== "string" || config.confidenceCalculation.trim().length === 0) {
    blockers.push(`${path}:missing_confidence_calculation`);
  }
  return blockers;
}

function validateTrainingPolicyConfig(config, path) {
  const blockers = [];
  const allowedKeys = [
    "$schema",
    "divisionId",
    "policyMode",
    "policyModeRef",
    "allowedSources",
    "forbiddenSources",
    "restrictedClasses",
    "heldoutTrainingPolicy",
    "requiresModelDataTombstone",
  ];
  const unexpectedKeys = getUnexpectedKeys(config, allowedKeys);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  if (config.$schema !== "training-data-policy/schemas/division-policy.schema.json") {
    blockers.push(`${path}:invalid_schema_ref`);
  }
  if (!TRAINING_POLICY_MODE_ENUM.includes(config.policyMode)) {
    blockers.push(`${path}:invalid_policy_mode`);
  }
  if (config.policyModeRef !== "training-data-policy/policy-modes.md") {
    blockers.push(`${path}:invalid_policy_mode_ref`);
  }
  if (config.policyMode !== "no_train" && toStringArray(config.allowedSources).length === 0) {
    blockers.push(`${path}:missing_allowed_sources`);
  }
  if (config.policyMode === "restricted" && toStringArray(config.restrictedClasses).length === 0) {
    blockers.push(`${path}:missing_restricted_classes`);
  }
  if (typeof config.heldoutTrainingPolicy !== "string" || !["no_train", "redacted_only", "restricted"].includes(config.heldoutTrainingPolicy)) {
    blockers.push(`${path}:invalid_heldout_training_policy`);
  }
  if (typeof config.requiresModelDataTombstone !== "boolean") {
    blockers.push(`${path}:invalid_requires_model_data_tombstone`);
  }
  if (toStringArray(config.forbiddenSources).length === 0) {
    blockers.push(`${path}:missing_forbidden_sources`);
  }
  return blockers;
}

function validateTrainingRevocationConfig(config, path) {
  const blockers = [];
  const allowedKeys = [
    "$schema",
    "version",
    "affectedStores",
    "requiresModelDataTombstone",
    "customerDeletionPropagation",
    "sourceInvalidationPropagation",
  ];
  const unexpectedKeys = getUnexpectedKeys(config, allowedKeys);
  if (unexpectedKeys.length > 0) {
    blockers.push(`${path}:unexpected_keys:${unexpectedKeys.join(",")}`);
  }
  if (config.$schema !== "training-data-policy/schemas/revocation.schema.json") {
    blockers.push(`${path}:invalid_schema_ref`);
  }
  if (typeof config.version !== "string" || !/^v\d+\.\d+$/.test(config.version)) {
    blockers.push(`${path}:invalid_version`);
  }
  for (const key of ["affectedStores", "customerDeletionPropagation", "sourceInvalidationPropagation"]) {
    const values = toStringArray(config[key]);
    if (values.length === 0) {
      blockers.push(`${path}:missing_${key}`);
      continue;
    }
    if (values.some((entry) => !TRAINING_REVOCATION_STORE_ENUM.includes(entry))) {
      blockers.push(`${path}:invalid_${key}`);
    }
  }
  if (typeof config.requiresModelDataTombstone !== "boolean") {
    blockers.push(`${path}:invalid_requires_model_data_tombstone`);
  }
  return blockers;
}

function buildFamilyReadinessBlockers(platformRoot, inventoryRecords) {
  const familyReadiness = loadYamlObject(join(platformRoot, "config", "division-coverage", "family-readiness.yaml"));
  const blockers = [];
  for (const family of toObjectArray(familyReadiness.families)) {
    const familyId = typeof family.familyId === "string" ? family.familyId : "unknown-family";
    const readinessStatus = typeof family.readinessStatus === "string" ? family.readinessStatus : "governance_ready";
    for (const divisionId of toStringArray(family.canonicalDivisions)) {
      const inventoryRecord = inventoryRecords.find((entry) => entry.divisionId === divisionId);
      if (inventoryRecord == null) {
        blockers.push(`family_readiness:${familyId}:missing_canonical_division:${divisionId}`);
        continue;
      }
      if (readinessStatus === "pilot_ready" && inventoryRecord.status === "coverage_draft") {
        blockers.push(`family_readiness:${familyId}:pilot_division_not_ready:${divisionId}`);
      }
      if (readinessStatus === "local_leadership_ready" && !["pilot_ready", "production_ready"].includes(inventoryRecord.status)) {
        blockers.push(`family_readiness:${familyId}:local_leadership_gap:${divisionId}:${inventoryRecord.status}`);
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
  const evalSuites = listFiles(join(platformRoot, "eval", "divisions"), 3)
    .filter((path) => path.endsWith("eval-suite.yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const redTeamSuites = listFiles(join(platformRoot, "redteam", "divisions"), 3)
    .filter((path) => path.endsWith("redteam-suite.yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const roiDivisionConfigs = listFiles(join(platformRoot, "roi", "divisions"), 2)
    .filter((path) => path.endsWith(".yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const trainingPolicies = listFiles(join(platformRoot, "training-data-policy", "divisions"), 2)
    .filter((path) => path.endsWith(".yaml"))
    .map((path) => ({ path, value: loadYamlObject(path) }));
  const revocationPolicyPath = join(platformRoot, "training-data-policy", "revocation.yaml");
  const revocationPolicy = loadYamlObject(revocationPolicyPath);
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

  for (const card of evalDatasetCards) {
    blockers.push(...validateEvalDatasetCard(card.value, normalizeRelativePath(platformRoot, card.path), platformRoot));
  }

  for (const suite of evalSuites) {
    blockers.push(...validateEvalSuite(suite.value, normalizeRelativePath(platformRoot, suite.path), platformRoot, now));
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
    blockers.push(...validateScenarioBindings(scenario.value, normalizeRelativePath(platformRoot, scenario.path), platformRoot));
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
    blockers.push(...validateRedTeamSuite(suite.value, normalizeRelativePath(platformRoot, suite.path), platformRoot, now));
  }

  for (const config of roiDivisionConfigs) {
    blockers.push(...validateRoiDivisionConfig(config.value, normalizeRelativePath(platformRoot, config.path), platformRoot));
  }

  for (const policy of trainingPolicies) {
    blockers.push(...validateTrainingPolicyConfig(policy.value, normalizeRelativePath(platformRoot, policy.path)));
  }

  if (familyPolicies.length < 6) {
    blockers.push("family_policy:missing_coverage");
  }

  if (trainingPolicies.length === 0) {
    blockers.push("training_policy:missing_all");
  }

  blockers.push(...validateTrainingRevocationConfig(revocationPolicy, normalizeRelativePath(platformRoot, revocationPolicyPath)));
  blockers.push(...buildFamilyReadinessBlockers(platformRoot, inventory.records));

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
  if (report.blockers.length > 0) {
    process.exitCode = 1;
  }
}
