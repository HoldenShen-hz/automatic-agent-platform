import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainGovernanceRolloutSchema,
  DomainGovernancePolicySchema,
} from "../../../../src/domains/governance/domain-governance-policy.js";

test("DomainGovernanceRolloutSchema accepts valid rollout strategies", () => {
  const strategies = ["manual", "canary", "shadow", "supervised_auto"] as const;
  for (const strategy of strategies) {
    const result = DomainGovernanceRolloutSchema.safeParse({ strategy });
    assert.equal(result.success, true, `Strategy ${strategy} should be valid`);
  }
});

test("DomainGovernanceRolloutSchema applies defaults", () => {
  const result = DomainGovernanceRolloutSchema.parse({});
  assert.equal(result.strategy, "canary");
  assert.equal(result.approvalRequired, true);
  assert.equal(result.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
  const result = DomainGovernanceRolloutSchema.safeParse({ strategy: "invalid" });
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema accepts valid policy", () => {
  const policy = {
    policyId: "policy_coding",
    domainId: "coding",
    ownerRoles: ["owner", "admin"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "canary", approvalRequired: true, rollbackWindowMinutes: 30 },
    restrictedDataClasses: ["pii", "financial"],
    mandatoryEvidence: ["security_review", "code_review"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, true);
  assert.equal(result.data?.policyId, "policy_coding");
});

test("DomainGovernancePolicySchema requires ownerRoles to have at least one role", () => {
  const policy = {
    policyId: "policy_test",
    domainId: "test",
    ownerRoles: [],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema requires operatorRoles to have at least one role", () => {
  const policy = {
    policyId: "policy_test",
    domainId: "test",
    ownerRoles: ["owner"],
    operatorRoles: [],
    approvalRoles: ["approver"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema requires approvalRoles to have at least one role", () => {
  const policy = {
    policyId: "policy_test",
    domainId: "test",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: [],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema applies defaults for optional fields", () => {
  const policy = {
    policyId: "policy_minimal",
    domainId: "test",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: { strategy: "manual" }, // rollout is required, only test optional fields
  };
  const result = DomainGovernancePolicySchema.parse(policy);
  assert.deepEqual(result.restrictedDataClasses, []);
  assert.deepEqual(result.mandatoryEvidence, []);
  assert.equal(result.rollout.approvalRequired, true);
  assert.equal(result.rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernancePolicySchema rejects empty policyId", () => {
  const policy = {
    policyId: "",
    domainId: "test",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema rejects empty domainId", () => {
  const policy = {
    policyId: "policy_test",
    domainId: "",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema rejects empty role in ownerRoles", () => {
  const policy = {
    policyId: "policy_test",
    domainId: "test",
    ownerRoles: ["owner", ""],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, false);
});

test("DomainGovernancePolicySchema accepts nested rollout configuration", () => {
  const policy = {
    policyId: "policy_nested",
    domainId: "test",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    rollout: {
      strategy: "shadow",
      approvalRequired: false,
      rollbackWindowMinutes: 120,
    },
  };
  const result = DomainGovernancePolicySchema.safeParse(policy);
  assert.equal(result.success, true);
  assert.equal(result.data?.rollout.strategy, "shadow");
  assert.equal(result.data?.rollout.approvalRequired, false);
  assert.equal(result.data?.rollout.rollbackWindowMinutes, 120);
});