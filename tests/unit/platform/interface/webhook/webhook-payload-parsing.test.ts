/**
 * Unit tests for Webhook payload parsing edge cases
 * Tests src/platform/five-plane-interface/webhook/index.ts - parseWebhookPayload function
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";
import { createSignedWebhookHeaders, TEST_WEBHOOK_SIGNING_SECRET } from "../../../../helpers/webhook-signing.js";

function registerSignedEndpoint(service: WebhookIngressService, endpointId: string): void {
  service.registerEndpoint({
    endpointId,
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: TEST_WEBHOOK_SIGNING_SECRET,
  });
}

test("WebhookIngressService receive accepts payload with eventType key", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-event-type");
  const body = JSON.stringify({ eventType: "task.created", eventId: "evt-1" });

  const envelope = service.receive({
    endpointId: "ep-event-type",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "task.created");
  assert.equal(envelope.idempotencyKey, "evt-1");
});

test("WebhookIngressService receive accepts payload with event_type key", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-event-type-underscore");
  const body = JSON.stringify({ event_type: "deployment.succeeded", event_id: "evt-2" });

  const envelope = service.receive({
    endpointId: "ep-event-type-underscore",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "deployment.succeeded");
  assert.equal(envelope.idempotencyKey, "evt-2");
});

test("WebhookIngressService receive accepts payload with type key", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-type-key");
  const body = JSON.stringify({ type: "incident.created", id: "evt-3" });

  const envelope = service.receive({
    endpointId: "ep-type-key",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "incident.created");
  assert.equal(envelope.idempotencyKey, "evt-3");
});

test("WebhookIngressService receive prefers eventType over event_type", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-preference");
  const body = JSON.stringify({
    eventType: "primary.event",
    event_type: "secondary.event",
    type: "tertiary.event",
    eventId: "evt-preference-1",
  });

  const envelope = service.receive({
    endpointId: "ep-preference",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "primary.event");
});

test("WebhookIngressService receive prefers event_type over type", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-preference-2");
  const body = JSON.stringify({
    event_type: "secondary.event",
    type: "tertiary.event",
    eventId: "evt-preference-2",
  });

  const envelope = service.receive({
    endpointId: "ep-preference-2",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "secondary.event");
});

test("WebhookIngressService receive throws when no event type key present", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-no-event-type");

  assert.throws(
    () => {
      const body = JSON.stringify({ eventId: "evt-only" });
      service.receive({
        endpointId: "ep-no-event-type",
        headers: createSignedWebhookHeaders(body),
        body,
      });
    },
    /event_type_required/,
  );
});

test("WebhookIngressService receive throws when payload is not JSON object", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-invalid-json-type",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep-invalid-json-type",
        headers: {},
        body: "not a json object",
      }),
    /invalid_json/,
  );
});

test("WebhookIngressService receive throws when payload is array", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-array-payload",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep-array-payload",
        headers: {},
        body: JSON.stringify([{ eventType: "task" }]),
      }),
    /invalid_json/,
  );
});

test("WebhookIngressService receive throws when payload is null", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-null-payload",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep-null-payload",
        headers: {},
        body: "null",
      }),
    /invalid_json/,
  );
});

test("WebhookIngressService receive handles whitespace-only body as invalid", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-whitespace-body",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(
    () =>
      service.receive({
        endpointId: "ep-whitespace-body",
        headers: {},
        body: "   ",
      }),
    /invalid_json/,
  );
});

test("WebhookIngressService receive accepts complex nested payload", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-complex");
  const body = JSON.stringify({
    eventType: "task.created",
    eventId: "evt-complex",
    data: {
      taskId: "task-123",
      metadata: { priority: "high", tags: ["urgent", "review"] },
    },
  });

  const envelope = service.receive({
    endpointId: "ep-complex",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.eventType, "task.created");
  assert.deepEqual(envelope.payload.data, {
    taskId: "task-123",
    metadata: { priority: "high", tags: ["urgent", "review"] },
  });
});

test("WebhookIngressService receive trims whitespace from idempotency keys", () => {
  const service = new WebhookIngressService();
  registerSignedEndpoint(service, "ep-trim");
  const body = JSON.stringify({ eventType: "test", eventId: "  evt-with-spaces  " });

  const envelope = service.receive({
    endpointId: "ep-trim",
    headers: createSignedWebhookHeaders(body),
    body,
  });

  assert.equal(envelope.idempotencyKey, "evt-with-spaces");
});
