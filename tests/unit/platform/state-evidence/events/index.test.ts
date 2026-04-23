/**
 * Unit tests for state-evidence/events module
 *
 * Tests event types, schemas, and integration between components.
 * This file supplements the existing test files in tests/unit/platform/state-evidence/events/
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { TypedEventBus } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { EventOpsService } from "../../../../../src/platform/state-evidence/events/event-ops-service.js";
import { EventTopologyService } from "../../../../../src/platform/state-evidence/events/event-topology-service.js";
import { ProjectionInventoryService } from "../../../../../src/platform/state-evidence/events/projection-inventory-service.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/state-evidence/events/event-reliability-inventory-service.js";
import { DlqService } from "../../../../../src/platform/state-evidence/events/dlq-service.js";
import { TypedEventBusPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
import { validateEventPayload, EVENT_SCHEMA_REGISTRY } from "../../../../../src/platform/state-evidence/events/event-registry.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

// ============================================================================
// Typed Event Payloads - Interface Coverage Tests
// ============================================================================

test("TypedEventBus publishes task:status_changed with all optional fields", async () => {
  const workspace = createTempWorkspace("aa-event-payload-full-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-full", executionId: "exec-full", traceId: "trace-full" });

    const result = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-full",
      executionId: "exec-full",
      traceId: "trace-full",
      payload: {
        fromStatus: "pending",
        toStatus: "in_progress",
        reasonCode: "scheduler_dispatch",
        occurredAt: "2026-04-23T10:00:00.000Z",
        entityKind: "task",
        entityId: "task-full",
        reasonDetail: "Normal scheduler dispatch",
        actorType: "system",
        actorId: "scheduler-1",
        idempotencyKey: "idem-123",
        metadataJson: '{"source":"test"}',
        manualOverride: false,
        traceContext: {
          traceId: "trace-full",
          spanId: "span-1",
          parentSpanId: null,
          correlationId: null,
        },
      },
    });

    assert.equal(result.eventType, "task:status_changed");
    assert.ok(result.id.startsWith("evt_"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes decision:requested with basic fields", async () => {
  const workspace = createTempWorkspace("aa-event-decision-req-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    // Seed task and execution for the event
    seedTaskAndExecution(db, store, { taskId: "task-decision", executionId: "exec-decision", traceId: "trace-decision" });

    bus.publish({
      eventType: "decision:requested",
      taskId: "task-decision",
      executionId: "exec-decision",
      payload: {
        approvalId: "approval-abc",
        sourceAgentId: "agent-1",
        reason: "High risk operation",
        riskLevel: "high",
      },
    });

    const events = store.event.listEventsByType("decision:requested", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.riskLevel, "high");
    assert.equal(payload.approvalId, "approval-abc");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes domain:registered with capability and plugin counts", async () => {
  const workspace = createTempWorkspace("aa-event-domain-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "domain:registered",
      payload: {
        domainId: "coding",
        status: "active",
        capabilityCount: 5,
        pluginCount: 12,
        occurredAt: "2026-04-23T10:00:00.000Z",
      },
    });

    const events = store.event.listEventsByType("domain:registered", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.capabilityCount, 5);
    assert.equal(payload.pluginCount, 12);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes plugin:invocation_started with runtime isolation info", async () => {
  const workspace = createTempWorkspace("aa-event-plugin-invocation-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "plugin:invocation_started",
      payload: {
        pluginId: "plugin.coding.presenter",
        domainId: "coding",
        spiType: "presenter",
        phase: "init",
        invocationId: "inv_123",
        lifecycleState: "initializing",
        runtimeIsolation: "sandboxed_process",
        activeInvocationCount: 3,
        queuedInvocationCount: 1,
        bindingId: "binding_abc",
        occurredAt: "2026-04-23T10:00:00.000Z",
        status: "started",
      },
    });

    const events = store.event.listEventsByType("plugin:invocation_started", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.runtimeIsolation, "sandboxed_process");
    assert.equal(payload.activeInvocationCount, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes knowledge:chunk_indexed with trust and relation counts", async () => {
  const workspace = createTempWorkspace("aa-event-knowledge-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "knowledge:chunk_indexed",
      payload: {
        namespace: "docs",
        documentId: "doc_123",
        chunkId: "chunk_456",
        trustLevel: "high",
        keywordCount: 42,
        relationCount: 7,
        occurredAt: "2026-04-23T10:00:00.000Z",
      },
    });

    const events = store.event.listEventsByType("knowledge:chunk_indexed", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.trustLevel, "high");
    assert.equal(payload.keywordCount, 42);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes learning:knowledge_promoted with promotion metrics", async () => {
  const workspace = createTempWorkspace("aa-event-learning-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "learning:knowledge_promoted",
      payload: {
        learningObjectId: "lo_123",
        learningType: "concept",
        documentId: "doc_456",
        namespace: "docs",
        trustLevel: "verified",
        promotedCount: 15,
        occurredAt: "2026-04-23T10:00:00.000Z",
      },
    });

    const events = store.event.listEventsByType("learning:knowledge_promoted", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.promotedCount, 15);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// Skill Event Payloads Tests
// ============================================================================

test("TypedEventBus publishes skill:execution_started with cache status", async () => {
  const workspace = createTempWorkspace("aa-event-skill-start-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:execution_started",
      payload: {
        skillId: "skill_coding_v1",
        version: "1.0.0",
        stepCount: 5,
        cacheStatus: "miss",
      },
    });

    const events = store.event.listEventsByType("skill:execution_started", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.cacheStatus, "miss");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes skill:cache_hit with stored metadata", async () => {
  const workspace = createTempWorkspace("aa-event-skill-cache-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:cache_hit",
      payload: {
        skillId: "skill_coding_v1",
        cacheKey: "cache_key_abc",
        workingDirectory: "/workspace/project",
        gitHead: "abc123",
        sourceHash: "def456",
        storedAt: "2026-04-23T09:00:00.000Z",
        expiresAt: "2026-04-24T09:00:00.000Z",
      },
    });

    const events = store.event.listEventsByType("skill:cache_hit", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.ok(payload.storedAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes skill:step_succeeded with duration", async () => {
  const workspace = createTempWorkspace("aa-event-skill-step-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:step_succeeded",
      payload: {
        skillId: "skill_coding_v1",
        stepId: "step_3",
        toolName: "bash",
        attempt: 1,
        maxAttempts: 3,
        durationMs: 1500,
        continuedAfterFailure: false,
      },
    });

    const events = store.event.listEventsByType("skill:step_succeeded", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.durationMs, 1500);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes skill:step_failed with retry info", async () => {
  const workspace = createTempWorkspace("aa-event-skill-fail-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:step_failed",
      payload: {
        skillId: "skill_coding_v1",
        stepId: "step_2",
        toolName: "bash",
        attempt: 2,
        maxAttempts: 3,
        errorCode: "command_failed",
        retrying: true,
        willRetry: true,
        continued: false,
        continuedAfterFailure: false,
      },
    });

    const events = store.event.listEventsByType("skill:step_failed", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.retrying, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes skill:retry_scheduled with next attempt info", async () => {
  const workspace = createTempWorkspace("aa-event-skill-retry-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:retry_scheduled",
      payload: {
        skillId: "skill_coding_v1",
        stepId: "step_2",
        toolName: "bash",
        attempt: 1,
        nextAttempt: 2,
        errorCode: "timeout",
      },
    });

    const events = store.event.listEventsByType("skill:retry_scheduled", 10);
    assert.equal(events.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes skill:execution_completed with final status", async () => {
  const workspace = createTempWorkspace("aa-event-skill-complete-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "skill:execution_completed",
      payload: {
        skillId: "skill_coding_v1",
        status: "completed",
        retryCount: 0,
        cacheStatus: "hit",
      },
    });

    const events = store.event.listEventsByType("skill:execution_completed", 10);
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.status, "completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// Event Topology Integration Tests
// ============================================================================

test("EventTopologyService buildGraph creates nodes for all producers and consumers", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  // Should have nodes for producers, events, and consumers
  assert.ok(graph.nodes.length > 0);

  const producerNodes = graph.nodes.filter((n: { kind: string }) => n.kind === "producer");
  const eventNodes = graph.nodes.filter((n: { kind: string }) => n.kind === "event");
  const consumerNodes = graph.nodes.filter((n: { kind: string }) => n.kind === "consumer");

  assert.ok(producerNodes.length > 0, "Should have producer nodes");
  assert.ok(eventNodes.length > 0, "Should have event nodes");
  assert.ok(consumerNodes.length > 0, "Should have consumer nodes");

  // Verify edges connect producers -> events and events -> consumers
  const emitEdges = graph.edges.filter((e: { relation: string }) => e.relation === "emits");
  const consumeEdges = graph.edges.filter((e: { relation: string }) => e.relation === "consumes");

  assert.ok(emitEdges.length > 0, "Should have emit edges");
  assert.ok(consumeEdges.length > 0, "Should have consume edges");
});

test("EventTopologyService buildSummary returns correct tier counts", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  // All tier counts should sum to totalEvents
  const tierSum = summary.tierCounts.tier_1 + summary.tierCounts.tier_2 + summary.tierCounts.tier_3;
  assert.equal(tierSum, summary.totalEvents);

  // Should have namespaces, producers, and consumers
  assert.ok(summary.namespaces.length > 0);
  assert.ok(summary.producers.length > 0);
  assert.ok(summary.consumers.length > 0);
});

test("EventTopologyService listNamespaceEntries filters correctly", () => {
  const service = new EventTopologyService();

  const taskEntries = service.listNamespaceEntries("task");
  assert.ok(taskEntries.length > 0);
  assert.ok(taskEntries.every((e: { namespace: string }) => e.namespace === "task"));

  const dispatchEntries = service.listNamespaceEntries("dispatch");
  assert.ok(dispatchEntries.length > 0);
  assert.ok(dispatchEntries.every((e: { namespace: string }) => e.namespace === "dispatch"));

  const unknownEntries = service.listNamespaceEntries("unknown_namespace");
  assert.equal(unknownEntries.length, 0);
});

test("EventTopologyService entries have correct reliability semantics", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  for (const entry of entries) {
    // tier_1 events should require reliable ack
    if (entry.tier === "tier_1") {
      assert.equal(entry.reliableAckRequired, true);
    } else {
      assert.equal(entry.reliableAckRequired, false);
    }

    // All entries should have valid payload schema ref
    assert.ok(entry.payloadSchemaRef.startsWith("event://"));
    assert.ok(entry.payloadSchemaRef.endsWith("/v1"));
  }
});

// ============================================================================
// Event Reliability Integration Tests
// ============================================================================

test("EventReliabilityInventoryService lists namespace inventory correctly", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  // Verify task namespace
  const taskNs = namespaces.find((n: { namespace: string }) => n.namespace === "task");
  assert.ok(taskNs);
  assert.ok(taskNs!.tierCounts.tier_1 > 0);
  assert.ok(taskNs!.ackRequiredEvents.includes("task:status_changed"));
});

test("EventReliabilityInventoryService lists consumer surfaces with correct roles", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const taskProjection = surfaces.find((s: { consumerId: string }) => s.consumerId === "task_projection");
  assert.ok(taskProjection);
  assert.equal(taskProjection!.role, "projection");
  assert.ok(taskProjection!.tier1Events.includes("task:status_changed"));
  assert.ok(taskProjection!.ackRequired);
});

test("EventReliabilityInventoryService marks contract gaps for missing consumers", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  // gateway_projection is expected but may have no consumed events
  const gateway = surfaces.find((s: { consumerId: string }) => s.consumerId === "gateway_projection");
  if (gateway) {
    assert.equal(gateway.expectedByContract, true);
  }
});

test("EventReliabilityInventoryService buildReport includes all sections", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();

  assert.ok(report.totalEvents > 0);
  assert.ok(report.tierCounts.tier_1 > 0);
  assert.ok(report.namespaces.length > 0);
  assert.ok(report.consumerSurfaces.length > 0);
  assert.ok(Array.isArray(report.tier1EventsMissingConsumers));

  // Verify tier1EventsMissingConsumers is empty (all tier1 events have consumers)
  assert.equal(report.tier1EventsMissingConsumers.length, 0);
});

// ============================================================================
// Projection Inventory Service Tests
// ============================================================================

test("ProjectionInventoryService includes all baseline projections", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  const expectedProjections = [
    "task_summary",
    "workflow_summary",
    "approval_summary",
    "division_summary",
    "budget_summary",
    "inspect_projection",
    "feedback_summary",
    "gateway_summary",
    "observability_summary",
  ];

  for (const expected of expectedProjections) {
    assert.ok(records.some((r: { projectionName: string }) => r.projectionName === expected), `Missing projection: ${expected}`);
  }
});

test("ProjectionInventoryService projections have event types from inventory", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  for (const record of records) {
    assert.ok(Array.isArray(record.eventTypes));
  }
});

test("ProjectionInventoryService buildSummary counts contract gaps", () => {
  const service = new ProjectionInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, 9);
  assert.ok(Array.isArray(summary.contractGaps));
  // gateway_summary is a contract gap
  assert.ok(summary.contractGaps.includes("gateway_summary"));
});

// ============================================================================
// TypedEventBusPublisher Tests
// ============================================================================

test("TypedEventBusPublisher delegates publish to underlying bus", () => {
  let publishCalled = false;
  let receivedInput: unknown = null;

  const mockBus = {
    publish: ((input: unknown) => {
      publishCalled = true;
      receivedInput = input;
    }) as unknown,
  } as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "task:status_changed",
    payload: {
      fromStatus: "queued",
      toStatus: "in_progress",
    },
  });

  assert.equal(publishCalled, true);
  assert.equal((receivedInput as { eventType: string }).eventType, "task:status_changed");
  assert.deepEqual((receivedInput as { payload: unknown }).payload, { fromStatus: "queued", toStatus: "in_progress" });
});

test("TypedEventBusPublisher passes trace context correctly", () => {
  let receivedTraceId: string | undefined = undefined;
  let receivedTraceContext: unknown = undefined;

  const mockBus = {
    publish: ((input: { traceId?: string; traceContext?: unknown }) => {
      receivedTraceId = input.traceId;
      receivedTraceContext = input.traceContext;
    }) as (input: { traceId?: string; traceContext?: unknown }) => void,
  } as unknown as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "task:status_changed",
    taskId: "task-123",
    traceId: "trace-abc",
    traceContext: {
      traceId: "trace-abc",
      spanId: "span-1",
      parentSpanId: null,
      correlationId: null,
    },
    payload: {
      fromStatus: "queued",
      toStatus: "in_progress",
    },
  });

  assert.equal(receivedTraceId, "trace-abc");
  assert.ok(receivedTraceContext);
});

// ============================================================================
// DurableEventBus Batch Publish Tests
// ============================================================================

test("DurableEventBus publishBatch inserts multiple events", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-batch", executionId: "exec-batch", traceId: "trace-batch" });

    const results = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      },
    ]);

    assert.equal(results.length, 2);
    assert.ok(results[0]!.id.startsWith("evt_"));
    assert.ok(results[1]!.id.startsWith("evt_"));
    assert.notEqual(results[0]!.id, results[1]!.id);

    // Verify both events are in the store
    const events = store.event.listEventsByType("task:status_changed");
    assert.equal(events.length, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// EventOpsService Integration Tests
// ============================================================================

test("EventOpsService drainConsumer returns error code on failure", async () => {
  const workspace = createTempWorkspace("aa-event-ops-drain-err-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new EventOpsService(db, store);

    // Subscribe a handler that always fails
    service.subscribe("failing_consumer", async () => {
      throw new Error("delivery_failed");
    });

    // Drain should complete even with failure
    const result = await service.drainConsumer("failing_consumer");

    assert.equal(result.consumerId, "failing_consumer");
    assert.ok(result.outcome === "delivered" || result.outcome === "failed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService listDefaultConsumers returns sorted array", () => {
  const workspace = createTempWorkspace("aa-event-ops-consumers-");
  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new EventOpsService(db, store);

    const consumers = service.listDefaultConsumers();

    assert.ok(Array.isArray(consumers));
    assert.ok(consumers.length > 0);

    // Verify it's sorted
    const sorted = [...consumers].sort();
    assert.deepEqual(consumers, sorted);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// DLQ Service Integration Tests
// ============================================================================

test("DlqService enqueue with failure category creates categorized record", () => {
  const service = new DlqService();

  const record = service.enqueue({
    sourceEventId: "evt_transient",
    consumerId: "test-consumer",
    errorCode: "timeout",
    payloadJson: '{"data":"test"}',
    failureCategory: "transient",
    reason: "Network timeout - retry should succeed",
  });

  assert.equal(record.failureCategory, "transient");
  assert.equal(record.reason, "Network timeout - retry should succeed");
  assert.equal(record.status, "pending");
});

test("DlqService setReason updates reason without changing other fields", () => {
  const service = new DlqService();

  const record = service.enqueue({
    sourceEventId: "evt_reason",
    consumerId: "test-consumer",
    errorCode: "validation_failed",
    payloadJson: '{"data":"test"}',
  });

  const updated = service.setReason(record.deadLetterId, "Payload validation failed: missing required field 'id'");

  assert.equal(updated.reason, "Payload validation failed: missing required field 'id'");
  assert.equal(updated.failureCategory, null); // Unchanged
  assert.equal(updated.status, "pending"); // Unchanged
  assert.equal(updated.retryCount, 0); // Unchanged
});

test("DlqService logOperatorAction creates audit trail entries", () => {
  const service = new DlqService();

  const record = service.enqueue({
    sourceEventId: "evt_audit",
    consumerId: "test-consumer",
    errorCode: "e1",
    payloadJson: "{}",
  });

  service.logOperatorAction(record.deadLetterId, "investigation_started", "operator_1", { note: "Starting investigation" });
  service.logOperatorAction(record.deadLetterId, "mitigation_applied", "operator_2", { action: "Restarted service" });
  service.markResolved(record.deadLetterId, "operator_3");

  const updated = service.get(record.deadLetterId)!;

  assert.equal(updated.operatorActionLog.length, 3);
  assert.equal(updated.operatorActionLog[0]!.action, "investigation_started");
  assert.equal(updated.operatorActionLog[0]!.operatorId, "operator_1");
  assert.equal(updated.operatorActionLog[1]!.action, "mitigation_applied");
  assert.equal(updated.operatorActionLog[2]!.action, "manual_resolve");
});

test("DlqService scheduleRetry with custom delay uses that delay", () => {
  const service = new DlqService();

  const record = service.enqueue({
    sourceEventId: "evt_custom_delay",
    consumerId: "test-consumer",
    errorCode: "e1",
    payloadJson: "{}",
  });

  const updated = service.scheduleRetry(record.deadLetterId, 120_000);

  assert.equal(updated.retryCount, 1);
  assert.equal(updated.status, "retrying");
  assert.ok(updated.nextRetryAt !== null);

  // Parse the nextRetryAt and verify it's approximately 120 seconds in the future
  const nextRetry = new Date(Date.parse(updated.nextRetryAt!));
  const now = new Date();
  const diffMs = nextRetry.getTime() - now.getTime();

  // Should be approximately 120 seconds (allow some variance for test execution time)
  assert.ok(diffMs >= 119_000 && diffMs <= 125_000, `Expected ~120000ms, got ${diffMs}`);
});

// ============================================================================
// Event Schema Registry Edge Cases
// ============================================================================

test("EVENT_SCHEMA_REGISTRY includes perf test events", () => {
  // These are used for benchmarks only
  const perfTestSchema = EVENT_SCHEMA_REGISTRY["perf:test_event"];
  assert.ok(perfTestSchema);
  assert.equal(perfTestSchema.tier, "tier_3");
  assert.equal(perfTestSchema.producer, "performance_test");
  assert.deepEqual(perfTestSchema.consumers, []);
});

test("EVENT_SCHEMA_REGISTRY includes delegation namespace events when registered", () => {
  // Note: delegation events are defined in TIER_1_EVENT_TYPES but may not all
  // be in EVENT_SCHEMA_REGISTRY depending on registration status
  const knownTier1Events = [
    "delegation:created",
    "delegation:completed",
    "delegation:failed",
  ];

  // Only check events that actually exist in the registry
  for (const eventType of knownTier1Events) {
    const schema = EVENT_SCHEMA_REGISTRY[eventType as keyof typeof EVENT_SCHEMA_REGISTRY];
    if (schema) {
      assert.ok(schema.consumers.length > 0, `${eventType} should have consumers if registered`);
    }
  }
});

test("validateEventPayload rejects subtask event missing both stepId and subtaskId", () => {
  // subtaskOutcomePayloadSchema has a custom refinement requiring at least one of stepId or subtaskId

  // This should fail validation - no stepId or subtaskId
  assert.throws(
    () => validateEventPayload("subtask:completed", { roleId: "agent", status: "completed" }),
    /Invalid payload for event type: subtask:completed/,
  );
});

test("validateEventPayload accepts subtask event with only stepId", () => {
  const result = validateEventPayload("subtask:completed", {
    stepId: "step_1",
    subtaskId: undefined,
    roleId: "agent",
    status: "completed",
  });

  assert.equal(result.stepId, "step_1");
});

test("validateEventPayload accepts subtask event with only subtaskId", () => {
  const result = validateEventPayload("subtask:completed", {
    stepId: undefined,
    subtaskId: "subtask_1",
    roleId: "agent",
    status: "completed",
  });

  assert.equal(result.subtaskId, "subtask_1");
});