import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAuthTokenPayload,
  parseGatewaySendPayload,
  parseApprovalDecisionPayload,
  parseBillingReconcilePayload,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/schemas.js";

test("parseGatewaySendPayload parses valid payload", () => {
  const payload = parseGatewaySendPayload({
    text: "Hello world",
    channel: "cli",
    query: "some query",
    targetId: "user_123",
    metadata: { key: "value" },
  });
  assert.equal(payload.text, "Hello world");
  assert.equal(payload.channel, "cli");
  assert.equal(payload.query, "some query");
  assert.equal(payload.targetId, "user_123");
  assert.deepEqual(payload.metadata, { key: "value" });
});

test("parseGatewaySendPayload allows minimal payload", () => {
  const payload = parseGatewaySendPayload({
    text: "Hello",
  });
  assert.equal(payload.text, "Hello");
  assert.equal(payload.channel, undefined);
});

test("parseGatewaySendPayload rejects missing text", () => {
  try {
    parseGatewaySendPayload({});
    assert.fail("Expected error to be thrown");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
});

test("parseGatewaySendPayload rejects non-object body", () => {
  try {
    parseGatewaySendPayload(null);
    assert.fail("Expected error for null");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
  try {
    parseGatewaySendPayload("string");
    assert.fail("Expected error for string");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
  try {
    parseGatewaySendPayload([]);
    assert.fail("Expected error for array");
  } catch (error: any) {
    assert.ok(
      error.code.startsWith("api.invalid_gateway_payload")
      || error.code === "api.dangerous_key",
    );
  }
});

test("parseGatewaySendPayload rejects extra fields", () => {
  try {
    parseGatewaySendPayload({ text: "Hi", extraField: "not allowed" });
    assert.fail("Expected error for extra fields");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
});

test("parseGatewaySendPayload rejects empty text", () => {
  try {
    parseGatewaySendPayload({ text: "" });
    assert.fail("Expected error for empty text");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
  try {
    parseGatewaySendPayload({ text: "   " });
    assert.fail("Expected error for whitespace text");
  } catch (error: any) {
    assert.ok(error.code.startsWith("api.invalid_gateway_payload"));
  }
});

test("parseAuthTokenPayload uses header API key when body is empty", () => {
  const result = parseAuthTokenPayload(null, "test-api-key-123");
  assert.equal(result.apiKey, "test-api-key-123");
});

test("parseAuthTokenPayload uses body apiKey when header is empty", () => {
  const result = parseAuthTokenPayload({ apiKey: "body-api-key" }, undefined);
  assert.equal(result.apiKey, "body-api-key");
});

test("parseAuthTokenPayload prefers header over body", () => {
  const result = parseAuthTokenPayload({ apiKey: "body-key" }, "header-key");
  assert.equal(result.apiKey, "header-key");
});

test("parseAuthTokenPayload rejects missing API key", () => {
  try {
    parseAuthTokenPayload(null, undefined);
    assert.fail("Expected error for null body");
  } catch (error: any) {
    assert.ok(error.code != null);
  }
  try {
    parseAuthTokenPayload({}, undefined);
    assert.fail("Expected error for empty body");
  } catch (error: any) {
    assert.ok(error.code != null);
  }
  try {
    parseAuthTokenPayload({ apiKey: "" }, undefined);
    assert.fail("Expected error for empty apiKey");
  } catch (error: any) {
    assert.ok(error.code != null);
  }
});

test("parseAuthTokenPayload trims whitespace from API key", () => {
  const result = parseAuthTokenPayload({ apiKey: "  trimmed-key  " }, undefined);
  assert.equal(result.apiKey, "trimmed-key");
});

test("parseApprovalDecisionPayload parses option_selected decision", () => {
  const decision = parseApprovalDecisionPayload(
    "approval_123",
    "user_456",
    {
      decisionType: "option_selected",
      selectedOptionId: "option_abc",
    },
  );
  assert.equal(decision.approvalId, "approval_123");
  assert.equal(decision.decisionType, "option_selected");
  assert.equal(decision.selectedOptionId, "option_abc");
  assert.equal(decision.respondedBy, "user_456");
});

test("parseApprovalDecisionPayload parses confirmed decision", () => {
  const decision = parseApprovalDecisionPayload(
    "approval_confirmed",
    "user_confirm",
    { decisionType: "confirmed" },
  );
  assert.equal(decision.decisionType, "confirmed");
  assert.equal(decision.confirmed, true);
});

test("parseApprovalDecisionPayload parses text_input decision", () => {
  const decision = parseApprovalDecisionPayload(
    "approval_text",
    "user_text",
    {
      decisionType: "text_input",
      inputText: "User response text",
    },
  );
  assert.equal(decision.decisionType, "text_input");
  assert.equal(decision.inputText, "User response text");
});

test("parseApprovalDecisionPayload parses rejected decision", () => {
  const decision = parseApprovalDecisionPayload(
    "approval_rejected",
    "user_reject",
    { decisionType: "rejected" },
  );
  assert.equal(decision.decisionType, "rejected");
});

test("parseApprovalDecisionPayload parses expired decision", () => {
  const decision = parseApprovalDecisionPayload(
    "approval_expired",
    "system",
    { decisionType: "expired" },
  );
  assert.equal(decision.decisionType, "expired");
});

test("parseApprovalDecisionPayload rejects option_selected without selectedOptionId", () => {
  try {
    parseApprovalDecisionPayload("approval_123", "user", { decisionType: "option_selected" });
    assert.fail("Expected error for missing selectedOptionId");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_decision_payload"));
  }
});

test("parseApprovalDecisionPayload rejects text_input without inputText", () => {
  try {
    parseApprovalDecisionPayload("approval_123", "user", { decisionType: "text_input" });
    assert.fail("Expected error for missing inputText");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_decision_payload"));
  }
});

test("parseApprovalDecisionPayload uses custom respondedAt when provided", () => {
  const customTime = "2026-04-14T12:00:00.000Z";
  const decision = parseApprovalDecisionPayload(
    "approval_123",
    "user",
    { decisionType: "confirmed", respondedAt: customTime },
  );
  assert.equal(decision.respondedAt, customTime);
});

test("parseApprovalDecisionPayload generates respondedAt when not provided", () => {
  const before = new Date().toISOString();
  const decision = parseApprovalDecisionPayload(
    "approval_123",
    "user",
    { decisionType: "confirmed" },
  );
  const after = new Date().toISOString();
  assert.ok(decision.respondedAt >= before);
  assert.ok(decision.respondedAt <= after);
});

test("parseBillingReconcilePayload parses valid payload", () => {
  const payload = parseBillingReconcilePayload({
    gatewayKind: "stripe",
    gatewaySessionRef: "cs_test_123",
    status: "paid",
  });
  assert.equal(payload.gatewayKind, "stripe");
  assert.equal(payload.gatewaySessionRef, "cs_test_123");
  assert.equal(payload.status, "paid");
});

test("parseBillingReconcilePayload parses all gateway kinds", () => {
  for (const kind of ["manual", "stripe", "paddle"] as const) {
    const payload = parseBillingReconcilePayload({
      gatewayKind: kind,
      gatewaySessionRef: "ref",
      status: "pending",
    });
    assert.equal(payload.gatewayKind, kind);
  }
});

test("parseBillingReconcilePayload parses all status values", () => {
  for (const status of ["pending", "paid", "failed", "cancelled"] as const) {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "ref",
      status,
    });
    assert.equal(payload.status, status);
  }
});

test("parseBillingReconcilePayload includes optional fields when provided", () => {
  const payload = parseBillingReconcilePayload({
    gatewayKind: "paddle",
    gatewaySessionRef: "paddle_123",
    status: "failed",
    occurredAt: "2026-04-14T10:00:00.000Z",
    failureCode: "card_declined",
  });
  assert.equal(payload.occurredAt, "2026-04-14T10:00:00.000Z");
  assert.equal(payload.failureCode, "card_declined");
});

test("parseBillingReconcilePayload rejects missing gatewaySessionRef", () => {
  try {
    parseBillingReconcilePayload({ gatewayKind: "stripe", status: "paid" });
    assert.fail("Expected error for missing gatewaySessionRef");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects invalid gatewayKind", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "unknown",
      gatewaySessionRef: "ref",
      status: "paid",
    });
    assert.fail("Expected error for invalid gatewayKind");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects invalid status", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "ref",
      status: "unknown",
    });
    assert.fail("Expected error for invalid status");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_billing_reconcile_payload"));
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
    assert.fail("Expected error for invalid timestamp");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_billing_reconcile_payload"));
  }
});

test("parseBillingReconcilePayload rejects empty gatewaySessionRef", () => {
  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "",
      status: "paid",
    });
    assert.fail("Expected error for empty gatewaySessionRef");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_billing_reconcile_payload"));
  }
});
