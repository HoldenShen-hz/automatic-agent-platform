import assert from "node:assert/strict";
import test from "node:test";

import {
  CompensationManager,
  type CompensationContext,
} from "../../../../src/platform/five-plane-execution/compensation-manager.js";
import type { SideEffectRecord } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

function createSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    sideEffectId: newId("se"),
    harnessRunId: newId("hrun"),
    nodeRunId: newId("nrun"),
    nodeAttemptId: newId("nattempt"),
    effectKind: "external_api",
    idempotencyKey: newId("idem"),
    status: "ambiguous",
    riskClass: "medium",
    preCommitPolicyProofRef: { artifactId: newId("art"), uri: "policy://proof" },
    deadline: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

function createContext(): CompensationContext {
  return {
    tenantId: "tenant-test",
    traceId: newId("trace"),
    operatorId: "operator-test",
    reason: "unit-test",
  };
}

test("CompensationManager only marks ambiguous or failed side effects as compensatable", () => {
  const manager = new CompensationManager();

  assert.equal(manager.isCompensatable(createSideEffect({ status: "ambiguous" })), true);
  assert.equal(manager.isCompensatable(createSideEffect({ status: "failed" })), true);
  assert.equal(manager.isCompensatable(createSideEffect({ status: "confirmed" })), false);
});

test("CompensationManager validates preconditions against terminal side effects", () => {
  const manager = new CompensationManager();
  const result = manager.validateCompensationPreconditions(createSideEffect({ status: "compensated" }));

  assert.equal(result.valid, false);
  assert.match(result.reason ?? "", /already been compensated/);
});

test("CompensationManager creates compensation records with canonical defaults", () => {
  const manager = new CompensationManager();
  const record = manager.createCompensationRecord(
    "side-effect-1",
    "harness-1",
    { artifactId: "artifact-1", uri: "plan://artifact-1" },
  );

  assert.equal(record.sideEffectId, "side-effect-1");
  assert.equal(record.harnessRunId, "harness-1");
  assert.equal(record.status, "running");
  assert.deepEqual(record.evidenceRefs, []);
});

test("CompensationManager plans compensation from the current side-effect contract", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect({
    effectKind: "tool_commit",
    riskClass: "critical",
    externalRef: "external://charge/123",
  });

  const plan = manager.planCompensation(sideEffect, createContext());
  const firstStep = plan.steps[0];

  assert.ok(firstStep);
  assert.equal(plan.sideEffectId, sideEffect.sideEffectId);
  assert.equal(firstStep.stepType, "reverse");
  assert.equal(firstStep.targetRef, "external://charge/123");
  assert.equal(firstStep.estimatedImpact, "high");
});

test("CompensationManager falls back to idempotency key when no external reference exists", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect({
    effectKind: "external_api",
    riskClass: "low",
  });

  const plan = manager.planCompensation(sideEffect, createContext());
  const firstStep = plan.steps[0];

  assert.ok(firstStep);
  assert.equal(firstStep.targetRef, sideEffect.idempotencyKey);
  assert.equal(firstStep.action, "reverse_external_api");
  assert.equal(firstStep.estimatedImpact, "low");
});

test("CompensationManager executes generated steps and returns evidence refs", () => {
  const manager = new CompensationManager();
  const plan = manager.planCompensation(createSideEffect(), createContext());

  const result = manager.executeCompensationSteps(plan, createContext());

  assert.equal(result.success, true);
  assert.equal(result.finalStatus, "succeeded");
  assert.equal(result.evidenceRefs.length, 1);
  assert.ok(result.completedAt);
  assert.match(result.evidenceRefs[0]?.uri ?? "", /^compensation:\/\//);
});

test("CompensationManager rejects duplicate compensation execution by compensationId", () => {
  let reverseCalls = 0;
  const manager = new CompensationManager({
    reverseEffect: () => {
      reverseCalls += 1;
      return true;
    },
  });
  const plan = manager.planCompensation(createSideEffect(), createContext());

  const first = manager.executeCompensationSteps(plan, createContext());
  const duplicate = manager.executeCompensationSteps(plan, createContext());

  assert.equal(first.success, true);
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.finalStatus, "failed");
  assert.match(duplicate.evidenceRefs[0]?.uri ?? "", /duplicate_execution/);
  assert.equal(reverseCalls, 1);
});

test("CompensationManager maps compensation states to target side-effect states", () => {
  const manager = new CompensationManager();

  assert.equal(manager.getTargetSideEffectStatus("succeeded"), "compensated");
  assert.equal(manager.getTargetSideEffectStatus("failed"), "failed");
  assert.equal(manager.getTargetSideEffectStatus("requires_human"), "manual_review_required");
  assert.equal(manager.getTargetSideEffectStatus("running"), "compensating");
});

test("CompensationManager uses impact-based human approval gating", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("low"), false);
  assert.equal(manager.requiresHumanApproval("medium"), true);
  assert.equal(manager.requiresHumanApproval("high"), true);
  assert.equal(manager.getNextCompensationStatus("planned", "approve"), "running");
  assert.equal(manager.getNextCompensationStatus("running", "confirm"), "succeeded");
  assert.equal(manager.getNextCompensationStatus("planned", "confirm"), null);
});
