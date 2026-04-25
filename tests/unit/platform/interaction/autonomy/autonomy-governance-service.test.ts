import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { AutonomyGovernanceService } from "../../../../../src/interaction/autonomy/autonomy-governance-service.js";
import type { AgentTrustProfile, CapabilityTrustScore, TrustLevel } from "../../../../../src/interaction/autonomy/index.js";

function mockCapabilityScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "cap-1",
    currentAutonomy: "supervised",
    trustScore: 80,
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 3,
    humanOverrides: 2,
    incidents: 0,
    lastIncidentAgeDays: null,
    ...overrides,
  };
}

function mockProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent-1",
    domainId: "domain-1",
    capabilityScores: [mockCapabilityScore()],
    overallTrustLevel: "supervised" as TrustLevel,
    lastEvaluation: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("AutonomyGovernanceService evaluateProfile returns snapshot", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile();

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.agentId, "agent-1");
  assert.strictEqual(result.decisions.length, profile.capabilityScores.length);
  assert.ok(typeof result.overallTrustScore === "number");
});

test("AutonomyGovernanceService evaluateProfile computes overall trust score", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({
    capabilityScores: [
      mockCapabilityScore({ totalExecutions: 20, successfulExecutions: 16, humanOverrides: 0 }),
      mockCapabilityScore({ totalExecutions: 20, successfulExecutions: 18, humanOverrides: 0 }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.overallTrustScore, 85);
});

test("AutonomyGovernanceService evaluateProfile handles empty capabilities", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({ capabilityScores: [] });

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.overallTrustScore, 0);
  assert.strictEqual(result.overallTrustLevel, "untrusted");
});

test("AutonomyGovernanceService evaluateCapability returns governance decision", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore();

  const result = service.evaluateCapability("agent-1", score);

  assert.strictEqual(result.agentId, "agent-1");
  assert.strictEqual(result.capabilityId, "cap-1");
  assert.ok(typeof result.trustScore === "number");
  assert.ok(result.reasonCodes.length >= 0);
});

test("AutonomyGovernanceService evaluateCapability sets promoted flag correctly", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore({ currentAutonomy: "suggestion", trustScore: 80, totalExecutions: 100, successfulExecutions: 98 });

  const result = service.evaluateCapability("agent-1", score);

  assert.strictEqual(result.promoted, true);
});

test("AutonomyGovernanceService evaluateCapability does not promote on low trust", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore({ trustScore: 20, currentAutonomy: "supervised" });

  const result = service.evaluateCapability("agent-1", score);

  assert.strictEqual(result.promoted, false);
});

test("AutonomyGovernanceService evaluateProfile maps trust level correctly", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({ capabilityScores: [mockCapabilityScore({ trustScore: 95 })] });

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.overallTrustLevel, "fully_trusted");
});

test("AutonomyGovernanceService evaluateCapability includes reason codes", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore();

  const result = service.evaluateCapability("agent-1", score);

  assert.ok(Array.isArray(result.reasonCodes));
});

test("AutonomyGovernanceService evaluateCapability recommended level can differ from current", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore({ currentAutonomy: "suggestion", trustScore: 80, totalExecutions: 50, successfulExecutions: 48 });

  const result = service.evaluateCapability("agent-1", score);

  assert.ok(result.recommendedLevel !== score.currentAutonomy || result.reasonCodes.includes("autonomy.level_unchanged"));
});

test("AutonomyGovernanceService evaluateProfile surfaces promoted decisions when capability level changes", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({ capabilityScores: [mockCapabilityScore({ currentAutonomy: "suggestion", trustScore: 80, totalExecutions: 50, successfulExecutions: 48 })] });

  const result = service.evaluateProfile(profile);
  const decision = result.decisions[0];

  assert.ok(decision);
  assert.equal(decision?.currentLevel, "suggestion");
  assert.equal(decision?.promoted, true);
  assert.notEqual(decision?.recommendedLevel, decision?.currentLevel);
});

test("AutonomyGovernanceService evaluateProfile preserves per-capability decisions", () => {
  const service = new AutonomyGovernanceService();
  const score1 = mockCapabilityScore({ capabilityId: "cap-1", currentAutonomy: "suggestion" });
  const score2 = mockCapabilityScore({ capabilityId: "cap-2", currentAutonomy: "supervised" });
  const profile = mockProfile({ capabilityScores: [score1, score2] });

  const result = service.evaluateProfile(profile);

  assert.deepEqual(result.decisions.map((decision) => decision.capabilityId), ["cap-1", "cap-2"]);
  assert.deepEqual(result.decisions.map((decision) => decision.currentLevel), ["suggestion", "supervised"]);
});

test("AutonomyGovernanceService evaluateCapability maintains current level when no change", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore({ currentAutonomy: "supervised", trustScore: 60 });

  const result = service.evaluateCapability("agent-1", score);

  assert.strictEqual(result.currentLevel, "supervised");
});

test("AutonomyGovernanceService evaluateProfile overall trust score is rounded", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({
    capabilityScores: [
      mockCapabilityScore({ totalExecutions: 60, successfulExecutions: 49, humanOverrides: 0 }),
      mockCapabilityScore({ totalExecutions: 20, successfulExecutions: 17, humanOverrides: 0 }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.overallTrustScore, 84);
});

test("AutonomyGovernanceService evaluateCapability trust level is derived from score", () => {
  const service = new AutonomyGovernanceService();
  const score = mockCapabilityScore({ totalExecutions: 20, successfulExecutions: 18, humanOverrides: 0 });

  const result = service.evaluateCapability("agent-1", score);

  assert.strictEqual(result.trustLevel, "trusted");
});

test("AutonomyGovernanceService evaluateProfile decisions include reason codes", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile();

  const result = service.evaluateProfile(profile);
  const decision = result.decisions[0];

  assert.ok(decision);
  assert.ok(Array.isArray(decision?.reasonCodes));
  assert.ok((decision?.reasonCodes.length ?? 0) > 0);
});

test("AutonomyGovernanceService evaluateProfile multiple capabilities averaging works", () => {
  const service = new AutonomyGovernanceService();
  const profile = mockProfile({
    capabilityScores: [
      mockCapabilityScore({ capabilityId: "cap-a", totalExecutions: 1, successfulExecutions: 1, humanOverrides: 0 }),
      mockCapabilityScore({ capabilityId: "cap-b", totalExecutions: 1, successfulExecutions: 0, humanOverrides: 0 }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.strictEqual(result.overallTrustScore, 50);
});
