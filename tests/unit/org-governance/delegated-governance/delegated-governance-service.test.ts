import test from "node:test";
import assert from "node:assert/strict";

import { DelegatedGovernanceService } from "../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation, Guardrail } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

test("DelegatedGovernanceService.resolve returns scope_not_granted when no matching delegation", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.resolve("grantee_1", {
    orgNodeId: "org_b",
    capability: "manage_packs",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.delegationId, null);
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_not_granted"));
});

test("DelegatedGovernanceService.resolve returns scope_granted when matching delegation exists", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains", "manage_packs"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.resolve("grantee_1", {
    orgNodeId: "org_a",
    capability: "manage_packs",
    permission: "manage_packs",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "del_1");
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_granted"));
});

test("DelegatedGovernanceService.checkOperation blocks disallowed role", () => {
  const delegations: GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  const result = service.checkOperation(
    { actorId: "user_1", actorRole: "team_lead", orgNodeId: "org_1" },
    "modify_global_guardrails",
  );

  assert.equal(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("role_guardrail"));
});

test("DelegatedGovernanceService.checkOperation allows permitted role", () => {
  const delegations: GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  const result = service.checkOperation(
    { actorId: "user_1", actorRole: "division_admin", orgNodeId: "org_1" },
    "create_trigger",
  );

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.checkOperation respects platform team guardrails", () => {
  const guardrails: Guardrail[] = [
    {
      guardrailId: "guard_1",
      type: "max_risk_level",
      value: "high",
      setBy: "platform_team",
      overridable: false,
    },
  ];

  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "platform_team",
      granteeId: "grantee_1",
      orgNodeIds: ["org_1"],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails,
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.checkOperation(
    { actorId: "user_1", actorRole: "division_admin", orgNodeId: "org_1" },
    "domain_onboarding",
    "critical",
  );

  assert.equal(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("guard_1"));
});

test("DelegatedGovernanceService.getApplicableGuardrails returns guardrails for matching org", () => {
  const guardrails: Guardrail[] = [
    {
      guardrailId: "guard_1",
      type: "max_budget",
      value: 1000,
      setBy: "platform_team",
      overridable: false,
    },
  ];

  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "platform_team",
      granteeId: "grantee_1",
      orgNodeIds: ["org_1"],
      domainIds: [],
      permissions: [],
      guardrails,
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.getApplicableGuardrails("org_1");

  assert.equal(result.length, 1);
  assert.equal(result[0]!.guardrailId, "guard_1");
});

test("DelegatedGovernanceService.getApplicableGuardrails filters by domain when specified", () => {
  const guardrails: Guardrail[] = [
    {
      guardrailId: "guard_domain",
      type: "max_budget",
      value: 500,
      setBy: "platform_team",
      overridable: false,
    },
  ];

  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "platform_team",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: ["domain_a"],
      permissions: [],
      guardrails,
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const resultWithDomain = service.getApplicableGuardrails("org_1", "domain_a");
  const resultWithoutDomain = service.getApplicableGuardrails("org_1", "domain_b");

  assert.equal(resultWithDomain.length, 1);
  assert.equal(resultWithoutDomain.length, 0);
});

test("DelegatedGovernanceService.listDelegationsForGrantee returns active delegations", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_active",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del_revoked",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_packs"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "revoked",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.listDelegationsForGrantee("grantee_1");

  assert.equal(result.length, 1);
  assert.equal(result[0]!.delegationId, "del_active");
});

test("DelegatedGovernanceService.validateInheritanceRule returns false when child has higher role", () => {
  // Hierarchy: platform_team(0) > division_admin(1) > department_admin(2) > team_lead(3)
  // When child has higher role (lower index), tighten is not allowed
  const service = new DelegatedGovernanceService([]);

  // parent=team_lead(3), child=division_admin(1): childIndex(1) < parentIndex(3)
  const result = service.validateInheritanceRule("team_lead", "division_admin", "tighten");

  assert.equal(result.allowed, false);
});

test("DelegatedGovernanceService.validateInheritanceRule tighten allowed when child has lower role", () => {
  const service = new DelegatedGovernanceService([]);

  // parent=division_admin(1), child=team_lead(3): childIndex(3) > parentIndex(1)
  const result = service.validateInheritanceRule("division_admin", "team_lead", "tighten");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule loosen not allowed when child is lower in hierarchy", () => {
  // parent=division_admin(1), child=department_admin(2): childIndex > parentIndex
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("division_admin", "department_admin", "loosen");

  assert.equal(result.allowed, false);
});

test("DelegatedGovernanceService.validateInheritanceRule append returns true when roles are same", () => {
  // Same role: parentIndex == childIndex
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("team_lead", "team_lead", "append");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule delete returns true when roles are same", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("division_admin", "division_admin", "delete");

  assert.equal(result.allowed, true);
});

test("intersectPermissions returns only permissions present in both arrays", () => {
  const { intersectPermissions } = await import("../../../../src/org-governance/delegated-governance/delegated-governance-service.js");

  const result = intersectPermissions(
    ["manage_domains", "manage_packs", "manage_budgets"],
    ["manage_packs", "manage_knowledge"],
  );

  assert.equal(result.length, 1);
  assert.ok(result.includes("manage_packs"));
});

test("intersectPermissions returns empty when granted is empty", () => {
  const { intersectPermissions } = await import("../../../../src/org-governance/delegated-governance/delegated-governance-service.js");

  const result = intersectPermissions([], ["manage_packs"]);

  assert.equal(result.length, 0);
});

test("intersectPermissions returns empty when available is empty", () => {
  const { intersectPermissions } = await import("../../../../src/org-governance/delegated-governance/delegated-governance-service.js");

  const result = intersectPermissions(["manage_packs"], []);

  assert.equal(result.length, 0);
});

test("DelegatedGovernanceService.resolve respects grantor permission intersection", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains", "manage_packs", "manage_budgets"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Grantee has manage_domains in delegation, but grantor only has manage_packs
  // So manage_domains should be rejected
  const result = service.resolve(
    "grantee_1",
    {
      orgNodeId: "org_a",
      capability: "manage_domains",
      permission: "manage_domains",
    },
    undefined, // now
    ["manage_packs", "manage_knowledge"], // grantorPermissions - no manage_domains
  );

  assert.equal(result.allowed, false);
  assert.equal(result.delegationId, "del_1");
  assert.ok(result.reasonCodes.includes("delegated_governance.permission_exceeds_grantor_authority"));
});

test("DelegatedGovernanceService.resolve allows permission in intersection", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains", "manage_packs"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Both delegation and grantor have manage_packs
  const result = service.resolve(
    "grantee_1",
    {
      orgNodeId: "org_a",
      capability: "manage_packs",
      permission: "manage_packs",
    },
    undefined,
    ["manage_packs", "manage_knowledge"], // grantor has manage_packs
  );

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "del_1");
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_granted"));
});

test("DelegatedGovernanceService.resolve without grantorPermissions bypasses intersection check", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains", "manage_packs"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // No grantorPermissions passed, so no intersection check
  const result = service.resolve("grantee_1", {
    orgNodeId: "org_a",
    capability: "manage_domains",
    permission: "manage_domains",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "del_1");
});

test("DelegatedGovernanceService.resolve grantee cannot exceed grantor when grantor has fewer permissions", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: ["org_a"],
      domainIds: [],
      permissions: ["manage_domains", "manage_packs", "manage_budgets", "manage_knowledge"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Grantor only has manage_packs and manage_budgets
  // Grantee attempts manage_knowledge which is in delegation but NOT in grantor's permissions
  const result = service.resolve(
    "grantee_1",
    {
      orgNodeId: "org_a",
      capability: "manage_knowledge",
      permission: "manage_knowledge",
    },
    undefined,
    ["manage_packs", "manage_budgets"], // grantor permissions - no manage_knowledge
  );

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("delegated_governance.permission_exceeds_grantor_authority"));
});
