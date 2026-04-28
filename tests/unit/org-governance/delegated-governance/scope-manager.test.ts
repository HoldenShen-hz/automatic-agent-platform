/**
 * Unit tests for Governance Scope Manager functions
 *
 * @see src/org-governance/delegated-governance/scope-manager/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { GovernanceDelegation, Guardrail } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import type { GovernancePermission } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import {
  matchesGovernanceScope,
  evaluateGuardrail,
  isOperationAllowedByRole,
  type GovernanceActionScope,
  type GovernanceOperationType,
} from "../../../../src/org-governance/delegated-governance/scope-manager/index.js";

// Helper to create governance delegations
function createDelegation(overrides: Partial<GovernanceDelegation> = {}): GovernanceDelegation {
  return {
    delegationId: overrides.delegationId ?? "delegation-1",
    grantorId: overrides.grantorId ?? "grantor-1",
    granteeId: overrides.granteeId ?? "grantee-1",
    orgNodeIds: overrides.orgNodeIds ?? [],
    domainIds: overrides.domainIds ?? [],
    permissions: overrides.permissions ?? [],
    guardrails: overrides.guardrails ?? [],
    expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59Z",
    revocable: overrides.revocable ?? true,
    status: overrides.status ?? "active",
    ...overrides,
  };
}

function createScope(overrides: {
  orgNodeId?: string;
  domainId?: string;
  capability?: string;
  permission?: GovernancePermission;
} = {}): GovernanceActionScope {
  const scope: GovernanceActionScope = {
    orgNodeId: overrides.orgNodeId ?? "org-node-1",
    capability: overrides.capability ?? "capability-1",
  };
  if (overrides.domainId !== undefined) {
    (scope as { domainId?: string }).domainId = overrides.domainId;
  }
  if (overrides.permission !== undefined) {
    (scope as { permission?: GovernancePermission }).permission = overrides.permission;
  }
  return scope;
}

test("matchesGovernanceScope returns true when orgNodeIds is empty (applies to all)", () => {
  const delegation = createDelegation({ orgNodeIds: [] });
  const scope = createScope({ orgNodeId: "any-org" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when orgNodeId is in orgNodeIds", () => {
  const delegation = createDelegation({ orgNodeIds: ["org-1", "org-2"] });
  const scope = createScope({ orgNodeId: "org-1" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns false when orgNodeId is not in orgNodeIds", () => {
  const delegation = createDelegation({ orgNodeIds: ["org-1", "org-2"] });
  const scope = createScope({ orgNodeId: "org-3" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, false);
});

test("matchesGovernanceScope returns true when domainIds is empty (applies to all)", () => {
  const delegation = createDelegation({ domainIds: [] });
  const scope = createScope({ domainId: "any-domain" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when domainId matches", () => {
  const delegation = createDelegation({ domainIds: ["domain-1", "domain-2"] });
  const scope = createScope({ domainId: "domain-1" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when scope has no domainId", () => {
  const delegation = createDelegation({ domainIds: ["domain-1"] });
  const scope = createScope({});

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns false when domainId does not match", () => {
  const delegation = createDelegation({ domainIds: ["domain-1"] });
  const scope = createScope({ domainId: "domain-2" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, false);
});

test("matchesGovernanceScope returns true when permissions is empty (applies to all)", () => {
  const delegation = createDelegation({ permissions: [] });
  const scope = createScope({ permission: "manage_domains" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when permission matches", () => {
  const delegation = createDelegation({ permissions: ["manage_domains", "manage_prompts"] });
  const scope = createScope({ permission: "manage_domains" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, true);
});

test("matchesGovernanceScope returns false when permission does not match", () => {
  const delegation = createDelegation({ permissions: ["manage_domains"] });
  const scope = createScope({ permission: "manage_prompts" });

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, false);
});

test("matchesGovernanceScope returns false when scope has no permission", () => {
  const delegation = createDelegation({ permissions: ["manage_domains"] });
  const scope = createScope({});

  const result = matchesGovernanceScope(delegation, scope);

  assert.equal(result, false);
});

test("evaluateGuardrail allows max_risk_level when within threshold", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "medium");

  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks max_risk_level when exceeds threshold", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "max_risk_level",
    value: "medium",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "high");

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("exceeds max"));
});

test("evaluateGuardrail allows max_budget when within limit", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "max_budget",
    value: 1000,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 500);

  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks max_budget when exceeds limit", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "max_budget",
    value: 500,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 1000);

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("exceeds max"));
});

test("evaluateGuardrail blocks forbidden_tools when tool is forbidden", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "forbidden_tools",
    value: ["tool-a", "tool-b"],
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "tool-a");

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("forbidden"));
});

test("evaluateGuardrail allows forbidden_tools when tool is not forbidden", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "forbidden_tools",
    value: ["tool-a", "tool-b"],
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "tool-c");

  assert.equal(result.allowed, true);
});

test("evaluateGuardrail always allows mandatory_approval", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "mandatory_approval",
    value: true,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, false);

  assert.equal(result.allowed, true);
  assert.ok(result.reason.includes("Approval required"));
});

test("evaluateGuardrail allows min_eval_threshold when above minimum", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "min_eval_threshold",
    value: 0.8,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0.9);

  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks min_eval_threshold when below minimum", () => {
  const guardrail: Guardrail = {
    guardrailId: "g1",
    type: "min_eval_threshold",
    value: 0.8,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0.5);

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("below minimum"));
});

test("isOperationAllowedByRole allows platform_team all operations", () => {
  const operations: GovernanceOperationType[] = ["domain_onboarding", "modify_approval_rules", "publish_pack",
    "adjust_agent_autonomy", "create_trigger", "modify_global_guardrails", "cross_domain_strategy"];

  for (const op of operations) {
    const result = isOperationAllowedByRole(op, "platform_team");
    assert.equal(result, true, `${op} should be allowed for platform_team`);
  }
});

test("isOperationAllowedByRole allows division_admin most operations except global", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "division_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "division_admin"), false);
});

test("isOperationAllowedByRole allows department_admin most operations", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "department_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "department_admin"), false);
});

test("isOperationAllowedByRole gives team_lead only daily operations scope", () => {
  const deniedOperations: GovernanceOperationType[] = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "modify_global_guardrails",
    "cross_domain_strategy",
  ];

  for (const op of deniedOperations) {
    const result = isOperationAllowedByRole(op, "team_lead");
    assert.equal(result, false, `${op} should not be allowed for team_lead`);
  }

  assert.equal(isOperationAllowedByRole("approve_task", "team_lead"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "team_lead"), true);
});
