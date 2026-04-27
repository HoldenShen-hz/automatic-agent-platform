/**
 * Unit tests for Webhook signature verification
 * Tests src/platform/interface/webhook/index.ts - signature verification
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { createHmac } from "node:crypto";

function createHmacSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("WebhookIngressService receive with sha256_hmac verifies valid signature", () => {
  const service = new WebhookIngressService();
  const secret = "my-secret-key-123";
  service.registerEndpoint({
    endpointId: "ep-signed",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "task.completed", eventId: "evt-sig-1" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-signed",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

test("WebhookIngressService receive with sha256_hmac throws on missing signature", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-signed-missing",
    source: "https://source.example.com",
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
        endpointId: "ep-signed-missing",
        headers: {},
        body: JSON.stringify({ eventType: "task.completed", eventId: "evt-sig-2" }),
      }),
    /signature_required/,
  );
});

test("WebhookIngressService receive with sha256_hmac throws on invalid signature", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-signed-invalid",
    source: "https://source.example.com",
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
        endpointId: "ep-signed-invalid",
        headers: { "x-aa-signature": "sha256=wrongsignature" },
        body: JSON.stringify({ eventType: "task.completed", eventId: "evt-sig-3" }),
      }),
    /signature_invalid/,
  );
});

test("WebhookIngressService receive with sha256_hmac accepts signature without prefix", () => {
  const service = new WebhookIngressService();
  const secret = "another-secret";
  service.registerEndpoint({
    endpointId: "ep-no-prefix",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "alert", eventId: "evt-no-prefix" });
  const signature = createHmac(secret, body).digest("hex");

  const envelope = service.receive({
    endpointId: "ep-no-prefix",
    headers: { "x-aa-signature": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

test("WebhookIngressService receive with custom signature header", () => {
  const service = new WebhookIngressService();
  const secret = "custom-header-secret";
  service.registerEndpoint({
    endpointId: "ep-custom-header",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
    signatureHeader: "x-custom-sig",
  });

  const body = JSON.stringify({ eventType: "task.failed", eventId: "evt-custom" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-custom-header",
    headers: { "x-custom-sig": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

test("WebhookIngressService receive ignores signature header case insensitivity", () => {
  const service = new WebhookIngressService();
  const secret = "case-insensitive";
  service.registerEndpoint({
    endpointId: "ep-case-insensitive",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "sha256_hmac",
    signingSecret: secret,
  });

  const body = JSON.stringify({ eventType: "incident", eventId: "evt-case" });
  const signature = createHmacSignature(secret, body);

  const envelope = service.receive({
    endpointId: "ep-case-insensitive",
    headers: { "X-AA-SIGNATURE": signature },
    body,
  });

  assert.equal(envelope.signatureVerified, true);
});

test("WebhookIngressService receive with algorithm none does not verify signature", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-none-algo",
    source: "https://source.example.com",
    tenantId: null,
    workspaceId: null,
    enabled: true,
    allowedEventTypes: [],
    algorithm: "none",
  });

  const envelope = service.receive({
    endpointId: "ep-none-algo",
    headers: { "x-aa-signature": "any-signature" },
    body: JSON.stringify({ eventType: "task.completed", eventId: "evt-none" }),
  });

  assert.equal(envelope.signatureVerified, false);
});

test("WebhookIngressService receive with empty string signature throws", () => {
  const service = new WebhookIngressService();
  service.registerEndpoint({
    endpointId: "ep-empty-sig",
    source: "https://source.example.com",
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
        endpointId: "ep-empty-sig",
        headers: { "x-aa-signature": "" },
        body: JSON.stringify({ eventType: "task.completed", eventId: "evt-empty" }),
      }),
    /signature_invalid/,
  );
});
