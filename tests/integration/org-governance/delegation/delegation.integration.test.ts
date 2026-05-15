/**
 * Integration tests for Delegation flow
 * Tests cover delegation scenarios including cross-component interactions
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DelegatedGovernanceService } from "../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { GovernanceDelegationRevocationSaga } from "../../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import type { GovernanceDelegation } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

function createDelegation(overrides: Partial<{
  delegationId: string;
  grantorId: string;
  granteeId: string;
  permissions: string[];
  orgNodeIds: string[];
  domainIds: string[];
  status: "active" | "revoked" | "expired";
  guardrails: { guardrailId: string; type: string; value: unknown }[];
}> = {}): GovernanceDelegation {
  return {
    delegationId: overrides.delegationId ?? "delegation-1",
    grantorId: overrides.grantorId ?? "platform_team",
    granteeId: overrides.granteeId ?? "division_admin_1",
    permissions: overrides.permissions ?? ["approve_task", "domain_onboarding"],
    orgNodeIds: overrides.orgNodeIds ?? [],
    domainIds: overrides.domainIds ?? [],
    status: overrides.status ?? "active",
    guardrails: overrides.guardrails ?? [],
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("Delegation and revocation saga integration", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task", "domain_onboarding"],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Verify delegation works
  const resolveResult = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-1",
    permission: "approve_task",
  });
  assert.equal(resolveResult.allowed, true);

  // Now revoke the delegation using the saga
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    revokeDerivedDelegation: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");
});

test("Delegation with guardrails and revocation saga", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_budget_increase"],
      guardrails: [
        { guardrailId: "max_budget_1000", type: "max_budget", value: 1000 },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Check operation with guardrail enforcement
  const checkResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "approve_budget_increase",
    500, // Under limit
  );
  assert.equal(checkResult.allowed, true);

  // Exceed limit
  const checkResult2 = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "approve_budget_increase",
    2000, // Over limit
  );
  assert.equal(checkResult2.allowed, false);
  assert.ok(checkResult2.violatedGuardrails.includes("max_budget_1000"));

  // Revoke delegation
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: [],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");
});

test("Multiple delegations with cascading revocation", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task"],
    }),
    createDelegation({
      delegationId: "delegation-2",
      grantorId: "division_admin_1",
      granteeId: "department_admin_1",
      permissions: ["approve_task", "create_trigger"],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Both delegations should work
  const result1 = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-1",
    permission: "approve_task",
  });
  assert.equal(result1.allowed, true);

  const result2 = governanceService.resolve("department_admin_1", {
    orgNodeId: "dept-1",
    permission: "approve_task",
  });
  assert.equal(result2.allowed, true);

  // Revoke with cascade
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    revokeDerivedDelegation: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: ["delegation-2"], // Child delegation
  }, Date.now());

  assert.equal(receipt.status, "completed");
  assert.ok(receipt.revokedDerivedDelegationIds.includes("delegation-2"));
});

test("Delegation inheritance validation", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task", "modify_approval_rules"],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Validate inheritance rules
  const tightenResult = governanceService.validateInheritanceRule(
    "platform_team",
    "division_admin",
    "tighten",
  );
  assert.equal(tightenResult.allowed, true);

  const loosenResult = governanceService.validateInheritanceRule(
    "platform_team",
    "division_admin",
    "loosen",
  );
  assert.equal(loosenResult.allowed, false);

  const appendResult = governanceService.validateInheritanceRule(
    "platform_team",
    "team_lead",
    "append",
  );
  assert.equal(appendResult.allowed, true);
});

test("Delegation with org node scope and revocation", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task"],
      orgNodeIds: ["dept-finance", "dept-engineering"], // Limited scope
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Within scope
  const inScopeResult = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-finance",
    permission: "approve_task",
  });
  assert.equal(inScopeResult.allowed, true);

  // Out of scope
  const outOfScopeResult = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-sales",
    permission: "approve_task",
  });
  assert.equal(outOfScopeResult.allowed, false);

  // Revoke
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: [],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");
});

test("Delegation with domain scope and guardrails", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "department_admin_1",
      permissions: ["approve_task", "publish_pack"],
      domainIds: ["finance", "hr"], // Limited to finance and HR domains
      guardrails: [
        { guardrailId: "max_risk", type: "max_risk_level", value: "high" },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Within domain scope - low risk
  const result1 = governanceService.checkOperation(
    { actorId: "department_admin_1", actorRole: "department_admin", orgNodeId: "dept-1", domainId: "finance" },
    "approve_task",
    "low",
  );
  assert.equal(result1.allowed, true);

  // Within domain scope - critical risk (exceeds guardrail)
  const result2 = governanceService.checkOperation(
    { actorId: "department_admin_1", actorRole: "department_admin", orgNodeId: "dept-1", domainId: "finance" },
    "approve_task",
    "critical",
  );
  assert.equal(result2.allowed, false);
  assert.ok(result2.violatedGuardrails.includes("max_risk"));

  // Out of domain scope
  const result3 = governanceService.resolve("department_admin_1", {
    orgNodeId: "dept-1",
    domainId: "engineering", // Not in scope
    permission: "approve_task",
  });
  assert.equal(result3.allowed, false);
});

test("Delegation list and revocation saga integration", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({ delegationId: "del-1", granteeId: "user-1", status: "active" }),
    createDelegation({ delegationId: "del-2", granteeId: "user-1", status: "active" }),
    createDelegation({ delegationId: "del-3", granteeId: "user-2", status: "active" }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // List delegations for user-1
  const user1Delegations = governanceService.listDelegationsForGrantee("user-1");
  assert.equal(user1Delegations.length, 2);

  // Revoke one delegation
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "del-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: [],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");

  // List again - should still have 2 because listDelegationsForGrantee
  // doesn't check revocation status directly (would need to re-resolve)
});

test("Guardrail evaluation with revocation saga compensation", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task", "approve_budget_increase"],
      guardrails: [
        { guardrailId: "max_budget", type: "max_budget", value: 1000 },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Violate guardrail
  const result = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "approve_budget_increase",
    5000,
  );
  assert.equal(result.allowed, false);

  // Revoke with cascade
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    revokePendingApprovals: () => {},
    revokeActiveSessions: () => {},
    compensateResource: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1", "resource-2"],
    derivedDelegationIds: [],
  }, Date.now());

  // SLO checks
  assert.ok(receipt.revokeWithinSlo);
});

test("Delegation with multiple guardrails", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task", "adjust_agent_autonomy"],
      guardrails: [
        { guardrailId: "max_budget", type: "max_budget", value: 1000 },
        { guardrailId: "max_risk", type: "max_risk_level", value: "high" },
        { guardrailId: "forbidden_tools", type: "forbidden_tools", value: ["shell_exec", "rm_rf"] },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // All guardrails pass
  const result1 = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "approve_task",
    "high",
  );
  assert.equal(result1.allowed, true);

  // Budget guardrail fails
  const result2 = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "approve_budget_increase",
    2000,
  );
  assert.equal(result2.allowed, false);

  // Forbidden tool guardrail fails
  const result3 = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-1" },
    "adjust_agent_autonomy",
    "shell_exec",
  );
  assert.equal(result3.allowed, false);
});

test("Delegation applicable guardrails retrieval", () => {
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task"],
      orgNodeIds: ["dept-finance"],
      domainIds: ["finance"],
      guardrails: [
        { guardrailId: "guard-1", type: "max_budget", value: 500 },
      ],
    }),
    createDelegation({
      delegationId: "delegation-2",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["approve_task"],
      orgNodeIds: [],
      domainIds: ["hr"],
      guardrails: [
        { guardrailId: "guard-2", type: "max_budget", value: 300 },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // Get guardrails for finance scope
  const financeGuardrails = governanceService.getApplicableGuardrails("dept-finance", "finance");
  assert.equal(financeGuardrails.length, 1);
  assert.equal(financeGuardrails[0]!.guardrailId, "guard-1");

  // Get guardrails for HR scope
  const hrGuardrails = governanceService.getApplicableGuardrails("dept-hr", "hr");
  assert.equal(hrGuardrails.length, 1);
  assert.equal(hrGuardrails[0]!.guardrailId, "guard-2");

  // Get guardrails for unknown scope
  const unknownGuardrails = governanceService.getApplicableGuardrails("dept-unknown", "unknown");
  assert.equal(unknownGuardrails.length, 0);
});
