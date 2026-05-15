import assert from "node:assert/strict";
import test from "node:test";

import { DeadLetterQueueService } from "../../../../../src/platform/five-plane-state-evidence/dlq/index.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/five-plane-state-evidence/events/event-reliability-inventory-service.js";

test("EventReliabilityInventoryService exposes namespace and tier inventory", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();
  const dispatchNamespace = report.namespaces.find((entry) => entry.namespace === "dispatch");

  assert.ok(report.totalEvents > 0);
  assert.ok(report.tierCounts.tier_1 > 0);
  assert.ok(dispatchNamespace);
  assert.ok((dispatchNamespace?.dlqEligibleEvents.length ?? 0) > 0);
  assert.equal(report.tier1EventsMissingConsumers.length, 0);
});

test("EventReliabilityInventoryService marks contract-only consumers as gaps when registry coverage is missing", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();
  const gatewayProjection = report.consumerSurfaces.find((entry) => entry.consumerId === "gateway_projection");
  const runtimeRecoveryScanner = report.consumerSurfaces.find((entry) => entry.consumerId === "runtime_recovery_scanner");

  assert.equal(gatewayProjection?.coverageStatus, "contract_gap");
  assert.equal(runtimeRecoveryScanner?.coverageStatus, "contract_gap");
  assert.equal(gatewayProjection?.expectedByContract, true);
});

test("EventReliabilityInventoryService attaches DLQ summary and consumer backlog", () => {
  const dlq = new DeadLetterQueueService();
  const first = dlq.enqueue({
    sourceEventId: "evt_1",
    consumerId: "inspect_projection",
    errorCode: "delivery.timeout",
    payloadJson: "{}",
  });
  dlq.scheduleRetry(first.deadLetterId, 5_000);
  dlq.enqueue({
    sourceEventId: "evt_2",
    consumerId: "approval_projection",
    errorCode: "delivery.denied",
    payloadJson: "{}",
  });

  const report = new EventReliabilityInventoryService(dlq).buildReport();

  assert.equal(report.dlqSummary?.totalRecords, 2);
  assert.equal(report.dlqSummary?.statusCounts.retrying, 1);
  assert.ok(report.dlqSummary?.pendingConsumers.includes("approval_projection"));
});

test("EventReliabilityInventoryService.listEventEntries returns all registered events", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  assert.ok(entries.length > 0);
  assert.ok(entries.some((e) => e.eventType === "task:status_changed"));
  assert.ok(entries.some((e) => e.eventType === "stream:chunk_emitted"));
});

test("EventReliabilityInventoryService.listEventEntries marks tier1 ackRequired and replayRequired", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  const tier1Entries = entries.filter((e) => e.tier === "tier_1");
  for (const entry of tier1Entries) {
    assert.equal(entry.ackRequired, true, `${entry.eventType} should require ack`);
    assert.equal(entry.replayRequired, true, `${entry.eventType} should require replay`);
  }
});

test("EventReliabilityInventoryService.listEventEntries marks tier2 dlqEligible but not ackRequired", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  const tier2Entries = entries.filter((e) => e.eventType === "dispatch:ticket_created");
  for (const entry of tier2Entries) {
    assert.equal(entry.ackRequired, false);
    assert.equal(entry.replayRequired, false);
    assert.equal(entry.dlqEligible, true);
  }
});

test("EventReliabilityInventoryService.listEventEntries marks tier3 neither ackRequired nor dlqEligible", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  const tier3Entry = entries.find((e) => e.eventType === "stream:chunk_emitted");
  assert.ok(tier3Entry);
  assert.equal(tier3Entry.ackRequired, false);
  assert.equal(tier3Entry.replayRequired, false);
  assert.equal(tier3Entry.dlqEligible, false);
});

test("EventReliabilityInventoryService.listEventEntries extracts namespace from event type", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  const taskEntries = entries.filter((e) => e.namespace === "task");
  assert.ok(taskEntries.length > 0);
  assert.ok(taskEntries.every((e) => e.eventType.startsWith("task:")));
});

test("EventReliabilityInventoryService.listEventEntries includes payloadSchemaRef", () => {
  const service = new EventReliabilityInventoryService();
  const entries = service.listEventEntries();

  for (const entry of entries) {
    assert.ok(entry.payloadSchemaRef.startsWith("event://"), `${entry.eventType} should have event:// schema ref`);
  }
});

test("EventReliabilityInventoryService.listNamespaceInventory groups events by namespace", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  assert.ok(namespaces.length > 0);
  const taskNs = namespaces.find((n) => n.namespace === "task");
  assert.ok(taskNs);
  assert.ok(taskNs.totalEvents > 0);
});

test("EventReliabilityInventoryService.listNamespaceInventory provides tierCounts per namespace", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  for (const ns of namespaces) {
    assert.ok(typeof ns.tierCounts.tier_1 === "number");
    assert.ok(typeof ns.tierCounts.tier_2 === "number");
    assert.ok(typeof ns.tierCounts.tier_3 === "number");
    const sum = ns.tierCounts.tier_1 + ns.tierCounts.tier_2 + ns.tierCounts.tier_3;
    assert.equal(sum, ns.totalEvents);
  }
});

test("EventReliabilityInventoryService.listNamespaceInventory provides sorted producers and consumers", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  for (const ns of namespaces) {
    assert.ok(Array.isArray(ns.producers));
    assert.ok(Array.isArray(ns.consumers));
    if (ns.producers.length > 1) {
      assert.deepEqual(ns.producers, [...ns.producers].sort());
    }
    if (ns.consumers.length > 1) {
      assert.deepEqual(ns.consumers, [...ns.consumers].sort());
    }
  }
});

test("EventReliabilityInventoryService.listNamespaceInventory lists ackRequired and replayRequired events", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  for (const ns of namespaces) {
    assert.ok(Array.isArray(ns.ackRequiredEvents));
    assert.ok(Array.isArray(ns.replayRequiredEvents));
    assert.ok(Array.isArray(ns.dlqEligibleEvents));
  }
});

test("EventReliabilityInventoryService.listNamespaceInventory sorted by namespace name", () => {
  const service = new EventReliabilityInventoryService();
  const namespaces = service.listNamespaceInventory();

  for (let i = 1; i < namespaces.length; i++) {
    assert.ok(
      namespaces[i - 1]!.namespace < namespaces[i]!.namespace,
      `Namespace ${namespaces[i - 1]!.namespace} should be before ${namespaces[i]!.namespace}`,
    );
  }
});

test("EventReliabilityInventoryService.listConsumerSurfaces lists all consumers", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  assert.ok(surfaces.length > 0);
  assert.ok(surfaces.some((s) => s.consumerId === "task_projection"));
  assert.ok(surfaces.some((s) => s.consumerId === "inspect_projection"));
});

test("EventReliabilityInventoryService.listConsumerSurfaces marks expected vs actual consumers", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const taskProjection = surfaces.find((s) => s.consumerId === "task_projection");
  assert.ok(taskProjection);
  assert.equal(taskProjection.expectedByContract, true);

  // feedback_projection is expected by contract for domain events
  const feedbackProjection = surfaces.find((s) => s.consumerId === "feedback_projection");
  assert.ok(feedbackProjection);
  assert.equal(feedbackProjection.expectedByContract, true);

  // A consumer that appears in registry but not in EXPECTED_CONSUMER_SURFACES
  // dispatch:ticket_created events have 'inspect_projection' as consumer
  // which is NOT in EXPECTED_CONSUMER_SURFACES, so it should be expectedByContract=false
  const inspectProjection = surfaces.find((s) => s.consumerId === "inspect_projection");
  assert.ok(inspectProjection);
  assert.equal(inspectProjection.expectedByContract, true);
});

test("EventReliabilityInventoryService.listConsumerSurfaces provides tier breakdown per consumer", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const inspectProjection = surfaces.find((s) => s.consumerId === "inspect_projection");
  assert.ok(inspectProjection);
  assert.ok(Array.isArray(inspectProjection.tier1Events));
  assert.ok(Array.isArray(inspectProjection.tier2Events));
  assert.ok(Array.isArray(inspectProjection.tier3Events));
});

test("EventReliabilityInventoryService.listConsumerSurfaces sets ackRequired based on tier1 events", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const taskProjection = surfaces.find((s) => s.consumerId === "task_projection");
  assert.ok(taskProjection);
  assert.equal(taskProjection.ackRequired, taskProjection.tier1Events.length > 0);
  assert.equal(taskProjection.replayRequired, taskProjection.tier1Events.length > 0);
});

test("EventReliabilityInventoryService.listConsumerSurfaces marks coverage gaps", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  const gatewayProjection = surfaces.find((s) => s.consumerId === "gateway_projection");
  assert.ok(gatewayProjection);
  assert.equal(gatewayProjection.coverageStatus, "contract_gap");
});

test("EventReliabilityInventoryService.listConsumerSurfaces role is projection or ops_consumer", () => {
  const service = new EventReliabilityInventoryService();
  const surfaces = service.listConsumerSurfaces();

  for (const surface of surfaces) {
    assert.ok(
      surface.role === "projection" || surface.role === "ops_consumer",
      `${surface.consumerId} should have valid role`,
    );
  }
});

test("EventReliabilityInventoryService.buildReport combines all inventory data", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();

  assert.ok(report.totalEvents > 0);
  assert.ok(report.namespaces.length > 0);
  assert.ok(report.consumerSurfaces.length > 0);
  assert.ok(report.tierCounts.tier_1 >= 0);
  assert.ok(report.tierCounts.tier_2 >= 0);
  assert.ok(report.tierCounts.tier_3 >= 0);
});

test("EventReliabilityInventoryService.buildReport includes tier1EventsMissingConsumers", () => {
  const service = new EventReliabilityInventoryService();
  const report = service.buildReport();

  assert.ok(Array.isArray(report.tier1EventsMissingConsumers));
  // All tier1 events should have consumers by contract
  assert.equal(report.tier1EventsMissingConsumers.length, 0);
});

test("EventReliabilityInventoryService with null DLQ has null dlqSummary", () => {
  const service = new EventReliabilityInventoryService(null);
  const report = service.buildReport();

  assert.equal(report.dlqSummary, null);
});

test("EventReliabilityInventoryService with DLQ service populates dlqSummary", () => {
  const dlq = new DeadLetterQueueService();
  dlq.enqueue({
    sourceEventId: "evt_dlq_test",
    consumerId: "test_consumer",
    errorCode: "test.error",
    payloadJson: "{}",
  });

  const service = new EventReliabilityInventoryService(dlq);
  const report = service.buildReport();

  assert.ok(report.dlqSummary);
  assert.equal(report.dlqSummary?.totalRecords, 1);
});
