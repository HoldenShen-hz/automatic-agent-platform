import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryDeadLetterQueueRepository, DeadLetterQueueService, DeadLetterQueueRetryWorker, } from "../../../../../src/platform/state-evidence/dlq/index.js";
test("DeadLetterStatus type has all expected values", () => {
    const values = ["pending", "retrying", "discarded", "resolved"];
    assert.deepEqual(values, ["pending", "retrying", "discarded", "resolved"]);
});
test("DeadLetterRecord structure", () => {
    const record = {
        deadLetterId: "dlq_abc123",
        sourceEventId: "evt_xyz",
        consumerId: "consumer_1",
        errorCode: "dlq.connection_timeout",
        payloadJson: '{"taskId":"task_123"}',
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdAt: "2026-04-26T00:00:00Z",
        updatedAt: "2026-04-26T00:00:00Z",
        originalTimestamp: null,
        failureCategory: null,
        retryExhaustedAt: null,
    };
    assert.equal(record.deadLetterId, "dlq_abc123");
    assert.equal(record.status, "pending");
    assert.equal(record.retryCount, 0);
});
test("DeadLetterQueueSummary structure", () => {
    const summary = {
        totalRecords: 10,
        statusCounts: { pending: 5, retrying: 2, discarded: 1, resolved: 2 },
        consumerCounts: { consumer_1: 7, consumer_2: 3 },
        pendingConsumers: ["consumer_1", "consumer_2"],
        maxRetryCount: 5,
    };
    assert.equal(summary.totalRecords, 10);
    assert.equal(summary.statusCounts.pending, 5);
    assert.deepEqual(summary.pendingConsumers, ["consumer_1", "consumer_2"]);
});
test("InMemoryDeadLetterQueueRepository insert and findById", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const record = {
        deadLetterId: "dlq_test_1",
        sourceEventId: "evt_1",
        consumerId: "consumer_a",
        errorCode: "test.error",
        payloadJson: "{}",
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdAt: "2026-04-26T00:00:00Z",
        updatedAt: "2026-04-26T00:00:00Z",
        originalTimestamp: null,
        failureCategory: null,
        retryExhaustedAt: null,
    };
    repo.insert(record);
    const found = repo.findById("dlq_test_1");
    assert.notEqual(found, null);
    assert.equal(found.deadLetterId, "dlq_test_1");
});
test("InMemoryDeadLetterQueueRepository update throws for missing record", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const record = {
        deadLetterId: "dlq_nonexistent",
        sourceEventId: "evt_1",
        consumerId: "consumer_a",
        errorCode: "test.error",
        payloadJson: "{}",
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdAt: "2026-04-26T00:00:00Z",
        updatedAt: "2026-04-26T00:00:00Z",
        originalTimestamp: null,
        failureCategory: null,
        retryExhaustedAt: null,
    };
    assert.throws(() => repo.update(record), /not found/);
});
test("InMemoryDeadLetterQueueRepository update modifies record", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const record = {
        deadLetterId: "dlq_update_test",
        sourceEventId: "evt_1",
        consumerId: "consumer_a",
        errorCode: "test.error",
        payloadJson: "{}",
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        createdAt: "2026-04-26T00:00:00Z",
        updatedAt: "2026-04-26T00:00:00Z",
        originalTimestamp: null,
        failureCategory: null,
        retryExhaustedAt: null,
    };
    repo.insert(record);
    const updated = { ...record, status: "resolved", updatedAt: "2026-04-26T12:00:00Z" };
    repo.update(updated);
    const found = repo.findById("dlq_update_test");
    assert.equal(found.status, "resolved");
});
test("InMemoryDeadLetterQueueRepository listAll sorts by createdAt", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const now = "2026-04-26T00:00:00Z";
    repo.insert({ deadLetterId: "dlq_2", sourceEventId: "e2", consumerId: "c", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: "2026-04-26T02:00:00Z", updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    repo.insert({ deadLetterId: "dlq_1", sourceEventId: "e1", consumerId: "c", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: "2026-04-26T01:00:00Z", updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    const all = repo.listAll();
    assert.equal(all[0].deadLetterId, "dlq_1");
    assert.equal(all[1].deadLetterId, "dlq_2");
});
test("InMemoryDeadLetterQueueRepository listByConsumer filters correctly", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const now = "2026-04-26T00:00:00Z";
    repo.insert({ deadLetterId: "dlq_a1", sourceEventId: "e1", consumerId: "consumer_a", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    repo.insert({ deadLetterId: "dlq_b1", sourceEventId: "e2", consumerId: "consumer_b", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    repo.insert({ deadLetterId: "dlq_a2", sourceEventId: "e3", consumerId: "consumer_a", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    const aRecords = repo.listByConsumer("consumer_a");
    assert.equal(aRecords.length, 2);
    const bRecords = repo.listByConsumer("consumer_b");
    assert.equal(bRecords.length, 1);
});
test("InMemoryDeadLetterQueueRepository listRetryable filters correctly", () => {
    const repo = new InMemoryDeadLetterQueueRepository();
    const now = "2026-04-26T00:00:00Z";
    const futureTime = "2026-04-27T00:00:00Z";
    // Not retrying - should not appear
    repo.insert({ deadLetterId: "dlq_1", sourceEventId: "e1", consumerId: "c", errorCode: "e", payloadJson: "{}", status: "pending", retryCount: 0, nextRetryAt: null, createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    // Retryable but nextRetryAt is in future
    repo.insert({ deadLetterId: "dlq_2", sourceEventId: "e2", consumerId: "c", errorCode: "e", payloadJson: "{}", status: "retrying", retryCount: 1, nextRetryAt: futureTime, createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    // Retryable and nextRetryAt is in past - should appear
    repo.insert({ deadLetterId: "dlq_3", sourceEventId: "e3", consumerId: "c", errorCode: "e", payloadJson: "{}", status: "retrying", retryCount: 1, nextRetryAt: "2026-04-25T00:00:00Z", createdAt: now, updatedAt: now, originalTimestamp: null, failureCategory: null, retryExhaustedAt: null });
    const retryable = repo.listRetryable(now);
    assert.equal(retryable.length, 1);
    assert.equal(retryable[0].deadLetterId, "dlq_3");
});
test("DeadLetterQueueService enqueue creates new record", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_new",
        consumerId: "consumer_new",
        errorCode: "test.new_error",
        payloadJson: '{"data":"value"}',
    });
    assert.equal(record.sourceEventId, "evt_new");
    assert.equal(record.consumerId, "consumer_new");
    assert.equal(record.status, "pending");
    assert.equal(record.retryCount, 0);
});
test("DeadLetterQueueService enqueue returns existing for duplicate sourceEventId+consumerId", () => {
    const service = new DeadLetterQueueService();
    const first = service.enqueue({
        sourceEventId: "evt_dup",
        consumerId: "consumer_dup",
        errorCode: "test.dup",
        payloadJson: "{}",
    });
    const second = service.enqueue({
        sourceEventId: "evt_dup",
        consumerId: "consumer_dup",
        errorCode: "test.dup2",
        payloadJson: "{}",
    });
    assert.equal(first.deadLetterId, second.deadLetterId);
});
test("DeadLetterQueueService scheduleRetry validates delay", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_retry",
        consumerId: "consumer_retry",
        errorCode: "test.retry",
        payloadJson: "{}",
    });
    assert.throws(() => service.scheduleRetry(record.deadLetterId, -1), (err) => err.code === "dlq.invalid_retry_delay");
    assert.throws(() => service.scheduleRetry(record.deadLetterId, Infinity), (err) => err.code === "dlq.invalid_retry_delay");
    assert.throws(() => service.scheduleRetry(record.deadLetterId, NaN), (err) => err.code === "dlq.invalid_retry_delay");
});
test("DeadLetterQueueService scheduleRetry updates record", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_sched",
        consumerId: "consumer_sched",
        errorCode: "test.sched",
        payloadJson: "{}",
    });
    const updated = service.scheduleRetry(record.deadLetterId, 60000);
    assert.equal(updated.status, "retrying");
    assert.equal(updated.retryCount, 1);
    assert.notEqual(updated.nextRetryAt, null);
});
test("DeadLetterQueueService markResolved", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_resolve",
        consumerId: "consumer_resolve",
        errorCode: "test.resolve",
        payloadJson: "{}",
    });
    const updated = service.markResolved(record.deadLetterId);
    assert.equal(updated.status, "resolved");
    assert.equal(updated.nextRetryAt, null);
});
test("DeadLetterQueueService discard", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_discard",
        consumerId: "consumer_discard",
        errorCode: "test.discard",
        payloadJson: "{}",
    });
    const updated = service.discard(record.deadLetterId, "user initiated discard");
    assert.equal(updated.status, "discarded");
    assert.equal(updated.errorCode, "user initiated discard");
});
test("DeadLetterQueueService markRetryExhausted sets timestamps", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_exhausted",
        consumerId: "consumer_exhausted",
        errorCode: "test.exhausted",
        payloadJson: "{}",
    });
    const updated = service.markRetryExhausted(record.deadLetterId);
    assert.equal(updated.status, "pending");
    assert.notEqual(updated.retryExhaustedAt, null);
});
test("DeadLetterQueueService setFailureCategory", () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_category",
        consumerId: "consumer_category",
        errorCode: "test.category",
        payloadJson: "{}",
    });
    const updated = service.setFailureCategory(record.deadLetterId, "network.timeout");
    assert.equal(updated.failureCategory, "network.timeout");
});
test("DeadLetterQueueService get returns null for missing", () => {
    const service = new DeadLetterQueueService();
    const result = service.get("nonexistent_dlq");
    assert.equal(result, null);
});
test("DeadLetterQueueService listAll and listByConsumer", () => {
    const service = new DeadLetterQueueService();
    service.enqueue({ sourceEventId: "e1", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    service.enqueue({ sourceEventId: "e2", consumerId: "c2", errorCode: "e", payloadJson: "{}" });
    service.enqueue({ sourceEventId: "e3", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    assert.equal(service.listAll().length, 3);
    assert.equal(service.listByConsumer("c1").length, 2);
});
test("DeadLetterQueueService summarize returns correct counts", () => {
    const service = new DeadLetterQueueService();
    service.enqueue({ sourceEventId: "e1", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    service.enqueue({ sourceEventId: "e2", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    service.enqueue({ sourceEventId: "e3", consumerId: "c2", errorCode: "e", payloadJson: "{}" });
    const summary = service.summarize();
    assert.equal(summary.totalRecords, 3);
    assert.equal(summary.statusCounts.pending, 3);
    assert.equal(summary.consumerCounts["c1"], 2);
    assert.equal(summary.consumerCounts["c2"], 1);
});
test("DeadLetterQueueService summarize with mixed statuses", () => {
    const service = new DeadLetterQueueService();
    service.enqueue({ sourceEventId: "e1", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    const record2 = service.enqueue({ sourceEventId: "e2", consumerId: "c1", errorCode: "e", payloadJson: "{}" });
    service.markResolved(record2.deadLetterId);
    const summary = service.summarize();
    assert.equal(summary.totalRecords, 2);
    assert.equal(summary.statusCounts.pending, 1);
    assert.equal(summary.statusCounts.resolved, 1);
});
test("DeadLetterQueueService throws for missing record on operations", () => {
    const service = new DeadLetterQueueService();
    assert.throws(() => service.scheduleRetry("nonexistent", 1000), /not found/);
    assert.throws(() => service.markResolved("nonexistent"), /not found/);
    assert.throws(() => service.discard("nonexistent", "reason"), /not found/);
});
test("DeadLetterQueueRetryWorkerResult structure", () => {
    const result = {
        attempted: 5,
        resolved: 2,
        rescheduled: 2,
        failed: 1,
    };
    assert.equal(result.attempted, 5);
    assert.equal(result.resolved, 2);
    assert.equal(result.rescheduled, 2);
    assert.equal(result.failed, 1);
});
test("DeadLetterQueueRetryWorker runDueRetries processes records", async () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_worker",
        consumerId: "consumer_worker",
        errorCode: "test.worker",
        payloadJson: "{}",
    });
    service.scheduleRetry(record.deadLetterId, 0); // Immediate retry
    const worker = new DeadLetterQueueRetryWorker(service);
    const result = await worker.runDueRetries((rec) => ({
        outcome: "resolved",
    }));
    assert.equal(result.attempted, 1);
    assert.equal(result.resolved, 1);
    assert.equal(result.rescheduled, 0);
    assert.equal(result.failed, 0);
});
test("DeadLetterQueueRetryWorker reschedules on retry outcome", async () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_resched",
        consumerId: "consumer_resched",
        errorCode: "test.resched",
        payloadJson: "{}",
    });
    service.scheduleRetry(record.deadLetterId, 0);
    const worker = new DeadLetterQueueRetryWorker(service);
    const result = await worker.runDueRetries((rec) => ({
        outcome: "retry",
        delayMs: 5000,
    }));
    assert.equal(result.attempted, 1);
    assert.equal(result.resolved, 0);
    assert.equal(result.rescheduled, 1);
});
test("DeadLetterQueueRetryWorker handles thrown retry function", async () => {
    const service = new DeadLetterQueueService();
    const record = service.enqueue({
        sourceEventId: "evt_error",
        consumerId: "consumer_error",
        errorCode: "test.error",
        payloadJson: "{}",
    });
    service.scheduleRetry(record.deadLetterId, 0);
    const worker = new DeadLetterQueueRetryWorker(service);
    const result = await worker.runDueRetries(async () => {
        throw new Error("Simulated failure");
    });
    assert.equal(result.attempted, 1);
    assert.equal(result.failed, 1);
});
test("DeadLetterQueueRetryWorker runDueRetries with no records", async () => {
    const service = new DeadLetterQueueService();
    const worker = new DeadLetterQueueRetryWorker(service);
    const result = await worker.runDueRetries(() => ({ outcome: "resolved" }));
    assert.equal(result.attempted, 0);
    assert.equal(result.resolved, 0);
    assert.equal(result.rescheduled, 0);
    assert.equal(result.failed, 0);
});
//# sourceMappingURL=dlq.test.js.map