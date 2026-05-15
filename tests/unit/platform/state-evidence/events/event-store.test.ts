/**
 * Unit tests for Event Store related services.
 *
 * Tests EventTopologyService and EventReliabilityInventoryService.
 * Uses manual mock objects and in-memory implementations.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Import services under test
import { EventTopologyService } from "../../../../../src/platform/five-plane-state-evidence/events/event-topology-service.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/five-plane-state-evidence/events/event-reliability-inventory-service.js";
import { DlqService, type FailureCategory } from "../../../../../src/platform/five-plane-state-evidence/events/dlq-service.js";

// Import registry for validation
import { EVENT_SCHEMA_REGISTRY } from "../../../../../src/platform/five-plane-state-evidence/events/event-registry.js";

test("EventTopologyService.listEntries returns all registered events", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  assert.ok(entries.length > 0, "Should have at least some events");
  assert.ok(entries.some((e) => e.eventType === "task:status_changed"), "Should include task:status_changed");
  assert.ok(entries.some((e) => e.eventType === "stream:chunk_emitted"), "Should include stream:chunk_emitted");
});

test("EventTopologyService.listEntries includes namespace tier and consumer info", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  const taskEntry = entries.find((e) => e.eventType === "task:status_changed");
  assert.ok(taskEntry, "Should find task:status_changed entry");
  assert.equal(taskEntry!.namespace, "task");
  assert.ok(taskEntry!.tier === "tier_1" || taskEntry!.tier === "tier_2" || taskEntry!.tier === "tier_3");
  assert.ok(Array.isArray(taskEntry!.consumers));
  assert.equal(typeof taskEntry!.payloadSchemaRef, "string");
});

test("EventTopologyService.buildGraph returns nodes and edges", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  assert.ok(Array.isArray(graph.nodes), "Should have nodes array");
  assert.ok(Array.isArray(graph.edges), "Should have edges array");
  assert.ok(graph.nodes.length > 0, "Should have some nodes");

  // Verify node structure
  const node = graph.nodes[0]!;
  assert.ok(typeof node.nodeId === "string");
  assert.ok(node.kind === "producer" || node.kind === "event" || node.kind === "consumer");

  // Verify edge structure
  const edge = graph.edges[0]!;
  assert.ok(typeof edge.source === "string");
  assert.ok(typeof edge.target === "string");
  assert.ok(edge.relation === "emits" || edge.relation === "consumes");
});

test("EventTopologyService.buildGraph producer nodes have correct kind", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  const producerNodes = graph.nodes.filter((n) => n.kind === "producer");
  assert.ok(producerNodes.length > 0, "Should have producer nodes");

  for (const node of producerNodes) {
    assert.ok(node.nodeId.startsWith("producer:"), `Producer node ID should start with producer:, got: ${node.nodeId}`);
  }
});

test("EventTopologyService.buildGraph event nodes have correct kind", () => {
  const service = new EventTopologyService();
  const graph = service.buildGraph();

  const eventNodes = graph.nodes.filter((n) => n.kind === "event");
  assert.ok(eventNodes.length > 0, "Should have event nodes");

  for (const node of eventNodes) {
    assert.ok(node.nodeId.startsWith("event:"), `Event node ID should start with event:, got: ${node.nodeId}`);
  }
});

test("EventTopologyService.buildSummary returns correct statistics", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  assert.ok(typeof summary.totalEvents === "number");
  assert.ok(Array.isArray(summary.namespaces));
  assert.ok(Array.isArray(summary.producers));
  assert.ok(Array.isArray(summary.consumers));
  assert.ok(typeof summary.tierCounts === "object");
  assert.ok("tier_1" in summary.tierCounts);
  assert.ok("tier_2" in summary.tierCounts);
  assert.ok("tier_3" in summary.tierCounts);
});

test("EventTopologyService.buildSummary namespaces are sorted", () => {
  const service = new EventTopologyService();
  const summary = service.buildSummary();

  const sorted = [...summary.namespaces].sort();
  assert.deepEqual(summary.namespaces, sorted, "Namespaces should be sorted");
});

test("EventTopologyService.listNamespaceEntries filters by namespace", () => {
  const service = new EventTopologyService();
  const taskEntries = service.listNamespaceEntries("task");

  assert.ok(taskEntries.length > 0, "Should have task entries");
  for (const entry of taskEntries) {
    assert.equal(entry.namespace, "task", "All entries should be in task namespace");
    assert.ok(entry.eventType.startsWith("task:"), "Event type should start with task:");
  }
});

test("EventTopologyService.listNamespaceEntries returns empty for unknown namespace", () => {
  const service = new EventTopologyService();
  const entries = service.listNamespaceEntries("nonexistent_namespace_xyz");

  assert.equal(entries.length, 0, "Should return empty array for unknown namespace");
});

test("EventTopologyService reliableAckRequired is true for tier_1 events", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();

  const tier1Entries = entries.filter((e) => e.tier === "tier_1");
  assert.ok(tier1Entries.length > 0, "Should have tier_1 events");

  for (const entry of tier1Entries) {
    assert.equal(entry.reliableAckRequired, true, `${entry.eventType} should require reliable ack`);
  }
});

test("EventReliabilityInventoryService.listEventEntries covers all events", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  assert.equal(entries.length, Object.keys(EVENT_SCHEMA_REGISTRY).length, "Should have entry for each registered event");
});

test("EventReliabilityInventoryService.listEventEntries marks tier correctly", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  for (const entry of entries) {
    const schema = EVENT_SCHEMA_REGISTRY[entry.eventType as keyof typeof EVENT_SCHEMA_REGISTRY];
    assert.ok(schema, `Entry ${entry.eventType} should have matching schema`);
    assert.equal(entry.tier, schema.tier, `Tier should match schema for ${entry.eventType}`);
  }
});

test("EventReliabilityInventoryService ackRequired is tier_1 only", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  for (const entry of entries) {
    assert.equal(entry.ackRequired, entry.tier === "tier_1", `ackRequired should be true only for tier_1, got ${entry.tier} for ${entry.eventType}`);
    assert.equal(entry.replayRequired, entry.tier === "tier_1", `replayRequired should be true only for tier_1, got ${entry.tier} for ${entry.eventType}`);
  }
});

test("EventReliabilityInventoryService dlqEligible excludes tier_3", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  for (const entry of entries) {
    if (entry.tier === "tier_3") {
      assert.equal(entry.dlqEligible, false, "tier_3 events should not be DLQ eligible");
    } else {
      assert.equal(entry.dlqEligible, true, "tier_1 and tier_2 events should be DLQ eligible");
    }
  }
});

test("EventReliabilityInventoryService listNamespaceInventory groups correctly", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  assert.ok(namespaces.length > 0, "Should have some namespaces");

  for (const ns of namespaces) {
    assert.ok(typeof ns.namespace === "string");
    assert.ok(typeof ns.totalEvents === "number");
    assert.ok(Array.isArray(ns.producers));
    assert.ok(Array.isArray(ns.consumers));
    assert.ok(Array.isArray(ns.ackRequiredEvents));
    assert.ok(Array.isArray(ns.replayRequiredEvents));
    assert.ok(Array.isArray(ns.dlqEligibleEvents));
  }
});

test("EventReliabilityInventoryService listConsumerSurfaces includes expected consumers", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const consumerIds = surfaces.map((s) => s.consumerId);

  // Expected consumers from contract
  assert.ok(consumerIds.includes("task_projection"), "Should include task_projection");
  assert.ok(consumerIds.includes("workflow_projection"), "Should include workflow_projection");
  assert.ok(consumerIds.includes("inspect_projection"), "Should include inspect_projection");
});

test("EventReliabilityInventoryService listConsumerSurfaces marks contract compliance", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  for (const surface of surfaces) {
    assert.ok(typeof surface.role === "string");
    assert.ok(typeof surface.expectedByContract === "boolean");
    assert.ok(typeof surface.ackRequired === "boolean");
    assert.ok(typeof surface.replayRequired === "boolean");
    assert.ok(typeof surface.consumedEvents === "object");
  }
});

test("EventReliabilityInventoryService buildReport returns complete structure", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();

  assert.ok(typeof report.totalEvents === "number");
  assert.ok(typeof report.tierCounts === "object");
  assert.ok(Array.isArray(report.namespaces));
  assert.ok(Array.isArray(report.consumerSurfaces));
  assert.ok(Array.isArray(report.tier1EventsMissingConsumers));
  assert.ok(report.dlqSummary === null || typeof report.dlqSummary === "object");
});

test("DlqService.enqueue creates record with correct fields", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_123",
    consumerId: "task_projection",
    errorCode: "handler_failed",
    errorMessage: "Connection refused",
    payloadJson: '{"data":"test"}',
  });

  assert.ok(record.deadLetterId.startsWith("dlq_"));
  assert.equal(record.sourceEventId, "evt_123");
  assert.equal(record.consumerId, "task_projection");
  assert.equal(record.errorCode, "handler_failed");
  assert.equal(record.errorMessage, "Connection refused");
  assert.equal(record.payloadJson, '{"data":"test"}');
  assert.equal(record.status, "pending");
  assert.equal(record.retryCount, 0);
  assert.ok(record.operatorActionLog.length === 0);
});

test("DlqService.scheduleRetry updates retry count and nextRetryAt", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_retry",
    consumerId: "test_consumer",
    errorCode: "transient",
    payloadJson: '{}',
  });

  assert.equal(record.status, "pending");
  assert.equal(record.retryCount, 0);

  const updated = service.scheduleRetry(record.deadLetterId);

  assert.equal(updated.status, "retrying");
  assert.equal(updated.retryCount, 1);
  assert.ok(updated.nextRetryAt !== null, "Should have nextRetryAt set");
});

test("DlqService.scheduleRetry uses exponential backoff", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_backoff",
    consumerId: "test_consumer",
    errorCode: "transient",
    payloadJson: '{}',
  });

  const first = service.scheduleRetry(record.deadLetterId);
  assert.equal(first.retryCount, 1, "First retry should have retryCount 1");
  assert.ok(first.nextRetryAt !== null, "First retry should have nextRetryAt");

  // Create another record for second retry to compare delays
  const record2 = service.enqueue({
    sourceEventId: "evt_backoff2",
    consumerId: "test_consumer",
    errorCode: "transient",
    payloadJson: '{}',
  });

  // First retry on record2
  const firstOfSecond = service.scheduleRetry(record2.deadLetterId);
  // Second retry on record2
  const secondOfSecond = service.scheduleRetry(record2.deadLetterId);

  // Second retry should have longer delay than first retry on same record
  const firstDelay = new Date(firstOfSecond.nextRetryAt!).getTime() - Date.parse(firstOfSecond.createdAt);
  const secondDelay = new Date(secondOfSecond.nextRetryAt!).getTime() - Date.parse(secondOfSecond.createdAt);

  assert.ok(secondDelay > firstDelay, `Second delay (${secondDelay}ms) should be longer than first delay (${firstDelay}ms)`);
});

test("DlqService.markResolved updates status and logs action", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_resolve",
    consumerId: "test_consumer",
    errorCode: "failed",
    payloadJson: '{}',
  });

  const resolved = service.markResolved(record.deadLetterId, "operator-abc");

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.operatorActionLog.length, 1);
  assert.equal(resolved.operatorActionLog[0]!.action, "manual_resolve");
  assert.equal(resolved.operatorActionLog[0]!.operatorId, "operator-abc");
});

test("DlqService.discard updates status with reason", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_discard",
    consumerId: "test_consumer",
    errorCode: "failed",
    payloadJson: '{}',
  });

  const discarded = service.discard(record.deadLetterId, "Payload malformed - cannot retry", "op-123");

  assert.equal(discarded.status, "discarded");
  assert.equal(discarded.errorCode, "Payload malformed - cannot retry");
  assert.equal(discarded.operatorActionLog[0]!.action, "manual_discard");
});

test("DlqService.setFailureCategory records category change", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_cat",
    consumerId: "test_consumer",
    errorCode: "timeout",
    payloadJson: '{}',
  });

  const updated = service.setFailureCategory(record.deadLetterId, "timeout", "op-abc");

  assert.equal(updated.failureCategory, "timeout");
  assert.equal(updated.operatorActionLog[0]!.action, "category_changed");
});

test("DlqService.listByConsumer filters correctly", () => {
  const service = new DlqService();

  service.enqueue({ sourceEventId: "evt1", consumerId: "consumer_a", errorCode: "err", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt2", consumerId: "consumer_b", errorCode: "err", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt3", consumerId: "consumer_a", errorCode: "err", payloadJson: "{}" });

  const consumerARecords = service.listByConsumer("consumer_a");
  const consumerBRecords = service.listByConsumer("consumer_b");

  assert.equal(consumerARecords.length, 2, "consumer_a should have 2 records");
  assert.equal(consumerBRecords.length, 1, "consumer_b should have 1 record");
});

test("DlqService.listByStatus filters correctly", () => {
  const service = new DlqService();

  const r1 = service.enqueue({ sourceEventId: "evt1", consumerId: "c", errorCode: "e", payloadJson: "{}" });
  const r2 = service.enqueue({ sourceEventId: "evt2", consumerId: "c", errorCode: "e", payloadJson: "{}" });

  service.markResolved(r1.deadLetterId);

  const pending = service.listByStatus("pending");
  const resolved = service.listByStatus("resolved");

  assert.equal(pending.length, 1);
  assert.equal(resolved.length, 1);
});

test("DlqService.summarize returns correct statistics", () => {
  const service = new DlqService();

  service.enqueue({ sourceEventId: "evt1", consumerId: "c1", errorCode: "err", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt2", consumerId: "c1", errorCode: "err", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt3", consumerId: "c2", errorCode: "err", payloadJson: "{}" });

  const summary = service.summarize();

  assert.equal(summary.totalRecords, 3);
  assert.ok("pending" in summary.statusCounts);
  assert.ok("retrying" in summary.statusCounts);
  assert.ok("consumerCounts" in summary);
  assert.equal(summary.consumerCounts["c1"], 2);
  assert.equal(summary.consumerCounts["c2"], 1);
});

test("DlqService.cancelRetry clears retry state", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_cancel",
    consumerId: "test_consumer",
    errorCode: "err",
    payloadJson: '{}',
  });

  service.scheduleRetry(record.deadLetterId);
  const cancelled = service.cancelRetry(record.deadLetterId, "op-cancel");

  assert.equal(cancelled.status, "pending");
  assert.equal(cancelled.nextRetryAt, null);
});

test("DlqService.logOperatorAction adds to action log", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_log",
    consumerId: "test_consumer",
    errorCode: "err",
    payloadJson: '{}',
  });

  const beforeCount = record.operatorActionLog.length;

  service.logOperatorAction(record.deadLetterId, "investigation_started", "investigator-1", { note: "Looking into this" });

  const after = service.get(record.deadLetterId)!;
  assert.equal(after.operatorActionLog.length, beforeCount + 1);
  assert.equal(after.operatorActionLog[after.operatorActionLog.length - 1]!.action, "investigation_started");
});

test("DlqService.markRetryExhausted sets retryExhaustedAt", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_exhausted",
    consumerId: "test_consumer",
    errorCode: "err",
    payloadJson: '{}',
  });

  // Exhaust retries
  for (let i = 0; i < 5; i++) {
    service.scheduleRetry(record.deadLetterId);
  }

  const exhausted = service.markRetryExhausted(record.deadLetterId);

  assert.equal(exhausted.retryExhaustedAt !== null, true, "Should have retryExhaustedAt set");
  assert.equal(exhausted.operatorActionLog.some((a) => a.action === "retry_exhausted"), true);
});

test("EventTopologyService entries cover all known event types from registry", () => {
  const service = new EventTopologyService();
  const entries = service.listEntries();
  const entryTypes = new Set(entries.map((e) => e.eventType));

  for (const eventType of Object.keys(EVENT_SCHEMA_REGISTRY)) {
    assert.ok(entryTypes.has(eventType), `Entry should exist for ${eventType}`);
  }
});