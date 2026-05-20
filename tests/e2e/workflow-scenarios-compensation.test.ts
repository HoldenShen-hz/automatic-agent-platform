import assert from "node:assert/strict";
import test from "node:test";

import { CompensationManager } from "../../src/platform/five-plane-execution/compensation-manager.js";
import type { SideEffectRecord } from "../../src/platform/contracts/executable-contracts/index.js";

test("E2E Workflow: CompensationManager validates compensatable side effects", async () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-001",
    status: "failed",
    effectKind: "file_write",
    riskClass: "medium",
  });

  const result = manager.validateCompensationPreconditions(sideEffect);
  assert.equal(result.valid, true, "Failed side effect should be compensatable");
});

test("E2E Workflow: CompensationManager creates compensation plan for failed side effect", async () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-002",
    status: "failed",
    effectKind: "file_write",
    externalRef: "file:///tmp/test.txt",
    riskClass: "medium",
  });

  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);
  assert.ok(plan.compensationId, "Plan should have compensation ID");
  assert.equal(plan.sideEffectId, "effect-002", "Plan should reference correct side effect");
  assert.ok(plan.steps.length > 0, "Plan should have compensation steps");
  assert.equal(plan.steps[0]?.stepType, "reverse", "First step should be reverse");
});

test("E2E Workflow: CompensationManager requires human approval for high impact compensation", async () => {
  const manager = new CompensationManager();
  assert.equal(manager.requiresHumanApproval("high"), true, "High impact should require approval");
  assert.equal(manager.requiresHumanApproval("low"), false, "Low impact should not require approval");
  assert.equal(manager.requiresHumanApproval("medium"), true, "Medium impact should require approval");
});

test("E2E Workflow: CompensationManager state transitions follow correct FSM", async () => {
  const manager = new CompensationManager();
  assert.equal(manager.getNextCompensationStatus("planned", "approve"), "running");
  assert.equal(manager.getNextCompensationStatus("planned", "escalate"), "requires_human");
  assert.equal(manager.getNextCompensationStatus("running", "confirm"), "succeeded");
  assert.equal(manager.getNextCompensationStatus("running", "fail"), "failed");
  assert.equal(manager.getNextCompensationStatus("failed", "plan"), "planned");
  assert.equal(manager.getNextCompensationStatus("succeeded", "approve"), null);
// @ts-ignore
  assert.equal(manager.getNextCompensationStatus("compensated", "plan"), null);
});

test("E2E Workflow: non-compensatable side effects are rejected", async () => {
  const manager = new CompensationManager();
  const succeededSideEffect = createMockSideEffect({
    sideEffectId: "effect-003",
// @ts-ignore
    status: "succeeded",
    effectKind: "file_write",
    riskClass: "low",
  });

  const result = manager.validateCompensationPreconditions(succeededSideEffect);
  assert.equal(result.valid, false, "Succeeded side effect should not be compensatable");
  assert.ok(result.reason?.includes("not in a compensatable state"), "Should have correct reason");
});

test("E2E Workflow: compensation plan sets correct impact based on risk class", async () => {
  const manager = new CompensationManager();
  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  const criticalSideEffect = createMockSideEffect({
    sideEffectId: "effect-critical",
    status: "failed",
// @ts-ignore
    effectKind: "delete_resource",
    riskClass: "critical",
  });
  const criticalPlan = manager.planCompensation(criticalSideEffect, context);
  assert.equal(criticalPlan.steps[0]?.estimatedImpact, "high", "Critical risk should have high impact");

  const lowSideEffect = createMockSideEffect({
    sideEffectId: "effect-low",
    status: "failed",
// @ts-ignore
    effectKind: "read_operation",
    riskClass: "low",
  });
  const lowPlan = manager.planCompensation(lowSideEffect, context);
  assert.equal(lowPlan.steps[0]?.estimatedImpact, "low", "Low risk should have low impact");
});

test("E2E Workflow: compensation uses idempotency key when no external ref", async () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-idem",
// @ts-ignore
    effectKind: "api_call",
    externalRef: undefined,
    idempotencyKey: "idem-key-123",
    riskClass: "medium",
    status: "failed",
  });

  const context = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  const plan = manager.planCompensation(sideEffect, context);
  assert.equal(plan.steps[0]?.targetRef, "idem-key-123", "Should use idempotency key when no external ref");
});

function createMockSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    id: overrides.sideEffectId ?? "se-default",
    sideEffectId: overrides.sideEffectId ?? "se-default",
    harnessRunId: overrides.harnessRunId ?? "harness-default",
    nodeRunId: overrides.nodeRunId ?? "node-run-default",
    nodeAttemptId: overrides.nodeAttemptId ?? "node-attempt-default",
    effectKind: overrides.effectKind ?? "test_effect",
    idempotencyKey: overrides.idempotencyKey ?? "idem-key-default",
    status: overrides.status ?? "succeeded",
    riskClass: overrides.riskClass ?? "low",
    externalRef: overrides.externalRef ?? "external-ref-123",
    preCommitPolicyProofRef: null,
    deadline: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as SideEffectRecord;
}
