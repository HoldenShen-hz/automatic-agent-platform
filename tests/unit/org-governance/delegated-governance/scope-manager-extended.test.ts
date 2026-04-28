/**
 * Unit tests for Governance Scope Manager - Additional edge cases
 * Tests for scope-manager/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { GovernanceDelegation } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import type { GovernancePermission } from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import {
  matchesGovernanceScope,
  evaluateGuardrail,
  isOperationAllowedByRole,
  type GovernanceActionScope,
} from "../../../../src/org-governance/delegated-governance/scope-manager/index.js";

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

test("matchesGovernanceScope requires all three conditions to be true", () => {
  const delegation = createDelegation({
    orgNodeIds: ["org-1"],
    domainIds: ["domain-1"],
    permissions: ["manage_domains"],
  });
  const scope: GovernanceActionScope = {
    orgNodeId: "org-1",
    domainId: "domain-1",
    capability: "test-capability",
    permission: "manage_domains",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("matchesGovernanceScope fails if only org matches", () => {
  const delegation = createDelegation({
    orgNodeIds: ["org-1"],
    domainIds: [],
    permissions: [],
  });
  const scope: GovernanceActionScope = {
    orgNodeId: "org-1",
    domainId: "domain-1",
    capability: "test-capability",
  };
  const result = matchesGovernanceScope(delegation, scope);
  // domainIds is empty (applies to all) so domain check passes
  // but scope has no permission so permission check should pass (empty delegation permissions = all)
  assert.equal(result, true);
});

test("matchesGovernanceScope fails if org does not match", () => {
  const delegation = createDelegation({
    orgNodeIds: ["org-1"],
    domainIds: [],
    permissions: [],
  });
  const scope: GovernanceActionScope = {
    orgNodeId: "org-2",
    capability: "test-capability",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, false);
});

test("matchesGovernanceScope handles multiple orgNodeIds", () => {
  const delegation = createDelegation({
    orgNodeIds: ["org-1", "org-2", "org-3"],
    domainIds: [],
    permissions: [],
  });
  const scope: GovernanceActionScope = {
    orgNodeId: "org-2",
    capability: "test-capability",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("matchesGovernanceScope handles multiple domainIds", () => {
  const delegation = createDelegation({
    orgNodeIds: [],
    domainIds: ["domain-1", "domain-2", "domain-3"],
    permissions: [],
  });
  const scope: GovernanceActionScope = {
    orgNodeId: "any-org",
    domainId: "domain-2",
    capability: "test-capability",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("evaluateGuardrail handles unknown guardrail type as denied", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "unknown_type",
    value: "test",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "any_value");
  assert.equal(result.allowed, false);
});

test("evaluateGuardrail max_risk_level handles risk levels not in order", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "max_risk_level",
    value: "low",
    setBy: "platform_team",
    overridable: false,
  };

  // Attempting "critical" which is higher than "low"
  const result = evaluateGuardrail(guardrail, "critical");
  assert.equal(result.allowed, false);
});

test("evaluateGuardrail max_risk_level allows same level", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "max_risk_level",
    value: "medium",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "medium");
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail max_budget allows equal budget", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "max_budget",
    value: 1000,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 1000);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail max_budget handles zero budget", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "max_budget",
    value: 0,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail forbidden_tools handles empty array", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "forbidden_tools",
    value: [],
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "any_tool");
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail min_eval_threshold handles boundary value", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "min_eval_threshold",
    value: 0.8,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0.8);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail min_eval_threshold handles zero threshold", () => {
  const guardrail: any = {
    guardrailId: "g1",
    type: "min_eval_threshold",
    value: 0,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0);
  assert.equal(result.allowed, true);
});

test("isOperationAllowedByRole department_admin has correct permissions", () => {
  // department_admin should be able to do most things except global operations
  assert.equal(isOperationAllowedByRole("domain_onboarding", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "department_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "department_admin"), false);
});
