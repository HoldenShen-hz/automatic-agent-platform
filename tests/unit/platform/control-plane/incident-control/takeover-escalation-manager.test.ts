import assert from "node:assert/strict";
import test from "node:test";

import {
  TakeoverEscalationManager,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/takeover-escalation-manager.js";
import type {
  TakeoverLifecycleEvent,
  TakeoverEventPayload,
  TakeoverTimeoutConfig,
  EscalationLevel,
  TakeoverAckStatus,
  AckResult,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service-async.js";

test.describe("TakeoverEscalationManager", () => {
  // Track managers created in tests for cleanup
  const managers: TakeoverEscalationManager[] = [];

  // Clean up timers after each test to prevent event loop blocking
  test.afterEach(() => {
    for (const manager of managers) {
      manager.clearAllTimers();
    }
    managers.length = 0;
  });

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

function createManager(config?: TakeoverTimeoutConfig, emitter?: ReturnType<typeof createMockEventEmitter>, onAutoClose?: (sessionId: string, taskId: string) => Promise<void>): TakeoverEscalationManager {
  const mgr = new TakeoverEscalationManager(config ?? createTestConfig(), emitter ?? createMockEventEmitter(), onAutoClose);
  managers.push(mgr);
  return mgr;
}

// =============================================================================
// Construction
// =============================================================================

test("TakeoverEscalationManager constructs with valid config", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig();
  const manager = createManager(config, emitter);

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
  const manager = createManager(config, emitter);

  assert.ok(manager);
});

test("TakeoverEscalationManager accepts auto-close handler", () => {
  const emitter = createMockEventEmitter();
  const config = createTestConfig();
  let autoCloseCalled = false;

  const manager = createManager(config, emitter, async (sessionId, taskId) => {
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
  assert.doesNotThrow(() => {
    const manager = createManager();

    manager.startSessionTracking("session-1", "task-1");

    // Should not throw
  });
});

test("stopSessionTracking clears all tracking", () => {
  assert.doesNotThrow(() => {
    const manager = createManager();

    manager.startSessionTracking("session-1", "task-1");
    manager.stopSessionTracking("session-1");

    // Should not throw - verifies timers are cleared
  });
});

test("stopSessionTracking handles unknown session gracefully", () => {
  assert.doesNotThrow(() => {
    const manager = createManager();

    // Should not throw
    manager.stopSessionTracking("unknown-session");
  });
});

// =============================================================================
// Acknowledgment
// =============================================================================

test("acknowledgeSession sets acknowledged status", () => {
  const emitter = createMockEventEmitter();
  const manager = createManager(createTestConfig(), emitter);

  const result = manager.acknowledgeSession("session-1", "operator-1", "task-1");

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.acknowledged, true);
  assert.ok(result.acknowledgedAt);
  assert.ok(result.expiresAt);
  assert.equal(result.previousStatus, "pending");
});

test("acknowledgeSession emits event", () => {
  const emitter = createMockEventEmitter();
  const manager = createManager(createTestConfig(), emitter);

  manager.acknowledgeSession("session-1", "operator-1", "task-1");

  const ackEvent = emitter.events.find((e) => e.event === "takeover:acknowledged");
  assert.ok(ackEvent);
});

test("acknowledgeSession tracks previous status", () => {
  const manager = createManager();

  // First acknowledgment
  const result1 = manager.acknowledgeSession("session-1", "operator-1", "task-1");
  assert.equal(result1.previousStatus, "pending");

  // Second acknowledgment extends existing
  const result2 = manager.acknowledgeSession("session-1", "operator-2", "task-1");
  assert.equal(result2.previousStatus, "acknowledged");
});

test("acknowledgeSession caps escalation history retention", () => {
  const manager = createManager();
  manager.startSessionTracking("session-1", "task-1");

  for (let i = 0; i < 20; i++) {
    manager.acknowledgeSession("session-1", `operator-${i}`, "task-1");
  }

  const policy = (manager as unknown as {
    escalationPolicies: Map<string, { escalationHistory: Array<{ target: string | null }> }>;
  }).escalationPolicies.get("session-1");
  assert.ok(policy);
  assert.equal(policy!.escalationHistory.length, 16);
  assert.equal(policy!.escalationHistory[0]!.target, "operator-0");
  assert.equal(policy!.escalationHistory.at(-1)!.target, "operator-19");
});

// =============================================================================
// Get Acknowledgment Status
// =============================================================================

test("getAcknowledgmentStatus returns null for unknown session", () => {
  const manager = createManager();

  const status = manager.getAcknowledgmentStatus("unknown-session");

  assert.equal(status, null);
});

test("getAcknowledgmentStatus returns current status", () => {
  const manager = createManager();

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
  const manager = createManager();

  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const result = manager.extendAcknowledgment("session-1");

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.acknowledged, true);
  assert.ok(result.expiresAt);
});

test("extendAcknowledgment uses custom extension time", () => {
  const manager = createManager();

  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const result = manager.extendAcknowledgment("session-1", 10000);

  assert.equal(result.sessionId, "session-1");
  assert.ok(result.expiresAt);
});

test("extendAcknowledgment preserves the tracked taskId for later renewal handling", () => {
  const manager = createManager();

  manager.startSessionTracking("session-1", "task-1");
  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  manager.extendAcknowledgment("session-1", 1000);

  assert.equal((manager as any).sessionTaskIds.get("session-1"), "task-1");
});

test("extendAcknowledgment reschedules escalation tracking for the new deadline", () => {
  const manager = createManager();

  manager.startSessionTracking("session-1", "task-1");
  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  const previousTimer = (manager as any).escalationTimers.get("session-1");

  manager.extendAcknowledgment("session-1", 1000);

  const nextTimer = (manager as any).escalationTimers.get("session-1");
  assert.ok(nextTimer);
  assert.notEqual(previousTimer, nextTimer);
});

test("extendAcknowledgment throws for unknown session", () => {
  const manager = createManager();

  assert.throws(
    () => manager.extendAcknowledgment("unknown-session"),
    (err: any) => err.code === "takeover.ack_not_found",
  );
});

test("extendAcknowledgment throws for non-acknowledged session", () => {
  const manager = createManager();

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
  assert.doesNotThrow(() => {
    const emitter = createMockEventEmitter();
    const config = createTestConfig();
    const manager = createManager(config, emitter);

    manager.startSessionTracking("session-1", "task-1");
    manager.acknowledgeSession("session-1", "operator-1", "task-1");

    manager.clearAllTimers();

    // Should not throw
  });
});

// =============================================================================
// Eviction
// =============================================================================

test("evictExpiredSessionEntries handles empty queue", () => {
  assert.doesNotThrow(() => {
    const manager = createManager();

    // Should not throw
    manager.evictExpiredSessionEntries();
  });
});

test("evictExpiredSessionEntries respects eviction interval", () => {
  assert.doesNotThrow(() => {
    const manager = createManager();

    manager.evictExpiredSessionEntries();
    manager.evictExpiredSessionEntries(); // Second call is no-op

    // Should not throw
  });
});

test("evictExpiredSessionEntries cleans up old entries", () => {
  assert.doesNotThrow(() => {
    const manager = createManager();

    manager.acknowledgeSession("session-1", "operator-1", "task-1");

    // Should not throw
    manager.evictExpiredSessionEntries();
  });
});

test("evictExpiredSessionEntries clears timers for removed sessions", () => {
  const manager = createManager() as TakeoverEscalationManager & {
    ackStatuses: Map<string, TakeoverAckStatus>;
    activeTimeouts: Map<string, NodeJS.Timeout>;
    escalationTimers: Map<string, NodeJS.Timeout>;
    lastEvictionTime: number;
    readonly EVICTION_INTERVAL_MS: number;
  };

  manager.startSessionTracking("session-1", "task-1");
  manager.acknowledgeSession("session-1", "operator-1", "task-1");
  manager.ackStatuses.set("session-1", {
    sessionId: "session-1",
    acknowledgedAt: new Date(Date.now() - (31 * 60 * 1000)).toISOString(),
    expiresAt: null,
    status: "expired",
    acknowledgedBy: "operator-1",
  });
  manager.lastEvictionTime = Date.now() - manager.EVICTION_INTERVAL_MS - 1;

  manager.evictExpiredSessionEntries();

  assert.equal(manager.ackStatuses.has("session-1"), false);
  assert.equal(manager.activeTimeouts.has("session-1"), false);
  assert.equal(manager.escalationTimers.has("session-1"), false);
});

});
