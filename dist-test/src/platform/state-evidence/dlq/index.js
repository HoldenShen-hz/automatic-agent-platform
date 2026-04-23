import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * In-memory implementation of DLQ repository for backward compatibility
 * and environments without persistent storage.
 */
export class InMemoryDeadLetterQueueRepository {
    records = new Map();
    insert(record) {
        this.records.set(record.deadLetterId, record);
    }
    findById(deadLetterId) {
        return this.records.get(deadLetterId) ?? null;
    }
    update(record) {
        if (!this.records.has(record.deadLetterId)) {
            throw new ValidationError(`dlq.not_found:${record.deadLetterId}`, `Dead-letter record ${record.deadLetterId} was not found.`);
        }
        this.records.set(record.deadLetterId, record);
    }
    listAll() {
        return [...this.records.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    listByConsumer(consumerId) {
        return [...this.records.values()].filter((record) => record.consumerId === consumerId);
    }
    listRetryable(asOf) {
        return [...this.records.values()]
            .filter((record) => record.status === "retrying" && record.nextRetryAt != null && record.nextRetryAt <= asOf)
            .sort((left, right) => left.nextRetryAt.localeCompare(right.nextRetryAt));
    }
}
export class DeadLetterQueueService {
    repo;
    /**
     * Create a DLQ service with an optional repository.
     * @param repo - Optional repository for persistence. Defaults to in-memory storage.
     */
    constructor(repo) {
        this.repo = repo ?? new InMemoryDeadLetterQueueRepository();
    }
    enqueue(input) {
        const existing = this.repo
            .listByConsumer(input.consumerId)
            .find((record) => record.sourceEventId === input.sourceEventId);
        if (existing != null) {
            return existing;
        }
        const now = nowIso();
        const record = {
            deadLetterId: newId("dlq"),
            sourceEventId: input.sourceEventId,
            consumerId: input.consumerId,
            errorCode: input.errorCode,
            payloadJson: input.payloadJson,
            status: "pending",
            retryCount: 0,
            nextRetryAt: null,
            createdAt: now,
            updatedAt: now,
            originalTimestamp: input.originalTimestamp ?? null,
            failureCategory: input.failureCategory ?? null,
            retryExhaustedAt: null,
        };
        this.repo.insert(record);
        return record;
    }
    scheduleRetry(deadLetterId, delayMs) {
        if (!Number.isFinite(delayMs) || delayMs < 0) {
            throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
        }
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const updated = {
            ...record,
            status: "retrying",
            retryCount: record.retryCount + 1,
            nextRetryAt: new Date(Date.parse(now) + delayMs).toISOString(),
            updatedAt: now,
        };
        this.repo.update(updated);
        return updated;
    }
    markResolved(deadLetterId) {
        const record = this.getRequired(deadLetterId);
        const updated = { ...record, status: "resolved", nextRetryAt: null, updatedAt: nowIso() };
        this.repo.update(updated);
        return updated;
    }
    discard(deadLetterId, reason) {
        const record = this.getRequired(deadLetterId);
        const updated = { ...record, status: "discarded", errorCode: reason, nextRetryAt: null, updatedAt: nowIso() };
        this.repo.update(updated);
        return updated;
    }
    /** §28: Mark a DLQ entry as retry-exhausted */
    markRetryExhausted(deadLetterId) {
        const record = this.getRequired(deadLetterId);
        const updated = {
            ...record,
            status: "pending",
            retryExhaustedAt: nowIso(),
            nextRetryAt: null,
            updatedAt: nowIso(),
        };
        this.repo.update(updated);
        return updated;
    }
    /** §28: Set failure category on a DLQ entry */
    setFailureCategory(deadLetterId, category) {
        const record = this.getRequired(deadLetterId);
        const updated = {
            ...record,
            failureCategory: category,
            updatedAt: nowIso(),
        };
        this.repo.update(updated);
        return updated;
    }
    listByConsumer(consumerId) {
        return this.repo.listByConsumer(consumerId);
    }
    listAll() {
        return this.repo.listAll();
    }
    get(deadLetterId) {
        return this.repo.findById(deadLetterId);
    }
    listRetryable(asOf = nowIso()) {
        return this.repo.listRetryable(asOf);
    }
    summarize() {
        const records = this.listAll();
        const statusCounts = {
            pending: 0,
            retrying: 0,
            discarded: 0,
            resolved: 0,
        };
        const consumerCounts = {};
        for (const record of records) {
            statusCounts[record.status] += 1;
            consumerCounts[record.consumerId] = (consumerCounts[record.consumerId] ?? 0) + 1;
        }
        return {
            totalRecords: records.length,
            statusCounts,
            consumerCounts,
            pendingConsumers: [...new Set(records.filter((record) => record.status === "pending" || record.status === "retrying").map((record) => record.consumerId))].sort(),
            maxRetryCount: records.reduce((max, record) => Math.max(max, record.retryCount), 0),
        };
    }
    getRequired(deadLetterId) {
        const record = this.repo.findById(deadLetterId);
        if (record == null) {
            throw new ValidationError(`dlq.not_found:${deadLetterId}`, `Dead-letter record ${deadLetterId} was not found.`);
        }
        return record;
    }
}
export class DeadLetterQueueRetryWorker {
    queue;
    constructor(queue) {
        this.queue = queue;
    }
    runDueRetries(retry, asOf = nowIso()) {
        return this.process(this.queue.listRetryable(asOf), retry);
    }
    async process(records, retry) {
        const result = {
            attempted: 0,
            resolved: 0,
            rescheduled: 0,
            failed: 0,
        };
        for (const record of records) {
            result.attempted += 1;
            try {
                const decision = await retry(record);
                if (decision.outcome === "resolved") {
                    this.queue.markResolved(record.deadLetterId);
                    result.resolved += 1;
                    continue;
                }
                this.queue.scheduleRetry(record.deadLetterId, decision.delayMs ?? 0);
                result.rescheduled += 1;
            }
            catch {
                result.failed += 1;
            }
        }
        return result;
    }
}
//# sourceMappingURL=index.js.map