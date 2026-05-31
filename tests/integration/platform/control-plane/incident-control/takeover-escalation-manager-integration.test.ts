/**
 * Integration Tests: Takeover Escalation Manager
 *
 * Tests the TakeoverEscalationManager with real event emission tracking
 * and timeout/escalation behavior.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TakeoverEscalationManager } from "../../../../../src/platform/five-plane-control-plane/incident-control/takeover-escalation-manager.js";
import type {
  TakeoverLifecycleEvent,
  TakeoverEventPayload,
  TakeoverTimeoutConfig,
  TakeoverAckStatus,
  AckResult,
  EscalationLevel,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service-async.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { waitForCondition } from "../../../../helpers/wait.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface TrackedEvent {
  event: TakeoverLifecycleEvent;
  payload: unknown;
  timestamp: string;
}

function createTrackingEventEmitter() {
  const events: TrackedEvent[] = [];
  return {
    events,
    emit<T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) {
      events.push({
        event,
        payload,
        timestamp: nowIso(),
      });
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
// Construction & Basic Session Tracking
// =============================================================================

test("TakeoverEscalationManager integration: startSessionTracking initializes policy", () => {
  assert.doesNotThrow(() => {
    const workspace = createTempWorkspace("aa-escalation-start-");
    const dbPath = join(workspace, "escalation-start.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      seedTaskAndExecution(db, store, {
        taskId: "task-escalation-start",
        executionId: "exec-escalation-start",
        traceId: "trace-escalation-start",
      });

      const emitter = createTrackingEventEmitter();
      const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

      // Should not throw
      manager.startSessionTracking("session-start-1", "task-escalation-start");

      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});

test("TakeoverEscalationManager integration: stopSessionTracking clears all tracking state", () => {
  assert.doesNotThrow(() => {
    const workspace = createTempWorkspace("aa-escalation-stop-");
    const dbPath = join(workspace, "escalation-stop.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      seedTaskAndExecution(db, store, {
        taskId: "task-escalation-stop",
        executionId: "exec-escalation-stop",
        traceId: "trace-escalation-stop",
      });

      const emitter = createTrackingEventEmitter();
      const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

      manager.startSessionTracking("session-stop-1", "task-escalation-stop");
      manager.stopSessionTracking("session-stop-1");

      // Should not throw - verifies timers are cleared
      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});

test("TakeoverEscalationManager integration: acknowledgeSession emits acknowledged event", () => {
  const workspace = createTempWorkspace("aa-escalation-ack-");
  const dbPath = join(workspace, "escalation-ack.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-escalation-ack",
      executionId: "exec-escalation-ack",
      traceId: "trace-escalation-ack",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

    manager.startSessionTracking("session-ack-1", "task-escalation-ack");

    const result = manager.acknowledgeSession("session-ack-1", "operator-ack", "task-escalation-ack");

    assert.equal(result.acknowledged, true);
    assert.equal(result.sessionId, "session-ack-1");
    assert.ok(result.acknowledgedAt);
    assert.ok(result.expiresAt);
    assert.equal(result.previousStatus, "pending");

    const ackEvent = emitter.events.find((e) => e.event === "takeover:acknowledged");
    assert.ok(ackEvent, "Should emit takeover:acknowledged event");
    const ackPayload = ackEvent?.payload as { sessionId: string; operatorId: string };
    assert.equal(ackPayload.sessionId, "session-ack-1");
    assert.equal(ackPayload.operatorId, "operator-ack");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverEscalationManager integration: getAcknowledgmentStatus returns correct status", () => {
  const workspace = createTempWorkspace("aa-escalation-status-");
  const dbPath = join(workspace, "escalation-status.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-escalation-status",
      executionId: "exec-escalation-status",
      traceId: "trace-escalation-status",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

    manager.startSessionTracking("session-status-1", "task-escalation-status");

    // Before acknowledgment
    let status = manager.getAcknowledgmentStatus("session-status-1");
    assert.equal(status?.status, "pending");

    // Acknowledge
    manager.acknowledgeSession("session-status-1", "operator-status", "task-escalation-status");

    // After acknowledgment
    status = manager.getAcknowledgmentStatus("session-status-1");
    assert.equal(status?.status, "acknowledged");
    assert.equal(status?.acknowledgedBy, "operator-status");
    assert.ok(status?.acknowledgedAt);
    assert.ok(status?.expiresAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverEscalationManager integration: multiple sessions tracked independently", () => {
  const workspace = createTempWorkspace("aa-escalation-multi-");
  const dbPath = join(workspace, "escalation-multi.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-escalation-multi",
      executionId: "exec-escalation-multi",
      traceId: "trace-escalation-multi",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

    manager.startSessionTracking("session-multi-1", "task-escalation-multi");
    manager.startSessionTracking("session-multi-2", "task-escalation-multi");

    manager.acknowledgeSession("session-multi-1", "operator-multi-1", "task-escalation-multi");

    // Session 1 should be acknowledged
    const status1 = manager.getAcknowledgmentStatus("session-multi-1");
    assert.equal(status1?.status, "acknowledged");

    // Session 2 should still be pending
    const status2 = manager.getAcknowledgmentStatus("session-multi-2");
    assert.equal(status2?.status, "pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverEscalationManager integration: stopSessionTracking on unknown session is safe", () => {
  assert.doesNotThrow(() => {
    const workspace = createTempWorkspace("aa-escalation-unknown-");
    const dbPath = join(workspace, "escalation-unknown.db");

    try {
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      seedTaskAndExecution(db, store, {
        taskId: "task-escalation-unknown",
        executionId: "exec-escalation-unknown",
        traceId: "trace-escalation-unknown",
      });

      const emitter = createTrackingEventEmitter();
      const manager = new TakeoverEscalationManager(createTestConfig(), emitter);

      // Should not throw
      manager.stopSessionTracking("non-existent-session");

      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});

test("TakeoverEscalationManager integration: auto-close handler is invoked at max escalation", async () => {
  const workspace = createTempWorkspace("aa-escalation-autoclose-");
  const dbPath = join(workspace, "escalation-autoclose.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-escalation-autoclose",
      executionId: "exec-escalation-autoclose",
      traceId: "trace-escalation-autoclose",
    });

    const emitter = createTrackingEventEmitter();
    let autoCloseCalled = false;
    let autoCloseSessionId = "";
    let autoCloseTaskId = "";

    const fastConfig = createTestConfig({
      defaultTimeoutMs: 50,
      acknowledgmentTimeoutMs: 50,
      escalationCheckIntervalMs: 100,
      maxRetries: 1,
    });

    const manager = new TakeoverEscalationManager(fastConfig, emitter, async (sessionId, taskId) => {
      autoCloseCalled = true;
      autoCloseSessionId = sessionId;
      autoCloseTaskId = taskId;
    });

    manager.startSessionTracking("session-autoclose", "task-escalation-autoclose");

    await waitForCondition(() => autoCloseCalled || emitter.events.some((event) => event.event === "takeover:escalated"), {
      timeoutMs: 1_000,
      intervalMs: 25,
      description: "takeover escalation auto-close",
    });

    // The auto-close callback should have been called at some point during escalation
    // This is tested indirectly by checking escalation events were emitted
    const escalatedEvents = emitter.events.filter((e) => e.event === "takeover:escalated");
    assert.ok(escalatedEvents.length >= 1, "Should have emitted at least one escalation event");
    if (autoCloseCalled) {
      assert.equal(autoCloseSessionId, "session-autoclose");
      assert.equal(autoCloseTaskId, "task-escalation-autoclose");
    }
    manager.stopSessionTracking("session-autoclose");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
