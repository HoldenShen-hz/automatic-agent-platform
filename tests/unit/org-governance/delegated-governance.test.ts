/**
 * Delegated Governance Unit Tests
 *
 * Tests for §51 Delegated Governance:
 * - GovernanceDelegation schema with permissions and guardrails
 * - Guardrail evaluation
 * - Governance inheritance rules
 * - Self-service operations by role
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GovernanceDelegationSchema,
  GovernancePermissionSchema,
  GuardrailSchema,
  type GovernanceDelegation,
  type GovernancePermission,
  type Guardrail,
} from "../../../src/org-governance/delegated-governance/delegation-registry/index.js";

import {
  GovernanceActionScope,
  GovernanceOperationContext,
  matchesGovernanceScope,
  evaluateGuardrail,
  isOperationAllowedByRole,
  type GovernanceOperationType,
} from "../../../src/org-governance/delegated-governance/scope-manager/index.js";

import {
  DelegatedGovernanceService,
} from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GovernancePermissionSchema validates correctly", () => {
  assert.equal(GovernancePermissionSchema.parse("manage_domains"), "manage_domains");
  assert.equal(GovernancePermissionSchema.parse("manage_packs"), "manage_packs");
  assert.equal(GovernancePermissionSchema.parse("view_audit"), "view_audit");
  assert.throws(() => GovernancePermissionSchema.parse("invalid"));
});

test("GuardrailSchema validates correctly", () => {
  const guardrail = GuardrailSchema.parse({
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: false,
  });

  assert.equal(guardrail.guardrailId, "gr-1");
  assert.equal(guardrail.type, "max_risk_level");
  assert.equal(guardrail.value, "high");
  assert.equal(guardrail.setBy, "platform_team");
  assert.equal(guardrail.overridable, false);
});

test("GuardrailSchema rejects overridable=true", () => {
  assert.throws(() => GuardrailSchema.parse({
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: true,
  }));
});

test("GovernanceDelegationSchema accepts minimal delegation", () => {
  const delegation = GovernanceDelegationSchema.parse({
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  assert.equal(delegation.delegationId, "dlg-1");
  assert.equal(delegation.permissions.length, 0);
  assert.equal(delegation.guardrails.length, 0);
});

test("GovernanceDelegationSchema accepts full delegation", () => {
  const delegation = GovernanceDelegationSchema.parse({
    delegationId: "dlg-2",
    grantorId: "platform_team",
    granteeId: "division-admin-1",
    orgNodeIds: ["finance-division"],
    domainIds: ["finance"],
    permissions: ["manage_domains", "manage_packs", "view_audit"],
    guardrails: [
      {
        guardrailId: "gr-risk",
        type: "max_risk_level",
        value: "high",
        setBy: "platform_team",
        overridable: false,
      },
    ],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  });

  assert.equal(delegation.permissions.length, 3);
  assert.equal(delegation.guardrails.length, 1);
  assert.equal(delegation.guardrails[0]?.type, "max_risk_level");
});

// ─────────────────────────────────────────────────────────────────────────────
// Scope Matching Tests
// ─────────────────────────────────────────────────────────────────────────────

test("matchesGovernanceScope returns true for matching scope", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: ["finance"],
    domainIds: ["finance"],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "finance",
    domainId: "finance",
    capability: "domain_management",
    permission: "manage_domains",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), true);
});

test("matchesGovernanceScope returns false for non-matching org", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: ["hr"],
    domainIds: [],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "finance",
    capability: "domain_management",
    permission: "manage_domains",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), false);
});

test("matchesGovernanceScope returns true for wildcard org", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "super-admin",
    orgNodeIds: [],
    domainIds: [],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "any-org",
    capability: "domain_management",
    permission: "manage_domains",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Evaluation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("evaluateGuardrail allows value within max_risk_level", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "low");
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks value exceeding max_risk_level", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "medium",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "high");
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("exceeds max"));
});

test("evaluateGuardrail allows value within max_budget", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-2",
    type: "max_budget",
    value: 10000,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 5000);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks value exceeding max_budget", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-2",
    type: "max_budget",
    value: 10000,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 15000);
  assert.equal(result.allowed, false);
});

test("evaluateGuardrail blocks forbidden tool", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-3",
    type: "forbidden_tools",
    value: ["delete_all", "drop_database"],
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "delete_all");
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("forbidden"));
});

test("evaluateGuardrail allows non-forbidden tool", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-3",
    type: "forbidden_tools",
    value: ["delete_all", "drop_database"],
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "read_data");
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail always allows mandatory_approval (just returns info)", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-4",
    type: "mandatory_approval",
    value: true,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, true);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail allows value above min_eval_threshold", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-5",
    type: "min_eval_threshold",
    value: 0.8,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0.9);
  assert.equal(result.allowed, true);
});

test("evaluateGuardrail blocks value below min_eval_threshold", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-5",
    type: "min_eval_threshold",
    value: 0.8,
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, 0.5);
  assert.equal(result.allowed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-based Operation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("platform_team can perform all operations", () => {
  const operations: GovernanceOperationType[] = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
    "modify_global_guardrails",
    "cross_domain_strategy",
  ];

  for (const op of operations) {
    assert.equal(isOperationAllowedByRole(op, "platform_team"), true, `${op} should be allowed for platform_team`);
  }
});

test("division_admin can perform subset of operations", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_approval_rules", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "division_admin"), false);
  assert.equal(isOperationAllowedByRole("cross_domain_strategy", "division_admin"), false);
});

test("department_admin can perform same operations as division_admin", () => {
  assert.equal(isOperationAllowedByRole("domain_onboarding", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("publish_pack", "department_admin"), true);
  assert.equal(isOperationAllowedByRole("modify_global_guardrails", "department_admin"), false);
});

test("team_lead cannot perform any governance operations", () => {
  const operations: GovernanceOperationType[] = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
    "modify_global_guardrails",
    "cross_domain_strategy",
  ];

  for (const op of operations) {
    assert.equal(isOperationAllowedByRole(op, "team_lead"), false, `${op} should not be allowed for team_lead`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DelegatedGovernanceService.resolve returns granted when scope matches", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.resolve("admin-1", {
    orgNodeId: "any-org",
    capability: "domain_management",
    permission: "manage_domains",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "dlg-1");
});

test("DelegatedGovernanceService.resolve returns not granted when no matching delegation", () => {
  const delegations: GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  const result = service.resolve("unknown-user", {
    orgNodeId: "any-org",
    capability: "domain_management",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.delegationId, null);
});

test("DelegatedGovernanceService.checkOperation blocks unauthorized role", () => {
  const delegations: GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  const result = service.checkOperation(
    {
      actorId: "team-lead-1",
      actorRole: "team_lead",
      orgNodeId: "team-1",
    },
    "modify_global_guardrails",
  );

  assert.equal(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("role_guardrail"));
});

test("DelegatedGovernanceService.checkOperation enforces guardrails", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_agents"],
      guardrails: [
        {
          guardrailId: "gr-risk",
          type: "max_risk_level",
          value: "medium",
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const result = service.checkOperation(
    {
      actorId: "division-admin-1",
      actorRole: "division_admin",
      orgNodeId: "division-1",
    },
    "adjust_agent_autonomy",
    "high", // Exceeds max_risk_level guardrail of "medium"
  );

  assert.equal(result.allowed, false);
  assert.ok(result.violatedGuardrails.includes("gr-risk"));
});

test("DelegatedGovernanceService.getApplicableGuardrails returns guardrails for org", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: ["finance"],
      domainIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "gr-risk",
          type: "max_risk_level",
          value: "high",
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const guardrails = service.getApplicableGuardrails("finance");

  assert.equal(guardrails.length, 1);
  assert.equal(guardrails[0]?.guardrailId, "gr-risk");
});

test("DelegatedGovernanceService.validateInheritanceRule validates correctly", () => {
  const service = new DelegatedGovernanceService([]);

  // platform_team can loosen
  const r1 = service.validateInheritanceRule("platform_team", "division_admin", "loosen");
  assert.equal(r1.allowed, true);

  // division_admin cannot loosen (child trying to loosen parent's restriction)
  const r2 = service.validateInheritanceRule("division_admin", "department_admin", "loosen");
  assert.equal(r2.allowed, false);

  // Anyone can tighten
  const r3 = service.validateInheritanceRule("department_admin", "team_lead", "tighten");
  assert.equal(r3.allowed, true);

  // Anyone can append
  const r4 = service.validateInheritanceRule("team_lead", "platform_team", "append");
  assert.equal(r4.allowed, true);
});

test("DelegatedGovernanceService.listDelegationsForGrantee returns active delegations", () => {
  const now = "2024-06-15T00:00:00.000Z";
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-active",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "dlg-revoked",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: ["manage_packs"],
      guardrails: [],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "revoked",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);
  const active = service.listDelegationsForGrantee("admin-1", now);

  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, "dlg-active");
});
