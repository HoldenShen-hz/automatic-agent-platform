import { createHmac } from "node:crypto";
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/five-plane-interface/webhook/webhook-outbox-dispatch-service.js";
import type { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import type { OutboxRecord } from "../../../../../src/platform/shared/outbox/outbox-types.js";

function makeFakeOutboxRepository(): OutboxRepository {
  const records: OutboxRecord[] = [];
  return {
    insertOutboxEntry: (
      aggregateType: string,
      aggregateId: string,
      eventType: string,
      payloadJson: string,
      traceId: string | null,
      createdAt: string,
    ): OutboxRecord => {
      const record: OutboxRecord = {
        id: `outbox_${aggregateId}_${records.length}`,
        aggregateType,
        aggregateId,
        eventType,
        payloadJson,
        traceId,
        createdAt,
        publishedAt: null,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
      };
      records.push(record);
      return record;
    },
  } as unknown as OutboxRepository;
}

function makeWebhookIngressService(): WebhookIngressService {
  return new WebhookIngressService();
}

function makeValidPayload(eventType = "task.created", eventId = "evt_123"): string {
  return JSON.stringify({ eventType, eventId, data: { taskId: "task_abc" } });
}

function makeHmacSignature(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

// ============================================================================
// WebhookIngressService tests
// ============================================================================

test("registerEndpoint accepts valid endpoint", () => {
  const service = makeWebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep_test_123",
    source: "test-source",
    tenantId: "tenant_abc",
    workspaceId: "ws_xyz",
    enabled: true,
    allowedEventTypes: ["task.created", "task.completed"],
    algorithm: "none",
  });

  assert.equal(result.endpointId, "ep_test_123");
  assert.equal(result.source, "test-source");
  assert.equal(result.tenantId, "tenant_abc");
  assert.equal(result.workspaceId, "ws_xyz");
  assert.equal(result.enabled, true);
  assert.deepEqual(result.allowedEventTypes, ["task.created", "task.completed"]);
  assert.equal(result.signatureHeader, "x-aa-signature");
  assert.equal(result.idempotencyHeader, "idempotency-key");
});

test("registerEndpoint rejects empty endpointId", () => {
  const service = makeWebhookIngressService();
  assert.throws(
    () =>
      service.registerEndpoint({
        endpointId: "  ",
        source: "test",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "none",
      }),
    /webhook\.invalid_endpoint_id/,
  );
});

test("registerEndpoint rejects empty source", () => {
  const service = makeWebhookIngressService();
  assert.throws(
    () =>
      service.registerEndpoint({
        endpointId: "ep_123",
        source: "",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "none",
      }),
    /webhook\.invalid_source/,
  );
});

test("registerEndpoint requires signingSecret for sha256_hmac algorithm", () => {
  const service = makeWebhookIngressService();
  assert.throws(
    () =>
      service.registerEndpoint({
        endpointId: "ep_signed",
        source: "test-source",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "sha256_hmac",
      }),
    /webhook\.signing_secret_required/,
  );
});

test("registerEndpoint normalizes header names to lowercase", () => {
  const service = makeWebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep_123",
    source: "test-source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
    signatureHeader: "X-Custom-Signature",
    idempotencyHeader: "X-Idempotency-Key",
  });

  assert.equal(result.signatureHeader, "x-custom-signature");
  assert.equal(result.idempotencyHeader, "x-idempotency-key");
});

test("registerEndpoint deduplicates allowedEventTypes", () => {
  const service = makeWebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep_123",
    source: "test-source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.created", "task.created", "task.completed"],
    algorithm: "none",
  });

  assert.deepEqual(result.allowedEventTypes, ["task.created", "task.completed"]);
});

test("receive rejects unknown endpoint", () => {
  const service = makeWebhookIngressService();
  assert.throws(
    () =>
      service.receive({
        endpointId: "unknown_ep",
        headers: {},
        body: makeValidPayload(),
      }),
    /webhook\.endpoint_not_found/,
  );
});

test("receive rejects disabled endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_disabled",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_disabled",
        headers: {},
        body: makeValidPayload(),
      }),
    /webhook\.endpoint_disabled/,
  );
});

test("receive rejects payload without eventType", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_123",
        headers: {},
        body: JSON.stringify({ data: "no event type" }),
      }),
    /webhook\.event_type_required/,
  );
});

test("receive rejects eventType not in allowedEventTypes", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_limited",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.created"],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_limited",
        headers: {},
        body: makeValidPayload("task.deleted"),
      }),
    /webhook\.event_type_not_allowed/,
  );
});

test("receive accepts valid payload with eventType field", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep_123",
    headers: {},
    body: makeValidPayload(),
  });

  assert.equal(envelope.endpointId, "ep_123");
  assert.equal(envelope.eventType, "task.created");
  assert.equal(envelope.idempotencyKey, "evt_123");
  assert.equal(envelope.dispatchState, "accepted");
  assert.equal(envelope.signatureVerified, false);
});

test("receive accepts payload with event_type field", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep_123",
    headers: {},
    body: JSON.stringify({ event_type: "task.updated", id: "evt_456" }),
  });

  assert.equal(envelope.eventType, "task.updated");
  assert.equal(envelope.idempotencyKey, "evt_456");
});

test("receive accepts payload with type field", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep_123",
    headers: {},
    body: JSON.stringify({ type: "task.deleted", id: "evt_789" }),
  });

  assert.equal(envelope.eventType, "task.deleted");
  assert.equal(envelope.idempotencyKey, "evt_789");
});

test("receive rejects payload missing idempotency key", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_123",
        headers: {},
        body: JSON.stringify({ eventType: "task.created" }),
      }),
    /webhook\.idempotency_key_required/,
  );
});

test("receive uses idempotency key from header when payload lacks one", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep_123",
    headers: { "idempotency-key": "header_evt_123" },
    body: JSON.stringify({ eventType: "task.created" }),
  });

  assert.equal(envelope.idempotencyKey, "header_evt_123");
});

test("receive returns duplicate for same idempotency key on same endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const body = makeValidPayload();
  service.receive({ endpointId: "ep_123", headers: {}, body });

  const duplicate = service.receive({ endpointId: "ep_123", headers: {}, body });
  assert.equal(duplicate.dispatchState, "duplicate");
});

test("receive returns accepted for same idempotency key on different endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_first",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "ep_second",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const body = makeValidPayload();
  service.receive({ endpointId: "ep_first", headers: {}, body });

  const second = service.receive({ endpointId: "ep_second", headers: {}, body });
  assert.equal(second.dispatchState, "accepted");
});

test("receive verifies sha256_hmac signature when provided", () => {
  const secret = "my_secret_key";
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_signed",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = makeValidPayload();
  const signature = makeHmacSignature(body, secret);

  const envelope = service.receive({
    endpointId: "ep_signed",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(envelope.dispatchState, "accepted");
});

test("receive rejects missing signature for sha256_hmac endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_signed",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "secret",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_signed",
        headers: {},
        body: makeValidPayload(),
      }),
    /webhook\.signature_required/,
  );
});

test("receive rejects invalid signature for sha256_hmac endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_signed",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "correct_secret",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_signed",
        headers: { "x-aa-signature": "sha256=invalidsignature" },
        body: makeValidPayload(),
      }),
    /webhook\.signature_invalid/,
  );
});

test("receive rejects empty signature for sha256_hmac endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_signed",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "secret",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_signed",
        headers: { "x-aa-signature": "   " },
        body: makeValidPayload(),
      }),
    /webhook\.signature_invalid/,
  );
});

test("receive rejects invalid JSON body", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_123",
        headers: {},
        body: "not valid json",
      }),
    /webhook\.invalid_json/,
  );
});

test("receive rejects non-object JSON body", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_123",
        headers: {},
        body: "null",
      }),
    /webhook\.invalid_json/,
  );

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep_123",
        headers: {},
        body: "[1, 2, 3]",
      }),
    /webhook\.invalid_json/,
  );
});

test("listAcceptedEnvelopes returns all accepted envelopes", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({ endpointId: "ep_123", headers: {}, body: makeValidPayload("task.created", "evt_1") });
  service.receive({ endpointId: "ep_123", headers: {}, body: makeValidPayload("task.completed", "evt_2") });

  const envelopes = service.listAcceptedEnvelopes();
  assert.equal(envelopes.length, 2);
  assert.equal(envelopes[0]!.idempotencyKey, "evt_1");
  assert.equal(envelopes[1]!.idempotencyKey, "evt_2");
});

test("rollbackAcceptedEnvelope removes envelope by idempotency key", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep_123",
    headers: {},
    body: makeValidPayload(),
  });

  assert.equal(service.listAcceptedEnvelopes().length, 1);

  service.rollbackAcceptedEnvelope("ep_123", envelope.idempotencyKey, envelope.envelopeId);

  assert.equal(service.listAcceptedEnvelopes().length, 0);
});

test("rollbackAcceptedEnvelope ignores mismatched envelopeId", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({ endpointId: "ep_123", headers: {}, body: makeValidPayload() });

  service.rollbackAcceptedEnvelope("ep_123", "evt_123", "wrong_envelope_id");

  assert.equal(service.listAcceptedEnvelopes().length, 1);
});

test("getEndpoint returns registered endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoint = service.getEndpoint("ep_123");
  assert.ok(endpoint != null);
  assert.equal(endpoint!.endpointId, "ep_123");
});

test("getEndpoint returns null for unknown endpoint", () => {
  const service = makeWebhookIngressService();
  const endpoint = service.getEndpoint("unknown");
  assert.equal(endpoint, null);
});

test("deleteEndpoint removes endpoint", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.ok(service.deleteEndpoint("ep_123"));
  assert.equal(service.getEndpoint("ep_123"), null);
});

test("deleteEndpoint returns false for unknown endpoint", () => {
  const service = makeWebhookIngressService();
  assert.equal(service.deleteEndpoint("unknown"), false);
});

test("listEndpoints returns all registered endpoints", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_1",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "ep_2",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoints = service.listEndpoints();
  assert.equal(endpoints.length, 2);
});

test("recordDeliveryFailure increments failure count", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(service.getFailureCount("ep_123"), 0);

  service.recordDeliveryFailure("ep_123");
  assert.equal(service.getFailureCount("ep_123"), 1);

  service.recordDeliveryFailure("ep_123");
  assert.equal(service.getFailureCount("ep_123"), 2);
});

test("recordDeliveryFailure disables endpoint after 50 failures", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Record 49 failures - still enabled
  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("ep_123");
  }
  assert.equal(service.getEndpoint("ep_123")!.enabled, true);

  // 50th failure - disabled
  service.recordDeliveryFailure("ep_123");
  assert.equal(service.getEndpoint("ep_123")!.enabled, false);
});

test("recordDeliveryFailure returns null for unknown endpoint", () => {
  const service = makeWebhookIngressService();
  const result = service.recordDeliveryFailure("unknown");
  assert.equal(result, null);
});

test("resetFailureCount clears failure count", () => {
  const service = makeWebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.recordDeliveryFailure("ep_123");
  service.recordDeliveryFailure("ep_123");
  assert.equal(service.getFailureCount("ep_123"), 2);

  service.resetFailureCount("ep_123");
  assert.equal(service.getFailureCount("ep_123"), 0);
});

test("getFailureCount returns 0 for unknown endpoint", () => {
  const service = makeWebhookIngressService();
  assert.equal(service.getFailureCount("unknown"), 0);
});

// ============================================================================
// WebhookOutboxDispatchService tests
// ============================================================================

test("receiveAndStage persists non-duplicate to outbox", () => {
  const ingressService = makeWebhookIngressService();
  ingressService.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const outboxRepo = makeFakeOutboxRepository();
  const dispatchService = new WebhookOutboxDispatchService(ingressService, outboxRepo);

  const result = dispatchService.receiveAndStage({
    endpointId: "ep_123",
    headers: {},
    body: makeValidPayload(),
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.persistedToOutbox, true);
  assert.ok(result.outboxEntryId != null);
  assert.ok(result.outboxEntryId!.startsWith("outbox_"));
});

test("receiveAndStage does not persist duplicate to outbox", () => {
  const ingressService = makeWebhookIngressService();
  ingressService.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const outboxRepo = makeFakeOutboxRepository();
  const dispatchService = new WebhookOutboxDispatchService(ingressService, outboxRepo);

  const body = makeValidPayload();
  dispatchService.receiveAndStage({ endpointId: "ep_123", headers: {}, body });

  const result = dispatchService.receiveAndStage({ endpointId: "ep_123", headers: {}, body });

  assert.equal(result.duplicate, true);
  assert.equal(result.persistedToOutbox, false);
  assert.equal(result.outboxEntryId, null);
});

test("receiveAndStage includes traceId when provided", () => {
  const ingressService = makeWebhookIngressService();
  ingressService.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const outboxRepo = makeFakeOutboxRepository();
  const dispatchService = new WebhookOutboxDispatchService(ingressService, outboxRepo);

  const result = dispatchService.receiveAndStage({
    endpointId: "ep_123",
    headers: {},
    body: makeValidPayload(),
    traceId: "trace_abc_123",
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.persistedToOutbox, true);
  assert.ok(result.outboxEntryId != null);
});

test("receiveAndStage rolls back envelope when outbox insert fails", () => {
  const ingressService = makeWebhookIngressService();
  ingressService.registerEndpoint({
    endpointId: "ep_123",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Create a failing outbox repository
  const failingOutboxRepo = {
    insertOutboxEntry: (): OutboxRecord => {
      throw new Error("database error");
    },
  } as unknown as OutboxRepository;

  const dispatchService = new WebhookOutboxDispatchService(ingressService, failingOutboxRepo);

  assert.throws(
    () =>
      dispatchService.receiveAndStage({
        endpointId: "ep_123",
        headers: {},
        body: makeValidPayload(),
      }),
    /database error/,
  );

  // Verify envelope was rolled back
  assert.equal(ingressService.listAcceptedEnvelopes().length, 0);
});
