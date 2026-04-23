import assert from "node:assert/strict";
import test from "node:test";
import { AutonomyGovernanceService } from "../../../../src/interaction/autonomy/autonomy-governance-service.js";
function makeScore(overrides = {}) {
    return {
        capabilityId: "deploy",
        currentAutonomy: "suggestion",
        trustScore: 0,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: null,
        ...overrides,
    };
}
function makeProfile(overrides = {}) {
    return {
        agentId: "agent_1",
        domainId: "engineering_ops",
        overallTrustLevel: "trusted",
        lastEvaluation: "2026-04-19T00:00:00.000Z",
        capabilityScores: [],
        ...overrides,
    };
}
test("AutonomyGovernanceService evaluateCapability promotes when trust is high", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "supervised",
        totalExecutions: 250,
        successfulExecutions: 248,
        failedExecutions: 1,
        humanOverrides: 1,
        incidents: 0,
    });
    const decision = service.evaluateCapability("agent_1", score);
    assert.equal(decision.agentId, "agent_1");
    assert.equal(decision.capabilityId, "deploy");
    assert.ok(decision.trustScore > 80);
    assert.equal(decision.promoted, true);
    assert.ok(decision.reasonCodes.length > 0);
});
test("AutonomyGovernanceService evaluateCapability demotes on low trust", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        totalExecutions: 100,
        successfulExecutions: 40,
        failedExecutions: 30,
        humanOverrides: 25,
        incidents: 5,
    });
    const decision = service.evaluateCapability("agent_1", score);
    assert.ok(decision.trustScore < 30);
    assert.equal(decision.recommendedLevel, "suggestion");
    assert.equal(decision.promoted, false);
});
test("AutonomyGovernanceService evaluateCapability keeps level when trust is medium", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "supervised",
        totalExecutions: 50,
        successfulExecutions: 40,
        failedExecutions: 5,
        humanOverrides: 5,
        incidents: 0,
    });
    const decision = service.evaluateCapability("agent_1", score);
    // Calculate trust score: 40/50=80% success - 20%*(5/50)=2 override + 1 volume = 79
    assert.equal(decision.trustScore, 79);
    assert.equal(decision.trustLevel, "semi_trusted");
    assert.equal(decision.recommendedLevel, "supervised");
    assert.equal(decision.promoted, false);
});
test("AutonomyGovernanceService evaluateProfile aggregates trust scores", () => {
    const service = new AutonomyGovernanceService();
    const profile = makeProfile({
        agentId: "agent_multi",
        capabilityScores: [
            makeScore({ capabilityId: "cap_1", totalExecutions: 100, successfulExecutions: 95, incidents: 0 }),
            makeScore({ capabilityId: "cap_2", totalExecutions: 100, successfulExecutions: 90, incidents: 0 }),
        ],
    });
    const snapshot = service.evaluateProfile(profile);
    assert.equal(snapshot.agentId, "agent_multi");
    assert.equal(snapshot.decisions.length, 2);
    assert.ok(snapshot.overallTrustScore > 0);
    assert.ok(snapshot.overallTrustLevel.length > 0);
});
test("AutonomyGovernanceService evaluateProfile handles empty capability scores", () => {
    const service = new AutonomyGovernanceService();
    const profile = makeProfile({ capabilityScores: [] });
    const snapshot = service.evaluateProfile(profile);
    assert.equal(snapshot.decisions.length, 0);
    assert.equal(snapshot.overallTrustScore, 0);
    assert.equal(snapshot.overallTrustLevel, "untrusted");
});
test("AutonomyGovernanceService evaluateCapability sets reason codes for promotion", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "suggestion",
        totalExecutions: 60,
        successfulExecutions: 58,
        failedExecutions: 1,
        incidents: 0,
    });
    const decision = service.evaluateCapability("agent_1", score);
    assert.ok(decision.promoted === true || decision.recommendedLevel === "supervised");
});
test("AutonomyGovernanceService evaluateCapability handles incidents properly", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 490,
        failedExecutions: 5,
        humanOverrides: 3,
        incidents: 3,
    });
    const decision = service.evaluateCapability("agent_1", score);
    // Calculate: 490/500*100=98 - 20%*(3/500)=0.12 override - 3*15=45 incidents + 10 volume = 63
    // 63 is >= 50 and < 70, so trustLevel is "supervised"
    assert.equal(decision.trustScore, 63);
    assert.equal(decision.trustLevel, "supervised");
    assert.ok(decision.trustScore < 70);
});
test("AutonomyGovernanceService evaluateProfile maps trust level correctly", () => {
    const service = new AutonomyGovernanceService();
    const profile = makeProfile({
        capabilityScores: [
            makeScore({ capabilityId: "high_trust", totalExecutions: 500, successfulExecutions: 495, incidents: 0 }),
        ],
    });
    const snapshot = service.evaluateProfile(profile);
    assert.ok(snapshot.overallTrustLevel === "trusted" || snapshot.overallTrustLevel === "fully_trusted");
});
test("AutonomyGovernanceService evaluateCapability with P1 incident does not auto-demote", () => {
    const service = new AutonomyGovernanceService();
    const score = makeScore({
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        totalExecutions: 300,
        successfulExecutions: 295,
        failedExecutions: 2,
        humanOverrides: 2,
        incidents: 1,
        lastIncidentSeverity: "P1",
    });
    const decision = service.evaluateCapability("agent_1", score);
    // Calculate: 295/300*100=98.33 - 20%*(2/300)=0.13 - 1*15=15 + 6 volume = 89
    assert.equal(decision.capabilityId, "deploy");
    assert.equal(decision.trustScore, 89);
    assert.equal(decision.trustLevel, "trusted");
});
//# sourceMappingURL=autonomy-governance-service.test.js.map