/**
 * Unit tests for Webhook payload parsing edge cases
 * Tests src/platform/five-plane-interface/webhook/index.ts - parseWebhookPayload function
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";

test("WebhookIngressService receive accepts payload with eventType key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-event-type",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-event-type",
    headers: {},
    body: JSON.stringify({ eventType: "task.created", eventId: "evt-1" }),
  });

  assert.equal(envelope.eventType, "task.created");
  assert.equal(envelope.idempotencyKey, "evt-1");
});

test("WebhookIngressService receive accepts payload with event_type key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-event-type-underscore",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-event-type-underscore",
    headers: {},
    body: JSON.stringify({ event_type: "deployment.succeeded", event_id: "evt-2" }),
  });

  assert.equal(envelope.eventType, "deployment.succeeded");
  assert.equal(envelope.idempotencyKey, "evt-2");
});

test("WebhookIngressService receive accepts payload with type key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-type-key",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-type-key",
    headers: {},
    body: JSON.stringify({ type: "incident.created", id: "evt-3" }),
  });

  assert.equal(envelope.eventType, "incident.created");
  assert.equal(envelope.idempotencyKey, "evt-3");
});

test("WebhookIngressService receive prefers eventType over event_type", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-preference",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-preference",
    headers: {},
    body: JSON.stringify({
      eventType: "primary.event",
      event_type: "secondary.event",
      type: "tertiary.event",
      eventId: "evt-preference-1",
    }),
  });

  assert.equal(envelope.eventType, "primary.event");
});

test("WebhookIngressService receive prefers event_type over type", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-preference-2",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-preference-2",
    headers: {},
    body: JSON.stringify({
      event_type: "secondary.event",
      type: "tertiary.event",
      eventId: "evt-preference-2",
    }),
  });

  assert.equal(envelope.eventType, "secondary.event");
});

test("WebhookIngressService receive throws when no event type key present", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-no-event-type",
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
        endpointId: "ep-no-event-type",
        headers: {},
        body: JSON.stringify({ eventId: "evt-only" }),
      }),
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
  service.registerEndpoint({
    endpointId: "ep-complex",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-complex",
    headers: {},
    body: JSON.stringify({
      eventType: "task.created",
      eventId: "evt-complex",
      data: {
        taskId: "task-123",
        metadata: { priority: "high", tags: ["urgent", "review"] },
      },
    }),
  });

  assert.equal(envelope.eventType, "task.created");
  assert.deepEqual(envelope.payload.data, {
    taskId: "task-123",
    metadata: { priority: "high", tags: ["urgent", "review"] },
  });
});

test("WebhookIngressService receive trims whitespace from idempotency keys", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-trim",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-trim",
    headers: {},
    body: JSON.stringify({ eventType: "test", eventId: "  evt-with-spaces  " }),
  });

  assert.equal(envelope.idempotencyKey, "evt-with-spaces");
});
