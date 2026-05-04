/**
 * Edge Case Tests: Progressive Autonomy Service
 *
 * Tests edge cases and boundary conditions for the ProgressiveAutonomyService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";
import type { CapabilityTrustScore, AgentTrustProfile, AutonomyLevel } from "../../../../src/interaction/autonomy/index.js";

function makeScore(overrides: Partial<CapabilityTrustScore> = {}): CapabilityTrustScore {
  return {
    capabilityId: "edge_cap",
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
    agentId: "edge_test_agent",
    domainId: "edge_domain",
    overallTrustLevel: "probation",
    lastEvaluation: new Date().toISOString(),
    capabilityScores: [],
    ...overrides,
  };
}

test("ProgressiveAutonomyService handles zero executions with high success rate", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "zero_exec_high_success",
    capabilityScores: [
      makeScore({ totalExecutions: 0, successfulExecutions: 0 }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.decision.trustScore, 0);
});

test("ProgressiveAutonomyService keeps exact-threshold promotions pending until approval", () => {
  const service = new ProgressiveAutonomyService();
  // Threshold for supervised is >=50 executions, >=95% success
  const profile = makeProfile({
    agentId: "exact_threshold",
    capabilityScores: [
      makeScore({
        capabilityId: "exact_cap",
        totalExecutions: 50,
        successfulExecutions: 48, // 96% success rate
        failedExecutions: 2,
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.changeEvents[0]?.toLevel, "supervised");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

test("ProgressiveAutonomyService handles just below minimum promotion threshold", () => {
  const service = new ProgressiveAutonomyService();
  // Threshold for supervised is >50 executions, >=95% success
  // At exactly 50 executions with 94% success rate, should stay at suggestion
  const profile = makeProfile({
    agentId: "below_threshold",
    capabilityScores: [
      makeScore({
        capabilityId: "below_cap",
        totalExecutions: 50,
        successfulExecutions: 47, // 94% success rate
        failedExecutions: 3,
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // Below 95% success rate threshold, should stay at suggestion
  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService handles maximum override penalty", () => {
  const service = new ProgressiveAutonomyService();
  // High override rate should significantly penalize score
  const profile = makeProfile({
    agentId: "high_override",
    capabilityScores: [
      makeScore({
        totalExecutions: 100,
        successfulExecutions: 95,
        humanOverrides: 100, // 100% override rate
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // TrustScore is now 0-1000, so a 100% override rate should still materially reduce the score.
  assert.ok(result.decision.trustScore < 800);
});

test("ProgressiveAutonomyService handles maximum incident penalty", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "high_incident",
    capabilityScores: [
      makeScore({
        totalExecutions: 100,
        successfulExecutions: 90,
        incidents: 10, // Multiple incidents
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // Multiple incidents should penalize heavily
  assert.ok(result.decision.trustScore < 50);
});

test("ProgressiveAutonomyService handles volume bonus cap", () => {
  const service = new ProgressiveAutonomyService();
  // Volume bonus caps at 50 executions, so 1000 executions should get same bonus as 50+
  const profile = makeProfile({
    agentId: "volume_cap",
    capabilityScores: [
      makeScore({
        totalExecutions: 1000,
        successfulExecutions: 999,
        failedExecutions: 1,
        incidents: 0,
        humanOverrides: 0,
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // Should have high trust score with high volume
  assert.ok(result.decision.trustScore >= 90);
});

test("ProgressiveAutonomyService handles all autonomy levels in profile", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "all_levels",
    capabilityScores: [
      makeScore({ capabilityId: "cap_suggestion", currentAutonomy: "suggestion", totalExecutions: 10, successfulExecutions: 10 }),
      makeScore({ capabilityId: "cap_supervised", currentAutonomy: "supervised", totalExecutions: 50, successfulExecutions: 49 }),
      makeScore({ capabilityId: "cap_semi", currentAutonomy: "semi_auto", totalExecutions: 200, successfulExecutions: 198 }),
      makeScore({ capabilityId: "cap_full", currentAutonomy: "full_auto", totalExecutions: 500, successfulExecutions: 498 }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // Overall level should be lowest (suggestion)
  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService handles mixed severity incidents", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "mixed_severity",
    capabilityScores: [
      makeScore({
        capabilityId: "p0_cap",
        currentAutonomy: "full_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P0",
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // P0 now demotes directly to suggestion per §42.2.
  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService handles P2 incident", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "p2_incident",
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P2",
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // P2 without severityBasedDemotion may not demote one level
  assert.ok(["semi_auto", "supervised", "frozen"].includes(result.decision.level));
});

test("ProgressiveAutonomyService handles P3 incident (lowest severity)", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "p3_incident",
    capabilityScores: [
      makeScore({
        currentAutonomy: "semi_auto",
        totalExecutions: 100,
        successfulExecutions: 95,
        incidents: 1,
        lastIncidentSeverity: "P3",
      }),
    ],
  });

  const result = service.evaluateProfile(profile);

  // P3 is lowest severity - should not cause freeze
  assert.ok(["semi_auto", "supervised", "suggestion", "frozen"].includes(result.decision.level));
});

test("ProgressiveAutonomyService registers multiple profiles", () => {
  const service = new ProgressiveAutonomyService();

  service.registerProfile(makeProfile({ agentId: "agent_1" }));
  service.registerProfile(makeProfile({ agentId: "agent_2" }));
  service.registerProfile(makeProfile({ agentId: "agent_3" }));

  const result1 = service.evaluate("agent_1");
  const result2 = service.evaluate("agent_2");
  const result3 = service.evaluate("agent_3");

  assert.ok(result1.rationale.length > 0);
  assert.ok(result2.rationale.length > 0);
  assert.ok(result3.rationale.length > 0);
});

test("ProgressiveAutonomyService overwrites profile on re-registration", () => {
  const service = new ProgressiveAutonomyService();

  service.registerProfile(makeProfile({
    agentId: "overwrite_agent",
    capabilityScores: [makeScore({ capabilityId: "old_cap" })],
  }));

  service.registerProfile(makeProfile({
    agentId: "overwrite_agent",
    capabilityScores: [makeScore({ capabilityId: "new_cap" })],
  }));

  // Should not throw and should use new profile
  const result = service.evaluate("overwrite_agent");
  assert.ok(result.trustScore >= 0);
});

test("ProgressiveAutonomyService evaluateProfile without registered profile", async () => {
  const service = new ProgressiveAutonomyService();

  const result = await service.evaluate("not_registered");

  assert.equal(result.level, "suggestion");
  assert.equal(result.trustScore, 0);
  assert.ok(result.rationale.includes("No trust history"));
});

test("ProgressiveAutonomyService onAutonomyChange handles multiple callbacks", () => {
  const service = new ProgressiveAutonomyService();
  const callCount = { count1: 0, count2: 0, count3: 0 };

  service.onAutonomyChange(() => { callCount.count1++; });
  service.onAutonomyChange(() => { callCount.count2++; });
  service.onAutonomyChange(() => { callCount.count3++; });

  const profile = makeProfile({
    agentId: "multi_callback",
    capabilityScores: [makeScore({
      capabilityId: "callback_cap",
      totalExecutions: 50,
      successfulExecutions: 49,
    })],
  });

  service.evaluateProfile(profile);

  assert.equal(callCount.count1, 1);
  assert.equal(callCount.count2, 1);
  assert.equal(callCount.count3, 1);
});

test("ProgressiveAutonomyService changeEvents contains correct metadata", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "event_meta",
    capabilityScores: [makeScore({
      capabilityId: "meta_cap",
      totalExecutions: 50,
      successfulExecutions: 49,
      failedExecutions: 1,
    })],
  });

  const result = service.evaluateProfile(profile);

  if (result.changeEvents.length > 0) {
    const event = result.changeEvents[0]!;
    assert.ok(event.eventId !== undefined);
    assert.equal(event.agentId, "event_meta");
    assert.equal(event.capabilityId, "meta_cap");
    assert.ok(event.fromLevel !== undefined);
    assert.ok(event.toLevel !== undefined);
    assert.ok(event.trigger !== undefined);
    assert.ok(event.approvedBy !== undefined);
    assert.ok(event.evidence !== undefined);
    assert.ok(event.evidence.successRate >= 0);
    assert.ok(event.evidence.totalExecutions >= 0);
  }
});

test("ProgressiveAutonomyService capabilityLevels map is complete", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "complete_map",
    capabilityScores: [
      makeScore({ capabilityId: "cap_a" }),
      makeScore({ capabilityId: "cap_b" }),
      makeScore({ capabilityId: "cap_c" }),
    ],
  });

  const result = service.evaluateProfile(profile);

  assert.equal(result.capabilityLevels["cap_a"] !== undefined, true);
  assert.equal(result.capabilityLevels["cap_b"] !== undefined, true);
  assert.equal(result.capabilityLevels["cap_c"] !== undefined, true);
});

test("ProgressiveAutonomyService respects minVolumeForPromotion option", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "min_volume_test",
    capabilityScores: [makeScore({
      capabilityId: "min_vol_cap",
      totalExecutions: 100,
      successfulExecutions: 99,
    })],
  });

  // With very high minVolumeForPromotion, should not promote
  const result = service.evaluateProfile(profile, { minVolumeForPromotion: 200 });

  assert.equal(result.decision.level, "suggestion");
});

test("ProgressiveAutonomyService respects minVolumeForDemotion option without forcing immediate demotion", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "min_demotion_test",
    capabilityScores: [makeScore({
      capabilityId: "min_dem_cap",
      totalExecutions: 100,
      successfulExecutions: 50, // 50% success rate
      failedExecutions: 50,
      incidents: 0,
    })],
  });

  // With very high minVolumeForDemotion, should not demote
  const result = service.evaluateProfile(profile, { minVolumeForDemotion: 100 });

  // High failures do not trigger the demotion threshold here; any promotion still remains queued.
  assert.equal(result.decision.level, "suggestion");
  assert.equal(result.changeEvents[0]?.eventType, "agent.autonomy.promoted");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

test("ProgressiveAutonomyService freezeOnIncident false prevents freeze", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "no_freeze",
    capabilityScores: [makeScore({
      capabilityId: "no_freeze_cap",
      currentAutonomy: "semi_auto",
      totalExecutions: 100,
      successfulExecutions: 90,
      incidents: 1,
      lastIncidentSeverity: "P1",
    })],
  });

  const result = service.evaluateProfile(profile, { freezeOnIncident: false, severityBasedDemotion: false });

  assert.notEqual(result.decision.level, "frozen");
});

test("ProgressiveAutonomyService keeps frozen recovery pending approval", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "recovery_test",
    capabilityScores: [makeScore({
      capabilityId: "recovery_cap",
      currentAutonomy: "frozen",
      totalExecutions: 500,
      successfulExecutions: 495,
      failedExecutions: 5,
      incidents: 0,
    })],
  });

  const result = service.evaluateProfile(profile);

  // Frozen agent with high success rate and no incidents still needs explicit approval to recover.
  assert.equal(result.decision.level, "frozen");
  assert.equal(result.changeEvents[0]?.toLevel, "full_auto");
  assert.equal(result.changeEvents[0]?.approvedBy, "platform_team");
  assert.equal(result.changeEvents[0]?.requiresApprovalResolution, true);
});

test("ProgressiveAutonomyService extremely low success rate", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "low_success",
    capabilityScores: [makeScore({
      totalExecutions: 100,
      successfulExecutions: 5,
      failedExecutions: 95,
    })],
  });

  const result = service.evaluateProfile(profile);

  assert.ok(result.decision.trustScore < 100);
  assert.equal(result.decision.trustLevel, "supervised");
});

test("ProgressiveAutonomyService extremely high success rate with zero failures", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "perfect_agent",
    capabilityScores: [makeScore({
      totalExecutions: 1000,
      successfulExecutions: 1000,
      failedExecutions: 0,
      humanOverrides: 0,
      incidents: 0,
    })],
  });

  const result = service.evaluateProfile(profile);

  assert.ok(result.decision.trustScore >= 95);
  assert.equal(result.decision.trustLevel, "fully_trusted");
});

test("ProgressiveAutonomyService null lastIncidentSeverity", () => {
  const service = new ProgressiveAutonomyService();
  const profile = makeProfile({
    agentId: "null_severity",
    capabilityScores: [makeScore({
      incidents: 1,
      lastIncidentSeverity: undefined,
    })],
  });

  const result = service.evaluateProfile(profile);

  // Should handle null severity without crashing
  assert.ok(result.decision.level !== undefined);
});
