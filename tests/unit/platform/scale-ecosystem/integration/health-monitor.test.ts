import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  ConnectorHealthReportSchema,
  summarizeConnectorHealth,
  type ConnectorHealthReport,
} from "../../../../../src/scale-ecosystem/integration/health-monitor/index.js";

test("summarizeConnectorHealth returns healthy when all reports healthy [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "healthy", latencyMs: 50, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "healthy", latencyMs: 60, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "healthy");
});

test("summarizeConnectorHealth returns degraded when any report degraded [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "healthy", latencyMs: 50, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "degraded", latencyMs: 500, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "degraded");
});

test("summarizeConnectorHealth returns failed when any report failed [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "healthy", latencyMs: 50, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "failed", latencyMs: 0, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "failed");
});

test("summarizeConnectorHealth returns failed even with mix of healthy and degraded when failed present [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "healthy", latencyMs: 50, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "degraded", latencyMs: 500, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-3", status: "failed", latencyMs: 0, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "failed");
});

test("summarizeConnectorHealth handles single healthy report [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "healthy", latencyMs: 50, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "healthy");
});

test("summarizeConnectorHealth handles single degraded report [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "degraded", latencyMs: 500, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "degraded");
});

test("summarizeConnectorHealth handles single failed report [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "failed", latencyMs: 0, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "failed");
});

test("summarizeConnectorHealth returns healthy for empty array [health-monitor]", () => {
  const reports: readonly ConnectorHealthReport[] = [];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "healthy");
});

test("ConnectorHealthReportSchema validates valid report [health-monitor]", () => {
  const validReport = {
    connectorId: "conn-1",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2024-01-01T00:00:00Z",
  };

  const result = ConnectorHealthReportSchema.safeParse(validReport);

  assert.strictEqual(result.success, true);
});

test("ConnectorHealthReportSchema rejects empty connectorId [health-monitor]", () => {
  const invalidReport = {
    connectorId: "",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2024-01-01T00:00:00Z",
  };

  const result = ConnectorHealthReportSchema.safeParse(invalidReport);

  assert.strictEqual(result.success, false);
});

test("ConnectorHealthReportSchema rejects negative latency [health-monitor]", () => {
  const invalidReport = {
    connectorId: "conn-1",
    status: "healthy",
    latencyMs: -10,
    checkedAt: "2024-01-01T00:00:00Z",
  };

  const result = ConnectorHealthReportSchema.safeParse(invalidReport);

  assert.strictEqual(result.success, false);
});

test("ConnectorHealthReportSchema rejects invalid status [health-monitor]", () => {
  const invalidReport = {
    connectorId: "conn-1",
    status: "unknown",
    latencyMs: 50,
    checkedAt: "2024-01-01T00:00:00Z",
  };

  const result = ConnectorHealthReportSchema.safeParse(invalidReport);

  assert.strictEqual(result.success, false);
});

test("ConnectorHealthReportSchema rejects empty checkedAt [health-monitor]", () => {
  const invalidReport = {
    connectorId: "conn-1",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "",
  };

  const result = ConnectorHealthReportSchema.safeParse(invalidReport);

  assert.strictEqual(result.success, false);
});

test("ConnectorHealthReportSchema allows zero latency [health-monitor]", () => {
  const validReport = {
    connectorId: "conn-1",
    status: "healthy",
    latencyMs: 0,
    checkedAt: "2024-01-01T00:00:00Z",
  };

  const result = ConnectorHealthReportSchema.safeParse(validReport);

  assert.strictEqual(result.success, true);
});

test("summarizeConnectorHealth prioritizes failed over degraded [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "degraded", latencyMs: 500, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "failed", latencyMs: 0, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-3", status: "degraded", latencyMs: 300, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "failed");
});

test("summarizeConnectorHealth treats all degraded as degraded [health-monitor]", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "conn-1", status: "degraded", latencyMs: 500, checkedAt: "2024-01-01T00:00:00Z" },
    { connectorId: "conn-2", status: "degraded", latencyMs: 600, checkedAt: "2024-01-01T00:00:00Z" },
  ];

  const result = summarizeConnectorHealth(reports);

  assert.strictEqual(result, "degraded");
});
