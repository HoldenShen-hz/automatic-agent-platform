import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 5, maxCost: 10, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60_000,
    },
  });
}

function createRun(taskId: string) {
  const service = new HarnessRuntimeService();
  return {
    service,
    run: service.createRun({
      taskId,
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
  };
}

test("handleFailure aborts on operator abort", () => {
  const { service, run } = createRun("task-abort");
  const result = service.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
});

test("handleFailure pauses and emits recovery events for retryable failures", () => {
  const retryableFailures = [
    "tool_timeout",
    "llm_provider_unavailable",
    "budget_exhausted",
    "platform_panic",
    "worker_crash",
  ] as const;

  for (const failure of retryableFailures) {
    const { service, run } = createRun(`task-${failure}`);
    const result = service.handleFailure(run, failure);

    assert.equal(result.status, "paused");
    assert.ok(service.listTimeline(result).some((event) => event.type === "recovery_started"));
  }
});
