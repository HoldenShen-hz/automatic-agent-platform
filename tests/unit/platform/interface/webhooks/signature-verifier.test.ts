import assert from "node:assert/strict";
import test from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

// Helper to compute HMAC signature
async function computeHmacSignature(secret: string, body: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

test("registerEndpoint rejects empty endpointId", () => {
  const service = new WebhookIngressService();
  let error: Error | null = null;

  try {
    service.registerEndpoint({
      endpointId: "   ",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.invalid_endpoint_id");
});

test("registerEndpoint rejects empty source", () => {
  const service = new WebhookIngressService();
  let error: Error | null = null;

  try {
    service.registerEndpoint({
      endpointId: "ep-1",
      source: "  ",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.invalid_source");
});

test("registerEndpoint rejects sha256_hmac without signingSecret", () => {
  const service = new WebhookIngressService();
  let error: Error | null = null;

  try {
    service.registerEndpoint({
      endpointId: "ep-unsigned",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "sha256_hmac",
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.signing_secret_required");
});

test("registerEndpoint accepts sha256_hmac with valid signingSecret", () => {
  const service = new WebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep-valid",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "my-secret",
  });

  assert.equal(result.endpointId, "ep-valid");
  assert.equal(result.algorithm, "sha256_hmac");
});

test("registerEndpoint normalizes allowedEventTypes to unique set", () => {
  const service = new WebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep-dedup",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["push", "pull_request", "push", "pull_request"],
    algorithm: "none",
  });

  assert.equal(result.allowedEventTypes.length, 2);
  assert.ok(result.allowedEventTypes.includes("push"));
  assert.ok(result.allowedEventTypes.includes("pull_request"));
});

test("registerEndpoint normalizes header names to lowercase", () => {
  const service = new WebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep-headers",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
    signatureHeader: "X-Custom-Signature",
    idempotencyHeader: "X-Custom-Idempotency",
  });

  assert.equal(result.signatureHeader, "x-custom-signature");
  assert.equal(result.idempotencyHeader, "x-custom-idempotency");
});

test("registerEndpoint defaults signature header to x-aa-signature", () => {
  const service = new WebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep-default-sig",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(result.signatureHeader, "x-aa-signature");
});

test("registerEndpoint defaults idempotency header to idempotency-key", () => {
  const service = new WebhookIngressService();
  const result = service.registerEndpoint({
    endpointId: "ep-default-idem",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  assert.equal(result.idempotencyHeader, "idempotency-key");
});

test("receive accepts valid webhook with none algorithm", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-accept",
    source: "github",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-accept",
    headers: {},
    body: JSON.stringify({ eventType: "push", eventId: "evt-1" }),
  });

  assert.equal(envelope.dispatchState, "accepted");
  assert.equal(envelope.signatureVerified, false);
  assert.equal(envelope.eventType, "push");
  assert.equal(envelope.idempotencyKey, "evt-1");
});

test("receive returns duplicate dispatchState for replayed idempotent request", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-dup",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const first = service.receive({
    endpointId: "ep-dup",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "idem-key" }),
  });

  const second = service.receive({
    endpointId: "ep-dup",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "idem-key" }),
  });

  assert.equal(first.dispatchState, "accepted");
  assert.equal(second.dispatchState, "duplicate");
  assert.equal(second.envelopeId, first.envelopeId);
});

test("receive throws for unknown endpoint", () => {
  const service = new WebhookIngressService();
  let error: Error | null = null;

  try {
    service.receive({
      endpointId: "unknown",
      headers: {},
      body: JSON.stringify({ eventType: "push", id: "err" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.endpoint_not_found");
});

test("receive throws for disabled endpoint", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-disabled",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: false,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-disabled",
      headers: {},
      body: JSON.stringify({ eventType: "push", id: "disabled" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.endpoint_disabled");
});

test("receive throws when eventType is missing", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-no-type",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-no-type",
      headers: {},
      body: JSON.stringify({ id: "no-type" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.event_type_required");
});

test("receive throws when eventType is not in allowed list", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-filtered",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: ["push", "pull_request"],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-filtered",
      headers: {},
      body: JSON.stringify({ eventType: "delete", id: "forbidden" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.event_type_not_allowed");
});

test("receive throws when idempotency key is missing", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-no-idem",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-no-idem",
      headers: {},
      body: JSON.stringify({ eventType: "push" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.idempotency_key_required");
});

test("receive accepts valid sha256_hmac signature", async () => {
  const service = new WebhookIngressService();
  const secret = "test-secret-456";
  service.registerEndpoint({
    endpointId: "ep-hmac",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "push", eventId: "hmac-evt" });
  const signature = await computeHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-hmac",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
  assert.equal(envelope.dispatchState, "accepted");
});

test("receive throws when sha256_hmac signature is missing", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-no-sig",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "secret",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-no-sig",
      headers: {},
      body: JSON.stringify({ eventType: "push", id: "no-sig" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.signature_required");
});

test("receive throws when sha256_hmac signature is invalid", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-bad-sig",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: "correct-secret",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-bad-sig",
      headers: { "x-aa-signature": "wrong-signature" },
      body: JSON.stringify({ eventType: "push", id: "bad-sig" }),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.signature_invalid");
});

test("receive accepts signature with sha256= prefix", async () => {
  const service = new WebhookIngressService();
  const secret = "prefixed-secret";
  service.registerEndpoint({
    endpointId: "ep-prefixed",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "push", id: "prefixed-sig" });
  const signature = await computeHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-prefixed",
    headers: { "x-aa-signature": `sha256=${signature}` },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

test("receive throws when body is not valid JSON", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-bad-json",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-bad-json",
      headers: {},
      body: "not-json{",
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.invalid_json");
});

test("receive throws when body is JSON array", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-json-array",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-json-array",
      headers: {},
      body: JSON.stringify([{ eventType: "push" }, { eventType: "pull" }]),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.invalid_json");
});

test("receive throws when body is JSON primitive", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-json-prim",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  let error: Error | null = null;
  try {
    service.receive({
      endpointId: "ep-json-prim",
      headers: {},
      body: JSON.stringify("just a string"),
    });
  } catch (e) {
    error = e as Error;
  }

  assert.ok(error instanceof ValidationError);
  assert.equal((error as ValidationError).code, "webhook.invalid_json");
});

test("rollbackAcceptedEnvelope removes envelope from tracking", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-rollback",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-rollback",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "rollback-test" }),
  });

  assert.equal(service.listAcceptedEnvelopes().length, 1);

  service.rollbackAcceptedEnvelope("ep-rollback", "rollback-test", envelope.envelopeId);

  assert.equal(service.listAcceptedEnvelopes().length, 0);
});

test("rollbackAcceptedEnvelope does nothing for wrong envelopeId", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-wrong",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  service.receive({
    endpointId: "ep-wrong",
    headers: {},
    body: JSON.stringify({ eventType: "push", id: "wrong-id" }),
  });

  // Try to rollback with wrong idempotency key
  service.rollbackAcceptedEnvelope("ep-wrong", "wrong-id", "fake-envelope-id");

  // Should still have the envelope
  assert.equal(service.listAcceptedEnvelopes().length, 1);
});

test("recordDeliveryFailure increments failure count and disables after 50", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-fail",
    source: "github",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  // Record 49 failures - should still be enabled
  for (let i = 0; i < 49; i++) {
    const result = service.recordDeliveryFailure("ep-fail");
    assert.equal(result?.enabled, true);
  }

  // 50th failure - endpoint is disabled but result still returns the endpoint object
  const finalResult = service.recordDeliveryFailure("ep-fail");
  assert.equal(finalResult?.enabled, false); // Returns endpoint with enabled=false
  assert.equal(service.getEndpoint("ep-fail")?.enabled, false);
});

test("resetFailureCount clears failure tracking", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-reset",
    source: "github",
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
