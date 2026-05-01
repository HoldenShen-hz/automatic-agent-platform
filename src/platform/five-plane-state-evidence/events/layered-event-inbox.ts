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

export class LayeredEventInbox {
  private readonly records: EventInboxRecord[] = [];
  private readonly consumers = new Map<string, EventInboxConsumer>();
  private readonly cursors = new Map<string, number>();

  // Root cause §191-2242: records array only grows (append) with no automatic pruning,
  // causing unbounded memory growth. Add threshold to trigger compaction automatically.
  private static readonly COMPACT_THRESHOLD = 10_000;

  public registerConsumer(consumer: EventInboxConsumer): void {
    if (consumer.consumerId.trim().length === 0) {
      throw new ValidationError("event_inbox.consumer_id_required", "EventInbox consumerId is required.");
    }
    this.consumers.set(consumer.consumerId, consumer);
    if (!this.cursors.has(consumer.consumerId)) {
      this.cursors.set(consumer.consumerId, 0);
    }
  }

  public append(event: EventEnvelope, appendedAt = new Date(Date.now()).toISOString()): void {
    if (!isPlatformFactEvent(event) && !isOapeflirViewEvent(event)) {
      throw new ValidationError(
        "event_inbox.unsupported_event_namespace",
        "EventInbox only accepts v4.3 platform facts or OAPEFLIR view events.",
      );
    }
    this.records.push({ event, appendedAt });
    // Root cause §191-2242 fix: Auto-compact when records exceed threshold to prevent memory leak.
    // Records array only grew without pruning, causing unbounded memory growth.
    if (this.records.length >= LayeredEventInbox.COMPACT_THRESHOLD) {
      this.compact();
    }
  }

  public peek(consumerId: string): readonly EventEnvelope[] {
    const consumer = this.requireConsumer(consumerId);
    const cursor = this.cursors.get(consumerId) ?? 0;
    return this.records.slice(cursor).map((record) => record.event).filter((event) => canConsumerReceive(consumer, event));
  }

  public drain(consumerId: string, limit = Number.POSITIVE_INFINITY): readonly EventEnvelope[] {
    if (limit <= 0) {
      return [];
    }
    const consumer = this.requireConsumer(consumerId);
    const cursor = this.cursors.get(consumerId) ?? 0;
    const delivered: EventEnvelope[] = [];
    const seenEventIds = new Set<string>();
    let nextCursor = cursor;

    for (let index = cursor; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (record == null) {
        continue;
      }
      // Deduplicate: skip if this consumer already received this event
      if (seenEventIds.has(record.event.eventId)) {
        continue;
      }
      if (canConsumerReceive(consumer, record.event)) {
        seenEventIds.add(record.event.eventId);
        delivered.push(record.event);
        nextCursor = index + 1;
      }
      if (delivered.length >= limit) {
        break;
      }
    }

    this.cursors.set(consumerId, nextCursor);
    return delivered;
  }

  public size(): number {
    return this.records.length;
  }

  /**
   * Compacts the records array by removing records that have been consumed by all registered consumers.
   * This prevents unbounded memory growth when the inbox only appends and never prunes.
   * Should be called periodically or when records.length exceeds a threshold.
   * @returns The number of records removed
   */
  public compact(): number {
    if (this.records.length === 0) {
      return 0;
    }

    // Find the minimum cursor across all consumers
    let minCursor = this.records.length;
    for (const cursor of this.cursors.values()) {
      if (cursor < minCursor) {
        minCursor = cursor;
      }
    }

    // If all consumers have consumed all records, clear all
    if (minCursor >= this.records.length) {
      const removed = this.records.length;
      this.records.length = 0;
      // Reset all cursors to 0 since records are empty
      for (const consumerId of this.cursors.keys()) {
        this.cursors.set(consumerId, 0);
      }
      return removed;
    }

    // If minCursor > 0, remove records before minCursor
    if (minCursor > 0) {
      const removed = minCursor;
      // Remove records from the beginning using splice
      this.records.splice(0, minCursor);
      // Adjust all cursors down by minCursor
      for (const consumerId of this.cursors.keys()) {
        const currentCursor = this.cursors.get(consumerId)!;
        this.cursors.set(consumerId, currentCursor - minCursor);
      }
      return removed;
    }

    return 0;
  }

  private requireConsumer(consumerId: string): EventInboxConsumer {
    const consumer = this.consumers.get(consumerId);
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
