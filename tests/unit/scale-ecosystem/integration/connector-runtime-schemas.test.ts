import assert from "node:assert/strict";
import test from "node:test";

import {
  ConnectorExecutionRequestSchema,
  ConnectorExecutionResultSchema,
} from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

test("ConnectorExecutionRequestSchema parses valid request [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionRequestSchema.parse({
    connectorId: "slack",
    capability: "send_message",
    payload: { channel: "general", text: "hello" },
  });

  assert.equal(result.connectorId, "slack");
  assert.equal(result.capability, "send_message");
  assert.deepEqual(result.payload, { channel: "general", text: "hello" });
});

test("ConnectorExecutionRequestSchema parses request with empty payload [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionRequestSchema.parse({
    connectorId: "github",
    capability: "list_repos",
    payload: {},
  });

  assert.equal(result.connectorId, "github");
  assert.equal(result.capability, "list_repos");
  assert.deepEqual(result.payload, {});
});

test("ConnectorExecutionRequestSchema parses request with complex payload [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionRequestSchema.parse({
    connectorId: "jira",
    capability: "create_issue",
    payload: {
      project: "PLATFORM",
      type: "bug",
      priority: "high",
      labels: ["backend", "urgent"],
    },
  });

  assert.equal(result.payload.project, "PLATFORM");
  assert.deepEqual(result.payload.labels, ["backend", "urgent"]);
});

test("ConnectorExecutionRequestSchema rejects missing connectorId [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionRequestSchema.parse({
      capability: "send_message",
      payload: {},
    });
  });
});

test("ConnectorExecutionRequestSchema rejects empty connectorId [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionRequestSchema.parse({
      connectorId: "",
      capability: "send_message",
      payload: {},
    });
  });
});

test("ConnectorExecutionRequestSchema rejects missing capability [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionRequestSchema.parse({
      connectorId: "slack",
      payload: {},
    });
  });
});

test("ConnectorExecutionRequestSchema rejects empty capability [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionRequestSchema.parse({
      connectorId: "slack",
      capability: "",
      payload: {},
    });
  });
});

test("ConnectorExecutionRequestSchema accepts without explicit payload (uses default) [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionRequestSchema.parse({
    connectorId: "slack",
    capability: "send_message",
  });

  assert.deepEqual(result.payload, {});
});

test("ConnectorExecutionResultSchema parses succeeded result [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionResultSchema.parse({
    connectorId: "slack",
    success: true,
    status: "succeeded",
  });

  assert.equal(result.connectorId, "slack");
  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorExecutionResultSchema parses failed result [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionResultSchema.parse({
    connectorId: "github",
    success: false,
    status: "failed",
  });

  assert.equal(result.connectorId, "github");
  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorExecutionResultSchema parses deferred result [connector-runtime-schemas]", () => {
  const result = ConnectorExecutionResultSchema.parse({
    connectorId: "jira",
    success: false,
    status: "deferred",
  });

  assert.equal(result.connectorId, "jira");
  assert.equal(result.success, false);
  assert.equal(result.status, "deferred");
});

test("ConnectorExecutionResultSchema rejects missing connectorId [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      success: true,
      status: "succeeded",
    });
  });
});

test("ConnectorExecutionResultSchema rejects empty connectorId [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      connectorId: "",
      success: true,
      status: "succeeded",
    });
  });
});

test("ConnectorExecutionResultSchema rejects missing success [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      connectorId: "slack",
      status: "succeeded",
    });
  });
});

test("ConnectorExecutionResultSchema rejects missing status [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      connectorId: "slack",
      success: true,
    });
  });
});

test("ConnectorExecutionResultSchema rejects invalid status [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      connectorId: "slack",
      success: true,
      status: "pending",
    });
  });
});

test("ConnectorExecutionResultSchema rejects unknown status value [connector-runtime-schemas]", () => {
  assert.throws(() => {
    ConnectorExecutionResultSchema.parse({
      connectorId: "slack",
      success: true,
      status: "completed",
    });
  });
});
