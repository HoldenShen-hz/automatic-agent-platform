import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/five-plane-interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

test("WebhookOutboxDispatchService receiveAndStage returns duplicate true when ingress marks duplicate", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-dup-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-dup-test",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const first = service.receiveAndStage({
      endpointId: "ep-dup-test",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "dup-key-001" }),
      traceId: "trace-first",
    });

    const second = service.receiveAndStage({
      endpointId: "ep-dup-test",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "dup-key-001" }),
      traceId: "trace-second",
    });

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.envelope.envelopeId, first.envelope.envelopeId);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage persists to outbox on non-duplicate", () => {
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
      tenantId: "tenant-persist",
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["deployment.succeeded"],
      algorithm: "none",
    });

    const result = service.receiveAndStage({
      endpointId: "ep-persist",
      headers: {},
      body: JSON.stringify({ eventType: "deployment.succeeded", eventId: "deploy-evt-001" }),
      traceId: "trace-deploy",
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.ok(result.outboxEntryId);
    assert.equal(result.envelope.endpointId, "ep-persist");

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.aggregateType, "webhook_endpoint");
    assert.equal(pending[0]?.aggregateId, "ep-persist");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage does not persist duplicate to outbox", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-no-dup-persist-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-no-dup-persist",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    service.receiveAndStage({
      endpointId: "ep-no-dup-persist",
      headers: {},
      body: JSON.stringify({ eventType: "alert", eventId: "alert-key-001" }),
    });

    service.receiveAndStage({
      endpointId: "ep-no-dup-persist",
      headers: {},
      body: JSON.stringify({ eventType: "alert", eventId: "alert-key-001" }),
    });

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.eventType, "webhook.received");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage throws and rolls back when outbox insert fails", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-rollback-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-rollback-test",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    // Force a failure by closing the database connection
    db.connection.close();

    assert.throws(
      () =>
        service.receiveAndStage({
          endpointId: "ep-rollback-test",
          headers: {},
          body: JSON.stringify({ eventType: "task.completed", eventId: "rollback-evt-001" }),
        }),
      (err: any) => err.message != null,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage includes traceId in outbox entry", () => {
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
      body: JSON.stringify({ eventType: "task.completed", eventId: "trace-evt-001" }),
      traceId: "trace-abc-123",
    });

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.traceId, "trace-abc-123");
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage includes envelope data in outbox payload", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-payload-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-payload",
      source: "https://payload.example.com",
      tenantId: "tenant-payload",
      workspaceId: "ws-payload",
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    service.receiveAndStage({
      endpointId: "ep-payload",
      headers: {},
      body: JSON.stringify({ eventType: "task.failed", eventId: "payload-evt-001", data: { taskId: "task-xyz" } }),
    });

    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    const payload = JSON.parse(pending[0]?.payloadJson ?? "{}");
    assert.equal(payload.envelope?.endpointId, "ep-payload");
    assert.equal(payload.envelope?.eventType, "task.failed");
    assert.equal(payload.ingestionSurface, "webhook_ingress");
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
      body: JSON.stringify({ eventType: "alert", eventId: "null-trace-evt" }),
      traceId: null,
    });

    assert.equal(result.duplicate, false);
    const pending = outboxRepo.listPendingEntries(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.traceId, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("WebhookOutboxDispatchService receiveAndStage uses acceptedAt from envelope", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-accepted-at-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const ingressService = new WebhookIngressService();
    const outboxRepo = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(ingressService, outboxRepo);

    ingressService.registerEndpoint({
      endpointId: "ep-accepted-at",
      source: "https://source.example.com",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const before = Date.now();
    const result = service.receiveAndStage({
      endpointId: "ep-accepted-at",
      headers: {},
      body: JSON.stringify({ eventType: "task.created", eventId: "accepted-at-evt" }),
    });
    const after = Date.now();

    assert.ok(result.envelope.acceptedAt);
    const acceptedAtTime = new Date(result.envelope.acceptedAt).getTime();
    assert.ok(acceptedAtTime >= before && acceptedAtTime <= after);
  } finally {
    cleanupPath(workspace);
  }
});