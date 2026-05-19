import assert from "node:assert/strict";
import test from "node:test";
import { ConnectorHealthReportSchema, summarizeConnectorHealth, } from "../../../../../src/scale-ecosystem/integration/health-monitor/index.js";
test("ConnectorHealthReportSchema parses valid healthy report", () => {
    const result = ConnectorHealthReportSchema.parse({
        connectorId: "github-1",
        status: "healthy",
        latencyMs: 50,
        checkedAt: "2026-04-27T00:00:00.000Z",
    });
    assert.equal(result.connectorId, "github-1");
    assert.equal(result.status, "healthy");
    assert.equal(result.latencyMs, 50);
});
test("ConnectorHealthReportSchema parses valid degraded report", () => {
    const result = ConnectorHealthReportSchema.parse({
        connectorId: "jira-1",
        status: "degraded",
        latencyMs: 500,
        checkedAt: "2026-04-27T00:00:00.000Z",
    });
    assert.equal(result.status, "degraded");
});
test("ConnectorHealthReportSchema parses valid failed report", () => {
    const result = ConnectorHealthReportSchema.parse({
        connectorId: "slack-1",
        status: "failed",
        latencyMs: 0,
        checkedAt: "2026-04-27T00:00:00.000Z",
    });
    assert.equal(result.status, "failed");
});
test("ConnectorHealthReportSchema rejects missing connectorId", () => {
    assert.throws(() => {
        ConnectorHealthReportSchema.parse({
            status: "healthy",
            latencyMs: 50,
            checkedAt: "2026-04-27T00:00:00.000Z",
        });
    });
});
test("ConnectorHealthReportSchema rejects invalid status", () => {
    assert.throws(() => {
        ConnectorHealthReportSchema.parse({
            connectorId: "test-1",
            status: "unknown",
            latencyMs: 50,
            checkedAt: "2026-04-27T00:00:00.000Z",
        });
    });
});
test("ConnectorHealthReportSchema rejects negative latencyMs", () => {
    assert.throws(() => {
        ConnectorHealthReportSchema.parse({
            connectorId: "test-1",
            status: "healthy",
            latencyMs: -1,
            checkedAt: "2026-04-27T00:00:00.000Z",
        });
    });
});
test("ConnectorHealthReportSchema rejects empty checkedAt", () => {
    assert.throws(() => {
        ConnectorHealthReportSchema.parse({
            connectorId: "test-1",
            status: "healthy",
            latencyMs: 50,
            checkedAt: "",
        });
    });
});
test("summarizeConnectorHealth returns healthy for all healthy reports", () => {
    const reports = [
        { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c2", status: "healthy", latencyMs: 20, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "healthy");
});
test("summarizeConnectorHealth returns degraded when any report is degraded", () => {
    const reports = [
        { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c2", status: "degraded", latencyMs: 500, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c3", status: "healthy", latencyMs: 15, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "degraded");
});
test("summarizeConnectorHealth returns failed when any report is failed", () => {
    const reports = [
        { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c2", status: "failed", latencyMs: 0, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c3", status: "degraded", latencyMs: 500, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "failed");
});
test("summarizeConnectorHealth returns failed even when failed is last", () => {
    const reports = [
        { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c2", status: "degraded", latencyMs: 500, checkedAt: "2026-04-27T00:00:00.000Z" },
        { connectorId: "c3", status: "failed", latencyMs: 0, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "failed");
});
test("summarizeConnectorHealth returns healthy for empty array", () => {
    assert.equal(summarizeConnectorHealth([]), "healthy");
});
test("summarizeConnectorHealth returns healthy for single healthy report", () => {
    const reports = [
        { connectorId: "c1", status: "healthy", latencyMs: 10, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "healthy");
});
test("summarizeConnectorHealth returns degraded for single degraded report", () => {
    const reports = [
        { connectorId: "c1", status: "degraded", latencyMs: 500, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "degraded");
});
test("summarizeConnectorHealth returns failed for single failed report", () => {
    const reports = [
        { connectorId: "c1", status: "failed", latencyMs: 0, checkedAt: "2026-04-27T00:00:00.000Z" },
    ];
    assert.equal(summarizeConnectorHealth(reports), "failed");
});
//# sourceMappingURL=connector-health.test.js.map