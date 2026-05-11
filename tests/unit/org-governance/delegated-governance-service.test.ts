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
