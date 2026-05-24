import assert from "node:assert/strict";
import test from "node:test";

import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

class MockEventConsumer {
  private offset = 0;
  private persistedOffset = 0;
  private readonly processedEvents: EventRecord[] = [];

  public constructor(
    private readonly consumerGroup: string,
    private readonly consumerId: string,
  ) {}

  public async consumeEvent(event: EventRecord): Promise<void> {
    this.processedEvents.push(event);
    this.offset = event.sequence ?? this.offset + 1;
    this.persistedOffset = this.offset;
  }

  public getCurrentOffset(): number {
    return this.offset;
  }

  public getPersistedOffset(): number {
    return this.persistedOffset;
  }

  public getProcessedEvents(): readonly EventRecord[] {
    return this.processedEvents;
  }

  public getConsumerGroup(): string {
    return this.consumerGroup;
  }

  public getConsumerId(): string {
    return this.consumerId;
  }
}

let counter = 0;

function createMockEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: `evt_test_${String(++counter).padStart(4, "0")}`,
    taskId: null,
    sessionId: null,
    executionId: null,
    eventType: "test:event",
    eventTier: "tier_1",
    payloadJson: "{}",
    traceId: null,
    createdAt: new Date().toISOString(),
    schemaVersion: "1.0",
    aggregateId: null,
    runId: null,
    sequence: null,
    causationId: null,
    correlationId: null,
    payloadHash: null,
    idempotencyKey: null,
    replayBehavior: null,
    principal: null,
    evidenceRefs: [],
    ...overrides,
  };
}

test("mock event consumer tracks explicit sequence offsets", async () => {
  const consumer = new MockEventConsumer("test-group", "consumer-1");

  await consumer.consumeEvent(createMockEvent({ sequence: 5 }));
  await consumer.consumeEvent(createMockEvent({ sequence: 8 }));

  assert.equal(consumer.getCurrentOffset(), 8);
  assert.equal(consumer.getPersistedOffset(), 8);
});

test("mock event consumer auto-increments offsets when sequence is missing", async () => {
  const consumer = new MockEventConsumer("test-group", "consumer-1");

  await consumer.consumeEvent(createMockEvent());
  await consumer.consumeEvent(createMockEvent());

  assert.equal(consumer.getCurrentOffset(), 2);
  assert.equal(consumer.getPersistedOffset(), 2);
});

test("mock event consumer preserves processing order", async () => {
  const consumer = new MockEventConsumer("test-group", "consumer-1");

  await consumer.consumeEvent(createMockEvent({ sequence: 1, eventType: "test:first" }));
  await consumer.consumeEvent(createMockEvent({ sequence: 2, eventType: "test:second" }));
  await consumer.consumeEvent(createMockEvent({ sequence: 3, eventType: "test:third" }));

  const processed = consumer.getProcessedEvents();
  assert.equal(processed.length, 3);
  assert.equal(processed[0]?.eventType, "test:first");
  assert.equal(processed[1]?.eventType, "test:second");
  assert.equal(processed[2]?.eventType, "test:third");
});

test("different consumer identities stay independent", async () => {
  const consumerA = new MockEventConsumer("shared-group", "consumer-a");
  const consumerB = new MockEventConsumer("shared-group", "consumer-b");

  await consumerA.consumeEvent(createMockEvent({ sequence: 100 }));
  await consumerB.consumeEvent(createMockEvent({ sequence: 200 }));

  assert.equal(consumerA.getConsumerGroup(), "shared-group");
  assert.equal(consumerB.getConsumerGroup(), "shared-group");
  assert.notEqual(consumerA.getConsumerId(), consumerB.getConsumerId());
  assert.equal(consumerA.getCurrentOffset(), 100);
  assert.equal(consumerB.getCurrentOffset(), 200);
});
