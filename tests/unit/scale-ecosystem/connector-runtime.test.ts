import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConnectorExecutionKey,
  ConnectorExecutionRequestSchema,
  ConnectorExecutionResultSchema,
} from "../../../src/scale-ecosystem/integration/connector-runtime/index.js";

test("buildConnectorExecutionKey creates key with connectorId and capability", () => {
  const key = buildConnectorExecutionKey({ connectorId: "slack", capability: "notify", payload: {}, secretBindings: [] });

  assert.equal(key, "slack:notify");
});

test("buildConnectorExecutionKey handles different connectors", () => {
  const key1 = buildConnectorExecutionKey({ connectorId: "jira", capability: "create_ticket", payload: {}, secretBindings: [] });
  const key2 = buildConnectorExecutionKey({ connectorId: "github", capability: "create_issue", payload: {}, secretBindings: [] });

  assert.equal(key1, "jira:create_ticket");
  assert.equal(key2, "github:create_issue");
});

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorExecutionRequestSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ConnectorExecutionRequestSchema parses valid minimal request", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "slack",
    capability: "notify",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.connectorId, "slack");
    assert.equal(result.data.capability, "notify");
    assert.deepEqual(result.data.payload, {});
  }
});

test("ConnectorExecutionRequestSchema parses request with payload", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "jira",
    capability: "create_ticket",
    payload: { title: "Bug report", priority: "high" },
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.payload.title, "Bug report");
  }
});

test("ConnectorExecutionRequestSchema rejects empty connectorId", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "",
    capability: "notify",
  });

  assert.equal(result.success, false);
});

test("ConnectorExecutionRequestSchema rejects empty capability", () => {
  const result = ConnectorExecutionRequestSchema.safeParse({
    connectorId: "slack",
    capability: "",
  });

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorExecutionResultSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ConnectorExecutionResultSchema parses succeeded status", () => {
  const result = ConnectorExecutionResultSchema.safeParse({
    connectorId: "slack",
    success: true,
    status: "succeeded",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "succeeded");
  }
});

test("ConnectorExecutionResultSchema parses failed status", () => {
  const result = ConnectorExecutionResultSchema.safeParse({
    connectorId: "slack",
    success: false,
    status: "failed",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "failed");
  }
});

test("ConnectorExecutionResultSchema parses deferred status", () => {
  const result = ConnectorExecutionResultSchema.safeParse({
    connectorId: "slack",
    success: true,
    status: "deferred",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.status, "deferred");
  }
});

test("ConnectorExecutionResultSchema rejects invalid status", () => {
  const result = ConnectorExecutionResultSchema.safeParse({
    connectorId: "slack",
    success: true,
    status: "pending",
  });

  assert.equal(result.success, false);
});

test("ConnectorExecutionResultSchema rejects missing fields", () => {
  const result = ConnectorExecutionResultSchema.safeParse({
    connectorId: "slack",
  });

  assert.equal(result.success, false);
});
