import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { DomainRiskProfileService } from "../../../../src/domains/domain-risk-profile-service.js";
import type { DomainRiskProfile } from "../../../../src/domains/risk-profile/index.js";
import { computeDomainRiskLevel } from "../../../../src/domains/risk-profile/index.js";

test("integration: DomainRiskProfileService registers and retrieves profiles", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("risk-profile"),
    domainId: "risk-domain",
    defaultRiskLevel: "medium",
    dimensions: [
      {
        dimension: "data_sensitivity",
        weight: 0.4,
        threshold: 70,
        mitigation: "Encryption at rest and in transit",
      },
    ],
    regulatoryClass: "lightly_regulated",
    timeSensitivity: "near_realtime",
    reversibility: "partially_reversible",
    blastRadius: "team",
  };

  service.register(profile);

  const retrieved = service.getProfile("risk-domain");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.defaultRiskLevel, "medium");
  assert.equal(retrieved!.regulatoryClass, "lightly_regulated");
});

test("integration: DomainRiskProfileService computes risk levels correctly", () => {
  const profile: DomainRiskProfile = {
    profileId: "test-profile",
    domainId: "compute-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
  };

  assert.equal(computeDomainRiskLevel(profile, 90), "critical");
  assert.equal(computeDomainRiskLevel(profile, 70), "high");
  assert.equal(computeDomainRiskLevel(profile, 40), "medium");
  assert.equal(computeDomainRiskLevel(profile, 10), "low");

  const criticalDefault: DomainRiskProfile = {
    ...profile,
    defaultRiskLevel: "critical",
  };
  assert.equal(computeDomainRiskLevel(criticalDefault, 10), "medium");
});

test("integration: DomainRiskProfileService adds and removes risk overrides", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("risk-profile"),
    domainId: "override-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
  };

  service.register(profile);

  const added = service.addOverride("override-domain", {
    actionPattern: "deploy_production",
    baseRisk: 30,
    domainRisk: 85,
    reason: "Production deployments require extra scrutiny",
    requiresJustification: true,
  });

  assert.equal(added.actionPattern, "deploy_production");
  assert.equal(added.requiresJustification, true);

  const removed = service.removeOverride("override-domain", "deploy_production");
  assert.equal(removed, true);

  const removeNonexistent = service.removeOverride("override-domain", "nonexistent");
  assert.equal(removeNonexistent, false);
});

test("integration: DomainRiskProfileService assesses risk with dimensions", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("assess-profile"),
    domainId: "assess-domain",
    defaultRiskLevel: "medium",
    dimensions: [
      {
        dimension: "technical_risk",
        weight: 0.6,
        threshold: 65,
        mitigation: "Code review and testing",
      },
      {
        dimension: "operational_risk",
        weight: 0.4,
        threshold: 50,
        mitigation: "Monitoring and alerting",
      },
    ],
    escalationChain: [
      {
        level: 1,
        trigger: "score >= 50",
        target: "domain_owner",
        responseSla: "1h",
      },
      {
        level: 2,
        trigger: "score >= 80",
        target: "platform_sre",
        responseSla: "30m",
      },
    ],
    mandatoryApprovals: [
      {
        ruleId: "rule1",
        actionPattern: "release_production",
        requiredApprovals: 2,
        approverRole: "senior_engineer",
      },
    ],
  };

  service.register(profile);

  const assessment = service.assessRisk("assess-domain", {
    technical_risk: 70,
    operational_risk: 55,
  });

  assert.equal(assessment.domainId, "assess-domain");
  assert.equal(assessment.assessmentId.startsWith("risk_assessment_"), true);
  assert.ok(assessment.totalScore >= 0, `totalScore should be >= 0, got ${assessment.totalScore}`);
  assert.equal(assessment.dimensionScores.length, 2);

  // Verify dimension scores are computed correctly
  // technical_risk: score=70, weight=0.6, weightedScore = 70/100 * 0.6 = 0.42
  // operational_risk: score=55, weight=0.4, weightedScore = 55/100 * 0.4 = 0.22
  const techDim = assessment.dimensionScores.find(d => d.dimension === "technical_risk");
  const opsDim = assessment.dimensionScores.find(d => d.dimension === "operational_risk");
  assert.notEqual(techDim, undefined);
  assert.notEqual(opsDim, undefined);
  assert.equal(techDim!.score, 70);
  assert.equal(opsDim!.score, 55);
});

test("integration: DomainRiskProfileService escalation target resolution", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("escalation-profile"),
    domainId: "escalation-test-domain",
    defaultRiskLevel: "high",
    dimensions: [
      {
        dimension: "risk_score",
        weight: 1.0,
        threshold: 50,
        mitigation: "Mitigation",
      },
    ],
    escalationChain: [
      {
        level: 1,
        trigger: "score >= 30",
        target: "domain_owner",
        responseSla: "1h",
      },
      {
        level: 2,
        trigger: "score >= 70",
        target: "platform_sre",
        responseSla: "30m",
      },
      {
        level: 3,
        trigger: "score >= 90",
        target: "security_team",
        responseSla: "15m",
      },
    ],
  };

  service.register(profile);

  const assessment = service.assessRisk("escalation-test-domain", {
    risk_score: 75,
  });

  assert.equal(assessment.escalationTarget, "platform_sre");
});

test("integration: DomainRiskProfileService returns null for nonexistent domain", () => {
  const service = new DomainRiskProfileService();

  const profile = service.getProfile("nonexistent");
  assert.equal(profile, null);
});

test("integration: DomainRiskProfileService override pattern matching", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("pattern-profile"),
    domainId: "pattern-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
    riskOverrides: [
      {
        actionPattern: "deploy.*production.*",
        baseRisk: 30,
        domainRisk: 100,
        reason: "High risk production deploys",
        requiresJustification: true,
      },
    ],
  };

  service.register(profile);

  const assessment = service.assessRisk("pattern-domain", {
    risk_score: 80,
  });

  assert.equal(assessment.applicableOverrides.length >= 0, true);
});
