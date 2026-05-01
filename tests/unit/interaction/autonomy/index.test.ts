import assert from "node:assert/strict";
import test from "node:test";

import {
  ProgressiveAutonomyService,
  AutonomyAuditService,
  autonomyAuditService,
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
        currentAutonomy: "semi_auto",
        trustScore: 90,
        totalExecutions: 520,
        successfulExecutions: 520,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: 120,
      },
    ],
    ...overrides,
  };
}

test("ProgressiveAutonomyService promotes highly reliable capability to full_auto", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile());

  assert.equal(evaluation.decision.level, "full_auto");
  assert.equal(evaluation.decision.trustLevel, "fully_trusted");
  assert.equal(evaluation.capabilityLevels.deploy, "full_auto");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.promoted");
});

test("ProgressiveAutonomyService demotes risky capability to suggestion when freeze-on-incident is disabled", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 40,
        totalExecutions: 60,
        successfulExecutions: 50,
        failedExecutions: 5,
        humanOverrides: 8,
        incidents: 1,
        lastIncidentAgeDays: 1,
      },
    ],
  }), { freezeOnIncident: false });

  assert.equal(evaluation.decision.level, "suggestion");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.demoted");
});

test("ProgressiveAutonomyService returns untrusted suggestion for unknown subject", async () => {
  const service = new ProgressiveAutonomyService();
  const decision = await service.evaluate("missing_agent");

  assert.equal(decision.level, "suggestion");
  assert.equal(decision.trustLevel, "untrusted");
});

test("ProgressiveAutonomyService freezes on incident when freezeOnIncident is true", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
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
      },
    ],
  }), { freezeOnIncident: true, windowDays: 30 });

  assert.equal(evaluation.decision.level, "frozen");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.frozen");
});

test("ProgressiveAutonomyService preserves frozen state under P1 severity-based demotion", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "frozen",
        trustScore: 90,
        totalExecutions: 600,
        successfulExecutions: 594,
        failedExecutions: 1,
        humanOverrides: 0,
        incidents: 1,
        lastIncidentAgeDays: 1,
        lastIncidentSeverity: "P1",
      },
    ],
  }), { freezeOnIncident: true, severityBasedDemotion: true, windowDays: 30 });

  assert.equal(evaluation.decision.level, "frozen");
  assert.equal(evaluation.changeEvents.length, 0);
});

test("ProgressiveAutonomyService treats frozen as the lowest overall autonomy level when any capability remains frozen", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 90,
        totalExecutions: 600,
        successfulExecutions: 600,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: 120,
      },
      {
        capabilityId: "rollback",
        currentAutonomy: "frozen",
        trustScore: 90,
        totalExecutions: 600,
        successfulExecutions: 594,
        failedExecutions: 1,
        humanOverrides: 0,
        incidents: 1,
        lastIncidentAgeDays: 1,
        lastIncidentSeverity: "P1",
      },
    ],
  }), { freezeOnIncident: true, severityBasedDemotion: true });

  assert.equal(evaluation.capabilityLevels.deploy, "full_auto");
  assert.equal(evaluation.capabilityLevels.rollback, "frozen");
  assert.equal(evaluation.decision.level, "frozen");
});

test("ProgressiveAutonomyService does not freeze when freezeOnIncident is false", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
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
      },
    ],
  }), { freezeOnIncident: false, windowDays: 30 });

  assert.equal(evaluation.decision.level, "suggestion");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.demoted");
});

test("ProgressiveAutonomyService calls audit callback on level change", () => {
  const service = new ProgressiveAutonomyService();
  const capturedEvents: Array<{ eventType: string; agentId: string; capabilityId: string; fromLevel: string; toLevel: string; trigger: string; approvedBy: string; evidence: Record<string, unknown> }> = [];

  service.onAutonomyChange((event) => {
    capturedEvents.push(event);
  });

  service.evaluateProfile(makeProfile());

  assert.equal(capturedEvents.length, 1);
  assert.equal(capturedEvents[0]!.eventType, "agent.autonomy.promoted");
});

test("AutonomyAuditService records change events", () => {
  const auditService = new AutonomyAuditService();
  const autonomyService = new ProgressiveAutonomyService();

  autonomyService.onAutonomyChange((event) => {
    auditService.recordChange(event);
  });

  autonomyService.evaluateProfile(makeProfile());

  const records = auditService.getByAgent("agent_1");
  assert.equal(records.length, 1);
  assert.equal(records[0]!.eventType, "agent.autonomy.promoted");
});

test("AutonomyAuditService calculates summary correctly", () => {
  const auditService = new AutonomyAuditService();

  auditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "agent_test",
    capabilityId: "cap_1",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.95, totalExecutions: 100, incidentCount: 0, evaluationWindow: "30d" },
  });
  auditService.recordChange({
    eventType: "agent.autonomy.demoted",
    agentId: "agent_test",
    capabilityId: "cap_2",
    fromLevel: "supervised",
    toLevel: "suggestion",
    trigger: "incident_response",
    approvedBy: "auto",
    evidence: { successRate: 0.8, totalExecutions: 50, incidentCount: 2, evaluationWindow: "30d" },
  });

  const summary = auditService.getSummary("agent_test");
  assert.equal(summary.totalChanges, 2);
  assert.equal(summary.promotions, 1);
  assert.equal(summary.demotions, 1);
});

test("AutonomyAuditService singleton is accessible", () => {
  assert.ok(autonomyAuditService !== undefined);
  const record = autonomyAuditService.recordChange({
    eventType: "agent.autonomy.promoted",
    agentId: "singleton_test",
    capabilityId: "cap_1",
    fromLevel: "suggestion",
    toLevel: "supervised",
    trigger: "rule_engine",
    approvedBy: "auto",
    evidence: { successRate: 0.95, totalExecutions: 100, incidentCount: 0, evaluationWindow: "30d" },
  });
  assert.equal(record.agentId, "singleton_test");
});
