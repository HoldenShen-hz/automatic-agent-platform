import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { DelegatedGovernanceService } from "../../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation, Guardrail } from "../../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

function mockDelegation(overrides: Partial<GovernanceDelegation> = {}): GovernanceDelegation {
  return {
    delegationId: "delegation-1",
    grantorId: "platform_team",
    granteeId: "division_admin",
    level: "admin",
    delegatable: false,
    orgNodeIds: ["org-1"],
    domainIds: ["domain-1"],
    permissions: ["manage_approvals", "manage_budgets"],
    guardrails: [],
    status: "active",
    expiresAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockGuardrail(overrides: Partial<Guardrail> = {}): Guardrail {
  return {
    guardrailId: "guardrail-1",
    type: "max_budget",
    value: 1000,
    ...overrides,
  };
}

test("DelegatedGovernanceService resolve grants access for matching scope", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const result = service.resolve("division_admin", {
    orgNodeId: "org-1",
    domainId: "domain-1",
    action: "approve_task",
    permission: "manage_approvals",
  });

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.delegationId, "delegation-1");
});

test("DelegatedGovernanceService resolve denies access for non-matching scope", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const result = service.resolve("unknown_grantee", {
    orgNodeId: "org-1",
    domainId: "domain-1",
    action: "approve_task",
  });

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.delegationId, null);
});

test("DelegatedGovernanceService checkOperation allows permitted operation", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const result = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "division_admin" },
    "approve_task",
  );

  assert.strictEqual(result.allowed, true);
});

test("DelegatedGovernanceService checkOperation denies operation for wrong role", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const result = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "team_lead" },
    "approve_budget_increase",
  );

  assert.strictEqual(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("role_guardrail"));
});

test("DelegatedGovernanceService checkOperation evaluates guardrails", () => {
  const delegation = mockDelegation({
    guardrails: [mockGuardrail({ guardrailId: "budget-1", type: "max_budget", value: 500 })],
  });
  const service = new DelegatedGovernanceService([delegation]);
  const result = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "division_admin" },
    "approve_task",
    1000,
  );

  assert.strictEqual(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("budget-1"));
});

test("DelegatedGovernanceService getApplicableGuardrails returns guardrails", () => {
  const delegation = mockDelegation({
    guardrails: [mockGuardrail({ guardrailId: "rail-1" }), mockGuardrail({ guardrailId: "rail-2" })],
  });
  const service = new DelegatedGovernanceService([delegation]);
  const guardrails = service.getApplicableGuardrails("org-1", "domain-1");

  assert.strictEqual(guardrails.length, 2);
});

test("DelegatedGovernanceService getApplicableGuardrails returns empty for unknown org", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const guardrails = service.getApplicableGuardrails("unknown-org", "domain-1");

  assert.strictEqual(guardrails.length, 0);
});

test("DelegatedGovernanceService listDelegationsForGrantee returns delegations", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const delegations = service.listDelegationsForGrantee("division_admin");

  assert.strictEqual(delegations.length, 1);
  assert.strictEqual(delegations[0]!.delegationId, "delegation-1");
});

test("DelegatedGovernanceService listDelegationsForGrantee returns empty for unknown grantee", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const delegations = service.listDelegationsForGrantee("unknown");

  assert.strictEqual(delegations.length, 0);
});

test("DelegatedGovernanceService validateInheritanceRule tighten always allowed", () => {
  const service = new DelegatedGovernanceService([]);
  const result = service.validateInheritanceRule("division_admin", "team_lead", "tighten");

  assert.strictEqual(result.allowed, true);
});

test("DelegatedGovernanceService validateInheritanceRule loosen only by parent", () => {
  const service = new DelegatedGovernanceService([]);
  const parentResult = service.validateInheritanceRule("division_admin", "division_admin", "loosen");
  assert.strictEqual(parentResult.allowed, true);

  const childResult = service.validateInheritanceRule("division_admin", "team_lead", "loosen");
  assert.strictEqual(childResult.allowed, false);
});

test("DelegatedGovernanceService validateInheritanceRule append always allowed", () => {
  const service = new DelegatedGovernanceService([]);
  const result = service.validateInheritanceRule("division_admin", "team_lead", "append");

  assert.strictEqual(result.allowed, true);
});

test("DelegatedGovernanceService validateInheritanceRule child cannot perform parent actions", () => {
  const service = new DelegatedGovernanceService([]);
  const result = service.validateInheritanceRule("division_admin", "department_admin", "loosen");

  assert.strictEqual(result.allowed, false);
});

test("DelegatedGovernanceService resolve filters by domain", () => {
  const service = new DelegatedGovernanceService([mockDelegation()]);
  const result = service.resolve("division_admin", {
    orgNodeId: "org-1",
    domainId: "unknown-domain",
    action: "approve_task",
  });

  assert.strictEqual(result.allowed, false);
});

test("DelegatedGovernanceService getApplicableGuardrails with empty domainIds matches all domains", () => {
  const delegation = mockDelegation({
    orgNodeIds: ["org-1"],
    domainIds: [],
    guardrails: [mockGuardrail({ guardrailId: "rail-1" })],
  });
  const service = new DelegatedGovernanceService([delegation]);
  const guardrails = service.getApplicableGuardrails("org-1", "any-domain");

  assert.strictEqual(guardrails.length, 1);
});

test("DelegatedGovernanceService checkOperation with no attemptedValue fails closed", () => {
  const delegation = mockDelegation({
    guardrails: [mockGuardrail({ guardrailId: "rail-1", value: 0 })],
  });
  const service = new DelegatedGovernanceService([delegation]);
  const result = service.checkOperation(
    { orgNodeId: "org-1", domainId: "domain-1", actorRole: "division_admin" },
    "approve_task",
  );

  assert.strictEqual(result.allowed, false);
  assert.deepStrictEqual(result.violatedGuardrails, ["rail-1"]);
});

test("DelegatedGovernanceService resolve with no delegations returns not allowed", () => {
  const service = new DelegatedGovernanceService([]);
  const result = service.resolve("anyone", {
    orgNodeId: "org-1",
    domainId: "domain-1",
    action: "approve_task",
  });

  assert.strictEqual(result.allowed, false);
  assert.deepStrictEqual(result.reasonCodes, ["delegated_governance.scope_not_granted"]);
});

test("DelegatedGovernanceService listDelegationsForGrantee filters expired", () => {
  const delegation = mockDelegation({
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  const service = new DelegatedGovernanceService([delegation]);
  const delegations = service.listDelegationsForGrantee("division_admin");

  assert.strictEqual(delegations.length, 0);
});
