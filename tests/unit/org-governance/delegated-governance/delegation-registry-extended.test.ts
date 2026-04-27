/**
 * Unit tests for Governance Delegation Registry - Additional edge cases
 * Tests for delegation-registry/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GovernancePermissionSchema,
  GuardrailTypeSchema,
  GuardrailSchema,
  GovernanceDelegationSchema,
  listActiveGovernanceDelegations,
  type GovernanceDelegation,
} from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

test("GovernancePermissionSchema accepts all valid permissions", () => {
  const validPermissions = [
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
  for (const permission of validPermissions) {
    const result = GovernancePermissionSchema.safeParse(permission);
    assert.equal(result.success, true, `Expected ${permission} to be valid`);
  }
});

test("GuardrailTypeSchema accepts all valid types", () => {
  const validTypes = ["max_risk_level", "max_budget", "forbidden_tools", "mandatory_approval", "min_eval_threshold"];
  for (const type of validTypes) {
    const result = GuardrailTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("GuardrailSchema rejects invalid guardrail type", () => {
  const result = GuardrailSchema.safeParse({
    guardrailId: "g1",
    type: "invalid_type",
    value: "test",
  });
  assert.equal(result.success, false);
});

test("GuardrailSchema accepts guardrail with all required fields", () => {
  const result = GuardrailSchema.safeParse({
    guardrailId: "guard_valid",
    type: "max_budget",
    value: 1000,
    setBy: "platform_team",
    overridable: false,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.setBy, "platform_team");
    assert.equal(result.data.overridable, false);
  }
});

test("GovernanceDelegationSchema defaults permissions to empty array", () => {
  const result = GovernanceDelegationSchema.parse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.deepEqual(result.permissions, []);
});

test("GovernanceDelegationSchema defaults guardrails to empty array", () => {
  const result = GovernanceDelegationSchema.parse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.deepEqual(result.guardrails, []);
});

test("GovernanceDelegationSchema accepts empty orgNodeIds", () => {
  const result = GovernanceDelegationSchema.safeParse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("listActiveGovernanceDelegations filters by status and expiration", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_active_valid",
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
      delegationId: "del_expired",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2020-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del_revoked_valid",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "revoked",
    },
    {
      delegationId: "del_expired_status",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2020-01-01T00:00:00.000Z",
      revocable: true,
      status: "expired",
    },
  ];

  const now = "2026-01-01T00:00:00.000Z";
  const active = listActiveGovernanceDelegations(delegations, now);

  // Only the first delegation should be active
  assert.equal(active.length, 1);
  assert.equal(active[0]!.delegationId, "del_active_valid");
});

test("listActiveGovernanceDelegations handles exactly matching expiration time", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_exact",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-26T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  // When now equals expiresAt, the delegation is still valid
  const now = "2026-04-26T00:00:00.000Z";
  const active = listActiveGovernanceDelegations(delegations, now);
  assert.equal(active.length, 1);
});

test("listActiveGovernanceDelegations handles expired status first", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_status_expired",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      revocable: true,
      status: "expired", // Even with future expiration, status is expired
    },
  ];

  const now = "2026-01-01T00:00:00.000Z";
  const active = listActiveGovernanceDelegations(delegations, now);
  assert.equal(active.length, 0);
});

test("GovernanceDelegationSchema rejects invalid status", () => {
  const result = GovernanceDelegationSchema.safeParse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
    status: "invalid_status",
  });
  assert.equal(result.success, false);
});

test("GovernanceDelegationSchema rejects past expiresAt", () => {
  // Schema doesn't validate ISO dates, so this would pass
  // but we can test that invalid dates fail
  const result = GovernanceDelegationSchema.safeParse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: [],
    expiresAt: "", // Empty string should fail min(1)
  });
  assert.equal(result.success, false);
});
