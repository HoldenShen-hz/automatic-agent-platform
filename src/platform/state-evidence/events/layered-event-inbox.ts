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
    let nextCursor = cursor;

    for (let index = cursor; index < this.records.length; index += 1) {
      const record = this.records[index];
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

    this.cursors.set(consumerId, nextCursor);
    return delivered;
  }

  public size(): number {
    return this.records.length;
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
