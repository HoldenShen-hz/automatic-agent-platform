import assert from "node:assert/strict";
import test from "node:test";

import {
  createSideEffectRecord,
  type ArtifactRef,
  type SideEffectRecord,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import {
  CompensationManager,
  type CompensationContext,
} from "../../../../src/platform/five-plane-execution/compensation-manager.js";

const planArtifact: ArtifactRef = {
  artifactId: "artifact-comp-1",
  uri: "artifact://artifact-comp-1",
  hash: "sha256:test",
};

function createSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return createSideEffectRecord({
    harnessRunId: overrides.harnessRunId ?? "hrun-comp-e2e",
    nodeRunId: overrides.nodeRunId ?? "nrun-comp-e2e",
    nodeAttemptId: overrides.nodeAttemptId ?? "attempt-comp-e2e",
    effectKind: overrides.effectKind ?? "external_api",
    idempotencyKey: overrides.idempotencyKey ?? "idem-comp-e2e",
    status: overrides.status ?? "compensation_required",
    riskClass: overrides.riskClass ?? "medium",
    preCommitPolicyProofRef: overrides.preCommitPolicyProofRef ?? planArtifact,
    deadline: overrides.deadline ?? "2026-05-10T00:30:00.000Z",
    ...(overrides.externalRef != null ? { externalRef: overrides.externalRef } : {}),
  });
}

function createContext(): CompensationContext {
  return {
    tenantId: "tenant-e2e",
    traceId: "trace-comp-e2e",
    operatorId: "operator-e2e",
    reason: "workflow repair",
  };
}

test("E2E Compensation: plans compensation steps for a compensatable side effect", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect();

  const plan = manager.planCompensation(sideEffect, createContext());

  assert.equal(plan.sideEffectId, sideEffect.sideEffectId);
  assert.equal(plan.harnessRunId, sideEffect.harnessRunId);
  assert.ok(plan.steps.length > 0);
});

test("E2E Compensation: executes the generated compensation plan and emits evidence", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect({ externalRef: "ext-123" });
  const plan = manager.planCompensation(sideEffect, createContext());

  const result = manager.executeCompensationSteps(plan, createContext());

  assert.equal(result.success, true);
  assert.equal(result.finalStatus, "succeeded");
  assert.ok(result.evidenceRefs.length > 0);
});

test("E2E Compensation: high-impact compensation requires human approval", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("high"), true);
  assert.equal(manager.requiresHumanApproval("medium"), true);
});
