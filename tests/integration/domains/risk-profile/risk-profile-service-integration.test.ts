import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { DomainRiskProfileService } from "../../../../src/domains/domain-risk-profile-service.js";
import type { DomainRiskProfile, DomainRiskLevel } from "../../../../src/domains/risk-profile/index.js";
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

test("integration: DomainRiskProfileService manages risk overrides", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("risk-profile"),
    domainId: "override-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
    riskOverrides: [
      {
        actionPattern: "deploy.*production",
        baseRisk: 30,
        domainRisk: 85,
        reason: "Production deployments require extra scrutiny",
        requiresJustification: true,
      },
    ],
  };

  service.register(profile);

  const overrides = service.getRiskOverrides("override-domain");
  assert.equal(overrides.length, 1);
  assert.equal(overrides[0]!.actionPattern, "deploy.*production");
  assert.equal(overrides[0]!.requiresJustification, true);
});

test("integration: DomainRiskProfileService manages escalation chains", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("risk-profile"),
    domainId: "escalation-domain",
    defaultRiskLevel: "high",
    dimensions: [],
    escalationChain: [
      {
        level: 1,
        trigger: "risk_score > 70",
        target: "domain_owner",
        responseSla: "1h",
      },
      {
        level: 2,
        trigger: "risk_score > 85",
        target: "platform_sre",
        responseSla: "30m",
      },
      {
        level: 3,
        trigger: "risk_score > 95",
        target: "security_team",
        responseSla: "15m",
      },
    ],
  };

  service.register(profile);

  const chain = service.getEscalationChain("escalation-domain");
  assert.equal(chain.length, 3);
  assert.equal(chain[0]!.level, 1);
  assert.equal(chain[2]!.target, "security_team");
});

test("integration: DomainRiskProfileService manages mandatory approvals", () => {
  const service = new DomainRiskProfileService();

  const profile: DomainRiskProfile = {
    profileId: newId("risk-profile"),
    domainId: "approval-domain",
    defaultRiskLevel: "high",
    dimensions: [],
    mandatoryApprovals: [
      {
        ruleId: "rule1",
        actionPattern: "release.*production",
        requiredApprovals: 2,
        approverRole: "senior_engineer",
      },
      {
        ruleId: "rule2",
        actionPattern: "delete.*data",
        requiredApprovals: 3,
        approverRole: "data_owner",
      },
    ],
  };

  service.register(profile);

  const approvals = service.getMandatoryApprovals("approval-domain");
  assert.equal(approvals.length, 2);
  assert.equal(approvals[0]!.requiredApprovals, 2);
});

test("integration: DomainRiskProfileService retrieves all profiles for domain", () => {
  const service = new DomainRiskProfileService();

  service.register({
    profileId: newId("profile1"),
    domainId: "all-domain",
    defaultRiskLevel: "low",
    dimensions: [],
  });

  service.register({
    profileId: newId("profile2"),
    domainId: "all-domain",
    defaultRiskLevel: "medium",
    dimensions: [],
  });

  const profiles = service.getProfilesByDomain("all-domain");
  assert.equal(profiles.length, 2);
});

test("integration: DomainRiskProfileService assesses risk", () => {
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
  };

  service.register(profile);

  const assessment = service.assessRisk("assess-domain", {
    technical_risk: 70,
    operational_risk: 55,
  });

  assert.equal(assessment.domainId, "assess-domain");
  assert.equal(assessment.totalScore > 0, true);
  assert.equal(assessment.effectiveRiskLevel in ["low", "medium", "high", "critical"], true);
  assert.equal(assessment.dimensionScores.length, 2);
});

test("integration: DomainRiskProfileService returns null for nonexistent domain", () => {
  const service = new DomainRiskProfileService();

  const profile = service.getProfile("nonexistent");
  assert.equal(profile, null);

  const overrides = service.getRiskOverrides("nonexistent");
  assert.equal(overrides.length, 0);

  const chain = service.getEscalationChain("nonexistent");
  assert.equal(chain.length, 0);
});
