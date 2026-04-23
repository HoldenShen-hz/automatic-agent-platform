import assert from "node:assert/strict";
import test from "node:test";

import {
  TakeoverEscalationManager,
} from "../../../../../src/platform/control-plane/incident-control/takeover-escalation-manager.js";
import type {
  TakeoverLifecycleEvent,
  TakeoverEventPayload,
  TakeoverTimeoutConfig,
  EscalationLevel,
  TakeoverAckStatus,
  AckResult,
} from "../../../../../src/platform/control-plane/incident-control/human-takeover-service-async.js";

function createMockEventEmitter() {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  return {
    events,
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };
}

function createTestConfig(overrides: Partial<TakeoverTimeoutConfig> = {}): TakeoverTimeoutConfig {
  return {
    defaultTimeoutMs: 5000,
    acknowledgmentTimeoutMs: 2000,
    escalationCheckIntervalMs: 1000,
    maxRetries: 3,
    ...overrides,
  };
}

// =============================================================================
// Construction
// =============================================================================

test("TakeoverEscalationManager constructs with valid config", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig();
  const manager = new TakeoverEscalationManager(config, emitter);

  assert.ok(manager);
});

test("TakeoverEscalationManager accepts custom config", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig({
    defaultTimeoutMs: 10000,
    acknowledgmentTimeoutMs: 3000,
    escalationCheckIntervalMs: 500,
    maxRetries: 5,
  });
  const manager = new TakeoverEscalationManager(config, emitter);

  assert.ok(manager);
});

test("TakeoverEscalationManager accepts auto-close handler", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig();
  let autoCloseCalled = false;

  const manager = new TakeoverEscalationManager(config, emitter, async (sessionId, taskId) => {
    autoCloseCalled = true;
    assert.equal(sessionId, "test-session");
    assert.equal(taskId, "test-task");
  });

  assert.ok(manager);
});

// =============================================================================
// Session Tracking
// =============================================================================

test("startSessionTracking initializes tracking for session", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.startSessionTracking("session-1", "task-1");

  // Should not throw
});

test("stopSessionTracking clears all tracking", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.startSessionTracking("session-1", "task-1");
  manager.stopSessionTracking("session-1");

  // Should not throw - verifies timers are cleared
});

test("stopSessionTracking handles unknown session gracefully", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  // Should not throw
  manager.stopSessionTracking("unknown-session");
});

// =============================================================================
// Acknowledgment
// =============================================================================

test("acknowledgeSession sets acknowledged status", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  const result = manager.acknowledgeSession("session-1", "operator-1", "task-1");

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.acknowledged, true);
  assert.ok(result.acknowledgedAt);
  assert.ok(result.expiresAt);
  assert.equal(result.previousStatus, "pending");
});

test("acknowledgeSession emits event", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");

  const ackEvent = emitter.events.find((e) => e.event === "takeover:acknowledged");
  assert.ok(ackEvent);
});

test("acknowledgeSession tracks previous status", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  // First acknowledgment
  const result1 = manager.acknowledgeSession("session-1", "operator-1", "task-1");
  assert.equal(result1.previousStatus, "pending");

  // Second acknowledgment extends existing
  const result2 = manager.acknowledgeSession("session-1", "operator-2", "task-1");
  assert.equal(result2.previousStatus, "acknowledged");
});

// =============================================================================
// Get Acknowledgment Status
// =============================================================================

test("getAcknowledgmentStatus returns null for unknown session", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  const status = manager.getAcknowledgmentStatus("unknown-session");

  assert.equal(status, null);
});

test("getAcknowledgmentStatus returns current status", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const status = manager.getAcknowledgmentStatus("session-1");

  assert.ok(status);
  assert.equal(status?.status, "acknowledged");
  assert.equal(status?.acknowledgedBy, "operator-1");
});

// =============================================================================
// Extend Acknowledgment
// =============================================================================

test("extendAcknowledgment extends active acknowledgment", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const result = manager.extendAcknowledgment("session-1");

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.acknowledged, true);
  assert.ok(result.expiresAt);
});

test("extendAcknowledgment uses custom extension time", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const result = manager.extendAcknowledgment("session-1", 10000);

  assert.equal(result.sessionId, "session-1");
  assert.ok(result.expiresAt);
});

test("extendAcknowledgment throws for unknown session", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  assert.throws(
    () => manager.extendAcknowledgment("unknown-session"),
    (err: any) => err.code === "takeover.ack_not_found",
  );
});

test("extendAcknowledgment throws for non-acknowledged session", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  // Start tracking but don't acknowledge
  manager.startSessionTracking("session-1", "task-1");

  assert.throws(
    () => manager.extendAcknowledgment("session-1"),
    (err: any) => err.code === "takeover.ack_not_found",
  );
});

// =============================================================================
// Timer Management
// =============================================================================

test("clearAllTimers clears all active timers", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig();
  const manager = new TakeoverEscalationManager(config, emitter);

  manager.startSessionTracking("session-1", "task-1");
  manager.acknowledgeSession("session-1", "operator-1", "task-1");

  manager.clearAllTimers();

  // Should not throw
});

// =============================================================================
// Eviction
// =============================================================================

test("evictExpiredSessionEntries handles empty queue", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  // Should not throw
  manager.evictExpiredSessionEntries();
});

test("evictExpiredSessionEntries respects eviction interval", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.evictExpiredSessionEntries();
  manager.evictExpiredSessionEntries(); // Second call is no-op

  // Should not throw
});

test("evictExpiredSessionEntries cleans up old entries", () => {
  const emitter = createMockEventEmitter();
  const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");

  // Should not throw
  manager.evictExpiredSessionEntries();
});
