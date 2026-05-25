import assert from "node:assert/strict";
import test from "node:test";

import type { CompensationRecord, ReconciliationRecord, SideEffectRecord } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { SideEffectManager } from "../../../../src/platform/five-plane-execution/side-effect-manager.js";

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
    leaseId: "lease-1",
    fencingToken: "fence-1",
    preCommitPolicyProofRef: { artifactId: newId("art"), uri: "policy://proof" },
    deadline: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

function createReconciliation(overrides: Partial<ReconciliationRecord> = {}): ReconciliationRecord {
  return {
    reconciliationId: newId("recon"),
    sideEffectId: "side-effect-1",
    probeKind: "http_probe",
    externalObservedState: { state: "confirmed" },
    result: "confirmed",
    evidenceRefs: [],
    nextAction: "mark_confirmed",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createCompensation(overrides: Partial<CompensationRecord> = {}): CompensationRecord {
  return {
    compensationId: newId("comp"),
    sideEffectId: "side-effect-1",
    harnessRunId: "harness-1",
    planRef: { artifactId: newId("art"), uri: "plan://1" },
    status: "running",
    evidenceRefs: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createContext() {
  return {
    tenantId: "tenant-test",
    traceId: newId("trace"),
    emittedBy: "test",
  };
}

test("SideEffectManager maps reconciliation actions to canonical side-effect states", () => {
  const manager = new SideEffectManager();

  const confirmed = manager.applyReconciliation(
    createSideEffect({ status: "ambiguous" }),
    createReconciliation({ nextAction: "mark_confirmed" }),
    createContext(),
  );
  const compensationRequired = manager.applyReconciliation(
    createSideEffect({ status: "ambiguous" }),
    createReconciliation({ result: "failed", nextAction: "compensate" }),
    createContext(),
  );
  const reconciling = manager.applyReconciliation(
    createSideEffect({ status: "ambiguous" }),
    createReconciliation({ result: "ambiguous", nextAction: "retry_probe" }),
    createContext(),
  );

  assert.equal(confirmed.aggregate.status, "confirmed");
  assert.equal(compensationRequired.aggregate.status, "compensation_required");
  assert.equal(reconciling.aggregate.status, "reconciling");
});

test("SideEffectManager starts and completes compensation using the current compensation record contract", () => {
  const manager = new SideEffectManager();
  const started = manager.startCompensation(
    createSideEffect({ status: "compensation_required" }),
    createCompensation({ status: "running" }),
    createContext(),
  );
  const completed = manager.completeCompensation(
    createSideEffect({ status: "compensating" }),
    createCompensation({ status: "succeeded" }),
    createContext(),
  );

  assert.equal(started.aggregate.status, "compensating");
  assert.equal(completed.aggregate.status, "compensated");
  assert.equal(completed.event.aggregateType, "SideEffectRecord");
});

test("SideEffectManager exposes the registration-to-confirmation lifecycle", () => {
  const manager = new SideEffectManager();
  const context = createContext();

  const proposed = manager.registerProposal(createSideEffect({ status: "proposed" }), context);
  const approved = manager.approve(proposed.aggregate, context);
  const reserved = manager.reserve(approved.aggregate, context);
  const committing = manager.startCommit(reserved.aggregate, context);
  const committed = manager.recordCommitted(committing.aggregate, context);
  const confirming = manager.startConfirmation(committed.aggregate, context);
  const confirmed = manager.confirm(confirming.aggregate, context);

  assert.equal(proposed.aggregate.status, "proposed");
  assert.equal(approved.aggregate.status, "approved");
  assert.equal(reserved.aggregate.status, "reserved");
  assert.equal(committing.aggregate.status, "committing");
  assert.equal(committed.aggregate.status, "committed");
  assert.equal(confirming.aggregate.status, "confirming");
  assert.equal(confirmed.aggregate.status, "confirmed");
});

test("SideEffectManager embeds reason codes in emitted event payloads", () => {
  const manager = new SideEffectManager();
  const result = manager.applyReconciliation(
    createSideEffect(),
    createReconciliation({ result: "confirmed", nextAction: "mark_confirmed" }),
    createContext(),
  );
  const payload = result.event.payload as Record<string, unknown>;

  assert.equal(typeof payload.reasonCode, "string");
  assert.match(String(payload.reasonCode), /reconciliation\.confirmed\.mark_confirmed/);
});

test("SideEffectManager requires lease and fencing token for compensation transitions regardless of prior state", () => {
  const manager = new SideEffectManager();

  assert.throws(
    () =>
      manager.applyReconciliation(
        createSideEffect({
          status: "proposed",
          leaseId: undefined,
          fencingToken: undefined,
        }),
        createReconciliation({
          result: "failed",
          nextAction: "compensate",
        }),
        createContext(),
      ),
    /lease and fencing token/,
  );
});
