import assert from "node:assert/strict";
import test from "node:test";

import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";
import type { KnowledgePlaneService } from "../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import type { TypedEventPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
import { KnowledgePromotionService } from "../../../../../src/platform/orchestration/learn/knowledge-promotion-service.js";

function createLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: overrides.learningObjectId ?? "learning-1",
    learningType: overrides.learningType ?? "failure_pattern",
    title: overrides.title ?? "Learning Title",
    summary: overrides.summary ?? "Learning summary",
    confidence: overrides.confidence ?? 0.8,
    evidenceRefs: overrides.evidenceRefs ?? ["evidence-1"],
    sourceSignalIds: overrides.sourceSignalIds ?? ["signal-1"],
    recommendation: overrides.recommendation ?? "Apply the learned pattern",
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

function createKnowledgePlane(): KnowledgePlaneService {
  return {
    ingest(input: { title: string; body: string; namespace: string }) {
      return {
        source: {
          sourceId: "source-1",
          trustLevel: "team_reviewed",
          ingestedAt: new Date().toISOString(),
        },
        document: {
          documentId: `doc-${input.title}`,
          sourceId: "source-1",
          title: input.title,
          version: 1,
          tags: [],
          domainScope: [],
          status: "indexed",
          namespace: input.namespace,
          mimeType: "text/plain",
          rawText: input.body,
          structuredText: null,
          archived: false,
          archivedAt: null,
        },
        chunks: [],
      };
    },
  } as unknown as KnowledgePlaneService;
}

test("KnowledgePromotionService promotes only validated/promoted learning objects", () => {
  const service = new KnowledgePromotionService({
    knowledgePlane: createKnowledgePlane(),
  });

  const result = service.promote([
    createLearningObject({ learningObjectId: "lo-valid", promotionStatus: "validated" }),
    createLearningObject({ learningObjectId: "lo-promoted", promotionStatus: "promoted" }),
    createLearningObject({ learningObjectId: "lo-quarantine", promotionStatus: "quarantine" }),
  ], "task-1");

  assert.equal(result.promotedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(result.knowledgeDocumentIds, ["doc-Learning Title", "doc-Learning Title"]);
});

test("KnowledgePromotionService publishes one batch event containing all promoted object metadata", () => {
  const published: Array<{ eventType: string; taskId: string; payload: Record<string, unknown> }> = [];
  const publisher: TypedEventPublisher = {
    publish(input) {
      published.push(input);
    },
  } as TypedEventPublisher;

  const service = new KnowledgePromotionService({
    knowledgePlane: createKnowledgePlane(),
    eventPublisher: publisher,
  });

  service.promote([
    createLearningObject({ learningObjectId: "lo-1", title: "One" }),
    createLearningObject({ learningObjectId: "lo-2", title: "Two" }),
  ], "task-batch");

  assert.equal(published.length, 1);
  assert.equal(published[0]!.eventType, "learning:knowledge_promoted");
  assert.equal(published[0]!.payload.trustLevel, "team_reviewed");
  assert.equal(published[0]!.payload.promotedCount, 2);
  const promotedObjects = published[0]!.payload.promotedObjects as Array<Record<string, unknown>>;
  assert.equal(promotedObjects.length, 2);
  assert.deepEqual(
    promotedObjects.map((item) => item.learningObjectId),
    ["lo-1", "lo-2"],
  );
});

test("KnowledgePromotionService includes evidence and source signal sections in promoted body", () => {
  let capturedBody = "";
  const knowledgePlane: KnowledgePlaneService = {
    ingest(input) {
      capturedBody = input.body;
      return {
        source: { sourceId: "source", trustLevel: "team_reviewed", ingestedAt: new Date().toISOString() },
        document: {
          documentId: "doc-body",
          sourceId: "source",
          title: input.title,
          version: 1,
          tags: [],
          domainScope: [],
          status: "indexed",
          namespace: input.namespace,
          mimeType: "text/plain",
          rawText: input.body,
          structuredText: null,
          archived: false,
          archivedAt: null,
        },
        chunks: [],
      };
    },
  } as unknown as KnowledgePlaneService;

  const service = new KnowledgePromotionService({ knowledgePlane });
  service.promote([
    createLearningObject({
      evidenceRefs: ["e1", "e2"],
      sourceSignalIds: ["s1"],
    }),
  ], "task-body");

  assert.ok(capturedBody.includes("## Evidence (2 refs)"));
  assert.ok(capturedBody.includes("## Source Signals"));
});
