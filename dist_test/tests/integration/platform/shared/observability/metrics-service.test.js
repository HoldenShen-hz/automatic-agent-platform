import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("metrics service produces a complete summary from a real database with tasks, executions, and cost events", () => {
    const workspace = createTempWorkspace("aa-metrics-integration-");
    const dbPath = join(workspace, "metrics.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const executionId = newId("exec");
        seedTaskAndExecution(db, store, { taskId, executionId });
        // Insert cost events with different budget scopes
        const now = nowIso();
        store.insertCostEvent({
            id: newId("cost"),
            taskId,
            sessionId: null,
            executionId,
            agentId: null,
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            inputTokens: 1000,
            outputTokens: 500,
            costUsd: 0.015,
            budgetScope: "task_execution",
            providerRequestId: null,
            pricingVersion: null,
            createdAt: now,
        });
        store.insertCostEvent({
            id: newId("cost"),
            taskId,
            sessionId: null,
            executionId: null,
            agentId: null,
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            inputTokens: 200,
            outputTokens: 100,
            costUsd: 0.003,
            budgetScope: "compaction",
            providerRequestId: null,
            pricingVersion: null,
            createdAt: now,
        });
        // Insert step output
        store.insertStepOutput({
            id: newId("step"),
            taskId,
            stepId: "analyze_request",
            roleId: "general_executor",
            status: "succeeded",
            dataJson: JSON.stringify({ summary: "done", result: "ok" }),
            summary: "Step completed",
            artifactsJson: null,
            tokenCost: 50,
            durationMs: 800,
            validationJson: null,
            producedAt: now,
        });
        // Insert a workflow state
        store.insertWorkflowState({
            taskId,
            divisionId: "general_ops",
            workflowId: "single_agent_minimal",
            currentStepIndex: 1,
            status: "completed",
            outputsJson: "{}",
            lastErrorCode: null,
            retryCount: 0,
            resumableFromStep: null,
            startedAt: now,
            updatedAt: now,
        });
        // Insert an event
        store.insertEvent({
            id: newId("evt"),
            taskId,
            executionId,
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: JSON.stringify({ fromStatus: "queued", toStatus: "in_progress" }),
            traceId: newId("trace"),
            createdAt: now,
        });
        const healthService = new HealthService(db, store, {
            memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
            eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
        });
        const metricsService = new MetricsService(db, healthService);
        const summary = metricsService.buildSummary();
        // Task metrics
        assert.equal(summary.taskMetrics.total, 1);
        assert.equal(summary.taskMetrics.activeCount, 1);
        // Workflow metrics
        assert.equal(summary.workflowMetrics.total, 1);
        assert.equal(summary.workflowMetrics.completedCount, 1);
        // Execution metrics
        assert.equal(summary.executionMetrics.total, 1);
        // Step metrics
        assert.equal(summary.stepMetrics.total, 1);
        assert.equal(summary.stepMetrics.totalTokenCost, 50);
        assert.equal(summary.stepMetrics.averageDurationMs, 800);
        // Event metrics
        assert.ok(summary.eventMetrics.total >= 1);
        assert.ok(summary.eventMetrics.tier1Count >= 1);
        // Runtime metrics
        assert.ok(typeof summary.runtimeMetrics.status === "string");
        assert.ok(typeof summary.runtimeMetrics.degradationMode === "string");
        // Window
        assert.ok(summary.window.firstTaskCreatedAt != null);
        assert.ok(summary.window.lastTaskUpdatedAt != null);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("metrics service handles empty database gracefully", () => {
    const workspace = createTempWorkspace("aa-metrics-empty-");
    const dbPath = join(workspace, "metrics-empty.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const healthService = new HealthService(db, store, {
            memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
            eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
        });
        const metricsService = new MetricsService(db, healthService);
        const summary = metricsService.buildSummary();
        assert.equal(summary.taskMetrics.total, 0);
        assert.equal(summary.taskMetrics.successRate, 0);
        assert.equal(summary.workflowMetrics.total, 0);
        assert.equal(summary.executionMetrics.total, 0);
        assert.equal(summary.stepMetrics.total, 0);
        assert.equal(summary.stepMetrics.averageDurationMs, null);
        assert.equal(summary.costMetrics.totalActualCostUsd, 0);
        assert.equal(summary.eventMetrics.total, 0);
        assert.equal(summary.window.firstTaskCreatedAt, null);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=metrics-service.test.js.map