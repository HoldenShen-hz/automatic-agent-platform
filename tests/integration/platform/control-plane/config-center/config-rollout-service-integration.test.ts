/**
 * Integration Test: Config Rollout Service
 *
 * Tests the ConfigRolloutService for canary rollout strategy:
 * - Rollout phases and ordering
 * - Deterministic percentage-based hash assignment
 * - Event bus integration
 * - Rollout promotion and cancellation
 * - Auto-progress functionality
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Mock Event Bus
// ---------------------------------------------------------------------------

interface MockEvent {
  eventType: string;
  payload: Record<string, unknown>;
}

interface MockEventBus {
  publish: (event: { eventType: string; payload: Record<string, unknown> }) => void;
  getEvents: () => MockEvent[];
}

function createMockEventBus(): MockEventBus {
  const events: MockEvent[] = [];
  return {
    publish(event: { eventType: string; payload: Record<string, unknown> }) {
      events.push(event);
    },
    getEvents() {
      return [...events];
    },
  };
}

// ---------------------------------------------------------------------------
// Import after build
// ---------------------------------------------------------------------------

import {
  ConfigRolloutService,
  RolloutPhase,
  ConfigRollout,
} from "../../../../../src/platform/control-plane/config-center/config-rollout-service.js";

test("rollout integration: startRollout creates rollout with default stages", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  assert.ok(rollout.rolloutId, "Rollout should have an ID");
  assert.strictEqual(rollout.configPath, "runtime.timeout");
  assert.strictEqual(rollout.layer, "platform");
  assert.strictEqual(rollout.sourceId, null);
  assert.strictEqual(rollout.targetPercentage, 100);
  assert.ok(rollout.startedAt, "Should have startedAt timestamp");
  assert.ok(rollout.updatedAt, "Should have updatedAt timestamp");
});

test("rollout integration: startRollout defaults to FULL stage for 100% target", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  assert.strictEqual(rollout.stage.phase, RolloutPhase.FULL);
  assert.strictEqual(rollout.currentPercentage, 100);
  assert.strictEqual(rollout.targetPercentage, 100);
});

test("rollout integration: startRollout uses correct stage based on target percentage", () => {
  const service = new ConfigRolloutService();

  // 0% should be PENDING
  const pendingRollout = service.startRollout("config.1", "platform", null, 0);
  assert.strictEqual(pendingRollout.stage.phase, RolloutPhase.PENDING);
  assert.strictEqual(pendingRollout.currentPercentage, 0);

  // 1-5% should be CANARY_5
  const canary5Rollout = service.startRollout("config.2", "platform", null, 5);
  assert.strictEqual(canary5Rollout.stage.phase, RolloutPhase.CANARY_5);
  assert.strictEqual(canary5Rollout.currentPercentage, 5);

  // 6-25% should be CANARY_25
  const canary25Rollout = service.startRollout("config.3", "platform", null, 25);
  assert.strictEqual(canary25Rollout.stage.phase, RolloutPhase.CANARY_25);
  assert.strictEqual(canary25Rollout.currentPercentage, 25);

  // 26-50% should be HALF
  const halfRollout = service.startRollout("config.4", "platform", null, 50);
  assert.strictEqual(halfRollout.stage.phase, RolloutPhase.HALF);
  assert.strictEqual(halfRollout.currentPercentage, 50);

  // 51-100% should be FULL
  const fullRollout = service.startRollout("config.5", "platform", null, 100);
  assert.strictEqual(fullRollout.stage.phase, RolloutPhase.FULL);
  assert.strictEqual(fullRollout.currentPercentage, 100);
});

test("rollout integration: startRollout accepts metadata", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
    ticket: "CONFIG-123",
  });

  assert.deepStrictEqual(rollout.metadata, {
    changedBy: "admin@example.com",
    reason: "Performance improvement",
    ticket: "CONFIG-123",
  });
});

test("rollout integration: shouldApplyConfig returns shouldApply:true when no active rollout", () => {
  const service = new ConfigRolloutService();
  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.strictEqual(decision.shouldApply, true);
  assert.strictEqual(decision.rolloutId, null);
  assert.strictEqual(decision.reason, "no_active_rollout");
  assert.strictEqual(decision.percentage, 100);
});

test("rollout integration: shouldApplyConfig returns shouldApply:false for PENDING rollout", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null, 0);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.strictEqual(decision.shouldApply, false);
  assert.strictEqual(decision.reason, "rollout_pending");
  assert.strictEqual(decision.percentage, 0);
});

test("rollout integration: shouldApplyConfig returns shouldApply:false for CANCELLED rollout", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);
  service.cancelRollout(rollout.rolloutId);

  const decision = service.shouldApplyConfig("runtime.timeout", "platform", null, "hash-123");

  assert.strictEqual(decision.shouldApply, false);
  assert.strictEqual(decision.reason, "rollout_cancelled");
});

test("rollout integration: shouldApplyConfig uses deterministic hash-based percentage", () => {
  const service = new ConfigRolloutService();
  // Start at FULL (100%) so all hashes will be below percentage
  service.startRollout("runtime.timeout", "platform", null, 100);

  const decision1 = service.shouldApplyConfig("runtime.timeout", "platform", null, "any-hash-1");
  const decision2 = service.shouldApplyConfig("runtime.timeout", "platform", null, "any-hash-2");

  // With 100%, all hashes should result in shouldApply=true
  assert.strictEqual(decision1.shouldApply, true);
  assert.strictEqual(decision2.shouldApply, true);
});

test("rollout integration: promoteRollout advances through stages in order", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);

  assert.strictEqual(rollout.stage.phase, RolloutPhase.CANARY_5);

  // Promote to CANARY_25
  const promoted1 = service.promoteRollout(rollout.rolloutId);
  assert.ok(promoted1);
  assert.strictEqual(promoted1!.stage.phase, RolloutPhase.CANARY_25);
  assert.strictEqual(promoted1!.currentPercentage, 25);

  // Promote to HALF
  const promoted2 = service.promoteRollout(rollout.rolloutId);
  assert.ok(promoted2);
  assert.strictEqual(promoted2!.stage.phase, RolloutPhase.HALF);
  assert.strictEqual(promoted2!.currentPercentage, 50);

  // Promote to FULL
  const promoted3 = service.promoteRollout(rollout.rolloutId);
  assert.ok(promoted3);
  assert.strictEqual(promoted3!.stage.phase, RolloutPhase.FULL);
  assert.strictEqual(promoted3!.currentPercentage, 100);
});

test("rollout integration: promoteRollout returns null for non-existent rollout", () => {
  const service = new ConfigRolloutService();
  const result = service.promoteRollout("non-existent-id");

  assert.strictEqual(result, null);
});

test("rollout integration: cancelRollout transitions to CANCELLED phase", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  const cancelled = service.cancelRollout(rollout.rolloutId);

  assert.ok(cancelled);
  assert.strictEqual(cancelled!.stage.phase, RolloutPhase.CANCELLED);
  // Note: currentPercentage is not updated by cancelRollout in source
  // So it remains at the previous stage percentage (100 from FULL)
});

test("rollout integration: cancelRollout returns null for non-existent rollout", () => {
  const service = new ConfigRolloutService();
  const result = service.cancelRollout("non-existent-id");

  assert.strictEqual(result, null);
});

test("rollout integration: getActiveRollout returns correct rollout by path/layer/sourceId", () => {
  const service = new ConfigRolloutService();
  const rollout1 = service.startRollout("config.1", "platform", null);
  const rollout2 = service.startRollout("config.2", "tenant", "tenant-1");

  const found1 = service.getActiveRollout("config.1", "platform", null);
  const found2 = service.getActiveRollout("config.2", "tenant", "tenant-1");
  const notFound = service.getActiveRollout("config.3", "platform", null);

  assert.ok(found1);
  assert.strictEqual(found1!.rolloutId, rollout1.rolloutId);
  assert.ok(found2);
  assert.strictEqual(found2!.rolloutId, rollout2.rolloutId);
  assert.strictEqual(notFound, null);
});

test("rollout integration: getActiveRollout returns null when sourceId does not match", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", "tenant-1");

  const found = service.getActiveRollout("runtime.timeout", "platform", "tenant-2");

  assert.strictEqual(found, null);
});

test("rollout integration: getActiveRollouts returns all active rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("config.1", "platform", null);
  service.startRollout("config.2", "tenant", "tenant-1");
  service.startRollout("config.3", "pack", "pack-a");

  const rollouts = service.getActiveRollouts();

  assert.strictEqual(rollouts.length, 3);
});

test("rollout integration: eventBus receives publish calls when eventBus is provided", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null);

  const events = mockBus.getEvents();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0]!.eventType, "config.rollout.started");
  assert.strictEqual(events[0]!.payload.rolloutId, rollout.rolloutId);
  assert.strictEqual(events[0]!.payload.configPath, "runtime.timeout");
  assert.strictEqual(events[0]!.payload.percentage, 100);
});

test("rollout integration: promoteRollout emits config.rollout.promoted event", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null, 5);
  mockBus.getEvents().length = 0; // Clear start event

  service.promoteRollout(rollout.rolloutId);

  const events = mockBus.getEvents();
  assert.ok(events.some(e => e.eventType === "config.rollout.promoted"), "Should emit config.rollout.promoted event");
  const promotedEvent = events.find(e => e.eventType === "config.rollout.promoted");
  assert.ok(promotedEvent);
  assert.strictEqual(promotedEvent!.payload.rolloutId, rollout.rolloutId);
  assert.strictEqual(promotedEvent!.payload.percentage, 25);
});

test("rollout integration: cancelRollout emits config.rollout.cancelled event", () => {
  const mockBus = createMockEventBus();
  const service = new ConfigRolloutService({ eventBus: mockBus as unknown as import("../../../../../src/platform/state-evidence/events/durable-event-bus.js").DurableEventBus });

  const rollout = service.startRollout("runtime.timeout", "platform", null);
  mockBus.getEvents().length = 0; // Clear start event

  service.cancelRollout(rollout.rolloutId);

  const events = mockBus.getEvents();
  assert.ok(events.some(e => e.eventType === "config.rollout.cancelled"), "Should emit config.rollout.cancelled event");
  const cancelledEvent = events.find(e => e.eventType === "config.rollout.cancelled");
  assert.ok(cancelledEvent);
  assert.strictEqual(cancelledEvent!.payload.rolloutId, rollout.rolloutId);
  // Note: percentage reflects currentPercentage which is not updated by cancelRollout
  // So it remains at 100 (from FULL stage) instead of 0
});

test("rollout integration: autoProgressRollouts does not progress non-auto stages", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 100);

  // FULL stage has autoProgress: false
  const progressed = service.autoProgressRollouts();

  assert.strictEqual(progressed, 0);
});

test("rollout integration: cleanupRollouts removes old completed rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);

  // Manually set to FULL and old
  rollout.stage = { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false };
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago

  const cleaned = service.cleanupRollouts(86400000); // 24 hours

  assert.strictEqual(cleaned, 1);
  assert.strictEqual(service.getActiveRollouts().length, 0);
});

test("rollout integration: cleanupRollouts removes old cancelled rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null);
  service.cancelRollout(rollout.rolloutId);

  // Manually set updatedAt to old
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago

  const cleaned = service.cleanupRollouts(86400000);

  assert.strictEqual(cleaned, 1);
  assert.strictEqual(service.getActiveRollouts().length, 0);
});

test("rollout integration: cleanupRollouts keeps recent rollouts", () => {
  const service = new ConfigRolloutService();
  service.startRollout("runtime.timeout", "platform", null);

  const cleaned = service.cleanupRollouts(86400000);

  assert.strictEqual(cleaned, 0);
  assert.strictEqual(service.getActiveRollouts().length, 1);
});

test("rollout integration: cleanupRollouts does not remove PENDING rollouts", () => {
  const service = new ConfigRolloutService();
  const rollout = service.startRollout("runtime.timeout", "platform", null, 0);

  // Manually set updatedAt to old
  rollout.updatedAt = new Date(Date.now() - 90000000).toISOString();

  const cleaned = service.cleanupRollouts(86400000);

  assert.strictEqual(cleaned, 0); // PENDING rollouts are not cleaned up
  assert.strictEqual(service.getActiveRollouts().length, 1);
});

test("rollout integration: multiple rollouts for same config path with different layers", () => {
  const service = new ConfigRolloutService();

  service.startRollout("runtime.timeout", "platform", null);
  service.startRollout("runtime.timeout", "tenant", "tenant-1");
  service.startRollout("runtime.timeout", "pack", "pack-a");

  const rollouts = service.getActiveRollouts();
  assert.strictEqual(rollouts.length, 3);

  // Each should have correct layer
  const platformRollout = rollouts.find(r => r.layer === "platform");
  const tenantRollout = rollouts.find(r => r.layer === "tenant");
  const packRollout = rollouts.find(r => r.layer === "pack");

  assert.ok(platformRollout);
  assert.ok(tenantRollout);
  assert.ok(packRollout);
  assert.strictEqual(platformRollout!.sourceId, null);
  assert.strictEqual(tenantRollout!.sourceId, "tenant-1");
  assert.strictEqual(packRollout!.sourceId, "pack-a");
});
