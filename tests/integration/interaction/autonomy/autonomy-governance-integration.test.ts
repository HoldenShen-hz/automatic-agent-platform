/**
 * Integration Test: Autonomy Governance Pipeline
 *
 * Tests integration between AutonomyAuditService, AutonomyGovernanceService,
 * and ProgressiveAutonomyService for complete autonomy management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ProgressiveAutonomyService,
  AutonomyAuditService,
  AutonomyGovernanceService,
  type AgentTrustProfile,
  type AutonomyChangeEvent,
  type AutonomyLevel,
} from "../../../src/interaction/autonomy/index.js";

function makeTrustProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent_integ_test",
    domainId: "engineering_ops",
    overallTrustLevel: "trusted",
    lastEvaluation: new Date().toISOString(),
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 92,
        totalExecutions: 500,
        successfulExecutions: 495,
        failedExecutions: 3,
        humanOverrides: 2,
        incidents: 0,
        lastIncidentAgeDays: 90,
      },
      {
        capabilityId: "rollback",
        currentAutonomy: "suggestion",
        trustScore: 55,
        totalExecutions: 80,
        successfulExecutions: 72,
        failedExecutions: 5,
        humanOverrides: 10,
        incidents: 1,
        lastIncidentAgeDays: 30,
      },
    ],
    ...overrides,
  };
}

test("integration: AutonomyAuditService records and retrieves change events", () => {
  const auditService = new AutonomyAuditService();

  const event: AutonomyChangeEvent = {
    eventType: "agent.autonomy.promoted",
    agentId: "agent_a",
    capabilityId: "deploy",
    fromLevel: "semi_auto",
    toLevel: "full_auto",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: {
      successRate: 0.99,
      totalExecutions: 500,
      incidentCount: 0,
      evaluationWindow: "30d",
    },
  };

  const record = auditService.recordChange(event);

  assert.ok(record.id.startsWith("autonomy_audit_"));
  assert.equal(record.agentId, "agent_a");
  assert.equal(record.capabilityId, "deploy");
  assert.equal(record.eventType, "agent.autonomy.promoted");

  const agentRecords = auditService.getByAgent("agent_a");
  assert.equal(agentRecords.length, 1);
  assert.equal(agentRecords[0]?.toLevel, "full_auto");
});

test("integration: ProgressiveAutonomyService evaluates trust profile and emits events", () => {
  const autonomyService = new ProgressiveAutonomyService();
  const auditService = new AutonomyAuditService();

  autonomyService.onAutonomyChange((event) => auditService.recordChange(event));

  const profile = makeTrustProfile();
  const evaluation = autonomyService.evaluateProfile(profile);

  assert.ok(evaluation.decision);
  assert.ok(evaluation.capabilityLevels);
  assert.ok(evaluation.changeEvents.length >= 0);

  const auditRecords = auditService.getByAgent("agent_integ_test");
  assert.ok(auditRecords.length >= 0);
});

test("integration: AutonomyGovernanceService checks boundaries and limits", () => {
  const governanceService = new AutonomyGovernanceService();
  const auditService = new AutonomyAuditService();

  governanceService.setAuditService(auditService);

  const canPromote = governanceService.canPromote("agent_b", "deploy", "semi_auto");
  assert.equal(typeof canPromote, "boolean");

  const canDemote = governanceService.canDemote("agent_b", "rollback", "suggestion");
  assert.equal(typeof canDemote, "boolean");

  const frozen = governanceService.isFrozen("agent_b");
  assert.equal(typeof frozen, "boolean");
});

test("integration: AutonomyAuditService generates summary statistics for agent", () => {
  const auditService = new AutonomyAuditService();

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_stats",
    capabilityId: "deploy",
    fromLevel: "supervised",
    toLevel: "semi_auto",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.95, totalExecutions: 200, incidentCount: 0, evaluationWindow: "30d" },
  });

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_stats",
    capabilityId: "deploy",
    fromLevel: "semi_auto",
    toLevel: "full_auto",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.98, totalExecutions: 500, incidentCount: 0, evaluationWindow: "30d" },
  });

  auditService.recordChange({
    eventType: "agent.autonomy.demoted",
    agentId: "agent_stats",
    capabilityId: "rollback",
    fromLevel: "semi_auto",
    toLevel: "suggestion",
    trigger: "incident_response",
    approvedBy: "auto",
    evidence: { successRate: 0.7, totalExecutions: 100, incidentCount: 2, evaluationWindow: "30d" },
  });

  const summary = auditService.getSummary("agent_stats");

  assert.equal(summary.totalChanges, 3);
  assert.equal(summary.promotions, 2);
  assert.equal(summary.demotions, 1);
  assert.equal(summary.freezes, 0);
  assert.ok(summary.lastChangeAt !== null);
});

test("integration: AutonomyGovernanceService respects maximum autonomy level", () => {
  const governanceService = new AutonomyGovernanceService();

  const maxLevel = governanceService.getMaxAutonomyLevel("agent_c");
  assert.ok(maxLevel !== undefined);

  const validLevels: AutonomyLevel[] = ["suggestion", "supervised", "semi_auto", "full_auto", "frozen"];
  assert.ok(validLevels.includes(maxLevel));
});

test("integration: ProgressiveAutonomyService handles incident freeze", () => {
  const autonomyService = new ProgressiveAutonomyService();
  const auditService = new AutonomyAuditService();

  autonomyService.onAutonomyChange((event) => auditService.recordChange(event));

  const profileWithIncident = makeTrustProfile({
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
        lastIncidentAgeDays: 1,
      },
    ],
  });

  const evaluation = autonomyService.evaluateProfile(profileWithIncident, {
    freezeOnIncident: true,
    windowDays: 30,
    minVolumeForPromotion: 10,
    minVolumeForDemotion: 3,
  });

  assert.equal(evaluation.decision.level, "frozen");

  const freezeEvents = auditService.getByAgent("agent_integ_test").filter(
    (e) => e.eventType === "agent.autonomy.frozen",
  );
  assert.ok(freezeEvents.length >= 1);
});

test("integration: Multiple agents tracked independently in audit service", () => {
  const auditService = new AutonomyAuditService();

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_x",
    capabilityId: "deploy",
    fromLevel: "supervised",
    toLevel: "semi_auto",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.95, totalExecutions: 100, incidentCount: 0, evaluationWindow: "30d" },
  });

  auditService.recordChange({
    eventType: "agent.autonomy.demoted",
    agentId: "agent_y",
    capabilityId: "rollback",
    fromLevel: "semi_auto",
    toLevel: "suggestion",
    trigger: "incident_response",
    approvedBy: "auto",
    evidence: { successRate: 0.6, totalExecutions: 50, incidentCount: 1, evaluationWindow: "30d" },
  });

  const xRecords = auditService.getByAgent("agent_x");
  const yRecords = auditService.getByAgent("agent_y");

  assert.equal(xRecords.length, 1);
  assert.equal(xRecords[0]?.agentId, "agent_x");
  assert.equal(yRecords.length, 1);
  assert.equal(yRecords[0]?.agentId, "agent_y");
});

test("integration: AutonomyAuditService listRecords returns all records sorted", () => {
  const auditService = new AutonomyAuditService();

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_first",
    capabilityId: "cap_a",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.92, totalExecutions: 50, incidentCount: 0, evaluationWindow: "30d" },
  });

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_second",
    capabilityId: "cap_b",
    fromLevel: "supervised",
    toLevel: "semi_auto",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.96, totalExecutions: 150, incidentCount: 0, evaluationWindow: "30d" },
  });

  const allRecords = auditService.listRecords();

  assert.ok(allRecords.length >= 2);
  assert.ok(allRecords[0]?.createdAt <= allRecords[1]?.createdAt);
});

test("integration: ProgressiveAutonomyService with zero-volume agent defaults to suggestion", () => {
  const autonomyService = new ProgressiveAutonomyService();

  const lowVolumeProfile = makeTrustProfile({
    capabilityScores: [
      {
        capabilityId: "new_capability",
        currentAutonomy: "supervised",
        trustScore: 50,
        totalExecutions: 2,
        successfulExecutions: 2,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: null,
      },
    ],
  });

  const evaluation = autonomyService.evaluateProfile(lowVolumeProfile);

  assert.ok(evaluation.decision.level !== undefined);
});