/**
 * Extended tests for HTTP Server Schema parsing functions
 * Tests src/platform/interface/api/http-server/schemas.ts - untested parse functions
 */

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
} from "../../../../../src/platform/interface/api/http-server/schemas.js";

test("parseGatewayWebhookPayload parses valid record payload", () => {
  const result = parseGatewayWebhookPayload({
    event: "push",
    repository: "test-repo",
    metadata: { ref: "main" },
  });
  assert.deepEqual(result, {
    event: "push",
    repository: "test-repo",
    metadata: { ref: "main" },
  });
});

test("parseGatewayWebhookPayload parses empty object", () => {
  const result = parseGatewayWebhookPayload({});
  assert.deepEqual(result, {});
});

test("parseGatewayWebhookPayload rejects dangerous keys", () => {
  // Note: JavaScript's Object.keys() doesn't enumerate "__proto__" when set via object literal
  // because it's the prototype, not an own property. This is a known JavaScript behavior.
  // The "constructor" key test below works because it's not a special property.
  // We skip the __proto__ test here since the schema's checkDangerousKeys uses Object.keys()
  // which doesn't include __proto__ as an own property when set via object literal.
  // However, Object.create(null) with explicit property DOES create an own property.
  const obj = Object.create(null);
  obj["constructor"] = "dangerous";
  assert.throws(
    () => parseGatewayWebhookPayload(obj),
    (err: unknown) => (err as { code?: string }).code === "api.dangerous_key"
  );
});

test("parseGatewayWebhookPayload rejects nested dangerous keys", () => {
  assert.throws(
    () => parseGatewayWebhookPayload({ nested: { "constructor": "dangerous" } }),
    (err: unknown) => (err as { code?: string }).code === "api.dangerous_key"
  );
});

test("parseArtifactBundlePreviewPayload parses valid payload", () => {
  const result = parseArtifactBundlePreviewPayload({
    taskId: "task_123",
    domainId: "domain_abc",
    bundleType: "release_bundle",
    artifacts: [
      {
        artifactId: "art_1",
        harnessRunId: "hr_1",
        taskId: "task_123",
        type: "source_code",
        path: "/path/to/artifact",
        mimeType: "text/plain",
        sizeBytes: 1024,
        checksum: "abc123def456",
        version: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        publishStatus: "draft",
        metadata: {},
      },
    ],
  });
  assert.equal(result.taskId, "task_123");
  assert.equal(result.domainId, "domain_abc");
  assert.equal(result.bundleType, "release_bundle");
  assert.equal(result.artifacts.length, 1);
});

test("parseArtifactBundlePreviewPayload accepts all bundle types", () => {
  const bundleTypes = ["release_bundle", "asset_bundle", "campaign_bundle", "incident_bundle"] as const;
  for (const bundleType of bundleTypes) {
    const result = parseArtifactBundlePreviewPayload({
      taskId: "task_123",
      domainId: "domain_abc",
      bundleType,
      artifacts: [],
    });
    assert.equal(result.bundleType, bundleType);
  }
});

test("parseArtifactBundlePreviewPayload throws for missing required fields", () => {
  assert.throws(
    () => parseArtifactBundlePreviewPayload({ bundleType: "release_bundle", artifacts: [] }),
    (err: unknown) => (err as { code?: string }).code?.includes("api.invalid_artifact_bundle_preview_payload")
  );
});

test("parseArtifactBundlePreviewPayload throws for invalid bundleType", () => {
  assert.throws(
    () => parseArtifactBundlePreviewPayload({
      taskId: "task_123",
      domainId: "domain_abc",
      bundleType: "invalid_type",
      artifacts: [],
    }),
    (err: unknown) => (err as { code?: string }).code?.includes("bundleType")
  );
});

test("parseArtifactBundlePublishPayload parses valid payload", () => {
  const result = parseArtifactBundlePublishPayload({
    bundle: {
      bundleId: "bundle_123",
      taskId: "task_123",
      bundleType: "release_bundle",
      domainId: "domain_abc",
      publishStatus: "draft",
      publishedAt: null,
      artifacts: [],
      links: [],
      finalDeliverables: [],
      totalSize: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  });
  assert.equal(result.bundle.bundleId, "bundle_123");
  assert.equal(result.bundle.bundleType, "release_bundle");
  assert.equal(result.bundle.taskId, "task_123");
  assert.equal(result.bundle.publishStatus, "draft");
  assert.equal(result.bundle.publishedAt, null);
});

test("parseArtifactBundlePublishPayload throws for invalid payload", () => {
  assert.throws(
    () => parseArtifactBundlePublishPayload({ bundle: "not_an_object" }),
    (err: unknown) => (err as { code?: string }).code?.includes("api.invalid_artifact_bundle_publish_payload")
  );
});

test("parseControlPlaneLoadBalancingSelectionPayload parses all fields", () => {
  const result = parseControlPlaneLoadBalancingSelectionPayload({
    queueName: "default-queue",
    preferredRegion: "us-west-2",
    tenantId: "tenant_abc",
    requestKey: "req_key_123",
  });
  assert.equal(result.queueName, "default-queue");
  assert.equal(result.preferredRegion, "us-west-2");
  assert.equal(result.tenantId, "tenant_abc");
  assert.equal(result.requestKey, "req_key_123");
});

test("parseControlPlaneLoadBalancingSelectionPayload parses empty payload", () => {
  const result = parseControlPlaneLoadBalancingSelectionPayload({});
  assert.equal(result.queueName, undefined);
  assert.equal(result.preferredRegion, undefined);
  assert.equal(result.tenantId, undefined);
  assert.equal(result.requestKey, undefined);
});

test("parseControlPlaneLoadBalancingSelectionPayload accepts partial payload", () => {
  const result = parseControlPlaneLoadBalancingSelectionPayload({
    queueName: "priority-queue",
  });
  assert.equal(result.queueName, "priority-queue");
  assert.equal(result.preferredRegion, undefined);
});

test("parseCreateTaskPayload parses valid payload with all fields", () => {
  const result = parseCreateTaskPayload({
    title: "My New Task",
    divisionId: "div_123",
    parentId: "parent_456",
    inputJson: '{"prompt": "do something"}',
    priority: "high",
    source: "user",
  });
  assert.equal(result.title, "My New Task");
  assert.equal(result.divisionId, "div_123");
  assert.equal(result.parentId, "parent_456");
  assert.equal(result.inputJson, '{"prompt": "do something"}');
  assert.equal(result.priority, "high");
  assert.equal(result.source, "user");
});

test("parseCreateTaskPayload parses minimal payload with only title", () => {
  const result = parseCreateTaskPayload({ title: "Minimal Task" });
  assert.equal(result.title, "Minimal Task");
  assert.equal(result.divisionId, undefined);
  assert.equal(result.parentId, undefined);
  assert.equal(result.inputJson, undefined);
  assert.equal(result.priority, undefined);
  assert.equal(result.source, undefined);
});

test("parseCreateTaskPayload accepts all priority values", () => {
  const priorities = ["low", "normal", "high", "urgent"] as const;
  for (const priority of priorities) {
    const result = parseCreateTaskPayload({ title: "Task", priority });
    assert.equal(result.priority, priority);
  }
});

test("parseCreateTaskPayload accepts all source values", () => {
  const sources = ["user", "perception", "system"] as const;
  for (const source of sources) {
    const result = parseCreateTaskPayload({ title: "Task", source });
    assert.equal(result.source, source);
  }
});

test("parseCreateTaskPayload throws for missing title", () => {
  assert.throws(
    () => parseCreateTaskPayload({}),
    (err: unknown) => (err as { code?: string }).code?.includes("title")
  );
});

test("parseCreateTaskPayload throws for empty title", () => {
  assert.throws(
    () => parseCreateTaskPayload({ title: "   " }),
    (err: unknown) => (err as { code?: string }).code?.includes("title")
  );
});

test("parseCreateTaskPayload throws for invalid priority", () => {
  assert.throws(
    () => parseCreateTaskPayload({ title: "Task", priority: "critical" as any }),
    (err: unknown) => (err as { code?: string }).code?.includes("priority")
  );
});

test("parseCreateTaskPayload throws for invalid source", () => {
  assert.throws(
    () => parseCreateTaskPayload({ title: "Task", source: "api" as any }),
    (err: unknown) => (err as { code?: string }).code?.includes("source")
  );
});

test("parseCreateTaskPayload throws for extra unknown fields", () => {
  assert.throws(
    () => parseCreateTaskPayload({ title: "Task", unknownField: "value" } as any),
    (err: unknown) => (err as { code?: string }).code?.includes("payload")
  );
});

test("parseUpdateTaskPayload parses valid payload with status", () => {
  const result = parseUpdateTaskPayload({ status: "in_progress" });
  assert.equal(result.status, "in_progress");
});

test("parseUpdateTaskPayload parses valid payload with priority", () => {
  const result = parseUpdateTaskPayload({ priority: "urgent" });
  assert.equal(result.priority, "urgent");
});

test("parseUpdateTaskPayload parses valid payload with outputJson", () => {
  const result = parseUpdateTaskPayload({ outputJson: '{"result": "success"}' });
  assert.equal(result.outputJson, '{"result": "success"}');
});

test("parseUpdateTaskPayload parses valid payload with title", () => {
  const result = parseUpdateTaskPayload({ title: "Updated Title" });
  assert.equal(result.title, "Updated Title");
});

test("parseUpdateTaskPayload parses empty object", () => {
  const result = parseUpdateTaskPayload({});
  assert.equal(result.title, undefined);
  assert.equal(result.status, undefined);
  assert.equal(result.priority, undefined);
  assert.equal(result.outputJson, undefined);
});

test("parseUpdateTaskPayload accepts all status values", () => {
  const statuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"] as const;
  for (const status of statuses) {
    const result = parseUpdateTaskPayload({ status });
    assert.equal(result.status, status);
  }
});

test("parseUpdateTaskPayload accepts all priority values", () => {
  const priorities = ["low", "normal", "high", "urgent"] as const;
  for (const priority of priorities) {
    const result = parseUpdateTaskPayload({ priority });
    assert.equal(result.priority, priority);
  }
});

test("parseUpdateTaskPayload throws for invalid status", () => {
  assert.throws(
    () => parseUpdateTaskPayload({ status: "running" as any }),
    (err: unknown) => (err as { code?: string }).code?.includes("status")
  );
});

test("parseUpdateTaskPayload throws for invalid priority", () => {
  assert.throws(
    () => parseUpdateTaskPayload({ priority: "medium" as any }),
    (err: unknown) => (err as { code?: string }).code?.includes("priority")
  );
});

test("parseUpdateTaskPayload throws for extra unknown fields", () => {
  assert.throws(
    () => parseUpdateTaskPayload({ unknownField: "value" } as any),
    (err: unknown) => (err as { code?: string }).code?.includes("payload")
  );
});

test("parseCreateWebhookEndpointPayload parses valid payload with all fields", () => {
  const result = parseCreateWebhookEndpointPayload({
    endpointId: "ep_123",
    source: "github",
    allowedEventTypes: ["push", "pull_request"],
    algorithm: "sha256_hmac",
    signingSecret: "supersecret",
    signatureHeader: "x-hub-signature-256",
    idempotencyHeader: "x-idempotency-key",
    dispatchTargetRef: "target_abc",
    enabled: true,
  });
  assert.equal(result.endpointId, "ep_123");
  assert.equal(result.source, "github");
  assert.deepEqual(result.allowedEventTypes, ["push", "pull_request"]);
  assert.equal(result.algorithm, "sha256_hmac");
  assert.equal(result.signingSecret, "supersecret");
  assert.equal(result.signatureHeader, "x-hub-signature-256");
  assert.equal(result.idempotencyHeader, "x-idempotency-key");
  assert.equal(result.dispatchTargetRef, "target_abc");
  assert.equal(result.enabled, true);
});

test("parseCreateWebhookEndpointPayload parses minimal payload", () => {
  const result = parseCreateWebhookEndpointPayload({
    endpointId: "ep_minimal",
    source: "custom",
  });
  assert.equal(result.endpointId, "ep_minimal");
  assert.equal(result.source, "custom");
  assert.equal(result.allowedEventTypes, undefined);
  assert.equal(result.algorithm, undefined);
  assert.equal(result.signingSecret, undefined);
  assert.equal(result.signatureHeader, undefined);
  assert.equal(result.idempotencyHeader, undefined);
  assert.equal(result.dispatchTargetRef, undefined);
  assert.equal(result.enabled, undefined);
});

test("parseCreateWebhookEndpointPayload accepts algorithm none", () => {
  const result = parseCreateWebhookEndpointPayload({
    endpointId: "ep_123",
    source: "github",
    algorithm: "none",
  });
  assert.equal(result.algorithm, "none");
});

test("parseCreateWebhookEndpointPayload accepts enabled false", () => {
  const result = parseCreateWebhookEndpointPayload({
    endpointId: "ep_123",
    source: "github",
    enabled: false,
  });
  assert.equal(result.enabled, false);
});

test("parseCreateWebhookEndpointPayload throws for missing endpointId", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({ source: "github" }),
    (err: unknown) => (err as { code?: string }).code?.includes("endpointId")
  );
});

test("parseCreateWebhookEndpointPayload throws for missing source", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({ endpointId: "ep_123" }),
    (err: unknown) => (err as { code?: string }).code?.includes("source")
  );
});

test("parseCreateWebhookEndpointPayload throws for empty endpointId", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({ endpointId: "   ", source: "github" }),
    (err: unknown) => (err as { code?: string }).code?.includes("endpointId")
  );
});

test("parseCreateWebhookEndpointPayload throws for empty source", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({ endpointId: "ep_123", source: "   " }),
    (err: unknown) => (err as { code?: string }).code?.includes("source")
  );
});

test("parseCreateWebhookEndpointPayload throws for invalid algorithm", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({
      endpointId: "ep_123",
      source: "github",
      algorithm: "md5" as any,
    }),
    (err: unknown) => (err as { code?: string }).code?.includes("algorithm")
  );
});

test("parseCreateWebhookEndpointPayload throws for extra unknown fields", () => {
  assert.throws(
    () => parseCreateWebhookEndpointPayload({
      endpointId: "ep_123",
      source: "github",
      unknownField: "value",
    } as any),
    (err: unknown) => (err as { code?: string }).code?.includes("payload")
  );
});
