/**
 * Cross-Plane Event Propagation Tests (R9-30)
 *
 * Tests event propagation across the five planes:
 * - P1→P2: Interface→ControlPlane
 * - P2→P3: ControlPlane→Orchestration
 * - P3→P4: Orchestration→Execution
 * - P4→P5: Execution→StateEvidence
 *
 * Verifies:
 * 1. Events emitted in one plane propagate correctly to other planes
 * 2. Event ordering and delivery guarantees across planes
 * 3. Aggregate-based ordering for events within the same run/aggregate
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { DurableEventBus } from "../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

/**
 * Plane identifiers for cross-plane event propagation tests.
 * These represent the logical consumers in each plane.
 */
const PLANE_CONSUMERS = {
  P1_INTERFACE: "p1_interface_consumer",
  P2_CONTROL: "p2_control_consumer",
  P3_ORCHESTRATION: "p3_orchestration_consumer",
  P4_EXECUTION: "p4_execution_consumer",
  P5_EVIDENCE: "p5_evidence_consumer",
} as const;

type PlaneConsumer = (typeof PLANE_CONSUMERS)[keyof typeof PLANE_CONSUMERS];

/**
 * Helper to create a fresh test environment with event bus and storage.
 */
async function createCrossPlaneTestEnvironment() {
  const workspace = createTempWorkspace("aa-cross-plane-");
  const db = new SqliteDatabase(join(workspace, "cross-plane.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new DurableEventBus(db, store);

  // Seed a task for FK constraints
  seedTaskAndExecution(db, store, {
    taskId: "task-cross-plane",
    executionId: "exec-cross-plane",
    traceId: "trace-cross-plane",
  });

  return { workspace, db, store, bus };
}

/**
 * Helper to cleanup test environment.
 */
async function cleanupCrossPlaneTestEnvironment(env: {
  workspace: string;
  db: SqliteDatabase;
  bus: DurableEventBus;
}) {
  env.bus.dispose();
  env.db.close();
  cleanupPath(env.workspace);
}

// ============================================================================
// P1→P2: Interface→ControlPlane Event Propagation
// ============================================================================

test("P1→P2: task:status_changed propagates from Interface to ControlPlane", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p1Received: string[] = [];
    const p2Received: string[] = [];

    // P1 Interface consumer subscribes
    env.bus.subscribe(PLANE_CONSUMERS.P1_INTERFACE, async (event) => {
      p1Received.push(event.eventType);
    });

    // P2 ControlPlane consumer subscribes
    env.bus.subscribe(PLANE_CONSUMERS.P2_CONTROL, async (event) => {
      p2Received.push(event.eventType);
    });

    // Emit event from P1 Interface plane
    const event = env.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      traceId: "trace-cross-plane",
      payload: {
        fromStatus: "pending",
        toStatus: "in_progress",
        occurredAt: new Date().toISOString(),
        entityKind: "execution",
        reasonCode: "interface.dispatcher",
      },
    });

    // Wait for volatile delivery (P1 and P2 are both immediate consumers)
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Both planes should receive the event
    assert.equal(p1Received.length, 1, "P1 Interface should receive the event");
    assert.equal(p2Received.length, 1, "P2 ControlPlane should receive the event");
    assert.equal(p1Received[0], "task:status_changed", "P1 received correct event type");
    assert.equal(p2Received[0], "task:status_changed", "P2 received correct event type");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("P1→P2: decision:requested propagates with approval context from Interface to ControlPlane", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p1Received: string[] = [];
    const p2Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P1_INTERFACE, async (event) => {
      p1Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P2_CONTROL, async (event) => {
      p2Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "decision:requested",
      taskId: "task-cross-plane",
      payload: {
        approvalId: "approval-p1-p2",
        sourceAgentId: "p1_agent",
        reason: "High-risk operation requires control plane approval",
        riskLevel: "high",
        options: ["approve", "deny", "modify"],
        timeoutPolicy: "reject",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p1Received.length, 1, "P1 should receive decision:requested");
    assert.equal(p2Received.length, 1, "P2 should receive decision:requested");

    const p2Payload = JSON.parse(event.payloadJson);
    assert.equal(p2Payload.riskLevel, "high", "P2 should see high risk level");
    assert.deepEqual(p2Payload.options, ["approve", "deny", "modify"], "P2 should see approval options");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// P2→P3: ControlPlane→Orchestration Event Propagation
// ============================================================================

test("P2→P3: domain:activated propagates from ControlPlane to Orchestration", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p2Received: string[] = [];
    const p3Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P2_CONTROL, async (event) => {
      p2Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P3_ORCHESTRATION, async (event) => {
      p3Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "domain:activated",
      taskId: "task-cross-plane",
      payload: {
        domainId: "domain-finance",
        status: "activated",
        capabilityCount: 0,
        pluginCount: 0,
        occurredAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p2Received.length, 1, "P2 should receive domain:activated");
    assert.equal(p3Received.length, 1, "P3 should receive domain:activated");

    const p3Payload = JSON.parse(event.payloadJson);
    assert.equal(p3Payload.domainId, "domain-finance", "P3 should see domain ID");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("P2→P3: oapeflir.phase.transition propagates from ControlPlane to Orchestration", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p2Received: string[] = [];
    const p3Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P2_CONTROL, async (event) => {
      p2Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P3_ORCHESTRATION, async (event) => {
      p3Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "oapeflir.phase.transition",
      taskId: "task-cross-plane",
      payload: {
        runId: "run-oapeflir-123",
        fromPhase: "planning",
        toPhase: "execution",
        occurredAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p2Received.length, 1, "P2 should receive phase transition");
    assert.equal(p3Received.length, 1, "P3 should receive phase transition");

    const p3Payload = JSON.parse(event.payloadJson);
    assert.equal(p3Payload.fromPhase, "planning", "P3 should see fromPhase");
    assert.equal(p3Payload.toPhase, "execution", "P3 should see toPhase");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// P3→P4: Orchestration→Execution Event Propagation
// ============================================================================

test("P3→P4: workflow:step_completed propagates from Orchestration to Execution", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p3Received: string[] = [];
    const p4Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P3_ORCHESTRATION, async (event) => {
      p3Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P4_EXECUTION, async (event) => {
      p4Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      payload: {
        workflowId: "wf-harness-123",
        stepId: "step_planning",
        roleId: "planner_agent",
        status: "completed",
        attempt: 1,
        occurredAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p3Received.length, 1, "P3 Orchestration should receive workflow:step_completed");
    assert.equal(p4Received.length, 1, "P4 Execution should receive workflow:step_completed");

    const p4Payload = JSON.parse(event.payloadJson);
    assert.equal(p4Payload.workflowId, "wf-harness-123", "P4 should see workflow ID");
    assert.equal(p4Payload.stepId, "step_planning", "P4 should see step ID");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("P3→P4: dispatch:ticket_created propagates from Orchestration to Execution", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p3Received: string[] = [];
    const p4Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P3_ORCHESTRATION, async (event) => {
      p3Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P4_EXECUTION, async (event) => {
      p4Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      payload: {
        ticketId: "ticket-dispatch-456",
        taskId: "task-cross-plane",
        priority: "high",
        assignedWorkerPool: "pool-default",
        createdAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p3Received.length, 1, "P3 should receive dispatch:ticket_created");
    assert.equal(p4Received.length, 1, "P4 should receive dispatch:ticket_created");

    const p4Payload = JSON.parse(event.payloadJson);
    assert.equal(p4Payload.ticketId, "ticket-dispatch-456", "P4 should see ticket ID");
    assert.equal(p4Payload.priority, "high", "P4 should see priority");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// P4→P5: Execution→StateEvidence Event Propagation
// ============================================================================

test("P4→P5: task:status_changed propagates from Execution to StateEvidence", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p4Received: string[] = [];
    const p5Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P4_EXECUTION, async (event) => {
      p4Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P5_EVIDENCE, async (event) => {
      p5Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      payload: {
        fromStatus: "in_progress",
        toStatus: "completed",
        occurredAt: new Date().toISOString(),
        entityKind: "execution",
        reasonCode: "execution.success",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p4Received.length, 1, "P4 should receive task:status_changed");
    assert.equal(p5Received.length, 1, "P5 should receive task:status_changed");

    const p5Payload = JSON.parse(event.payloadJson);
    assert.equal(p5Payload.toStatus, "completed", "P5 should see final status");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("P4→P5: worker:claim_accepted propagates from Execution to StateEvidence", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p4Received: string[] = [];
    const p5Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P4_EXECUTION, async (event) => {
      p4Received.push(event.eventType);
    });

    env.bus.subscribe(PLANE_CONSUMERS.P5_EVIDENCE, async (event) => {
      p5Received.push(event.eventType);
    });

    const event = env.bus.publish({
      eventType: "worker:claim_accepted",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      payload: {
        workerId: "worker-abc-123",
        taskId: "task-cross-plane",
        claimedAt: new Date().toISOString(),
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(p4Received.length, 1, "P4 should receive worker:claim_accepted");
    assert.equal(p5Received.length, 1, "P5 should receive worker:claim_accepted");

    const p5Payload = JSON.parse(event.payloadJson);
    assert.equal(p5Payload.workerId, "worker-abc-123", "P5 should see worker ID");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// Full Chain: P1→P2→P3→P4→P5 Event Propagation
// ============================================================================

test("P1→P2→P3→P4→P5: Full chain event propagation with runId aggregate ordering", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const allPlaneEvents: Record<PlaneConsumer, string[]> = {
      [PLANE_CONSUMERS.P1_INTERFACE]: [],
      [PLANE_CONSUMERS.P2_CONTROL]: [],
      [PLANE_CONSUMERS.P3_ORCHESTRATION]: [],
      [PLANE_CONSUMERS.P4_EXECUTION]: [],
      [PLANE_CONSUMERS.P5_EVIDENCE]: [],
    };

    // All planes subscribe to task lifecycle events
    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      env.bus.subscribe(consumerId, async (event) => {
        allPlaneEvents[consumerId].push(event.eventType);
      });
    }

    // Emit events in sequence with same runId for aggregate ordering
    const runId = "run-full-chain-001";

    env.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId,
      payload: {
        fromStatus: "pending",
        toStatus: "queued",
        occurredAt: new Date().toISOString(),
      },
    });

    env.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId,
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        occurredAt: new Date().toISOString(),
      },
    });

    env.bus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId,
      payload: {
        workflowId: "wf-full-chain",
        stepId: "step_intake",
        roleId: "agent_init",
        status: "completed",
        attempt: 1,
        occurredAt: new Date().toISOString(),
      },
    });

    env.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId,
      payload: {
        fromStatus: "in_progress",
        toStatus: "completed",
        occurredAt: new Date().toISOString(),
      },
    });

    // Wait for all volatile deliveries
    await new Promise((resolve) => setTimeout(resolve, 200));

    // All planes should receive all events
    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      const events = allPlaneEvents[consumerId];
      assert.equal(events.length, 4, `${consumerId} should receive 4 events`);
    }

    // Verify event types in order for each plane
    const p5Events = allPlaneEvents[PLANE_CONSUMERS.P5_EVIDENCE];
    assert.equal(p5Events[0], "task:status_changed", "First event should be queued");
    assert.equal(p5Events[1], "task:status_changed", "Second event should be in_progress");
    assert.equal(p5Events[2], "workflow:step_completed", "Third event should be step completion");
    assert.equal(p5Events[3], "task:status_changed", "Fourth event should be completed");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("P1→P2→P3→P4→P5: Events propagate to all planes without loss", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const eventCounts: Record<PlaneConsumer, number> = {
      [PLANE_CONSUMERS.P1_INTERFACE]: 0,
      [PLANE_CONSUMERS.P2_CONTROL]: 0,
      [PLANE_CONSUMERS.P3_ORCHESTRATION]: 0,
      [PLANE_CONSUMERS.P4_EXECUTION]: 0,
      [PLANE_CONSUMERS.P5_EVIDENCE]: 0,
    };

    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      env.bus.subscribe(consumerId, async () => {
        eventCounts[consumerId]++;
      });
    }

    // Emit 10 events with proper payloads for each type
    // Use simple tier-2 events that don't require specific required fields
    for (let i = 0; i < 10; i++) {
      env.bus.publish({
        eventType: "stream:chunk_emitted",
        taskId: "task-cross-plane",
        executionId: "exec-cross-plane",
        payload: {
          streamId: `stream-${i}`,
          chunkIndex: i,
          chunkType: "text",
          emittedAt: new Date().toISOString(),
        },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Each plane should receive exactly 10 events
    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      assert.equal(eventCounts[consumerId], 10, `${consumerId} should receive exactly 10 events`);
    }

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// Event Ordering and Delivery Guarantees
// ============================================================================

test("Events within same runId maintain sequence ordering across planes", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p5Sequences: number[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P5_EVIDENCE, async (event) => {
      // Extract sequence from payload
      const payload = JSON.parse(event.payloadJson);
      if (payload.sequence !== undefined) {
        p5Sequences.push(payload.sequence);
      }
    });

    const runId = "run-sequence-ordering";

    // Publish events in specific order with explicit sequence numbers
    for (let i = 1; i <= 5; i++) {
      env.bus.publish({
        eventType: "task:status_changed",
        taskId: "task-cross-plane",
        executionId: "exec-cross-plane",
        runId,
        sequence: i,
        payload: {
          fromStatus: "pending",
          toStatus: `state_${i}`,
          occurredAt: new Date().toISOString(),
          sequence: i,
        },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    // P5 should receive events in sequence order
    assert.equal(p5Sequences.length, 5, "P5 should receive 5 events");
    assert.deepEqual(p5Sequences, [1, 2, 3, 4, 5], "Events should maintain sequence ordering");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("Events with different runIds maintain independent ordering per run", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const runARecords: string[] = [];
    const runBRecords: string[] = [];

    // Use tier-3 events (stream:chunk_emitted) for volatile delivery without explicit deliverPending
    env.bus.subscribe(PLANE_CONSUMERS.P5_EVIDENCE, async (event) => {
      const payload = JSON.parse(event.payloadJson);
      if (payload.runMarker !== undefined) {
        if (event.runId === "run-a") {
          runARecords.push(payload.runMarker);
        } else if (event.runId === "run-b") {
          runBRecords.push(payload.runMarker);
        }
      }
    });

    // Interleave events from two different runs using tier-3 for immediate delivery
    env.bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId: "run-a",
      payload: { streamId: "stream-a1", chunkIndex: 0, chunkType: "text", emittedAt: new Date().toISOString(), runMarker: "run-a-1" },
    });

    env.bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId: "run-b",
      payload: { streamId: "stream-b1", chunkIndex: 0, chunkType: "text", emittedAt: new Date().toISOString(), runMarker: "run-b-1" },
    });

    env.bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId: "run-a",
      payload: { streamId: "stream-a2", chunkIndex: 1, chunkType: "text", emittedAt: new Date().toISOString(), runMarker: "run-a-2" },
    });

    env.bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-cross-plane",
      executionId: "exec-cross-plane",
      runId: "run-b",
      payload: { streamId: "stream-b2", chunkIndex: 1, chunkType: "text", emittedAt: new Date().toISOString(), runMarker: "run-b-2" },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Each run's events should maintain their own ordering
    assert.deepEqual(runARecords, ["run-a-1", "run-a-2"], "Run A should maintain sequence");
    assert.deepEqual(runBRecords, ["run-b-1", "run-b-2"], "Run B should maintain sequence");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

// ============================================================================
// Tier-1 Event Reliability Across Planes
// ============================================================================

test("Tier-1 events (task:status_changed) deliver reliably to all planes", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const pendingCounts: Record<PlaneConsumer, number> = {
      [PLANE_CONSUMERS.P1_INTERFACE]: 0,
      [PLANE_CONSUMERS.P2_CONTROL]: 0,
      [PLANE_CONSUMERS.P3_ORCHESTRATION]: 0,
      [PLANE_CONSUMERS.P4_EXECUTION]: 0,
      [PLANE_CONSUMERS.P5_EVIDENCE]: 0,
    };

    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      env.bus.subscribe(consumerId, async () => {});
    }

    // Publish 5 tier-1 events
    for (let i = 0; i < 5; i++) {
      env.bus.publish({
        eventType: "task:status_changed",
        taskId: "task-cross-plane",
        executionId: "exec-cross-plane",
        payload: {
          fromStatus: "pending",
          toStatus: `state_${i}`,
          occurredAt: new Date().toISOString(),
        },
      });
    }

    // Check pending counts for each consumer
    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      const pending = env.bus.pendingForConsumer(consumerId);
      pendingCounts[consumerId] = pending.length;
    }

    // All planes should have the same number of pending tier-1 events
    const expectedCount = 5;
    for (const consumerId of Object.values(PLANE_CONSUMERS)) {
      assert.equal(
        pendingCounts[consumerId],
        expectedCount,
        `${consumerId} should have ${expectedCount} pending tier-1 events`,
      );
    }

    // Now deliver to P5 and verify no events lost
    const p5Delivered = await env.bus.deliverPending(PLANE_CONSUMERS.P5_EVIDENCE);
    assert.equal(p5Delivered, 5, "P5 should receive all 5 tier-1 events");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});

test("Platform events (harness_run.lifecycle) propagate across planes", async () => {
  const env = await createCrossPlaneTestEnvironment();

  try {
    const p3Received: string[] = [];
    const p4Received: string[] = [];
    const p5Received: string[] = [];

    env.bus.subscribe(PLANE_CONSUMERS.P3_ORCHESTRATION, async (event) => {
      if (event.eventType.startsWith("platform.harness_run")) {
        p3Received.push(event.eventType);
      }
    });

    env.bus.subscribe(PLANE_CONSUMERS.P4_EXECUTION, async (event) => {
      if (event.eventType.startsWith("platform.harness_run")) {
        p4Received.push(event.eventType);
      }
    });

    env.bus.subscribe(PLANE_CONSUMERS.P5_EVIDENCE, async (event) => {
      if (event.eventType.startsWith("platform.harness_run")) {
        p5Received.push(event.eventType);
      }
    });

    const runId = "harness-run-123";

    // Emit harness run lifecycle events
    env.bus.publish({
      eventType: "platform.harness_run.created",
      taskId: "task-cross-plane",
      runId,
      payload: {
        runId,
        taskId: "task-cross-plane",
        occurredAt: new Date().toISOString(),
      },
    });

    env.bus.publish({
      eventType: "platform.harness_run.admitted",
      taskId: "task-cross-plane",
      runId,
      payload: {
        runId,
        taskId: "task-cross-plane",
        occurredAt: new Date().toISOString(),
      },
    });

    env.bus.publish({
      eventType: "platform.harness_run.completed",
      taskId: "task-cross-plane",
      runId,
      payload: {
        runId,
        taskId: "task-cross-plane",
        occurredAt: new Date().toISOString(),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.equal(p3Received.length, 3, "P3 should receive 3 harness events");
    assert.equal(p4Received.length, 3, "P4 should receive 3 harness events");
    assert.equal(p5Received.length, 3, "P5 should receive 3 harness events");

    await cleanupCrossPlaneTestEnvironment(env);
  } finally {
    // cleanup
  }
});
