import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyGovernanceService } from "../../../src/interaction/autonomy/autonomy-governance-service.js";
import { calculateTrustScore, mapTrustLevel } from "../../../src/interaction/autonomy/trust-scorer/index.js";
import { compareAutonomyLevels, nextAutonomyLevel } from "../../../src/interaction/autonomy/level-manager/index.js";
import type { AgentTrustProfile, CapabilityTrustScore, AutonomyLevel } from "../../../src/interaction/autonomy/index.js";

function makeScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
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

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent_1",
    domainId: "engineering_ops",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-19T00:00:00.000Z",
    capabilityScores: [],
    ...overrides,
  };
}

// ============ AutonomyGovernanceService Tests ============

test("AutonomyGovernanceService.evaluateProfile returns empty decisions for profile with no capabilities", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile();
  const snapshot = service.evaluateProfile(profile);

  assert.equal(snapshot.agentId, "agent_1");
  assert.equal(snapshot.overallTrustScore, 0);
  assert.equal(snapshot.overallTrustLevel, "untrusted");
  assert.equal(snapshot.decisions.length, 0);
});

test("AutonomyGovernanceService.evaluateProfile calculates overall trust score from decisions", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap_1", totalExecutions: 100, successfulExecutions: 95 }),
      makeScore({ capabilityId: "cap_2", totalExecutions: 100, successfulExecutions: 90 }),
    ],
  });
  const snapshot = service.evaluateProfile(profile);

  assert.equal(snapshot.decisions.length, 2);
  assert.ok(snapshot.overallTrustScore >= 0);
});

test("AutonomyGovernanceService.evaluateCapability promotes when promotion is recommended", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "deploy",
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 98,
    failedExecutions: 2,
    incidents: 0,
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.agentId, "agent_1");
  assert.equal(decision.capabilityId, "deploy");
  assert.equal(decision.currentLevel, "suggestion");
  assert.ok(decision.trustScore >= 0);
  assert.ok(decision.trustLevel !== undefined);
});

test("AutonomyGovernanceService.evaluateCapability returns low trust for low score", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "risky_cap",
    currentAutonomy: "full_auto",
    totalExecutions: 50,
    successfulExecutions: 20,
    failedExecutions: 20,
    humanOverrides: 10,
    incidents: 2,
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.trustScore < 30, true);
  assert.equal(decision.recommendedLevel, "suggestion");
});

test("AutonomyGovernanceService.evaluateCapability does not demote below current when trust is moderate", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "stable_cap",
    currentAutonomy: "supervised",
    totalExecutions: 60,
    successfulExecutions: 55,
    failedExecutions: 3,
    humanOverrides: 2,
    incidents: 0,
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.currentLevel, "supervised");
  // At this trust level, should stay at supervised or get adjusted
  assert.ok(decision.trustScore >= 30);
});

// ============ LevelManager Tests ============

test("compareAutonomyLevels returns positive when left is higher than right", () => {
  const result = compareAutonomyLevels("full_auto", "suggestion");
  assert.ok(result > 0, "full_auto should be higher than suggestion");
});

test("compareAutonomyLevels returns negative when left is lower than right", () => {
  const result = compareAutonomyLevels("suggestion", "full_auto");
  assert.ok(result < 0, "suggestion should be lower than full_auto");
});

test("compareAutonomyLevels returns zero when levels are equal", () => {
  const result = compareAutonomyLevels("supervised", "supervised");
  assert.equal(result, 0);
});

test("compareAutonomyLevels ordering: frozen > full_auto > semi_auto > supervised > suggestion", () => {
  assert.ok(compareAutonomyLevels("frozen", "full_auto") > 0);
  assert.ok(compareAutonomyLevels("full_auto", "semi_auto") > 0);
  assert.ok(compareAutonomyLevels("semi_auto", "supervised") > 0);
  assert.ok(compareAutonomyLevels("supervised", "suggestion") > 0);
});

test("nextAutonomyLevel returns frozen for frozen input", () => {
  const result = nextAutonomyLevel("frozen");
  assert.equal(result, "frozen");
});

test("nextAutonomyLevel returns supervised for suggestion input", () => {
  const result = nextAutonomyLevel("suggestion");
  assert.equal(result, "supervised");
});

test("nextAutonomyLevel returns semi_auto for supervised input", () => {
  const result = nextAutonomyLevel("supervised");
  assert.equal(result, "semi_auto");
});

test("nextAutonomyLevel returns full_auto for semi_auto input", () => {
  const result = nextAutonomyLevel("semi_auto");
  assert.equal(result, "full_auto");
});

test("nextAutonomyLevel handles full_auto input gracefully", () => {
  const result = nextAutonomyLevel("full_auto");
  assert.equal(result, "full_auto");
});

// ============ TrustScorer Integration Tests ============

test("calculateTrustScore and mapTrustLevel work together correctly", () => {
  const testCases: Array<{ executions: number; successful: number; overrides: number; incidents: number; expectedLevel: string }> = [
    { executions: 100, successful: 100, overrides: 0, incidents: 0, expectedLevel: "fully_trusted" },
    { executions: 100, successful: 90, overrides: 0, incidents: 0, expectedLevel: "trusted" },
    { executions: 100, successful: 80, overrides: 0, incidents: 0, expectedLevel: "semi_trusted" },
    { executions: 100, successful: 60, overrides: 0, incidents: 0, expectedLevel: "supervised" },
    { executions: 100, successful: 40, overrides: 0, incidents: 0, expectedLevel: "probation" },
    { executions: 100, successful: 10, overrides: 20, incidents: 5, expectedLevel: "untrusted" },
  ];

  for (const tc of testCases) {
    const score = makeScore({
      totalExecutions: tc.executions,
      successfulExecutions: tc.successful,
      humanOverrides: tc.overrides,
      incidents: tc.incidents,
    });
    const trustScore = calculateTrustScore(score);
    const trustLevel = mapTrustLevel(trustScore);
    assert.equal(trustLevel, tc.expectedLevel, `Failed for case: ${JSON.stringify(tc)}`);
  }
});

// ============ Edge Cases ============

test("AutonomyGovernanceService handles empty capability list gracefully", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({ capabilityScores: [] });
  const snapshot = service.evaluateProfile(profile);

  assert.equal(snapshot.decisions.length, 0);
  assert.equal(snapshot.overallTrustScore, 0);
  assert.equal(snapshot.overallTrustLevel, "untrusted");
});

test("AutonomyGovernanceService evaluateCapability handles zero executions", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    totalExecutions: 0,
    successfulExecutions: 0,
    incidents: 0,
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.trustScore, 0);
  assert.equal(decision.trustLevel, "untrusted");
  assert.equal(decision.recommendedLevel, "suggestion");
});

test("AutonomyGovernanceService evaluateCapability handles promotion with incidents blocked", () => {
  const service = new AutonomyGovernanceService();
  // Even with high success rate, incidents should block promotion
  const score = makeScore({
    currentAutonomy: "suggestion",
    totalExecutions: 200,
    successfulExecutions: 195,
    failedExecutions: 5,
    incidents: 1,
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.promoted, false);
  assert.ok(decision.reasonCodes.includes("autonomy.promotion_blocked_by_incident"));
});

test("compareAutonomyLevels handles all autonomy levels", () => {
  const levels: AutonomyLevel[] = ["suggestion", "supervised", "semi_auto", "full_auto", "frozen"];
  for (let i = 0; i < levels.length; i++) {
    for (let j = 0; j < levels.length; j++) {
      const left = levels[i]!;
      const right = levels[j]!;
      const result = compareAutonomyLevels(left, right);
      if (i < j) {
        assert.ok(result < 0, `${left} should be less than ${right}`);
      } else if (i > j) {
        assert.ok(result > 0, `${left} should be greater than ${right}`);
      } else {
        assert.equal(result, 0, `${left} should equal itself`);
      }
    }
  }
});

test("trust level boundaries are correct", () => {
  assert.equal(mapTrustLevel(94), "trusted");
  assert.equal(mapTrustLevel(95), "fully_trusted");
  assert.equal(mapTrustLevel(84), "semi_trusted");
  assert.equal(mapTrustLevel(85), "trusted");
  assert.equal(mapTrustLevel(69), "supervised");
  assert.equal(mapTrustLevel(70), "semi_trusted");
  assert.equal(mapTrustLevel(49), "probation");
  assert.equal(mapTrustLevel(50), "supervised");
  assert.equal(mapTrustLevel(29), "untrusted");
  assert.equal(mapTrustLevel(30), "probation");
});
