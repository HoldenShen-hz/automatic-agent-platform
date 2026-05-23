import assert from "node:assert/strict";
import test from "node:test";

import {
  GovernancePermissionSchema,
  GuardrailTypeSchema,
  GuardrailSchema,
  GovernanceDelegationSchema,
  listActiveGovernanceDelegations,
} from "../../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

test("GovernancePermissionSchema validates all permission values", () => {
  const permissions = [
    "manage_domains",
    "manage_packs",
    "manage_prompts",
    "manage_triggers",
    "manage_approvals",
    "manage_budgets",
    "manage_knowledge",
    "view_audit",
    "manage_agents",
    "manage_eval",
  ];
  for (const perm of permissions) {
    const result = GovernancePermissionSchema.parse(perm);
    assert.equal(result, perm);
  }
});

test("GovernancePermissionSchema rejects invalid permission", () => {
  assert.throws(() => {
    GovernancePermissionSchema.parse("invalid_permission");
  });
});

test("GuardrailTypeSchema validates all guardrail type values", () => {
  const types = ["max_risk_level", "max_budget", "forbidden_tools", "mandatory_approval", "min_eval_threshold"];
  for (const type of types) {
    const result = GuardrailTypeSchema.parse(type);
    assert.equal(result, type);
  }
});

test("GuardrailTypeSchema rejects invalid guardrail type", () => {
  assert.throws(() => {
    GuardrailTypeSchema.parse("invalid_type");
  });
});

test("GuardrailSchema validates correct guardrail", () => {
  const valid = {
    guardrailId: "gr_123",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: false,
  };
  const result = GuardrailSchema.parse(valid);
  assert.equal(result.guardrailId, "gr_123");
  assert.equal(result.type, "max_risk_level");
  assert.equal(result.value, "high");
  assert.equal(result.setBy, "platform_team");
  assert.equal(result.overridable, false);
});

test("GuardrailSchema applies defaults", () => {
  const minimal = {
    guardrailId: "gr_min",
    type: "max_budget",
    value: 1000,
  };
  const result = GuardrailSchema.parse(minimal);
  assert.equal(result.setBy, "platform_team");
  assert.equal(result.overridable, false);
});

test("GovernanceDelegationSchema validates correct delegation", () => {
  const valid = {
    delegationId: "del_123",
    grantorId: "grantor_456",
    granteeId: "grantee_789",
    orgNodeIds: ["node_1", "node_2"],
    domainIds: ["domain_a"],
    permissions: ["manage_domains", "view_audit"],
    guardrails: [],
    expiresAt: "2026-04-30T00:00:00.000Z",
    revocable: true,
    status: "active",
  };
  const result = GovernanceDelegationSchema.parse(valid);
  assert.equal(result.delegationId, "del_123");
  assert.deepEqual(result.permissions, ["manage_domains", "view_audit"]);
  assert.equal(result.status, "active");
});

test("GovernanceDelegationSchema applies defaults", () => {
  const minimal = {
    delegationId: "del_min",
    grantorId: "grantor_min",
    granteeId: "grantee_min",
    expiresAt: "2026-04-30T00:00:00.000Z",
  };
  const result = GovernanceDelegationSchema.parse(minimal);
  assert.deepEqual(result.orgNodeIds, []);
  assert.deepEqual(result.domainIds, []);
  assert.deepEqual(result.permissions, []);
  assert.deepEqual(result.guardrails, []);
  assert.equal(result.revocable, true);
  assert.equal(result.status, "active");
});

test("GovernanceDelegationSchema rejects invalid status", () => {
  assert.throws(() => {
    GovernanceDelegationSchema.parse({
      delegationId: "del_123",
      grantorId: "grantor_456",
      granteeId: "grantee_789",
      expiresAt: "2026-04-30T00:00:00.000Z",
      status: "invalid_status",
    });
  });
});

test("listActiveGovernanceDelegations returns only active and non-expired delegations", () => {
  const delegations = [
    {
      delegationId: "del_active",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-30T00:00:00.000Z",
      revocable: true,
      status: "active" as const,
    },
    {
      delegationId: "del_expired",
      grantorId: "grantor_2",
      granteeId: "grantee_2",
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-01T00:00:00.000Z",
      revocable: true,
      status: "active" as const,
    },
    {
      delegationId: "del_revoked",
      grantorId: "grantor_3",
      granteeId: "grantee_3",
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-30T00:00:00.000Z",
      revocable: true,
      status: "revoked" as const,
    },
  ];
  const now = "2026-04-14T12:00:00.000Z";
  const result = listActiveGovernanceDelegations(delegations, now);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.delegationId, "del_active");
});

test("listActiveGovernanceDelegations returns empty array when no delegations", () => {
  const result = listActiveGovernanceDelegations([], "2026-04-14T12:00:00.000Z");
  assert.deepEqual(result, []);
});
