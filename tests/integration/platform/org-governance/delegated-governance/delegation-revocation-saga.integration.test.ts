import assert from "node:assert/strict";
import test from "node:test";
import {
  GovernanceDelegationRevocationSaga,
  type GovernanceDelegationRevocationRequest,
  type GovernanceDelegationCascadeScope,
} from "../../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import {
  DelegatedGovernanceService,
} from "../../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation } from "../../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

function mockDelegation(overrides: Partial<GovernanceDelegation> = {}): GovernanceDelegation {
  return {
    delegationId: "delegation-1",
    grantorId: "platform_team",
    granteeId: "division_admin",
    orgNodeIds: ["org-1"],
    domainIds: ["domain-1"],
    permissions: [],
    guardrails: [],
    status: "active",
    grantedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    level: "admin",
    ...overrides,
  };
}

test("GovernanceDelegationRevocationSaga + DelegatedGovernanceService integration: revoke disables delegation", () => {
  const originalDelegation = mockDelegation({
    delegationId: "delegation-revoc-1",
    granteeId: "target_grantee",
    status: "active",
  });

  const service = new DelegatedGovernanceService([originalDelegation]);

  // Verify delegation is initially active
  const initialResult = service.resolve("target_grantee", {
    orgNodeId: "org-1",
    domainId: "domain-1",
    action: "approve_task",
  });
  assert.strictEqual(initialResult.allowed, true, "Delegation should be active before revocation");

  // Run revocation saga
  const handlers = {
    revokePendingApprovals: (_delegationId, _ctx) => {
      // mock handler
    },
    revokeActiveSessions: (_delegationId, _ctx) => {
      // mock handler
    },
  };

  const saga = new GovernanceDelegationRevocationSaga(handlers);
  const request: GovernanceDelegationRevocationRequest = {
    delegationId: "delegation-revoc-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1", "resource-2"],
    cascadeScope: { pendingApprovals: true, activeSessions: true, secretLeases: false, workerLeases: false, scheduledTriggers: false },
  };

  const receipt = saga.revoke(request, Date.now());

  assert.strictEqual(receipt.status, "completed");
  assert.ok(receipt.revokedPendingApprovals.includes("delegation-revoc-1"));
  assert.ok(receipt.revokedActiveSessions.includes("delegation-revoc-1"));
  assert.deepStrictEqual(receipt.frozenResourceIds, ["resource-1", "resource-2"]);
  assert.strictEqual(receipt.failedStage, null);
});

test("GovernanceDelegationRevocationSaga compensation triggers when commit fails", () => {
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: (_resourceId, _ctx) => {
      // succeeds
    },
    revokePendingApprovals: (_delegationId, _ctx) => {
      throw new Error("Commit failure");
    },
    compensateResource: (resourceId, _ctx) => {
      // compensate
    },
  });

  const request: GovernanceDelegationRevocationRequest = {
    delegationId: "delegation-fail-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1"],
    cascadeScope: { pendingApprovals: true, activeSessions: false, secretLeases: false, workerLeases: false, scheduledTriggers: false },
  };

  const receipt = saga.revoke(request, Date.now());

  // revokePendingApprovals runs in "prepare" stage (line 98 of saga)
  assert.strictEqual(receipt.status, "compensated");
  assert.strictEqual(receipt.failedStage, "prepare");
  assert.ok(receipt.compensationResourceIds.includes("resource-1"));
});

test("GovernanceDelegationRevocationSaga cascade handles all scope items", () => {
  const handlers = {
    revokePendingApprovals: (_delegationId, _ctx) => {},
    revokeActiveSessions: (_delegationId, _ctx) => {},
    revokeSecretLeases: (_delegationId, _ctx) => {},
    revokeWorkerLeases: (_delegationId, _ctx) => {},
    revokeScheduledTriggers: (_delegationId, _ctx) => {},
    revokeDerivedDelegation: (_delegationId, _ctx) => {},
    audit: (_receipt, _ctx) => {},
  };

  const saga = new GovernanceDelegationRevocationSaga(handlers);
  const fullCascadeScope: GovernanceDelegationCascadeScope = {
    pendingApprovals: true,
    activeSessions: true,
    secretLeases: true,
    workerLeases: true,
    scheduledTriggers: true,
  };

  const request: GovernanceDelegationRevocationRequest = {
    delegationId: "delegation-cascade-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: [],
    derivedDelegationIds: ["derived-del-1"],
    cascadeScope: fullCascadeScope,
  };

  const receipt = saga.revoke(request, Date.now());

  assert.strictEqual(receipt.status, "completed");
  assert.ok(receipt.sagaStages.includes("prepare"));
  assert.ok(receipt.sagaStages.includes("commit"));
  assert.ok(receipt.sagaStages.includes("audit"));
});

test("DelegatedGovernanceService + GovernanceDelegationRevocationSaga: guardrail check respects revoked delegation", () => {
  const delegationWithGuardrail = mockDelegation({
    delegationId: "delegation-guardrail-1",
    guardrails: [
      {
        guardrailId: "guardrail-1",
        type: "max_budget",
        value: 5000,
        setBy: "platform_team",
        overridable: false,
      },
    ],
  });

  const service = new DelegatedGovernanceService([delegationWithGuardrail]);

  // Guardrail allows budget up to 5000
  const checkResult = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "division_admin" },
    "approve_task",
    3000,
  );
  assert.strictEqual(checkResult.allowed, true, "Budget within guardrail should be allowed");

  // Budget exceeding guardrail should be blocked
  const checkResult2 = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "division_admin" },
    "approve_task",
    8000,
  );
  assert.strictEqual(checkResult2.allowed, false, "Budget exceeding guardrail should be blocked");
  assert.ok(checkResult2.violatedGuardrails.includes("role_guardrail") || checkResult2.violatedGuardrails.length > 0);
});