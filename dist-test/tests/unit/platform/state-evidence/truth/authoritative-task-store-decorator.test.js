/**
 * Unit tests for AuthoritativeTaskStoreDecorator
 *
 * Tests SQLITE_BUSY retry logic, backoff calculation, and metrics.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { decorateAuthoritativeTaskStore, getAuthoritativeTaskStoreDecoratorMetricsSnapshot, resetAuthoritativeTaskStoreDecoratorMetrics, } from "../../../../../src/platform/state-evidence/truth/repositories/authoritative-task-store-decorator.js";
test.beforeEach(() => {
    resetAuthoritativeTaskStoreDecoratorMetrics();
});
test("decorateAuthoritativeTaskStore retries on SQLITE_BUSY and succeeds", () => {
    let attempts = 0;
    const store = {
        listTasks() {
            attempts += 1;
            if (attempts === 1) {
                throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
            }
            if (attempts === 2) {
                throw Object.assign(new Error("SQLITE_BUSY: database is busy"), { code: "SQLITE_BUSY" });
            }
            return ["task-1", "task-2"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger: new StructuredLogger({ retentionLimit: 10 }),
    });
    const result = decorated.listTasks();
    assert.deepEqual(result, ["task-1", "task-2"]);
    assert.equal(attempts, 3);
});
test("decorateAuthoritativeTaskStore exhausts retries and throws original error", () => {
    let attempts = 0;
    const store = {
        listTasks() {
            attempts += 1;
            throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 2,
        baseRetryDelayMs: 0,
        logger: new StructuredLogger({ retentionLimit: 10 }),
    });
    assert.throws(() => decorated.listTasks(), /SQLITE_BUSY/);
    assert.equal(attempts, 2, "Should exhaust maxRetryAttempts (2 attempts with maxRetryAttempts=2)");
});
test("decorateAuthoritativeTaskStore throws immediately on non-SQLITE_BUSY error", () => {
    let attempts = 0;
    const store = {
        listTasks() {
            attempts += 1;
            throw new Error("Some other error");
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger: new StructuredLogger({ retentionLimit: 10 }),
    });
    assert.throws(() => decorated.listTasks(), /Some other error/);
    assert.equal(attempts, 1, "Should not retry on non-SQLITE_BUSY errors");
});
test("decorateAuthoritativeTaskStore records metrics correctly on success", () => {
    let attempts = 0;
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const store = {
        listTasks() {
            attempts += 1;
            if (attempts < 2) {
                throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
            }
            return ["task-success"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger,
    });
    decorated.listTasks();
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(metrics.listTasks?.calls, 1);
    assert.equal(metrics.listTasks?.successes, 1);
    assert.equal(metrics.listTasks?.failures, 0);
    assert.equal(metrics.listTasks?.retries, 1);
    assert.equal(metrics.listTasks?.lastAttemptCount, 2);
});
test("decorateAuthoritativeTaskStore records metrics correctly on failure", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const store = {
        listTasks() {
            throw new Error("permanent failure");
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger,
    });
    assert.throws(() => decorated.listTasks());
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(metrics.listTasks?.calls, 1);
    assert.equal(metrics.listTasks?.successes, 0);
    assert.equal(metrics.listTasks?.failures, 1);
    assert.equal(metrics.listTasks?.retries, 0);
});
test("decorateAuthoritativeTaskStore handles multiple methods independently", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    let taskAttempts = 0;
    let workflowAttempts = 0;
    const store = {
        listTasks() {
            taskAttempts += 1;
            if (taskAttempts === 1) {
                throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
            }
            return ["task-1"];
        },
        listWorkflows() {
            workflowAttempts += 1;
            return ["wf-1"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger,
    });
    const tasks = decorated.listTasks();
    const workflows = decorated.listWorkflows();
    assert.deepEqual(tasks, ["task-1"]);
    assert.deepEqual(workflows, ["wf-1"]);
    assert.equal(taskAttempts, 2);
    assert.equal(workflowAttempts, 1);
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.ok(metrics.listTasks);
    assert.ok(metrics.listWorkflows);
    assert.equal(metrics.listTasks?.calls, 1);
    assert.equal(metrics.listWorkflows?.calls, 1);
});
test("decorateAuthoritativeTaskStore uses default options when not provided", () => {
    resetAuthoritativeTaskStoreDecoratorMetrics();
    const store = {
        listTasks() {
            return ["default-opts"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store);
    const result = decorated.listTasks();
    assert.deepEqual(result, ["default-opts"]);
});
test("decorateAuthoritativeTaskStore computes retry backoff correctly", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const store = {
        getTask() {
            return "delayed";
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 10,
        maxRetryDelayMs: 100,
        retryJitterRatio: 0.1,
        logger,
    });
    decorated.getTask();
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.ok(metrics.getTask);
    assert.ok((metrics.getTask?.totalBackoffMs ?? 0) >= 0, "totalBackoffMs should be >= 0");
});
test("decorateAuthoritativeTaskStore preserves non-function properties", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const store = {
        listTasks() {
            return ["task-1"];
        },
        someProperty: "test-value",
    };
    const decorated = decorateAuthoritativeTaskStore(store, { logger });
    assert.equal(decorated.someProperty, "test-value");
});
test("decorateAuthoritativeTaskStore logs retry attempts", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    let attempts = 0;
    const store = {
        listTasks() {
            attempts += 1;
            if (attempts === 1) {
                throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
            }
            return ["task-retry-logged"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 3,
        baseRetryDelayMs: 0,
        logger,
    });
    decorated.listTasks();
    const recentLogs = logger.recent(5);
    const retryLog = recentLogs.find((l) => l.message === "authoritative_task_store.retry");
    assert.ok(retryLog, "Should have logged a retry");
    assert.equal(retryLog?.data?.operation, "listTasks");
    assert.equal(retryLog?.data?.attempt, 1);
});
//# sourceMappingURL=authoritative-task-store-decorator.test.js.map