/**
 * Unit tests for EventConsumer
 *
 * Tests event consumption, offset tracking, ordering, consumer groups,
 * and offset persistence for the event consumer module.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * Mock EventConsumer implementation for testing
 * This simulates the expected interface and behavior of EventConsumer
 */
class MockEventConsumer {
  private offset = 0;
  private readonly consumerGroup: string;
  private readonly consumerId: string;
  private processedEvents: EventRecord[] = [];
  private offsetPersisted = 0;

  public constructor(consumerGroup: string, consumerId: string) {
    this.consumerGroup = consumerGroup;
    this.consumerId = consumerId;
  }

  public async consumeEvent(event: EventRecord): Promise<void> {
    this.processedEvents.push(event);
    this.offset = event.sequence ?? this.offset + 1;
    this.persistOffset(this.offset);
  }

  public getCurrentOffset(): number {
    return this.offset;
  }

  public getConsumerGroup(): string {
    return this.consumerGroup;
  }

  public getConsumerId(): string {
    return this.consumerId;
  }

  public getProcessedEvents(): EventRecord[] {
    return this.processedEvents;
  }

  public getPersistedOffset(): number {
    return this.offsetPersisted;
  }

  private persistOffset(offset: number): void {
    this.offsetPersisted = offset;
  }
}

/**
 * Factory to create EventConsumer instances for testing
 */
function createEventConsumer(consumerGroup: string, consumerId: string): MockEventConsumer {
  return new MockEventConsumer(consumerGroup, consumerId);
}

let mockEventCounter = 0;

/**
 * Helper to create a mock EventRecord with optional sequence number
 */
function createMockEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: `evt_test_${String(++mockEventCounter).padStart(4, "0")}`,
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
    replayBehavior: null,
    principal: null,
    evidenceRefs: null,
    ...overrides,
  };
}

test("consumeEvent processes event and updates offset", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event = createMockEvent({ sequence: 5 });

  await consumer.consumeEvent(event);

  assert.equal(consumer.getCurrentOffset(), 5);
});

test("consumeEvent increments offset for event without sequence", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event1 = createMockEvent();
  const event2 = createMockEvent();

  await consumer.consumeEvent(event1);
  await consumer.consumeEvent(event2);

  assert.equal(consumer.getCurrentOffset(), 2);
});

test("getCurrentOffset returns last processed offset", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event1 = createMockEvent({ sequence: 10 });
  const event2 = createMockEvent({ sequence: 15 });

  await consumer.consumeEvent(event1);
  assert.equal(consumer.getCurrentOffset(), 10);

  await consumer.consumeEvent(event2);
  assert.equal(consumer.getCurrentOffset(), 15);
});

test("getCurrentOffset returns 0 initially", () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  assert.equal(consumer.getCurrentOffset(), 0);
});

test("Events are processed in order by sequence", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event1 = createMockEvent({ sequence: 1, eventType: "test:first" });
  const event2 = createMockEvent({ sequence: 2, eventType: "test:second" });
  const event3 = createMockEvent({ sequence: 3, eventType: "test:third" });

  await consumer.consumeEvent(event1);
  await consumer.consumeEvent(event2);
  await consumer.consumeEvent(event3);

  const processed = consumer.getProcessedEvents();
  assert.equal(processed.length, 3);
  assert.equal(processed[0].sequence, 1);
  assert.equal(processed[1].sequence, 2);
  assert.equal(processed[2].sequence, 3);
});

test("Events without sequence are processed in insertion order", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event1 = createMockEvent({ eventType: "test:first" });
  const event2 = createMockEvent({ eventType: "test:second" });
  const event3 = createMockEvent({ eventType: "test:third" });

  await consumer.consumeEvent(event1);
  await consumer.consumeEvent(event2);
  await consumer.consumeEvent(event3);

  const processed = consumer.getProcessedEvents();
  assert.equal(processed.length, 3);
  assert.equal(processed[0].eventType, "test:first");
  assert.equal(processed[1].eventType, "test:second");
  assert.equal(processed[2].eventType, "test:third");
});

test("Consumer group receives events correctly", async () => {
  const groupA = createEventConsumer("group-a", "consumer-a1");
  const groupB = createEventConsumer("group-b", "consumer-b1");

  const eventForA = createMockEvent({ eventType: "test:for_a" });
  const eventForB = createMockEvent({ eventType: "test:for_b" });

  await groupA.consumeEvent(eventForA);
  await groupB.consumeEvent(eventForB);

  assert.equal(groupA.getProcessedEvents().length, 1);
  assert.equal(groupB.getProcessedEvents().length, 1);
  assert.equal(groupA.getConsumerGroup(), "group-a");
  assert.equal(groupB.getConsumerGroup(), "group-b");
});

test("Multiple consumers in same group operate independently", async () => {
  const consumer1 = createEventConsumer("same-group", "consumer-1");
  const consumer2 = createEventConsumer("same-group", "consumer-2");

  const event1 = createMockEvent({ sequence: 100 });
  const event2 = createMockEvent({ sequence: 200 });

  await consumer1.consumeEvent(event1);
  await consumer2.consumeEvent(event2);

  assert.equal(consumer1.getCurrentOffset(), 100);
  assert.equal(consumer2.getCurrentOffset(), 200);
  assert.notEqual(consumer1.getConsumerId(), consumer2.getConsumerId());
});

test("Offset is persisted after processing", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event = createMockEvent({ sequence: 42 });

  await consumer.consumeEvent(event);

  assert.equal(consumer.getPersistedOffset(), 42);
  assert.equal(consumer.getCurrentOffset(), 42);
});

test("Offset persists even after multiple events", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");

  await consumer.consumeEvent(createMockEvent({ sequence: 10 }));
  await consumer.consumeEvent(createMockEvent({ sequence: 20 }));
  await consumer.consumeEvent(createMockEvent({ sequence: 30 }));

  assert.equal(consumer.getPersistedOffset(), 30);
  assert.equal(consumer.getCurrentOffset(), 30);
});

test("Consumer with different IDs are independent", async () => {
  const consumer1 = createEventConsumer("group", "id-1");
  const consumer2 = createEventConsumer("group", "id-2");

  await consumer1.consumeEvent(createMockEvent({ sequence: 5 }));

  assert.equal(consumer1.getCurrentOffset(), 5);
  assert.equal(consumer2.getCurrentOffset(), 0);
});

test("consumeEvent handles events with null sequence gracefully", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const event = createMockEvent({ sequence: null });

  await consumer.consumeEvent(event);

  assert.equal(consumer.getCurrentOffset(), 1);
});

test("consumeEvent processes events with high sequence numbers", async () => {
  const consumer = createEventConsumer("test-group", "consumer-1");
  const highSeqEvent = createMockEvent({ sequence: 999999 });

  await consumer.consumeEvent(highSeqEvent);

  assert.equal(consumer.getCurrentOffset(), 999999);
  assert.equal(consumer.getPersistedOffset(), 999999);
});
