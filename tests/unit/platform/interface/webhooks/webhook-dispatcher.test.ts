import assert from "node:assert/strict";
import test from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import type { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";

// Manual mock for OutboxRepository
function createMockOutboxRepository(): OutboxRepository {
  const entries: Map<string, {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payloadJson: string;
    traceId: string | null;
    createdAt: string;
    publishedAt: string | null;
    retryCount: number;
    lastError: string | null;
    lastAttemptAt: string | null;
  }> = new Map();

  return {
    conn: null as never,
    insertOutboxEntry: (aggregateType: string, aggregateId: string, eventType: string, payloadJson: string, traceId: string | null, createdAt: string) => {
      const id = `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      entries.set(id, { id, aggregateType, aggregateId, eventType, payloadJson, traceId, createdAt, publishedAt: null, retryCount: 0, lastError: null, lastAttemptAt: null });
      return { id };
    },
    insertOutboxEntries: () => [],
    insertOutboxEntriesBulk: () => [],
    markPublished: () => {},
    markPublishedBatch: () => {},
    markFailed: () => {},
    listPendingEntries: (_limit: number) => {
      return Array.from(entries.values());
    },
    listFailedEntries: () => [],
    countPending: () => entries.size,
    countFailed: () => 0,
    getStatus: () => undefined,
    listEntriesByAggregate: (aggType: string, aggId: string) => {
      return Array.from(entries.values()).filter(e => e.aggregateType === aggType && e.aggregateId === aggId);
    },
    deleteEntry: (id: string) => {
      return entries.delete(id);
    },
    cleanupPublishedBefore: () => 0,
    entries,
  } as unknown as OutboxRepository;
}

test("receiveAndStage writes new webhook envelope to outbox and returns accepted result", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "test-endpoint",
    source: "test-source",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receiveAndStage({
    endpointId: "test-endpoint",
    headers: {},
    body: JSON.stringify({ eventType: "push", eventId: "evt-123" }),
    traceId: "trace-abc",
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.persistedToOutbox, true);
  assert.ok(result.outboxEntryId != null);
  assert.equal(result.envelope.dispatchState, "accepted");
  assert.equal(result.envelope.eventType, "push");
});

test("receiveAndStage marks duplicate requests and does not persist to outbox", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "dup-endpoint",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const first = service.receiveAndStage({
    endpointId: "dup-endpoint",
    headers: {},
    body: JSON.stringify({ eventType: "event1", id: "idem-1" }),
  });

  const second = service.receiveAndStage({
    endpointId: "dup-endpoint",
    headers: {},
    body: JSON.stringify({ eventType: "event1", id: "idem-1" }),
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.persistedToOutbox, false);
  assert.equal(second.outboxEntryId, null);
});

test("receiveAndStage rolls back envelope when outbox insert fails", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "rollback-test",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Make insertOutboxEntry throw an error
  mockOutboxRepo.insertOutboxEntry = () => {
    throw new Error("Database write failure");
  };

  let errorThrown = false;
  try {
    service.receiveAndStage({
      endpointId: "rollback-test",
      headers: {},
      body: JSON.stringify({ eventType: "test", eventId: "evt-rollback" }),
    });
  } catch {
    errorThrown = true;
  }

  assert.equal(errorThrown, true);
  // After rollback, there should be no accepted envelopes
  const envelopes = ingressService.listAcceptedEnvelopes();
  const rolledBackEnvelope = envelopes.find(e => e.endpointId === "rollback-test");
  assert.equal(rolledBackEnvelope, undefined);
});

test("receiveAndStage includes traceId in outbox entry when provided", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "trace-endpoint",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receiveAndStage({
    endpointId: "trace-endpoint",
    headers: {},
    body: JSON.stringify({ eventType: "test", id: "trace-test" }),
    traceId: "trace-xyz-789",
  });

  const entries = mockOutboxRepo.listPendingEntries(10);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.traceId, "trace-xyz-789");
});

test("receiveAndStage uses null traceId when not provided", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "notrace-endpoint",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receiveAndStage({
    endpointId: "notrace-endpoint",
    headers: {},
    body: JSON.stringify({ eventType: "test", id: "no-trace" }),
  });

  const entries = mockOutboxRepo.listPendingEntries(10);
  assert.equal(entries[0]?.traceId, null);
});

test("receiveAndStage stores envelope with correct aggregate metadata", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "aggregate-test",
    source: "github",
    tenantId: "tenant-abc",
    workspaceId: "workspace-xyz",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receiveAndStage({
    endpointId: "aggregate-test",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "agg-test" }),
  });

  const entries = mockOutboxRepo.listPendingEntries(10);
  assert.equal(entries[0]?.aggregateType, "webhook_endpoint");
  assert.equal(entries[0]?.aggregateId, "aggregate-test");
  assert.equal(entries[0]?.eventType, "webhook.received");
});

test("receiveAndStage serializes envelope to JSON in payload", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "json-test",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["star.created"],
    algorithm: "none",
  });

  service.receiveAndStage({
    endpointId: "json-test",
    headers: {},
    body: JSON.stringify({ eventType: "star.created", id: "json-payload-test" }),
  });

  const entries = mockOutboxRepo.listPendingEntries(10);
  const payload = JSON.parse(entries[0]?.payloadJson ?? "{}");
  assert.equal(payload.envelope.eventType, "star.created");
  assert.equal(payload.ingestionSurface, "webhook_ingress");
});

test("receiveAndStage throws when endpoint not found", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "nonexistent",
      headers: {},
      body: JSON.stringify({ eventType: "test", id: "err-test" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error != null);
  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.endpoint_not_found");
});

test("receiveAndStage throws when endpoint is disabled", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "disabled-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "disabled-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test", id: "disabled-test" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.endpoint_disabled");
});

test("receiveAndStage throws when event type is not allowed", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "filtered-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["allowed.event"],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "filtered-ep",
      headers: {},
      body: JSON.stringify({ eventType: "forbidden.event", id: "filter-test" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.event_type_not_allowed");
});

test("receiveAndStage throws when idempotency key is missing", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "idempotent-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "idempotent-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test" }), // no id field
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.idempotency_key_required");
});

test("receiveAndStage accepts webhook with sha256_hmac algorithm when signature is valid", async () => {
  const crypto = await import("node:crypto");
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);
  const secret = "webhook-secret-123";

  ingressService.registerEndpoint({
    endpointId: "hmac-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  // Manually create a valid signature
  const body = JSON.stringify({ eventType: "test", id: "hmac-test" });
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const result = service.receiveAndStage({
    endpointId: "hmac-ep",
    headers: { "x-aa-signature": expectedSig },
    body,
  });

  assert.equal(result.envelope.signatureVerified, true);
  assert.equal(result.duplicate, false);
});

test("receiveAndStage throws when sha256_hmac signature is missing", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "sig-missing-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "some-secret",
  });

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "sig-missing-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test", id: "sig-missing" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.signature_required");
});

test("receiveAndStage throws when sha256_hmac signature is invalid", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "sig-invalid-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "correct-secret",
  });

  let error: Error | null = null;
  try {
    service.receiveAndStage({
      endpointId: "sig-invalid-ep",
      headers: { "x-aa-signature": "invalid-signature-value" },
      body: JSON.stringify({ eventType: "test", id: "sig-invalid" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.signature_invalid");
});

test("receiveAndStage accepts signature with sha256= prefix", async () => {
  const crypto = await import("node:crypto");
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);
  const secret = "prefix-secret";

  ingressService.registerEndpoint({
    endpointId: "prefix-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "test", id: "prefix-test" });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const result = service.receiveAndStage({
    endpointId: "prefix-ep",
    headers: { "x-aa-signature": `sha256=${sig}` },
    body,
  });

  assert.equal(result.envelope.signatureVerified, true);
});

test("multiple endpoints maintain separate idempotency keys", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "ep-a",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  ingressService.registerEndpoint({
    endpointId: "ep-b",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Same idempotency key "same-key" for different endpoints
  const resultA = service.receiveAndStage({
    endpointId: "ep-a",
    headers: {},
    body: JSON.stringify({ eventType: "test", id: "same-key" }),
  });

  const resultB = service.receiveAndStage({
    endpointId: "ep-b",
    headers: {},
    body: JSON.stringify({ eventType: "test", id: "same-key" }),
  });

  // Both should be accepted (not duplicates) since they're different endpoints
  assert.equal(resultA.duplicate, false);
  assert.equal(resultB.duplicate, false);
  assert.equal(resultA.envelope.endpointId, "ep-a");
  assert.equal(resultB.envelope.endpointId, "ep-b");
});

test("result envelope contains correct tenant and workspace context", () => {
  const ingressService = new WebhookIngressService();
  const mockOutboxRepo = createMockOutboxRepository();
  const service = new WebhookOutboxDispatchService(ingressService, mockOutboxRepo);

  ingressService.registerEndpoint({
    endpointId: "context-ep",
    source: "github",
    tenantId: "tenant-xyz",
    workspaceId: "workspace-abc",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const result = service.receiveAndStage({
    endpointId: "context-ep",
    headers: {},
    body: JSON.stringify({ eventType: "test", id: "ctx-test" }),
  });

  assert.equal(result.envelope.tenantId, "tenant-xyz");
  assert.equal(result.envelope.workspaceId, "workspace-abc");
  assert.equal(result.envelope.source, "github");
});
