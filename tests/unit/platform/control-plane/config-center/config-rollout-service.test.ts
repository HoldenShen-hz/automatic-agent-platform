/**
 * Unit tests for ConfigRolloutService
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRolloutService,
  RolloutPhase,
  ConfigRollout,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";

// Manual mock event bus
interface MockEventBus {
  publish: (event: { eventType: string; payload: Record<string, unknown> }) => void;
  getEvents: () => Array<{ eventType: string; payload: Record<string, unknown> }>;
}

function createMockEventBus(): MockEventBus {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  return {
    publish(event: { eventType: string; payload: Record<string, unknown> }) {
      events.push(event);
    },
    getEvents() {
      return events;
    },
  };
}

test("startRollout creates a new rollout with default stages", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  assert.ok(rollout.rolloutId);
  assert.equal(rollout.configPath, "runtime.timeout");
  assert.equal(rollout.layer, "platform");
  assert.equal(rollout.sourceId, null);
  assert.ok(rollout.startedAt);
  assert.ok(rollout.updatedAt);
});

test("startRollout begins 100 percent rollouts at canary instead of skipping directly to full", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(rollout.currentPercentage, 5);
  assert.equal(rollout.targetPercentage, 100);
});

test("startRollout starts at CANARY_5 for target below 25%", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(rollout.currentPercentage, 5);
});

test("startRollout starts at CANARY_25 for target between 5 and 25", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 10);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_25);
  assert.equal(rollout.currentPercentage, 25);
});

test("startRollout starts at HALF for target between 25 and 50", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 40);

  assert.equal(rollout.stage.phase, RolloutPhase.HALF);
  assert.equal(rollout.currentPercentage, 50);
});

test("startRollout emits config.rollout.started event with event bus", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null);

  const events = mockBus.getEvents();
  assert.equal(events.length, 1);
  const event = events[0];
  assert.ok(event, "First event should exist");
  assert.equal(event.eventType, "config.rollout.started");
  assert.equal(event.payload.rolloutId, rollout.rolloutId);
  assert.equal(event.payload.configPath, "runtime.timeout");
});

test("startRollout does not emit event when eventBus is null", () => {
  const service = new ConfigRolloutService({ eventBus: null });

  service.startRollout("runtime.timeout", "platform", null);

  // No error means success - event bus is null so no event emitted
});

test("startRollout rejects out-of-range health gate values", () => {
  const service = new ConfigRolloutService();

  assert.throws(
    () => service.startRollout("runtime.timeout", "platform", null, 100, undefined, {
      maxErrorRate: 999,
    }),
    /config_rollout\.invalid_health_gate:maxErrorRate/,
  );
});

test("shouldApplyConfig returns shouldApply:true when no active rollout", () => {
  const service = new ConfigRolloutService();
  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, true);
  assert.equal(decision.rolloutId, null);
  assert.equal(decision.reason, "no_active_rollout");
});

test("shouldApplyConfig returns shouldApply:false for PENDING rollout", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null, 0);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, false);
  assert.equal(decision.reason, "rollout_pending");
});

test("shouldApplyConfig returns shouldApply:false for CANCELLED rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);
  service.cancelRollout(rollout.rolloutId);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.equal(decision.shouldApply, false);
  assert.equal(decision.reason, "rollout_cancelled");
});

test("shouldApplyConfig applies config based on hash percentage", () => {
  const service = new ConfigRolloutService();
  // Start at CANARY_5 and then promote to FULL so all hashes will match
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);
  service.promoteRollout(rollout.rolloutId);
  service.promoteRollout(rollout.rolloutId);
  service.promoteRollout(rollout.rolloutId);

  // With 100%, all hashes should be below percentage
  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "any-hash");

  assert.equal(decision.shouldApply, true);
  assert.equal(decision.rolloutId, rollout.rolloutId);
});

test("promoteRollout advances to next stage", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

  const promoted = service.promoteRollout(rollout.rolloutId);

  assert.ok(promoted);
  assert.equal(promoted!.stage.phase, RolloutPhase.CANARY_25);
  assert.equal(promoted!.currentPercentage, 25);
});

test("promoteRollout emits config.rollout.promoted event", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);
  mockBus.getEvents().length = 0; // Clear start event

  service.promoteRollout(rollout.rolloutId);

  const events = mockBus.getEvents();
  assert.ok(events.some(e => e.eventType === "config.rollout.promoted"));
});

test("promoteRollout returns null for non-existent rollout", () => {
  const service = new ConfigRolloutService();
  const result = service.promoteRollout("non-existent-id");

  assert.equal(result, null);
});

test("promoteRollout from FULL remains at FULL terminal stage", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);
  service.promoteRollout(rollout.rolloutId);
  service.promoteRollout(rollout.rolloutId);
  const full = service.promoteRollout(rollout.rolloutId);
  assert.equal(full?.stage.phase, RolloutPhase.FULL);

  const promoted = service.promoteRollout(rollout.rolloutId);

  assert.ok(promoted);
  assert.equal(promoted!.stage.phase, RolloutPhase.FULL);
});

test("cancelRollout cancels the rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  const cancelled = service.cancelRollout(rollout.rolloutId);

  assert.ok(cancelled);
  assert.equal(cancelled!.stage.phase, RolloutPhase.CANCELLED);
});

test("cancelRollout emits config.rollout.cancelled event", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null);
  mockBus.getEvents().length = 0; // Clear start event

  service.cancelRollout(rollout.rolloutId);

  const events = mockBus.getEvents();
  assert.ok(events.some(e => e.eventType === "config.rollout.cancelled"));
});

test("cancelRollout returns null for non-existent rollout", () => {
  const service = new ConfigRolloutService();
  const result = service.cancelRollout("non-existent-id");

  assert.equal(result, null);
});

test("getActiveRollout returns correct rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", "tenant-1");

  const found = service.getActiveRollout("runtime.timeout", "platform", "tenant-1");

  assert.ok(found);
  assert.equal(found!.rolloutId, rollout.rolloutId);
});

test("getActiveRollout returns null for non-existent", () => {
  const service = new ConfigRolloutService();
  const found = service.getActiveRollout("non.existent", "platform", null);

  assert.equal(found, null);
});

test("getActiveRollout returns null when sourceId does not match", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", "tenant-1");

  const found = service.getActiveRollout("runtime.timeout", "platform", "tenant-2");

  assert.equal(found, null);
});

test("getActiveRollouts returns all active rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("config.1", "platform", null);
  service.startRollout("config.2", "tenant", "tenant-1");

  const rollouts = service.getActiveRollouts();

  assert.equal(rollouts.length, 2);
});

test("autoProgressRollouts does not auto-progress terminal full stage", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);
  rollout.stage = { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false };

  // FULL stage has autoProgress: false
  const progressed = service.autoProgressRollouts();

  assert.equal(progressed, 0);
});

test("autoProgressRollouts blocks promotion when no health snapshot is available", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);
  rollout.updatedAt = new Date(Date.now() - rollout.stage.minDurationMs - 1000).toISOString();

  const progressed = service.autoProgressRollouts();
  const current = service.getActiveRollout("runtime.timeout", "platform", null);

  assert.equal(progressed, 0);
  assert.equal(current?.stage.phase, RolloutPhase.CANARY_5);
  assert.equal(current?.lastHealthCheckPassed, false);
});

test("cleanupRollouts removes old completed rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  // Manually set to FULL and old
  rollout.stage = { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false };
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago

  const cleaned = service.cleanupRollouts(86400000); // 24 hours

  assert.equal(cleaned, 1);
  assert.equal(service.getActiveRollouts().length, 0);
});

test("cleanupRollouts removes old cancelled rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);
  const cancelled = service.cancelRollout(rollout.rolloutId)!;

  // Manually set updatedAt to old
  cancelled.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago

  const cleaned = service.cleanupRollouts(86400000);

  assert.equal(cleaned, 1);
  assert.equal(service.getActiveRollouts().length, 0);
});

test("cleanupRollouts keeps recent rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null);

  const cleaned = service.cleanupRollouts(86400000);

  assert.equal(cleaned, 0);
  assert.equal(service.getActiveRollouts().length, 1);
});

test("cleanupRollouts does not remove PENDING rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 0);

  // Manually set updatedAt to old
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString();

  const cleaned = service.cleanupRollouts(86400000);

  assert.equal(cleaned, 0); // PENDING rollouts are not cleaned up
  assert.equal(service.getActiveRollouts().length, 1);
});

test("autoProgressRollouts respects health gates before promoting rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);
  rollout.updatedAt = new Date(Date.now() - rollout.stage.minDurationMs - 1000).toISOString();

  const blocked = service.autoProgressRollouts({
    [rollout.rolloutId]: {
      errorRate: 0.08,
      latencyRegression: 0.1,
      incidentRate: 0.01,
    },
  });

  assert.equal(blocked, 0);
  assert.equal(service.getActiveRollout("runtime.timeout", "platform", null)?.stage.phase, RolloutPhase.CANARY_5);

  const progressed = service.autoProgressRollouts({
    [rollout.rolloutId]: {
      errorRate: 0.01,
      latencyRegression: 0.05,
      incidentRate: 0.0,
    },
  });

  assert.equal(progressed, 1);
  assert.equal(service.getActiveRollout("runtime.timeout", "platform", null)?.stage.phase, RolloutPhase.CANARY_25);
});

test("autoProgressRollouts honors per-rollout health gate overrides", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout(
    "runtime.timeout",
    "platform",
    null,
    100,
    undefined,
    { maxErrorRate: 0.1 },
  );
  rollout.updatedAt = new Date(Date.now() - rollout.stage.minDurationMs - 1000).toISOString();

  const progressed = service.autoProgressRollouts({
    [rollout.rolloutId]: {
      errorRate: 0.08,
      latencyRegression: 0.05,
      incidentRate: 0.0,
    },
  });

  assert.equal(progressed, 1);
  assert.equal(service.getActiveRollout("runtime.timeout", "platform", null)?.stage.phase, RolloutPhase.CANARY_25);
});

test("promoteRollout does not mutate active rollout if persistence fails", () => {
  let saves = 0;
  const store = {
    save() {
      saves++;
      if (saves > 1) {
        throw new Error("persist failed");
      }
    },
    loadAll() {
      return [];
    },
    delete() {},
  };
  const service = new ConfigRolloutService({ store });
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.throws(() => service.promoteRollout(rollout.rolloutId), /persist failed/);
  assert.equal(service.getActiveRollout("runtime.timeout", "platform", null)?.stage.phase, RolloutPhase.CANARY_5);
});

test("startRollout accepts metadata", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
  });

  assert.deepEqual(rollout.metadata, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
  });
});
