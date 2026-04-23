/**
 * Unit tests for computeBurnRate method in SloAlertingService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SloAlertingService, SLO_ALERTING_DDL, } from "../../../../../src/platform/shared/observability/slo-alerting-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = `${workspace}/slo.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(SLO_ALERTING_DDL);
    return { workspace, db };
}
test("computeBurnRate returns 0 for non-existent SLO", () => {
    const h = createHarness("aa-burn-rate-none-");
    try {
        const service = new SloAlertingService(h.db);
        const rate = service.computeBurnRate("non_existent_slo", 3600000);
        assert.equal(rate, 0);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate returns 0 when no samples in window", () => {
    const h = createHarness("aa-burn-rate-empty-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "latency_slo",
            description: "P99 latency under 500ms",
            sliKind: "latency_p99",
            targetValue: 500,
            operator: "lte",
            windowMinutes: 60,
        });
        const rate = service.computeBurnRate(slo.id, 3600000);
        assert.equal(rate, 0);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate returns 1.0 when SLO is exactly at target pace", () => {
    const h = createHarness("aa-burn-rate-atpace-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "error_rate_slo",
            description: "Error rate under 1%",
            sliKind: "error_rate",
            targetValue: 1.0,
            operator: "lte",
            windowMinutes: 60,
        });
        // Collect samples at target value (1%)
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            service.collectSli(slo.id, 1.0, "%", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        const rate = service.computeBurnRate(slo.id, 600000); // 10 minute window = 1/6 of 60 min window
        assert.ok(rate >= 0.9 && rate <= 1.1, `Expected rate ~1.0, got ${rate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate returns >1 when consuming error budget faster than expected", () => {
    const h = createHarness("aa-burn-rate-fast-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "error_rate_slo",
            description: "Error rate under 1%",
            sliKind: "error_rate",
            targetValue: 1.0,
            operator: "lte",
            windowMinutes: 60,
        });
        // Collect samples well above target (3-5%)
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            service.collectSli(slo.id, 4.0, "%", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        const rate = service.computeBurnRate(slo.id, 600000);
        assert.ok(rate > 1.0, `Expected rate > 1.0, got ${rate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate returns <1 when consuming error budget slower than expected", () => {
    const h = createHarness("aa-burn-rate-slow-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "error_rate_slo",
            description: "Error rate under 1%",
            sliKind: "error_rate",
            targetValue: 1.0,
            operator: "lte",
            windowMinutes: 60,
        });
        // Collect samples well below target (0.1-0.2%)
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            service.collectSli(slo.id, 0.15, "%", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        const rate = service.computeBurnRate(slo.id, 600000);
        assert.ok(rate < 1.0, `Expected rate < 1.0, got ${rate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate handles gte operator (higher is better)", () => {
    const h = createHarness("aa-burn-rate-gte-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "availability_slo",
            description: "Availability >= 99.9%",
            sliKind: "availability",
            targetValue: 99.9,
            operator: "gte",
            windowMinutes: 60,
        });
        // Collect samples below target (98% vs 99.9%)
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            service.collectSli(slo.id, 98.0, "%", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        const rate = service.computeBurnRate(slo.id, 600000);
        assert.ok(rate > 1.0, `Expected rate > 1.0 for availability below target, got ${rate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate respects window parameter", () => {
    const h = createHarness("aa-burn-rate-window-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "latency_slo",
            description: "P99 latency under 500ms",
            sliKind: "latency_p95",
            targetValue: 500,
            operator: "lte",
            windowMinutes: 60,
        });
        // Collect samples well above target (1000ms)
        const now = Date.now();
        for (let i = 0; i < 30; i++) {
            service.collectSli(slo.id, 1000, "ms", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        // Short window (5 min) - burn rate should be high
        const shortRate = service.computeBurnRate(slo.id, 300000);
        // Long window (30 min) - burn rate will be different
        const longRate = service.computeBurnRate(slo.id, 1800000);
        assert.ok(shortRate > 1.0, `Expected short window rate > 1.0, got ${shortRate}`);
        assert.ok(longRate > 1.0, `Expected long window rate > 1.0, got ${longRate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("computeBurnRate for latency with lte operator (lower is better)", () => {
    const h = createHarness("aa-burn-rate-latency-");
    try {
        const service = new SloAlertingService(h.db);
        const slo = service.defineSlo({
            name: "latency_slo",
            description: "P99 latency under 500ms",
            sliKind: "latency_p95",
            targetValue: 500,
            operator: "lte",
            windowMinutes: 60,
        });
        // Collect samples above target (600ms vs 500ms target)
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            service.collectSli(slo.id, 600, "ms", { timestamp: new Date(now - i * 60000).toISOString() });
        }
        const rate = service.computeBurnRate(slo.id, 600000);
        assert.ok(rate > 1.0, `Expected rate > 1.0 when latency exceeds target, got ${rate}`);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=compute-burn-rate.test.js.map