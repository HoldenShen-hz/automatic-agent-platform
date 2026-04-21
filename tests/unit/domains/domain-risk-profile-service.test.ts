import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { DomainRiskProfileService } from "../../../src/domains/domain-risk-profile-service.js";
import {
  DomainRiskLevel,
  DomainRiskProfile,
  RiskOverride,
  EscalationLevel,
  ApprovalRule,
} from "../../../src/domains/risk-profile/index.js";

function createTestProfile(domainId: string, defaultRiskLevel: DomainRiskLevel = "medium"): DomainRiskProfile {
  return {
    profileId: `profile_${domainId}`,
    domainId,
    defaultRiskLevel,
    dimensions: [
      {
        dimension: "data_sensitivity",
        weight: 0.4,
        threshold: 50,
        mitigation: "Encrypt sensitive data",
      },
      {
        dimension: "system_impact",
        weight: 0.3,
        threshold: 40,
        mitigation: "Limit blast radius",
      },
      {
        dimension: "user_privacy",
        weight: 0.3,
        threshold: 60,
        mitigation: "Anonymize user data",
      },
    ],
    regulatoryClass: "lightly_regulated",
    timeSensitivity: "near_realtime",
    reversibility: "fully_reversible",
    blastRadius: "team",
    riskOverrides: [],
    escalationChain: [
      {
        level: 1,
        trigger: "score >= 30",
        target: "domain_owner",
        responseSla: "4h",
      },
      {
        level: 2,
        trigger: "score >= 60",
        target: "platform_sre",
        responseSla: "1h",
      },
      {
        level: 3,
        trigger: "score >= 85",
        target: "security_team",
        responseSla: "15m",
      },
    ],
    mandatoryApprovals: [
      {
        ruleId: "rule_release",
        actionPattern: "release*",
        requiredApprovals: 2,
        approverRole: "release_manager",
      },
      {
        ruleId: "rule_prod_change",
        actionPattern: "production_change*",
        requiredApprovals: 3,
        approverRole: "senior_engineer",
      },
    ],
  };
}

describe("DomainRiskProfileService", () => {
  let service: DomainRiskProfileService;

  beforeEach(() => {
    service = new DomainRiskProfileService();
  });

  afterEach(() => {
    // Clean up any state if needed
  });

  describe("register and getProfile", () => {
    it("should register and retrieve a risk profile", () => {
      const profile = createTestProfile("test_domain");
      service.register(profile);

      const retrieved = service.getProfile("test_domain");
      assert.strictEqual(retrieved?.domainId, "test_domain");
      assert.strictEqual(retrieved?.defaultRiskLevel, "medium");
    });

    it("should return null for unregistered domain", () => {
      const retrieved = service.getProfile("unknown_domain");
      assert.strictEqual(retrieved, null);
    });
  });

  describe("assessRisk", () => {
    it("should compute effective risk level as low for low scores", () => {
      const profile = createTestProfile("low_risk_domain", "low");
      service.register(profile);

      const assessment = service.assessRisk("low_risk_domain", {
        data_sensitivity: 10,
        system_impact: 10,
        user_privacy: 10,
      });

      assert.strictEqual(assessment.effectiveRiskLevel, "low");
      assert.ok(assessment.totalScore < 35);
    });

    it("should compute effective risk level as medium for moderate scores", () => {
      const profile = createTestProfile("medium_risk_domain", "medium");
      service.register(profile);

      const assessment = service.assessRisk("medium_risk_domain", {
        data_sensitivity: 40,
        system_impact: 35,
        user_privacy: 40,
      });

      assert.strictEqual(assessment.effectiveRiskLevel, "medium");
      assert.ok(assessment.totalScore >= 35 && assessment.totalScore < 65);
    });

    it("should compute effective risk level as high for high scores", () => {
      const profile = createTestProfile("high_risk_domain", "high");
      service.register(profile);

      const assessment = service.assessRisk("high_risk_domain", {
        data_sensitivity: 70,
        system_impact: 65,
        user_privacy: 70,
      });

      assert.strictEqual(assessment.effectiveRiskLevel, "high");
      assert.ok(assessment.totalScore >= 65 && assessment.totalScore < 85);
    });

    it("should compute effective risk level as critical for very high scores", () => {
      const profile = createTestProfile("critical_risk_domain", "critical");
      service.register(profile);

      const assessment = service.assessRisk("critical_risk_domain", {
        data_sensitivity: 95,
        system_impact: 90,
        user_privacy: 95,
      });

      assert.strictEqual(assessment.effectiveRiskLevel, "critical");
      assert.ok(assessment.totalScore >= 85);
    });

    it("should return dimension scores with weighted calculations", () => {
      const profile = createTestProfile("weighted_domain");
      service.register(profile);

      const assessment = service.assessRisk("weighted_domain", {
        data_sensitivity: 50,
        system_impact: 50,
        user_privacy: 50,
      });

      assert.strictEqual(assessment.dimensionScores.length, 3);
      const dataSensitivity = assessment.dimensionScores.find((s) => s.dimension === "data_sensitivity");
      assert.ok(dataSensitivity);
      assert.strictEqual(dataSensitivity.weight, 0.4);
      assert.strictEqual(dataSensitivity.score, 50);
    });

    it("should throw error for unregistered domain", () => {
      assert.throws(
        () => service.assessRisk("unknown", { data_sensitivity: 50 }),
        /profile_not_found/,
      );
    });
  });

  describe("addOverride and removeOverride", () => {
    it("should add a risk override", () => {
      const profile = createTestProfile("override_domain");
      service.register(profile);

      const override = service.addOverride("override_domain", {
        actionPattern: "delete*",
        baseRisk: 60,
        domainRisk: 80,
        reason: "Delete operations are high risk",
        requiresJustification: true,
      });

      assert.strictEqual(override.actionPattern, "delete*");
      assert.strictEqual(override.baseRisk, 60);
      assert.strictEqual(override.domainRisk, 80);
      assert.strictEqual(override.requiresJustification, true);
    });

    it("should apply overrides during risk assessment", () => {
      const profile = createTestProfile("override_apply_domain");
      service.register(profile);

      service.addOverride("override_apply_domain", {
        actionPattern: "delete*",
        baseRisk: 0,
        domainRisk: 100,
        reason: "Test override",
        requiresJustification: false,
      });

      const assessment = service.assessRisk("override_apply_domain", {
        data_sensitivity: 50,
        system_impact: 50,
        user_privacy: 50,
      });

      assert.ok(assessment.applicableOverrides.length > 0);
    });

    it("should remove an existing override", () => {
      const profile = createTestProfile("remove_override_domain");
      service.register(profile);

      service.addOverride("remove_override_domain", {
        actionPattern: "delete*",
        baseRisk: 60,
        domainRisk: 80,
        reason: "To be removed",
      });

      const removed = service.removeOverride("remove_override_domain", "delete*");
      assert.strictEqual(removed, true);

      const updated = service.getProfile("remove_override_domain");
      assert.strictEqual(updated?.riskOverrides?.length, 0);
    });

    it("should return false when removing non-existent override", () => {
      const profile = createTestProfile("remove_none_domain");
      service.register(profile);

      const removed = service.removeOverride("remove_none_domain", "unknown*");
      assert.strictEqual(removed, false);
    });
  });

  describe("escalation chain resolution", () => {
    it("should resolve domain_owner escalation for low scores", () => {
      const profile = createTestProfile("escalate_low");
      service.register(profile);

      // Score >= 30 triggers domain_owner (level 1)
      // TotalScore = (40/100 * 0.4 + 40/100 * 0.3 + 40/100 * 0.3) * 100 = 40
      const assessment = service.assessRisk("escalate_low", {
        data_sensitivity: 40,
        system_impact: 40,
        user_privacy: 40,
      });

      assert.strictEqual(assessment.escalationTarget, "domain_owner");
    });

    it("should resolve platform_sre escalation for medium scores", () => {
      const profile = createTestProfile("escalate_medium");
      service.register(profile);

      // Score >= 60 triggers platform_sre (level 2)
      // TotalScore = (65/100 * 0.4 + 65/100 * 0.3 + 65/100 * 0.3) * 100 = 65
      const assessment = service.assessRisk("escalate_medium", {
        data_sensitivity: 65,
        system_impact: 65,
        user_privacy: 65,
      });

      assert.strictEqual(assessment.escalationTarget, "platform_sre");
    });

    it("should resolve security_team escalation for critical scores", () => {
      const profile = createTestProfile("escalate_critical");
      service.register(profile);

      const assessment = service.assessRisk("escalate_critical", {
        data_sensitivity: 90,
        system_impact: 90,
        user_privacy: 90,
      });

      assert.strictEqual(assessment.escalationTarget, "security_team");
    });

    it("should return null escalation target when no chain defined", () => {
      const profile: DomainRiskProfile = {
        ...createTestProfile("no_escalation"),
        escalationChain: [],
      };
      service.register(profile);

      const assessment = service.assessRisk("no_escalation", {
        data_sensitivity: 90,
        system_impact: 90,
        user_privacy: 90,
      });

      assert.strictEqual(assessment.escalationTarget, null);
    });
  });

  describe("mandatory approvals", () => {
    it("should return required approvals for matching patterns", () => {
      const profile = createTestProfile("approvals_domain");
      service.register(profile);

      const assessment = service.assessRisk("approvals_domain", {
        data_sensitivity: 50,
        system_impact: 50,
        user_privacy: 50,
      });

      assert.ok(assessment.requiredApprovals.length > 0);
      const releaseRule = assessment.requiredApprovals.find((r) => r.ruleId === "rule_release");
      assert.ok(releaseRule);
      assert.strictEqual(releaseRule.requiredApprovals, 2);
    });

    it("should not return approvals when overrides do not require justification", () => {
      const profile: DomainRiskProfile = {
        ...createTestProfile("no_approval_needed"),
        mandatoryApprovals: [],
        riskOverrides: [
          {
            actionPattern: "read*",
            baseRisk: 0,
            domainRisk: 100,
            reason: "Read operations are safe",
            requiresJustification: false,
          },
        ],
      };
      service.register(profile);

      const assessment = service.assessRisk("no_approval_needed", {
        data_sensitivity: 50,
        system_impact: 50,
        user_privacy: 50,
      });

      assert.strictEqual(assessment.requiredApprovals.length, 0);
    });
  });

  describe("edge cases", () => {
    it("should handle missing dimension scores by using threshold", () => {
      const profile = createTestProfile("missing_dims");
      service.register(profile);

      const assessment = service.assessRisk("missing_dims", {});

      // Should use threshold values (50, 40, 60) as defaults
      assert.strictEqual(assessment.dimensionScores.length, 3);
    });

    it("should handle empty dimensions array", () => {
      const profile: DomainRiskProfile = {
        ...createTestProfile("no_dims"),
        dimensions: [],
      };
      service.register(profile);

      const assessment = service.assessRisk("no_dims", {});

      assert.strictEqual(assessment.dimensionScores.length, 0);
      assert.strictEqual(assessment.effectiveRiskLevel, "low");
    });

    it("should handle wildcard action pattern matching", () => {
      const profile = createTestProfile("wildcard_test");
      service.register(profile);

      // The service's matchesPattern should handle wildcards
      // Testing via override that applies to all actions
      service.addOverride("wildcard_test", {
        actionPattern: "*",
        baseRisk: 0,
        domainRisk: 100,
        reason: "Catch all",
        requiresJustification: true,
      });

      const assessment = service.assessRisk("wildcard_test", {
        data_sensitivity: 50,
        system_impact: 50,
        user_privacy: 50,
      });

      assert.ok(assessment.applicableOverrides.length > 0);
    });
  });
});
