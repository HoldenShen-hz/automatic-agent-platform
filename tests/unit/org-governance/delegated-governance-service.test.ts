import assert from "node:assert/strict";
import test from "node:test";

import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { intersectPermissions } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";

test("intersectPermissions computes permission intersection", () => {
  const granted = ["manage_budgets", "manage_domains", "view_audit"];
  const available = ["manage_budgets", "view_audit", "manage_agents"];

  const result = intersectPermissions(granted, available);
  assert.equal(result.length, 2);
  assert.ok(result.includes("manage_budgets"));
  assert.ok(result.includes("view_audit"));
});

test("intersectPermissions returns empty when granted is empty", () => {
  const result = intersectPermissions([], ["manage_budgets"]);
  assert.equal(result.length, 0);
});

test("intersectPermissions returns empty when available is empty", () => {
  const result = intersectPermissions(["manage_budgets"], []);
  assert.equal(result.length, 0);
});

test("intersectPermissions returns empty when no overlap", () => {
  const granted = ["manage_budgets", "manage_domains"];
  const available = ["view_audit", "manage_agents"];
  const result = intersectPermissions(granted, available);
  assert.equal(result.length, 0);
});

test("DelegatedGovernanceService resolves granted scope for active delegations", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "budget_management",
    permission: "manage_budgets",
  }, "2026-04-20T00:00:00.000Z");

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "del_1");
});

test("DelegatedGovernanceService grantee cannot exceed grantor permissions - grantor has fewer permissions", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets", "manage_domains", "view_audit"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  // Grantee requests manage_budgets but grantor only has manage_budgets (no overlap beyond this)
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "budget_management",
    permission: "manage_budgets",
  }, "2026-04-20T00:00:00.000Z", ["manage_budgets"]);

  // manage_budgets is in intersection, so should be allowed
  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService grantee cannot exceed grantor permissions - request beyond grantor", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets", "manage_domains", "view_audit", "manage_agents"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  // Grantee requests manage_agents but grantor only has manage_budgets (no manage_agents in grantor)
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "agent_management",
    permission: "manage_agents",
  }, "2026-04-20T00:00:00.000Z", ["manage_budgets", "manage_domains"]);

  // manage_agents is NOT in grantor's permissions, so should be denied
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCodes.includes("delegated_governance.permission_exceeds_grantor_authority"), true);
});

test("DelegatedGovernanceService grantee cannot exceed grantor permissions - partial overlap", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets", "manage_domains", "view_audit"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  // Grantee requests manage_prompts but grantor only has manage_budgets, manage_domains, view_audit
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "prompt_management",
    permission: "manage_prompts",
  }, "2026-04-20T00:00:00.000Z", ["manage_budgets", "manage_domains", "view_audit"]);

  // manage_prompts is NOT in intersection, so should be denied
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCodes.includes("delegated_governance.scope_not_granted"), true);
});

test("DelegatedGovernanceService without grantorPermissions defaults to allow (backward compatible)", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  // Without grantorPermissions, should work as before
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "budget_management",
    permission: "manage_budgets",
  }, "2026-04-20T00:00:00.000Z");

  assert.equal(result.allowed, true);
});

test("DelegatedGovernanceService empty grantorPermissions denies all", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: ["manage_budgets"],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  // With empty grantorPermissions, even a matching permission should be denied
  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "budget_management",
    permission: "manage_budgets",
  }, "2026-04-20T00:00:00.000Z", []);

  assert.equal(result.allowed, false);
});
