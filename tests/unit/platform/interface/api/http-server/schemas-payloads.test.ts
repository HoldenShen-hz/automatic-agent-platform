import assert from "node:assert/strict";
import test from "node:test";

import {
  parseGatewaySendPayload,
  parseBillingReconcilePayload,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/schemas.js";

test("parseGatewaySendPayload parses valid payload with all fields", () => {
  const payload = parseGatewaySendPayload({
    text: "Hello world",
    channel: "general",
    query: "search term",
    targetId: "target_123",
    metadata: { key: "value" },
  });
  assert.equal(payload.text, "Hello world");
  assert.equal(payload.channel, "general");
  assert.equal(payload.query, "search term");
  assert.equal(payload.targetId, "target_123");
  assert.deepEqual(payload.metadata, { key: "value" });
});

test("parseGatewaySendPayload parses minimal payload", () => {
  const payload = parseGatewaySendPayload({
    text: "Minimal message",
  });
  assert.equal(payload.text, "Minimal message");
  assert.equal(payload.channel, undefined);
  assert.equal(payload.query, undefined);
});

test("parseGatewaySendPayload rejects missing text", () => {
  try {
    parseGatewaySendPayload({ channel: "general" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_gateway_payload"));
    assert.equal(error.statusCode, 400);
  }
});

test("parseGatewaySendPayload rejects empty text", () => {
  try {
    parseGatewaySendPayload({ text: "   " });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_gateway_payload"));
  }
});

test("parseGatewaySendPayload rejects dangerous keys", () => {
  try {
    parseGatewaySendPayload({
      text: "test",
      __proto__: { admin: true },
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.includes("dangerous_key"));
  }
});

test("parseGatewaySendPayload rejects constructor in metadata", () => {
  try {
    parseGatewaySendPayload({
      text: "test",
      metadata: { constructor: { malicious: true } },
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.includes("dangerous_key"));
  }
});

test("parseGatewaySendPayload accepts metadata with nested objects", () => {
  const payload = parseGatewaySendPayload({
    text: "Hello",
    metadata: {
      nested: {
        deep: {
          value: 123,
        },
      },
    },
  });
  assert.equal(payload.metadata?.nested?.deep?.value, 123);
});

test("parseBillingReconcilePayload parses valid payload", () => {
  const payload = parseBillingReconcilePayload({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess_abc123",
    status: "paid",
    occurredAt: "2024-01-15T10:30:00Z",
    failureCode: "none",
  });
  assert.equal(payload.gatewayKind, "stripe");
  assert.equal(payload.gatewaySessionRef, "sess_abc123");
  assert.equal(payload.status, "paid");
  assert.equal(payload.occurredAt, "2024-01-15T10:30:00Z");
  assert.equal(payload.failureCode, "none");
});

test("parseBillingReconcilePayload parses minimal payload", () => {
  const payload = parseBillingReconcilePayload({
    gatewayKind: "manual",
    gatewaySessionRef: "ref123",
    status: "pending",
  });
  assert.equal(payload.gatewayKind, "manual");
  assert.equal(payload.status, "pending");
  assert.equal(payload.occurredAt, undefined);
});

test("parseBillingReconcilePayload rejects invalid gatewayKind", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "bitcoin",
      gatewaySessionRef: "ref",
      status: "paid",
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects invalid status", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "ref",
      status: "invalid_status",
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects invalid timestamp", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "ref",
      status: "paid",
      occurredAt: "not-a-timestamp",
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects missing required fields", () => {
  try {
    parseBillingReconcilePayload({ gatewayKind: "stripe" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects empty gatewaySessionRef", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "   ",
      status: "paid",
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload accepts all gateway kinds", () => {
  const kinds = ["manual", "stripe", "paddle"];
  for (const kind of kinds) {
    const payload = parseBillingReconcilePayload({
      gatewayKind: kind,
      gatewaySessionRef: "ref123",
      status: "pending",
    });
    assert.equal(payload.gatewayKind, kind);
  }
});

test("parseBillingReconcilePayload accepts all statuses", () => {
  const statuses = ["pending", "paid", "failed", "cancelled"];
  for (const status of statuses) {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "ref123",
      status,
    });
    assert.equal(payload.status, status);
  }
});