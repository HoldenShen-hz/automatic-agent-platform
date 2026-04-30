/**
 * Integration tests for API route schemas
 *
 * Tests request payload validation for all parsed schemas:
 * - parseGatewaySendPayload
 * - parseGatewayWebhookPayload
 * - parseApprovalDecisionPayload
 * - parseBillingReconcilePayload
 * - parseArtifactBundlePreviewPayload
 * - parseArtifactBundlePublishPayload
 * - parseControlPlaneLoadBalancingSelectionPayload
 * - parseCreateTaskPayload
 * - parseUpdateTaskPayload
 * - parseCreateWebhookEndpointPayload
 * - parseAuthTokenPayload
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseGatewaySendPayload,
  parseGatewayWebhookPayload,
  parseApprovalDecisionPayload,
  parseBillingReconcilePayload,
  parseArtifactBundlePreviewPayload,
  parseCreateTaskPayload,
  parseUpdateTaskPayload,
  parseCreateWebhookEndpointPayload,
  parseAuthTokenPayload,
} from "../../../../../src/platform/interface/api/http-server/schemas.ts";

describe("API Route Schemas", () => {
  // ══════════════════════════════════════════════════════════════════════════
  // Gateway Send Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseGatewaySendPayload accepts valid payload with required text field", () => {
    const payload = parseGatewaySendPayload({ text: "Hello, world!" });
    assert.equal(payload.text, "Hello, world!");
    assert.equal(payload.channel, undefined);
    assert.equal(payload.query, undefined);
    assert.equal(payload.targetId, undefined);
  });

  test("parseGatewaySendPayload accepts valid payload with all optional fields", () => {
    const payload = parseGatewaySendPayload({
      text: "Hello",
      channel: "telegram",
      query: "search query",
      targetId: "user123",
      metadata: { key: "value" },
    });
    assert.equal(payload.text, "Hello");
    assert.equal(payload.channel, "telegram");
    assert.equal(payload.query, "search query");
    assert.equal(payload.targetId, "user123");
    assert.deepEqual(payload.metadata, { key: "value" });
  });

  test("parseGatewaySendPayload rejects empty text field", () => {
    assert.throws(
      () => parseGatewaySendPayload({ text: "" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_gateway_payload:text" && error.message === "String must contain at least 1 character";
      }
    );
  });

  test("parseGatewaySendPayload rejects missing text field", () => {
    assert.throws(
      () => parseGatewaySendPayload({ channel: "telegram" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_gateway_payload") && error.message.includes("text");
      }
    );
  });

  test("parseGatewaySendPayload rejects payload with extra unknown fields (strict)", () => {
    assert.throws(
      () => parseGatewaySendPayload({ text: "Hello", unknownField: "value" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_gateway_payload") && error.message.includes("Unknown key");
      }
    );
  });

  test("parseGatewaySendPayload rejects payload with dangerous keys", () => {
    assert.throws(
      () => parseGatewaySendPayload({ text: "Hello", __proto__: "polluted" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.dangerous_key" && error.message.includes("Reserved key: __proto__");
      }
    );
  });

  test("parseGatewaySendPayload rejects payload with constructor key", () => {
    assert.throws(
      () => parseGatewaySendPayload({ text: "Hello", constructor: {} }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.dangerous_key" && error.message.includes("Reserved key: constructor");
      }
    );
  });

  test("parseGatewaySendPayload rejects nested dangerous keys", () => {
    assert.throws(
      () => parseGatewaySendPayload({ text: "Hello", metadata: { __proto__: "polluted" } }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.dangerous_key";
      }
    );
  });

  test("parseGatewaySendPayload accepts valid metadata object", () => {
    const payload = parseGatewaySendPayload({
      text: "Hello",
      metadata: {
        userId: "user123",
        count: 42,
        active: true,
        nested: { a: 1, b: 2 },
      },
    });
    assert.deepEqual(payload.metadata, {
      userId: "user123",
      count: 42,
      active: true,
      nested: { a: 1, b: 2 },
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Gateway Webhook Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseGatewayWebhookPayload accepts valid empty object", () => {
    const payload = parseGatewayWebhookPayload({});
    assert.deepEqual(payload, {});
  });

  test("parseGatewayWebhookPayload accepts valid webhook data", () => {
    const webhookData = {
      event: "message",
      chat: { id: 123, type: "private" },
      text: "Hello bot",
    };
    const payload = parseGatewayWebhookPayload(webhookData);
    assert.deepEqual(payload, webhookData);
  });

  test("parseGatewayWebhookPayload rejects dangerous keys at top level", () => {
    assert.throws(
      () => parseGatewayWebhookPayload({ __proto__: "polluted" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.dangerous_key";
      }
    );
  });

  test("parseGatewayWebhookPayload rejects dangerous keys in nested objects", () => {
    assert.throws(
      () => parseGatewayWebhookPayload({
        event: "update",
        data: { prototype: "polluted" },
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.dangerous_key";
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Approval Decision Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseApprovalDecisionPayload accepts option_selected with selectedOptionId", () => {
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "option_selected", selectedOptionId: "option-1" }
    );
    assert.equal(decision.approvalId, "approval-123");
    assert.equal(decision.respondedBy, "actor-456");
    assert.equal(decision.decisionType, "option_selected");
    assert.equal(decision.selectedOptionId, "option-1");
  });

  test("parseApprovalDecisionPayload accepts confirmed without options", () => {
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "confirmed" }
    );
    assert.equal(decision.decisionType, "confirmed");
    assert.equal((decision as { confirmed?: boolean }).confirmed, true);
  });

  test("parseApprovalDecisionPayload accepts text_input with inputText", () => {
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "text_input", inputText: "My response text" }
    );
    assert.equal(decision.decisionType, "text_input");
    assert.equal((decision as { inputText?: string }).inputText, "My response text");
  });

  test("parseApprovalDecisionPayload accepts rejected decision", () => {
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "rejected" }
    );
    assert.equal(decision.decisionType, "rejected");
  });

  test("parseApprovalDecisionPayload accepts expired decision", () => {
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "expired" }
    );
    assert.equal(decision.decisionType, "expired");
  });

  test("parseApprovalDecisionPayload accepts optional respondedAt timestamp", () => {
    const timestamp = "2026-05-01T12:00:00.000Z";
    const decision = parseApprovalDecisionPayload(
      "approval-123",
      "actor-456",
      { decisionType: "confirmed", respondedAt: timestamp }
    );
    assert.equal(decision.respondedAt, timestamp);
  });

  test("parseApprovalDecisionPayload rejects option_selected without selectedOptionId", () => {
    assert.throws(
      () => parseApprovalDecisionPayload(
        "approval-123",
        "actor-456",
        { decisionType: "option_selected" }
      ),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_decision_payload:selectedOptionId" &&
               error.message.includes("selectedOptionId is required when decisionType=option_selected");
      }
    );
  });

  test("parseApprovalDecisionPayload rejects text_input without inputText", () => {
    assert.throws(
      () => parseApprovalDecisionPayload(
        "approval-123",
        "actor-456",
        { decisionType: "text_input" }
      ),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_decision_payload:inputText" &&
               error.message.includes("inputText is required when decisionType=text_input");
      }
    );
  });

  test("parseApprovalDecisionPayload rejects unknown decisionType", () => {
    assert.throws(
      () => parseApprovalDecisionPayload(
        "approval-123",
        "actor-456",
        { decisionType: "unknown_type" }
      ),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_decision_payload");
      }
    );
  });

  test("parseApprovalDecisionPayload rejects payload with extra unknown fields", () => {
    assert.throws(
      () => parseApprovalDecisionPayload(
        "approval-123",
        "actor-456",
        { decisionType: "confirmed", unknownField: "value" }
      ),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_decision_payload") && error.message.includes("Unknown key");
      }
    );
  });

  test("parseApprovalDecisionPayload rejects invalid respondedAt timestamp", () => {
    assert.throws(
      () => parseApprovalDecisionPayload(
        "approval-123",
        "actor-456",
        { decisionType: "confirmed", respondedAt: "not-a-valid-timestamp" }
      ),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_decision_payload:respondedAt");
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Billing Reconcile Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseBillingReconcilePayload accepts valid manual gateway payload", () => {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "manual",
      gatewaySessionRef: "session-123",
      status: "paid",
    });
    assert.equal(payload.gatewayKind, "manual");
    assert.equal(payload.gatewaySessionRef, "session-123");
    assert.equal(payload.status, "paid");
    assert.equal(payload.occurredAt, undefined);
    assert.equal(payload.failureCode, undefined);
  });

  test("parseBillingReconcilePayload accepts valid stripe gateway payload", () => {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "stripe",
      gatewaySessionRef: "cs_test_123",
      status: "pending",
      occurredAt: "2026-05-01T12:00:00.000Z",
    });
    assert.equal(payload.gatewayKind, "stripe");
    assert.equal(payload.status, "pending");
    assert.equal(payload.occurredAt, "2026-05-01T12:00:00.000Z");
  });

  test("parseBillingReconcilePayload accepts valid paddle gateway with failure", () => {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "paddle",
      gatewaySessionRef: "paddle_123",
      status: "failed",
      failureCode: "card_declined",
    });
    assert.equal(payload.gatewayKind, "paddle");
    assert.equal(payload.status, "failed");
    assert.equal(payload.failureCode, "card_declined");
  });

  test("parseBillingReconcilePayload accepts cancelled status", () => {
    const payload = parseBillingReconcilePayload({
      gatewayKind: "manual",
      gatewaySessionRef: "session-456",
      status: "cancelled",
    });
    assert.equal(payload.status, "cancelled");
  });

  test("parseBillingReconcilePayload rejects invalid gatewayKind", () => {
    assert.throws(
      () => parseBillingReconcilePayload({
        gatewayKind: "unknown",
        gatewaySessionRef: "session-123",
        status: "paid",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_billing_reconcile_payload");
      }
    );
  });

  test("parseBillingReconcilePayload rejects invalid status", () => {
    assert.throws(
      () => parseBillingReconcilePayload({
        gatewayKind: "stripe",
        gatewaySessionRef: "session-123",
        status: "unknown_status",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_billing_reconcile_payload");
      }
    );
  });

  test("parseBillingReconcilePayload rejects empty gatewaySessionRef", () => {
    assert.throws(
      () => parseBillingReconcilePayload({
        gatewayKind: "stripe",
        gatewaySessionRef: "",
        status: "paid",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_billing_reconcile_payload");
      }
    );
  });

  test("parseBillingReconcilePayload rejects payload with extra unknown fields", () => {
    assert.throws(
      () => parseBillingReconcilePayload({
        gatewayKind: "stripe",
        gatewaySessionRef: "session-123",
        status: "paid",
        unknownField: "value",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_billing_reconcile_payload") && error.message.includes("Unknown key");
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Task Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseCreateTaskPayload accepts minimal valid payload", () => {
    const payload = parseCreateTaskPayload({ title: "My Task" });
    assert.equal(payload.title, "My Task");
    assert.equal(payload.divisionId, undefined);
    assert.equal(payload.parentId, undefined);
    assert.equal(payload.inputJson, undefined);
    assert.equal(payload.priority, undefined);
    assert.equal(payload.source, undefined);
  });

  test("parseCreateTaskPayload accepts full valid payload", () => {
    const payload = parseCreateTaskPayload({
      title: "Full Task",
      divisionId: "division-123",
      parentId: "parent-task-456",
      inputJson: '{"key": "value"}',
      priority: "high",
      source: "system",
    });
    assert.equal(payload.title, "Full Task");
    assert.equal(payload.divisionId, "division-123");
    assert.equal(payload.parentId, "parent-task-456");
    assert.equal(payload.inputJson, '{"key": "value"}');
    assert.equal(payload.priority, "high");
    assert.equal(payload.source, "system");
  });

  test("parseCreateTaskPayload accepts all priority values", () => {
    const priorities = ["low", "normal", "high", "urgent"] as const;
    for (const priority of priorities) {
      const payload = parseCreateTaskPayload({ title: "Task", priority });
      assert.equal(payload.priority, priority);
    }
  });

  test("parseCreateTaskPayload accepts all source values", () => {
    const sources = ["user", "perception", "system"] as const;
    for (const source of sources) {
      const payload = parseCreateTaskPayload({ title: "Task", source });
      assert.equal(payload.source, source);
    }
  });

  test("parseCreateTaskPayload rejects empty title", () => {
    assert.throws(
      () => parseCreateTaskPayload({ title: "" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_create_task_payload");
      }
    );
  });

  test("parseCreateTaskPayload rejects whitespace-only title", () => {
    assert.throws(
      () => parseCreateTaskPayload({ title: "   " }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_create_task_payload");
      }
    );
  });

  test("parseCreateTaskPayload rejects invalid priority value", () => {
    assert.throws(
      () => parseCreateTaskPayload({ title: "Task", priority: "invalid" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_create_task_payload");
      }
    );
  });

  test("parseCreateTaskPayload rejects invalid source value", () => {
    assert.throws(
      () => parseCreateTaskPayload({ title: "Task", source: "invalid" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_create_task_payload");
      }
    );
  });

  test("parseCreateTaskPayload rejects payload with extra unknown fields", () => {
    assert.throws(
      () => parseCreateTaskPayload({ title: "Task", unknownField: "value" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_create_task_payload") && error.message.includes("Unknown key");
      }
    );
  });

  test("parseUpdateTaskPayload accepts minimal payload with only title", () => {
    const payload = parseUpdateTaskPayload({ title: "Updated Title" });
    assert.equal(payload.title, "Updated Title");
    assert.equal(payload.status, undefined);
    assert.equal(payload.priority, undefined);
  });

  test("parseUpdateTaskPayload accepts full valid payload", () => {
    const payload = parseUpdateTaskPayload({
      title: "Updated Task",
      status: "running",
      priority: "urgent",
      outputJson: '{"result": "done"}',
    });
    assert.equal(payload.title, "Updated Task");
    assert.equal(payload.status, "running");
    assert.equal(payload.priority, "urgent");
    assert.equal(payload.outputJson, '{"result": "done"}');
  });

  test("parseUpdateTaskPayload accepts all valid status values", () => {
    const statuses = [
      "created", "admitted", "planning", "ready", "running",
      "pausing", "paused", "resuming", "replanning", "compensating",
      "completed", "failed", "aborted"
    ] as const;
    for (const status of statuses) {
      const payload = parseUpdateTaskPayload({ status });
      assert.equal(payload.status, status);
    }
  });

  test("parseUpdateTaskPayload accepts all priority values", () => {
    const priorities = ["low", "normal", "high", "urgent"] as const;
    for (const priority of priorities) {
      const payload = parseUpdateTaskPayload({ priority });
      assert.equal(payload.priority, priority);
    }
  });

  test("parseUpdateTaskPayload rejects invalid status value", () => {
    assert.throws(
      () => parseUpdateTaskPayload({ status: "invalid_status" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_update_task_payload");
      }
    );
  });

  test("parseUpdateTaskPayload rejects invalid priority value", () => {
    assert.throws(
      () => parseUpdateTaskPayload({ priority: "invalid" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_update_task_payload");
      }
    );
  });

  test("parseUpdateTaskPayload rejects payload with extra unknown fields", () => {
    assert.throws(
      () => parseUpdateTaskPayload({ title: "Task", unknownField: "value" }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_update_task_payload") && error.message.includes("Unknown key");
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Webhook Endpoint Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseCreateWebhookEndpointPayload accepts minimal payload", () => {
    const payload = parseCreateWebhookEndpointPayload({
      endpointId: "endpoint-123",
      source: "github",
    });
    assert.equal(payload.endpointId, "endpoint-123");
    assert.equal(payload.source, "github");
    assert.equal(payload.allowedEventTypes, undefined);
    assert.equal(payload.algorithm, undefined);
  });

  test("parseCreateWebhookEndpointPayload accepts full payload with all options", () => {
    const payload = parseCreateWebhookEndpointPayload({
      endpointId: "endpoint-456",
      source: "custom",
      allowedEventTypes: ["push", "pull_request", "issue"],
      algorithm: "sha256_hmac",
      signingSecret: "secret-key-123",
      signatureHeader: "x-hub-signature-256",
      idempotencyHeader: "x-idempotency-key",
      dispatchTargetRef: "target:ref",
      enabled: true,
    });
    assert.equal(payload.endpointId, "endpoint-456");
    assert.deepEqual(payload.allowedEventTypes, ["push", "pull_request", "issue"]);
    assert.equal(payload.algorithm, "sha256_hmac");
    assert.equal(payload.signingSecret, "secret-key-123");
    assert.equal(payload.signatureHeader, "x-hub-signature-256");
    assert.equal(payload.idempotencyHeader, "x-idempotency-key");
    assert.equal(payload.dispatchTargetRef, "target:ref");
    assert.equal(payload.enabled, true);
  });

  test("parseCreateWebhookEndpointPayload accepts algorithm none", () => {
    const payload = parseCreateWebhookEndpointPayload({
      endpointId: "endpoint-789",
      source: "webhook",
      algorithm: "none",
    });
    assert.equal(payload.algorithm, "none");
  });

  test("parseCreateWebhookEndpointPayload rejects empty endpointId", () => {
    assert.throws(
      () => parseCreateWebhookEndpointPayload({
        endpointId: "",
        source: "github",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_webhook_endpoint_payload");
      }
    );
  });

  test("parseCreateWebhookEndpointPayload rejects empty source", () => {
    assert.throws(
      () => parseCreateWebhookEndpointPayload({
        endpointId: "endpoint-123",
        source: "",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_webhook_endpoint_payload");
      }
    );
  });

  test("parseCreateWebhookEndpointPayload rejects invalid algorithm value", () => {
    assert.throws(
      () => parseCreateWebhookEndpointPayload({
        endpointId: "endpoint-123",
        source: "github",
        algorithm: "md5",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_webhook_endpoint_payload");
      }
    );
  });

  test("parseCreateWebhookEndpointPayload rejects payload with extra unknown fields", () => {
    assert.throws(
      () => parseCreateWebhookEndpointPayload({
        endpointId: "endpoint-123",
        source: "github",
        unknownField: "value",
      }),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code.includes("api.invalid_webhook_endpoint_payload") && error.message.includes("Unknown key");
      }
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Auth Token Payload Tests
  // ══════════════════════════════════════════════════════════════════════════

  test("parseAuthTokenPayload accepts valid apiKey in body", () => {
    const payload = parseAuthTokenPayload({ apiKey: "test-key-123" }, undefined);
    assert.equal(payload.apiKey, "test-key-123");
  });

  test("parseAuthTokenPayload accepts valid apiKey in header", () => {
    const payload = parseAuthTokenPayload({}, "header-api-key-456");
    assert.equal(payload.apiKey, "header-api-key-456");
  });

  test("parseAuthTokenPayload prefers header apiKey over body apiKey", () => {
    const payload = parseAuthTokenPayload({ apiKey: "body-key" }, "header-key");
    assert.equal(payload.apiKey, "header-key");
  });

  test("parseAuthTokenPayload prefers non-empty body apiKey when header is empty", () => {
    const payload = parseAuthTokenPayload({ apiKey: "body-key" }, "");
    assert.equal(payload.apiKey, "body-key");
  });

  test("parseAuthTokenPayload rejects when both body and header are empty", () => {
    assert.throws(
      () => parseAuthTokenPayload({}, undefined),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_api_key" && error.message === "API key is required.";
      }
    );
  });

  test("parseAuthTokenPayload rejects empty string apiKey", () => {
    assert.throws(
      () => parseAuthTokenPayload({ apiKey: "" }, undefined),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_api_key";
      }
    );
  });

  test("parseAuthTokenPayload rejects whitespace-only apiKey", () => {
    assert.throws(
      () => parseAuthTokenPayload({ apiKey: "   " }, undefined),
      (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "api.invalid_api_key";
      }
    );
  });

  test("parseAuthTokenPayload trims whitespace from apiKey", () => {
    const payload = parseAuthTokenPayload({ apiKey: "  trimmed-key  " }, undefined);
    assert.equal(payload.apiKey, "trimmed-key");
  });

  test("parseAuthTokenPayload accepts null body", () => {
    const payload = parseAuthTokenPayload(null, "header-key");
    assert.equal(payload.apiKey, "header-key");
  });

  test("parseAuthTokenPayload accepts undefined body", () => {
    const payload = parseAuthTokenPayload(undefined, "header-key");
    assert.equal(payload.apiKey, "header-key");
  });
});