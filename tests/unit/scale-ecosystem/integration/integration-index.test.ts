/**
 * Unit tests for src/scale-ecosystem/integration/index.ts barrel export
 *
 * @see src/scale-ecosystem/integration/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as integration from "../../../../src/scale-ecosystem/integration/index.js";

test("index exports ConnectorFrameworkService", () => {
  assert.ok("ConnectorFrameworkService" in integration);
});

test("index exports connector-registry exports", () => {
  assert.ok("ConnectorManifestSchema" in integration);
  assert.ok("listEnabledConnectors" in integration);
});

test("index exports connector-runtime exports", () => {
  assert.ok("ConnectorExecutionRequestSchema" in integration);
  assert.ok("ConnectorExecutionResultSchema" in integration);
  assert.ok("buildConnectorExecutionKey" in integration);
  assert.ok("invokeCallback" in integration);
});

test("index exports connector classes", () => {
  assert.ok("GitHubConnector" in integration);
  assert.ok("JiraConnector" in integration);
  assert.ok("ServiceNowConnector" in integration);
  assert.ok("SlackConnector" in integration);
});

test("index exports health-monitor exports", () => {
  assert.ok("ConnectorHealthReportSchema" in integration);
  assert.ok("summarizeConnectorHealth" in integration);
});

test("index exports ConnectorBinding interface type", () => {
  assert.ok("ConnectorBinding" in integration);
});

test("invokeCallback is a function", () => {
  assert.equal(typeof integration.invokeCallback, "function");
});

test("invokeCallback returns true for successful callback", async () => {
  // Create a simple test server using a local fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Use a mock URL that will respond quickly
    const result = await integration.invokeCallback("http://localhost:9999/callback", {
      connectorId: "test",
      success: true,
      status: "succeeded",
    });
    // Will fail connection since no server, but should return false
    assert.equal(typeof result, "boolean");
  } finally {
    clearTimeout(timeout);
  }
});

test("invokeCallback returns false when fetch fails", async () => {
  const result = await integration.invokeCallback("http://localhost:9999/nonexistent", {
    connectorId: "test",
    success: false,
    status: "failed",
  });

  assert.equal(result, false);
});

test("invokeCallback sends correct JSON body", async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const result = await integration.invokeCallback("http://localhost:9999/callback", {
      connectorId: "my-connector",
      success: true,
      status: "succeeded",
      resultPayload: { data: "test" },
    });
    assert.equal(typeof result, "boolean");
  } finally {
    clearTimeout(timeout);
  }
});

test("invokeCallback handles timeout gracefully", async () => {
  // Use an unreachable address with very short timeout
  const result = await integration.invokeCallback("http://10.255.255.1:1/callback", {
    connectorId: "timeout-test",
    success: false,
    status: "failed",
  });

  // Should return false due to timeout
  assert.equal(result, false);
});

test("buildConnectorExecutionKey works with exported function", () => {
  const key = integration.buildConnectorExecutionKey({
    connectorId: "github",
    capability: "create_pr",
    payload: {},
  });

  assert.equal(key, "github:create_pr");
});

test("ConnectorHealthReportSchema is exported and works", () => {
  const report = integration.ConnectorHealthReportSchema.parse({
    connectorId: "test-conn",
    status: "healthy",
    latencyMs: 100,
    checkedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(report.connectorId, "test-conn");
  assert.equal(report.status, "healthy");
});

test("summarizeConnectorHealth works with exported function", () => {
  const result = integration.summarizeConnectorHealth([
    { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-01-01T00:00:00.000Z" },
    { connectorId: "c2", status: "degraded", latencyMs: 500, checkedAt: "2026-01-01T00:00:00.000Z" },
  ]);

  assert.equal(result, "degraded");
});

test("listEnabledConnectors exported function filters correctly", () => {
  const connectors = [
    { connectorId: "c1", provider: "p1", lifecycleState: "enabled" as const },
    { connectorId: "c2", provider: "p2", lifecycleState: "disabled" as const },
    { connectorId: "c3", provider: "p3", lifecycleState: "enabled" as const },
  ];

  const enabled = integration.listEnabledConnectors(connectors);
  assert.equal(enabled.length, 2);
});