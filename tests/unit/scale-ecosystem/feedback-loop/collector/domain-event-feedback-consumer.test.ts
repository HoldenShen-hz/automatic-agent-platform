import assert from "node:assert/strict";
import test from "node:test";

import { DomainEventFeedbackConsumer, type DomainEventFeedbackType } from "../../../../../src/scale-ecosystem/feedback-loop/collector/domain-event-feedback-consumer.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { TypedEventEnvelope, TypedEventPayloadMap } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";

function createEventRecord<TType extends DomainEventFeedbackType>(
  eventType: TType,
  payload: TypedEventPayloadMap[TType],
  overrides: Partial<EventRecord> = {},
): EventRecord & { eventType: TType } {
  const createdAt = overrides.createdAt ?? "2026-04-16T00:00:00.000Z";
  return {
    id: overrides.id ?? `evt_${eventType.replace(/[:.]/g, "_")}`,
    taskId: overrides.taskId ?? null,
    sessionId: overrides.sessionId ?? null,
    executionId: overrides.executionId ?? "exec_test",
    eventType,
    eventTier: overrides.eventTier ?? "tier_2",
    payloadJson: JSON.stringify(payload),
    traceId: overrides.traceId ?? null,
    createdAt,
    schemaVersion: overrides.schemaVersion ?? "v1",
    aggregateId: overrides.aggregateId ?? null,
    runId: overrides.runId ?? null,
    sequence: overrides.sequence ?? 1,
    causationId: overrides.causationId ?? null,
    correlationId: overrides.correlationId ?? null,
    payloadHash: overrides.payloadHash ?? null,
    idempotencyKey: overrides.idempotencyKey ?? null,
    replayBehavior: overrides.replayBehavior ?? null,
    principal: overrides.principal ?? null,
    evidenceRefs: overrides.evidenceRefs ?? [],
  };
}

function createEnvelope<TType extends DomainEventFeedbackType>(
  eventType: TType,
  payload: TypedEventPayloadMap[TType],
  overrides: Partial<EventRecord> = {},
): TypedEventEnvelope<TType> {
  return {
    event: createEventRecord(eventType, payload, overrides),
    payload,
  };
}

test("DomainEventFeedbackConsumer aggregates domain lifecycle signals by scope", () => {
  const consumer = new DomainEventFeedbackConsumer();

  consumer.consume(createEnvelope("domain:registered", {
    domainId: "coding",
    status: "testing",
    capabilityCount: 3,
    pluginCount: 2,
    occurredAt: "2026-04-16T00:00:00.000Z",
  }, {
    id: "evt_domain_registered",
    executionId: null,
    createdAt: "2026-04-16T00:00:00.000Z",
  }));
  const snapshot = consumer.consume(createEnvelope("domain:activated", {
    domainId: "coding",
    status: "active",
    capabilityCount: 3,
    pluginCount: 2,
    occurredAt: "2026-04-16T00:05:00.000Z",
  }, {
    id: "evt_domain_activated",
    executionId: null,
    createdAt: "2026-04-16T00:05:00.000Z",
    sequence: 2,
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "domain:coding");
  assert.equal(snapshot?.recentSignals.length, 2);
  assert.equal(snapshot?.feedback.outcome, "completed");
  assert.ok(snapshot?.recentSignals.every((signal) => signal.category === "success"));
});

test("DomainEventFeedbackConsumer maps isolated plugin errors into failure feedback", () => {
  const consumer = new DomainEventFeedbackConsumer();

  const snapshot = consumer.consume(createEnvelope("plugin:error_isolated", {
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    phase: "retrieve",
    lifecycleState: "disabled",
    bindingId: "binding.retriever",
    occurredAt: "2026-04-16T01:00:00.000Z",
    reasonCode: "retrieve",
    errorMessage: "Plugin timed out during retrieve.",
  }, {
    id: "evt_plugin_error",
    executionId: null,
    createdAt: "2026-04-16T01:00:00.000Z",
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "plugin:plugin.coding.retriever");
  assert.equal(snapshot?.feedback.outcome, "failed");
  assert.equal(snapshot?.recentSignals[0]?.category, "timeout");
  assert.equal(snapshot?.recentSignals[0]?.severity, "critical");
});

test("DomainEventFeedbackConsumer aggregates multiple events into same scope", () => {
  const consumer = new DomainEventFeedbackConsumer();

  consumer.consume(createEnvelope("domain:registered", {
    domainId: "coding",
    status: "testing",
    capabilityCount: 3,
    pluginCount: 2,
    occurredAt: "2026-04-16T00:00:00.000Z",
  }, {
    id: "evt_1",
    executionId: null,
    createdAt: "2026-04-16T00:00:00.000Z",
  }));

  const snapshot = consumer.consume(createEnvelope("domain:activated", {
    domainId: "coding",
    status: "active",
    capabilityCount: 3,
    pluginCount: 2,
    occurredAt: "2026-04-16T00:05:00.000Z",
  }, {
    id: "evt_2",
    executionId: null,
    createdAt: "2026-04-16T00:05:00.000Z",
    sequence: 2,
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "domain:coding");
  assert.ok(snapshot?.recentSignals.length >= 1);
});

test("DomainEventFeedbackConsumer translate plugin:spi_registered", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.consume(createEnvelope("plugin:spi_registered", {
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    lifecycleState: "registered",
    bindingId: "binding.retriever",
    occurredAt: "2026-04-16T01:00:00.000Z",
  }, {
    id: "evt_plugin_registered",
    createdAt: "2026-04-16T01:00:00.000Z",
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "plugin:plugin.coding.retriever");
  assert.equal(snapshot?.recentSignals[0]?.category, "success");
  assert.equal(snapshot?.recentSignals[0]?.severity, "info");
  assert.equal(snapshot?.feedback.outcome, "completed");
});

test("DomainEventFeedbackConsumer translate plugin:activated", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.consume(createEnvelope("plugin:activated", {
    pluginId: "plugin.coding.generator",
    domainId: "coding",
    spiType: "generator",
    lifecycleState: "active",
    bindingId: "binding.generator",
    occurredAt: "2026-04-16T01:00:00.000Z",
  }, {
    id: "evt_plugin_activated",
    createdAt: "2026-04-16T01:00:00.000Z",
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "plugin:plugin.coding.generator");
  assert.equal(snapshot?.recentSignals[0]?.category, "success");
});

test("DomainEventFeedbackConsumer translate knowledge:chunk_indexed", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.consume(createEnvelope("knowledge:chunk_indexed", {
    chunkId: "chunk_001",
    namespace: "default",
    trustLevel: "high",
    keywordCount: 10,
    relationCount: 5,
    documentId: "doc_123",
    occurredAt: "2026-04-16T01:00:00.000Z",
  }, {
    id: "evt_knowledge_indexed",
    createdAt: "2026-04-16T01:00:00.000Z",
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "knowledge:chunk_001");
  assert.equal(snapshot?.recentSignals[0]?.category, "success");
});

test("DomainEventFeedbackConsumer getSnapshot returns correct snapshot", () => {
  const consumer = new DomainEventFeedbackConsumer();
  consumer.consume(createEnvelope("domain:registered", {
    domainId: "test_domain",
    status: "testing",
    capabilityCount: 2,
    pluginCount: 1,
    occurredAt: "2026-04-16T00:00:00.000Z",
  }, {
    id: "evt_get_snapshot",
    createdAt: "2026-04-16T00:00:00.000Z",
  }));

  const snapshot = consumer.getSnapshot("domain:test_domain");
  assert.ok(snapshot);
  assert.equal(snapshot?.scopeId, "domain:test_domain");
});

test("DomainEventFeedbackConsumer getSnapshot returns null for unknown scope", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.getSnapshot("domain:unknown");
  assert.equal(snapshot, null);
});

test("DomainEventFeedbackConsumer listSnapshots returns all snapshots", () => {
  const consumer = new DomainEventFeedbackConsumer();
  consumer.consume(createEnvelope("domain:registered", {
    domainId: "domain_a",
    status: "testing",
    capabilityCount: 1,
    pluginCount: 1,
    occurredAt: "2026-04-16T00:00:00.000Z",
  }, {
    id: "evt_domain_a",
    createdAt: "2026-04-16T00:00:00.000Z",
  }));
  consumer.consume(createEnvelope("domain:registered", {
    domainId: "domain_b",
    status: "testing",
    capabilityCount: 2,
    pluginCount: 2,
    occurredAt: "2026-04-16T00:01:00.000Z",
  }, {
    id: "evt_domain_b",
    createdAt: "2026-04-16T00:01:00.000Z",
    sequence: 2,
  }));

  const snapshots = consumer.listSnapshots();
  assert.equal(snapshots.length, 2);
});

test("DomainEventFeedbackConsumer respects maxSignalsPerScope limit", () => {
  const consumer = new DomainEventFeedbackConsumer({ maxSignalsPerScope: 3 });

  for (let i = 0; i < 5; i++) {
    consumer.consume(createEnvelope("domain:registered", {
      domainId: "limited",
      status: "testing",
      capabilityCount: 1,
      pluginCount: 1,
      occurredAt: `2026-04-16T00:${String(i).padStart(2, "0")}:00.000Z`,
    }, {
      id: `evt_limited_${i}`,
      createdAt: `2026-04-16T00:${String(i).padStart(2, "0")}:00.000Z`,
      sequence: i + 1,
    }));
  }

  const snapshot = consumer.getSnapshot("domain:limited");
  assert.ok(snapshot);
  assert.ok(snapshot.recentSignals.length <= 3);
});

test("DomainEventFeedbackConsumer returns null for unhandled event type", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.consume({
    event: {
      ...createEventRecord("domain:registered", {
        domainId: "ignored",
        status: "testing",
        capabilityCount: 0,
        pluginCount: 0,
        occurredAt: "2026-04-16T00:00:00.000Z",
      }),
      eventType: "unknown:event" as DomainEventFeedbackType,
    },
    payload: {},
  } as TypedEventEnvelope<DomainEventFeedbackType>);

  assert.equal(snapshot, null);
});

test("DomainEventFeedbackConsumer plugin:error_isolated with timeout detection", () => {
  const consumer = new DomainEventFeedbackConsumer();
  const snapshot = consumer.consume(createEnvelope("plugin:error_isolated", {
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    phase: "retrieve",
    lifecycleState: "disabled",
    bindingId: "binding.retriever",
    occurredAt: "2026-04-16T01:00:00.000Z",
    reasonCode: "timeout",
    errorMessage: "Plugin timed out during retrieve.",
  }, {
    id: "evt_plugin_timeout",
    createdAt: "2026-04-16T01:00:00.000Z",
  }));

  assert.ok(snapshot);
  assert.equal(snapshot?.recentSignals[0]?.category, "timeout");
  assert.equal(snapshot?.recentSignals[0]?.severity, "critical");
  assert.equal(snapshot?.feedback.outcome, "failed");
});
