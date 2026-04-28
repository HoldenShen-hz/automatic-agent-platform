import assert from "node:assert/strict";
import test from "node:test";

import {
  parseGatewayWebhookPayload,
  parseArtifactBundlePreviewPayload,
  parseArtifactBundlePublishPayload,
  parseControlPlaneLoadBalancingSelectionPayload,
  parseCreateTaskPayload,
  parseUpdateTaskPayload,
  parseCreateWebhookEndpointPayload,
} from "../../../../../../src/platform/interface/api/http-server/schemas.js";

// parseGatewayWebhookPayload tests

test("parseGatewayWebhookPayload parses valid object payload", () => {
  const payload = parseGatewayWebhookPayload({
    eventType: "task.completed",
    taskId: "task_123",
  });
  assert.deepEqual(payload, {
    eventType: "task.completed",
    taskId: "task_123",
  });
});

test("parseGatewayWebhookPayload parses empty object", () => {
  const payload = parseGatewayWebhookPayload({});
  assert.deepEqual(payload, {});
});

test("parseGatewayWebhookPayload rejects non-object", () => {
  try {
    parseGatewayWebhookPayload(null);
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_gateway_webhook_payload"));
  }
  try {
    parseGatewayWebhookPayload("string");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_gateway_webhook_payload"));
  }
  try {
    parseGatewayWebhookPayload([]);
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(
      error.code?.startsWith("api.invalid_gateway_webhook_payload")
      || error.code === "api.dangerous_key",
    );
  }
});

// parseCreateTaskPayload tests

test("parseCreateTaskPayload parses minimal payload", () => {
  const payload = parseCreateTaskPayload({ title: "My Task" });
  assert.equal(payload.title, "My Task");
  assert.equal(payload.divisionId, undefined);
  assert.equal(payload.parentId, undefined);
});

test("parseCreateTaskPayload parses full payload", () => {
  const payload = parseCreateTaskPayload({
    title: "Full Task",
    divisionId: "div_123",
    parentId: "parent_456",
    inputJson: '{"key":"value"}',
    priority: "high",
    source: "user",
  });
  assert.equal(payload.title, "Full Task");
  assert.equal(payload.divisionId, "div_123");
  assert.equal(payload.parentId, "parent_456");
  assert.equal(payload.inputJson, '{"key":"value"}');
  assert.equal(payload.priority, "high");
  assert.equal(payload.source, "user");
});

test("parseCreateTaskPayload parses all priority values", () => {
  for (const priority of ["low", "normal", "high", "urgent"] as const) {
    const payload = parseCreateTaskPayload({ title: "Task", priority });
    assert.equal(payload.priority, priority);
  }
});

test("parseCreateTaskPayload parses all source values", () => {
  for (const source of ["user", "perception", "system"] as const) {
    const payload = parseCreateTaskPayload({ title: "Task", source });
    assert.equal(payload.source, source);
  }
});

test("parseCreateTaskPayload rejects missing title", () => {
  try {
    parseCreateTaskPayload({});
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
});

test("parseCreateTaskPayload rejects empty title", () => {
  try {
    parseCreateTaskPayload({ title: "" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
  try {
    parseCreateTaskPayload({ title: "   " });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
});

test("parseCreateTaskPayload rejects invalid priority", () => {
  try {
    parseCreateTaskPayload({ title: "Task", priority: "super_urgent" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
});

test("parseCreateTaskPayload rejects invalid source", () => {
  try {
    parseCreateTaskPayload({ title: "Task", source: "cli" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
});

test("parseCreateTaskPayload rejects extra fields", () => {
  try {
    parseCreateTaskPayload({ title: "Task", extra: "not allowed" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_create_task_payload"));
  }
});

// parseUpdateTaskPayload tests

test("parseUpdateTaskPayload parses minimal payload", () => {
  const payload = parseUpdateTaskPayload({});
  assert.equal(payload.title, undefined);
  assert.equal(payload.status, undefined);
});

test("parseUpdateTaskPayload parses title only", () => {
  const payload = parseUpdateTaskPayload({ title: "Updated Title" });
  assert.equal(payload.title, "Updated Title");
});

test("parseUpdateTaskPayload parses status only", () => {
  const payload = parseUpdateTaskPayload({ status: "done" });
  assert.equal(payload.status, "done");
});

test("parseUpdateTaskPayload parses all status values", () => {
  for (const status of ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"] as const) {
    const payload = parseUpdateTaskPayload({ status });
    assert.equal(payload.status, status);
  }
});

test("parseUpdateTaskPayload parses all priority values", () => {
  for (const priority of ["low", "normal", "high", "urgent"] as const) {
    const payload = parseUpdateTaskPayload({ priority });
    assert.equal(payload.priority, priority);
  }
});

test("parseUpdateTaskPayload parses outputJson", () => {
  const payload = parseUpdateTaskPayload({ outputJson: '{"result":"success"}' });
  assert.equal(payload.outputJson, '{"result":"success"}');
});

test("parseUpdateTaskPayload rejects invalid status", () => {
  try {
    parseUpdateTaskPayload({ status: "unknown_status" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_update_task_payload"));
  }
});

test("parseUpdateTaskPayload rejects extra fields", () => {
  try {
    parseUpdateTaskPayload({ unknownField: "value" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_update_task_payload"));
  }
});

// parseControlPlaneLoadBalancingSelectionPayload tests

test("parseControlPlaneLoadBalancingSelectionPayload parses empty payload", () => {
  const payload = parseControlPlaneLoadBalancingSelectionPayload({});
  assert.equal(payload.queueName, undefined);
  assert.equal(payload.preferredRegion, undefined);
  assert.equal(payload.tenantId, undefined);
  assert.equal(payload.requestKey, undefined);
});

test("parseControlPlaneLoadBalancingSelectionPayload parses all fields", () => {
  const payload = parseControlPlaneLoadBalancingSelectionPayload({
    queueName: "default-queue",
    preferredRegion: "us-east-1",
    tenantId: "tenant_abc",
    requestKey: "req_key_123",
  });
  assert.equal(payload.queueName, "default-queue");
  assert.equal(payload.preferredRegion, "us-east-1");
  assert.equal(payload.tenantId, "tenant_abc");
  assert.equal(payload.requestKey, "req_key_123");
});

test("parseControlPlaneLoadBalancingSelectionPayload rejects extra fields", () => {
  try {
    parseControlPlaneLoadBalancingSelectionPayload({ extra: "not allowed" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_control_plane_payload"));
  }
});

// parseCreateWebhookEndpointPayload tests

test("parseCreateWebhookEndpointPayload parses minimal payload", () => {
  const payload = parseCreateWebhookEndpointPayload({
    endpointId: "ep_123",
    source: "github",
  });
  assert.equal(payload.endpointId, "ep_123");
  assert.equal(payload.source, "github");
  assert.equal(payload.allowedEventTypes, undefined);
  assert.equal(payload.algorithm, undefined);
});

test("parseCreateWebhookEndpointPayload parses full payload", () => {
  const payload = parseCreateWebhookEndpointPayload({
    endpointId: "ep_full",
    source: "custom",
    allowedEventTypes: ["task.completed", "task.failed"],
    algorithm: "sha256_hmac",
    signingSecret: "secret_xyz",
    signatureHeader: "x-signature",
    idempotencyHeader: "x-idempotency",
    dispatchTargetRef: "target_ref",
    enabled: true,
  });
  assert.equal(payload.endpointId, "ep_full");
  assert.equal(payload.source, "custom");
  assert.deepEqual(payload.allowedEventTypes, ["task.completed", "task.failed"]);
  assert.equal(payload.algorithm, "sha256_hmac");
  assert.equal(payload.signingSecret, "secret_xyz");
  assert.equal(payload.signatureHeader, "x-signature");
  assert.equal(payload.idempotencyHeader, "x-idempotency");
  assert.equal(payload.dispatchTargetRef, "target_ref");
  assert.equal(payload.enabled, true);
});

test("parseCreateWebhookEndpointPayload parses all algorithm values", () => {
  for (const algorithm of ["none", "sha256_hmac"] as const) {
    const payload = parseCreateWebhookEndpointPayload({
      endpointId: "ep_test",
      source: "test",
      algorithm,
    });
    assert.equal(payload.algorithm, algorithm);
  }
});

test("parseCreateWebhookEndpointPayload rejects missing endpointId", () => {
  try {
    parseCreateWebhookEndpointPayload({ source: "github" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});

test("parseCreateWebhookEndpointPayload rejects missing source", () => {
  try {
    parseCreateWebhookEndpointPayload({ endpointId: "ep_123" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});

test("parseCreateWebhookEndpointPayload rejects empty endpointId", () => {
  try {
    parseCreateWebhookEndpointPayload({ endpointId: "", source: "github" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});

test("parseCreateWebhookEndpointPayload rejects empty source", () => {
  try {
    parseCreateWebhookEndpointPayload({ endpointId: "ep_123", source: "" });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});

test("parseCreateWebhookEndpointPayload rejects invalid algorithm", () => {
  try {
    parseCreateWebhookEndpointPayload({
      endpointId: "ep_123",
      source: "github",
      algorithm: "md5" as any,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});

test("parseCreateWebhookEndpointPayload rejects extra fields", () => {
  try {
    parseCreateWebhookEndpointPayload({
      endpointId: "ep_123",
      source: "github",
      extra: "not allowed",
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.startsWith("api.invalid_webhook_endpoint_payload"));
  }
});
