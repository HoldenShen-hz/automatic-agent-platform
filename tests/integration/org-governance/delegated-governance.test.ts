import assert from "node:assert/strict";
import test from "node:test";

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation } from "../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import type { GovernanceActionScope, GovernanceOperationContext } from "../../../src/org-governance/delegated-governance/scope-manager/index.js";

// ============================================================================
// Delegated Governance Permission Intersection Tests (Issue 1977)
// ============================================================================

test("integration: DelegatedGovernanceService.resolve returns allowed for matching scope", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-1",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_domains", "manage_budgets"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const scope: GovernanceActionScope = {
    orgNodeId: "division-1",
    domainId: "domain-a",
    permission: "manage_domains",
  };

  const result = service.resolve("division-admin-1", scope, futureDate);

  assert.equal(result.allowed, true, "should be allowed for matching scope");
  assert.equal(result.delegationId, "del-1", "delegationId should match");
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_granted"), "should have granted reason code");
});

test("integration: DelegatedGovernanceService.resolve returns not allowed for non-matching scope", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-1",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Request for a different org node
  const scope: GovernanceActionScope = {
    orgNodeId: "division-2",
    permission: "manage_domains",
  };

  const result = service.resolve("division-admin-1", scope, futureDate);

  assert.equal(result.allowed, false, "should not be allowed for non-matching scope");
  assert.equal(result.delegationId, null, "delegationId should be null");
  assert.ok(result.reasonCodes.includes("delegated_governance.scope_not_granted"), "should have not granted reason code");
});

test("integration: DelegatedGovernanceService.resolve handles expired delegations", () => {
  const pastDate = "2020-01-01T00:00:00.000Z";
  const now = "2025-01-01T00:00:00.000Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-expired",
      grantorId: "platform_team",
      granteeId: "user-expired",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: pastDate, // Expired
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const scope: GovernanceActionScope = {
    orgNodeId: "division-1",
    permission: "manage_domains",
  };

  const result = service.resolve("user-expired", scope, now);

  assert.equal(result.allowed, false, "expired delegation should not be allowed");
});

test("integration: DelegatedGovernanceService.resolve handles revoked delegations", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-revoked",
      grantorId: "platform_team",
      granteeId: "user-revoked",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_domains"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "revoked",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const scope: GovernanceActionScope = {
    orgNodeId: "division-1",
    permission: "manage_domains",
  };

  const result = service.resolve("user-revoked", scope, futureDate);

  assert.equal(result.allowed, false, "revoked delegation should not be allowed");
});

test("integration: DelegatedGovernanceService.resolve checks permission specifically", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-limited",
      grantorId: "platform_team",
      granteeId: "user-limited",
      level: "view",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["view_audit"], // Only view_audit permission
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Request a different permission (manage_domains) - should not be allowed
  const scopeManage: GovernanceActionScope = {
    orgNodeId: "division-1",
    permission: "manage_domains",
  };

  const resultManage = service.resolve("user-limited", scopeManage, futureDate);
  assert.equal(resultManage.allowed, false, "should not allow permission not in delegation");

  // Request the granted permission - should be allowed
  const scopeView: GovernanceActionScope = {
    orgNodeId: "division-1",
    permission: "view_audit",
  };

  const resultView = service.resolve("user-limited", scopeView, futureDate);
  assert.equal(resultView.allowed, true, "should allow granted permission");
});

test("integration: DelegatedGovernanceService.resolve with empty orgNodeIds matches all", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-global",
      grantorId: "platform_team",
      granteeId: "global-admin",
      level: "super_admin",
      delegatable: false,
      orgNodeIds: [], // Empty = all org nodes
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_budgets"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Should match any org node
  const scope1: GovernanceActionScope = {
    orgNodeId: "division-1",
    permission: "manage_budgets",
  };
  const result1 = service.resolve("global-admin", scope1, futureDate);
  assert.equal(result1.allowed, true, "should match for division-1");

  const scope2: GovernanceActionScope = {
    orgNodeId: "department-xyz",
    permission: "manage_budgets",
  };
  const result2 = service.resolve("global-admin", scope2, futureDate);
  assert.equal(result2.allowed, true, "should match for department-xyz");
});

// ============================================================================
// Guardrail Evaluation Tests
// ============================================================================

test("integration: DelegatedGovernanceService.checkOperation evaluates role guardrails", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-team-lead",
      grantorId: "platform_team",
      granteeId: "team-lead-1",
      level: "operate",
      delegatable: false,
      orgNodeIds: ["team-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // team_lead role cannot perform domain_onboarding (only approve_task and create_trigger)
  const ctx: GovernanceOperationContext = {
    actorId: "team-lead-1",
    actorRole: "team_lead",
    orgNodeId: "team-1",
    domainId: "domain-1",
  };

  const result = service.checkOperation(ctx, "domain_onboarding", undefined);

  assert.equal(result.allowed, false, "team_lead should not be allowed domain_onboarding");
  assert.ok(result.violatedGuardrails.includes("role_guardrail"), "should have role_guardrail violation");
});

test("integration: DelegatedGovernanceService.checkOperation allows permitted role operations", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [];

  const service = new DelegatedGovernanceService(delegations);

  // team_lead can perform approve_task
  const ctx: GovernanceOperationContext = {
    actorId: "team-lead-1",
    actorRole: "team_lead",
    orgNodeId: "team-1",
    domainId: "domain-1",
  };

  const result = service.checkOperation(ctx, "approve_task", undefined);

  assert.equal(result.allowed, true, "team_lead should be allowed approve_task");
  assert.equal(result.violatedGuardrails.length, 0, "should have no violated guardrails");
});

test("integration: DelegatedGovernanceService.checkOperation evaluates risk level guardrail", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-platform",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "max-risk-low",
          type: "max_risk_level",
          value: "medium",
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const ctx: GovernanceOperationContext = {
    actorId: "division-admin-1",
    actorRole: "division_admin",
    orgNodeId: "division-1",
    domainId: "domain-1",
  };

  // Attempting high risk should be blocked
  const resultHigh = service.checkOperation(ctx, "approve_task", "high");
  assert.equal(resultHigh.allowed, false, "high risk should exceed medium guardrail");

  // Attempting medium risk should be allowed
  const resultMedium = service.checkOperation(ctx, "approve_task", "medium");
  assert.equal(resultMedium.allowed, true, "medium risk should be within medium guardrail");

  // Attempting low risk should be allowed
  const resultLow = service.checkOperation(ctx, "approve_task", "low");
  assert.equal(resultLow.allowed, true, "low risk should be within medium guardrail");
});

test("integration: DelegatedGovernanceService.checkOperation evaluates budget guardrail", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  // department_admin can perform approve_budget_increase (per §51.3 table)
  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-budget",
      grantorId: "platform_team",
      granteeId: "dept-admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["department-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "max-budget-50k",
          type: "max_budget",
          value: 50000,
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Use division_admin for the budget check since that role can do approve_budget_increase
  const ctx: GovernanceOperationContext = {
    actorId: "dept-admin-1",
    actorRole: "division_admin", // Changed to a role that CAN do budget increases
    orgNodeId: "department-1",
    domainId: "domain-1",
  };

  // Attempting 60000 budget should be blocked
  const resultHigh = service.checkOperation(ctx, "approve_budget_increase", 60000);
  assert.equal(resultHigh.allowed, false, "60000 budget should exceed 50000 guardrail");

  // Attempting 30000 budget should be allowed
  const resultLow = service.checkOperation(ctx, "approve_budget_increase", 30000);
  assert.equal(resultLow.allowed, true, "30000 budget should be within 50000 guardrail");
});

test("integration: DelegatedGovernanceService.checkOperation evaluates forbidden_tools guardrail", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-tools",
      grantorId: "platform_team",
      granteeId: "division-admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        {
          guardrailId: "no-shell",
          type: "forbidden_tools",
          value: ["shell_execute", "bash"],
          setBy: "platform_team",
          overridable: false,
        },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const ctx: GovernanceOperationContext = {
    actorId: "division-admin-1",
    actorRole: "division_admin",
    orgNodeId: "division-1",
    domainId: "domain-1",
  };

  // Attempting to use forbidden tool should be blocked
  const resultForbidden = service.checkOperation(ctx, "adjust_agent_autonomy", "shell_execute");
  assert.equal(resultForbidden.allowed, false, "forbidden tool should be blocked");
  assert.ok(resultForbidden.reasons.some((r) => r.includes("shell_execute")), "reason should mention the tool");

  // Attempting to use allowed tool should be allowed
  const resultAllowed = service.checkOperation(ctx, "adjust_agent_autonomy", "code_editor");
  assert.equal(resultAllowed.allowed, true, "allowed tool should be permitted");
});

// ============================================================================
// Inheritance Rule Validation Tests
// ============================================================================

test("integration: DelegatedGovernanceService.validateInheritanceRule allows tighten from lower role", () => {
  const delegations: readonly GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  // team_lead tightening restrictions (lower risk)
  const result = service.validateInheritanceRule("division_admin", "team_lead", "tighten");

  assert.equal(result.allowed, true, "tighten should be allowed from lower role");
});

test("integration: DelegatedGovernanceService.validateInheritanceRule blocks loosen from lower role", () => {
  const delegations: readonly GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  // team_lead attempting to loosen restrictions (higher risk)
  const result = service.validateInheritanceRule("division_admin", "team_lead", "loosen");

  assert.equal(result.allowed, false, "lower roles cannot loosen restrictions");
  assert.ok(result.reason.includes("Lower roles cannot loosen"), "reason should explain");
});

test("integration: DelegatedGovernanceService.validateInheritanceRule allows loosen from same/parent role", () => {
  const delegations: readonly GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  // division_admin loosening own restrictions
  const result = service.validateInheritanceRule("division_admin", "division_admin", "loosen");

  assert.equal(result.allowed, true, "same role can loosen own restrictions");
});

test("integration: DelegatedGovernanceService.validateInheritanceRule allows append from any role", () => {
  const delegations: readonly GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  // For append, the role doing the append (childRole) must not be higher privilege
  // than the delegator (parentRole). So platform_team (0) can append to team_lead (3).
  const result = service.validateInheritanceRule("platform_team", "team_lead", "append");

  assert.equal(result.allowed, true, "append should be allowed when child role is lower privilege");
});

test("integration: DelegatedGovernanceService.validateInheritanceRule blocks insufficient role level", () => {
  const delegations: readonly GovernanceDelegation[] = [];
  const service = new DelegatedGovernanceService(delegations);

  // Requester (division_admin) has lower index than target (platform_team) - means lower role
  // This tests child trying to perform actions reserved for parent
  const result = service.validateInheritanceRule("platform_team", "division_admin", "loosen");

  assert.equal(result.allowed, false, "insufficient role level should block action");
});

// ============================================================================
// Guardrail Listing Tests
// ============================================================================

test("integration: DelegatedGovernanceService.getApplicableGuardrails returns correct guardrails", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-global",
      grantorId: "platform_team",
      granteeId: "global-admin",
      level: "super_admin",
      delegatable: false,
      orgNodeIds: [], // All org nodes
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        { guardrailId: "global-1", type: "max_budget", value: 100000, setBy: "platform_team", overridable: false },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del-div-specific",
      grantorId: "platform_team",
      granteeId: "div-admin",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        { guardrailId: "div-1-budget", type: "max_budget", value: 50000, setBy: "platform_team", overridable: false },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  // Global guardrails should apply to any org node
  const globalGuardrails = service.getApplicableGuardrails("division-1");
  assert.ok(globalGuardrails.length >= 1, "should have global guardrails");

  // Division-specific guardrails should apply
  const divGuardrails = service.getApplicableGuardrails("division-1");
  assert.ok(divGuardrails.some((g) => g.guardrailId === "div-1-budget"), "should include division-1 specific guardrail");

  // Division-specific guardrails should NOT apply to other divisions
  const otherDivGuardrails = service.getApplicableGuardrails("division-2");
  assert.ok(!otherDivGuardrails.some((g) => g.guardrailId === "div-1-budget"), "should not include division-1 guardrail for division-2");
});

test("integration: DelegatedGovernanceService.getApplicableGuardrails filters by domainId", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-domain-specific",
      grantorId: "platform_team",
      granteeId: "admin-1",
      level: "admin",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: ["domain-a"], // Only applies to domain-a
      derivedDelegationIds: [],
      permissions: [],
      guardrails: [
        { guardrailId: "domain-a-only", type: "max_budget", value: 50000, setBy: "platform_team", overridable: false },
      ],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const guardrailsA = service.getApplicableGuardrails("division-1", "domain-a");
  assert.ok(guardrailsA.some((g) => g.guardrailId === "domain-a-only"), "should include domain-a guardrail for domain-a");

  const guardrailsB = service.getApplicableGuardrails("division-1", "domain-b");
  assert.ok(!guardrailsB.some((g) => g.guardrailId === "domain-a-only"), "should not include domain-a guardrail for domain-b");
});

// ============================================================================
// Delegation Listing Tests
// ============================================================================

test("integration: DelegatedGovernanceService.listDelegationsForGrantee returns active delegations", () => {
  const futureDate = "2099-12-31T23:59:59.999Z";

  const delegations: readonly GovernanceDelegation[] = [
    {
      delegationId: "del-active-1",
      grantorId: "platform_team",
      granteeId: "user-multi",
      level: "admin",
      delegatable: false,
      orgNodeIds: [],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["manage_budgets"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del-active-2",
      grantorId: "division_admin",
      granteeId: "user-multi",
      level: "operate",
      delegatable: false,
      orgNodeIds: ["division-1"],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["approve_task"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del-revoked",
      grantorId: "platform_team",
      granteeId: "user-multi",
      level: "view",
      delegatable: false,
      orgNodeIds: [],
      domainIds: [],
      derivedDelegationIds: [],
      permissions: ["view_audit"],
      guardrails: [],
      expiresAt: futureDate,
      revocable: true,
      status: "revoked",
    },
  ];

  const service = new DelegatedGovernanceService(delegations);

  const active = service.listDelegationsForGrantee("user-multi", futureDate);

  assert.equal(active.length, 2, "should return 2 active delegations");
  assert.ok(active.some((d) => d.delegationId === "del-active-1"), "should include del-active-1");
  assert.ok(active.some((d) => d.delegationId === "del-active-2"), "should include del-active-2");
  assert.ok(!active.some((d) => d.delegationId === "del-revoked"), "should not include revoked delegation");
});