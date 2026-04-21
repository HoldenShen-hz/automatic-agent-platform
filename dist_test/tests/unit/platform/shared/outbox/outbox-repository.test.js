/**
 * Unit tests for OutboxRepository
 */
import assert from "node:assert/strict";
import test from "node:test";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
function createMockConnection() {
    return {
        prepare: () => ({
            run: () => ({ changes: 1 }),
            get: () => null,
            all: () => [],
        }),
    };
}
test("OutboxRepository.insertOutboxEntry returns record with correct fields", () => {
    const conn = createMockConnection();
    const repo = new OutboxRepository(conn);
    const entry = repo.insertOutboxEntry("task", "task-123", "task:status_changed", '{"status":"running"}', "trace-abc", "2026-04-20T10:00:00Z");
    assert.equal(entry.aggregateType, "task");
    assert.equal(entry.aggregateId, "task-123");
    assert.equal(entry.eventType, "task:status_changed");
    assert.equal(entry.payloadJson, '{"status":"running"}');
    assert.equal(entry.traceId, "trace-abc");
    assert.equal(entry.createdAt, "2026-04-20T10:00:00Z");
    assert.equal(entry.publishedAt, null);
    assert.equal(entry.retryCount, 0);
    assert.equal(entry.lastError, null);
});
test("OutboxRepository.countPending returns count from query", () => {
    const conn = createMockConnection();
    const repo = new OutboxRepository(conn);
    const count = repo.countPending();
    assert.equal(count, 0);
});
test("OutboxRepository.countFailed returns count from query", () => {
    const conn = createMockConnection();
    const repo = new OutboxRepository(conn);
    const count = repo.countFailed();
    assert.equal(count, 0);
});
//# sourceMappingURL=outbox-repository.test.js.map