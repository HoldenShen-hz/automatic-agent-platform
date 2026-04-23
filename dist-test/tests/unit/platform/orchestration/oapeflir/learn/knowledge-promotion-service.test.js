/**
 * Unit Test: KnowledgePromotionService
 * G7 Smoke Test — verifies promote() converts LearningObject to KnowledgeDocument
 */
import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgePromotionService } from "../../../../../../src/platform/orchestration/oapeflir/learn/knowledge-promotion-service.js";
function createTestLearningObject(overrides = {}) {
    return {
        learningObjectId: "lo_test_1",
        learningType: "failure_pattern",
        title: "Test Failure Pattern",
        summary: "This is a test summary",
        confidence: 0.85,
        evidenceRefs: ["signal_1", "signal_2"],
        sourceSignalIds: ["feedback_1"],
        recommendation: "Fix by retrying the operation",
        validatedBy: "evidence",
        promotionStatus: "validated",
        createdAt: Date.now(),
        ...overrides,
    };
}
test("KnowledgePromotionService.promote() returns correct counts for validated objects", () => {
    const service = new KnowledgePromotionService();
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_1", promotionStatus: "validated" }),
        createTestLearningObject({ learningObjectId: "lo_2", promotionStatus: "promoted" }),
    ];
    const result = service.promote(objects, "task_test");
    assert.equal(result.promotedCount, 2, "Both validated objects should be promoted");
    assert.equal(result.failedCount, 0, "No failures expected");
    assert.equal(result.knowledgeDocumentIds.length, 2, "Should return 2 document IDs");
});
test("KnowledgePromotionService.promote() skips objects with draft status", () => {
    const service = new KnowledgePromotionService();
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_draft", promotionStatus: "draft" }),
    ];
    const result = service.promote(objects, "task_test");
    assert.equal(result.promotedCount, 0, "Draft objects should not be promoted");
    assert.equal(result.failedCount, 0, "No failures");
    assert.equal(result.knowledgeDocumentIds.length, 0, "No document IDs");
});
test("KnowledgePromotionService.promote() handles empty array", () => {
    const service = new KnowledgePromotionService();
    const result = service.promote([], "task_test");
    assert.equal(result.promotedCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.knowledgeDocumentIds.length, 0);
});
test("KnowledgePromotionService.promote() handles mixed promotion statuses", () => {
    const service = new KnowledgePromotionService();
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_validated", promotionStatus: "validated" }),
        createTestLearningObject({ learningObjectId: "lo_promoted", promotionStatus: "promoted" }),
        createTestLearningObject({ learningObjectId: "lo_retired", promotionStatus: "retired" }),
    ];
    const result = service.promote(objects, "task_test");
    assert.equal(result.promotedCount, 2, "Only validated and promoted should be promoted");
    assert.equal(result.failedCount, 0);
});
test("KnowledgePromotionService.promote() handles all learning types", () => {
    const service = new KnowledgePromotionService();
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_failure", learningType: "failure_pattern" }),
        createTestLearningObject({ learningObjectId: "lo_correction", learningType: "user_correction" }),
        createTestLearningObject({ learningObjectId: "lo_recovery", learningType: "recovery_playbook" }),
    ];
    const result = service.promote(objects, "task_test");
    assert.equal(result.promotedCount, 3, "All learning types should be promoted");
});
test("KnowledgePromotionService.promote() handles ingest failure gracefully", () => {
    // Create a mock KnowledgePlaneService that throws when ingest is called
    const mockKnowledgePlane = {
        ingest: () => {
            throw new Error("Ingest failed");
        },
    };
    const service = new KnowledgePromotionService({
        knowledgePlane: mockKnowledgePlane,
    });
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_fail", promotionStatus: "validated" }),
    ];
    const result = service.promote(objects, "task_test");
    assert.equal(result.promotedCount, 0, "No objects should be promoted");
    assert.equal(result.failedCount, 1, "One failure should be recorded");
    assert.equal(result.knowledgeDocumentIds.length, 0);
});
test("KnowledgePromotionService.promote() publishes event when eventPublisher is provided", () => {
    let publishCallCount = 0;
    let publishedPayload = null;
    const mockEventPublisher = {
        publish: (input) => {
            publishCallCount++;
            publishedPayload = input.payload;
        },
    };
    const service = new KnowledgePromotionService({
        eventPublisher: mockEventPublisher,
    });
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_event", promotionStatus: "validated" }),
    ];
    const result = service.promote(objects, "task_event_test");
    assert.equal(result.promotedCount, 1);
    assert.equal(publishCallCount, 1, "Event publisher should be called once");
    assert.equal(publishedPayload.namespace, "system.learned.patterns");
    assert.equal(publishedPayload.trustLevel, "reviewed");
    assert.equal(publishedPayload.promotedCount, 1);
});
test("KnowledgePromotionService.promote() does not publish event when no objects promoted", () => {
    let publishCallCount = 0;
    const mockEventPublisher = {
        publish: () => {
            publishCallCount++;
        },
    };
    const service = new KnowledgePromotionService({
        eventPublisher: mockEventPublisher,
    });
    const objects = [
        createTestLearningObject({ learningObjectId: "lo_draft", promotionStatus: "draft" }),
    ];
    service.promote(objects, "task_no_promote");
    assert.equal(publishCallCount, 0, "Event publisher should not be called when no objects promoted");
});
test("KnowledgePromotionService.promote() handles evidenceRefs and sourceSignalIds formatting in buildBody", () => {
    const service = new KnowledgePromotionService();
    const objects = [
        createTestLearningObject({
            learningObjectId: "lo_body",
            promotionStatus: "validated",
            evidenceRefs: ["ref1", "ref2"],
            sourceSignalIds: ["sig1"],
        }),
    ];
    const result = service.promote(objects, "task_body_test");
    assert.equal(result.promotedCount, 1);
});
//# sourceMappingURL=knowledge-promotion-service.test.js.map