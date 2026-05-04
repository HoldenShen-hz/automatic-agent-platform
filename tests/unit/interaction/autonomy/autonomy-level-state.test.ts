/**
 * Unit Tests: Autonomy Level State
 *
 * Tests autonomy level state transitions, safety boundaries for full_auto mode,
 * incident severity handling, and state machine behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";
import { AutonomyAuditService } from "../../../../src/interaction/autonomy/autonomy-audit-service.js";
import type {
  AgentTrustProfile,
  CapabilityTrustScore,
  AutonomyLevel,
  AutonomyChangeEvent,
} from "../../../../src/interaction/autonomy/index.js";

function makeScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "test-capability",
    currentAutonomy: "suggestion",
    trustScore: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    humanOverrides: 0,
    incidents: 0,
    lastIncidentAgeDays: null,
    lastIncidentSeverity: undefined,
    costOverruns: 0,
    lastExecutionAgeDays: null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "test-agent",
    domainId: "test-domain",
    overallTrustLevel: "probation",
    lastEvaluation: new Date().toISOString(),
    capabilityScores: [],
    ...overrides,
  };
}

// ============ Safety Boundary Tests ============

test("full_auto promotions are queued behind platform_team approval", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 500,
        successfulExecutions: 500, // 100%
        failedExecutions: 0,
        incidents: 0,
        lastIncidentAgeDays: 100,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "semi_auto");
  assert.equal(result.changeEvents[0]?.toLevel, "full_auto");
  assert.equal(result.changeEvents[0]?.approvedBy, "platform_team");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

test("full_auto blocked with less than 500 executions", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 499,
        successfulExecutions: 495,
        failedExecutions: 4,
        incidents: 0,
        lastIncidentAgeDays: 100,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.notEqual(result.decision.level, "full_auto");
});

test("full_auto blocked with success rate below 99%", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 500,
        successfulExecutions: 494, // 98.8% < 99%
        failedExecutions: 6,
        incidents: 0,
        lastIncidentAgeDays: 100,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.notEqual(result.decision.level, "full_auto");
});

test("full_auto requires 90+ incident-free days", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 500,
        successfulExecutions: 497,
        failedExecutions: 3,
        incidents: 0,
        lastIncidentAgeDays: 89, // Just below threshold
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  // Should not reach full_auto without 90+ incident-free days
  assert.notEqual(result.decision.level, "full_auto");
});

test("semi_auto promotions are queued behind domain_owner approval", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "supervised",
        totalExecutions: 200,
        successfulExecutions: 200,
        failedExecutions: 0,
        incidents: 0,
        lastIncidentAgeDays: 60,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "supervised");
  assert.equal(result.changeEvents[0]?.toLevel, "semi_auto");
  assert.equal(result.changeEvents[0]?.approvedBy, "domain_owner");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

test("supervised promotions are queued behind domain_owner approval", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48, // 96%
        failedExecutions: 2,
        incidents: 0,
        lastIncidentAgeDays: 30,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.changeEvents[0]?.toLevel, "supervised");
  assert.equal(result.changeEvents[0]?.approvedBy, "domain_owner");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

// ============ P0 Suggestion-Demotion Behavior Tests ============

test("P0 incident immediately demotes agent to suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 1000,
        successfulExecutions: 995,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  assert.equal(result.decision.level, "suggestion");
});

test("P0 incident demotes to suggestion regardless of current autonomy level", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 10,
        successfulExecutions: 9,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  assert.equal(result.decision.level, "suggestion");
});

// ============ P1 Severity-Based Demotion Tests ============

test("P1 incident demotes one level when severityBasedDemotion is enabled", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });
  assert.equal(result.decision.level, "semi_auto");
});

test("P1 incident demotes from semi_auto to supervised", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 200,
        successfulExecutions: 196,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });
  assert.equal(result.decision.level, "supervised");
});

test("P1 incident demotes from supervised to suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "supervised",
        totalExecutions: 50,
        successfulExecutions: 48,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });
  assert.equal(result.decision.level, "suggestion");
});

test("P1 incident at suggestion level stays at suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        incidents: 1,
        lastIncidentSeverity: "P1",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, {
    freezeOnIncident: true,
    severityBasedDemotion: true,
  });
  assert.equal(result.decision.level, "suggestion");
});

// ============ Incident Severity Order Tests ============

test("all incident severities are handled correctly", () => {
  const service = new ProgressiveAutonomyService();
  const severities: Array<{ severity: "P0" | "P1" | "P2" | "P3"; expectedBehavior: AutonomyLevel }> = [
    { severity: "P0", expectedBehavior: "suggestion" },
    { severity: "P1", expectedBehavior: "supervised" }, // demotes one from semi_auto
    { severity: "P2", expectedBehavior: "frozen" }, // will freeze unless severityBasedDemotion applies
    { severity: "P3", expectedBehavior: "frozen" }, // will freeze unless severityBasedDemotion applies
  ];

  for (const { severity, expectedBehavior } of severities) {
    const profile = makeProfile({
      agentId: `severity-test-${severity}`,
      capabilityScores: [
        makeScore({
          capabilityId: `cap-${severity}`,
          currentAutonomy: "semi_auto",
          totalExecutions: 200,
          successfulExecutions: 196,
          incidents: 1,
          lastIncidentSeverity: severity,
        }),
      ],
    });
    const result = service.evaluateProfile(profile, { freezeOnIncident: true, severityBasedDemotion: true });
    assert.equal(
      result.decision.level,
      expectedBehavior,
      `Severity ${severity} should result in ${expectedBehavior}`,
    );
  }
});

// ============ State Transition Event Tests ============

test("promotion generates agent.autonomy.promoted event", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0]!.eventType, "agent.autonomy.promoted");
  assert.equal(result.changeEvents[0]!.fromLevel, "suggestion");
  assert.equal(result.changeEvents[0]!.toLevel, "supervised");
});

test("demotion generates agent.autonomy.demoted event", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 100,
        successfulExecutions: 90,
        failedExecutions: 8,
        incidents: 2,
        lastIncidentSeverity: "P2",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: false });
  const demotionEvent = result.changeEvents.find((e) => e.eventType === "agent.autonomy.demoted");
  assert.ok(demotionEvent !== undefined);
});

test("P2 incident with freezeOnIncident generates agent.autonomy.frozen event", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        incidents: 1,
        lastIncidentSeverity: "P2",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0]!.eventType, "agent.autonomy.frozen");
});

test("change event contains correct trigger for incident_response", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  assert.equal(result.changeEvents[0]!.trigger, "incident_response");
});

test("change event contains correct trigger for rule_engine", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.changeEvents[0]!.trigger, "rule_engine");
});

// ============ Cost Overrun Tests ============

test("cost overrun at 200% demotes to supervised", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        costOverruns: 2.0,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "supervised");
});

test("any cost overrun presence demotes to supervised", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        costOverruns: 1.5,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "supervised");
});

// ============ 180 Day Inactivity Tests ============

test("180+ days without execution demotes to suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        lastExecutionAgeDays: 200,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "suggestion");
});

test("less than 180 days no execution maintains level", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        lastExecutionAgeDays: 179,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  // Should still reach full_auto since lastExecutionAgeDays < 180
  assert.equal(result.decision.level, "full_auto");
});

// ============ Audit Callback Tests ============

test("onAutonomyChange callback is invoked on level change", () => {
  const service = new ProgressiveAutonomyService();
  const events: AutonomyChangeEvent[] = [];
  service.onAutonomyChange((event) => events.push(event));

  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  service.evaluateProfile(profile);

  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "agent.autonomy.promoted");
});

test("onAutonomyChange callback receives complete event data", () => {
  const service = new ProgressiveAutonomyService();
  let capturedEvent: AutonomyChangeEvent | null = null;
  service.onAutonomyChange((event) => { capturedEvent = event; });

  const profile = makeProfile({
    agentId: "audit-capture-agent",
    capabilityScores: [
      makeScore({
        capabilityId: "audit-capture-cap",
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  service.evaluateProfile(profile);

  assert.ok(capturedEvent !== null);
  assert.equal(capturedEvent!.agentId, "audit-capture-agent");
  assert.equal(capturedEvent!.capabilityId, "audit-capture-cap");
  assert.ok(capturedEvent!.eventId !== undefined);
  assert.ok(capturedEvent!.fromLevel !== undefined);
  assert.ok(capturedEvent!.toLevel !== undefined);
  assert.ok(capturedEvent!.evidence !== undefined);
});

// ============ Impact Report Tests ============

test("impact report is generated on level change", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.impactReports.length, 1);
});

test("impact report contains correct change information", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  const report = result.impactReports[0]!;
  assert.equal(report.fromLevel, "suggestion");
  assert.equal(report.toLevel, "supervised");
  assert.ok(report.activeRunsImpact !== undefined);
  assert.ok(report.slaImpact !== undefined);
  assert.ok(report.approvalQueueImpact !== undefined);
  assert.ok(report.budgetImpact !== undefined);
  assert.ok(report.businessOwnerAction !== undefined);
});

test("full_auto to lower level generates broad activeRunsImpact", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  const report = result.impactReports[0]!;
  assert.equal(report.activeRunsImpact, "broad");
});

test("frozen level generates immediate_pause businessOwnerAction", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        incidents: 1,
        lastIncidentSeverity: "P2",
      }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true });
  const report = result.impactReports[0]!;
  assert.equal(report.businessOwnerAction, "immediate_pause");
});

// ============ Multi-Capability State Tests ============

test("overall level is lowest of all capabilities", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        capabilityId: "high-cap",
        currentAutonomy: "full_auto",
        totalExecutions: 500,
        successfulExecutions: 495,
        incidents: 0,
      }),
      makeScore({
        capabilityId: "low-cap",
        currentAutonomy: "suggestion",
        totalExecutions: 10,
        successfulExecutions: 10,
        incidents: 0,
      }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "suggestion");
});

test("capabilityLevels map contains all capabilities", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-a" }),
      makeScore({ capabilityId: "cap-b" }),
      makeScore({ capabilityId: "cap-c" }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.ok(result.capabilityLevels["cap-a"] !== undefined);
  assert.ok(result.capabilityLevels["cap-b"] !== undefined);
  assert.ok(result.capabilityLevels["cap-c"] !== undefined);
});
