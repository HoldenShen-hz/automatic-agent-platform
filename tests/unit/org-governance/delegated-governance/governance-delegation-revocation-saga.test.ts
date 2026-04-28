import assert from "node:assert/strict";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import type { GovernanceDelegationRevocationRequest } from "../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { partial } from "../../../helpers/typed-factories.js";

const BASE_REQUEST: GovernanceDelegationRevocationRequest = {
  delegationId: "delegation-test",
  requestedAtMs: 0,
  derivedResourceIds: ["resource-1", "resource-2"],
  derivedDelegationIds: ["delegation-child-1"],
};

test("GovernanceDelegationRevocationSaga completes successfully with all handlers called", () => {
  const calls: Array<{ handler: string; id: string }> = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => calls.push({ handler: "freezeResource", id }),
    revokePendingApprovals: (id) => calls.push({ handler: "revokePendingApprovals", id }),
    revokeActiveSessions: (id) => calls.push({ handler: "revokeActiveSessions", id }),
    revokeSecretLeases: (id) => calls.push({ handler: "revokeSecretLeases", id }),
    revokeWorkerLeases: (id) => calls.push({ handler: "revokeWorkerLeases", id }),
    revokeScheduledTriggers: (id) => calls.push({ handler: "revokeScheduledTriggers", id }),
    revokeDerivedDelegation: (id) => calls.push({ handler: "revokeDerivedDelegation", id }),
    compensateResource: (id) => calls.push({ handler: "compensateResource", id }),
    audit: () => calls.push({ handler: "audit", id: "" }),
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(receipt.status, "completed");
  assert.equal(receipt.failedStage, null);
  assert.equal(receipt.delegationId, "delegation-test");
  assert.deepEqual(receipt.frozenResourceIds, ["resource-1", "resource-2"]);
  assert.deepEqual(receipt.revokedPendingApprovals, []);
  assert.deepEqual(receipt.revokedActiveSessions, []);
  assert.deepEqual(receipt.revokedSecretLeases, []);
  assert.deepEqual(receipt.revokedWorkerLeases, []);
  assert.deepEqual(receipt.revokedScheduledTriggers, []);
  assert.deepEqual(receipt.revokedDerivedDelegationIds, ["delegation-child-1"]);
  assert.deepEqual(receipt.compensationResourceIds, []);
  assert.deepEqual(receipt.sagaStages, ["prepare", "commit", "audit"]);
  assert.ok(receipt.revokeWithinSlo);
  assert.ok(receipt.cascadeWithinSlo);
  assert.equal(calls.filter((c) => c.handler === "freezeResource").length, 2);
  assert.equal(calls.filter((c) => c.handler === "audit").length, 1);
});

test("GovernanceDelegationRevocationSaga respects cascade scope when revoking", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    revokePendingApprovals: () => calls.push("pendingApprovals"),
    revokeActiveSessions: () => calls.push("activeSessions"),
    revokeSecretLeases: () => calls.push("secretLeases"),
    revokeWorkerLeases: () => calls.push("workerLeases"),
    revokeScheduledTriggers: () => calls.push("scheduledTriggers"),
  });

  saga.revoke({
    delegationId: "delegation-cascade",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: [],
    cascadeScope: {
      pendingApprovals: true,
      activeSessions: false,
      secretLeases: true,
      workerLeases: false,
      scheduledTriggers: true,
    },
  }, 30_000);

  assert.deepEqual(calls, ["pendingApprovals", "secretLeases", "scheduledTriggers"]);
});

test("GovernanceDelegationRevocationSaga compensates when commit stage fails", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => calls.push(`freeze:${id}`),
    revokeDerivedDelegation: (id) => {
      calls.push(`revoke:${id}`);
      throw new Error("revoke failed");
    },
    compensateResource: (id) => calls.push(`compensate:${id}`),
  });

  const receipt = saga.revoke(BASE_REQUEST, 45_000);

  assert.equal(receipt.status, "compensated");
  assert.equal(receipt.failedStage, "commit");
  assert.deepEqual(receipt.frozenResourceIds, ["resource-1", "resource-2"]);
  assert.deepEqual(receipt.compensationResourceIds, ["resource-2", "resource-1"]);
  assert.deepEqual(calls, [
    "freeze:resource-1",
    "freeze:resource-2",
    "revoke:delegation-child-1",
    "compensate:resource-2",
    "compensate:resource-1",
  ]);
});

test("GovernanceDelegationRevocationSaga compensates when prepare stage fails", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => {
      calls.push(`freeze:${id}`);
      if (id === "resource-2") {
        throw new Error("freeze failed");
      }
    },
    compensateResource: (id) => calls.push(`compensate:${id}`),
  });

  const receipt = saga.revoke({
    delegationId: "delegation-prepare-fail",
    requestedAtMs: 0,
    derivedResourceIds: ["resource-1", "resource-2", "resource-3"],
    derivedDelegationIds: [],
  }, 30_000);

  assert.equal(receipt.status, "compensated");
  assert.equal(receipt.failedStage, "prepare");
  assert.deepEqual(receipt.compensationResourceIds, ["resource-1"]);
});

test("GovernanceDelegationRevocationSaga compensates when elapsed exceeds cascade SLO", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => calls.push(`freeze:${id}`),
    revokeDerivedDelegation: () => calls.push("revoke"),
    compensateResource: (id) => calls.push(`compensate:${id}`),
  });

  const receipt = saga.revoke(BASE_REQUEST, 400_000);

  assert.equal(receipt.status, "compensated");
  assert.equal(receipt.failedStage, null);
  assert.equal(receipt.cascadeWithinSlo, false);
  assert.deepEqual(receipt.compensationResourceIds, ["resource-2", "resource-1"]);
  assert.deepEqual(calls, [
    "freeze:resource-1",
    "freeze:resource-2",
    "revoke:delegation-child-1",
    "compensate:resource-2",
    "compensate:resource-1",
  ]);
});

test("GovernanceDelegationRevocationSaga does not compensate when elapsed within SLO and no failure", () => {
  const calls: string[] = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (id) => calls.push(`freeze:${id}`),
    compensateResource: (id) => calls.push(`compensate:${id}`),
  });

  const receipt = saga.revoke({
    delegationId: "delegation-fast",
    requestedAtMs: 0,
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: [],
  }, 50_000);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(receipt.compensationResourceIds, []);
  assert.deepEqual(calls, ["freeze:resource-1"]);
});

test("GovernanceDelegationRevocationSaga execution log tracks outcomes correctly", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    revokeDerivedDelegation: (id) => {
      if (id === "delegation-child-1") {
        throw new Error("fail");
      }
    },
    compensateResource: () => {},
  });

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  const prepareEntries = receipt.executionLog.filter((e) => e.stage === "prepare");
  const commitEntries = receipt.executionLog.filter((e) => e.stage === "commit");
  const compensateEntries = receipt.executionLog.filter((e) => e.stage === "compensate");
  const auditEntries = receipt.executionLog.filter((e) => e.stage === "audit");

  assert.ok(prepareEntries.length > 0);
  assert.ok(commitEntries.some((e) => e.outcome === "failed"));
  assert.ok(compensateEntries.every((e) => e.outcome === "completed"));
  assert.ok(auditEntries.every((e) => e.outcome === "completed"));
});

test("GovernanceDelegationRevocationSaga calculates SLO metrics correctly", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const withinRevokeSlo = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    50_000,
  );
  assert.equal(withinRevokeSlo.revokeWithinSlo, true);
  assert.equal(withinRevokeSlo.cascadeWithinSlo, true);

  const overRevokeSlo = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    70_000,
  );
  assert.equal(overRevokeSlo.revokeWithinSlo, false);
  assert.equal(overRevokeSlo.cascadeWithinSlo, true);

  const overCascadeSlo = saga.revoke(
    { ...BASE_REQUEST, requestedAtMs: 0 },
    350_000,
  );
  assert.equal(overCascadeSlo.revokeWithinSlo, false);
  assert.equal(overCascadeSlo.cascadeWithinSlo, false);
});

test("GovernanceDelegationRevocationSaga provides context with correct failed stage", () => {
  let capturedContext: { delegationId: string; failedStage: string | null } | null = null;
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      throw new Error("prepare failed");
    },
    compensateResource: (_id, ctx) => {
      capturedContext = ctx;
    },
  });

  saga.revoke(BASE_REQUEST, 30_000);

  assert.notEqual(capturedContext, null);
  assert.equal(capturedContext!.delegationId, "delegation-test");
  assert.equal(capturedContext!.failedStage, "prepare");
});

test("GovernanceDelegationRevocationSaga handles empty derived resources", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {
      throw new Error("should not be called");
    },
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-empty",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: [],
  }, 30_000);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(receipt.frozenResourceIds, []);
  assert.deepEqual(receipt.compensationResourceIds, []);
});

test("GovernanceDelegationRevocationSaga handles missing optional handlers gracefully", () => {
  const saga = new GovernanceDelegationRevocationSaga({});

  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.equal(receipt.status, "completed");
  assert.deepEqual(receipt.frozenResourceIds, ["resource-1", "resource-2"]);
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
    delegationId: "delegation-default-cascade",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: [],
  }, 30_000);

  assert.equal(calls.length, 5);
  assert.ok(calls.includes("pendingApprovals"));
  assert.ok(calls.includes("activeSessions"));
  assert.ok(calls.includes("secretLeases"));
  assert.ok(calls.includes("workerLeases"));
  assert.ok(calls.includes("scheduledTriggers"));
});

test("GovernanceDelegationRevocationSaga context is consistent across handlers", () => {
  const contexts: Array<{ delegationId: string; failedStage: string | null }> = [];
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (_id, ctx) => contexts.push({ ...ctx }),
    revokeDerivedDelegation: (_id, ctx) => contexts.push({ ...ctx }),
    compensateResource: (_id, ctx) => contexts.push({ ...ctx }),
    audit: (_receipt, ctx) => contexts.push({ ...ctx }),
  });

  saga.revoke(BASE_REQUEST, 30_000);

  for (const ctx of contexts) {
    assert.equal(ctx.delegationId, "delegation-test");
    assert.equal(ctx.failedStage, null);
  }
});

test("GovernanceDelegationRevocationSaga receipt contains all expected fields", () => {
  const saga = new GovernanceDelegationRevocationSaga({});
  const receipt = saga.revoke(BASE_REQUEST, 30_000);

  assert.ok("delegationId" in receipt);
  assert.ok("status" in receipt);
  assert.ok("frozenResourceIds" in receipt);
  assert.ok("revokedPendingApprovals" in receipt);
  assert.ok("revokedActiveSessions" in receipt);
  assert.ok("revokedSecretLeases" in receipt);
  assert.ok("revokedWorkerLeases" in receipt);
  assert.ok("revokedScheduledTriggers" in receipt);
  assert.ok("revokedDerivedDelegationIds" in receipt);
  assert.ok("revokeWithinSlo" in receipt);
  assert.ok("cascadeWithinSlo" in receipt);
  assert.ok("completedAtMs" in receipt);
  assert.ok("sagaStages" in receipt);
  assert.ok("compensationResourceIds" in receipt);
  assert.ok("failedStage" in receipt);
  assert.ok("executionLog" in receipt);
});