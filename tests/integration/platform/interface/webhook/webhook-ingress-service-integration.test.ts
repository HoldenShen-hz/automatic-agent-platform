import assert from "node:assert/strict";
import test from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { createHmac } from "node:crypto";

function createWebhookTestHarness() {
  const service = new WebhookIngressService();

  return {
    service,
  };
}

function makeSignature(body: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

test("WebhookIngressService registers endpoint and receives payload", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "test-endpoint-1",
    source: "test-source",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: ["task.completed", "task.failed"],
    algorithm: "none",
  });

  const envelope = h.service.receive({
    endpointId: "test-endpoint-1",
    headers: {},
    body: JSON.stringify({
      eventType: "task.completed",
      eventId: "evt-123",
      data: { taskId: "task-abc" },
    }),
  });

  assert.ok(envelope.envelopeId.startsWith("webhook:"));
  assert.equal(envelope.endpointId, "test-endpoint-1");
  assert.equal(envelope.source, "test-source");
  assert.equal(envelope.eventType, "task.completed");
  assert.equal(envelope.idempotencyKey, "evt-123");
  assert.equal(envelope.dispatchState, "accepted");
  assert.deepEqual(envelope.payload.data, { taskId: "task-abc" });
});

test("WebhookIngressService rejects duplicate idempotency key", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "dedup-endpoint",
    source: "dedup-source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const body = JSON.stringify({ eventType: "ping", eventId: "dedup-1" });

  const first = h.service.receive({
    endpointId: "dedup-endpoint",
    headers: {},
    body,
  });
  assert.equal(first.dispatchState, "accepted");

  const second = h.service.receive({
    endpointId: "dedup-endpoint",
    headers: {},
    body,
  });
  assert.equal(second.dispatchState, "duplicate");
  assert.equal(second.envelopeId, first.envelopeId);
});

test("WebhookIngressService rejects unknown endpoint", () => {
  const h = createWebhookTestHarness();

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "unknown-endpoint",
        headers: {},
        body: JSON.stringify({ eventType: "test" }),
      }),
    /webhook\.endpoint_not_found/,
  );
});

test("WebhookIngressService rejects disabled endpoint", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "disabled-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "disabled-ep",
        headers: {},
        body: JSON.stringify({ eventType: "test" }),
      }),
    /webhook\.endpoint_disabled/,
  );
});

test("WebhookIngressService validates event type is required", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "no-event-type-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "no-event-type-ep",
        headers: {},
        body: JSON.stringify({ eventId: "123" }),
      }),
    /webhook\.event_type_required/,
  );
});

test("WebhookIngressService filters disallowed event types", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "filtered-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["allowed.event"],
    algorithm: "none",
  });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "filtered-ep",
        headers: {},
        body: JSON.stringify({ eventType: "forbidden.event", eventId: "123" }),
      }),
    /webhook\.event_type_not_allowed/,
  );
});

test("WebhookIngressService requires idempotency key", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "no-idem-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "no-idem-ep",
        headers: {},
        body: JSON.stringify({ eventType: "test" }),
      }),
    /webhook\.idempotency_key_required/,
  );
});

test("WebhookIngressService verifies sha256_hmac signature", () => {
  const h = createWebhookTestHarness();
  const secret = "test-signing-secret";

  h.service.registerEndpoint({
    endpointId: "signed-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
    signatureHeader: "x-webhook-signature",
  });

  const body = JSON.stringify({ eventType: "test", eventId: "sig-test" });
  const signature = makeSignature(body, secret);

  const envelope = h.service.receive({
    endpointId: "signed-ep",
    headers: { "x-webhook-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(envelope.dispatchState, "accepted");
});

test("WebhookIngressService rejects invalid signature", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "bad-sig-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "correct-secret",
    signatureHeader: "x-webhook-signature",
  });

  const body = JSON.stringify({ eventType: "test", eventId: "bad-sig" });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "bad-sig-ep",
        headers: { "x-webhook-signature": "sha256=invalid" },
        body,
      }),
    /webhook\.signature_invalid/,
  );
});

test("WebhookIngressService rejects missing signature on signed endpoint", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "missing-sig-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "some-secret",
  });

  assert.throws(
    () =>
      h.service.receive({
        endpointId: "missing-sig-ep",
        headers: {},
        body: JSON.stringify({ eventType: "test", eventId: "no-sig" }),
      }),
    /webhook\.signature_required/,
  );
});

test("WebhookIngressService handles alternate event type field names", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "alt-field-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["custom.event"],
    algorithm: "none",
  });

  // Test event_type (underscore variant)
  const envelope1 = h.service.receive({
    endpointId: "alt-field-ep",
    headers: {},
    body: JSON.stringify({ event_type: "custom.event", event_id: "alt-1" }),
  });
  assert.equal(envelope1.eventType, "custom.event");

  // Test type (shorthand variant)
  const envelope2 = h.service.receive({
    endpointId: "alt-field-ep",
    headers: {},
    body: JSON.stringify({ type: "custom.event", id: "alt-2" }),
  });
  assert.equal(envelope2.eventType, "custom.event");
});

test("WebhookIngressService tracks failure counts and disables endpoint", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "failing-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Record failures up to threshold (50)
  for (let i = 0; i < 49; i++) {
    const result = h.service.recordDeliveryFailure("failing-ep");
    assert.equal(result?.enabled, true, `should still be enabled at count ${i + 1}`);
  }

  // 50th failure should disable
  const finalResult = h.service.recordDeliveryFailure("failing-ep");
  assert.equal(finalResult?.enabled, false, "should be disabled after 50 failures");

  // Verify endpoint is now disabled
  const endpoint = h.service.getEndpoint("failing-ep");
  assert.equal(endpoint?.enabled, false);
});

test("WebhookIngressService resets failure count", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "reset-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  h.service.recordDeliveryFailure("reset-ep");
  h.service.recordDeliveryFailure("reset-ep");
  assert.equal(h.service.getFailureCount("reset-ep"), 2);

  h.service.resetFailureCount("reset-ep");
  assert.equal(h.service.getFailureCount("reset-ep"), 0);
});

test("WebhookIngressService lists accepted envelopes", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "list-ep",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  h.service.receive({
    endpointId: "list-ep",
    headers: {},
    body: JSON.stringify({ eventType: "e1", eventId: "id-1" }),
  });

  h.service.receive({
    endpointId: "list-ep",
    headers: {},
    body: JSON.stringify({ eventType: "e2", eventId: "id-2" }),
  });

  const envelopes = h.service.listAcceptedEnvelopes();
  assert.equal(envelopes.length, 2);
  assert.ok(envelopes.some((e) => e.eventType === "e1"));
  assert.ok(envelopes.some((e) => e.eventType === "e2"));
});

test("WebhookIngressService deletes endpoints", () => {
  const h = createWebhookTestHarness();

  h.service.registerEndpoint({
    endpointId: "delete-me",
    source: "test",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.ok(h.service.getEndpoint("delete-me") != null);

  const deleted = h.service.deleteEndpoint("delete-me");
  assert.equal(deleted, true);

  assert.equal(h.service.getEndpoint("delete-me"), null);
});

test("WebhookIngressService validates non-empty endpoint id", () => {
  const h = createWebhookTestHarness();

  assert.throws(
    () =>
      h.service.registerEndpoint({
        endpointId: "   ",
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

test("WebhookIngressService validates non-empty source", () => {
  const h = createWebhookTestHarness();

  assert.throws(
    () =>
      h.service.registerEndpoint({
        endpointId: "valid-id",
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

test("WebhookIngressService requires signing secret for sha256_hmac", () => {
  const h = createWebhookTestHarness();

  assert.throws(
    () =>
      h.service.registerEndpoint({
        endpointId: "hmac-no-secret",
        source: "test",
        tenantId: null,
        workspaceId: null,
        enabled: true,
        allowedEventTypes: [],
        algorithm: "sha256_hmac",
        signingSecret: "",
      }),
    /webhook\.signing_secret_required/,
  );
});
