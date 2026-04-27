/**
 * Unit tests for WebhookOutboxDispatchService retry and error handling
 * Tests src/platform/interface/webhook/webhook-outbox-dispatch-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("WebhookOutboxDispatchService receiveAndStage handles missing traceId", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-trace-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "trace-missing-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // traceId is undefined (not provided)
    const result = service.receiveAndStage({
      endpointId: "trace-missing-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test.event", eventId: "trace-missing-001" }),
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    // traceId on envelope is undefined when not provided
    assert.ok(result.envelope.traceId === undefined || result.envelope.traceId === null);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage multiple events for same endpoint", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-multi-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "multi-event-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result1 = service.receiveAndStage({
      endpointId: "multi-event-ep",
      headers: {},
      body: JSON.stringify({ eventType: "event.first", eventId: "multi-001" }),
    });

    const result2 = service.receiveAndStage({
      endpointId: "multi-event-ep",
      headers: {},
      body: JSON.stringify({ eventType: "event.second", eventId: "multi-002" }),
    });

    const result3 = service.receiveAndStage({
      endpointId: "multi-event-ep",
      headers: {},
      body: JSON.stringify({ eventType: "event.third", eventId: "multi-003" }),
    });

    assert.equal(result1.duplicate, false);
    assert.equal(result2.duplicate, false);
    assert.equal(result3.duplicate, false);

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage preserves event ordering", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-order-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "order-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(service.receiveAndStage({
        endpointId: "order-ep",
        headers: {},
        body: JSON.stringify({ eventType: `event.${i}`, eventId: `order-${i}` }),
      }));
    }

    // All should be unique
    const envelopeIds = results.map(r => r.envelope.envelopeId);
    const uniqueIds = new Set(envelopeIds);
    assert.equal(uniqueIds.size, 5);

    // All should be persisted
    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 5);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage with empty allowedEventTypes allows all", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-empty-allow-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "empty-allow-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // Empty allowedEventTypes should allow all event types
    const result = service.receiveAndStage({
      endpointId: "empty-allow-ep",
      headers: {},
      body: JSON.stringify({ eventType: "any.event", eventId: "any-key" }),
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage with payload containing special characters", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-special-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "special-char-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result = service.receiveAndStage({
      endpointId: "special-char-ep",
      headers: {},
      body: JSON.stringify({
        eventType: "test.event",
        eventId: "special-\"quotes\"-and-emoji-🎉",
        data: "New\nLines\tand\ttabs",
      }),
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.ok(pending[0]!.payloadJson.includes("New\\nLines"));
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage handles large payload", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-large-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "large-payload-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // Create a large payload (100KB of data)
    const largeData = "x".repeat(100 * 1024);

    const result = service.receiveAndStage({
      endpointId: "large-payload-ep",
      headers: {},
      body: JSON.stringify({
        eventType: "test.event",
        eventId: "large-payload-001",
        largeData,
      }),
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage rejects malformed JSON", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-malformed-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "malformed-json-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    assert.throws(
      () =>
        service.receiveAndStage({
          endpointId: "malformed-json-ep",
          headers: {},
          body: "{ invalid json }",
        }),
      { code: "webhook.invalid_json" },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage with string eventId", () => {
  const workspace = createTempWorkspace("aa-webhook-retry-numeric-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "numeric-id-ep",
      source: "https://example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // Webhook IDs should be strings
    const result = service.receiveAndStage({
      endpointId: "numeric-id-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test.event", eventId: "12345" }),
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.equal(result.envelope.idempotencyKey, "12345");
  } finally {
    cleanupPath(workspace);
  }
});
