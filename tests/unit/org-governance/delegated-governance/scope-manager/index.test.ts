import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesGovernanceScope,
  evaluateGuardrail,
  isOperationAllowedByRole,
} from "../../../../../src/org-governance/delegated-governance/scope-manager/index.js";

test("matchesGovernanceScope returns true when delegation has no restrictions", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "any_node",
    domainId: "any_domain",
    capability: "capability_1",
    permission: "manage_domains" as const,
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when orgNodeId is in delegation orgNodeIds", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: ["node_1", "node_2"],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "node_1",
    capability: "capability_1",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("matchesGovernanceScope returns false when orgNodeId is not in delegation orgNodeIds", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: ["node_1", "node_2"],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "node_other",
    capability: "capability_1",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, false);
});

test("matchesGovernanceScope returns false when domainId is not in delegation domainIds", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: ["domain_1"],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "node_1",
    domainId: "domain_other",
    capability: "capability_1",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, false);
});

test("matchesGovernanceScope returns true when domainId is in delegation domainIds", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: ["domain_1", "domain_2"],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "node_1",
    domainId: "domain_2",
    capability: "capability_1",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("matchesGovernanceScope returns true when delegation has no permission requirement", () => {
  const delegation = {
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active" as const,
  };
  const scope = {
    orgNodeId: "any_node",
    capability: "capability_1",
  };
  const result = matchesGovernanceScope(delegation, scope);
  assert.equal(result, true);
});

test("evaluateGuardrail allows risk level within max", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "max_risk_level" as const,
    value: "high",
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, "low");
  assert.deepEqual(result, { allowed: true, reason: "Within risk guardrail" });
});

test("evaluateGuardrail rejects risk level above max", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "max_risk_level" as const,
    value: "low",
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, "critical");
  assert.deepEqual(result, { allowed: false, reason: "Risk level critical exceeds max low" });
});

test("evaluateGuardrail allows budget within max", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "max_budget" as const,
    value: 1000,
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, 500);
  assert.deepEqual(result, { allowed: true, reason: "Within budget guardrail" });
});

test("evaluateGuardrail rejects budget above max", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "max_budget" as const,
    value: 500,
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, 1000);
  assert.deepEqual(result, { allowed: false, reason: "Budget 1000 exceeds max 500" });
});

test("evaluateGuardrail allows tool not in forbidden list", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "forbidden_tools" as const,
    value: ["bash", "exec"],
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, "read");
  assert.deepEqual(result, { allowed: true, reason: "Tool not forbidden" });
});

test("evaluateGuardrail rejects tool in forbidden list", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "forbidden_tools" as const,
    value: ["bash", "exec"],
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, "bash");
  assert.deepEqual(result, { allowed: false, reason: "Tool bash is forbidden" });
});

test("evaluateGuardrail always allows mandatory_approval", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "mandatory_approval" as const,
    value: null,
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, "any_value");
  assert.deepEqual(result, { allowed: true, reason: "Approval required for this operation" });
});

test("evaluateGuardrail allows eval threshold above minimum", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "min_eval_threshold" as const,
    value: 0.8,
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, 0.9);
  assert.deepEqual(result, { allowed: true, reason: "Above eval threshold" });
});

test("evaluateGuardrail rejects eval threshold below minimum", () => {
  const guardrail = {
    guardrailId: "gr_1",
    type: "min_eval_threshold" as const,
    value: 0.8,
    setBy: "platform_team" as const,
    overridable: false as const,
  };
  const result = evaluateGuardrail(guardrail, 0.5);
  assert.deepEqual(result, { allowed: false, reason: "Eval threshold 0.5 below minimum 0.8" });
});

test("isOperationAllowedByRole returns true for platform_team with all operations", () => {
  const operations = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
    "modify_global_guardrails",
    "cross_domain_strategy",
  ] as const;
  for (const op of operations) {
    const result = isOperationAllowedByRole(op, "platform_team");
    assert.equal(result, true, `platform_team should allow ${op}`);
  }
});

test("isOperationAllowedByRole returns false for team_lead with any operation", () => {
  const operations = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
    "modify_global_guardrails",
    "cross_domain_strategy",
  ] as const;
  for (const op of operations) {
    const result = isOperationAllowedByRole(op, "team_lead");
    assert.equal(result, false, `team_lead should not allow ${op}`);
  }
});

test("isOperationAllowedByRole returns correct results for division_admin", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "division_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "division_admin"), false);
});

test("isOperationAllowedByRole returns correct results for department_admin", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "department_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "department_admin"), false);
});
