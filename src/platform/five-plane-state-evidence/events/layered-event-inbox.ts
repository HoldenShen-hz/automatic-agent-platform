import { ValidationError } from "../../contracts/errors.js";
import {
  isOapeflirViewEvent,
  isPlatformFactEvent,
  type EventEnvelope,
} from "../../contracts/executable-contracts/index.js";

export type EventConsumerKind = "truth" | "projection" | "audit";

export interface EventInboxConsumer {
  readonly consumerId: string;
  readonly kind: EventConsumerKind;
}

export interface EventInboxRecord {
  readonly event: EventEnvelope;
  readonly appendedAt: string;
}

export interface LayeredEventInboxRepository {
  registerConsumer(consumer: EventInboxConsumer): void;
  getConsumer(consumerId: string): EventInboxConsumer | null;
  getCursor(consumerId: string): number;
  setCursor(consumerId: string, cursor: number): void;
  append(record: EventInboxRecord): void;
  listRecords(): readonly EventInboxRecord[];
  size(): number;
  compact(maxRecords: number, retentionRatio: number): number;
}

export class InMemoryLayeredEventInboxRepository implements LayeredEventInboxRepository {
  private readonly records: EventInboxRecord[] = [];
  private readonly consumers = new Map<string, EventInboxConsumer>();
  private readonly cursors = new Map<string, number>();

  public registerConsumer(consumer: EventInboxConsumer): void {
    this.consumers.set(consumer.consumerId, consumer);
    if (!this.cursors.has(consumer.consumerId)) {
      this.cursors.set(consumer.consumerId, 0);
    }
  }

  public getConsumer(consumerId: string): EventInboxConsumer | null {
    return this.consumers.get(consumerId) ?? null;
  }

  public getCursor(consumerId: string): number {
    return this.cursors.get(consumerId) ?? 0;
  }

  public setCursor(consumerId: string, cursor: number): void {
    this.cursors.set(consumerId, cursor);
  }

  public append(record: EventInboxRecord): void {
    this.records.push(record);
  }

  public listRecords(): readonly EventInboxRecord[] {
    return this.records;
  }

  public size(): number {
    return this.records.length;
  }

  public compact(maxRecords: number, retentionRatio: number): number {
    if (this.records.length <= maxRecords) {
      return 0;
    }
    let minCursor = this.records.length;
    for (const cursor of this.cursors.values()) {
      if (cursor < minCursor) {
        minCursor = cursor;
      }
    }
    const retainCount = Math.ceil(maxRecords * retentionRatio);
    const cutoffIndex = Math.max(minCursor, this.records.length - retainCount);
    if (cutoffIndex <= 0 || cutoffIndex > this.records.length) {
      return 0;
    }
    this.records.splice(0, cutoffIndex);
    for (const [consumerId, cursor] of this.cursors.entries()) {
      if (cursor >= cutoffIndex) {
        this.cursors.set(consumerId, cursor - cutoffIndex);
      } else {
        this.cursors.set(consumerId, 0);
      }
    }
    return cutoffIndex;
  }
}

export class LayeredEventInbox {
  /** Maximum records to retain before compaction kicks in */
  private static readonly MAX_RECORDS = 10_000;
  /** Ratio of records to retain after compaction (50%) */
  private static readonly COMPACTION_RETENTION_RATIO = 0.5;

  public constructor(
    private readonly repository: LayeredEventInboxRepository = new InMemoryLayeredEventInboxRepository(),
  ) {}

  public registerConsumer(consumer: EventInboxConsumer): void {
    if (consumer.consumerId.trim().length === 0) {
      throw new ValidationError("event_inbox.consumer_id_required", "EventInbox consumerId is required.");
    }
    this.repository.registerConsumer(consumer);
  }

  public append(event: EventEnvelope, appendedAt = new Date(Date.now()).toISOString()): void {
    if (!isPlatformFactEvent(event) && !isOapeflirViewEvent(event)) {
      // Also accept legacy event types (task:*, workflow:*, dispatch:*, etc.) that predate the
      // v4.3 platform fact namespace. These are still used throughout the system.
      if (!isLegacyEventType(event.eventType)) {
        throw new ValidationError(
          "event_inbox.unsupported_event_namespace",
          "EventInbox only accepts v4.3 platform facts or OAPEFLIR view events.",
        );
      }
    }
    this.repository.append({ event, appendedAt });
    this.repository.compact(
      LayeredEventInbox.MAX_RECORDS,
      LayeredEventInbox.COMPACTION_RETENTION_RATIO,
    );
  }

  public compact(): number {
    return this.repository.compact(0, 0);
  }

  public peek(consumerId: string): readonly EventEnvelope[] {
    const consumer = this.requireConsumer(consumerId);
    const cursor = this.repository.getCursor(consumerId);
    return this.repository
      .listRecords()
      .slice(cursor)
      .map((record) => record.event)
      .filter((event) => canConsumerReceive(consumer, event));
  }

  public drain(consumerId: string, limit = Number.POSITIVE_INFINITY): readonly EventEnvelope[] {
    if (limit <= 0) {
      return [];
    }
    const consumer = this.requireConsumer(consumerId);
    const cursor = this.repository.getCursor(consumerId);
    const records = this.repository.listRecords();
    const delivered: EventEnvelope[] = [];
    let nextCursor = cursor;

    for (let index = cursor; index < records.length; index += 1) {
      const record = records[index];
      if (record == null) {
        continue;
      }
      nextCursor = index + 1;
      if (canConsumerReceive(consumer, record.event)) {
        delivered.push(record.event);
      }
      if (delivered.length >= limit) {
        break;
      }
    }

    this.repository.setCursor(consumerId, nextCursor);
    return delivered;
  }

  public size(): number {
    return this.repository.size();
  }

  private requireConsumer(consumerId: string): EventInboxConsumer {
    const consumer = this.repository.getConsumer(consumerId);
    if (consumer == null) {
      throw new ValidationError("event_inbox.consumer_not_registered", "EventInbox consumer is not registered.");
    }
    return consumer;
  }
}

export function canConsumerReceive(consumer: EventInboxConsumer, event: EventEnvelope): boolean {
  if (consumer.kind === "truth") {
    return isPlatformFactEvent(event);
  }
  if (consumer.kind === "projection") {
    return isPlatformFactEvent(event) || isOapeflirViewEvent(event);
  }
  return true;
}

/**
 * Checks if an event type is a legacy event type (pre-v4.3) that predates the
 * platform.* namespace. Legacy events like task:status_changed, workflow:step_completed,
 * etc. are still used throughout the system.
 */
function isLegacyEventType(eventType: string): boolean {
  // Legacy event types that predate v4.3 - these are still used for task/workflow/execution lifecycle
  return (
    eventType.startsWith("task:") ||
    eventType.startsWith("workflow:") ||
    eventType.startsWith("execution:") ||
    eventType.startsWith("session:") ||
    eventType.startsWith("division:") ||
    eventType.startsWith("subtask:") ||
    eventType.startsWith("decision:") ||
    eventType.startsWith("cost:") ||
    eventType.startsWith("dispatch:") ||
    eventType.startsWith("worker:") ||
    eventType.startsWith("takeover:") ||
    eventType.startsWith("recovery:") ||
    eventType.startsWith("stream:") ||
    eventType.startsWith("config.") ||
    eventType.startsWith("domain:") ||
    eventType.startsWith("plugin:") ||
    eventType.startsWith("skill:") ||
    eventType.startsWith("knowledge:") ||
    eventType.startsWith("learning:") ||
    eventType.startsWith("ux:") ||
    eventType.startsWith("observe:") ||
    eventType.startsWith("assess:") ||
    eventType.startsWith("plan:") ||
    eventType.startsWith("execute:") ||
    eventType.startsWith("feedback:") ||
    eventType.startsWith("learn:") ||
    eventType.startsWith("improve:") ||
    eventType.startsWith("release:") ||
    eventType.startsWith("oapeflir.") ||
    eventType.startsWith("run.") ||
    eventType.startsWith("perf:")
  );
}
