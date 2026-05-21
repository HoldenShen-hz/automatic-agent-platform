import assert from "node:assert/strict";
import test from "node:test";

import { validateLocalGpuCapacity } from "../../../../src/platform/model-gateway/local-gpu-capacity-validation.js";
import {
  buildCapacityValidationReport,
  buildPlatformValidationScorecard,
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
