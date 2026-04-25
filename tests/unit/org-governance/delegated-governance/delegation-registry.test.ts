import test from "node:test";
import assert from "node:assert/strict";

import {
  GovernancePermissionSchema,
  GuardrailTypeSchema,
  GuardrailSchema,
  GovernanceDelegationSchema,
  listActiveGovernanceDelegations,
  type GovernanceDelegation,
} from "../../../../src/org-governance/delegated-governance/delegation-registry/index.js";

test("GovernancePermissionSchema accepts valid permissions", () => {
  const result = GovernancePermissionSchema.safeParse("manage_domains");
  assert.equal(result.success, true);
});

test("GovernancePermissionSchema rejects invalid permissions", () => {
  const result = GovernancePermissionSchema.safeParse("invalid_permission");
  assert.equal(result.success, false);
});

test("GuardrailTypeSchema accepts valid types", () => {
  const result = GuardrailTypeSchema.safeParse("max_risk_level");
  assert.equal(result.success, true);
});

test("GuardrailTypeSchema rejects invalid types", () => {
  const result = GuardrailTypeSchema.safeParse("invalid_type");
  assert.equal(result.success, false);
});

test("GuardrailSchema accepts valid guardrail", () => {
  const result = GuardrailSchema.safeParse({
    guardrailId: "guard_1",
    type: "max_budget",
    value: 1000,
  });
  assert.equal(result.success, true);
});

test("GuardrailSchema requires guardrailId", () => {
  const result = GuardrailSchema.safeParse({
    type: "max_budget",
    value: 1000,
  });
  assert.equal(result.success, false);
});

test("GovernanceDelegationSchema accepts valid delegation", () => {
  const result = GovernanceDelegationSchema.safeParse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: ["manage_domains"],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("GovernanceDelegationSchema requires delegationId", () => {
  const result = GovernanceDelegationSchema.safeParse({
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("GovernanceDelegationSchema defaults orgNodeIds and domainIds to empty arrays", () => {
  const result = GovernanceDelegationSchema.parse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.deepEqual(result.orgNodeIds, []);
  assert.deepEqual(result.domainIds, []);
});

test("listActiveGovernanceDelegations returns only active delegations", () => {
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

  const active = listActiveGovernanceDelegations(delegations, "2026-01-01T00:00:00.000Z");
  assert.equal(active.length, 1);
  assert.equal(active[0]!.delegationId, "del_active");
});

test("listActiveGovernanceDelegations filters expired delegations", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_current",
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
      permissions: ["manage_packs"],
      guardrails: [],
      expiresAt: "2020-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const now = "2026-01-01T00:00:00.000Z";
  const active = listActiveGovernanceDelegations(delegations, now);
  assert.equal(active.length, 1);
  assert.equal(active[0]!.delegationId, "del_current");
});

test("listActiveGovernanceDelegations returns empty array when all delegations are inactive", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "del_revoked",
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
  ];

  const active = listActiveGovernanceDelegations(delegations, "2026-01-01T00:00:00.000Z");
  assert.equal(active.length, 0);
});

test("listActiveGovernanceDelegations handles empty input array", () => {
  const active = listActiveGovernanceDelegations([], "2026-01-01T00:00:00.000Z");
  assert.equal(active.length, 0);
});

test("GovernanceDelegationSchema accepts all valid status values", () => {
  const statuses = ["active", "revoked", "expired"];
  for (const status of statuses) {
    const result = GovernanceDelegationSchema.safeParse({
      delegationId: "del_1",
      grantorId: "grantor_1",
      granteeId: "grantee_1",
      permissions: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
      status,
    });
    assert.equal(result.success, true, `Expected ${status} to be valid`);
  }
});

test("GuardrailSchema defaults setBy to platform_team", () => {
  const result = GuardrailSchema.parse({
    guardrailId: "guard_1",
    type: "max_risk_level",
    value: "high",
  });
  assert.equal(result.setBy, "platform_team");
  assert.equal(result.overridable, false);
});

test("GovernanceDelegationSchema accepts guardrails array", () => {
  const result = GovernanceDelegationSchema.safeParse({
    delegationId: "del_1",
    grantorId: "grantor_1",
    granteeId: "grantee_1",
    permissions: ["manage_domains"],
    guardrails: [
      {
        guardrailId: "guard_1",
        type: "max_budget",
        value: 1000,
      },
    ],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(result.success, true);
});
