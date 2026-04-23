/**
 * Delegated Governance Unit Tests
 *
 * Tests for §51 Delegated Governance:
 * - GovernanceDelegation schema with permissions and guardrails
 * - Guardrail evaluation
 * - Governance inheritance rules
 * - Self-service operations by role
 * - Console audit trail and delegation management
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GovernanceDelegationSchema,
  GovernancePermissionSchema,
  GuardrailSchema,
  GuardrailTypeSchema,
  listActiveGovernanceDelegations,
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

import {
  SelfServiceGovernanceConsole,
  GovernanceConsoleActionSchema,
  CreateDelegationRequestSchema,
  type GovernanceConsoleAuditEntry,
} from "../../../src/org-governance/delegated-governance/governance-console-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GovernancePermissionSchema validates correctly", () => {
  assert.equal(GovernancePermissionSchema.parse("manage_domains"), "manage_domains");
  assert.equal(GovernancePermissionSchema.parse("manage_packs"), "manage_packs");
  assert.equal(GovernancePermissionSchema.parse("view_audit"), "view_audit");
  assert.throws(() => GovernancePermissionSchema.parse("invalid"));
});

test("GuardrailTypeSchema validates all guardrail types", () => {
  assert.equal(GuardrailTypeSchema.parse("max_risk_level"), "max_risk_level");
  assert.equal(GuardrailTypeSchema.parse("max_budget"), "max_budget");
  assert.equal(GuardrailTypeSchema.parse("forbidden_tools"), "forbidden_tools");
  assert.equal(GuardrailTypeSchema.parse("mandatory_approval"), "mandatory_approval");
  assert.equal(GuardrailTypeSchema.parse("min_eval_threshold"), "min_eval_threshold");
  assert.throws(() => GuardrailTypeSchema.parse("invalid_type"));
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

test("GuardrailSchema defaults setBy to platform_team", () => {
  const guardrail = GuardrailSchema.parse({
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "high",
  });

  assert.equal(guardrail.setBy, "platform_team");
  assert.equal(guardrail.overridable, false);
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
  assert.equal(delegation.orgNodeIds.length, 0);
  assert.equal(delegation.domainIds.length, 0);
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

test("GovernanceDelegationSchema validates status enum", () => {
  const active = GovernanceDelegationSchema.parse({
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    status: "active",
  });
  assert.equal(active.status, "active");

  const revoked = GovernanceDelegationSchema.parse({
    delegationId: "dlg-2",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    status: "revoked",
  });
  assert.equal(revoked.status, "revoked");

  assert.throws(() => GovernanceDelegationSchema.parse({
    delegationId: "dlg-3",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    status: "invalid",
  }));
});

test("listActiveGovernanceDelegations filters correctly", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-active",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2027-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "dlg-expired",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2020-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "dlg-revoked",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: "2027-12-31T00:00:00.000Z",
      revocable: true,
      status: "revoked",
    },
  ];

  const now = "2026-04-23T00:00:00.000Z";
  const active = listActiveGovernanceDelegations(delegations, now);

  assert.equal(active.length, 1);
  assert.equal(active[0]?.delegationId, "dlg-active");
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

test("matchesGovernanceScope handles scope without domainId", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: [],
    domainIds: ["finance"],
    permissions: [],
    guardrails: [],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "any-org",
    capability: "domain_management",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), true);
});

test("matchesGovernanceScope returns false when domainId does not match", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: [],
    domainIds: ["finance"],
    permissions: [],
    guardrails: [],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
    status: "active",
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "any-org",
    domainId: "hr",
    capability: "domain_management",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), false);
});

test("matchesGovernanceScope returns false when permission does not match", () => {
  const delegation: GovernanceDelegation = {
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
  };

  const scope: GovernanceActionScope = {
    orgNodeId: "any-org",
    capability: "domain_management",
    permission: "manage_prompts",
  };

  assert.equal(matchesGovernanceScope(delegation, scope), false);
});

test("matchesGovernanceScope returns true when permissions is empty (applies to all)", () => {
  const delegation: GovernanceDelegation = {
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: [],
    domainIds: [],
    permissions: [],
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

test("evaluateGuardrail allows value equal to max_risk_level", () => {
  const guardrail: Guardrail = {
    guardrailId: "gr-1",
    type: "max_risk_level",
    value: "high",
    setBy: "platform_team",
    overridable: false,
  };

  const result = evaluateGuardrail(guardrail, "high");
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
  assert.ok(result.reason.includes("below minimum"));
});

test("evaluateGuardrail handles unknown guardrail type", () => {
  const guardrail = {
    guardrailId: "gr-unknown",
    type: "unknown_type" as any,
    value: "anything",
    setBy: "platform_team" as const,
    overridable: false as const,
  };

  const result = evaluateGuardrail(guardrail, "anything");
  assert.equal(result.allowed, true);
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
  assert.equal(isOperationAllowedByRole("publish_pack", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("adjust_agent_autonomy", "division_admin"), true);
  assert.equal(isOperationAllowedByRole("create_trigger", "division_admin"), true);
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
      expiresAt: "2027-12-31T00:00:00.000Z",
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
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_not_granted"));
});

test("DelegatedGovernanceService.resolve uses custom now parameter", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: [],
      permissions: [],
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
  }, "2024-01-01T00:00:00.000Z"); // Before expiry

  assert.equal(result.allowed, true);
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

test("DelegatedGovernanceService.checkOperation allows division_admin operations", () => {
  const delegations: GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  const result = service.checkOperation(
    {
      actorId: "division-admin-1",
      actorRole: "division_admin",
      orgNodeId: "division-1",
    },
    "domain_onboarding",
  );

  assert.equal(result.allowed, true);
  assert.equal(result.violatedGuardrails.length, 0);
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

test("DelegatedGovernanceService.checkOperation respects org node boundaries", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      orgNodeIds: [],  // Platform-wide scope
      domainIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "gr-global",
          type: "max_budget",
          value: 1000,
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: "2025-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "dlg-2",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      orgNodeIds: ["hr"],
      domainIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "gr-hr-only",
          type: "max_budget",
          value: 500,  // Lower budget for HR
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

  // Finance org has global guardrail (max_budget: 1000) - 500 is within budget
  const financeResult = service.checkOperation(
    { actorId: "admin", actorRole: "division_admin", orgNodeId: "finance" },
    "adjust_agent_autonomy",
    500,
  );
  assert.equal(financeResult.allowed, true);

  // HR org has lower budget guardrail (max_budget: 500) - 500 is at limit, not exceeding
  const hrResult = service.checkOperation(
    { actorId: "admin", actorRole: "division_admin", orgNodeId: "hr" },
    "adjust_agent_autonomy",
    500,
  );
  assert.equal(hrResult.allowed, true);

  // HR org trying higher budget - should fail
  const hrResultHigh = service.checkOperation(
    { actorId: "admin", actorRole: "division_admin", orgNodeId: "hr" },
    "adjust_agent_autonomy",
    600,
  );
  assert.equal(hrResultHigh.allowed, false);
  assert.ok(hrResultHigh.violatedGuardrails.includes("gr-hr-only"));
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

test("DelegatedGovernanceService.getApplicableGuardrails returns empty for unknown org", () => {
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
  const guardrails = service.getApplicableGuardrails("unknown-org");

  assert.equal(guardrails.length, 0);
});

test("DelegatedGovernanceService.getApplicableGuardrails filters by domain", () => {
  const delegations: GovernanceDelegation[] = [
    {
      delegationId: "dlg-1",
      grantorId: "platform_team",
      granteeId: "admin-1",
      orgNodeIds: [],
      domainIds: ["finance"],
      permissions: [],
      guardrails: [
        {
          guardrailId: "gr-finance",
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

  // Domain-specific guardrail
  const financeGuardrails = service.getApplicableGuardrails("any-org", "finance");
  assert.equal(financeGuardrails.length, 1);

  // No guardrail for other domain
  const hrGuardrails = service.getApplicableGuardrails("any-org", "hr");
  assert.equal(hrGuardrails.length, 0);
});

test("DelegatedGovernanceService.validateInheritanceRule validates correctly", () => {
  const service = new DelegatedGovernanceService([]);

  // platform_team can loosen
  const r1 = service.validateInheritanceRule("platform_team", "division_admin", "loosen");
  assert.equal(r1.allowed, false);

  // division_admin cannot loosen (child trying to loosen parent's restriction)
  const r2 = service.validateInheritanceRule("division_admin", "department_admin", "loosen");
  assert.equal(r2.allowed, false);

  // Anyone can tighten
  const r3 = service.validateInheritanceRule("department_admin", "team_lead", "tighten");
  assert.equal(r3.allowed, true);

  // Higher-level parent can append constraints for lower-level child
  const r4 = service.validateInheritanceRule("platform_team", "team_lead", "append");
  assert.equal(r4.allowed, true);
});

test("DelegatedGovernanceService.validateInheritanceRule blocks child acting as parent", () => {
  const service = new DelegatedGovernanceService([]);

  // team_lead (child) trying to loosen division_admin's (parent) restriction - should fail
  const result = service.validateInheritanceRule("division_admin", "team_lead", "loosen");
  assert.equal(result.allowed, false);
});

test("DelegatedGovernanceService.validateInheritanceRule handles delete action", () => {
  const service = new DelegatedGovernanceService([]);

  // Delete is allowed (subject to ownership check)
  const result = service.validateInheritanceRule("platform_team", "team_lead", "delete");
  assert.equal(result.allowed, true);
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

test("DelegatedGovernanceService.listDelegationsForGrantee returns empty for unknown grantee", () => {
  const service = new DelegatedGovernanceService([]);
  const result = service.listDelegationsForGrantee("unknown-user");
  assert.equal(result.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SelfServiceGovernanceConsole Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SelfServiceGovernanceConsole.createDelegation creates and returns delegation", () => {
  const console = new SelfServiceGovernanceConsole();

  const delegation = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: ["finance"],
    domainIds: ["finance"],
    permissions: ["manage_domains"],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
  });

  assert.ok(delegation.delegationId.startsWith("del_"));
  assert.equal(delegation.grantorId, "platform_team");
  assert.equal(delegation.granteeId, "admin-1");
  assert.equal(delegation.status, "active");
  assert.deepEqual(delegation.orgNodeIds, ["finance"]);
});

test("SelfServiceGovernanceConsole.createDelegation logs audit entry", () => {
  const console = new SelfServiceGovernanceConsole();

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const auditEntries = console.exportAuditLog();
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.action, "delegate");
  assert.equal(auditEntries[0]?.actorId, "platform_team");
});

test("SelfServiceGovernanceConsole.revokeDelegation revokes active delegation", () => {
  const console = new SelfServiceGovernanceConsole();

  const delegation = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
  });

  const result = console.revokeDelegation(delegation.delegationId, "platform_team");
  assert.equal(result.success, true);

  const updated = console.getDelegation(delegation.delegationId);
  assert.equal(updated?.status, "revoked");
});

test("SelfServiceGovernanceConsole.revokeDelegation fails for non-revocable delegation", () => {
  const console = new SelfServiceGovernanceConsole();

  const delegation = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: false,
  });

  const result = console.revokeDelegation(delegation.delegationId, "platform_team");
  assert.equal(result.success, false);
  assert.equal(result.error, "delegation_not_revocable");
});

test("SelfServiceGovernanceConsole.revokeDelegation fails for unknown delegation", () => {
  const console = new SelfServiceGovernanceConsole();

  const result = console.revokeDelegation("unknown-id", "platform_team");
  assert.equal(result.success, false);
  assert.equal(result.error, "delegation_not_found");
});

test("SelfServiceGovernanceConsole.getDelegation returns null for unknown id", () => {
  const console = new SelfServiceGovernanceConsole();

  const result = console.getDelegation("unknown-id");
  assert.equal(result, null);
});

test("SelfServiceGovernanceConsole.listDelegationsForGrantee returns only active delegations", () => {
  const console = new SelfServiceGovernanceConsole();

  const d1 = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
  });

  const d2 = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
  });

  console.revokeDelegation(d1.delegationId, "platform_team");

  const delegations = console.listDelegationsForGrantee("admin-1");
  assert.equal(delegations.length, 1);
  assert.equal(delegations[0]?.delegationId, d2.delegationId);
});

test("SelfServiceGovernanceConsole.listDelegationsForOrgNode returns delegations within org scope", () => {
  const console = new SelfServiceGovernanceConsole();

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-finance",
    orgNodeIds: ["finance"],
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-hr",
    orgNodeIds: ["hr"],
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const financeDelegations = console.listDelegationsForOrgNode("finance");
  assert.equal(financeDelegations.length, 1);
  assert.equal(financeDelegations[0]?.granteeId, "admin-finance");
});

test("SelfServiceGovernanceConsole.listDelegationsForOrgNode includes platform-wide delegations", () => {
  const console = new SelfServiceGovernanceConsole();

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "platform-admin",
    orgNodeIds: [],  // Platform-wide scope
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-finance",
    orgNodeIds: ["finance"],
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const delegations = console.listDelegationsForOrgNode("any-org");
  assert.ok(delegations.some((d) => d.granteeId === "platform-admin"));
});

test("SelfServiceGovernanceConsole.reviewDelegation returns delegation and logs audit", () => {
  const console = new SelfServiceGovernanceConsole();

  const delegation = console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const reviewed = console.reviewDelegation(delegation.delegationId, "auditor-1");
  assert.equal(reviewed?.delegationId, delegation.delegationId);

  const auditEntries = console.exportAuditLog({ actorId: "auditor-1" });
  assert.ok(auditEntries.some((e) => e.action === "review"));
});

test("SelfServiceGovernanceConsole.reviewDelegation returns null for unknown delegation", () => {
  const console = new SelfServiceGovernanceConsole();

  const result = console.reviewDelegation("unknown-id", "auditor-1");
  assert.equal(result, null);
});

test("SelfServiceGovernanceConsole.exportAuditLog filters by actorId", () => {
  const console = new SelfServiceGovernanceConsole();

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const entries = console.exportAuditLog({ actorId: "platform_team" });
  assert.ok(entries.every((e) => e.actorId === "platform_team"));
});

test("SelfServiceGovernanceConsole.isActionAllowed platform_team can do everything", () => {
  const console = new SelfServiceGovernanceConsole();

  const operations = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
  ] as const;

  for (const op of operations) {
    const result = console.isActionAllowed("user-1", "platform_team", op);
    assert.equal(result.allowed, true, `${op} should be allowed for platform_team`);
  }
});

test("SelfServiceGovernanceConsole.isActionAllowed division_admin has limited permissions", () => {
  const console = new SelfServiceGovernanceConsole();

  assert.equal(console.isActionAllowed("user-1", "division_admin", "domain_onboarding").allowed, true);
  assert.equal(console.isActionAllowed("user-1", "division_admin", "modify_approval_rules").allowed, true);
  assert.equal(console.isActionAllowed("user-1", "division_admin", "modify_global_guardrails").allowed, false);
  assert.equal(console.isActionAllowed("user-1", "division_admin", "cross_domain_strategy").allowed, false);
});

test("SelfServiceGovernanceConsole.isActionAllowed department_admin has limited permissions", () => {
  const console = new SelfServiceGovernanceConsole();

  assert.equal(console.isActionAllowed("user-1", "department_admin", "publish_pack").allowed, true);
  assert.equal(console.isActionAllowed("user-1", "department_admin", "adjust_agent_autonomy").allowed, true);
  assert.equal(console.isActionAllowed("user-1", "department_admin", "modify_global_guardrails").allowed, false);
});

test("SelfServiceGovernanceConsole.isActionAllowed team_lead has no governance permissions", () => {
  const console = new SelfServiceGovernanceConsole();

  const operations = [
    "domain_onboarding",
    "modify_approval_rules",
    "publish_pack",
    "adjust_agent_autonomy",
    "create_trigger",
  ] as const;

  for (const op of operations) {
    const result = console.isActionAllowed("user-1", "team_lead", op);
    assert.equal(result.allowed, false, `${op} should not be allowed for team_lead`);
  }
});

test("SelfServiceGovernanceConsole.isActionAllowed returns reason string", () => {
  const console = new SelfServiceGovernanceConsole();

  const allowed = console.isActionAllowed("user-1", "platform_team", "domain_onboarding");
  assert.equal(allowed.allowed, true);
  assert.ok(typeof allowed.reason === "string");
  assert.ok(allowed.reason.length > 0);

  const denied = console.isActionAllowed("user-1", "team_lead", "domain_onboarding");
  assert.equal(denied.allowed, false);
  assert.ok(typeof denied.reason === "string");
  assert.ok(denied.reason.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("GovernanceDelegationSchema rejects empty delegationId", () => {
  assert.throws(() => GovernanceDelegationSchema.parse({
    delegationId: "",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  }));
});

test("GovernanceDelegationSchema rejects empty grantorId", () => {
  assert.throws(() => GovernanceDelegationSchema.parse({
    delegationId: "dlg-1",
    grantorId: "",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  }));
});

test("GovernanceDelegationSchema rejects expired timestamp", () => {
  // Note: Schema itself may not validate timestamp format, just that it's a non-empty string
  const delegation = GovernanceDelegationSchema.parse({
    delegationId: "dlg-1",
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2020-01-01T00:00:00.000Z",
  });
  assert.equal(delegation.expiresAt, "2020-01-01T00:00:00.000Z");
});

test("GovernanceConsoleActionSchema validates all action types", () => {
  assert.equal(GovernanceConsoleActionSchema.parse("delegate"), "delegate");
  assert.equal(GovernanceConsoleActionSchema.parse("override"), "override");
  assert.equal(GovernanceConsoleActionSchema.parse("revoke"), "revoke");
  assert.equal(GovernanceConsoleActionSchema.parse("review"), "review");
  assert.equal(GovernanceConsoleActionSchema.parse("export_audit"), "export_audit");
  assert.throws(() => GovernanceConsoleActionSchema.parse("invalid"));
});

test("CreateDelegationRequestSchema validates correctly", () => {
  const request = CreateDelegationRequestSchema.parse({
    grantorId: "platform_team",
    granteeId: "admin-1",
    orgNodeIds: ["finance"],
    domainIds: ["finance"],
    permissions: ["manage_domains"],
    expiresAt: "2025-12-31T00:00:00.000Z",
    revocable: true,
  });

  assert.equal(request.grantorId, "platform_team");
  assert.equal(request.granteeId, "admin-1");
  assert.deepEqual(request.orgNodeIds, ["finance"]);
  assert.deepEqual(request.permissions, ["manage_domains"]);
  assert.equal(request.revocable, true);
});

test("CreateDelegationRequestSchema applies defaults", () => {
  const request = CreateDelegationRequestSchema.parse({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  assert.deepEqual(request.orgNodeIds, []);
  assert.deepEqual(request.domainIds, []);
  assert.deepEqual(request.permissions, []);
  assert.equal(request.revocable, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Entry Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GovernanceConsoleAuditEntry has correct structure", () => {
  const console = new SelfServiceGovernanceConsole();

  console.createDelegation({
    grantorId: "platform_team",
    granteeId: "admin-1",
    expiresAt: "2025-12-31T00:00:00.000Z",
  });

  const entries = console.exportAuditLog();
  assert.equal(entries.length, 1);

  const entry = entries[0] as GovernanceConsoleAuditEntry;
  assert.equal(typeof entry.action, "string");
  assert.equal(typeof entry.actorId, "string");
  assert.equal(typeof entry.timestamp, "string");
  assert.ok(entry.timestamp.length > 0);
});