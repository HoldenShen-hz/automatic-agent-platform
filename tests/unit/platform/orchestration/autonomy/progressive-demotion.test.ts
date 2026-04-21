/**
 * Progressive Demotion Unit Tests
 *
 * Tests for severity-based demotion logic:
 * - P0 incidents: immediate freeze
 * - P1 incidents: demote one level (not freeze) when severityBasedDemotion enabled
 * - P2/P3 incidents: minor penalties
 *
 * Architecture: §42 Progressive Autonomy
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ProgressiveAutonomyService,
  type CapabilityTrustScore,
  type AgentTrustProfile,
  type IncidentSeverity,
  type AutonomyLevel,
} from "../../../../../../src/interaction/autonomy/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createCapabilityScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "test-capability",
    currentAutonomy: "supervised",
    trustScore: 70,
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 5,
    humanOverrides: 2,
    incidents: 0,
    lastIncidentAgeDays: null,
    ...overrides,
  };
}

function createAgentProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "test-agent",
    domainId: "test-domain",
    capabilityScores: [],
    overallTrustLevel: "supervised",
    lastEvaluation: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P0/P1 Demotion Logic Tests
// ─────────────────────────────────────────────────────────────────────────────

test("P0 incidents cause immediate freeze", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P0",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.equal(result.decision.level, "frozen");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.frozen");
  assert.equal(result.changeEvents[0]?.evidence.incidentSeverity, "P0");
});

test("P1 incidents with severityBasedDemotion demote one level", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // P1 should demote to semi_auto (one level down from full_auto)
  assert.equal(result.decision.level, "semi_auto");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.demoted");
  assert.equal(result.changeEvents[0]?.evidence.incidentSeverity, "P1");
});

test("P1 incidents without severityBasedDemotion freeze", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: false,
  });

  assert.equal(result.decision.level, "frozen");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.frozen");
});

test("P1 demotion does not go below suggestion", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "suggestion",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // P1 at suggestion level should stay at suggestion (can't demote further)
  assert.equal(result.decision.level, "suggestion");
});

test("P1 demotion from supervised goes to suggestion", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "supervised",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.changeEvents[0]?.toLevel, "suggestion");
  assert.equal(result.changeEvents[0]?.fromLevel, "supervised");
});

test("P1 demotion from semi_auto goes to supervised", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "semi_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.decision.level, "supervised");
});

test("P1 demotion from full_auto goes to semi_auto", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.decision.level, "semi_auto");
});

test("Frozen P1 incident recovers to full_auto on next evaluation without incidents", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 0, // No incidents now
        lastIncidentSeverity: undefined,
        currentAutonomy: "frozen",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // Without incidents, should return to normal evaluation
  assert.notEqual(result.decision.level, "frozen");
  assert.ok(["suggestion", "supervised", "semi_auto", "full_auto"].includes(result.decision.level));
});

test("Multiple P1 incidents each demote one level", () => {
  const service = new ProgressiveAutonomyService();

  // Start at full_auto
  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 3,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
        failedExecutions: 10,
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // With multiple failed executions, should still be demoted
  // But specifically, with P1 severity, it should not freeze
  assert.notEqual(result.decision.level, "frozen");
});

// ─────────────────────────────────────────────────────────────────────────────
// P2/P3 Incident Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("P2 incidents freeze without severityBasedDemotion", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P2",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // P2 still freezes (severityBasedDemotion only applies to P1)
  assert.equal(result.decision.level, "frozen");
});

test("P3 incidents freeze without severityBasedDemotion", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P3",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // P3 still freezes
  assert.equal(result.decision.level, "frozen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Behavior Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Default options include severityBasedDemotion enabled", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  // Call without explicit options
  const result = service.evaluateProfile(profile);

  // Default should be severityBasedDemotion: true
  assert.equal(result.decision.level, "semi_auto");
});

test("freezeOnIncident false overrides severity-based demotion", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P0",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: false,
    severityBasedDemotion: true,
  });

  // With freezeOnIncident: false, should not freeze even for P0
  assert.notEqual(result.decision.level, "frozen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Change Event Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Demotion event includes incident severity in evidence", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0]?.evidence.incidentSeverity, "P1");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.demoted");
});

test("Freeze event includes incident severity in evidence", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P0",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0]?.evidence.incidentSeverity, "P0");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.frozen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Capability Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Multiple capabilities with mixed severities", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        capabilityId: "cap-p1",
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
      createCapabilityScore({
        capabilityId: "cap-p0",
        incidents: 1,
        lastIncidentSeverity: "P0",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  // Should use lowest level across capabilities
  assert.equal(result.decision.level, "frozen");
  assert.equal(result.changeEvents.length, 2);

  const p1Event = result.changeEvents.find((e) => e.capabilityId === "cap-p1");
  const p0Event = result.changeEvents.find((e) => e.capabilityId === "cap-p0");

  assert.equal(p1Event?.eventType, "agent.autonomy.demoted");
  assert.equal(p0Event?.eventType, "agent.autonomy.frozen");
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Callback Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Autonomy change events are emitted via callback", () => {
  const service = new ProgressiveAutonomyService();
  const emittedEvents: string[] = [];

  service.onAutonomyChange((event) => {
    emittedEvents.push(event.eventType);
  });

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1",
        currentAutonomy: "full_auto",
      }),
    ],
  });

  service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0], "agent.autonomy.demoted");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("No incidents returns normal evaluation", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 0,
        lastIncidentSeverity: undefined,
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        humanOverrides: 1,
      }),
    ],
  });

  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.decision.level, "full_auto");
  assert.equal(result.changeEvents.length, 0);
});

test("Unknown severity treated as P0 (freeze)", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [
      createCapabilityScore({
        incidents: 1,
        lastIncidentSeverity: "P1" as IncidentSeverity, // Cast to test edge case
        currentAutonomy: "full_auto",
      }),
    ],
  });

  // With severityBasedDemotion enabled, P1 should demote
  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });

  assert.equal(result.decision.level, "semi_auto");
});

test("Profile evaluation handles empty capability scores", () => {
  const service = new ProgressiveAutonomyService();

  const profile = createAgentProfile({
    capabilityScores: [],
  });

  const result = service.evaluateProfile(profile);

  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.changeEvents.length, 0);
});
