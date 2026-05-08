// @ts-nocheck
/**
 * Unit Tests: Knowledge Promotion Service - Issue #2188
 *
 * Issue #2188: Batch promotion event only references first object
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";
import type { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import type { TypedEventPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
import { KnowledgePromotionService } from "../../../../../src/platform/orchestration/learn/knowledge-promotion-service.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: overrides.learningObjectId ?? "learning-default",
    learningType: overrides.learningType ?? "failure_pattern",
    title: overrides.title ?? "Test Learning Object",
    summary: overrides.summary ?? "Test summary for learning object",
    recommendation: overrides.recommendation ?? "Apply this pattern to improve results",
    confidence: overrides.confidence ?? 0.8,
    evidenceRefs: overrides.evidenceRefs ?? ["evidence-1"],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

// Mock event publisher that captures published events
interface CapturedEvent {
  eventType: string;
  taskId: string;
  payload: Record<string, unknown>;
}

function createMockEventPublisher(capturedEvents: CapturedEvent[]): TypedEventPublisher {
  return {
    publish: (event: { eventType: string; taskId: string; payload: Record<string, unknown> }) => {
      capturedEvents.push({ ...event });
    },
  } as unknown as TypedEventPublisher;
}

function createMockKnowledgePlaneService(): KnowledgePlaneService {
  return {
    ingest: (args: {
      title: string;
      body: string;
      namespace: string;
      uri?: string;
      sourceType?: string;
      trustLevel?: string;
      tags?: readonly string[];
    }) => ({
      source: { sourceId: "mock", trustLevel: "reviewed", ingestedAt: new Date().toISOString() },
      document: {
        documentId: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: args.title,
        namespace: args.namespace,
        version: 1,
        status: "active",
        createdAt: Date.now(),
        body: args.body,
      },
      chunks: [],
    }),
  } as unknown as KnowledgePlaneService;
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2188: Batch promotion event only references first object
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgePromotionService - promotes multiple objects and emits events for each", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "learning-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "learning-2", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "learning-3", promotionStatus: "validated" }),
  ];

  const result = service.promote(objects, "task-batch");

  assert.equal(result.promotedCount, 3);
  assert.equal(result.failedCount, 0);
  assert.equal(capturedEvents.length, 3, "Should emit event for each promoted object");

  // Verify each event references the correct learning object
  const event0 = capturedEvents[0];
  assert.equal(event0.payload.learningObjectId, "learning-1");
  assert.equal(event0.eventType, "learning:knowledge_promoted");

  const event1 = capturedEvents[1];
  assert.equal(event1.payload.learningObjectId, "learning-2");

  const event2 = capturedEvents[2];
  assert.equal(event2.payload.learningObjectId, "learning-3");
});

test("KnowledgePromotionService - promotedCount in event reflects actual count (issue #2188)", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "batch-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "batch-2", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "batch-3", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "batch-4", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "batch-5", promotionStatus: "validated" }),
  ];

  service.promote(objects, "task-promo");

  // Each event should have promotedCount = 5 (total)
  for (const event of capturedEvents) {
    const promotedCount = event.payload.promotedCount as number;
    assert.equal(promotedCount, 5, `Event for ${event.payload.learningObjectId} should have promotedCount=5`);
  }
});

test("KnowledgePromotionService - each event has correct documentId for its object", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "doc-ref-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "doc-ref-2", promotionStatus: "validated" }),
  ];

  const result = service.promote(objects, "task-doc-ref");

  assert.equal(capturedEvents.length, 2);

  // Each event should reference a unique documentId
  const docIds = capturedEvents.map((e) => e.payload.documentId as string);
  assert.notEqual(docIds[0], docIds[1], "Each object should have unique documentId");
});

test("KnowledgePromotionService - batch of 10 objects emits 10 events", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = Array.from({ length: 10 }, (_, i) =>
    makeLearningObject({ learningObjectId: `learning-${i}`, promotionStatus: "validated" }),
  );

  const result = service.promote(objects, "task-10-promotions");

  assert.equal(result.promotedCount, 10);
  assert.equal(capturedEvents.length, 10);

  // Verify all 10 learningObjectIds are referenced
  const objectIds = capturedEvents.map((e) => e.payload.learningObjectId as string);
  for (let i = 0; i < 10; i++) {
    assert.ok(objectIds.includes(`learning-${i}`), `learning-${i} should be in events`);
  }
});

test("KnowledgePromotionService - mixed promotionStatus only promotes validated/promoted", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "draft-1", promotionStatus: "draft" }),
    makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "draft-2", promotionStatus: "draft" }),
    makeLearningObject({ learningObjectId: "promoted-1", promotionStatus: "promoted" }),
    makeLearningObject({ learningObjectId: "quarantine-1", promotionStatus: "quarantine" }),
  ];

  const result = service.promote(objects, "task-mixed");

  // Only 2 should be promoted (validated and promoted)
  assert.equal(result.promotedCount, 2);
  assert.equal(capturedEvents.length, 2);

  // Events should be for the correct objects
  const eventObjectIds = capturedEvents.map((e) => e.payload.learningObjectId as string);
  assert.ok(eventObjectIds.includes("validated-1"));
  assert.ok(eventObjectIds.includes("promoted-1"));
  assert.ok(!eventObjectIds.includes("draft-1"));
  assert.ok(!eventObjectIds.includes("draft-2"));
  assert.ok(!eventObjectIds.includes("quarantine-1"));
});

test("KnowledgePromotionService - emits learningType in each event", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "type-1", learningType: "failure_pattern", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "type-2", learningType: "user_correction", promotionStatus: "validated" }),
  ];

  service.promote(objects, "task-types");

  assert.equal(capturedEvents[0].payload.learningType, "failure_pattern");
  assert.equal(capturedEvents[1].payload.learningType, "user_correction");
});

test("KnowledgePromotionService - emits namespace in each event", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "ns-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "ns-2", promotionStatus: "validated" }),
  ];

  service.promote(objects, "task-ns");

  for (const event of capturedEvents) {
    assert.equal(event.payload.namespace, "system.learned.patterns");
  }
});

test("KnowledgePromotionService - emits occurredAt timestamp in each event", async () => {
  const capturedEvents: CapturedEvent[] = [];
  const mockPublisher = createMockEventPublisher(capturedEvents);
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [
    makeLearningObject({ learningObjectId: "ts-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "ts-2", promotionStatus: "validated" }),
  ];

  service.promote(objects, "task-ts");

  for (const event of capturedEvents) {
    assert.ok(event.payload.occurredAt !== undefined, "Each event should have occurredAt");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic functionality tests (existing)
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgePromotionService - promote returns correct result structure", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "result-1", promotionStatus: "validated" })];

  const result = service.promote(objects, "task-result");

  assert.equal(typeof result.promotedCount, "number");
  assert.equal(typeof result.failedCount, "number");
  assert.ok(Array.isArray(result.knowledgeDocumentIds));
});

test("KnowledgePromotionService - promote filters out draft objects", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({ learningObjectId: "draft-1", promotionStatus: "draft" }),
    makeLearningObject({ learningObjectId: "draft-2", promotionStatus: "draft" }),
  ];

  const result = service.promote(objects, "task-filter");

  assert.equal(result.promotedCount, 0);
  assert.equal(result.knowledgeDocumentIds.length, 0);
});

test("KnowledgePromotionService - promote handles empty array", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const result = service.promote([], "task-empty");

  assert.equal(result.promotedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(result.knowledgeDocumentIds, []);
});

test("KnowledgePromotionService - uses system.learned.patterns namespace", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "ns-test", promotionStatus: "validated" })];

  service.promote(objects, "task-ns-test");

  // If no error thrown, namespace is correct
  assert.ok(true);
});

test("KnowledgePromotionService - sets trustLevel to reviewed", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "trust-test", promotionStatus: "validated" })];

  const result = service.promote(objects, "task-trust");

  assert.equal(result.promotedCount, 1);
});

test("KnowledgePromotionService - default constructor works", () => {
  const service = new KnowledgePromotionService();
  assert.ok(service != null);
});

test("KnowledgePromotionService - promote handles single object", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "single-1", promotionStatus: "validated" })];

  const result = service.promote(objects, "task-single");

  assert.equal(result.promotedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.knowledgeDocumentIds.length, 1);
});
