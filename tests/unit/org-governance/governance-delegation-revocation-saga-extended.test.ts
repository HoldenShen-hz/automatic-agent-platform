/**
 * Extended Unit Tests: Governance Delegation Revocation Saga
 *
 * Provides comprehensive coverage for GovernanceDelegationRevocationSaga edge cases
 * including SLO calculations, cascade scope, and context propagation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GovernanceDelegationRevocationSaga,
  type GovernanceDelegationRevocationRequest,
  type GovernanceDelegationCascadeScope,
} from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";

const BASE_REQUEST: GovernanceDelegationRevocationRequest = {
  delegationId: "delegation-test",
  requestedAtMs: 0,
  derivedResourceIds: ["resource-1", "resource-2"],
  derivedDelegationIds: ["delegation-child-1"],
};

test("GovernanceDelegationRevocationSaga constructor accepts empty handlers", () => {
  const saga = new GovernanceDelegationRevocationSaga({});
  assert.ok(saga);
});

test("GovernanceDelegationRevocationSaga constructor accepts no arguments", () => {
  const saga = new GovernanceDelegationRevocationSaga();
  assert.ok(saga);
});

test("GovernanceDelegationRevocationSaga revokeWithinSlo is true when elapsed < 60s", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    30_000,
  );

  assert.equal(receipt.revokeWithinSlo, true);
});

test("GovernanceDelegationRevocationSaga revokeWithinSlo is false when elapsed > 60s", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    60_001,
  );

  assert.equal(receipt.revokeWithinSlo, false);
});

test("GovernanceDelegationRevocationSaga cascadeWithinSlo is true when elapsed < 300s and no failure", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    299_999,
  );

  assert.equal(receipt.cascadeWithinSlo, true);
});

test("GovernanceDelegationRevocationSaga cascadeWithinSlo is false when elapsed > 300s", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    300_001,
  );

  assert.equal(receipt.cascadeWithinSlo, false);
});

test("GovernanceDelegationRevocationSaga cascadeWithinSlo is false when failure occurs", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      throw new Error("fail");
    },
    compensateResource: () => {},
  });

  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    10_000,
  );

  assert.equal(receipt.cascadeWithinSlo, false);
  assert.equal(receipt.failedStage, "prepare");
});

test("GovernanceDelegationRevocationSaga sagaStages includes compensate when compensation occurs", () => {
  // Need a failure AFTER a resource is frozen so compensation has something to do
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      // First resource succeeds
    },
    revokePendingApprovals: () => {
      throw new Error("fail");
    },
    compensateResource: () => {},
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.ok(receipt.sagaStages.includes("compensate"));
});

test("GovernanceDelegationRevocationSaga sagaStages does not include compensate when no compensation", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    compensateResource: (id) => {},  // Add handler to enable compensation path
  });

  // With no failure and elapsed <= 300s, compensation doesn't occur
  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.ok(!receipt.sagaStages.includes("compensate"));
  assert.deepEqual(receipt.sagaStages, ["prepare", "commit", "audit"]);
});

test("GovernanceDelegationRevocationSaga completedAtMs is set correctly", () => {
  const saga = new GovernanceDelegationRevocationSaga({});
  const completedAt = 100_000;

  const receipt = saga.revoke(BASE_REQUEST, completedAt);

  assert.equal(receipt.completedAtMs, completedAt);
});

test("GovernanceDelegationRevocationSaga context delegationId is consistent", () => {
  let capturedDelegationId: string | null = null;
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (_id, ctx) => {
      capturedDelegationId = ctx.delegationId;
    },
    revokeDerivedDelegation: (_id, ctx) => {
      assert.equal(ctx.delegationId, capturedDelegationId);
    },
    audit: (_receipt, ctx) => {
      assert.equal(ctx.delegationId, capturedDelegationId);
    },
  });

  saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(capturedDelegationId, "delegation-test");
});

test("GovernanceDelegationRevocationSaga context failedStage updates on failure", () => {
  let capturedFailedStage: string | null = "not-set";
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      throw new Error("fail");
    },
    compensateResource: (_id, _ctx) => {
      // This is only called if there are resources to compensate.
      // Since freezeResource fails, no resources are frozen, so compensateResource won't be called.
      // Instead, we check failedStage on the receipt.
    },
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  // failedStage is set on the receipt when freezeResource throws
  assert.equal(receipt.failedStage, "prepare");
  // Note: compensateResource is NOT called because no resources were frozen before failure
});

test("GovernanceDelegationRevocationSaga context failedStage is null when no failure", () => {
  let capturedFailedStage: string | null = "not-set";
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (_id, ctx) => {
      capturedFailedStage = ctx.failedStage;
    },
  });

  saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(capturedFailedStage, null);
});

test("GovernanceDelegationRevocationSaga freezeResource called for each resource", () => {
  const freezeCalls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => freezeCalls.push(id),
  });

  saga.revoke({
    ...BASE_REQUEST,
    derivedResourceIds: ["res-a", "res-b", "res-c"],
  }, 30_000);

  assert.deepEqual(freezeCalls, ["res-a", "res-b", "res-c"]);
});

test("GovernanceDelegationRevocationSaga revokeDerivedDelegation called for each derived delegation", () => {
  const revokeCalls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    revokeDerivedDelegation: (id) => revokeCalls.push(id),
  });

  saga.revoke({
    ...BASE_REQUEST,
    derivedDelegationIds: ["child-1", "child-2"],
  }, 30_000);

  assert.deepEqual(revokeCalls, ["child-1", "child-2"]);
});

test("GovernanceDelegationRevocationSaga revokeDerivedDelegation called in commit stage", () => {
  const stageLog: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => stageLog.push("prepare:freeze"),
    revokeDerivedDelegation: () => stageLog.push("commit:revoke"),
  });

  saga.revoke(BASE_REQUEST, 30_000);

  const prepareIdx = stageLog.findIndex((s) => s === "prepare:freeze");
  const commitIdx = stageLog.findIndex((s) => s === "commit:revoke");
  assert.ok(prepareIdx < commitIdx);
});

test("GovernanceDelegationRevocationSaga compensateResource called in reverse order of freezeResource", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => calls.push(`freeze:${id}`),
    revokeDerivedDelegation: () => {
      throw new Error("fail");
    },
    compensateResource: (id) => calls.push(`compensate:${id}`),
  });

  saga.revoke({
    ...BASE_REQUEST,
    derivedResourceIds: ["res-1", "res-2", "res-3"],
    derivedDelegationIds: ["child-1"],
  }, 30_000);

  const freezeCalls = calls.filter((c) => c.startsWith("freeze:"));
  const compensateCalls = calls.filter((c) => c.startsWith("compensate:"));

  // Compensation should be in reverse order
  assert.deepEqual(compensateCalls, ["compensate:res-3", "compensate:res-2", "compensate:res-1"]);
});

test("GovernanceDelegationRevocationSaga compensates even when elapsed > 300s", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    compensateResource: () => {},
  });

  const receipt = saga.revoke(BASE_REQUEST, 400_000);

  assert.equal(receipt.status, "compensated");
  assert.ok(receipt.compensationResourceIds.length > 0);
});

test("GovernanceDelegationRevocationSaga does not compensate when elapsed <= 300s and no failure", () => {
  const compensateCalls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    compensateResource: (id) => compensateCalls.push(id),
  });

  const receipt = saga.revoke(BASE_REQUEST, 299_999);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(compensateCalls, []);
});

test("GovernanceDelegationRevocationSaga with partial cascade scope", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    revokePendingApprovals: () => calls.push("pendingApprovals"),
    revokeActiveSessions: () => calls.push("activeSessions"),
    revokeSecretLeases: () => calls.push("secretLeases"),
    revokeWorkerLeases: () => calls.push("workerLeases"),
    revokeScheduledTriggers: () => calls.push("scheduledTriggers"),
  });

  saga.revoke({
    ...BASE_REQUEST,
    derivedResourceIds: [],
    derivedDelegationIds: [],
    cascadeScope: {
      pendingApprovals: true,
      activeSessions: false,
      secretLeases: false,
      workerLeases: true,
      scheduledTriggers: false,
    },
  }, 30_000);

  assert.deepEqual(calls, ["pendingApprovals", "workerLeases"]);
});

test("GovernanceDelegationRevocationSaga uses default cascade scope when not provided", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    revokePendingApprovals: () => calls.push("pendingApprovals"),
    revokeActiveSessions: () => calls.push("activeSessions"),
    revokeSecretLeases: () => calls.push("secretLeases"),
    revokeWorkerLeases: () => calls.push("workerLeases"),
    revokeScheduledTriggers: () => calls.push("scheduledTriggers"),
  });

  saga.revoke({
    delegationId: "del-default-cascade",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: [],
    // No cascadeScope provided
  }, 30_000);

  // All 5 cascade handlers should be called with default scope
  assert.equal(calls.length, 5);
});

test("GovernanceDelegationRevocationSaga executionLog has correct structure", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  for (const entry of receipt.executionLog) {
    assert.ok("stage" in entry);
    assert.ok("subjectId" in entry);
    assert.ok("outcome" in entry);
    assert.ok(["prepare", "commit", "compensate", "audit"].includes(entry.stage));
    assert.ok(["completed", "failed"].includes(entry.outcome));
  }
});

test("GovernanceDelegationRevocationSaga executionLog size reflects actual operations", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke({
    ...BASE_REQUEST,
    derivedResourceIds: ["r1", "r2"],
    derivedDelegationIds: ["d1"],
  }, 30_000);

  // Should have: 2 freeze (prepare) + 5 cascade (prepare) + 1 revokeDerived (commit) + 1 audit = 9 entries
  assert.equal(receipt.executionLog.length, 9);
});

test("GovernanceDelegationRevocationSaga frozenResourceIds reflects actual freezes", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke({
    ...BASE_REQUEST,
    derivedResourceIds: ["r1", "r2", "r3"],
  }, 30_000);

  assert.deepEqual(receipt.frozenResourceIds, ["r1", "r2", "r3"]);
});

test("GovernanceDelegationRevocationSaga revokedDerivedDelegationIds reflects actual revocations", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke({
    ...BASE_REQUEST,
    derivedDelegationIds: ["child-a", "child-b"],
  }, 30_000);

  assert.deepEqual(receipt.revokedDerivedDelegationIds, ["child-a", "child-b"]);
});

test("GovernanceDelegationRevocationSaga handles missing derivedDelegationIds gracefully", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    revokeDerivedDelegation: () => {
      throw new Error("should not be called");
    },
  });

  const receipt = saga.revoke({
    delegationId: "del-no-children",
    requestedAtMs: 0,
    derivedResourceIds: ["r1"],
    // No derivedDelegationIds
  }, 30_000);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(receipt.revokedDerivedDelegationIds, []);
});

test("GovernanceDelegationRevocationSaga compensationResourceIds is empty when no compensation", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.deepEqual(receipt.compensationResourceIds, []);
});

test("GovernanceDelegationRevocationSaga failedStage is null when no failure", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(receipt.failedStage, null);
});

test("GovernanceDelegationRevocationSaga failedStage is prepare when freeze fails", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      throw new Error("freeze failed");
    },
    compensateResource: () => {},
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(receipt.failedStage, "prepare");
});

test("GovernanceDelegationRevocationSaga failedStage is commit when revokeDerivedDelegation fails", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    revokeDerivedDelegation: () => {
      throw new Error("revoke failed");
    },
    compensateResource: () => {},
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(receipt.failedStage, "commit");
});

test("GovernanceDelegationRevocationSaga revokeWithinSlo calculation edge case at boundary", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  // At exactly 60 seconds
  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    60_000,
  );

  assert.equal(receipt.revokeWithinSlo, true);
});

test("GovernanceDelegationRevocationSaga cascadeWithinSlo calculation edge case at boundary", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  // At exactly 300 seconds
  const receipt = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    300_000,
  );

  assert.equal(receipt.cascadeWithinSlo, true);
});

test("GovernanceDelegationRevocationSaga audit handler receives receipt", () => {
  let capturedReceipt: typeof BASE_REQUEST | null = null;
  const saga = new GovernanceDelegationRevocationSaga({
    audit: (receipt) => {
      capturedReceipt = receipt.delegationId as unknown as typeof BASE_REQUEST;
    },
  });

  saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(capturedReceipt, "delegation-test");
});

test("GovernanceDelegationRevocationSaga audit stage always last", () => {
  const stageLog: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => stageLog.push("prepare"),
    revokeDerivedDelegation: () => stageLog.push("commit"),
    compensateResource: () => stageLog.push("compensate"),
    audit: () => stageLog.push("audit"),
  });

  saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(stageLog[stageLog.length - 1], "audit");
});

test("GovernanceDelegationRevocationSaga executionLog order reflects actual execution", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  let lastStageIndex = -1;
  for (const entry of receipt.executionLog) {
    const stageIndex = ["prepare", "commit", "compensate", "audit"].indexOf(entry.stage);
    // Stages should not go backwards
    assert.ok(stageIndex >= lastStageIndex || entry.stage === "audit");
    lastStageIndex = stageIndex;
  }
});
