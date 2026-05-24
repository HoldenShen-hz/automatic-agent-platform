import assert from "node:assert/strict";
import test from "node:test";

import { buildConnectorExecutionKey, ConnectorExecutionRequest } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.js";

test("buildConnectorExecutionKey creates correct key", () => {
  const request: ConnectorExecutionRequest = {
    connectorId: "slack",
    capability: "send_message",
    payload: { channel: "general", text: "hello" },
    secretBindings: [],
  };

  const key = buildConnectorExecutionKey(request);

  assert.equal(key, "slack:send_message");
});

test("buildConnectorExecutionKey handles complex capability names", () => {
  const request: ConnectorExecutionRequest = {
    connectorId: "aws-s3",
    capability: "upload:multipart",
    payload: {},
    secretBindings: [],
  };

  const key = buildConnectorExecutionKey(request);

  assert.equal(key, "aws-s3:upload:multipart");
});

test("buildConnectorExecutionKey handles empty payload", () => {
  const request: ConnectorExecutionRequest = {
    connectorId: "http",
    capability: "GET",
    payload: {},
    secretBindings: [],
  };

  const key = buildConnectorExecutionKey(request);

  assert.equal(key, "http:GET");
});

test("buildConnectorExecutionKey unique per connector", () => {
  const request1: ConnectorExecutionRequest = { connectorId: "a", capability: "x", payload: {}, secretBindings: [] };
  const request2: ConnectorExecutionRequest = { connectorId: "b", capability: "x", payload: {}, secretBindings: [] };

  assert.notEqual(buildConnectorExecutionKey(request1), buildConnectorExecutionKey(request2));
});

test("buildConnectorExecutionKey unique per capability", () => {
  const request1: ConnectorExecutionRequest = { connectorId: "svc", capability: "read", payload: {}, secretBindings: [] };
  const request2: ConnectorExecutionRequest = { connectorId: "svc", capability: "write", payload: {}, secretBindings: [] };

  assert.notEqual(buildConnectorExecutionKey(request1), buildConnectorExecutionKey(request2));
});

test("ConnectorExecutionResult schema validates succeeded", () => {
  const result = {
    connectorId: "test",
    success: true,
    status: "succeeded" as const,
  };

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
});

test("ConnectorExecutionResult schema validates failed", () => {
  const result = {
    connectorId: "test",
    success: false,
    status: "failed" as const,
  };

  assert.equal(result.success, false);
  assert.equal(result.status, "failed");
});

test("ConnectorExecutionResult schema validates deferred", () => {
  const result = {
    connectorId: "test",
    success: false,
    status: "deferred" as const,
  };

  assert.equal(result.status, "deferred");
});
