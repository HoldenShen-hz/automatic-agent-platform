import assert from "node:assert/strict";
import test from "node:test";
import { DomainEventFeedbackConsumer } from "../../../../../src/scale-ecosystem/feedback-loop/collector/domain-event-feedback-consumer.js";
test("DomainEventFeedbackConsumer aggregates domain lifecycle signals by scope", () => {
    const consumer = new DomainEventFeedbackConsumer();
    consumer.consume({
        event: {
            id: "evt_domain_registered",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "domain:registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:00:00.000Z",
        },
        payload: {
            domainId: "coding",
            status: "testing",
            capabilityCount: 3,
            pluginCount: 2,
            occurredAt: "2026-04-16T00:00:00.000Z",
        },
    });
    const snapshot = consumer.consume({
        event: {
            id: "evt_domain_activated",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "domain:activated",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:05:00.000Z",
        },
        payload: {
            domainId: "coding",
            status: "active",
            capabilityCount: 3,
            pluginCount: 2,
            occurredAt: "2026-04-16T00:05:00.000Z",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "domain:coding");
    assert.equal(snapshot?.recentSignals.length, 2);
    assert.equal(snapshot?.feedback.outcome, "completed");
    assert.ok(snapshot?.recentSignals.every((signal) => signal.category === "success"));
});
test("DomainEventFeedbackConsumer maps isolated plugin errors into failure feedback", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_plugin_error",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "plugin:error_isolated",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T01:00:00.000Z",
        },
        payload: {
            pluginId: "plugin.coding.retriever",
            domainId: "coding",
            spiType: "retriever",
            lifecycleState: "disabled",
            bindingId: "binding.retriever",
            occurredAt: "2026-04-16T01:00:00.000Z",
            reasonCode: "retrieve",
            errorMessage: "Plugin timed out during retrieve.",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "plugin:plugin.coding.retriever");
    assert.equal(snapshot?.feedback.outcome, "failed");
    assert.equal(snapshot?.recentSignals[0]?.category, "timeout");
    assert.equal(snapshot?.recentSignals[0]?.severity, "critical");
});
test("DomainEventFeedbackConsumer aggregates multiple events into same scope", () => {
    const consumer = new DomainEventFeedbackConsumer();
    // First event
    consumer.consume({
        event: {
            id: "evt_1",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "domain:registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:00:00.000Z",
        },
        payload: {
            domainId: "coding",
            status: "testing",
            capabilityCount: 3,
            pluginCount: 2,
            occurredAt: "2026-04-16T00:00:00.000Z",
        },
    });
    // Second event for same domain
    const snapshot = consumer.consume({
        event: {
            id: "evt_2",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "domain:activated",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:05:00.000Z",
        },
        payload: {
            domainId: "coding",
            status: "active",
            capabilityCount: 3,
            pluginCount: 2,
            occurredAt: "2026-04-16T00:05:00.000Z",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "domain:coding");
    // Should aggregate both events
    assert.ok(snapshot?.recentSignals.length >= 1);
});
test("DomainEventFeedbackConsumer translate plugin:spi_registered", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_plugin_registered",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "plugin:spi_registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T01:00:00.000Z",
        },
        payload: {
            pluginId: "plugin.coding.retriever",
            domainId: "coding",
            spiType: "retriever",
            lifecycleState: "registered",
            bindingId: "binding.retriever",
            occurredAt: "2026-04-16T01:00:00.000Z",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "plugin:plugin.coding.retriever");
    assert.equal(snapshot?.recentSignals[0]?.category, "success");
    assert.equal(snapshot?.recentSignals[0]?.severity, "info");
    assert.equal(snapshot?.feedback.outcome, "completed");
});
test("DomainEventFeedbackConsumer translate plugin:activated", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_plugin_activated",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "plugin:activated",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T01:00:00.000Z",
        },
        payload: {
            pluginId: "plugin.coding.generator",
            domainId: "coding",
            spiType: "generator",
            lifecycleState: "active",
            bindingId: "binding.generator",
            occurredAt: "2026-04-16T01:00:00.000Z",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "plugin:plugin.coding.generator");
    assert.equal(snapshot?.recentSignals[0]?.category, "success");
});
test("DomainEventFeedbackConsumer translate knowledge:chunk_indexed", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_knowledge_indexed",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "knowledge:chunk_indexed",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T01:00:00.000Z",
        },
        payload: {
            chunkId: "chunk_001",
            namespace: "default",
            trustLevel: "high",
            keywordCount: 10,
            relationCount: 5,
            documentId: "doc_123",
            occurredAt: "2026-04-16T01:00:00.000Z",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.scopeId, "knowledge:chunk_001");
    assert.equal(snapshot?.recentSignals[0]?.category, "success");
});
test("DomainEventFeedbackConsumer getSnapshot returns correct snapshot", () => {
    const consumer = new DomainEventFeedbackConsumer();
    consumer.consume({
        event: {
            id: "evt_get_snapshot",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "domain:registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:00:00.000Z",
        },
        payload: {
            domainId: "test_domain",
            status: "testing",
            capabilityCount: 2,
            pluginCount: 1,
            occurredAt: "2026-04-16T00:00:00.000Z",
        },
    });
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
    consumer.consume({
        event: {
            id: "evt_domain_a",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "domain:registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:00:00.000Z",
        },
        payload: {
            domainId: "domain_a",
            status: "testing",
            capabilityCount: 1,
            pluginCount: 1,
            occurredAt: "2026-04-16T00:00:00.000Z",
        },
    });
    consumer.consume({
        event: {
            id: "evt_domain_b",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "domain:registered",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:01:00.000Z",
        },
        payload: {
            domainId: "domain_b",
            status: "testing",
            capabilityCount: 2,
            pluginCount: 2,
            occurredAt: "2026-04-16T00:01:00.000Z",
        },
    });
    const snapshots = consumer.listSnapshots();
    assert.equal(snapshots.length, 2);
});
test("DomainEventFeedbackConsumer respects maxSignalsPerScope limit", () => {
    const consumer = new DomainEventFeedbackConsumer({ maxSignalsPerScope: 3 });
    for (let i = 0; i < 5; i++) {
        consumer.consume({
            event: {
                id: `evt_limited_${i}`,
                taskId: null,
                sessionId: null,
                executionId: "exec_test",
                eventType: "domain:registered",
                eventTier: "tier_2",
                payloadJson: "{}",
                traceId: null,
                createdAt: `2026-04-16T00:${String(i).padStart(2, "0")}:00.000Z`,
            },
            payload: {
                domainId: "limited",
                status: "testing",
                capabilityCount: 1,
                pluginCount: 1,
                occurredAt: `2026-04-16T00:${String(i).padStart(2, "0")}:00.000Z`,
            },
        });
    }
    const snapshot = consumer.getSnapshot("domain:limited");
    assert.ok(snapshot);
    assert.ok(snapshot.recentSignals.length <= 3);
});
test("DomainEventFeedbackConsumer returns null for unhandled event type", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_unknown",
            taskId: null,
            sessionId: null,
            executionId: null,
            eventType: "unknown:event",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T00:00:00.000Z",
        },
        payload: {},
    });
    assert.equal(snapshot, null);
});
test("DomainEventFeedbackConsumer plugin:error_isolated with timeout detection", () => {
    const consumer = new DomainEventFeedbackConsumer();
    const snapshot = consumer.consume({
        event: {
            id: "evt_plugin_timeout",
            taskId: null,
            sessionId: null,
            executionId: "exec_test",
            eventType: "plugin:error_isolated",
            eventTier: "tier_2",
            payloadJson: "{}",
            traceId: null,
            createdAt: "2026-04-16T01:00:00.000Z",
        },
        payload: {
            pluginId: "plugin.coding.retriever",
            domainId: "coding",
            spiType: "retriever",
            lifecycleState: "disabled",
            bindingId: "binding.retriever",
            occurredAt: "2026-04-16T01:00:00.000Z",
            reasonCode: "timeout",
            errorMessage: "Plugin timed out during retrieve.",
        },
    });
    assert.ok(snapshot);
    assert.equal(snapshot?.recentSignals[0]?.category, "timeout");
    assert.equal(snapshot?.recentSignals[0]?.severity, "critical");
    assert.equal(snapshot?.feedback.outcome, "failed");
});
//# sourceMappingURL=domain-event-feedback-consumer.test.js.map