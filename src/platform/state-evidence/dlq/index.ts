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
}

export class DeadLetterQueueService {
  private readonly records = new Map<string, DeadLetterRecord>();

  public enqueue(input: {
    sourceEventId: string;
    consumerId: string;
    errorCode: string;
    payloadJson: string;
  }): DeadLetterRecord {
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
    };
    this.records.set(record.deadLetterId, record);
    return record;
  }

  public scheduleRetry(deadLetterId: string, delayMs: number): DeadLetterRecord {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
    }
    const record = this.getRequired(deadLetterId);
    const now = nowIso();
    const updated: DeadLetterRecord = {
      ...record,
      status: "retrying",
      retryCount: record.retryCount + 1,
      nextRetryAt: new Date(Date.parse(now) + delayMs).toISOString(),
      updatedAt: now,
    };
    this.records.set(deadLetterId, updated);
    return updated;
  }

  public markResolved(deadLetterId: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated = { ...record, status: "resolved" as const, nextRetryAt: null, updatedAt: nowIso() };
    this.records.set(deadLetterId, updated);
    return updated;
  }

  public discard(deadLetterId: string, reason: string): DeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const updated = { ...record, status: "discarded" as const, errorCode: reason, nextRetryAt: null, updatedAt: nowIso() };
    this.records.set(deadLetterId, updated);
    return updated;
  }

  public listByConsumer(consumerId: string): DeadLetterRecord[] {
    return [...this.records.values()].filter((record) => record.consumerId === consumerId);
  }

  private getRequired(deadLetterId: string): DeadLetterRecord {
    const record = this.records.get(deadLetterId);
    if (record == null) {
      throw new ValidationError(`dlq.not_found:${deadLetterId}`, `Dead-letter record ${deadLetterId} was not found.`);
    }
    return record;
  }
}
