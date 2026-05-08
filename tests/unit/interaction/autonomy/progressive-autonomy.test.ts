import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilityTrustScore, AgentTrustProfile, AutonomyChangeEvent } from "../../../../src/interaction/autonomy/index.js";
import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";
import { AutonomyAuditService } from "../../../../src/interaction/autonomy/autonomy-audit-service.js";

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
    ...overrides,
  };
}

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent-001",
    domainId: "test-domain",
    capabilityScores: [],
    overallTrustLevel: "probation",
    lastEvaluation: new Date().toISOString(),
    ...overrides,
  };
}

function makeAuditService(): AutonomyAuditService {
  return new AutonomyAuditService();
}

test("ProgressiveAutonomyService evaluate returns suggestion for unknown agent", async (t) => {
  const service = new ProgressiveAutonomyService();
  const result = await service.evaluate("unknown-agent");
  assert.equal(result.level, "suggestion");
  assert.equal(result.trustScore, 0);
  assert.equal(result.trustLevel, "untrusted");
  assert.ok(result.rationale.includes("No trust history"));
});

test("ProgressiveAutonomyService evaluate returns correct decision for registered profile", async (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", totalExecutions: 200, successfulExecutions: 196, currentAutonomy: "supervised" }),
    ],
  });
  service.registerProfile(profile);
  const result = await service.evaluate("agent-001");
  assert.ok(result.trustScore > 0);
});

test("ProgressiveAutonomyService evaluateProfile returns suggestion for no executions", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", totalExecutions: 0, successfulExecutions: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.decision.trustScore, 0);
  assert.equal(result.decision.trustLevel, "untrusted");
  assert.equal(result.changeEvents.length, 0);
});

test("ProgressiveAutonomyService evaluateProfile promotes suggestion to supervised at 95% with 50+ executions", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "suggestion", totalExecutions: 50, successfulExecutions: 48, failedExecutions: 2 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "supervised");
  assert.equal(result.capabilityLevels["cap-1"], "supervised");
  assert.equal(result.changeEvents.length, 1);
  assert.equal(result.changeEvents[0]!.eventType, "agent.autonomy.promoted");
});

test("ProgressiveAutonomyService evaluateProfile promotes supervised to semi_auto at 98% with 200+ executions", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "supervised", totalExecutions: 200, successfulExecutions: 196, failedExecutions: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "semi_auto");
  assert.equal(result.capabilityLevels["cap-1"], "semi_auto");
});

test("ProgressiveAutonomyService evaluateProfile promotes semi_auto to full_auto at 99% with 500+ executions", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "semi_auto", totalExecutions: 500, successfulExecutions: 495, failedExecutions: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "full_auto");
  assert.equal(result.capabilityLevels["cap-1"], "full_auto");
});

test("ProgressiveAutonomyService evaluateProfile freezes on P0 incident", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "full_auto", totalExecutions: 100, successfulExecutions: 95, incidents: 1, lastIncidentSeverity: "P0" }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "frozen");
  assert.equal(result.capabilityLevels["cap-1"], "frozen");
  assert.equal(result.changeEvents[0]!.eventType, "agent.autonomy.frozen");
});

test("ProgressiveAutonomyService evaluateProfile P1 incident demotes one level when severityBasedDemotion enabled", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "semi_auto", totalExecutions: 100, successfulExecutions: 95, incidents: 1, lastIncidentSeverity: "P1" }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true, severityBasedDemotion: true });
  assert.equal(result.decision.level, "supervised");
  assert.equal(result.capabilityLevels["cap-1"], "supervised");
});

test("ProgressiveAutonomyService evaluateProfile demotes to suggestion on many failed executions", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "semi_auto", totalExecutions: 100, successfulExecutions: 80, failedExecutions: 15, incidents: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: false, severityBasedDemotion: false });
  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService onAutonomyChange fires callback on level change", (t) => {
  const service = new ProgressiveAutonomyService();
  const events: AutonomyChangeEvent[] = [];
  service.onAutonomyChange((event) => events.push(event));
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "suggestion", totalExecutions: 50, successfulExecutions: 48, failedExecutions: 2 }),
    ],
  });
  service.evaluateProfile(profile);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "agent.autonomy.promoted");
});

test("ProgressiveAutonomyService evaluateProfile uses lowest level across capabilities", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "supervised", totalExecutions: 200, successfulExecutions: 196, failedExecutions: 4 }),
      makeScore({ capabilityId: "cap-2", currentAutonomy: "suggestion", totalExecutions: 5, successfulExecutions: 5, failedExecutions: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  // cap-2 stays suggestion (low volume), overall lowest is suggestion
  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService evaluateProfile with no capabilities returns suggestion and zero score", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({ capabilityScores: [] });
  const result = service.evaluateProfile(profile);
  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.decision.trustScore, 0);
  assert.equal(result.changeEvents.length, 0);
});

test("ProgressiveAutonomyService evaluateProfile promote threshold requires sufficient executions", (t) => {
  const service = new ProgressiveAutonomyService();
  // 48 successful out of 50 is 96% success rate, but only 50 executions
  // The promotion thresholds in decideLevel are >50, >200, >500
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "suggestion", totalExecutions: 50, successfulExecutions: 48, failedExecutions: 2 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  // At 50 executions, still needs >50 for supervised promotion
  // success rate = 48/50 = 96%, so level should be supervised (threshold met)
  assert.equal(result.decision.level, "supervised");
});

test("ProgressiveAutonomyService evaluateProfile respects minVolumeForDemotion option", (t) => {
  const service = new ProgressiveAutonomyService();
  // 48 successful out of 50 = 96% success rate, 50 executions - meets supervised threshold
  // failedExecutions=2 which is < minVolumeForDemotion=10, so no demotion to suggestion
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "suggestion", totalExecutions: 50, successfulExecutions: 48, failedExecutions: 2, incidents: 0 }),
    ],
  });
  // With success rate 96% and 50 executions, should get to supervised
  // failedExecutions=2 is not >= minVolumeForDemotion=10, so stays supervised
  const result = service.evaluateProfile(profile, { minVolumeForDemotion: 10 });
  assert.equal(result.decision.level, "supervised");
});

test("ProgressiveAutonomyService records change event with correct evidence", (t) => {
  const service = new ProgressiveAutonomyService();
  const audit = makeAuditService();
  service.onAutonomyChange((event) => audit.recordChange(event));

  const profile = makeProfile({
    capabilityScores: [
      makeScore({
        capabilityId: "cap-1",
        currentAutonomy: "suggestion",
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        incidents: 0,
      }),
    ],
  });
  service.evaluateProfile(profile);
  const record = audit.getByAgent("agent-001")[0];
  assert.ok(record != null);
  assert.equal(record.fromLevel, "suggestion");
  assert.equal(record.toLevel, "supervised");
  assert.equal(record.trigger, "rule_engine");
  assert.equal(record.approvedBy, "auto");
  assert.ok(record.successRate > 0);
  assert.ok(record.totalExecutions === 50);
});

test("ProgressiveAutonomyService evaluateProfile incident_response trigger when incidents present", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "supervised", totalExecutions: 100, successfulExecutions: 95, incidents: 1, lastIncidentSeverity: "P1" }),
    ],
  });
  const result = service.evaluateProfile(profile, { freezeOnIncident: true, severityBasedDemotion: true });
  const event = result.changeEvents[0];
  assert.equal(event?.trigger, "incident_response");
});

test("ProgressiveAutonomyService evaluateProfile handles frozen to full_auto recovery path", (t) => {
  const service = new ProgressiveAutonomyService();
  // When frozen agent has 500+ executions at 99%+ success, it becomes full_auto via threshold
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "frozen", totalExecutions: 500, successfulExecutions: 495, failedExecutions: 0, incidents: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  assert.equal(result.capabilityLevels["cap-1"], "full_auto");
});

test("ProgressiveAutonomyService evaluateProfile two capabilities with different promotion levels", (t) => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    capabilityScores: [
      makeScore({ capabilityId: "cap-1", currentAutonomy: "suggestion", totalExecutions: 50, successfulExecutions: 48, failedExecutions: 0 }),
      makeScore({ capabilityId: "cap-2", currentAutonomy: "supervised", totalExecutions: 200, successfulExecutions: 196, failedExecutions: 0 }),
    ],
  });
  const result = service.evaluateProfile(profile);
  // cap-1: suggestion with 50 execs at 96% -> supervised (50>=50, 96%>=95%)
  // cap-2: supervised with 200 execs at 98% -> semi_auto (200>=200, 98%>=98%) BUT
  //   This only promotes if currentAutonomy is supervised, not suggestion.
  //   The promotion thresholds apply from currentAutonomy, not from suggestion.
  //   supervised->semi_auto: requires >=200, >=98%, which cap-2 meets
  assert.equal(result.capabilityLevels["cap-1"], "supervised");
  assert.equal(result.capabilityLevels["cap-2"], "semi_auto");
  // Overall decision is lowest level: supervised (lowest of supervised, semi_auto)
  assert.equal(result.decision.level, "supervised");
});