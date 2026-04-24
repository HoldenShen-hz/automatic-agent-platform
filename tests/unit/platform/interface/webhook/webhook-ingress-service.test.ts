import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { createHmac } from "node:crypto";

function createHmacSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("WebhookIngressService registerEndpoint stores endpoint", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "ep-001",
    source: "https://external.example.com",
    tenantId: "tenant-a",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed", "task.failed"],
    algorithm: "none" as const,
  };

  const result = service.registerEndpoint(registration);

  assert.equal(result.endpointId, "ep-001");
  assert.equal(result.signatureHeader, "x-aa-signature");
  assert.equal(result.idempotencyHeader, "idempotency-key");
});

test("WebhookIngressService registerEndpoint normalizes duplicate event types", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "ep-002",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["event.A", "event.A", "event.B", "event.A"],
    algorithm: "none" as const,
  };

  const result = service.registerEndpoint(registration);

  assert.equal(result.allowedEventTypes.length, 2);
});

test("WebhookIngressService registerEndpoint throws for missing signing secret on signed endpoint", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "ep-003",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed"],
    algorithm: "sha256_hmac" as const,
    signingSecret: "",
  };

  assert.throws(
    () => service.registerEndpoint(registration),
    (err: any) => err.message.includes("signing secret"),
  );
});

test("WebhookIngressService registerEndpoint throws for empty endpoint id", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "   ",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  };

  assert.throws(
    () => service.registerEndpoint(registration),
    (err: any) => err.message.includes("endpoint id"),
  );
});

test("WebhookIngressService registerEndpoint throws for empty source", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "ep-004",
    source: "   ",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  };

  assert.throws(
    () => service.registerEndpoint(registration),
    (err: any) => err.message.includes("source"),
  );
});

test("WebhookIngressService receive processes valid webhook with eventType", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-005",
    source: "https://source.example.com",
    tenantId: "tenant-a",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed"],
    algorithm: "none" as const,
  });

  const envelope = service.receive({
    endpointId: "ep-005",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "evt-001", data: { taskId: "task-123" } }),
  });

  assert.equal(envelope.endpointId, "ep-005");
  assert.equal(envelope.eventType, "task.completed");
  assert.equal(envelope.idempotencyKey, "evt-001");
  assert.equal(envelope.dispatchState, "accepted");
  assert.equal(envelope.signatureVerified, false);
});

test("WebhookIngressService receive processes valid webhook with event_type", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-006",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.failed"],
    algorithm: "none" as const,
  });

  const envelope = service.receive({
    endpointId: "ep-006",
    headers: {},
    body: JSON.stringify({ event_type: "task.failed", event_id: "evt-002" }),
  });

  assert.equal(envelope.eventType, "task.failed");
  assert.equal(envelope.idempotencyKey, "evt-002");
});

test("WebhookIngressService receive processes valid webhook with type", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-007",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["alert"],
    algorithm: "none" as const,
  });

  const envelope = service.receive({
    endpointId: "ep-007",
    headers: {},
    body: JSON.stringify({ type: "alert", id: "evt-003" }),
  });

  assert.equal(envelope.eventType, "alert");
  assert.equal(envelope.idempotencyKey, "evt-003");
});

test("WebhookIngressService receive throws for unknown endpoint", () => {
  const service = new WebhookIngressService();

  assert.throws(
    () => service.receive({
      endpointId: "unknown-ep",
      headers: {},
      body: JSON.stringify({ eventType: "task.completed", eventId: "evt-001" }),
    }),
    (err: any) => err.message.includes("not found"),
  );
});

test("WebhookIngressService receive throws for disabled endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-disabled",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: ["task.completed"],
    algorithm: "none" as const,
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-disabled",
      headers: {},
      body: JSON.stringify({ eventType: "task.completed", eventId: "evt-001" }),
    }),
    (err: any) => err.message.includes("disabled"),
  );
});

test("WebhookIngressService receive throws when event type not allowed", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-008",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed"],
    algorithm: "none" as const,
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-008",
      headers: {},
      body: JSON.stringify({ eventType: "task.failed", eventId: "evt-001" }),
    }),
    (err: any) => err.message.includes("not allowed"),
  );
});

test("WebhookIngressService receive throws when no event type in payload", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-009",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-009",
      headers: {},
      body: JSON.stringify({ eventId: "evt-001", data: {} }),
    }),
    (err: any) => err.message.includes("event type"),
  );
});

test("WebhookIngressService receive throws when no idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-010",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-010",
      headers: {},
      body: JSON.stringify({ eventType: "task.completed" }),
    }),
    (err: any) => err.message.includes("idempotency"),
  );
});

test("WebhookIngressService receive returns duplicate for same idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-011",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  const first = service.receive({
    endpointId: "ep-011",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "same-key" }),
  });

  const second = service.receive({
    endpointId: "ep-011",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "same-key" }),
  });

  assert.equal(second.dispatchState, "duplicate");
  assert.equal(second.envelopeId, first.envelopeId);
});

test("WebhookIngressService receive with signature verification validates correctly", () => {
  const service = new WebhookIngressService();
  const secret = "webhook-secret-123";
  service.registerEndpoint({
    endpointId: "ep-signed",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac" as const,
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "task.completed", eventId: "signed-evt" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-signed",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(envelope.dispatchState, "accepted");
});

test("WebhookIngressService receive throws for missing signature header", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-no-sig",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac" as const,
    signingSecret: "secret",
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-no-sig",
      headers: {},
      body: JSON.stringify({ eventType: "task.completed", eventId: "evt" }),
    }),
    (err: any) => err.message.includes("signature"),
  );
});

test("WebhookIngressService receive throws for invalid signature", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-bad-sig",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac" as const,
    signingSecret: "correct-secret",
  });

  assert.throws(
    () => service.receive({
      endpointId: "ep-bad-sig",
      headers: { "x-aa-signature": "sha256=invalidsignature" },
      body: JSON.stringify({ eventType: "task.completed", eventId: "evt" }),
    }),
    (err: any) => err.message.includes("verification failed"),
  );
});

test("WebhookIngressService listAcceptedEnvelopes returns all accepted envelopes", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-list",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  service.receive({ endpointId: "ep-list", headers: {}, body: JSON.stringify({ eventType: "a", eventId: "1" }) });
  service.receive({ endpointId: "ep-list", headers: {}, body: JSON.stringify({ eventType: "b", eventId: "2" }) });

  const envelopes = service.listAcceptedEnvelopes();

  assert.equal(envelopes.length, 2);
});

test("WebhookIngressService rollbackAcceptedEnvelope removes envelope", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-rollback",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  const envelope = service.receive({
    endpointId: "ep-rollback",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "rollback-key" }),
  });

  service.rollbackAcceptedEnvelope("ep-rollback", "rollback-key", envelope.envelopeId);

  const remaining = service.listAcceptedEnvelopes();
  assert.equal(remaining.some((e: { envelopeId: string }) => e.envelopeId === envelope.envelopeId), false);
});

test("WebhookIngressService rollbackAcceptedEnvelope does nothing for wrong envelope id", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-rollback2",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  const envelope = service.receive({
    endpointId: "ep-rollback2",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "key2" }),
  });

  service.rollbackAcceptedEnvelope("ep-rollback2", "key2", "wrong-envelope-id");

  const remaining = service.listAcceptedEnvelopes();
  assert.equal(remaining.some((e: { envelopeId: string }) => e.envelopeId === envelope.envelopeId), true);
});

test("WebhookIngressService getEndpoint returns endpoint registration", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-get",
    source: "https://source.example.com",
    tenantId: "tenant-x",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed"],
    algorithm: "none" as const,
  });

  const endpoint = service.getEndpoint("ep-get");

  assert.ok(endpoint);
  assert.equal(endpoint?.tenantId, "tenant-x");
  assert.equal(endpoint?.allowedEventTypes.length, 1);
});

test("WebhookIngressService getEndpoint returns null for unknown", () => {
  const service = new WebhookIngressService();

  const endpoint = service.getEndpoint("unknown");

  assert.equal(endpoint, null);
});

test("WebhookIngressService deleteEndpoint removes endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-delete",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  const deleted = service.deleteEndpoint("ep-delete");

  assert.equal(deleted, true);
  assert.equal(service.getEndpoint("ep-delete"), null);
});

test("WebhookIngressService deleteEndpoint returns false for unknown", () => {
  const service = new WebhookIngressService();

  const deleted = service.deleteEndpoint("unknown");

  assert.equal(deleted, false);
});

test("WebhookIngressService recordDeliveryFailure increments failure count and disables at 50", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-fail",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("ep-fail");
  }
  assert.equal(service.getFailureCount("ep-fail"), 49);
  const endpoint = service.getEndpoint("ep-fail");
  assert.equal(endpoint?.enabled, true);

  service.recordDeliveryFailure("ep-fail");
  assert.equal(service.getFailureCount("ep-fail"), 50);
  const disabledEndpoint = service.getEndpoint("ep-fail");
  assert.equal(disabledEndpoint?.enabled, false);
});

test("WebhookIngressService resetFailureCount clears count", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-reset",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  service.recordDeliveryFailure("ep-reset");
  service.recordDeliveryFailure("ep-reset");
  assert.equal(service.getFailureCount("ep-reset"), 2);

  service.resetFailureCount("ep-reset");
  assert.equal(service.getFailureCount("ep-reset"), 0);
});

test("WebhookIngressService listEndpoints returns all endpoints", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-a",
    source: "https://a.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });
  service.registerEndpoint({
    endpointId: "ep-b",
    source: "https://b.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none" as const,
  });

  const endpoints = service.listEndpoints();

  assert.equal(endpoints.length, 2);
});
