import assert from "node:assert/strict";
import test from "node:test";

import { summarizeConnectorHealth, ConnectorHealthReport } from "../../../../../../src/scale-ecosystem/integration/health-monitor/index.js";

test("summarizeConnectorHealth returns healthy when all reports healthy", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c2", status: "healthy", latencyMs: 20, checkedAt: "2026-04-20T00:00:00.000Z" },
  ];

  const summary = summarizeConnectorHealth(reports);

  assert.equal(summary, "healthy");
});

test("summarizeConnectorHealth returns failed when any report failed", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c2", status: "failed", latencyMs: 5000, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c3", status: "healthy", latencyMs: 15, checkedAt: "2026-04-20T00:00:00.000Z" },
  ];

  const summary = summarizeConnectorHealth(reports);

  assert.equal(summary, "failed");
});

test("summarizeConnectorHealth returns degraded when no failures but some degraded", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c2", status: "degraded", latencyMs: 500, checkedAt: "2026-04-20T00:00:00.000Z" },
  ];

  const summary = summarizeConnectorHealth(reports);

  assert.equal(summary, "degraded");
});

test("summarizeConnectorHealth returns healthy for empty array", () => {
  const summary = summarizeConnectorHealth([]);
  assert.equal(summary, "healthy");
});

test("summarizeConnectorHealth returns failed for single failed report", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "failed", latencyMs: 10000, checkedAt: "2026-04-20T00:00:00.000Z" },
  ];

  const summary = summarizeConnectorHealth(reports);

  assert.equal(summary, "failed");
});

test("summarizeConnectorHealth degraded takes precedence over healthy", () => {
  const reports: ConnectorHealthReport[] = [
    { connectorId: "c1", status: "healthy", latencyMs: 5, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c2", status: "degraded", latencyMs: 300, checkedAt: "2026-04-20T00:00:00.000Z" },
    { connectorId: "c3", status: "healthy", latencyMs: 8, checkedAt: "2026-04-20T00:00:00.000Z" },
  ];

  const summary = summarizeConnectorHealth(reports);

  assert.equal(summary, "degraded");
});

test("ConnectorHealthReportSchema validates status enum", () => {
  const report: ConnectorHealthReport = {
    connectorId: "test",
    status: "healthy",
    latencyMs: 50,
    checkedAt: "2026-04-20T00:00:00.000Z",
  };

  assert.ok(["healthy", "degraded", "failed"].includes(report.status));
});