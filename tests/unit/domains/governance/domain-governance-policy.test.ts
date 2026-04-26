import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainGovernancePolicySchema,
  DomainGovernanceRolloutSchema,
  type DomainGovernancePolicy,
  type DomainGovernanceRollout,
} from "../../../../src/domains/governance/domain-governance-policy.js";

test("DomainGovernanceRolloutSchema parses valid rollout", () => {
  const valid: DomainGovernanceRollout = {
    strategy: "canary",
    approvalRequired: true,
    rollbackWindowMinutes: 60,
  };
  const result = DomainGovernanceRolloutSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("DomainGovernanceRolloutSchema defaults strategy to canary", () => {
  const partial = { rollbackWindowMinutes: 30 };
  const result = DomainGovernanceRolloutSchema.safeParse(partial);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.strategy, "canary");
  }
});

test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
  const invalid = { strategy: "invalid" };
  const result = DomainGovernanceRolloutSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema parses valid policy", () => {
  const valid: DomainGovernancePolicy = {
    policyId: "pol-123",
    domainId: "domain-abc",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    restrictedDataClasses: ["pii"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 120 },
    mandatoryEvidence: ["evidence-1"],
  };
  const result = DomainGovernancePolicySchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("DomainGovernancePolicySchema requires policyId", () => {
  const missing = {
    domainId: "domain-abc",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 60 },
  };
  const result = DomainGovernancePolicySchema.safeParse(missing);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema requires ownerRoles", () => {
  const missing = {
    policyId: "pol-123",
    domainId: "domain-abc",
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 60 },
  };
  const result = DomainGovernancePolicySchema.safeParse(missing);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema requires at least one ownerRole", () => {
  const empty = {
    policyId: "pol-123",
    domainId: "domain-abc",
    ownerRoles: [],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 60 },
  };
  const result = DomainGovernancePolicySchema.safeParse(empty);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema allows empty restrictedDataClasses", () => {
  const valid = {
    policyId: "pol-123",
    domainId: "domain-abc",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 60 },
    restrictedDataClasses: [],
  };
  const result = DomainGovernancePolicySchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("DomainGovernancePolicySchema validates rollbackWindowMinutes positive", () => {
  const invalid = {
    policyId: "pol-123",
    domainId: "domain-abc",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual", approvalRequired: false, rollbackWindowMinutes: 0 },
  };
  const result = DomainGovernancePolicySchema.safeParse(invalid);
  assert.equal(result.success, false);
});
