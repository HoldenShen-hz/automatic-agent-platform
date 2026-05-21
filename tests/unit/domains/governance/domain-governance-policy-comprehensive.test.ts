/**
 * Comprehensive tests for domain-governance-policy.ts
 * @see src/domains/governance/domain-governance-policy.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DomainGovernanceRolloutSchema,
  DomainGovernancePolicySchema,
} from "../../../../src/domains/governance/domain-governance-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernanceRolloutSchema
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernanceRolloutSchema parses all valid strategies", () => {
  const strategies = ["manual", "canary", "shadow", "supervised_auto"] as const;
  for (const strategy of strategies) {
    const result = DomainGovernanceRolloutSchema.parse({ strategy });
    assert.equal(result.strategy, strategy);
  }
});

test("DomainGovernanceRolloutSchema default strategy is canary", () => {
  const result = DomainGovernanceRolloutSchema.parse({});
  assert.equal(result.strategy, "canary");
});

test("DomainGovernanceRolloutSchema default approvalRequired is true", () => {
  const result = DomainGovernanceRolloutSchema.parse({});
  assert.equal(result.approvalRequired, true);
});

test("DomainGovernanceRolloutSchema default rollbackWindowMinutes is 60", () => {
  const result = DomainGovernanceRolloutSchema.parse({});
  assert.equal(result.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "invalid_strategy" });
  });
});

test("DomainGovernanceRolloutSchema rejects negative rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: -1 });
  });
});

test("DomainGovernanceRolloutSchema rejects zero rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: 0 });
  });
});

test("DomainGovernanceRolloutSchema rejects fractional rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ rollbackWindowMinutes: 30.5 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - Core Fields
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema requires policyId", () => {
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

test("DomainGovernancePolicySchema requires domainId", () => {
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

test("DomainGovernancePolicySchema requires at least one ownerRole", () => {
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

test("DomainGovernancePolicySchema requires at least one operatorRole", () => {
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

test("DomainGovernancePolicySchema requires at least one approvalRole", () => {
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
      operatorRoles: ["", "operator"],
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
      approvalRoles: ["", "approver"],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - Optional Fields
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults restrictedDataClasses to empty array", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(result.restrictedDataClasses, []);
});

test("DomainGovernancePolicySchema accepts restrictedDataClasses", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    restrictedDataClasses: ["pii", "financial", "health"],
  });
  assert.deepEqual(result.restrictedDataClasses, ["pii", "financial", "health"]);
});

test("DomainGovernancePolicySchema defaults mandatoryEvidence to empty array", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(result.mandatoryEvidence, []);
});

test("DomainGovernancePolicySchema accepts mandatoryEvidence", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    mandatoryEvidence: ["audit-log", "change-request"],
  });
  assert.deepEqual(result.mandatoryEvidence, ["audit-log", "change-request"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - sloProfile
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults sloProfile to empty object", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(result.sloProfile, {});
});

test("DomainGovernancePolicySchema accepts sloProfile with latencySloMs", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      latencySloMs: 100,
    },
  });
  assert.equal(result.sloProfile.latencySloMs, 100);
});

test("DomainGovernancePolicySchema accepts sloProfile with availabilityTarget", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      availabilityTarget: 0.99,
    },
  });
  assert.equal(result.sloProfile.availabilityTarget, 0.99);
});

test("DomainGovernancePolicySchema accepts sloProfile with freshnessSloMinutes", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    sloProfile: {
      freshnessSloMinutes: 30,
    },
  });
  assert.equal(result.sloProfile.freshnessSloMinutes, 30);
});

test("DomainGovernancePolicySchema rejects availabilityTarget greater than 1", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        availabilityTarget: 1.5,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative availabilityTarget", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        availabilityTarget: -0.1,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects non-positive latencySloMs", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        latencySloMs: 0,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects non-positive freshnessSloMinutes", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: {
        freshnessSloMinutes: 0,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - budgetConstraints
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults budgetConstraints to empty object", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(result.budgetConstraints, {});
});

test("DomainGovernancePolicySchema accepts budgetConstraints with maxCostUsdPerDay", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxCostUsdPerDay: 1000.50,
    },
  });
  assert.equal(result.budgetConstraints.maxCostUsdPerDay, 1000.50);
});

test("DomainGovernancePolicySchema accepts budgetConstraints with maxTokensPerDay", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxTokensPerDay: 1000000,
    },
  });
  assert.equal(result.budgetConstraints.maxTokensPerDay, 1000000);
});

test("DomainGovernancePolicySchema accepts budgetConstraints with maxConcurrentRuns", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    budgetConstraints: {
      maxConcurrentRuns: 5,
    },
  });
  assert.equal(result.budgetConstraints.maxConcurrentRuns, 5);
});

test("DomainGovernancePolicySchema rejects negative maxCostUsdPerDay", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxCostUsdPerDay: -100,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxTokensPerDay", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxTokensPerDay: -5000,
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects non-positive maxConcurrentRuns", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: {
        maxConcurrentRuns: 0,
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - maxHibernationRenewals
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults maxHibernationRenewals to 0", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(result.maxHibernationRenewals, 0);
});

test("DomainGovernancePolicySchema accepts positive maxHibernationRenewals", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    maxHibernationRenewals: 5,
  });
  assert.equal(result.maxHibernationRenewals, 5);
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

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - complianceRules
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults complianceRules to empty array", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(result.complianceRules, []);
});

test("DomainGovernancePolicySchema accepts complianceRules", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    complianceRules: ["GDPR", "SOC2", "ISO27001"],
  });
  assert.deepEqual(result.complianceRules, ["GDPR", "SOC2", "ISO27001"]);
});

test("DomainGovernancePolicySchema rejects empty string in complianceRules", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      complianceRules: ["GDPR", ""],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - recertification
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults recertification", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(result.recertification.cadence, "annual");
  assert.deepEqual(result.recertification.requiredEvidence, []);
});

test("DomainGovernancePolicySchema accepts recertification with quarterly cadence", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    recertification: {
      cadence: "quarterly",
      requiredEvidence: ["evidence-1"],
    },
  });
  assert.equal(result.recertification.cadence, "quarterly");
  assert.deepEqual(result.recertification.requiredEvidence, ["evidence-1"]);
});

test("DomainGovernancePolicySchema accepts recertification with semi_annual cadence", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    recertification: {
      cadence: "semi_annual",
    },
  });
  assert.equal(result.recertification.cadence, "semi_annual");
});

test("DomainGovernancePolicySchema accepts recertification with on_change cadence", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    recertification: {
      cadence: "on_change",
    },
  });
  assert.equal(result.recertification.cadence, "on_change");
});

test("DomainGovernancePolicySchema rejects invalid recertification cadence", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: {
        cadence: "monthly",
      },
    });
  });
});

test("DomainGovernancePolicySchema rejects empty string in requiredEvidence", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "pol-001",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: {
        cadence: "annual",
        requiredEvidence: ["evidence", ""],
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - waiver
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema defaults waiver", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(result.waiver.allowed, false);
  assert.deepEqual(result.waiver.approvalRoles, []);
  assert.equal(result.waiver.maxDurationDays, 30);
});

test("DomainGovernancePolicySchema accepts waiver with allowed true", () => {
  const result = DomainGovernancePolicySchema.parse({
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
  assert.equal(result.waiver.allowed, true);
  assert.deepEqual(result.waiver.approvalRoles, ["waiver-approver"]);
  assert.equal(result.waiver.maxDurationDays, 60);
});

test("DomainGovernancePolicySchema rejects non-positive maxDurationDays", () => {
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

// ─────────────────────────────────────────────────────────────────────────────
// DomainGovernancePolicySchema - Complete Valid Policies
// ─────────────────────────────────────────────────────────────────────────────

test("DomainGovernancePolicySchema parses complete valid policy", () => {
  const result = DomainGovernancePolicySchema.parse({
    policyId: "pol-001",
    domainId: "domain-001",
    ownerRoles: ["owner1", "owner2"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
    restrictedDataClasses: ["pii"],
    sloProfile: {
      latencySloMs: 200,
      availabilityTarget: 0.999,
    },
    budgetConstraints: {
      maxCostUsdPerDay: 5000,
      maxTokensPerDay: 1000000,
      maxConcurrentRuns: 10,
    },
    maxHibernationRenewals: 3,
    complianceRules: ["GDPR"],
    recertification: {
      cadence: "quarterly",
      requiredEvidence: ["audit-log"],
    },
    waiver: {
      allowed: true,
      approvalRoles: ["waiver-admin"],
      maxDurationDays: 90,
    },
    rollout: {
      strategy: "shadow",
      approvalRequired: false,
      rollbackWindowMinutes: 120,
    },
    mandatoryEvidence: ["change-log"],
  });

  assert.equal(result.policyId, "pol-001");
  assert.equal(result.domainId, "domain-001");
  assert.equal(result.ownerRoles.length, 2);
  assert.equal(result.sloProfile.latencySloMs, 200);
  assert.equal(result.budgetConstraints.maxConcurrentRuns, 10);
  assert.equal(result.maxHibernationRenewals, 3);
  assert.equal(result.recertification.cadence, "quarterly");
  assert.equal(result.waiver.allowed, true);
  assert.equal(result.rollout.strategy, "shadow");
  assert.deepEqual(result.mandatoryEvidence, ["change-log"]);
});

test("DomainGovernancePolicySchema handles whitespace-only strings correctly", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "   ",
      domainId: "domain-001",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});