/**
 * Unit tests for WebhookDispatcher - event dispatch behaviors
 * Tests src/platform/five-plane-interface/webhook/index.ts - WebhookIngressService
 *
 * Key behaviors tested:
 * 1. Dispatcher sends webhook events
 * 2. Events are delivered to correct endpoint
 * 3. Retry logic works for failed deliveries
 * 4. Signature verification works
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";

function createHmacSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

// Test 1: Dispatcher sends webhook events - basic event receipt
test("WebhookIngressService receive dispatches event to registered endpoint", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "dispatch-ep-1",
    source: "https://source.example.com",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: ["task.completed", "task.failed"],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "dispatch-ep-1",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "evt-dispatch-1" }),
  });

  assert.equal(envelope.endpointId, "dispatch-ep-1");
  assert.equal(envelope.source, "https://source.example.com");
  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.workspaceId, "workspace-1");
  assert.equal(envelope.eventType, "task.completed");
  assert.equal(envelope.idempotencyKey, "evt-dispatch-1");
  assert.equal(envelope.dispatchState, "accepted");
});

// Test 2: Events are delivered to correct endpoint - endpoint routing
test("WebhookIngressService receive routes event to correct endpoint by endpointId", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "endpoint-alpha",
    source: "https://alpha.example.com",
    tenantId: "tenant-alpha",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.registerEndpoint({
    endpointId: "endpoint-beta",
    source: "https://beta.example.com",
    tenantId: "tenant-beta",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelopeAlpha = service.receive({
    endpointId: "endpoint-alpha",
    headers: {},
    body: JSON.stringify({ eventType: "alert", eventId: "evt-alpha" }),
  });

  const envelopeBeta = service.receive({
    endpointId: "endpoint-beta",
    headers: {},
    body: JSON.stringify({ eventType: "alert", eventId: "evt-beta" }),
  });

  assert.equal(envelopeAlpha.endpointId, "endpoint-alpha");
  assert.equal(envelopeAlpha.source, "https://alpha.example.com");
  assert.equal(envelopeBeta.endpointId, "endpoint-beta");
  assert.equal(envelopeBeta.source, "https://beta.example.com");
  assert.notEqual(envelopeAlpha.envelopeId, envelopeBeta.envelopeId);
});

// Test 3: Events are delivered to correct endpoint - unknown endpoint throws
test("WebhookIngressService receive throws for unknown endpoint", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "known-endpoint",
    source: "https://known.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "unknown-endpoint",
        headers: {},
        body: JSON.stringify({ eventType: "test", eventId: "evt-unknown" }),
      }),
    /endpoint_not_found/,
  );
});

// Test 4: Events are delivered to correct endpoint - disabled endpoint throws
test("WebhookIngressService receive throws for disabled endpoint", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "disabled-ep",
    source: "https://disabled.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "disabled-ep",
        headers: {},
        body: JSON.stringify({ eventType: "test", eventId: "evt-disabled" }),
      }),
    /endpoint_disabled/,
  );
});

// Test 5: Retry logic - failure counting
test("WebhookIngressService recordDeliveryFailure increments failure count", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "retry-ep",
    source: "https://retry.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(service.getFailureCount("retry-ep"), 0);

  service.recordDeliveryFailure("retry-ep");
  assert.equal(service.getFailureCount("retry-ep"), 1);

  service.recordDeliveryFailure("retry-ep");
  assert.equal(service.getFailureCount("retry-ep"), 2);
});

// Test 6: Retry logic - endpoint disabled after 50 failures
test("WebhookIngressService recordDeliveryFailure disables endpoint after 50 failures", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "fail-disable-ep",
    source: "https://fail-disable.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Record 49 failures - endpoint still enabled
  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("fail-disable-ep");
  }
  assert.equal(service.getFailureCount("fail-disable-ep"), 49);
  assert.ok(service.getEndpoint("fail-disable-ep")?.enabled);

  // 50th failure - endpoint disabled
  service.recordDeliveryFailure("fail-disable-ep");
  assert.equal(service.getFailureCount("fail-disable-ep"), 50);
  assert.equal(service.getEndpoint("fail-disable-ep")?.enabled, false);
});

// Test 7: Retry logic - reset failure count
test("WebhookIngressService resetFailureCount clears failure count", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "reset-ep",
    source: "https://reset.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.recordDeliveryFailure("reset-ep");
  service.recordDeliveryFailure("reset-ep");
  service.recordDeliveryFailure("reset-ep");
  assert.equal(service.getFailureCount("reset-ep"), 3);

  service.resetFailureCount("reset-ep");
  assert.equal(service.getFailureCount("reset-ep"), 0);
});

// Test 8: Retry logic - returns null for unknown endpoint
test("WebhookIngressService recordDeliveryFailure returns null for unknown endpoint", () => {
  const service = new WebhookIngressService();

  const result = service.recordDeliveryFailure("non-existent-ep");
  assert.equal(result, null);
});

// Test 9: Signature verification - valid HMAC signature
test("WebhookIngressService receive verifies valid sha256_hmac signature", () => {
  const service = new WebhookIngressService();
  const secret = "dispatch-secret-123";

  service.registerEndpoint({
    endpointId: "signed-dispatch-ep",
    source: "https://signed.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "task.completed", eventId: "evt-signed" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "signed-dispatch-ep",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(envelope.dispatchState, "accepted");
});

// Test 10: Signature verification - missing signature throws
test("WebhookIngressService receive throws when signature missing for signed endpoint", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "sig-missing-ep",
    source: "https://sig-missing.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "some-secret",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "sig-missing-ep",
        headers: {},
        body: JSON.stringify({ eventType: "test", eventId: "evt-no-sig" }),
      }),
    /signature_required/,
  );
});

// Test 11: Signature verification - invalid signature throws
test("WebhookIngressService receive throws when signature invalid", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "sig-invalid-ep",
    source: "https://sig-invalid.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "correct-secret",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "sig-invalid-ep",
        headers: { "x-aa-signature": "sha256=invalidsignature" },
        body: JSON.stringify({ eventType: "test", eventId: "evt-bad-sig" }),
      }),
    /signature_invalid/,
  );
});

// Test 12: Signature verification - algorithm none does not verify
test("WebhookIngressService receive with algorithm none skips signature verification", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "no-verify-ep",
    source: "https://no-verify.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "no-verify-ep",
    headers: { "x-aa-signature": "any-value" },
    body: JSON.stringify({ eventType: "test", eventId: "evt-no-verify" }),
  });

  assert.equal(envelope.signatureVerified, false);
  assert.equal(envelope.dispatchState, "accepted");
});

// Test 13: Signature verification - custom signature header
test("WebhookIngressService receive uses custom signature header", () => {
  const service = new WebhookIngressService();
  const secret = "custom-header-secret";

  service.registerEndpoint({
    endpointId: "custom-header-ep",
    source: "https://custom-header.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
    signatureHeader: "x-webhook-signature",
  });

  const body = JSON.stringify({ eventType: "alert", eventId: "evt-custom-header" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "custom-header-ep",
    headers: { "x-webhook-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

// Test 14: Signature verification - signature without sha256= prefix
test("WebhookIngressService receive accepts signature without sha256= prefix", () => {
  const service = new WebhookIngressService();
  const secret = "no-prefix-secret";

  service.registerEndpoint({
    endpointId: "no-prefix-ep",
    source: "https://no-prefix.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "test", eventId: "evt-no-prefix" });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const envelope = service.receive({
    endpointId: "no-prefix-ep",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

// Test 15: Dispatcher - event type filtering
test("WebhookIngressService receive respects allowedEventTypes filtering", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "filtered-ep",
    source: "https://filtered.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["task.completed", "task.failed"],
    algorithm: "none",
  });

  // Allowed event type should succeed
  const envelopeOk = service.receive({
    endpointId: "filtered-ep",
    headers: {},
    body: JSON.stringify({ eventType: "task.completed", eventId: "evt-allowed" }),
  });
  assert.equal(envelopeOk.dispatchState, "accepted");

  // Disallowed event type should throw
  assert.throws(
    () =>
      service.receive({
        endpointId: "filtered-ep",
        headers: {},
        body: JSON.stringify({ eventType: "task.started", eventId: "evt-disallowed" }),
      }),
    /event_type_not_allowed/,
  );
});

// Test 16: Dispatcher - idempotency key deduplication
test("WebhookIngressService receive deduplicates by idempotency key", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "dedup-ep",
    source: "https://dedup.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const body = JSON.stringify({ eventType: "test", eventId: "dedup-key-123" });

  const envelope1 = service.receive({
    endpointId: "dedup-ep",
    headers: {},
    body,
  });
  assert.equal(envelope1.dispatchState, "accepted");

  const envelope2 = service.receive({
    endpointId: "dedup-ep",
    headers: {},
    body,
  });
  assert.equal(envelope2.dispatchState, "duplicate");
  assert.equal(envelope2.envelopeId, envelope1.envelopeId);
});

// Test 17: Dispatcher - idempotency key from header
test("WebhookIngressService receive uses idempotency key from header", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "header-idempotency-ep",
    source: "https://header-idemp.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
    idempotencyHeader: "x-idempotency-key",
  });

  const envelope = service.receive({
    endpointId: "header-idempotency-ep",
    headers: { "x-idempotency-key": "header-based-key" },
    body: JSON.stringify({ eventType: "test" }),
  });

  assert.equal(envelope.idempotencyKey, "header-based-key");
});

// Test 18: Dispatcher - list accepted envelopes
test("WebhookIngressService listAcceptedEnvelopes returns all accepted envelopes", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "list-ep",
    source: "https://list.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({
    endpointId: "list-ep",
    headers: {},
    body: JSON.stringify({ eventType: "event.1", eventId: "list-1" }),
  });

  service.receive({
    endpointId: "list-ep",
    headers: {},
    body: JSON.stringify({ eventType: "event.2", eventId: "list-2" }),
  });

  const envelopes = service.listAcceptedEnvelopes();
  assert.equal(envelopes.length, 2);
  assert.ok(envelopes.some(e => e.idempotencyKey === "list-1"));
  assert.ok(envelopes.some(e => e.idempotencyKey === "list-2"));
});

// Test 19: Dispatcher - list endpoints
test("WebhookIngressService listEndpoints returns all registered endpoints", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "list-endpoints-1",
    source: "https://ep1.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.registerEndpoint({
    endpointId: "list-endpoints-2",
    source: "https://ep2.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoints = service.listEndpoints();
  assert.equal(endpoints.length, 2);
  assert.ok(endpoints.some(e => e.endpointId === "list-endpoints-1"));
  assert.ok(endpoints.some(e => e.endpointId === "list-endpoints-2"));
});

// Test 20: Dispatcher - delete endpoint
test("WebhookIngressService deleteEndpoint removes endpoint", () => {
  const service = new WebhookIngressService();

  service.registerEndpoint({
    endpointId: "delete-me",
    source: "https://delete.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(service.listEndpoints().length, 1);

  const deleted = service.deleteEndpoint("delete-me");
  assert.equal(deleted, true);
  assert.equal(service.listEndpoints().length, 0);

  // Verify deleted endpoint no longer accepts events
  assert.throws(
    () =>
      service.receive({
        endpointId: "delete-me",
        headers: {},
        body: JSON.stringify({ eventType: "test", eventId: "evt-after-delete" }),
      }),
    /endpoint_not_found/,
  );
});
