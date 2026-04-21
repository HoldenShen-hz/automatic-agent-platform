import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class DeadLetterQueueService {
    records = new Map();
    enqueue(input) {
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
        this.records.set(record.deadLetterId, record);
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
        this.records.set(deadLetterId, updated);
        return updated;
    }
    markResolved(deadLetterId) {
        const record = this.getRequired(deadLetterId);
        const updated = { ...record, status: "resolved", nextRetryAt: null, updatedAt: nowIso() };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    discard(deadLetterId, reason) {
        const record = this.getRequired(deadLetterId);
        const updated = { ...record, status: "discarded", errorCode: reason, nextRetryAt: null, updatedAt: nowIso() };
        this.records.set(deadLetterId, updated);
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
        this.records.set(deadLetterId, updated);
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
        this.records.set(deadLetterId, updated);
        return updated;
    }
    listByConsumer(consumerId) {
        return [...this.records.values()].filter((record) => record.consumerId === consumerId);
    }
    listAll() {
        return [...this.records.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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
        const record = this.records.get(deadLetterId);
        if (record == null) {
            throw new ValidationError(`dlq.not_found:${deadLetterId}`, `Dead-letter record ${deadLetterId} was not found.`);
        }
        return record;
    }
}
//# sourceMappingURL=index.js.map