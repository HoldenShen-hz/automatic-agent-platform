/**
 * R23-07, R23-08: Autonomy incident demotion severity fixes
 *
 * Current semantics: freezeOnIncident freezes incident-bearing profiles unless
 * severityBasedDemotion is enabled for eligible severities.
 *
 * These tests verify that:
 * - freezeOnIncident returns "frozen" for P0/P2/P3 incident paths
 * - P1 with severityBasedDemotion still demotes one level instead of freezing
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

test("R23-07: P0 incident returns frozen when freezeOnIncident is enabled", () => {
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

  assert.equal(evaluation.decision.level, "frozen",
    "P0 incident should freeze while freezeOnIncident is enabled");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.frozen",
    "P0 incident should produce a frozen event");
});

test("R23-07: P0 severity is correctly identified and frozen", () => {
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

  assert.equal(evaluation.decision.level, "frozen",
    "P0 severity with failed executions should freeze the profile");
});

test("R23-08: P2 incident returns frozen when freezeOnIncident is enabled", () => {
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

  assert.equal(evaluation.decision.level, "frozen",
    "P2 incident should freeze while freezeOnIncident is enabled");
});

test("R23-08: P3 incident returns frozen when freezeOnIncident is enabled", () => {
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

  assert.equal(evaluation.decision.level, "frozen",
    "P3 incident should freeze while freezeOnIncident is enabled");
});

test("R23-08: P2/P3 freeze when freezeOnIncident=true", () => {
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

  assert.equal(p2Eval.decision.level, "frozen",
    "P2 should freeze when freezeOnIncident=true");

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

  assert.equal(p3Eval.decision.level, "frozen",
    "P3 should freeze when freezeOnIncident=true");
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

  assert.equal(evaluation.decision.level, "frozen",
    "P0 incident blocks promotion and freezes the profile");
});
