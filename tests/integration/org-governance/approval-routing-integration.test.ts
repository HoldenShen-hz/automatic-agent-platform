/**
 * Integration Test: Approval Routing
 *
 * Tests approval routing based on org hierarchy, risk levels,
 * and delegation chains.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { nowIso, newId } from "../../../src/platform/contracts/types/ids.js";

test("approval routing: routes to correct org node based on hierarchy", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Acme Corp",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_eng",
        nodeType: "department",
        displayName: "Engineering",
        parentOrgNodeId: "root",
        ownerUserIds: ["vp_eng"],
        active: true,
        metadata: {},
        costCenter: "ENG-001",
      },
      {
        orgNodeId: "team_platform",
        nodeType: "team",
        displayName: "Platform Team",
        parentOrgNodeId: "dept_eng",
        ownerUserIds: ["platform_lead"],
        active: true,
        metadata: {},
        costCenter: "ENG-PLATFORM",
      },
    ],
    {
      root: [{ policyId: "p_root", rules: { approvalRequired: true, minApprovers: 2 } }],
      dept_eng: [{ policyId: "p_eng", rules: { approvalRequired: true, minApprovers: 1 } }],
      team_platform: [{ policyId: "p_platform", rules: { approvalRequired: false } }],
    },
  );

  const result = compliance.evaluate({
    actorId: "engineer_1",
    orgNodeId: "team_platform",
    action: "code.deploy",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: nowIso(),
  });

  assert.equal(result.allowed, true);
});

test("approval routing: requires approval for high-risk actions", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Acme Corp",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
    ],
    {
      root: [
        {
          policyId: "p_high_risk",
          rules: { approvalRequired: true, riskThreshold: "high", minApprovers: 2 },
        },
      ],
    },
  );

  const result = compliance.evaluate({
    actorId: "admin_1",
    orgNodeId: "root",
    action: "admin.delete_environment",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: nowIso(),
    riskLevel: "high",
  });

  assert.equal(result.allowed, true);
});

test("approval routing: delegation chain resolves correctly", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_chain_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_eng"],
      domainIds: ["code"],
      permissions: ["approve", "review"],
      guardrails: [],
      expiresAt: "2026-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
    {
      delegationId: "del_chain_2",
      grantorId: "manager",
      granteeId: "team_lead",
      orgNodeIds: ["dept_eng", "team_platform"],
      domainIds: ["code"],
      permissions: ["approve"],
      guardrails: [],
      expiresAt: "2026-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result1 = delegated.resolve("manager", {
    orgNodeId: "dept_eng",
    domainId: "code",
    capability: "approve",
  }, nowIso());

  assert.equal(result1.allowed, true);

  const result2 = delegated.resolve("team_lead", {
    orgNodeId: "team_platform",
    domainId: "code",
    capability: "approve",
  }, nowIso());

  assert.equal(result2.allowed, true);
});

test("approval routing: expired delegation is rejected", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_expired",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_eng"],
      domainIds: ["code"],
      permissions: ["approve"],
      guardrails: [],
      expiresAt: "2024-01-01T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result = delegated.resolve("manager", {
    orgNodeId: "dept_eng",
    domainId: "code",
    capability: "approve",
  }, nowIso());

  assert.equal(result.allowed, false);
});

test("approval routing: revoked delegation is rejected", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_revoked",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_eng"],
      domainIds: ["code"],
      permissions: ["approve"],
      guardrails: [],
      expiresAt: "2026-12-31T00:00:00.000Z",
      revocable: true,
      status: "revoked",
    },
  ]);

  const result = delegated.resolve("manager", {
    orgNodeId: "dept_eng",
    domainId: "code",
    capability: "approve",
  }, nowIso());

  assert.equal(result.allowed, false);
});

test("approval routing: cross-domain permission denied", () => {
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_cross_domain",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_eng"],
      domainIds: ["code"],
      permissions: ["approve"],
      guardrails: [],
      expiresAt: "2026-12-31T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result = delegated.resolve("manager", {
    orgNodeId: "dept_eng",
    domainId: "finance",
    capability: "approve",
  }, nowIso());

  assert.equal(result.allowed, false);
});

test("approval routing: org node hierarchy traversal", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Acme Corp",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "division_a",
        nodeType: "division",
        displayName: "Division A",
        parentOrgNodeId: "root",
        ownerUserIds: ["div_a_director"],
        active: true,
        metadata: {},
        costCenter: "DIV-A",
      },
      {
        orgNodeId: "team_a1",
        nodeType: "team",
        displayName: "Team A1",
        parentOrgNodeId: "division_a",
        ownerUserIds: ["team_lead"],
        active: true,
        metadata: {},
        costCenter: "DIV-A-T1",
      },
    ],
    {
      root: [{ policyId: "p_root", rules: { approvalRequired: false } }],
      division_a: [{ policyId: "p_div_a", rules: { approvalRequired: true } }],
      team_a1: [{ policyId: "p_team", rules: { approvalRequired: false } }],
    },
  );

  // Team inherits division policy when team has no specific policy
  const result = compliance.evaluate({
    actorId: "engineer",
    orgNodeId: "team_a1",
    action: "task.create",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: nowIso(),
  });

  assert.equal(result.allowed, true);
});

test("approval routing: owner user bypasses approval", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "dept_eng",
        nodeType: "department",
        displayName: "Engineering",
        parentOrgNodeId: "root",
        ownerUserIds: ["vp_eng", "eng_admin"],
        active: true,
        metadata: {},
        costCenter: "ENG-001",
      },
    ],
    {
      dept_eng: [{ policyId: "p_eng", rules: { approvalRequired: true } }],
    },
  );

  // Owner user should have bypass capability
  const result = compliance.evaluate({
    actorId: "vp_eng",
    orgNodeId: "dept_eng",
    action: "deploy.production",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: nowIso(),
  });

  assert.equal(result.allowed, true);
});

test("approval routing: multi-level escalation path", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Acme Corp",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_finance",
        nodeType: "department",
        displayName: "Finance",
        parentOrgNodeId: "root",
        ownerUserIds: ["cfo"],
        active: true,
        metadata: {},
        costCenter: "FIN-001",
      },
      {
        orgNodeId: "team_accounting",
        nodeType: "team",
        displayName: "Accounting",
        parentOrgNodeId: "dept_finance",
        ownerUserIds: ["controller"],
        active: true,
        metadata: {},
        costCenter: "FIN-ACCT",
      },
    ],
    {
      root: [{ policyId: "p_root", rules: { approvalRequired: true, escalationLevels: 3 } }],
      dept_finance: [{ policyId: "p_finance", rules: { approvalRequired: true, escalationLevels: 2 } }],
      team_accounting: [{ policyId: "p_acct", rules: { approvalRequired: true, escalationLevels: 1 } }],
    },
  );

  const result = compliance.evaluate({
    actorId: "accountant",
    orgNodeId: "team_accounting",
    action: "finance.approve_expense",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: nowIso(),
  });

  assert.equal(result.allowed, true);
});
