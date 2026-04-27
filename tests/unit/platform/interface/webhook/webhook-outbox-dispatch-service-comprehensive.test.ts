/**
 * Unit tests for WebhookOutboxDispatchService error handling
 * Tests src/platform/interface/webhook/webhook-outbox-dispatch-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";

test("WebhookOutboxDispatchService receiveAndStage marks persistedToOutbox false on duplicate", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-dup-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-dup",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // First request
    const first = service.receiveAndStage({
      endpointId: "ep-dup",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "dup-key-001" }),
      traceId: "trace-first",
    });

    // Duplicate request
    const second = service.receiveAndStage({
      endpointId: "ep-dup",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "dup-key-001" }),
      traceId: "trace-second",
    });

    assert.equal(first.duplicate, false);
    assert.equal(first.persistedToOutbox, true);
    assert.ok(first.outboxEntryId !== null);

    assert.equal(second.duplicate, true);
    assert.equal(second.persistedToOutbox, false);
    assert.equal(second.outboxEntryId, null);
    assert.equal(second.envelope.envelopeId, first.envelope.envelopeId);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage persists non-duplicate to outbox", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-persist-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-persist",
      source: "https://source.example.com",
      tenantId: "tenant-1",
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["deployment.succeeded"],
      algorithm: "none",
    });

    const result = service.receiveAndStage({
      endpointId: "ep-persist",
      headers: {},
      body: JSON.stringify({ eventType: "deployment.succeeded", eventId: "deploy-001" }),
      traceId: "trace-deploy",
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.ok(result.outboxEntryId !== null);
    assert.equal(result.envelope.endpointId, "ep-persist");
    assert.equal(result.envelope.eventType, "deployment.succeeded");

    // Verify it was written to the database
    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.aggregateType, "webhook_endpoint");
    assert.equal(pending[0]?.aggregateId, "ep-persist");
    assert.equal(pending[0]?.eventType, "webhook.received");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage uses custom idempotency header", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-idempotency-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-header-idempotency",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
      idempotencyHeader: "x-idempotency-key",
    });

    const first = service.receiveAndStage({
      endpointId: "ep-header-idempotency",
      headers: { "x-idempotency-key": "header-key-001" },
      body: JSON.stringify({ eventType: "task.created" }),
      traceId: "trace-1",
    });

    const second = service.receiveAndStage({
      endpointId: "ep-header-idempotency",
      headers: { "x-idempotency-key": "header-key-001" },
      body: JSON.stringify({ eventType: "task.created" }),
      traceId: "trace-2",
    });

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.envelope.idempotencyKey, "header-key-001");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage includes traceId in outbox record", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-trace-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-trace",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    service.receiveAndStage({
      endpointId: "ep-trace",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "trace-key-001" }),
      traceId: "custom-trace-id-123",
    });

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.traceId, "custom-trace-id-123");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage handles null traceId", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-null-trace-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-null-trace",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result = service.receiveAndStage({
      endpointId: "ep-null-trace",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "null-trace-key" }),
      traceId: null,
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.equal(result.envelope.envelopeId.length > 0, true);

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.traceId, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage preserves acceptedAt timestamp", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-timestamp-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-timestamp",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result = service.receiveAndStage({
      endpointId: "ep-timestamp",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "ts-key-001" }),
      traceId: "trace-ts",
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.envelope.acceptedAt.length > 0, true);
    assert.ok(result.envelope.acceptedAt.includes("T"));
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage stores payload in outbox", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-payload-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-payload",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    service.receiveAndStage({
      endpointId: "ep-payload",
      headers: {},
      body: JSON.stringify({
        eventType: "task.created",
        eventId: "payload-key-001",
        repository: "test-repo",
        action: "opened",
      }),
      traceId: "trace-payload",
    });

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    const payload = JSON.parse(pending[0]?.payloadJson ?? "{}");
    assert.equal(payload.envelope.eventType, "task.created");
    assert.equal(payload.envelope.payload.repository, "test-repo");
    assert.equal(payload.ingestionSurface, "webhook_ingress");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage rejects duplicate within same endpoint scope", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-scope-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    // Register two endpoints
    ingressService.registerEndpoint({
      endpointId: "ep-scope-1",
      source: "https://source1.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    ingressService.registerEndpoint({
      endpointId: "ep-scope-2",
      source: "https://source2.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // Same eventId but different endpoints - should not be duplicates
    const first = service.receiveAndStage({
      endpointId: "ep-scope-1",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "shared-key-001" }),
      traceId: "trace-1",
    });

    const second = service.receiveAndStage({
      endpointId: "ep-scope-2",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "shared-key-001" }),
      traceId: "trace-2",
    });

    // Different endpoints, so not duplicates
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, false);
    assert.notEqual(first.envelope.envelopeId, second.envelope.envelopeId);

    // Both should be persisted
    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage works with receivedAt override", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-received-at-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-received-at",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const customReceivedAt = "2024-01-15T10:30:00.000Z";
    const result = service.receiveAndStage({
      endpointId: "ep-received-at",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "received-at-key" }),
      traceId: "trace-ra",
      receivedAt: customReceivedAt,
    });

    assert.equal(result.envelope.receivedAt, customReceivedAt);
  } finally {
    cleanupPath(workspace);
  }
});
