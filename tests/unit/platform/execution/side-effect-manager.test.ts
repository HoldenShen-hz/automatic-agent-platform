import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompensationRecord,
  createReconciliationRecord,
  createSideEffectRecord,
  type ArtifactRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { SideEffectManager } from "../../../../src/platform/five-plane-execution/side-effect-manager.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

const context = {
  tenantId: "tenant-1",
  traceId: "trace-1",
  emittedBy: "side-effect-manager",
  occurredAt: "2026-04-27T00:00:00.000Z",
  leaseId: "lease-side-effect-test",
  fencingToken: "fence-side-effect-test",
};

test("SideEffectManager applies reconciliation mark_confirmed through RuntimeStateMachine [side-effect-manager]", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "reconciling",
    riskClass: "medium",
    leaseId: context.leaseId,
    fencingToken: context.fencingToken,
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "committed" },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "confirmed");
  assert.equal(result.event.eventType, "platform.side_effect.status_changed");
  assert.equal(result.event.payload.reasonCode, "reconciliation.confirmed.mark_confirmed");
});

test("SideEffectManager routes ambiguous reconciliation to HITL-safe ambiguous state [side-effect-manager]", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "committing",
    riskClass: "high",
    leaseId: context.leaseId,
    fencingToken: context.fencingToken,
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "unknown" },
    result: "ambiguous",
    nextAction: "escalate_hitl",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "ambiguous");
});

test("SideEffectManager completes compensation without mutating original record [side-effect-manager]", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "compensating",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: "run-1",
    planRef: artifact,
    status: "succeeded",
  });

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(sideEffect.status, "compensating");
  assert.equal(result.aggregate.status, "compensated");
});
