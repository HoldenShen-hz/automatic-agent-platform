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
  assert.equal(result[0].guardrailId, "guard_1");
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
  assert.equal(result[0].delegationId, "del_active");
});

test("DelegatedGovernanceService.validateInheritanceRule tightens always allowed", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("division_admin", "team_lead", "tighten");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule lower role cannot loosen", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("division_admin", "team_lead", "loosen");

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("Lower roles cannot loosen"));
});

test("DelegatedGovernanceService.validateInheritanceRule parent can loosen", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("division_admin", "department_admin", "loosen");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule append always allowed", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("team_lead", "division_admin", "append");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule delete subject to ownership", () => {
  const service = new DelegatedGovernanceService([]);

  const result = service.validateInheritanceRule("team_lead", "division_admin", "delete");

  assert.equal(result.allowed, true);
});
