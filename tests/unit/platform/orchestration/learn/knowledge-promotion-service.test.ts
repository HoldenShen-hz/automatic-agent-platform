import assert from "node:assert/strict";
import test from "node:test";

import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";
import type { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import type { TypedEventPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
import { KnowledgePromotionService } from "../../../../../src/platform/orchestration/learn/knowledge-promotion-service.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: overrides.learningObjectId ?? "learning-1",
    learningType: overrides.learningType ?? "failure_pattern",
    title: overrides.title ?? "Test Learning Object",
    summary: overrides.summary ?? "Test summary",
    recommendation: overrides.recommendation ?? "Test recommendation",
    confidence: overrides.confidence ?? 0.8,
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    validatedBy: overrides.validatedBy ?? "none",
    promotionStatus: overrides.promotionStatus ?? "draft",
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

interface CapturedIngestArgs {
  title: string;
  body: string;
  namespace: string;
  uri?: string;
  sourceType?: string;
  trustLevel?: string;
  tags?: readonly string[];
}

function createMockKnowledgePlaneService(capturedArgs?: CapturedIngestArgs): KnowledgePlaneService {
  const args = capturedArgs ?? {
    title: "Test",
    body: "Test body",
    namespace: "system.learned.patterns",
    trustLevel: "reviewed",
    tags: [],
  };

  const mock = {
    ingest: (ingestArgs: {
      title: string;
      body: string;
      namespace: string;
      uri?: string;
      sourceType?: string;
      trustLevel?: string;
      tags?: readonly string[];
    }) => {
      if (capturedArgs) {
        Object.assign(capturedArgs, ingestArgs);
      }
      return {
        source: { sourceId: "mock-source", trustLevel: ingestArgs.trustLevel ?? "reviewed", ingestedAt: new Date().toISOString() },
        document: { documentId: "doc-1", title: ingestArgs.title, namespace: ingestArgs.namespace, version: 1, status: "active", createdAt: Date.now(), body: ingestArgs.body },
        chunks: [],
      };
    },
  };
  return mock as unknown as KnowledgePlaneService;
}

test("KnowledgePromotionService.promote filters out non-validated objects", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({ learningObjectId: "draft-1", promotionStatus: "draft" }),
    makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" }),
    makeLearningObject({ learningObjectId: "promoted-1", promotionStatus: "promoted" }),
  ];

  const result = service.promote(objects, "task-1");

  assert.equal(result.promotedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.ok(result.knowledgeDocumentIds.includes("doc-1"));
});

test("KnowledgePromotionService.promote processes validated objects", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" }),
  ];

  const result = service.promote(objects, "task-1");

  assert.equal(result.promotedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.knowledgeDocumentIds.length, 1);
});

test("KnowledgePromotionService.promote processes promoted objects", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({ learningObjectId: "promoted-1", promotionStatus: "promoted" }),
  ];

  const result = service.promote(objects, "task-1");

  assert.equal(result.promotedCount, 1);
  assert.equal(result.failedCount, 0);
});

test("KnowledgePromotionService.promote returns empty result for empty array", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const result = service.promote([], "task-1");

  assert.equal(result.promotedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(result.knowledgeDocumentIds, []);
});

test("KnowledgePromotionService.promote skips objects with draft status", () => {
  const mockKP = createMockKnowledgePlaneService();
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({ learningObjectId: "draft-1", promotionStatus: "draft" }),
    makeLearningObject({ learningObjectId: "draft-2", promotionStatus: "draft" }),
  ];

  const result = service.promote(objects, "task-1");

  assert.equal(result.promotedCount, 0);
  assert.equal(result.failedCount, 0);
});

test("KnowledgePromotionService.promote uses system.learned.patterns namespace", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" })];
  service.promote(objects, "task-1");

  assert.equal(capturedArgs.namespace, "system.learned.patterns");
});

test("KnowledgePromotionService.promote sets trustLevel to reviewed", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
    trustLevel: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" })];
  service.promote(objects, "task-1");

  assert.equal(capturedArgs.trustLevel, "reviewed");
});

test("KnowledgePromotionService.promote includes learningType as tag", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
    tags: [],
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "validated-1", learningType: "user_correction", promotionStatus: "validated" })];
  service.promote(objects, "task-1");

  assert.ok(capturedArgs.tags?.includes("user_correction"));
});

test("KnowledgePromotionService.promote includes confidence as formatted tag", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
    tags: [],
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "validated-1", confidence: 0.85, promotionStatus: "validated" })];
  service.promote(objects, "task-1");

  assert.ok(capturedArgs.tags?.some((tag) => tag.startsWith("confidence:")));
  assert.ok(capturedArgs.tags?.some((tag) => tag === "confidence:0.85"));
});

test("KnowledgePromotionService.promote builds correct URI from learning object", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
    uri: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [makeLearningObject({ learningObjectId: "learning-abc123", learningType: "failure_pattern", promotionStatus: "validated" })];
  service.promote(objects, "task-1");

  assert.equal(capturedArgs.uri, "learning://failure_pattern/learning-abc123");
});

test("KnowledgePromotionService constructor accepts optional eventPublisher", () => {
  const mockKP = createMockKnowledgePlaneService();
  const mockPublisher = {
    publish: () => {},
  } as unknown as TypedEventPublisher;
  const service = new KnowledgePromotionService({
    knowledgePlane: mockKP,
    eventPublisher: mockPublisher,
  });

  const objects = [makeLearningObject({ learningObjectId: "validated-1", promotionStatus: "validated" })];
  service.promote(objects, "task-1");
});

test("KnowledgePromotionService constructor uses default KnowledgePlaneService when not provided", () => {
  const service = new KnowledgePromotionService();
  assert.ok(service != null);
});

test("KnowledgePromotionService.promote builds body with title and summary", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({
      learningObjectId: "validated-1",
      title: "Test Title",
      summary: "Test Summary Text",
      recommendation: "Test Recommendation",
      learningType: "failure_pattern",
      confidence: 0.75,
      promotionStatus: "validated",
    }),
  ];
  service.promote(objects, "task-1");

  assert.ok(capturedArgs.body.includes("# Test Title"));
  assert.ok(capturedArgs.body.includes("Test Summary Text"));
  assert.ok(capturedArgs.body.includes("Test Recommendation"));
  assert.ok(capturedArgs.body.includes("**Type:** failure_pattern"));
  assert.ok(capturedArgs.body.includes("**Confidence:** 75%"));
});

test("KnowledgePromotionService.promote handles objects with evidenceRefs", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({
      learningObjectId: "validated-1",
      evidenceRefs: ["ref-1", "ref-2", "ref-3"],
      promotionStatus: "validated",
    }),
  ];
  service.promote(objects, "task-1");

  assert.ok(capturedArgs.body.includes("## Evidence (3 refs)"));
  assert.ok(capturedArgs.body.includes("- ref-1"));
  assert.ok(capturedArgs.body.includes("- ref-2"));
  assert.ok(capturedArgs.body.includes("- ref-3"));
});

test("KnowledgePromotionService.promote handles objects with sourceSignalIds", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({
      learningObjectId: "validated-1",
      sourceSignalIds: ["sig-1", "sig-2"],
      promotionStatus: "validated",
    }),
  ];
  service.promote(objects, "task-1");

  assert.ok(capturedArgs.body.includes("## Source Signals"));
  assert.ok(capturedArgs.body.includes("- sig-1"));
  assert.ok(capturedArgs.body.includes("- sig-2"));
});

test("KnowledgePromotionService.promote does not include Evidence section when evidenceRefs is empty", () => {
  const capturedArgs: CapturedIngestArgs = {
    title: "",
    body: "",
    namespace: "",
  };
  const mockKP = createMockKnowledgePlaneService(capturedArgs);
  const service = new KnowledgePromotionService({ knowledgePlane: mockKP });

  const objects = [
    makeLearningObject({
      learningObjectId: "validated-1",
      evidenceRefs: [],
      sourceSignalIds: [],
      promotionStatus: "validated",
    }),
  ];
  service.promote(objects, "task-1");

  assert.ok(!capturedArgs.body.includes("## Evidence"));
  assert.ok(!capturedArgs.body.includes("## Source Signals"));
});
