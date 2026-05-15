import assert from "node:assert/strict";
import test from "node:test";

import {
  WebhookIngressService,
  type WebhookEndpointRegistration,
  type InboundWebhookRequest,
  type WebhookDispatchState,
  type WebhookDispatchEnvelope,
  type WebhookSignatureAlgorithm,
} from "../../../../../src/platform/five-plane-interface/webhook/index.js";

test("WebhookIngressService registers and retrieves endpoints", () => {
  const service = new WebhookIngressService();
  const registration = service.registerEndpoint({
    endpointId: "test-endpoint",
    source: "test-source",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: ["event.one", "event.two"],
    algorithm: "none",
  });

  assert.equal(registration.endpointId, "test-endpoint");
  assert.equal(registration.source, "test-source");
  assert.deepEqual(registration.allowedEventTypes, ["event.one", "event.two"]);

  const retrieved = service.getEndpoint("test-endpoint");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.endpointId, "test-endpoint");
});

test("WebhookIngressService lists all registered endpoints", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-1",
    source: "source-1",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "ep-2",
    source: "source-2",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const endpoints = service.listEndpoints();
  assert.equal(endpoints.length, 2);
});

test("WebhookIngressService receives valid webhook and returns accepted envelope", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-1",
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["pull_request.opened"],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({
      eventType: "pull_request.opened",
      eventId: "evt-123",
      repository: "test-repo",
    }),
  });

  assert.equal(envelope.endpointId, "github");
  assert.equal(envelope.eventType, "pull_request.opened");
  assert.equal(envelope.dispatchState, "accepted");
  assert.equal(envelope.idempotencyKey, "evt-123");
});

test("WebhookIngressService returns duplicate for repeated idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["pull_request.opened"],
    algorithm: "none",
  });

  const first = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({
      eventType: "pull_request.opened",
      eventId: "evt-1",
    }),
  });

  const second = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({
      eventType: "pull_request.opened",
      eventId: "evt-1",
    }),
  });

  assert.equal(first.dispatchState, "accepted");
  assert.equal(second.dispatchState, "duplicate");
  assert.equal(second.envelopeId, first.envelopeId);
});

test("WebhookIngressService throws for unknown endpoint", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.receive({
      endpointId: "unknown",
      headers: {},
      body: JSON.stringify({ eventType: "test", eventId: "id" }),
    });
  });
});

test("WebhookIngressService throws for disabled endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "disabled-ep",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "disabled-ep",
      headers: {},
      body: JSON.stringify({ eventType: "test", eventId: "id" }),
    });
  });
});

test("WebhookIngressService throws for disallowed event type", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "restricted",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["allowed.event"],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "restricted",
      headers: {},
      body: JSON.stringify({ eventType: "disallowed.event", eventId: "id" }),
    });
  });
});

test("WebhookIngressService deletes endpoints", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "to-delete",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const deleted = service.deleteEndpoint("to-delete");
  assert.equal(deleted, true);

  const retrieved = service.getEndpoint("to-delete");
  assert.equal(retrieved, null);
});

test("WebhookIngressService records delivery failure and disables after 50 failures", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "flaky",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("flaky");
  }
  assert.equal(service.getFailureCount("flaky"), 49);
  assert.ok(service.getEndpoint("flaky")?.enabled === true);

  service.recordDeliveryFailure("flaky");
  assert.ok(service.getEndpoint("flaky")?.enabled === false);
});

test("WebhookIngressService resets failure count", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "reset-test",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.recordDeliveryFailure("reset-test");
  service.recordDeliveryFailure("reset-test");
  assert.equal(service.getFailureCount("reset-test"), 2);

  service.resetFailureCount("reset-test");
  assert.equal(service.getFailureCount("reset-test"), 0);
});

test("WebhookIngressService lists accepted envelopes", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "list-test",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({
    endpointId: "list-test",
    headers: {},
    body: JSON.stringify({ eventType: "event.1", eventId: "id-1" }),
  });

  service.receive({
    endpointId: "list-test",
    headers: {},
    body: JSON.stringify({ eventType: "event.2", eventId: "id-2" }),
  });

  const envelopes = service.listAcceptedEnvelopes();
  assert.equal(envelopes.length, 2);
});

test("WebhookIngressService rollbacks accepted envelope", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "rollback-test",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "rollback-test",
    headers: {},
    body: JSON.stringify({ eventType: "event.1", eventId: "id-1" }),
  });

  assert.equal(service.listAcceptedEnvelopes().length, 1);

  service.rollbackAcceptedEnvelope("rollback-test", "id-1", envelope.envelopeId);

  assert.equal(service.listAcceptedEnvelopes().length, 0);
});

test("WebhookIngressService requires signing secret for hmac algorithm", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.registerEndpoint({
      endpointId: "hmac-no-secret",
      source: "source",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "sha256_hmac",
    });
  });
});

test("WebhookIngressService accepts hmac algorithm with signing secret", () => {
  const service = new WebhookIngressService();
  const registration = service.registerEndpoint({
    endpointId: "hmac-with-secret",
    source: "source",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "my-secret-key",
  });
  assert.equal(registration.endpointId, "hmac-with-secret");
});

test("WebhookSignatureAlgorithm type is usable", () => {
  const algo: WebhookSignatureAlgorithm = "sha256_hmac";
  assert.equal(algo, "sha256_hmac");
});

test("InboundWebhookRequest type is usable", () => {
  const request: InboundWebhookRequest = {
    endpointId: "test",
    headers: { "content-type": "application/json" },
    body: '{"key":"value"}',
    receivedAt: "2026-04-20T00:00:00.000Z",
  };
  assert.equal(request.endpointId, "test");
});

test("WebhookDispatchEnvelope type is usable", () => {
  const envelope: WebhookDispatchEnvelope = {
    envelopeId: "env-1",
    endpointId: "ep-1",
    source: "source",
    tenantId: null,
    workspaceId: null,
    eventType: "event.1",
    idempotencyKey: "key-1",
    payload: { data: "test" },
    dispatchTargetRef: null,
    receivedAt: "2026-04-20T00:00:00.000Z",
    acceptedAt: "2026-04-20T00:00:00.000Z",
    signatureVerified: false,
    dispatchState: "accepted",
  };
  assert.equal(envelope.envelopeId, "env-1");
  assert.equal(envelope.dispatchState, "accepted");
});

test("WebhookDispatchState type is usable", () => {
  const state: WebhookDispatchState = "accepted";
  assert.equal(state, "accepted");
});