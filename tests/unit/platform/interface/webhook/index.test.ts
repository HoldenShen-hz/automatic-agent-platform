import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";

// =============================================================================
// registerEndpoint tests
// =============================================================================

test("registerEndpoint throws on empty endpointId", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.registerEndpoint({
      endpointId: "",
      source: "github",
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "none",
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.invalid_endpoint_id");
});

test("registerEndpoint throws on empty source", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.registerEndpoint({
      endpointId: "github",
      source: "   ",
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "none",
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.invalid_source");
});

test("registerEndpoint throws when sha256_hmac endpoint has no signing secret", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: "tenant-a",
      workspaceId: "workspace-a",
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "sha256_hmac",
      signingSecret: "",
    });
  }, (error: unknown) => error instanceof Error && error.message.includes("signing secret"));
});

test("registerEndpoint applies defaults correctly", () => {
  const service = new WebhookIngressService();
  const reg = service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["pull_request.opened"],
    algorithm: "none",
  });

  assert.equal(reg.tenantId, null);
  assert.equal(reg.workspaceId, null);
  assert.equal(reg.signatureHeader, "x-aa-signature");
  assert.equal(reg.idempotencyHeader, "idempotency-key");
  assert.equal(reg.dispatchTargetRef, null);
});

test("registerEndpoint deduplicates allowedEventTypes", () => {
  const service = new WebhookIngressService();
  const reg = service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["pull_request.opened", "pull_request.opened", "push"],
    algorithm: "none",
  });

  assert.equal(reg.allowedEventTypes.length, 2);
  assert.ok(reg.allowedEventTypes.includes("pull_request.opened"));
  assert.ok(reg.allowedEventTypes.includes("push"));
});

// =============================================================================
// receive - endpoint not found / disabled tests
// =============================================================================

test("receive throws when endpoint not registered", () => {
  const service = new WebhookIngressService();
  assert.throws(() => {
    service.receive({
      endpointId: "unknown",
      headers: {},
      body: JSON.stringify({ eventType: "test", eventId: "id-1" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.endpoint_not_found");
});

test("receive throws when endpoint is disabled", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: false,
    allowedEventTypes: ["pull_request.opened"],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: JSON.stringify({ eventType: "pull_request.opened" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.endpoint_disabled");
});

// =============================================================================
// receive - payload validation tests
// =============================================================================

test("receive throws when eventType is missing", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: JSON.stringify({ repository: "test" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.event_type_required");
});

test("receive throws when idempotency key is missing", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: {},
      body: JSON.stringify({ eventType: "push" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.idempotency_key_required");
});

test("receive accepts alternative eventType field names", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result1 = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body: JSON.stringify({ event_type: "push", eventId: "id-1" }),
  });
  assert.equal(result1.eventType, "push");

  const result2 = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-2" },
    body: JSON.stringify({ type: "push", eventId: "id-2" }),
  });
  assert.equal(result2.eventType, "push");
});

test("receive accepts alternative idempotency key field names", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result1 = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({ eventType: "push", event_id: "evt-1" }),
  });
  assert.equal(result1.idempotencyKey, "evt-1");

  const result2 = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "evt-2" }),
  });
  assert.equal(result2.idempotencyKey, "evt-2");
});

test("receive throws on invalid JSON body", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: "not json",
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.invalid_json");
});

test("receive throws on non-object JSON body", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: "null",
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.invalid_json");
});

// =============================================================================
// receive - signature verification tests
// =============================================================================

test("receive throws when signature is missing for signed endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "sha256_hmac",
    signingSecret: "top-secret",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: JSON.stringify({ eventType: "push", eventId: "id-1" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.signature_required");
});

test("receive throws when signature is invalid", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "sha256_hmac",
    signingSecret: "top-secret",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "x-aa-signature": "sha256=invalid" },
      body: JSON.stringify({ eventType: "push", eventId: "id-1" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.signature_invalid");
});

test("receive verifies signature correctly with sha256= prefix", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "sha256_hmac",
    signingSecret: "top-secret",
  });

  const body = JSON.stringify({ eventType: "push", eventId: "id-1" });
  const signature = createHmac("sha256", "top-secret").update(body).digest("hex");

  const result = service.receive({
    endpointId: "github",
    headers: { "x-aa-signature": `sha256=${signature}` },
    body,
  });

  assert.equal(result.signatureVerified, true);
});

test("receive verifies signature correctly without sha256= prefix", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "sha256_hmac",
    signingSecret: "top-secret",
  });

  const body = JSON.stringify({ eventType: "push", eventId: "id-1" });
  const signature = createHmac("sha256", "top-secret").update(body).digest("hex");

  const result = service.receive({
    endpointId: "github",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(result.signatureVerified, true);
});

test("receive uses custom signature header", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "sha256_hmac",
    signingSecret: "top-secret",
    signatureHeader: "x-github-signature",
  });

  const body = JSON.stringify({ eventType: "push", eventId: "id-1" });
  const signature = createHmac("sha256", "top-secret").update(body).digest("hex");

  const result = service.receive({
    endpointId: "github",
    headers: { "x-github-signature": `sha256=${signature}` },
    body,
  });

  assert.equal(result.signatureVerified, true);
});

test("receive uses custom idempotency header", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
    idempotencyHeader: "x-idempotency-key",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "x-idempotency-key": "my-key" },
    body: JSON.stringify({ eventType: "push" }),
  });

  assert.equal(result.idempotencyKey, "my-key");
});

test("receive does not verify signature for none algorithm", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body: JSON.stringify({ eventType: "push", eventId: "id-1" }),
  });

  assert.equal(result.signatureVerified, false);
});

// =============================================================================
// receive - envelope construction tests
// =============================================================================

test("receive constructs envelope with all fields", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
    dispatchTargetRef: "queue:webhook",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body: JSON.stringify({ eventType: "push", eventId: "id-1", data: "test" }),
  });

  assert.ok(result.envelopeId.startsWith("webhook_"));
  assert.equal(result.endpointId, "github");
  assert.equal(result.source, "github");
  assert.equal(result.tenantId, "tenant-a");
  assert.equal(result.workspaceId, "workspace-a");
  assert.equal(result.eventType, "push");
  assert.equal(result.idempotencyKey, "id-1");
  assert.deepStrictEqual(result.payload, { eventType: "push", eventId: "id-1", data: "test" });
  assert.equal(result.dispatchTargetRef, "queue:webhook");
  assert.equal(result.dispatchState, "accepted");
  assert.ok(result.receivedAt.length > 0);
  assert.ok(result.acceptedAt.length > 0);
});

test("receive uses header idempotency key over payload idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "from-header" },
    body: JSON.stringify({ eventType: "push", eventId: "from-payload" }),
  });

  assert.equal(result.idempotencyKey, "from-header");
});

test("receive deduplicates by scoped idempotency key", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const body = JSON.stringify({ eventType: "push", eventId: "id-1" });

  const first = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body,
  });

  const duplicate = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body,
  });

  assert.equal(first.dispatchState, "accepted");
  assert.equal(duplicate.dispatchState, "duplicate");
  assert.equal(service.listAcceptedEnvelopes().length, 1);
});

test("receive treats same idempotency key on different endpoints as unique", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "gitlab",
    source: "gitlab",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const body = JSON.stringify({ eventType: "push", eventId: "id-1" });

  const githubResult = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body,
  });

  const gitlabResult = service.receive({
    endpointId: "gitlab",
    headers: { "idempotency-key": "id-1" },
    body,
  });

  assert.equal(githubResult.dispatchState, "accepted");
  assert.equal(gitlabResult.dispatchState, "accepted");
  assert.equal(service.listAcceptedEnvelopes().length, 2);
  assert.notEqual(githubResult.envelopeId, gitlabResult.envelopeId);
});

// =============================================================================
// Endpoint management tests
// =============================================================================

test("getEndpoint returns registered endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const endpoint = service.getEndpoint("github");
  assert.ok(endpoint != null);
  assert.equal(endpoint!.endpointId, "github");
});

test("getEndpoint returns null for unknown endpoint", () => {
  const service = new WebhookIngressService();
  const endpoint = service.getEndpoint("unknown");
  assert.equal(endpoint, null);
});

test("deleteEndpoint removes endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  assert.ok(service.getEndpoint("github") != null);
  const deleted = service.deleteEndpoint("github");
  assert.equal(deleted, true);
  assert.equal(service.getEndpoint("github"), null);
});

test("deleteEndpoint returns false for unknown endpoint", () => {
  const service = new WebhookIngressService();
  const deleted = service.deleteEndpoint("unknown");
  assert.equal(deleted, false);
});

test("listEndpoints returns all registered endpoints", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });
  service.registerEndpoint({
    endpointId: "gitlab",
    source: "gitlab",
    tenantId: "tenant-b",
    workspaceId: "workspace-b",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const endpoints = service.listEndpoints();
  assert.equal(endpoints.length, 2);
  assert.ok(endpoints.some(e => e.endpointId === "github"));
  assert.ok(endpoints.some(e => e.endpointId === "gitlab"));
});

// =============================================================================
// Failure tracking tests
// =============================================================================

test("recordDeliveryFailure increments failure count", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  assert.equal(service.getFailureCount("github"), 0);
  service.recordDeliveryFailure("github");
  assert.equal(service.getFailureCount("github"), 1);
  service.recordDeliveryFailure("github");
  assert.equal(service.getFailureCount("github"), 2);
});

test("recordDeliveryFailure returns endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const endpoint = service.recordDeliveryFailure("github");
  assert.ok(endpoint != null);
  assert.equal(endpoint!.endpointId, "github");
});

test("recordDeliveryFailure returns null for unknown endpoint", () => {
  const service = new WebhookIngressService();
  const endpoint = service.recordDeliveryFailure("unknown");
  assert.equal(endpoint, null);
});

test("recordDeliveryFailure disables endpoint after 50 failures", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  for (let i = 0; i < 49; i++) {
    service.recordDeliveryFailure("github");
  }
  assert.equal(service.getEndpoint("github")!.enabled, true);

  service.recordDeliveryFailure("github");
  assert.equal(service.getEndpoint("github")!.enabled, false);
});

test("resetFailureCount clears failure count", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  service.recordDeliveryFailure("github");
  service.recordDeliveryFailure("github");
  assert.equal(service.getFailureCount("github"), 2);

  service.resetFailureCount("github");
  assert.equal(service.getFailureCount("github"), 0);
});

test("getFailureCount returns 0 for unknown endpoint", () => {
  const service = new WebhookIngressService();
  assert.equal(service.getFailureCount("unknown"), 0);
});

// =============================================================================
// Edge cases - header normalization
// =============================================================================

test("receive handles header names case-insensitively", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "IDEMPOTENCY-KEY": "my-key" },
    body: JSON.stringify({ eventType: "push" }),
  });

  assert.equal(result.idempotencyKey, "my-key");
});

test("receive handles array header values", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
    idempotencyHeader: "x-idempotency-key",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "x-idempotency-key": ["first", "second"] },
    body: JSON.stringify({ eventType: "push" }),
  });

  assert.equal(result.idempotencyKey, "first");
});

test("receive trims whitespace from header values", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "  my-key  " },
    body: JSON.stringify({ eventType: "push" }),
  });

  assert.equal(result.idempotencyKey, "my-key");
});

test("receive rejects empty string header values", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "   " },
      body: JSON.stringify({ eventType: "push" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.idempotency_key_required");
});

// =============================================================================
// Edge cases - payload field trimming
// =============================================================================

test("receive trims whitespace from payload string fields", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  const result = service.receive({
    endpointId: "github",
    headers: {},
    body: JSON.stringify({ eventType: "  push  ", eventId: "  id-1  " }),
  });

  assert.equal(result.eventType, "push");
  assert.equal(result.idempotencyKey, "id-1");
});

test("receive rejects empty string eventType from payload", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  assert.throws(() => {
    service.receive({
      endpointId: "github",
      headers: { "idempotency-key": "id-1" },
      body: JSON.stringify({ eventType: "   ", eventId: "id-1" }),
    });
  }, (error: unknown) => error instanceof Error && "code" in error && error.code === "webhook.event_type_required");
});

// =============================================================================
// listAcceptedEnvelopes tests
// =============================================================================

test("listAcceptedEnvelopes returns copy of array", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "github",
    source: "github",
    tenantId: "tenant-a",
    workspaceId: "workspace-a",
    enabled: true,
    allowedEventTypes: ["push"],
    algorithm: "none",
  });

  service.receive({
    endpointId: "github",
    headers: { "idempotency-key": "id-1" },
    body: JSON.stringify({ eventType: "push", eventId: "id-1" }),
  });

  const envelopes = service.listAcceptedEnvelopes();
  envelopes.push({} as any);
  assert.equal(service.listAcceptedEnvelopes().length, 1);
});

test("listAcceptedEnvelopes returns empty array initially", () => {
  const service = new WebhookIngressService();
  assert.deepStrictEqual(service.listAcceptedEnvelopes(), []);
});
