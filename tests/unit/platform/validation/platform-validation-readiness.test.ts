import assert from "node:assert/strict";
import test from "node:test";

import { validateLocalGpuCapacity } from "../../../../src/platform/model-gateway/local-gpu-capacity-validation.js";
import {
  buildCapacityValidationReport,
  buildPlatformValidationScorecard,
  evaluatePlatformMissionSlo,
} from "../../../../src/platform/stability/platform-validation-readiness.js";
import { validateValidationSpanSemantics } from "../../../../src/platform/shared/observability/validation-semantic-conventions.js";

test("platform scorecard and capacity report create executable freeze evidence", () => {
  const scorecard = buildPlatformValidationScorecard({
    dimensionRatios: {
      functionalCorrectness: 1,
      runtimeReliability: 1,
      stateReplayConsistency: 1,
      securityTenantIam: 1,
      evidenceResearchQuality: 1,
      extensionRuntimeSafety: 1,
      observabilityRunbookReadiness: 1,
      costBudgetAttribution: 1,
    },
    gates: [{ gateId: "GATE-STATE-001", severity: "P0", status: "passed" }],
    registryClosurePassed: true,
    evidenceBundleVerified: true,
    projectionRebuildDiff: 0,
    researchMissionSloPassed: true,
    externalSignoffRefs: ["signoff://repo"],
  });
  const capacity = buildCapacityValidationReport({
    smokePassed: true,
    pilotPassed: true,
    stressPassed: true,
    soakPassed: true,
    spikePassed: true,
    backpressurePassed: true,
  });

  assert.equal(scorecard.score, 100);
  assert.equal(scorecard.decision, "pass");
  assert.equal(capacity.passed, true);
  assert.equal(
    capacity.profiles.find((item) => item.profile === "stress")
      ?.targetConcurrentTasks,
    200,
  );
});

test("GPU capacity validation verifies L40S admission and OOM fallback semantics", () => {
  const healthy = validateLocalGpuCapacity({
    gpuId: "l40s-0",
    gpuModel: "L40S",
    totalMemoryGb: 48,
    reservedMemoryGb: 4,
    modelMemoryGb: 32,
    embeddingQueueDepth: 3,
    rerankerQueueDepth: 2,
    embeddingQueueLimit: 8,
    rerankerQueueLimit: 8,
    remoteFallbackAvailable: true,
    oomObserved: false,
    unloadPolicyEnabled: true,
  });
  const oom = validateLocalGpuCapacity({
    ...healthyInput(),
    oomObserved: true,
  });

  assert.equal(healthy.admitted, true);
  assert.equal(healthy.providerDecision, "local");
  assert.equal(oom.oomRecoveryAction, "unload_and_fallback");
});

test("validation span semantics reject high-cardinality metric labels", () => {
  const invalid = validateValidationSpanSemantics({
    attributes: {},
    metricLabels: ["task_id"],
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.missingAttributes.includes("trace_id"));
  assert.deepEqual(invalid.forbiddenMetricLabels, ["task_id"]);
});

test("platform mission slo evaluation enforces mixed >= and <= thresholds", () => {
  const passed = evaluatePlatformMissionSlo(
    {
      missionType: "research",
      evidenceCoverageTarget: 1,
      toolReceiptCoverageTarget: 1,
      budgetAttributionCoverageTarget: 1,
      harnessCompletionTarget: 0.95,
      hitlSlaMs: 86_400_000,
      recoveryRtoMs: 14_400_000,
      projectionLagP95Ms: 5_000,
      apiAvailabilityTarget: 0.999,
    },
    {
      evidenceCoverage: 1,
      toolReceiptCoverage: 1,
      budgetAttributionCoverage: 1,
      harnessCompletion: 0.98,
      hitlSlaMs: 43_200_000,
      recoveryRtoMs: 3_600_000,
      projectionLagP95Ms: 1_500,
      apiAvailability: 0.9995,
    },
  );
  const failed = evaluatePlatformMissionSlo(
    {
      missionType: "ops",
      evidenceCoverageTarget: 1,
      toolReceiptCoverageTarget: 1,
      budgetAttributionCoverageTarget: 1,
      harnessCompletionTarget: 0.98,
      hitlSlaMs: 900_000,
      recoveryRtoMs: 900_000,
      projectionLagP95Ms: 2_000,
      apiAvailabilityTarget: 0.9995,
    },
    {
      evidenceCoverage: 1,
      toolReceiptCoverage: 0.95,
      budgetAttributionCoverage: 1,
      harnessCompletion: 0.99,
      hitlSlaMs: 1_200_000,
      recoveryRtoMs: 480_000,
      projectionLagP95Ms: 1_000,
      apiAvailability: 0.9997,
    },
  );

  assert.equal(passed.passed, true);
  assert.equal(failed.passed, false);
  assert.equal(
    failed.checks.find((check) => check.name === "tool_receipt_coverage")
      ?.passed,
    false,
  );
  assert.equal(
    failed.checks.find((check) => check.name === "hitl_sla")?.operator,
    "<=",
  );
});

function healthyInput() {
  return {
    gpuId: "l40s-1",
    gpuModel: "L40S",
    totalMemoryGb: 48,
    reservedMemoryGb: 4,
    modelMemoryGb: 32,
    embeddingQueueDepth: 3,
    rerankerQueueDepth: 2,
    embeddingQueueLimit: 8,
    rerankerQueueLimit: 8,
    remoteFallbackAvailable: true,
    unloadPolicyEnabled: true,
  };
}
