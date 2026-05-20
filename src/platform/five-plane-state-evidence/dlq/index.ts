import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export type DeadLetterStatus = "pending" | "retrying" | "discarded" | "resolved";

export interface DeadLetterRecord {
  deadLetterId: string;
  sourceEventId: string;
  consumerId: string;
  errorCode: string;
  payloadJson: string;
  status: DeadLetterStatus;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** §28: Original timestamp when the failed event occurred */
  originalTimestamp: string | null;
  /** §28: Category classification for the failure */
  failureCategory: string | null;
  /** §28: Timestamp when all retries were exhausted */
  retryExhaustedAt: string | null;
}

export interface DeadLetterQueueSummary {
  totalRecords: number;
  statusCounts: Record<DeadLetterStatus, number>;
  consumerCounts: Record<string, number>;
  pendingConsumers: string[];
  maxRetryCount: number;
}

/**
 * Repository interface for DLQ persistence.
 * Implementations can use SQLite, PostgreSQL, or in-memory storage.
 */
export interface DeadLetterQueueRepository {
  /** Insert a new DLQ record */
  insert(record: DeadLetterRecord): void;
  /** Find a DLQ record by ID */
  findById(deadLetterId: string): DeadLetterRecord | null;
  /** Update an existing DLQ record */
  update(record: DeadLetterRecord): void;
  /** List all DLQ records */
  listAll(): DeadLetterRecord[];
  /** List DLQ records by consumer ID */
  listByConsumer(consumerId: string): DeadLetterRecord[];
  /** List retryable DLQ records due by the specified instant */
  listRetryable(asOf: string): DeadLetterRecord[];
}

/**
 * In-memory implementation of DLQ repository for backward compatibility
 * and environments without persistent storage.
 */
export class InMemoryDeadLetterQueueRepository implements DeadLetterQueueRepository {
  private readonly records = new Map<string, DeadLetterRecord>();

  public insert(record: DeadLetterRecord): void {
    this.records.set(record.deadLetterId, record);
  }

  public findById(deadLetterId: string): DeadLetterRecord | null {
    return this.records.get(deadLetterId) ?? null;
  }

  public update(record: DeadLetterRecord): void {
    if (!this.records.has(record.deadLetterId)) {
      throw new ValidationError(`dlq.not_found:${record.deadLetterId}`, `Dead-letter record ${record.deadLetterId} was not found.`);
    }
    this.records.set(record.deadLetterId, record);
  }

  public listAll(): DeadLetterRecord[] {
    return [...this.records.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public listByConsumer(consumerId: string): DeadLetterRecord[] {
    return [...this.records.values()].filter((record) => record.consumerId === consumerId);
  }

  public listRetryable(asOf: string): DeadLetterRecord[] {
    return [...this.records.values()]
      .filter((record) => record.status === "retrying" && record.nextRetryAt != null && record.nextRetryAt <= asOf)
      .sort((left, right) => left.nextRetryAt!.localeCompare(right.nextRetryAt!));
  }
}

export class DeadLetterQueueService {
  private readonly repo: DeadLetterQueueRepository;
  private readonly maxRetries: number;

  /**
   * Create a DLQ service with an optional repository.
   * @param repo - Optional repository for persistence. Defaults to in-memory storage.
   */
  public constructor(repo?: DeadLetterQueueRepository, options: { maxRetries?: number } = {}) {
    this.repo = repo ?? new InMemoryDeadLetterQueueRepository();
    this.maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? 5));
  }

  public enqueue(input: {
    sourceEventId: string;
    consumerId: string;
    errorCode: string;
    payloadJson: string;
    originalTimestamp?: string | null;
    failureCategory?: string | null;
  }): DeadLetterRecord {
    const existing = this.repo
      .listByConsumer(input.consumerId)
      .find((record) => record.sourceEventId === input.sourceEventId);
    if (existing != null) {
      return existing;
    }
    const now = nowIso();
    const record: DeadLetterRecord = {
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

  public scheduleRetry(deadLetterId: string, delayMs: number): DeadLetterRecord {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
    }
    const record = this.getRequired(deadLetterId);
    if (record.retryExhaustedAt != null || record.retryCount >= this.maxRetries) {
      throw new ValidationError("dlq.retry_exhausted", "DLQ retry limit has been exhausted.");
    }
    const now = nowIso();
    const updated: DeadLetterRecord = {
      ...record,
      status: "retrying",
      retryCount: record.retryCount + 1,
      nextRetryAt: new Date(Date.parse(now) + delayMs).toISOString(),
      updatedAt: now,
    };
    this.repo.update(updated);
    return updated;
  }

  public markResolved(deadLetterId: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated = { ...record, status: "resolved" as const, nextRetryAt: null, updatedAt: nowIso() };
    this.repo.update(updated);
    return updated;
  }

  public discard(deadLetterId: string, reason: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated = { ...record, status: "discarded" as const, errorCode: reason, nextRetryAt: null, updatedAt: nowIso() };
    this.repo.update(updated);
    return updated;
  }

  /** §28: Mark a DLQ entry as retry-exhausted */
  public markRetryExhausted(deadLetterId: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated: DeadLetterRecord = {
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
  public setFailureCategory(deadLetterId: string, category: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated: DeadLetterRecord = {
      ...record,
      failureCategory: category,
      updatedAt: nowIso(),
    };
    this.repo.update(updated);
    return updated;
  }

  public listByConsumer(consumerId: string): DeadLetterRecord[] {
    return this.repo.listByConsumer(consumerId);
  }

  public listAll(): DeadLetterRecord[] {
    return this.repo.listAll();
  }

  public get(deadLetterId: string): DeadLetterRecord | null {
    return this.repo.findById(deadLetterId);
  }

  public listRetryable(asOf: string = nowIso()): DeadLetterRecord[] {
    return this.repo.listRetryable(asOf);
  }

  public summarize(): DeadLetterQueueSummary {
    const records = this.listAll();
    const statusCounts: Record<DeadLetterStatus, number> = {
      pending: 0,
      retrying: 0,
      discarded: 0,
      resolved: 0,
    };
    const consumerCounts: Record<string, number> = {};
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

  private getRequired(deadLetterId: string): DeadLetterRecord {
    const record = this.repo.findById(deadLetterId);
    if (record == null) {
      throw new ValidationError(`dlq.not_found:${deadLetterId}`, `Dead-letter record ${deadLetterId} was not found.`);
    }
    return record;
  }
}

export interface DeadLetterQueueRetryWorkerResult {
  attempted: number;
  resolved: number;
  rescheduled: number;
  failed: number;
}

export class DeadLetterQueueRetryWorker {
  public constructor(private readonly queue: DeadLetterQueueService) {}

  public runDueRetries(
    retry: (record: DeadLetterRecord) => { outcome: "resolved" | "retry"; delayMs?: number } | Promise<{ outcome: "resolved" | "retry"; delayMs?: number }>,
    asOf: string = nowIso(),
  ): Promise<DeadLetterQueueRetryWorkerResult> {
    return this.process(this.queue.listRetryable(asOf), retry);
  }

  private async process(
    records: readonly DeadLetterRecord[],
    retry: (record: DeadLetterRecord) => { outcome: "resolved" | "retry"; delayMs?: number } | Promise<{ outcome: "resolved" | "retry"; delayMs?: number }>,
  ): Promise<DeadLetterQueueRetryWorkerResult> {
    const result: DeadLetterQueueRetryWorkerResult = {
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
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }
}
