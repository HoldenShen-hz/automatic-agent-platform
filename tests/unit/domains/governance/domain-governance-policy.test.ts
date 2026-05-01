import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainGovernancePolicySchema,
  DomainGovernanceRolloutSchema,
  type DomainGovernancePolicy,
  type DomainGovernanceRollout,
} from "../../../../src/domains/governance/domain-governance-policy.js";

// ---------------------------------------------------------------------------
// DomainGovernanceRolloutSchema Tests
// ---------------------------------------------------------------------------

test("DomainGovernanceRolloutSchema accepts valid rollout", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({
    strategy: "canary",
    approvalRequired: true,
    rollbackWindowMinutes: 60,
  });

  assert.equal(rollout.strategy, "canary");
  assert.equal(rollout.approvalRequired, true);
  assert.equal(rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema accepts all strategy values", () => {
  const strategies = ["manual", "canary", "shadow", "supervised_auto"] as const;
  for (const strategy of strategies) {
    const rollout = DomainGovernanceRolloutSchema.parse({ strategy });
    assert.equal(rollout.strategy, strategy);
  }
});

test("DomainGovernanceRolloutSchema defaults approvalRequired to true", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({ strategy: "canary" });
  assert.equal(rollout.approvalRequired, true);
});

test("DomainGovernanceRolloutSchema defaults rollbackWindowMinutes to 60", () => {
  const rollout = DomainGovernanceRolloutSchema.parse({ strategy: "canary" });
  assert.equal(rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernanceRolloutSchema rejects invalid strategy", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "invalid" });
  });
});

test("DomainGovernanceRolloutSchema rejects non-positive rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "canary", rollbackWindowMinutes: 0 });
  });
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "canary", rollbackWindowMinutes: -1 });
  });
});

test("DomainGovernanceRolloutSchema rejects non-integer rollbackWindowMinutes", () => {
  assert.throws(() => {
    DomainGovernanceRolloutSchema.parse({ strategy: "canary", rollbackWindowMinutes: 30.5 });
  });
});

// ---------------------------------------------------------------------------
// DomainGovernancePolicySchema Tests
// ---------------------------------------------------------------------------

test("DomainGovernancePolicySchema accepts minimal valid policy", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "policy-1",
    domainId: "domain-1",
    ownerRoles: ["domain_owner"],
    operatorRoles: ["domain_operator"],
    approvalRoles: ["domain_owner"],
  });

  assert.equal(policy.policyId, "policy-1");
  assert.equal(policy.domainId, "domain-1");
  assert.deepEqual(policy.ownerRoles, ["domain_owner"]);
  assert.deepEqual(policy.operatorRoles, ["domain_operator"]);
  assert.deepEqual(policy.approvalRoles, ["domain_owner"]);
});

test("DomainGovernancePolicySchema accepts full valid policy", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "policy-full",
    domainId: "domain-full",
    ownerRoles: ["domain_owner", "admin"],
    operatorRoles: ["domain_operator"],
    approvalRoles: ["domain_owner", "risk_committee"],
    restrictedDataClasses: ["pii", "financial"],
    sloProfile: {
      latencySloMs: 500,
      availabilityTarget: 0.99,
      freshnessSloMinutes: 60,
    },
    budgetConstraints: {
      maxCostUsdPerDay: 1000,
      maxTokensPerDay: 100_000,
      maxConcurrentRuns: 5,
    },
    maxHibernationRenewals: 3,
    complianceRules: ["gdpr", "sox"],
    recertification: {
      cadence: "quarterly",
      requiredEvidence: ["audit_report", "risk_assessment"],
    },
    waiver: {
      allowed: true,
      approvalRoles: ["risk_committee"],
      maxDurationDays: 90,
    },
    rollout: {
      strategy: "shadow",
      approvalRequired: false,
      rollbackWindowMinutes: 120,
    },
    mandatoryEvidence: ["risk_profile", "eval_framework"],
  });

  assert.equal(policy.policyId, "policy-full");
  assert.equal(policy.domainId, "domain-full");
  assert.deepEqual(policy.restrictedDataClasses, ["pii", "financial"]);
  assert.equal(policy.sloProfile.latencySloMs, 500);
  assert.equal(policy.sloProfile.availabilityTarget, 0.99);
  assert.equal(policy.budgetConstraints.maxCostUsdPerDay, 1000);
  assert.equal(policy.maxHibernationRenewals, 3);
  assert.equal(policy.recertification.cadence, "quarterly");
  assert.equal(policy.waiver.allowed, true);
  assert.equal(policy.rollout.strategy, "shadow");
  assert.deepEqual(policy.mandatoryEvidence, ["risk_profile", "eval_framework"]);
});

test("DomainGovernancePolicySchema defaults restrictedDataClasses to empty array", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(policy.restrictedDataClasses, []);
});

test("DomainGovernancePolicySchema defaults sloProfile to empty object", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(policy.sloProfile, {});
});

test("DomainGovernancePolicySchema defaults budgetConstraints to empty object", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(policy.budgetConstraints, {});
});

test("DomainGovernancePolicySchema defaults maxHibernationRenewals to 0", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(policy.maxHibernationRenewals, 0);
});

test("DomainGovernancePolicySchema defaults complianceRules to empty array", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(policy.complianceRules, []);
});

test("DomainGovernancePolicySchema defaults recertification", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(policy.recertification.cadence, "annual");
  assert.deepEqual(policy.recertification.requiredEvidence, []);
});

test("DomainGovernancePolicySchema defaults waiver", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(policy.waiver.allowed, false);
  assert.deepEqual(policy.waiver.approvalRoles, []);
  assert.equal(policy.waiver.maxDurationDays, 30);
});

test("DomainGovernancePolicySchema defaults rollout", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.equal(policy.rollout.strategy, "canary");
  assert.equal(policy.rollout.approvalRequired, true);
  assert.equal(policy.rollout.rollbackWindowMinutes, 60);
});

test("DomainGovernancePolicySchema defaults mandatoryEvidence to empty array", () => {
  const policy = DomainGovernancePolicySchema.parse({
    policyId: "p1",
    domainId: "d1",
    ownerRoles: ["owner"],
    operatorRoles: ["operator"],
    approvalRoles: ["approver"],
  });
  assert.deepEqual(policy.mandatoryEvidence, []);
});

test("DomainGovernancePolicySchema rejects empty policyId", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty domainId", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty ownerRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: [],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty operatorRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: [],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects empty approvalRoles", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: [],
    });
  });
});

test("DomainGovernancePolicySchema rejects whitespace-only role strings", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner", "  "],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
    });
  });
});

test("DomainGovernancePolicySchema rejects invalid sloProfile.availabilityTarget", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: { availabilityTarget: 1.5 },
    });
  });
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: { availabilityTarget: -0.1 },
    });
  });
});

test("DomainGovernancePolicySchema rejects invalid sloProfile.latencySloMs", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: { latencySloMs: 0 },
    });
  });
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      sloProfile: { latencySloMs: -100 },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxCostUsdPerDay", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: { maxCostUsdPerDay: -50 },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxTokensPerDay", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: { maxTokensPerDay: -1 },
    });
  });
});

test("DomainGovernancePolicySchema rejects non-positive maxConcurrentRuns", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      budgetConstraints: { maxConcurrentRuns: 0 },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative maxHibernationRenewals", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      maxHibernationRenewals: -1,
    });
  });
});

test("DomainGovernancePolicySchema accepts all recertification cadences", () => {
  const cadences = ["quarterly", "semi_annual", "annual", "on_change"] as const;
  for (const cadence of cadences) {
    const policy = DomainGovernancePolicySchema.parse({
      policyId: `p-${cadence}`,
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: { cadence, requiredEvidence: [] },
    });
    assert.equal(policy.recertification.cadence, cadence);
  }
});

test("DomainGovernancePolicySchema rejects invalid recertification cadence", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      recertification: { cadence: "monthly", requiredEvidence: [] },
    });
  });
});

test("DomainGovernancePolicySchema rejects negative waiver.maxDurationDays", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      waiver: { allowed: true, approvalRoles: [], maxDurationDays: 0 },
    });
  });
});

test("DomainGovernancePolicySchema rejects non-integer waiver.maxDurationDays", () => {
  assert.throws(() => {
    DomainGovernancePolicySchema.parse({
      policyId: "p1",
      domainId: "d1",
      ownerRoles: ["owner"],
      operatorRoles: ["operator"],
      approvalRoles: ["approver"],
      waiver: { allowed: true, approvalRoles: [], maxDurationDays: 7.5 },
    });
  });
});

test("DomainGovernancePolicySchema infers correct TypeScript types", () => {
  const policy: DomainGovernancePolicy = DomainGovernancePolicySchema.parse({
    policyId: "policy-typed",
    domainId: "domain-typed",
    ownerRoles: ["domain_owner"],
    operatorRoles: ["domain_operator"],
    approvalRoles: ["domain_owner"],
  });

  assert.equal(typeof policy.policyId, "string");
  assert.equal(typeof policy.domainId, "string");
  assert.ok(Array.isArray(policy.ownerRoles));
  assert.ok(Array.isArray(policy.operatorRoles));
  assert.ok(Array.isArray(policy.approvalRoles));
  assert.ok(Array.isArray(policy.restrictedDataClasses));
  assert.ok(typeof policy.sloProfile === "object");
  assert.ok(typeof policy.budgetConstraints === "object");
  assert.equal(typeof policy.maxHibernationRenewals, "number");
  assert.ok(Array.isArray(policy.complianceRules));
  assert.ok(typeof policy.recertification === "object");
  assert.ok(typeof policy.waiver === "object");
  assert.ok(typeof policy.rollout === "object");
  assert.ok(Array.isArray(policy.mandatoryEvidence));
});

test("DomainGovernanceRolloutSchema infers correct TypeScript types", () => {
  const rollout: DomainGovernanceRollout = DomainGovernanceRolloutSchema.parse({
    strategy: "canary",
    approvalRequired: true,
    rollbackWindowMinutes: 60,
  });

  assert.equal(typeof rollout.strategy, "string");
  assert.equal(typeof rollout.approvalRequired, "boolean");
  assert.equal(typeof rollout.rollbackWindowMinutes, "number");
});
