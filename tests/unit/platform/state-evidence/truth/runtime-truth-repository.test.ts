import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createHarnessRun,
  createSideEffectRecord,
  type ArtifactRef,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/state-evidence/truth/runtime-truth-repository.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

test("RuntimeTruthRepository transitions stored HarnessRun and appends platform fact event atomically", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    currentSeq: 0,
  });
  repository.seed("HarnessRun", run);

  const result = repository.transition({
    aggregateType: "HarnessRun",
    aggregate: run,
    fromStatus: "created",
    toStatus: "admitted",
    expectedSeq: 0,
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
    policyGuard: {
      allowed: true,
      policyProofRef: "policy-proof-1",
    },
    auditRef: "audit://run-1/admission",
  });

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(repository.getHarnessRun("run-1")?.status, "admitted");
  assert.equal(repository.listEvents().length, 1);
  assert.equal(repository.listEvents()[0]?.eventType, "platform.harness_run.status_changed");
  assert.equal(repository.listOutbox().length, 1);
  assert.deepEqual(repository.listAuditRefs(), ["audit://run-1/admission"]);
});

test("RuntimeTruthRepository rolls back truth mutation when transition fails", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
    status: "completed",
    currentSeq: 7,
  });
  repository.seed("HarnessRun", run);

  assert.throws(
    () =>
      repository.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "completed",
        toStatus: "running",
        expectedSeq: 7,
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );

  assert.equal(repository.getHarnessRun("run-1")?.status, "completed");
  assert.equal(repository.listEvents().length, 0);
});

test("RuntimeTruthRepository reads stored aggregate instead of trusting stale command aggregate", () => {
  const repository = new RuntimeTruthRepository();
  const stored = createBudgetLedger({
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    status: "open",
    version: 0,
  });
  const stale = createBudgetLedger({
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    status: "closed",
    version: 99,
  });
  repository.seed("BudgetLedger", stored);

  const result = repository.transition({
    aggregateType: "BudgetLedger",
    aggregate: stale,
    fromStatus: "open",
    toStatus: "soft_cap_reached",
    expectedVersion: 0,
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "soft_cap",
    emittedBy: "budget-allocator",
  });

  assert.equal(result.aggregate.status, "soft_cap_reached");
  assert.equal(result.aggregate.version, 1);
});

test("RuntimeTruthRepository assigns aggregate event sequence for side effects without currentSeq", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "side-effect-1",
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "committing",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });
  repository.seed("SideEffectRecord", sideEffect);

  const ambiguous = repository.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committing",
    toStatus: "ambiguous",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "external_timeout",
    emittedBy: "side-effect-manager",
  });
  const compensating = repository.transition({
    aggregateType: "SideEffectRecord",
    aggregate: ambiguous.aggregate,
    fromStatus: "ambiguous",
    toStatus: "compensating",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "compensate",
    emittedBy: "side-effect-manager",
  });

  assert.equal(compensating.aggregate.status, "compensating");
  assert.deepEqual(repository.listEvents().map((event) => event.aggregateSeq), [1, 2]);
});
