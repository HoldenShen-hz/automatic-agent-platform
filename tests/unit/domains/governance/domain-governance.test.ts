/**
 * Domain Governance Service Unit Tests
 *
 * Tests for domain governance policy enforcement, role-based access, and compliance rules.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  DomainGovernancePolicySchema,
  DomainGovernanceRolloutSchema,
  type DomainGovernancePolicy,
  type DomainGovernanceRollout,
} from "../../../../src/domains/governance/domain-governance-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernanceRolloutSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernanceRolloutSchema parses valid rollout config", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({
    strategy: "canary",
    approvalRequired: true,
    rollbackWindowMinutes: 120,
  });

  assert.equal(rollout.strategy, "canary");
  assert.equal(rollout.approvalRequired, true);
  assert.equal(rollout.rollbackWindowMinutes, 120);
});

test("DomainGovernanceRolloutSchema accepts manual strategy", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({ strategy: "manual" });
  assert.equal(rollout.strategy, "manual");
});

test("DomainGovernanceRolloutSchema accepts shadow strategy", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({ strategy: "shadow" });
  assert.equal(rollout.strategy, "shadow");
});

test("DomainGovernanceRolloutSchema accepts supervised_auto strategy", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({ strategy: "supervised_auto" });
  assert.equal(rollout.strategy, "supervised_auto");
});

test("DomainGovernanceRolloutSchema defaults to canary strategy", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({});
  assert.equal(rollout.strategy, "canary");
});

test("DomainGovernanceRolloutSchema defaults approvalRequired to true", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({});
  assert.equal(rollout.approvalRequired, true);
});

test("DomainGovernanceRolloutSchema defaults rollbackWindowMinutes to 60", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({});
  assert.equal(rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "auto" });
  });
});

test("DomainGovernanceRolloutSchema rejects zero rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: 0 });
  });
});

test("DomainGovernanceRolloutSchema rejects negative rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: -10 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema parses valid policy", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["domain-owner"],
    operatorRoles: ["domain-operator"],
    approvalRoles: ["domain-approver"],
    restrictedDataClasses: ["pii", "financial"],
    sloProfile: {
      latencySloMs: 100,
      availabilityTarget: 0.999,
      freshnessSloMinutes: 60,
    },
    budgetConstraints: {
      maxCostUsdPerDay: 1000,
      maxTokensPerDay: 100000,
      maxConcurrentRuns: 10,
    },
    complianceRules: ["GDPR", "SOC2"],
    rollout: { strategy: "canary", approvalRequired: true, rollbackWindowMinutes: 60 },
    mandatoryEvidence: ["audit-log", "execution-report"],
  });

  assert.equal(policy.policyId, "pol-001");
  assert.equal(policy.domainId, "domain-001");
  assert.equal(policy.ownerRoles.length, 1);
  assert.equal(policy.restrictedDataClasses.length, 2);
  assert.equal(policy.sloProfile.latencySloMs, 100);
  assert.equal(policy.budgetConstraints.maxConcurrentRuns, 10);
});

test("DomainGovernancePolicySchema requires at least one owner role", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: [],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema requires at least one operator role", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: [],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema requires at least one approval role", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: [],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty policyId", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty strings in ownerRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner", ""],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty strings in operatorRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["op1", ""],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty strings in approvalRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["app1", ""],
    });
  });
});

test("DomainGovernancePolicySchema applies default recertification", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.equal(policy.recertification.cadence, "annual");
  assert.deepEqual(policy.recertification.requiredEvidence, []);
});

test("DomainGovernancePolicySchema applies default waiver settings", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.equal(policy.waiver.allowed, false);
  assert.deepEqual(policy.waiver.approvalRoles, []);
  assert.equal(policy.waiver.maxDurationDays, 30);
});

test("DomainGovernancePolicySchema accepts multiple owner roles", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner1", "owner2", "owner3"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.equal(policy.ownerRoles.length, 3);
});

test("DomainGovernancePolicySchema accepts recertification cadence options", () => {
  const cadences = ["quarterly", "semi_annual", "annual", "on_change"] as const;
  for (const cadence of cadences) {
    const policy = DomainGovernancePolicySchema.parse({
      policyId: `pol-${cadence}`,
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: { cadence },
    });
    assert.equal(policy.recertification.cadence, cadence);
  }
});

test("DomainGovernancePolicySchema accepts compliance rules array", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-compliance",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    complianceRules: ["GDPR", "HIPAA", "SOC2", "ISO27001"],
  });

  assert.equal(policy.complianceRules.length, 4);
  assert.ok(policy.complianceRules.includes("GDPR"));
  assert.ok(policy.complianceRules.includes("HIPAA"));
});

test("DomainGovernancePolicySchema defaults empty restrictedDataClasses", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.deepEqual(policy.restrictedDataClasses, []);
});

test("DomainGovernancePolicySchema defaults empty complianceRules", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.deepEqual(policy.complianceRules, []);
});

test("DomainGovernancePolicySchema defaults empty mandatoryEvidence", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.deepEqual(policy.mandatoryEvidence, []);
});

test("DomainGovernancePolicySchema defaults maxHibernationRenewals to 0", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.equal(policy.maxHibernationRenewals, 0);
});

test("DomainGovernancePolicySchema accepts positive maxHibernationRenewals", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    maxHibernationRenewals: 5,
  });

  assert.equal(policy.maxHibernationRenewals, 5);
});

test("DomainGovernancePolicySchema rejects negative maxHibernationRenewals", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      maxHibernationRenewals: -1,
    });
  });
});

test("DomainGovernancePolicySchema accepts nested sloProfile", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      latencySloMs: 50,
      availabilityTarget: 0.9999,
      freshnessSloMinutes: 30,
    },
  });

  assert.equal(policy.sloProfile.latencySloMs, 50);
  assert.equal(policy.sloProfile.availabilityTarget, 0.9999);
  assert.equal(policy.sloProfile.freshnessSloMinutes, 30);
});

test("DomainGovernancePolicySchema accepts partial sloProfile", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      latencySloMs: 100,
    },
  });

  assert.equal(policy.sloProfile.latencySloMs, 100);
  assert.equal(policy.sloProfile.availabilityTarget, undefined);
});

test("DomainGovernancePolicySchema accepts budgetConstraints", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxCostUsdPerDay: 5000,
      maxTokensPerDay: 500000,
      maxConcurrentRuns: 50,
    },
  });

  assert.equal(policy.budgetConstraints.maxCostUsdPerDay, 5000);
  assert.equal(policy.budgetConstraints.maxTokensPerDay, 500000);
  assert.equal(policy.budgetConstraints.maxConcurrentRuns, 50);
});

test("DomainGovernancePolicySchema accepts zero maxCostUsdPerDay", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxCostUsdPerDay: 0,
    },
  });

  assert.equal(policy.budgetConstraints.maxCostUsdPerDay, 0);
});

test("DomainGovernancePolicySchema accepts zero maxTokensPerDay", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxTokensPerDay: 0,
    },
  });

  assert.equal(policy.budgetConstraints.maxTokensPerDay, 0);
});

test("DomainGovernancePolicySchema defaults budgetConstraints", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });

  assert.equal(policy.budgetConstraints.maxCostUsdPerDay, undefined);
  assert.equal(policy.budgetConstraints.maxTokensPerDay, undefined);
  assert.equal(policy.budgetConstraints.maxConcurrentRuns, undefined);
});

test("DomainGovernancePolicySchema accepts waiver with allowed=true", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    waiver: {
      allowed: true,
      approvalRoles: ["waiver-approver"],
      maxDurationDays: 60,
    },
  });

  assert.equal(policy.waiver.allowed, true);
  assert.deepEqual(policy.waiver.approvalRoles, ["waiver-approver"]);
  assert.equal(policy.waiver.maxDurationDays, 60);
});

test("DomainGovernancePolicySchema rejects zero maxDurationDays in waiver", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      waiver: {
        allowed: true,
        maxDurationDays: 0,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxDurationDays in waiver", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      waiver: {
        allowed: true,
        maxDurationDays: -10,
      },
    });
  });
});

test("DomainGovernancePolicySchema accepts complex nested policy", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-complex",
    domainId: "domain-complex",
    ownerRoles: ["owner1", "owner2"],
    operatorRoles: ["operator1", "operator2", "operator3"],
    approvalRoles: ["approver1", "approver2"],
    restrictedDataClasses: ["PII", "PHI", "Financial"],
    sloProfile: {
      latencySloMs: 100,
      availabilityTarget: 0.999,
      freshnessSloMinutes: 60,
    },
    budgetConstraints: {
      maxCostUsdPerDay: 10000,
      maxTokensPerDay: 1000000,
      maxConcurrentRuns: 100,
    },
    maxHibernationRenewals: 3,
    complianceRules: ["GDPR", "HIPAA", "SOC2"],
    recertification: {
      cadence: "semi_annual",
      requiredEvidence: ["audit-report", "security-scan"],
    },
    waiver: {
      allowed: true,
      approvalRoles: ["compliance-officer"],
      maxDurationDays: 90,
    },
    rollout: {
      strategy: "shadow",
      approvalRequired: false,
      rollbackWindowMinutes: 240,
    },
    mandatoryEvidence: ["execution-log", "audit-trail"],
  });

  assert.equal(policy.policyId, "pol-complex");
  assert.equal(policy.recertification.cadence, "semi_annual");
  assert.equal(policy.rollout.strategy, "shadow");
  assert.equal(policy.waiver.maxDurationDays, 90);
});