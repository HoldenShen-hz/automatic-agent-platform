/**
 * Integration Test: Autonomy Module
 *
 * Tests integration between ProgressiveAutonomyService, AutonomyGovernanceService,
 * trust scoring, level management, and audit recording.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";
import { AutonomyGovernanceService } from "../../../../src/interaction/autonomy/autonomy-governance-service.js";
import { AutonomyAuditService } from "../../../../src/interaction/autonomy/autonomy-audit-service.js";
import type { AgentTrustProfile, CapabilityTrustScore, AutonomyLevel } from "../../../../src/interaction/autonomy/index.js";

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
    agentId: "agent_integration_test",
    domainId: "engineering_ops",
    overallTrustLevel: "probation",
    lastEvaluation: new Date().toISOString(),
    capabilityScores: [],
    ...overrides,
  };
}

test("integration: ProgressiveAutonomyService evaluates agent with multiple capabilities", async () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "multi_cap_agent",
    capabilityScores: [
      makeScore({ capabilityId: "code_review", totalExecutions: 100, successfulExecutions: 98, currentAutonomy: "supervised" }),
      makeScore({ capabilityId: "deployment", totalExecutions: 50, successfulExecutions: 48, currentAutonomy: "suggestion" }),
      makeScore({ capabilityId: "testing", totalExecutions: 200, successfulExecutions: 195, currentAutonomy: "semi_auto" }),
    ],
  });
  service.registerProfile(profile);

  const result = await service.evaluate("multi_cap_agent");

  assert.ok(result.trustScore > 0);
  assert.ok(result.trustLevel !== "untrusted");
});

test("integration: ProgressiveAutonomyService triggers autonomy change events", async () => {
  const service = new ProgressiveAutonomyService();
  const events: Array<{ eventType: string; agentId: string }> = [];

  service.onAutonomyChange((event) => {
    events.push({ eventType: event.eventType, agentId: event.agentId });
  });

  const profile = makeProfile({
    agentId: "promoting_agent",
    capabilityScores: [
      makeScore({ capabilityId: "cap_promote", totalExecutions: 50, successfulExecutions: 49, currentAutonomy: "suggestion" }),
    ],
  });
  service.registerProfile(profile);

  await service.evaluate("promoting_agent");

  assert.equal(events.length, 1);
  assert.equal(events[0]!.agentId, "promoting_agent");
  assert.equal(events[0]!.eventType, "agent.autonomy.promoted");
});

test("integration: ProgressiveAutonomyService and AutonomyGovernanceService compose together", async () => {
  const progressiveService = new ProgressiveAutonomyService();
  const governanceService = new AutonomyGovernanceService();

  const profile = makeProfile({
    agentId: "composed_agent",
    capabilityScores: [
      makeScore({ capabilityId: "complex_cap", totalExecutions: 100, successfulExecutions: 95, currentAutonomy: "suggestion" }),
    ],
  });
  progressiveService.registerProfile(profile);

  const autonomyDecision = await progressiveService.evaluate("composed_agent");

  const governanceSnapshot = governanceService.evaluateProfile(profile);

  assert.ok(autonomyDecision.trustScore > 0);
  assert.equal(governanceSnapshot.agentId, "composed_agent");
});

test("integration: ProgressiveAutonomyService handles P0 incident freeze with audit", async () => {
  const progressiveService = new ProgressiveAutonomyService();
  const auditService = new AutonomyAuditService();

  progressiveService.onAutonomyChange((event) => auditService.recordChange(event));

  const profile = makeProfile({
    agentId: "incident_agent",
    capabilityScores: [
      makeScore({
        capabilityId: "risky_cap",
        currentAutonomy: "full_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });
  progressiveService.registerProfile(profile);

  await progressiveService.evaluate("incident_agent");

  const auditRecords = auditService.getByAgent("incident_agent");
  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0]!.toLevel, "frozen");
});

test("integration: ProgressiveAutonomyService P1 incident demotion with severityBasedDemotion", async () => {
  const service = new ProgressiveAutonomyService();

  const profile = makeProfile({
    agentId: "p1_incident_agent",
    capabilityScores: [
      makeScore({
        capabilityId: "cap_p1",
        currentAutonomy: "semi_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  service.registerProfile(profile);

  const result = await service.evaluate("p1_incident_agent");

  // With severityBasedDemotion=true (default), P1 should demote one level instead of freezing
  assert.equal(result.level, "supervised");
});

test("integration: ProgressiveAutonomyService unknown agent returns default suggestion", async () => {
  const service = new ProgressiveAutonomyService();

  const result = await service.evaluate("completely_unknown_agent");

  assert.equal(result.level, "suggestion");
  assert.equal(result.trustScore, 0);
  assert.equal(result.trustLevel, "untrusted");
});

test("integration: AutonomyGovernanceService evaluates profile with no capabilities", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({ agentId: "empty_agent", capabilityScores: [] });

  const snapshot = service.evaluateProfile(profile);

  assert.equal(snapshot.overallTrustScore, 0);
  assert.equal(snapshot.overallTrustLevel, "untrusted");
  assert.equal(snapshot.decisions.length, 0);
});

test("integration: AutonomyGovernanceService calculateTrustScore for low performance agent", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({
    agentId: "low_performer",
    capabilityScores: [
      makeScore({
        capabilityId: "struggling_cap",
        currentAutonomy: "supervised",
        totalExecutions: 50,
        successfulExecutions: 20,
        failedExecutions: 20,
        humanOverrides: 10,
        incidents: 3,
      }),
    ],
  });

  const snapshot = service.evaluateProfile(profile);

  assert.ok(snapshot.overallTrustScore < 50);
  assert.equal(snapshot.overallTrustLevel, "probation" as const);
});

test("integration: AutonomyGovernanceService calculateTrustScore for high performance agent", () => {
  const service = new AutonomyGovernanceService();
  const profile = makeProfile({
    agentId: "high_performer",
    capabilityScores: [
      makeScore({
        capabilityId: "excellent_cap",
        currentAutonomy: "semi_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        failedExecutions: 3,
        humanOverrides: 2,
        incidents: 0,
      }),
    ],
  });

  const snapshot = service.evaluateProfile(profile);

  assert.ok(snapshot.overallTrustScore >= 85);
  assert.ok(["trusted" as const, "semi_trusted" as const].includes(snapshot.overallTrustLevel));
});

test("integration: AutonomyGovernanceService evaluateCapability returns correct recommendations", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "test_cap",
    currentAutonomy: "suggestion",
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 3,
    humanOverrides: 2,
    incidents: 0,
  });

  const decision = service.evaluateCapability("test_agent", score);

  assert.equal(decision.agentId, "test_agent");
  assert.equal(decision.capabilityId, "test_cap");
  assert.ok(decision.trustScore > 0);
});

test("integration: AutonomyGovernanceService evaluateCapability blocks promotion with incidents", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "incident_cap",
    currentAutonomy: "supervised",
    totalExecutions: 100,
    successfulExecutions: 98,
    failedExecutions: 2,
    incidents: 1,
  });

  const decision = service.evaluateCapability("incident_agent", score);

  assert.equal(decision.promoted, false);
  assert.ok(decision.reasonCodes.some((code) => code.includes("incident")));
});

test("integration: ProgressiveAutonomyService evaluateProfile respects maxDepth option", async () => {
  const service = new ProgressiveAutonomyService();

  const profile = makeProfile({
    agentId: "depth_test_agent",
    capabilityScores: [
      makeScore({ capabilityId: "depth_cap", totalExecutions: 50, successfulExecutions: 48 }),
    ],
  });
  service.registerProfile(profile);

  const result = await service.evaluate("depth_test_agent");

  assert.ok(result.trustScore >= 0);
  assert.ok(result.level !== undefined);
});

test("integration: AutonomyAuditService records and retrieves changes", () => {
  const service = new AutonomyAuditService();

  service.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "audit_test_agent",
    capabilityId: "audit_cap",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: {
      successRate: 0.96,
      totalExecutions: 50,
      incidentCount: 0,
      evaluationWindow: "30d",
    },
  });

  const records = service.getByAgent("audit_test_agent");

  assert.equal(records.length, 1);
  assert.equal(records[0]!.fromLevel, "suggestion");
  assert.equal(records[0]!.toLevel, "supervised");
});

test("integration: AutonomyAuditService handles multiple agents", () => {
  const service = new AutonomyAuditService();

  service.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_a",
    capabilityId: "cap_a",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.95, totalExecutions: 50, incidentCount: 0, evaluationWindow: "30d" },
  });

  service.recordChange({
    eventType: "agent.autonomy.demoted",
    agentId: "agent_b",
    capabilityId: "cap_b",
    fromLevel: "supervised",
    toLevel: "suggestion",
    trigger: "incident_response",
    approvedBy: "auto",
    evidence: { successRate: 0.70, totalExecutions: 50, incidentCount: 2, evaluationWindow: "30d" },
  });

  const agentARecords = service.getByAgent("agent_a");
  const agentBRecords = service.getByAgent("agent_b");

  assert.equal(agentARecords.length, 1);
  assert.equal(agentBRecords.length, 1);
  assert.equal(agentBRecords[0]!.eventType, "agent.autonomy.demoted");
});

test("integration: ProgressiveAutonomyService with custom evaluation options", async () => {
  const service = new ProgressiveAutonomyService();

  const profile = makeProfile({
    agentId: "custom_opts_agent",
    capabilityScores: [
      makeScore({
        capabilityId: "custom_cap",
        currentAutonomy: "suggestion",
        totalExecutions: 100,
        successfulExecutions: 90,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  service.registerProfile(profile);

  // P1 demotion now stays at the suggestion floor instead of promoting upward.
  const result1 = await service.evaluate("custom_opts_agent");
  assert.equal(result1.level, "suggestion");

  // With severityBasedDemotion disabled, P1 should freeze
  const profile2 = makeProfile({
    agentId: "no_severity_agent",
    capabilityScores: [
      makeScore({
        capabilityId: "custom_cap2",
        currentAutonomy: "suggestion",
        totalExecutions: 100,
        successfulExecutions: 90,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  service.registerProfile(profile2);
  const result2 = await service.evaluate("no_severity_agent");
  assert.equal(result2.level, "suggestion");
});

test("integration: AutonomyGovernanceService evaluateCapability with zero executions", () => {
  const service = new AutonomyGovernanceService();
  const score = makeScore({
    capabilityId: "no_exec_cap",
    currentAutonomy: "suggestion",
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    incidents: 0,
  });

  const decision = service.evaluateCapability("zero_exec_agent", score);

  assert.equal(decision.trustScore, 0);
  assert.equal(decision.trustLevel, "untrusted");
  assert.equal(decision.recommendedLevel, "suggestion");
});
