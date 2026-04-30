/**
 * Unit tests for Delegated Governance Service
 * Tests permission intersection
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DelegatedGovernanceService } from "../../../../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import type { GovernanceDelegation, Guardrail } from "../../../../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import type { GovernanceOperationContext } from "../../../../../../src/org-governance/delegated-governance/scope-manager/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createDelegation(overrides?: Partial<GovernanceDelegation>): GovernanceDelegation {
  const now = new Date();
  const future = new Date(now.getTime() + 86400000);
  return {
    delegationId: "delegation-1",
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    level: "admin",
    delegatable: false,
    orgNodeIds: [],
    domainIds: [],
    derivedDelegationIds: [],
    permissions: [],
    guardrails: [],
    expiresAt: future.toISOString(),
    revocable: true,
    status: "active",
    ...overrides,
  };
}

function createGuardrail(overrides?: Partial<Guardrail>): Guardrail {
  return {
    guardrailId: "guardrail-1",
    type: "max_budget",
    value: 10000,
    setBy: "platform_team",
    overridable: false,
    ...overrides,
  };
}

function createContext(overrides?: Partial<GovernanceOperationContext>): GovernanceOperationContext {
  return {
    actorId: "actor-1",
    actorRole: "platform_team",
    orgNodeId: "org-node-1",
    domainId: "domain-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService - resolve()
// ─────────────────────────────────────────────────────────────────────────────

describe("DelegatedGovernanceService - resolve", () => {
  let service: DelegatedGovernanceService;

  beforeEach(() => {
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        delegationId: "del-1",
        granteeId: "user-1",
        orgNodeIds: ["org-1", "org-2"],
        domainIds: ["domain-a"],
        permissions: ["manage_domains"],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
      createDelegation({
        delegationId: "del-2",
        granteeId: "user-1",
        orgNodeIds: [],
        domainIds: [],
        permissions: ["view_audit"],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ];
    service = new DelegatedGovernanceService(delegations);
  });

  it("should return allowed=true when delegation matches scope", () => {
    const result = service.resolve("user-1", {
      orgNodeId: "org-1",
      domainId: "domain-a",
      permission: "manage_domains",
    });

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.delegationId, "del-1");
    assert.deepStrictEqual(result.reasonCodes, ["delegated_governance.scope_granted"]);
  });

  it("should return allowed=false when no matching delegation", () => {
    const result = service.resolve("user-2", {
      orgNodeId: "org-1",
    });

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.delegationId, null);
    assert.deepStrictEqual(result.reasonCodes, ["delegated_governance.scope_not_granted"]);
  });

  it("should return allowed=false when delegation expired", () => {
    const pastDelegation = createDelegation({
      delegationId: "del-expired",
      granteeId: "expired-user",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const svc = new DelegatedGovernanceService([pastDelegation]);

    const result = svc.resolve("expired-user", { orgNodeId: "org-1" });

    assert.strictEqual(result.allowed, false);
  });

  it("should return allowed=false when delegation is revoked", () => {
    const revokedDelegation = createDelegation({
      delegationId: "del-revoked",
      granteeId: "revoked-user",
      status: "revoked",
    });
    const svc = new DelegatedGovernanceService([revokedDelegation]);

    const result = svc.resolve("revoked-user", { orgNodeId: "org-1" });

    assert.strictEqual(result.allowed, false);
  });

  it("should filter by orgNodeId when specified in delegation", () => {
    const result = service.resolve("user-1", {
      orgNodeId: "org-3",
      permission: "manage_domains",
    });

    assert.strictEqual(result.allowed, false);
  });

  it("should filter by domainId when specified in delegation", () => {
    const result = service.resolve("user-1", {
      orgNodeId: "org-1",
      domainId: "domain-b",
      permission: "manage_domains",
    });

    assert.strictEqual(result.allowed, false);
  });

  it("should match when delegation has empty orgNodeIds (all orgs)", () => {
    const result = service.resolve("user-1", {
      orgNodeId: "any-org",
      permission: "view_audit",
    });

    assert.strictEqual(result.allowed, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService - checkOperation()
// ─────────────────────────────────────────────────────────────────────────────

describe("DelegatedGovernanceService - checkOperation", () => {
  let service: DelegatedGovernanceService;

  beforeEach(() => {
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        delegationId: "pt-del",
        grantorId: "platform_team",
        granteeId: "platform_team",
        orgNodeIds: [],
        domainIds: [],
        guardrails: [
          createGuardrail({ guardrailId: "max-risk", type: "max_risk_level", value: "high" }),
          createGuardrail({ guardrailId: "max-budget", type: "max_budget", value: 50000 }),
          createGuardrail({ guardrailId: "forbidden-shell", type: "forbidden_tools", value: ["shell_exec", "rm_rf"] }),
        ],
      }),
    ];
    service = new DelegatedGovernanceService(delegations);
  });

  describe("role-based access", () => {
    it("should allow platform_team to perform all operations", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task");

      assert.strictEqual(result.allowed, true);
    });

    it("should deny team_lead for operations beyond allowed set", () => {
      const ctx = createContext({ actorRole: "team_lead" });

      const result = service.checkOperation(ctx, "modify_global_guardrails");

      assert.strictEqual(result.allowed, false);
      assert.ok(result.violatedGuardrails.includes("role_guardrail"));
    });

    it("should allow team_lead for approve_task and create_trigger", () => {
      const ctx = createContext({ actorRole: "team_lead" });

      assert.strictEqual(service.checkOperation(ctx, "approve_task").allowed, true);
      assert.strictEqual(service.checkOperation(ctx, "create_trigger").allowed, true);
    });

    it("should allow division_admin for domain_onboarding", () => {
      const ctx = createContext({ actorRole: "division_admin" });

      const result = service.checkOperation(ctx, "domain_onboarding");

      assert.strictEqual(result.allowed, true);
    });

    it("should deny department_admin for approve_budget_increase", () => {
      const ctx = createContext({ actorRole: "department_admin" });

      const result = service.checkOperation(ctx, "approve_budget_increase");

      assert.strictEqual(result.allowed, false);
    });
  });

  describe("guardrail evaluation", () => {
    it("should pass when attempted value within guardrail limits", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task", "high");

      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.violatedGuardrails.length, 0);
    });

    it("should fail when risk level exceeds max", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task", "critical");

      assert.strictEqual(result.allowed, false);
      assert.ok(result.violatedGuardrails.includes("max-risk"));
    });

    it("should pass when budget within limit", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_budget_increase", 30000);

      assert.strictEqual(result.allowed, true);
    });

    it("should fail when budget exceeds max", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_budget_increase", 60000);

      assert.strictEqual(result.allowed, false);
      assert.ok(result.violatedGuardrails.includes("max-budget"));
    });

    it("should fail when tool is forbidden", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task", "shell_exec");

      assert.strictEqual(result.allowed, false);
      assert.ok(result.violatedGuardrails.includes("forbidden-shell"));
    });

    it("should allow non-forbidden tools", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task", "allowed_tool");

      assert.strictEqual(result.allowed, true);
    });

    it("should skip guardrail evaluation when attemptedValue is undefined", () => {
      const ctx = createContext({ actorRole: "platform_team" });

      const result = service.checkOperation(ctx, "approve_task");

      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.violatedGuardrails.length, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService - getApplicableGuardrails()
// ─────────────────────────────────────────────────────────────────────────────

describe("DelegatedGovernanceService - getApplicableGuardrails", () => {
  it("should return guardrails for matching org and domain", () => {
    const guardrail1 = createGuardrail({ guardrailId: "g1", type: "max_budget", value: 1000 });
    const guardrail2 = createGuardrail({ guardrailId: "g2", type: "max_risk_level", value: "medium" });

    const delegations: GovernanceDelegation[] = [
      createDelegation({
        grantorId: "platform_team",
        orgNodeIds: ["org-1"],
        domainIds: ["domain-1"],
        guardrails: [guardrail1],
      }),
      createDelegation({
        grantorId: "platform_team",
        orgNodeIds: [],
        domainIds: [],
        guardrails: [guardrail2],
      }),
    ];

    const service = new DelegatedGovernanceService(delegations);
    const guardrails = service.getApplicableGuardrails("org-1", "domain-1");

    assert.strictEqual(guardrails.length, 2);
    assert.ok(guardrails.some(g => g.guardrailId === "g1"));
    assert.ok(guardrails.some(g => g.guardrailId === "g2"));
  });

  it("should filter by orgNodeId", () => {
    const guardrail = createGuardrail({ guardrailId: "org-specific" });
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        grantorId: "platform_team",
        orgNodeIds: ["org-1"],
        guardrails: [guardrail],
      }),
    ];

    const service = new DelegatedGovernanceService(delegations);

    const matched = service.getApplicableGuardrails("org-1");
    const unmatched = service.getApplicableGuardrails("org-2");

    assert.strictEqual(matched.length, 1);
    assert.strictEqual(unmatched.length, 0);
  });

  it("should filter by domainId", () => {
    const guardrail = createGuardrail({ guardrailId: "domain-specific" });
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        grantorId: "platform_team",
        orgNodeIds: [],
        domainIds: ["domain-a"],
        guardrails: [guardrail],
      }),
    ];

    const service = new DelegatedGovernanceService(delegations);

    const matched = service.getApplicableGuardrails("any-org", "domain-a");
    const unmatched = service.getApplicableGuardrails("any-org", "domain-b");

    assert.strictEqual(matched.length, 1);
    assert.strictEqual(unmatched.length, 0);
  });

  it("should return empty array when no delegations", () => {
    const service = new DelegatedGovernanceService([]);
    const guardrails = service.getApplicableGuardrails("org-1");
    assert.strictEqual(guardrails.length, 0);
  });

  it("should only include active delegations", () => {
    const guardrail = createGuardrail({ guardrailId: "inactive-guardrail" });
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        grantorId: "platform_team",
        status: "active",
        guardrails: [guardrail],
      }),
      createDelegation({
        delegationId: "revoked-del",
        grantorId: "platform_team",
        status: "revoked",
        guardrails: [createGuardrail({ guardrailId: "revoked-guardrail" })],
      }),
    ];

    const service = new DelegatedGovernanceService(delegations);
    const guardrails = service.getApplicableGuardrails("org-1");

    assert.strictEqual(guardrails.length, 1);
    assert.strictEqual(guardrails[0].guardrailId, "inactive-guardrail");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService - listDelegationsForGrantee()
// ─────────────────────────────────────────────────────────────────────────────

describe("DelegatedGovernanceService - listDelegationsForGrantee", () => {
  it("should return all active delegations for grantee", () => {
    const delegations: GovernanceDelegation[] = [
      createDelegation({ delegationId: "d1", granteeId: "user-x" }),
      createDelegation({ delegationId: "d2", granteeId: "user-x" }),
      createDelegation({ delegationId: "d3", granteeId: "user-y" }),
    ];

    const service = new DelegatedGovernanceService(delegations);
    const result = service.listDelegationsForGrantee("user-x");

    assert.strictEqual(result.length, 2);
    assert.ok(result.every(d => d.granteeId === "user-x"));
  });

  it("should return empty array for unknown grantee", () => {
    const service = new DelegatedGovernanceService([]);
    const result = service.listDelegationsForGrantee("unknown");
    assert.strictEqual(result.length, 0);
  });

  it("should filter out expired delegations", () => {
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        delegationId: "active-del",
        granteeId: "user-z",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
      createDelegation({
        delegationId: "expired-del",
        granteeId: "user-z",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ];

    const service = new DelegatedGovernanceService(delegations);
    const result = service.listDelegationsForGrantee("user-z");

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].delegationId, "active-del");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegatedGovernanceService - validateInheritanceRule()
// ─────────────────────────────────────────────────────────────────────────────

describe("DelegatedGovernanceService - validateInheritanceRule", () => {
  let service: DelegatedGovernanceService;

  beforeEach(() => {
    service = new DelegatedGovernanceService([]);
  });

  describe("tighten action", () => {
    it("should allow anyone to tighten restrictions", () => {
      const result = service.validateInheritanceRule("team_lead", "platform_team", "tighten");
      assert.strictEqual(result.allowed, true);

      const result2 = service.validateInheritanceRule("platform_team", "team_lead", "tighten");
      assert.strictEqual(result2.allowed, true);
    });
  });

  describe("loosen action", () => {
    it("should allow parent to loosen restrictions", () => {
      const result = service.validateInheritanceRule("platform_team", "division_admin", "loosen");
      assert.strictEqual(result.allowed, true);
    });

    it("should deny lower role from loosening", () => {
      const result = service.validateInheritanceRule("division_admin", "team_lead", "loosen");
      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes("cannot loosen"));
    });

    it("should deny child from loosening parent restrictions", () => {
      const result = service.validateInheritanceRule("platform_team", "department_admin", "loosen");
      assert.strictEqual(result.allowed, false);
    });
  });

  describe("append action", () => {
    it("should allow anyone to append constraints", () => {
      const result = service.validateInheritanceRule("team_lead", "platform_team", "append");
      assert.strictEqual(result.allowed, true);
    });
  });

  describe("delete action", () => {
    it("should allow delete with ownership check note", () => {
      const result = service.validateInheritanceRule("division_admin", "team_lead", "delete");
      assert.strictEqual(result.allowed, true);
    });
  });

  describe("hierarchy enforcement", () => {
    it("should enforce platform_team > division_admin", () => {
      // Platform team is parent of division admin
      const result = service.validateInheritanceRule("platform_team", "division_admin", "loosen");
      assert.strictEqual(result.allowed, true);
    });

    it("should enforce division_admin > department_admin", () => {
      const result = service.validateInheritanceRule("division_admin", "department_admin", "loosen");
      assert.strictEqual(result.allowed, true);
    });

    it("should enforce department_admin > team_lead", () => {
      const result = service.validateInheritanceRule("department_admin", "team_lead", "loosen");
      assert.strictEqual(result.allowed, true);
    });

    it("should deny cross-hierarchy loosening", () => {
      // team_lead cannot loosen platform_team restrictions
      const result = service.validateInheritanceRule("team_lead", "platform_team", "loosen");
      assert.strictEqual(result.allowed, false);
    });
  });
});
