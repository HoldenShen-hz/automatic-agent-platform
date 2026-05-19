import assert from "node:assert/strict";
import test from "node:test";
import { DomainRiskLevelSchema, DomainRiskDimensionSchema, RiskOverrideSchema, EscalationLevelSchema, ApprovalRuleSchema, DomainRiskProfileSchema, computeDomainRiskLevel, } from "../../../../src/domains/risk-profile/index.js";
// --- Schema Tests ---
test("DomainRiskLevelSchema accepts valid risk levels", () => {
    const levels = ["low", "medium", "high", "critical"];
    for (const level of levels) {
        const result = DomainRiskLevelSchema.safeParse(level);
        assert.equal(result.success, true, `Risk level ${level} should be valid`);
    }
});
test("DomainRiskLevelSchema rejects invalid risk levels", () => {
    const result = DomainRiskLevelSchema.safeParse("invalid");
    assert.equal(result.success, false);
});
test("DomainRiskDimensionSchema accepts valid dimension", () => {
    const result = DomainRiskDimensionSchema.safeParse({
        dimension: "data_privacy",
        weight: 0.5,
        threshold: 75,
        mitigation: "Encrypt all data at rest and in transit",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.dimension, "data_privacy");
});
test("DomainRiskDimensionSchema applies defaults", () => {
    const result = DomainRiskDimensionSchema.parse({
        dimension: "cost",
        weight: 0.3,
        threshold: 80,
        mitigation: "Set budget alerts",
    });
    assert.equal(result.weight, 0.3);
    assert.equal(result.threshold, 80);
});
test("RiskOverrideSchema accepts valid override", () => {
    const result = RiskOverrideSchema.safeParse({
        actionPattern: "delete.*",
        baseRisk: 70,
        domainRisk: 90,
        reason: "High risk action in production",
        requiresJustification: true,
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.requiresJustification, true);
});
test("RiskOverrideSchema applies default for requiresJustification", () => {
    const result = RiskOverrideSchema.parse({
        actionPattern: "deploy.*",
        baseRisk: 50,
        domainRisk: 60,
        reason: "Standard deploy action",
    });
    assert.equal(result.requiresJustification, false);
});
test("EscalationLevelSchema accepts valid escalation", () => {
    const result = EscalationLevelSchema.safeParse({
        level: 1,
        trigger: "error_rate > 5%",
        target: "platform_sre",
        responseSla: "15m",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.target, "platform_sre");
});
test("EscalationLevelSchema accepts all valid targets", () => {
    const targets = ["domain_owner", "platform_sre", "security_team", "executive"];
    for (const target of targets) {
        const result = EscalationLevelSchema.safeParse({
            level: 1,
            trigger: "test",
            target,
            responseSla: "1h",
        });
        assert.equal(result.success, true, `Target ${target} should be valid`);
    }
});
test("ApprovalRuleSchema accepts valid rule", () => {
    const result = ApprovalRuleSchema.safeParse({
        ruleId: "rule_1",
        actionPattern: "deploy.*",
        requiredApprovals: 2,
        approverRole: "senior_engineer",
    });
    assert.equal(result.success, true);
});
test("ApprovalRuleSchema applies default for requiredApprovals", () => {
    const result = ApprovalRuleSchema.parse({
        ruleId: "rule_1",
        actionPattern: "delete.*",
        approverRole: "admin",
    });
    assert.equal(result.requiredApprovals, 1);
});
test("DomainRiskProfileSchema accepts full profile", () => {
    const result = DomainRiskProfileSchema.safeParse({
        profileId: "profile_coding",
        domainId: "coding",
        defaultRiskLevel: "medium",
        dimensions: [
            { dimension: "safety", weight: 0.8, threshold: 90, mitigation: "Code review" },
        ],
        regulatoryClass: "lightly_regulated",
        timeSensitivity: "near_realtime",
        reversibility: "fully_reversible",
        blastRadius: "team",
        riskOverrides: [
            {
                actionPattern: "deploy.*",
                baseRisk: 50,
                domainRisk: 70,
                reason: "Deploy action",
                requiresJustification: true,
            },
        ],
        escalationChain: [
            { level: 1, trigger: "error", target: "domain_owner", responseSla: "1h" },
        ],
        mandatoryApprovals: [
            { ruleId: "deploy_rule", actionPattern: "deploy.*", requiredApprovals: 1, approverRole: "senior" },
        ],
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.regulatoryClass, "lightly_regulated");
});
test("DomainRiskProfileSchema applies defaults", () => {
    const result = DomainRiskProfileSchema.parse({
        profileId: "profile_min",
        domainId: "test",
        defaultRiskLevel: "low",
    });
    assert.deepEqual(result.dimensions, []);
    assert.equal(result.regulatoryClass, undefined);
});
test("DomainRiskProfileSchema accepts enhanced fields as optional", () => {
    const result = DomainRiskProfileSchema.safeParse({
        profileId: "profile_enhanced",
        domainId: "finance",
        defaultRiskLevel: "high",
        timeSensitivity: "realtime",
        reversibility: "irreversible",
        blastRadius: "company",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.timeSensitivity, "realtime");
});
// --- computeDomainRiskLevel Tests ---
test("computeDomainRiskLevel returns critical for score >= 85", () => {
    const profile = {
        profileId: "profile_1",
        domainId: "test",
        defaultRiskLevel: "medium",
        dimensions: [],
    };
    assert.equal(computeDomainRiskLevel(profile, 85), "critical");
    assert.equal(computeDomainRiskLevel(profile, 100), "critical");
    assert.equal(computeDomainRiskLevel(profile, 90), "critical");
});
test("computeDomainRiskLevel returns high for score >= 65 and < 85", () => {
    const profile = {
        profileId: "profile_1",
        domainId: "test",
        defaultRiskLevel: "medium",
        dimensions: [],
    };
    assert.equal(computeDomainRiskLevel(profile, 65), "high");
    assert.equal(computeDomainRiskLevel(profile, 70), "high");
    assert.equal(computeDomainRiskLevel(profile, 84), "high");
});
test("computeDomainRiskLevel returns medium for score >= 35 and < 65", () => {
    const profile = {
        profileId: "profile_1",
        domainId: "test",
        defaultRiskLevel: "medium",
        dimensions: [],
    };
    assert.equal(computeDomainRiskLevel(profile, 35), "medium");
    assert.equal(computeDomainRiskLevel(profile, 50), "medium");
    assert.equal(computeDomainRiskLevel(profile, 64), "medium");
});
test("computeDomainRiskLevel returns low for score < 35 with non-critical default", () => {
    const profile = {
        profileId: "profile_1",
        domainId: "test",
        defaultRiskLevel: "medium",
        dimensions: [],
    };
    assert.equal(computeDomainRiskLevel(profile, 0), "low");
    assert.equal(computeDomainRiskLevel(profile, 20), "low");
    assert.equal(computeDomainRiskLevel(profile, 34), "low");
});
test("computeDomainRiskLevel returns medium for score < 35 with critical default", () => {
    const profile = {
        profileId: "profile_critical",
        domainId: "test",
        defaultRiskLevel: "critical",
        dimensions: [],
    };
    // When default is critical and score is low, returns medium (not low)
    assert.equal(computeDomainRiskLevel(profile, 0), "medium");
    assert.equal(computeDomainRiskLevel(profile, 34), "medium");
});
test("computeDomainRiskLevel handles boundary values correctly", () => {
    const profile = {
        profileId: "profile_boundaries",
        domainId: "test",
        defaultRiskLevel: "low",
        dimensions: [],
    };
    // Test exact boundary values
    assert.equal(computeDomainRiskLevel(profile, 34.99), "low");
    assert.equal(computeDomainRiskLevel(profile, 35), "medium");
    assert.equal(computeDomainRiskLevel(profile, 64.99), "medium");
    assert.equal(computeDomainRiskLevel(profile, 65), "high");
    assert.equal(computeDomainRiskLevel(profile, 84.99), "high");
    assert.equal(computeDomainRiskLevel(profile, 85), "critical");
});
//# sourceMappingURL=index.test.js.map