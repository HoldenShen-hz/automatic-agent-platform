import assert from "node:assert/strict";
import test from "node:test";
import { summarizeConnectorHealth, ConnectorHealthReportSchema, } from "../../../src/scale-ecosystem/integration/health-monitor/index.js";
function createHealthReport(overrides = {}) {
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
test("summarizeConnectorHealth returns healthy when all reports are healthy", () => {
    const reports = [
        createHealthReport({ connectorId: "c1", status: "healthy" }),
        createHealthReport({ connectorId: "c2", status: "healthy" }),
    ];
    const result = summarizeConnectorHealth(reports);
    assert.equal(result, "healthy");
});
test("summarizeConnectorHealth returns degraded when any report is degraded", () => {
    const reports = [
        createHealthReport({ connectorId: "c1", status: "healthy" }),
        createHealthReport({ connectorId: "c2", status: "degraded" }),
    ];
    const result = summarizeConnectorHealth(reports);
    assert.equal(result, "degraded");
});
test("summarizeConnectorHealth returns failed when any report is failed", () => {
    const reports = [
        createHealthReport({ connectorId: "c1", status: "healthy" }),
        createHealthReport({ connectorId: "c2", status: "failed" }),
    ];
    const result = summarizeConnectorHealth(reports);
    assert.equal(result, "failed");
});
test("summarizeConnectorHealth prioritizes failed over degraded", () => {
    const reports = [
        createHealthReport({ connectorId: "c1", status: "degraded" }),
        createHealthReport({ connectorId: "c2", status: "failed" }),
    ];
    const result = summarizeConnectorHealth(reports);
    assert.equal(result, "failed");
});
test("summarizeConnectorHealth returns healthy for empty array", () => {
    const result = summarizeConnectorHealth([]);
    assert.equal(result, "healthy");
});
test("summarizeConnectorHealth handles single report", () => {
    const result = summarizeConnectorHealth([createHealthReport({ status: "degraded" })]);
    assert.equal(result, "degraded");
});
// ─────────────────────────────────────────────────────────────────────────────
// ConnectorHealthReportSchema Tests
// ─────────────────────────────────────────────────────────────────────────────
test("ConnectorHealthReportSchema parses valid report", () => {
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
test("ConnectorHealthReportSchema accepts all valid statuses", () => {
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
test("ConnectorHealthReportSchema rejects invalid status", () => {
    const result = ConnectorHealthReportSchema.safeParse({
        connectorId: "test",
        status: "unknown",
        latencyMs: 0,
        checkedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.success, false);
});
test("ConnectorHealthReportSchema rejects negative latency", () => {
    const result = ConnectorHealthReportSchema.safeParse({
        connectorId: "test",
        status: "healthy",
        latencyMs: -10,
        checkedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.success, false);
});
test("ConnectorHealthReportSchema rejects empty connectorId", () => {
    const result = ConnectorHealthReportSchema.safeParse({
        connectorId: "",
        status: "healthy",
        latencyMs: 0,
        checkedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.success, false);
});
test("ConnectorHealthReportSchema rejects empty checkedAt", () => {
    const result = ConnectorHealthReportSchema.safeParse({
        connectorId: "test",
        status: "healthy",
        latencyMs: 0,
        checkedAt: "",
    });
    assert.equal(result.success, false);
});
test("ConnectorHealthReportSchema accepts zero latency", () => {
    const result = ConnectorHealthReportSchema.safeParse({
        connectorId: "test",
        status: "healthy",
        latencyMs: 0,
        checkedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.success, true);
});
//# sourceMappingURL=connector-health-monitor.test.js.map