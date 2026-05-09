/**
 * R23-07, R23-08: Autonomy incident demotion severity fixes
 *
 * R23-07 fix: P0 incident sets "suggestion" not "frozen" per §42 spec
 * R23-08 fix: P2/P3 incidents should NOT trigger freeze - spec only P0/P1 trigger demotion
 *
 * These tests verify that:
 * - P0 incidents return "suggestion" (not "frozen") per R23-07 fix
 * - P2/P3 incidents return "suggestion" (not "frozen") per R23-08 fix
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ProgressiveAutonomyService,
  type AgentTrustProfile,
} from "../../../../src/interaction/autonomy/index.js";

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent_1",
    domainId: "engineering_ops",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-19T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 90,
        totalExecutions: 600,
        successfulExecutions: 594,
        failedExecutions: 2,
        humanOverrides: 1,
        incidents: 1,
        lastIncidentAgeDays: 1,
        lastIncidentSeverity: "P1",
        ...overrides,
      },
    ],
    ...overrides,
  } as AgentTrustProfile;
}

test("R23-07: P0 incident returns suggestion, not frozen", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 50,
        totalExecutions: 200,
        successfulExecutions: 180,
        failedExecutions: 10,
        humanOverrides: 5,
        incidents: 1,
        lastIncidentAgeDays: 1,
        lastIncidentSeverity: "P0",
      },
    ],
  }), { freezeOnIncident: true, windowDays: 30 });

  // R23-07 fix: P0 incident should return "suggestion", not "frozen" per §42 spec
  assert.equal(evaluation.decision.level, "suggestion",
    "P0 incident must return suggestion per R23-07 fix, not frozen");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.demoted",
    "P0 incident should produce demoted event");
});

test("R23-07: P0 severity is correctly identified and demoted", () => {
  const service = new ProgressiveAutonomyService();
  // P0 with zero successful executions
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "critical_operation",
        currentAutonomy: "full_auto",
        trustScore: 30,
        totalExecutions: 50,
        successfulExecutions: 30,
        failedExecutions: 20,
        humanOverrides: 10,
        incidents: 1,
        lastIncidentAgeDays: 0,
        lastIncidentSeverity: "P0",
      },
    ],
  }), { freezeOnIncident: true });

  // R23-07 fix: P0 severity must demote to suggestion
  assert.equal(evaluation.decision.level, "suggestion",
    "P0 severity with failed executions must return suggestion per R23-07");
});

test("R23-08: P2 incident returns suggestion, not frozen", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 70,
        totalExecutions: 300,
        successfulExecutions: 280,
        failedExecutions: 10,
        humanOverrides: 5,
        incidents: 1,
        lastIncidentAgeDays: 5,
        lastIncidentSeverity: "P2",
      },
    ],
  }), { freezeOnIncident: true, windowDays: 30 });

  // R23-08 fix: P2 incident must NOT freeze - only returns "suggestion"
  assert.equal(evaluation.decision.level, "suggestion",
    "P2 incident must return suggestion per R23-08 fix, not frozen");
});

test("R23-08: P3 incident returns suggestion, not frozen", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 80,
        totalExecutions: 400,
        successfulExecutions: 390,
        failedExecutions: 5,
        humanOverrides: 3,
        incidents: 1,
        lastIncidentAgeDays: 10,
        lastIncidentSeverity: "P3",
      },
    ],
  }), { freezeOnIncident: true, windowDays: 30 });

  // R23-08 fix: P3 incident must NOT freeze - only returns "suggestion"
  assert.equal(evaluation.decision.level, "suggestion",
    "P3 incident must return suggestion per R23-08 fix, not frozen");
});

test("R23-08: P2/P3 should not trigger freeze even with freezeOnIncident=true", () => {
  const service = new ProgressiveAutonomyService();

  // Test P2 with freezeOnIncident explicitly true
  const p2Eval = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 75,
        totalExecutions: 500,
        successfulExecutions: 480,
        failedExecutions: 10,
        humanOverrides: 5,
        incidents: 1,
        lastIncidentAgeDays: 3,
        lastIncidentSeverity: "P2",
      },
    ],
  }), { freezeOnIncident: true });

  // R23-08: freezeOnIncident does NOT apply to P2/P3
  assert.equal(p2Eval.decision.level, "suggestion",
    "P2 must return suggestion even with freezeOnIncident=true per R23-08");

  // Test P3 with freezeOnIncident explicitly true
  const p3Eval = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 85,
        totalExecutions: 600,
        successfulExecutions: 590,
        failedExecutions: 5,
        humanOverrides: 3,
        incidents: 1,
        lastIncidentAgeDays: 7,
        lastIncidentSeverity: "P3",
      },
    ],
  }), { freezeOnIncident: true });

  // R23-08: freezeOnIncident does NOT apply to P2/P3
  assert.equal(p3Eval.decision.level, "suggestion",
    "P3 must return suggestion even with freezeOnIncident=true per R23-08");
});

test("R23-07,R23-08: P1 still demotes one level (not freeze) when severityBasedDemotion enabled", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 80,
        totalExecutions: 300,
        successfulExecutions: 290,
        failedExecutions: 5,
        humanOverrides: 3,
        incidents: 1,
        lastIncidentAgeDays: 2,
        lastIncidentSeverity: "P1",
      },
    ],
  }), { freezeOnIncident: true, severityBasedDemotion: true });

  // P1 with severityBasedDemotion: demotes one level (not freeze)
  // semi_auto -> supervised
  assert.equal(evaluation.decision.level, "supervised",
    "P1 incident with severityBasedDemotion should demote one level");
});

test("R23-07,R23-08: P0 still has incident block for promotion", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "suggestion",
        trustScore: 90,
        totalExecutions: 100,
        successfulExecutions: 98,
        failedExecutions: 1,
        humanOverrides: 1,
        incidents: 1,
        lastIncidentAgeDays: 1,
        lastIncidentSeverity: "P0",
      },
    ],
  }), { freezeOnIncident: true, windowDays: 30 });

  // P0 incident should still block promotion (return suggestion, not freeze)
  assert.equal(evaluation.decision.level, "suggestion",
    "P0 incident blocks promotion but returns suggestion per R23-07");
});