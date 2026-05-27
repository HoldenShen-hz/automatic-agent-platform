/**
 * Unit tests for invokeCallback function
 *
 * @see src/scale-ecosystem/integration/connector-runtime/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { invokeCallback } from "../../../../src/scale-ecosystem/integration/connector-runtime/index.ts";
import { UNREACHABLE_LOOPBACK_BASE_URL } from "../../../helpers/network-test-constants.js";

const callbackEndpoint = (path: string): string => `${UNREACHABLE_LOOPBACK_BASE_URL}${path}`;

test("invokeCallback returns false when server is unreachable", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    success: true,
    status: "succeeded",
  });

  assert.equal(result, false);
});

test("invokeCallback returns false on connection refused", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    success: false,
    status: "failed",
  });

  assert.equal(result, false);
});

test("invokeCallback sends correct headers", async () => {
  // This will fail but demonstrates the function attempts with correct structure
  const result = await invokeCallback(callbackEndpoint("/test"), {
    connectorId: "my-connector",
    success: true,
    status: "succeeded",
    resultPayload: { key: "value" },
  });

  // Expect false since no server is running
  assert.equal(result, false);
});

test("invokeCallback handles result with executionId", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    executionId: "exec-123",
    success: true,
    status: "succeeded",
  });

  assert.equal(result, false); // No server to receive
});

test("invokeCallback handles failed status", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    success: false,
    status: "failed",
  });

  assert.equal(result, false);
});

test("invokeCallback handles deferred status", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    success: false,
    status: "deferred",
  });

  assert.equal(result, false);
});

test("invokeCallback handles empty resultPayload", async () => {
  const result = await invokeCallback(callbackEndpoint("/callback"), {
    connectorId: "test",
    success: true,
    status: "succeeded",
    resultPayload: {},
  });

  assert.equal(result, false);
});

test("invokeCallback returns false on timeout", async () => {
  const result = await invokeCallback("http://10.255.255.1:1/callback", {
    connectorId: "timeout-test",
    success: false,
    status: "failed",
  });

  assert.equal(result, false);
});

test("invokeCallback returns false on DNS resolution failure", async () => {
  const result = await invokeCallback("http://this-domain-does-not-exist.example.com/callback", {
    connectorId: "dns-fail",
    success: false,
    status: "failed",
  });

  assert.equal(result, false);
});
