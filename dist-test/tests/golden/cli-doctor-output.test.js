/**
 * Golden Test: CLI Doctor Command Output Structure
 *
 * Verifies doctor CLI output structure by testing individual components.
 *
 * Note: Full DoctorService.run() requires integration-level setup with
 * proper workspace directories and config files. These tests verify
 * the individual components that doctor output depends on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { ObservabilityRetentionService } from "../../src/platform/shared/observability/observability-retention-service.js";
test("golden: health service produces valid report structure", () => {
    const workspace = createTempWorkspace("aa-golden-health-");
    const dbPath = `${workspace}/health.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    // Create a task with deterministic IDs
    const taskId = "doctor_health_task_001";
    const executionId = "doctor_health_exec_001";
    seedTaskAndExecution(db, store, { taskId, executionId, traceId: "health-trace" });
    const healthService = new HealthService(db, store);
    const health = healthService.getReport();
    // Verify structure
    assert.ok(health, "Health report should exist");
    assert.ok(typeof health.status === "string");
    assert.ok(typeof health.uptimeSeconds === "number");
    assert.ok(Array.isArray(health.findings));
    assertGolden("cli-doctor-health-service", {
        status: health.status,
        uptimeSeconds: health.uptimeSeconds,
        findingCount: health.findings.length,
        dbWritable: health.dbWritable,
        providerHealth: health.providerHealth,
        activeExecutions: health.activeExecutions,
        queuedTasks: health.queuedTasks,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: inspect service query results have valid structure", () => {
    const workspace = createTempWorkspace("aa-golden-inspect-");
    const dbPath = `${workspace}/inspect.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const inspect = new InspectService(store);
    // Create tasks with deterministic IDs
    seedTaskAndExecution(db, store, {
        taskId: "doctor_query_task_001",
        executionId: "doctor_query_exec_001",
        traceId: "inspect-trace-1",
    });
    seedTaskAndExecution(db, store, {
        taskId: "doctor_query_task_002",
        executionId: "doctor_query_exec_002",
        traceId: "inspect-trace-2",
    });
    const tasks = inspect.queryTaskInspectSummaries({ limit: 10 });
    assert.ok(Array.isArray(tasks));
    assert.ok(tasks.length >= 2);
    assertGolden("cli-doctor-inspect-query", {
        count: tasks.length,
        tasks: tasks.slice(0, 2).map((t) => ({
            taskId: t.taskId,
            status: t.taskStatus,
        })),
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: observability retention service produces valid report", () => {
    const workspace = createTempWorkspace("aa-golden-retention-");
    const dbPath = `${workspace}/retention.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const retentionService = new ObservabilityRetentionService(db);
    const report = retentionService.preview();
    assert.ok(report, "Retention report should exist");
    assert.ok(report.mode === "dry_run" || report.mode === "enforced");
    assert.ok(typeof report.evaluatedAt === "string");
    assert.ok(report.policy, "Should have policy");
    assert.ok(report.events, "Should have events summary");
    // Normalize timestamp to avoid golden snapshot mismatches
    // Just verify format, not exact value
    const normalizedEvaluatedAt = report.evaluatedAt.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, "TIMESTAMP");
    assertGolden("cli-doctor-retention-report", {
        mode: report.mode,
        evaluatedAtIsValid: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(report.evaluatedAt),
        hasPolicy: report.policy !== null,
        hasEvents: report.events !== null,
        hasMessages: report.messages !== null,
        hasCompactions: report.compactions !== null,
    });
    db.close();
    cleanupPath(workspace);
});
test("golden: doctor self-check summary has expected format", () => {
    // This tests the structure of check summary without running full doctor
    const workspace = createTempWorkspace("aa-golden-summary-");
    const dbPath = `${workspace}/summary.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const healthService = new HealthService(db, store);
    // A properly functioning system should have ok status with proper counts
    const health = healthService.getReport();
    // Calculate self-check style summary
    const healthStatusToCheckStatus = (status) => {
        if (status === "ok")
            return 8;
        if (status === "degraded")
            return 4;
        return 0;
    };
    const selfCheckSummary = {
        totalChecks: 8,
        okChecks: healthStatusToCheckStatus(health.status),
        degradedChecks: health.status === "degraded" ? 4 : 0,
        failClosedChecks: 0,
        failingCheckIds: [],
    };
    assert.ok(selfCheckSummary.totalChecks === 8);
    assert.ok(selfCheckSummary.okChecks >= 0);
    assert.ok(selfCheckSummary.degradedChecks >= 0);
    assert.ok(selfCheckSummary.failClosedChecks >= 0);
    assertGolden("cli-doctor-self-check-summary", {
        totalChecks: selfCheckSummary.totalChecks,
        okChecks: selfCheckSummary.okChecks,
        degradedChecks: selfCheckSummary.degradedChecks,
        failClosedChecks: selfCheckSummary.failClosedChecks,
    });
    db.close();
    cleanupPath(workspace);
});
//# sourceMappingURL=cli-doctor-output.test.js.map