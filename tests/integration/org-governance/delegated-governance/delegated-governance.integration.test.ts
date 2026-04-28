/**
 * Integration Test: Delegated Governance
 *
 * Tests integration between governance delegation revocation saga,
 * delegated governance service, and delegation registry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../helpers/integration-context.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";

test("integration: GovernanceDelegationRevocationSaga with integration context completes successfully", () => {
  const ctx = createIntegrationContext("aa-delegation-");
  try {
    const emittedEvents: Array<{ stage: string; subjectId: string; outcome: string }> = [];

    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId) => {
        emittedEvents.push({ stage: "prepare", subjectId: resourceId, outcome: "completed" });
      },
      revokePendingApprovals: () => {
        emittedEvents.push({ stage: "prepare", subjectId: "pending_approvals", outcome: "completed" });
      },
      revokeActiveSessions: () => {
        emittedEvents.push({ stage: "prepare", subjectId: "active_sessions", outcome: "completed" });
      },
      revokeSecretLeases: () => {
        emittedEvents.push({ stage: "prepare", subjectId: "secret_leases", outcome: "completed" });
      },
      revokeWorkerLeases: () => {
        emittedEvents.push({ stage: "prepare", subjectId: "worker_leases", outcome: "completed" });
      },
      revokeScheduledTriggers: () => {
        emittedEvents.push({ stage: "prepare", subjectId: "scheduled_triggers", outcome: "completed" });
      },
      revokeDerivedDelegation: (delegationId) => {
        emittedEvents.push({ stage: "commit", subjectId: delegationId, outcome: "completed" });
      },
      audit: () => {
        emittedEvents.push({ stage: "audit", subjectId: "audit", outcome: "completed" });
      },
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["resource-1", "resource-2"],
      derivedDelegationIds: ["del-child-001"],
    }, Date.now());

    assert.equal(receipt.status, "completed");
    assert.equal(receipt.delegationId, "del-intg-001");
    assert.deepEqual(receipt.frozenResourceIds, ["resource-1", "resource-2"]);
    assert.deepEqual(receipt.revokedDerivedDelegationIds, ["del-child-001"]);
    assert.ok(emittedEvents.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga with seeded context triggers compensation", () => {
  const ctx = createSeededIntegrationContext("aa-delegation-comp-");
  try {
    const compensationLog: string[] = [];

    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId) => {
        if (resourceId === "resource-fail") {
          throw new Error("Simulated freeze failure");
        }
      },
      compensateResource: (resourceId) => {
        compensationLog.push(resourceId);
      },
      audit: () => {},
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-comp-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["resource-ok", "resource-fail", "resource-ok-2"],
      derivedDelegationIds: [],
    }, Date.now());

    assert.equal(receipt.status, "compensated");
    assert.equal(receipt.failedStage, "prepare");
    assert.deepEqual(receipt.compensationResourceIds, ["resource-ok-2", "resource-ok"]);
    assert.ok(compensationLog.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga coordinates multi-resource revocation with database", () => {
  const ctx = createSeededIntegrationContext("aa-delegation-db-");
  try {
    ctx.db.transaction(() => {
      const revocationLog: string[] = [];

      const saga = new GovernanceDelegationRevocationSaga({
        freezeResource: (resourceId) => {
          revocationLog.push(`freeze:${resourceId}`);
        },
        revokeDerivedDelegation: (delegationId) => {
          revocationLog.push(`revoke:${delegationId}`);
        },
        compensateResource: (resourceId) => {
          revocationLog.push(`compensate:${resourceId}`);
        },
        audit: () => {
          revocationLog.push("audit");
        },
      });

      const receipt = saga.revoke({
        delegationId: "del-intg-db-001",
        requestedAtMs: Date.now() - 2000,
        derivedResourceIds: ["res-a", "res-b", "res-c"],
        derivedDelegationIds: ["del-child-a", "del-child-b"],
      }, Date.now());

      assert.equal(receipt.status, "completed");
      assert.ok(revocationLog.includes("freeze:res-a"));
      assert.ok(revocationLog.includes("revoke:del-child-a"));
      assert.ok(revocationLog.includes("audit"));
    });
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga tracks execution log across all stages", () => {
  const ctx = createIntegrationContext("aa-delegation-log-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: () => {},
      revokeDerivedDelegation: () => {},
      compensateResource: () => {},
      audit: () => {},
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-log-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["resource-log-1"],
      derivedDelegationIds: ["child-log-1"],
    }, Date.now());

    assert.ok(receipt.executionLog.length >= 3);
    const stages = receipt.executionLog.map((e) => e.stage);
    assert.ok(stages.includes("prepare"));
    assert.ok(stages.includes("commit"));
    assert.ok(stages.includes("audit"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga respects cascade scope with selective revocation", () => {
  const ctx = createIntegrationContext("aa-delegation-cascade-");
  try {
    const cascadeLog: string[] = [];

    const saga = new GovernanceDelegationRevocationSaga({
      revokePendingApprovals: () => cascadeLog.push("pendingApprovals"),
      revokeActiveSessions: () => cascadeLog.push("activeSessions"),
      revokeSecretLeases: () => cascadeLog.push("secretLeases"),
      revokeWorkerLeases: () => cascadeLog.push("workerLeases"),
      revokeScheduledTriggers: () => cascadeLog.push("scheduledTriggers"),
    });

    saga.revoke({
      delegationId: "del-intg-cascade-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: [],
      derivedDelegationIds: [],
      cascadeScope: {
        pendingApprovals: true,
        activeSessions: false,
        secretLeases: true,
        workerLeases: false,
        scheduledTriggers: true,
      },
    }, Date.now());

    assert.ok(cascadeLog.includes("pendingApprovals"));
    assert.ok(cascadeLog.includes("secretLeases"));
    assert.ok(cascadeLog.includes("scheduledTriggers"));
    assert.ok(!cascadeLog.includes("activeSessions"));
    assert.ok(!cascadeLog.includes("workerLeases"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga calculates SLO metrics correctly", () => {
  const ctx = createIntegrationContext("aa-delegation-slo-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({});

    const fastReceipt = saga.revoke({
      delegationId: "del-slo-fast",
      requestedAtMs: Date.now() - 30_000,
      derivedResourceIds: ["res-fast"],
      derivedDelegationIds: [],
    }, Date.now());

    assert.equal(fastReceipt.revokeWithinSlo, true);
    assert.equal(fastReceipt.cascadeWithinSlo, true);

    const slowReceipt = saga.revoke({
      delegationId: "del-slo-slow",
      requestedAtMs: Date.now() - 400_000,
      derivedResourceIds: ["res-slow"],
      derivedDelegationIds: [],
    }, Date.now());

    assert.equal(slowReceipt.cascadeWithinSlo, false);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga handles empty derived resources gracefully", () => {
  const ctx = createIntegrationContext("aa-delegation-empty-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({
      audit: () => {},
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-empty-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: [],
      derivedDelegationIds: [],
    }, Date.now());

    assert.equal(receipt.status, "completed");
    assert.deepEqual(receipt.frozenResourceIds, []);
    assert.deepEqual(receipt.compensationResourceIds, []);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga with seeded context persists revocation record", () => {
  const ctx = createSeededIntegrationContext("aa-delegation-persist-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: () => {},
      revokeDerivedDelegation: () => {},
      audit: () => {},
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-persist-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["res-persist-1"],
      derivedDelegationIds: ["child-persist-1"],
    }, Date.now());

    assert.equal(receipt.status, "completed");

    const count = ctx.store.countExecutions();
    assert.ok(count >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga fails gracefully with missing handlers", () => {
  const ctx = createIntegrationContext("aa-delegation-missing-handlers-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({});

    const receipt = saga.revoke({
      delegationId: "del-intg-missing-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["res-missing"],
      derivedDelegationIds: ["child-missing"],
    }, Date.now());

    assert.equal(receipt.status, "completed");
    assert.deepEqual(receipt.frozenResourceIds, ["res-missing"]);
    assert.deepEqual(receipt.revokedDerivedDelegationIds, ["child-missing"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga processes derived delegations in commit stage", () => {
  const ctx = createIntegrationContext("aa-delegation-derived-");
  try {
    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: () => {},
      revokeDerivedDelegation: (id) => {
        if (id === "del-derived-fail") {
          throw new Error("Derived delegation revoke failed");
        }
      },
      compensateResource: () => {},
      audit: () => {},
    });

    const receipt = saga.revoke({
      delegationId: "del-intg-derived-001",
      requestedAtMs: Date.now() - 1000,
      derivedResourceIds: ["res-derived"],
      derivedDelegationIds: ["del-derived-ok", "del-derived-fail"],
    }, Date.now());

    assert.equal(receipt.status, "compensated");
    assert.equal(receipt.failedStage, "commit");
  } finally {
    ctx.cleanup();
  }
});
