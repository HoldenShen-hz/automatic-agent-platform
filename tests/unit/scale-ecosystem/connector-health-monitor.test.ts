import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeConnectorHealth,
  ConnectorHealthReportSchema,
  type ConnectorHealthReport,
} from "../../../src/scale-ecosystem/integration/health-monitor/index.js";

function createHealthReport(overrides: Partial<ConnectorHealthReport> = {}): ConnectorHealthReport {
  return {
    connectorId: overrides.connectorId ?? "connector-1",
    status: overrides.status ?? "healthy",
    latencyMs: overrides.latencyMs ?? 100,
    checkedAt: overrides.checkedAt ?? "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// summarizeConnectorHealth Tests
// ─────────────────────────────────────────────────────────────────────────────

test("summarizeConnectorHealth returns healthy when all reports are healthy [connector-health-monitor]", () => {
  const reports = [
    createHealthReport({ connectorId: "c1", status: "healthy" }),
    createHealthReport({ connectorId: "c2", status: "healthy" }),
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "healthy");
});

test("summarizeConnectorHealth returns degraded when any report is degraded [connector-health-monitor]", () => {
  const reports = [
    createHealthReport({ connectorId: "c1", status: "healthy" }),
    createHealthReport({ connectorId: "c2", status: "degraded" }),
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "degraded");
});

test("summarizeConnectorHealth returns failed when any report is failed [connector-health-monitor]", () => {
  const reports = [
    createHealthReport({ connectorId: "c1", status: "healthy" }),
    createHealthReport({ connectorId: "c2", status: "failed" }),
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "failed");
});

test("summarizeConnectorHealth prioritizes failed over degraded [connector-health-monitor]", () => {
  const reports = [
    createHealthReport({ connectorId: "c1", status: "degraded" }),
    createHealthReport({ connectorId: "c2", status: "failed" }),
  ];

  const result = summarizeConnectorHealth(reports);

  assert.equal(result, "failed");
});

test("summarizeConnectorHealth returns healthy for empty array [connector-health-monitor]", () => {
  const result = summarizeConnectorHealth([]);

  assert.equal(result, "healthy");
});

test("summarizeConnectorHealth handles single report [connector-health-monitor]", () => {
  const result = summarizeConnectorHealth([createHealthReport({ status: "degraded" })]);

  assert.equal(result, "degraded");
});

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorHealthReportSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ConnectorHealthReportSchema parses valid report [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "slack",
    status: "healthy",
    latencyMs: 150,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.connectorId, "slack");
    assert.equal(result.data.status, "healthy");
  }
});

test("ConnectorHealthReportSchema accepts all valid statuses [connector-health-monitor]", () => {
  for (const status of ["healthy", "degraded", "failed"]) {
    const result = ConnectorHealthReportSchema.safeParse({
      connectorId: "test",
      status,
      latencyMs: 0,
      checkedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.success, true, `Status ${status} should be valid`);
  }
});

test("ConnectorHealthReportSchema rejects invalid status [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "test",
    status: "unknown",
    latencyMs: 0,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.success, false);
});

test("ConnectorHealthReportSchema rejects negative latency [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "test",
    status: "healthy",
    latencyMs: -10,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.success, false);
});

test("ConnectorHealthReportSchema rejects empty connectorId [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "",
    status: "healthy",
    latencyMs: 0,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.success, false);
});

test("ConnectorHealthReportSchema rejects empty checkedAt [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "test",
    status: "healthy",
    latencyMs: 0,
    checkedAt: "",
  });

  assert.equal(result.success, false);
});

test("ConnectorHealthReportSchema accepts zero latency [connector-health-monitor]", () => {
  const result = ConnectorHealthReportSchema.safeParse({
    connectorId: "test",
    status: "healthy",
    latencyMs: 0,
    checkedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.success, true);
});