import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { decorateAuthoritativeTaskStore, getAuthoritativeTaskStoreDecoratorMetricsSnapshot, resetAuthoritativeTaskStoreDecoratorMetrics, } from "../../../../../src/platform/state-evidence/truth/repositories/authoritative-task-store-decorator.js";
test.beforeEach(() => {
    resetAuthoritativeTaskStoreDecoratorMetrics();
});
test("authoritative task store decorator retries SQLITE_BUSY failures and returns the underlying result", () => {
    let attempts = 0;
    const store = {
        listTasks() {
            attempts += 1;
            if (attempts === 1) {
                throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
            }
            return ["task-1"];
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, {
        maxRetryAttempts: 2,
        baseRetryDelayMs: 0,
        logger: new StructuredLogger({ retentionLimit: 10 }),
    });
    assert.deepEqual(decorated.listTasks(), ["task-1"]);
    assert.equal(attempts, 2);
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(metrics.listTasks?.calls, 1);
    assert.equal(metrics.listTasks?.retries, 1);
    assert.equal(metrics.listTasks?.successes, 1);
    assert.equal(metrics.listTasks?.failures, 0);
    assert.equal(metrics.listTasks?.lastAttemptCount, 2);
});
test("authoritative task store decorator records failed operations", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const store = {
        listTasks() {
            throw new Error("boom");
        },
    };
    const decorated = decorateAuthoritativeTaskStore(store, { logger });
    assert.throws(() => decorated.listTasks(), /boom/);
    const entry = logger.recent(1)[0];
    assert.equal(entry?.message, "authoritative_task_store.operation_failed");
    assert.equal(entry?.data?.operation, "listTasks");
    const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
    assert.equal(metrics.listTasks?.calls, 1);
    assert.equal(metrics.listTasks?.failures, 1);
    assert.equal(metrics.listTasks?.successes, 0);
});
//# sourceMappingURL=phase1a-store-decorator.test.js.map