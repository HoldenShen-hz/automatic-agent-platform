import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApprovalDecisionPayload,
  parseAuthTokenPayload,
  parseBillingReconcilePayload,
  parseGatewaySendPayload,
} from "../../../../../src/platform/five-plane-interface/api/http-server/schemas.js";

test("auth token payload prefers header api key over body and validates with zod schema", () => {
  const payload = parseAuthTokenPayload({ apiKey: "body-key" }, "header-key");
  assert.equal(payload.apiKey, "header-key");
});

test("gateway send payload rejects unknown keys and malformed metadata", () => {
  try {
    parseGatewaySendPayload({
      text: "hello",
      unexpected: true,
    });
    assert.fail("expected unknown-key payload to fail");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "api.invalid_gateway_payload:payload");
  }

  try {
    parseGatewaySendPayload({
      text: "hello",
      metadata: ["bad"],
    });
    assert.fail("expected invalid metadata payload to fail");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "api.invalid_gateway_payload:metadata");
  }
});

test("approval decision payload enforces conditional fields", () => {
  try {
    parseApprovalDecisionPayload("approval-1", "actor-1", {
      decisionType: "option_selected",
    });
    assert.fail("expected conditional decision field validation to fail");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "api.invalid_decision_payload:selectedOptionId");
  }

  const decision = parseApprovalDecisionPayload("approval-1", "actor-1", {
    decisionType: "text_input",
    inputText: "please continue",
  });
  assert.equal(decision.inputText, "please continue");
  assert.equal(decision.respondedBy, "actor-1");
});

test("billing reconcile payload validates enums and timestamp shape", () => {
  const payload = parseBillingReconcilePayload({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess_123",
    status: "paid",
    occurredAt: "2026-04-12T00:00:00.000Z",
  });
  assert.equal(payload.gatewayKind, "stripe");
  assert.equal(payload.status, "paid");

  try {
    parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "sess_123",
      status: "paid",
      occurredAt: "not-iso",
    });
    assert.fail("expected malformed occurredAt to fail");
  } catch (error) {
    assert.equal((error as { code?: string }).code, "api.invalid_billing_reconcile_payload:occurredAt");
  }
});
