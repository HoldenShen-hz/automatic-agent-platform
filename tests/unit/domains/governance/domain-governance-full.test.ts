/**
 * Domain Governance Full Coverage Tests
 *
 * Additional tests for domain governance policy enforcement and compliance rules.
 * Covers edge cases and integration scenarios not tested in the basic governance tests.
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
// SLO Profile Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts 0% availability target", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-slo-zero",
    domainId: "domain-slo",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      availabilityTarget: 0,
    },
  });

  assert.equal(policy.sloProfile.availabilityTarget, 0);
});

test("DomainGovernancePolicySchema accepts 100% availability target", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-slo-max",
    domainId: "domain-slo",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      availabilityTarget: 1.0,
    },
  });

  assert.equal(policy.sloProfile.availabilityTarget, 1.0);
});

test("DomainGovernancePolicySchema accepts fractional availability target", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-slo-frac",
    domainId: "domain-slo",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      availabilityTarget: 0.9999,
    },
  });

  assert.equal(policy.sloProfile.availabilityTarget, 0.9999);
});

test("DomainGovernancePolicySchema rejects negative latency SLO", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-slo-neg",
      domainId: "domain-slo",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        latencySloMs: -100,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative freshness SLO", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-fresh-neg",
      domainId: "domain-fresh",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        freshnessSloMinutes: -1,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects zero latency SLO", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-latency-zero",
      domainId: "domain-latency",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        latencySloMs: 0,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Budget Constraints Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema rejects negative maxCostUsdPerDay", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-budget-neg",
      domainId: "domain-budget",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxCostUsdPerDay: -100,
      },
    });
  });
});

test("DomainGovernancePolicySchema accepts very large maxTokensPerDay", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-tokens-large",
    domainId: "domain-tokens",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxTokensPerDay: 999999999999,
    },
  });

  assert.equal(policy.budgetConstraints.maxTokensPerDay, 999999999999);
});

test("DomainGovernancePolicySchema rejects zero maxConcurrentRuns", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-concurrent-zero",
      domainId: "domain-concurrent",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxConcurrentRuns: 0,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxConcurrentRuns", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-concurrent-neg",
      domainId: "domain-concurrent",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxConcurrentRuns: -5,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recertification Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts on_change cadence", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-recert-change",
    domainId: "domain-recert",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    recertification: {
      cadence: "on_change",
    },
  });

  assert.equal(policy.recertification.cadence, "on_change");
});

test("DomainGovernancePolicySchema rejects invalid recertification cadence", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-recert-invalid",
      domainId: "domain-recert",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: {
        cadence: "monthly" as "quarterly",
      },
    });
  });
});

test("DomainGovernancePolicySchema accepts empty requiredEvidence for recertification", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-recert-empty",
    domainId: "domain-recert",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    recertification: {
      cadence: "annual",
      requiredEvidence: [],
    },
  });

  assert.deepEqual(policy.recertification.requiredEvidence, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Waiver Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts waiver with empty approvalRoles", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-waiver-empty",
    domainId: "domain-waiver",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    waiver: {
      allowed: true,
      approvalRoles: [],
      maxDurationDays: 30,
    },
  });

  assert.equal(policy.waiver.allowed, true);
  assert.deepEqual(policy.waiver.approvalRoles, []);
});

test("DomainGovernancePolicySchema applies waiver defaults", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-waiver-defaults",
    domainId: "domain-waiver",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    waiver: {},
  });

  assert.equal(policy.waiver.allowed, false);
  assert.deepEqual(policy.waiver.approvalRoles, []);
  assert.equal(policy.waiver.maxDurationDays, 30);
});

test("DomainGovernancePolicySchema rejects waiver with negative maxDurationDays", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-waiver-neg",
      domainId: "domain-waiver",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      waiver: {
        allowed: true,
        maxDurationDays: -1,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects waiver with zero maxDurationDays", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-waiver-zero",
      domainId: "domain-waiver",
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

// ─────────────────────────────────────────────────────────────────────────────
// Rollout Strategy Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernanceRolloutSchema accepts all valid strategies", () => {
  const strategies = ["canary", "manual", "shadow", "supervised_auto"] as const;

  for (const strategy of strategies) {
    const rollout = DomainGovernanceRolloutSchema.parse({ strategy });
    assert.equal(rollout.strategy, strategy);
  }
});

test("DomainGovernanceRolloutSchema applies all defaults", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({});

  assert.equal(rollout.strategy, "canary");
  assert.equal(rollout.approvalRequired, true);
  assert.equal(rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema accepts large rollback window", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({
    rollbackWindowMinutes: 10000,
  });

  assert.equal(rollout.rollbackWindowMinutes, 10000);
});

test("DomainGovernanceRolloutSchema rejects fractional rollback window", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({
      rollbackWindowMinutes: 30.5,
    });
  });
});

test("DomainGovernanceRolloutSchema rejects zero rollback window", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({
      rollbackWindowMinutes: 0,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts single character role names", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-roles-single",
    domainId: "domain-roles",
    ownerRoles: ["a"],
    operatorRoles: ["b"],
    approvalRoles: ["c"],
  });

  assert.equal(policy.ownerRoles[0], "a");
  assert.equal(policy.operatorRoles[0], "b");
  assert.equal(policy.approvalRoles[0], "c");
});

test("DomainGovernancePolicySchema accepts unicode role names", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-roles-unicode",
    domainId: "domain-roles",
    ownerRoles: ["管理员", "owner"],
    operatorRoles: ["оператор"],
    approvalRoles: [" approver "],
  });

  assert.equal(policy.ownerRoles.length, 2);
});

test("DomainGovernancePolicySchema rejects whitespace-only roles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-roles-whitespace",
      domainId: "domain-roles",
      ownerRoles: ["  "],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects tab-only roles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-roles-tab",
      domainId: "domain-roles",
      ownerRoles: ["\t"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restricted Data Classes Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts all standard data classes", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-data-classes",
    domainId: "domain-data",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    restrictedDataClasses: ["PII", "PHI", "financial", "PCI", "HIPAA", "GDPR"],
  });

  assert.equal(policy.restrictedDataClasses.length, 6);
});

test("DomainGovernancePolicySchema accepts custom data class names", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-data-custom",
    domainId: "domain-data",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    restrictedDataClasses: ["custom-class-1", "my-sensitive-data"],
  });

  assert.equal(policy.restrictedDataClasses.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Mandatory Evidence Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts duplicate evidence types", () => {
  // Note: This might be intentional (multiple audit logs?) or a validation gap
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-evidence-dup",
    domainId: "domain-evidence",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    mandatoryEvidence: ["audit-log", "audit-log"],
  });

  assert.equal(policy.mandatoryEvidence.length, 2);
});

test("DomainGovernancePolicySchema accepts empty mandatory evidence", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-evidence-empty",
    domainId: "domain-evidence",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    mandatoryEvidence: [],
  });

  assert.deepEqual(policy.mandatoryEvidence, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Rules Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema accepts custom compliance rules", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-compliance-custom",
    domainId: "domain-compliance",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    complianceRules: ["ISO27001", "NIST", "CUSTOM_FRAMEWORK"],
  });

  assert.equal(policy.complianceRules.length, 3);
});

test("DomainGovernancePolicySchema accepts empty compliance rules", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "pol-compliance-empty",
    domainId: "domain-compliance",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    complianceRules: [],
  });

  assert.deepEqual(policy.complianceRules, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Complete Policy with All Fields
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema parses policy with all optional fields", () => {
  const fullPolicy = {
    policyId: "pol-full",
    domainId: "domain-full",
    ownerRoles: ["owner1", "owner2"],
    operatorRoles: ["operator1", "operator2"],
    approvalRoles: ["approver1", "approver2"],
    restrictedDataClasses: ["PII", "PHI", "financial"],
    sloProfile: {
      latencySloMs: 100,
      availabilityTarget: 0.999,
      freshnessSloMinutes: 30,
    },
    budgetConstraints: {
      maxCostUsdPerDay: 10000,
      maxTokensPerDay: 1000000,
      maxConcurrentRuns: 50,
    },
    maxHibernationRenewals: 5,
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
      strategy: "canary",
      approvalRequired: true,
      rollbackWindowMinutes: 120,
    },
    mandatoryEvidence: ["execution-log", "audit-trail"],
  };

  const policy = DomainGovernancePolicySchema.parse(fullPolicy);

  assert.equal(policy.policyId, "pol-full");
  assert.equal(policy.domainId, "domain-full");
  assert.equal(policy.ownerRoles.length, 2);
  assert.equal(policy.operatorRoles.length, 2);
  assert.equal(policy.approvalRoles.length, 2);
  assert.equal(policy.restrictedDataClasses.length, 3);
  assert.equal(policy.sloProfile.latencySloMs, 100);
  assert.equal(policy.budgetConstraints.maxCostUsdPerDay, 10000);
  assert.equal(policy.maxHibernationRenewals, 5);
  assert.equal(policy.complianceRules.length, 3);
  assert.equal(policy.recertification.cadence, "semi_annual");
  assert.equal(policy.waiver.allowed, true);
  assert.equal(policy.rollout.strategy, "canary");
  assert.equal(policy.mandatoryEvidence.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Inference Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema type inference works correctly", () => {
  const policyData = {
    policyId: "pol-type",
    domainId: "domain-type",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  };

  const policy: DomainGovernancePolicy = DomainGovernancePolicySchema.parse(policyData);

  // Verify type-level access works
  const _policyId: string = policy.policyId;
  const _domainId: string = policy.domainId;
  const _ownerRoles: string[] = policy.ownerRoles;
});

test("DomainGovernanceRolloutSchema type inference works correctly", () => {
  const rolloutData = {
    strategy: "canary" as const,
    approvalRequired: true,
    rollbackWindowMinutes: 60,
  };

  const rollout: DomainGovernanceRollout = DomainGovernanceRolloutSchema.parse(rolloutData);

  // Verify type-level access works
  const _strategy: "canary" | "manual" | "shadow" | "supervised_auto" = rollout.strategy;
  const _approvalRequired: boolean = rollout.approvalRequired;
  const _rollbackWindowMinutes: number = rollout.rollbackWindowMinutes;
});
