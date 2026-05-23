import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompensationRecord,
  createReconciliationRecord,
  createSideEffectRecord,
} from "../../src/platform/contracts/executable-contracts/index.js";
import { SideEffectManager } from "../../src/platform/five-plane-execution/side-effect-manager.js";

const artifact = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
} as const;

const context = {
  tenantId: "tenant-sidefx",
  traceId: "trace-sidefx-001",
  emittedBy: "INV-SIDEEFFECT-001-test",
} as const;

/**
 * INV-SIDEEFFECT-001: Ambiguous side effects must enter reconciliation and cannot be treated as success.
 */
test("INV-SIDEEFFECT-001: Ambiguous side effects enter reconciliation-safe state", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-sidefx-001",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "committing",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-05-01T01:00:00.000Z",
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

test("INV-SIDEEFFECT-001: Commit-affecting reconciliation remains fenced", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-sidefx-002",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-2",
    status: "reconciling",
    riskClass: "medium",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-05-01T01:00:00.000Z",
  });

  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "committed" },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  assert.throws(
    () => manager.applyReconciliation(sideEffect, reconciliation, context),
    /lease and fencing token/,
  );
});

test("INV-SIDEEFFECT-001: Compensation lifecycle reaches compensated on success", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-sidefx-003",
    nodeRunId: "node-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-3",
    status: "compensating",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
    deadline: "2026-05-01T01:00:00.000Z",
  });

  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: "run-sidefx-003",
    planRef: artifact,
    status: "succeeded",
  });

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "compensated");
});
