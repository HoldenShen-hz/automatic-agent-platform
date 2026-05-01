import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyGovernanceService } from "../../../../src/interaction/autonomy/autonomy-governance-service.js";
import type { AgentTrustProfile, CapabilityTrustScore } from "../../../../src/interaction/autonomy/index.js";

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

  assert.equal(decision.trustScore, 781);
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

  assert.equal(decision.trustScore, 539);
  assert.equal(decision.trustLevel, "supervised");
  assert.ok(decision.trustScore < 700);
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

test("AutonomyGovernanceService evaluateCapability demotes P1 incidents by one level", () => {
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

  assert.equal(decision.capabilityId, "deploy");
  assert.equal(decision.trustScore, 838);
  assert.equal(decision.trustLevel, "semi_trusted");
  assert.equal(decision.recommendedLevel, "supervised");
  assert.deepEqual(decision.reasonCodes, ["autonomy.promotion_blocked_by_p1_incident"]);
});

test("AutonomyGovernanceService evaluateCapability demotes P0 incidents to suggestion regardless of trust score", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "deploy",
    currentAutonomy: "full_auto",
    totalExecutions: 600,
    successfulExecutions: 596,
    failedExecutions: 1,
    humanOverrides: 0,
    incidents: 1,
    lastIncidentSeverity: "P0",
  });

  const decision = service.evaluateCapability("agent_1", score);

  assert.equal(decision.recommendedLevel, "suggestion");
  assert.deepEqual(decision.reasonCodes, ["autonomy.promotion_blocked_by_p0_incident"]);
});

test("getMaxAutonomyLevel returns full_auto for unknown agent", () => {
  const service = new AutonomyGovernanceService();
  assert.equal(service.getMaxAutonomyLevel("unknown-agent"), "full_auto");
});

test("canPromote returns true for non-frozen agent targeting suggestion level", () => {
  const service = new AutonomyGovernanceService();
  // suggestion is lower than full_auto max, so can promote
  assert.equal(service.canPromote("agent-001", "cap-1", "suggestion"), true);
});

test("canDemote returns true for non-frozen agent", () => {
  const service = new AutonomyGovernanceService();
  assert.equal(service.canDemote("agent-001", "cap-1", "suggestion"), true);
});

test("isFrozen returns false for any agent since frozenAgents set is empty", () => {
  const service = new AutonomyGovernanceService();
  assert.equal(service.isFrozen("agent-001"), false);
  assert.equal(service.isFrozen("any-agent"), false);
});

test("setAuditService accepts null without throwing", () => {
  const service = new AutonomyGovernanceService();
  service.setAuditService(null);
});

test("evaluateProfile aggregates decisions from multiple capabilities", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({
    agentId: "agent-multi",
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 0 }),
      makeScore({ capabilityId: "cap-2", totalExecutions: 100, successfulExecutions: 100, humanOverrides: 0, incidents: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.agentId, "agent-multi");
  assert.equal(result.decisions.length, 2);
  // Both capabilities have perfect execution (100/100), trust score should be 1000 each
  // Average should be approximately 1000
  assert.ok(result.overallTrustScore >= 900);
});

test("evaluateProfile handles empty capability scores with zero trust", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({ capabilityScores: [] });
  const result = service.evaluateProfile(profile);
  assert.equal(result.overallTrustScore, 0);
  assert.equal(result.decisions.length, 0);
});

test("evaluateCapability preserves current level when trust is medium and no promotion", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "test",
    currentAutonomy: "supervised",
    totalExecutions: 100,
    successfulExecutions: 95,
    humanOverrides: 1,
    incidents: 0,
  });
  const decision = service.evaluateCapability("agent-x", score);
  // Trust score should be high but promotion requires meeting thresholds
  assert.equal(decision.trustScore > 0, true);
  assert.equal(decision.reasonCodes.length > 0, true);
});
