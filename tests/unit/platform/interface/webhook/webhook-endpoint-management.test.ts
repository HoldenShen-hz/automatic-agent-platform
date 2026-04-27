/**
 * Unit tests for Webhook Ingress Service endpoint management
 * Tests src/platform/interface/webhook/index.ts - endpoint management methods
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";

test("WebhookIngressService registerEndpoint normalizes tenantId to null", () => {
  const service = new WebhookIngressService();
  const registration = {
    endpointId: "ep-tenant-null",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [] as string[],
    algorithm: "none" as const,
  };

  const result = service.registerEndpoint(registration);

  assert.equal(result.tenantId, null);
  assert.equal(result.workspaceId, null);
});

test("WebhookIngressService getEndpoint returns registered endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-get",
    source: "https://source.example.com",
    tenantId: "tenant-get",
    workspaceId: "workspace-get",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoint = service.getEndpoint("ep-get");

  assert.ok(endpoint !== null);
  assert.equal(endpoint?.endpointId, "ep-get");
  assert.equal(endpoint?.tenantId, "tenant-get");
});

test("WebhookIngressService getEndpoint returns null for unknown", () => {
  const service = new WebhookIngressService();

  const endpoint = service.getEndpoint("unknown-ep");

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
    algorithm: "none",
  });

  const deleted = service.deleteEndpoint("ep-delete");
  assert.equal(deleted, true);

  const endpoint = service.getEndpoint("ep-delete");
  assert.equal(endpoint, null);
});

test("WebhookIngressService deleteEndpoint returns false for unknown", () => {
  const service = new WebhookIngressService();

  const deleted = service.deleteEndpoint("unknown-ep");

  assert.equal(deleted, false);
});

test("WebhookIngressService listEndpoints returns all endpoints", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-list-1",
    source: "https://source1.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "ep-list-2",
    source: "https://source2.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoints = service.listEndpoints();

  assert.equal(endpoints.length, 2);
});

test("WebhookIngressService recordDeliveryFailure increments failure count", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-fail",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(service.getFailureCount("ep-fail"), 0);

  service.recordDeliveryFailure("ep-fail");
  assert.equal(service.getFailureCount("ep-fail"), 1);

  service.recordDeliveryFailure("ep-fail");
  assert.equal(service.getFailureCount("ep-fail"), 2);
});

test("WebhookIngressService recordDeliveryFailure disables after 50 failures", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-fail-disable",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("ep-fail-disable");
  }

  // Still enabled at 49
  let endpoint = service.getEndpoint("ep-fail-disable");
  assert.equal(endpoint?.enabled, true);

  // Disabled at 50
  service.recordDeliveryFailure("ep-fail-disable");
  endpoint = service.getEndpoint("ep-fail-disable");
  assert.equal(endpoint?.enabled, false);
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
    algorithm: "none",
  });

  service.recordDeliveryFailure("ep-reset");
  service.recordDeliveryFailure("ep-reset");
  assert.equal(service.getFailureCount("ep-reset"), 2);

  service.resetFailureCount("ep-reset");
  assert.equal(service.getFailureCount("ep-reset"), 0);
});

test("WebhookIngressService getFailureCount returns 0 for unknown endpoint", () => {
  const service = new WebhookIngressService();

  assert.equal(service.getFailureCount("unknown"), 0);
});

test("WebhookIngressService listAcceptedEnvelopes returns copy of array", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-envelopes",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({
    endpointId: "ep-envelopes",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "evt-1" }),
  });

  const envelopes1 = service.listAcceptedEnvelopes();
  const envelopes2 = service.listAcceptedEnvelopes();

  assert.equal(envelopes1.length, 1);
  assert.equal(envelopes2.length, 1);

  // Modifying one should not affect the other
  envelopes1.push({} as any);
  assert.equal(envelopes2.length, 1);
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
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-rollback",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "evt-rollback" }),
  });

  assert.equal(service.listAcceptedEnvelopes().length, 1);

  service.rollbackAcceptedEnvelope(
    envelope.endpointId,
    envelope.idempotencyKey,
    envelope.envelopeId,
  );

  assert.equal(service.listAcceptedEnvelopes().length, 0);
});

test("WebhookIngressService rollbackAcceptedEnvelope ignores wrong envelopeId", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-rollback-wrong",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({
    endpointId: "ep-rollback-wrong",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "evt-rb" }),
  });

  // Try to rollback with wrong envelope ID
  service.rollbackAcceptedEnvelope("ep-rollback-wrong", "evt-rb", "wrong-envelope-id");

  // Should still have the envelope
  assert.equal(service.listAcceptedEnvelopes().length, 1);
});

test("WebhookIngressService receive deduplicates by idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-dedup",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const first = service.receive({
    endpointId: "ep-dedup",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "same-key" }),
  });

  const second = service.receive({
    endpointId: "ep-dedup",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "same-key" }),
  });

  assert.equal(first.envelopeId, second.envelopeId);
  assert.equal(second.dispatchState, "duplicate");
});

test("WebhookIngressService receive accepts idempotency key from header", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-header-idempotency",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
    idempotencyHeader: "idempotency-key",
  });

  const envelope = service.receive({
    endpointId: "ep-header-idempotency",
    headers: { "idempotency-key": "header-key-123" },
    body: JSON.stringify({ eventType: "test" }),
  });

  assert.equal(envelope.idempotencyKey, "header-key-123");
});

test("WebhookIngressService receive uses event_id fallback for idempotency", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-event-id",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-event-id",
    headers: {},
    body: JSON.stringify({ eventType: "test", event_id: "event-id-fallback" }),
  });

  assert.equal(envelope.idempotencyKey, "event-id-fallback");
});
