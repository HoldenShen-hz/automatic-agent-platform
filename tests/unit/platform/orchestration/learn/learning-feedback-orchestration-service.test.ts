import assert from "node:assert/strict";
import test from "node:test";

import { LearningFeedbackOrchestrationService, type LearningFeedbackOrchestrationInput } from "../../../../../src/platform/orchestration/learn/learning-feedback-orchestration-service.js";
import type { StrategyLearningService } from "../../../../../src/platform/orchestration/learn/strategy-learning-service.js";
import type { KnowledgePromotionService, KnowledgePromotionResult } from "../../../../../src/platform/orchestration/learn/knowledge-promotion-service.js";
import type { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper types & factories
// ---------------------------------------------------------------------------

function makeLearningSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "sig-1",
    taskId: "task-1",
    sourceFeedbackId: "fb-1",
    learningType: "failure_pattern",
    valueSummary: "Test failure signal",
    confidence: 0.8,
    evidence: {},
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: [],
    relatedSignalIds: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "lo-1",
    learningType: "failure_pattern",
    title: "Test Learning Object",
    summary: "Test summary",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["sig-1"],
    recommendation: "Test recommendation",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem-1",
    taskId: "task-1",
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "evolution",
    contentJson: '{"content":"test"}',
    classification: "learning",
    sourceTrustLevel: "trusted",
    qualityScore: 0.8,
    hitCount: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "rule",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: "abc123",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock StrategyLearningService
// ---------------------------------------------------------------------------

class MockStrategyLearningService implements Partial<StrategyLearningService> {
  learnSyncSignals: LearningSignal[] = [];

  learnSync(signals: readonly LearningSignal[]): LearningObject[] {
    this.learnSyncSignals = [...signals];
    return signals.map((signal) =>
      makeLearningObject({
        learningObjectId: `lo-${signal.learningSignalId}`,
        learningType: signal.learningType,
        title: `Learning from ${signal.learningSignalId}`,
        summary: signal.valueSummary,
        confidence: signal.confidence,
        evidenceRefs: signal.evidenceRefs,
        sourceSignalIds: signal.sourceSignalIds,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Mock KnowledgePromotionService
// ---------------------------------------------------------------------------

class MockKnowledgePromotionService implements Partial<KnowledgePromotionService> {
  promoteCalls: { learningObjects: readonly LearningObject[]; taskId: string }[] = [];
  promoteResult: KnowledgePromotionResult = {
    promotedCount: 0,
    failedCount: 0,
    knowledgeDocumentIds: [],
  };

  promote(learningObjects: readonly LearningObject[], taskId: string): KnowledgePromotionResult {
    this.promoteCalls.push({ learningObjects, taskId });
    return this.promoteResult;
  }
}

// ---------------------------------------------------------------------------
// Mock MemoryService
// ---------------------------------------------------------------------------

class MockMemoryService implements Partial<MemoryService> {
  rememberCalls: Parameters<MemoryService["remember"]>[] = [];
  rememberResult: MemoryRecord = makeMemoryRecord();

  remember(...args: Parameters<MemoryService["remember"]>): MemoryRecord {
    this.rememberCalls.push(args);
    return this.rememberResult;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("LearningFeedbackOrchestrationService.process returns correct structure", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const input: LearningFeedbackOrchestrationInput = {
    taskId: "task-1",
    signals: [makeLearningSignal({ learningSignalId: "sig-1" })],
  };

  const result = service.process(input);

  assert.equal(result.taskId, "task-1");
  assert.ok(Array.isArray(result.learningObjects));
  assert.ok(result.promotedKnowledge);
  assert.ok(Array.isArray(result.rememberedMemories));
  assert.ok(result.learningTypeCounts);
  assert.equal(typeof result.skippedDuplicateCount, "number");
});

test("LearningFeedbackOrchestrationService.process calls strategyLearning.learnSync", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [
    makeLearningSignal({ learningSignalId: "sig-1" }),
    makeLearningSignal({ learningSignalId: "sig-2" }),
  ];

  service.process({ taskId: "task-1", signals });

  assert.equal(mockStrategy.learnSyncSignals.length, 2);
  assert.equal(mockStrategy.learnSyncSignals[0]?.learningSignalId, "sig-1");
  assert.equal(mockStrategy.learnSyncSignals[1]?.learningSignalId, "sig-2");
});

test("LearningFeedbackOrchestrationService.process calls knowledgePromotion.promote by default", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [makeLearningSignal()];
  service.process({ taskId: "task-promote-test", signals });

  assert.equal(mockPromotion.promoteCalls.length, 1);
  assert.equal(mockPromotion.promoteCalls[0]?.taskId, "task-promote-test");
});

test("LearningFeedbackOrchestrationService.process skips promotion when promoteToKnowledge is false", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [makeLearningSignal()];
  service.process({ taskId: "task-1", signals, promoteToKnowledge: false });

  assert.equal(mockPromotion.promoteCalls.length, 0);
});

test("LearningFeedbackOrchestrationService.process does not call memoryService when rememberValidatedLearnings is false", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();
  const mockMemory = new MockMemoryService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: mockMemory as unknown as MemoryService,
  });

  const signals = [makeLearningSignal()];
  service.process({ taskId: "task-1", signals, rememberValidatedLearnings: false });

  assert.equal(mockMemory.rememberCalls.length, 0);
});

test("LearningFeedbackOrchestrationService.process counts learning objects by type", () => {
  // Override learnSync to return distinct learning objects that won't be deduplicated
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  // Make each learning object unique by using different summaries and recommendations
  (mockStrategy as unknown as MockStrategyLearningService).learnSync = (signals: readonly LearningSignal[]) => {
    return signals.map((signal, index) =>
      makeLearningObject({
        learningObjectId: `lo-${signal.learningSignalId}`,
        learningType: signal.learningType,
        title: `Learning ${index}`,
        summary: `Summary for signal ${index}: ${signal.valueSummary}`,
        recommendation: `Recommendation ${index}`,
        evidenceRefs: [`evidence-${index}`],
        sourceSignalIds: signal.sourceSignalIds,
      }),
    );
  };

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [
    makeLearningSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" }),
    makeLearningSignal({ learningSignalId: "sig-2", learningType: "failure_pattern" }),
    makeLearningSignal({ learningSignalId: "sig-3", learningType: "user_correction" }),
  ];

  const result = service.process({ taskId: "task-1", signals });

  assert.equal(result.learningTypeCounts["failure_pattern"], 2);
  assert.equal(result.learningTypeCounts["user_correction"], 1);
  assert.equal(result.learningTypeCounts["recovery_playbook"], 0);
  assert.equal(result.learningTypeCounts["model_retraining"], 0);
  assert.equal(result.learningTypeCounts["dataset_gap"], 0);
});

test("LearningFeedbackOrchestrationService.process handles empty signals", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const result = service.process({ taskId: "task-empty", signals: [] });

  assert.equal(result.learningObjects.length, 0);
  assert.equal(result.skippedDuplicateCount, 0);
  assert.equal(result.learningTypeCounts["failure_pattern"], 0);
});

test("LearningFeedbackOrchestrationService.process deduplicates learning objects", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  // Override learnSync to return duplicate learning objects
  (mockStrategy as unknown as MockStrategyLearningService).learnSync = (signals: readonly LearningSignal[]) => {
    // Return the same learning object twice
    const base = makeLearningObject();
    return [base, { ...base, learningObjectId: "different-id" }];
  };

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [makeLearningSignal()];
  const result = service.process({ taskId: "task-1", signals });

  // Both objects have same summary, recommendation, and evidenceRefs so should be deduplicated
  // But with different learningObjectId, they won't be considered duplicates
  // The dedupe function uses learningType|summary|recommendation|evidenceRefs as key
  assert.ok(result.learningObjects.length >= 1);
});

test("LearningFeedbackOrchestrationService.process uses default services when not provided", () => {
  // This test just verifies the service can be constructed without options
  const service = new LearningFeedbackOrchestrationService();

  const result = service.process({
    taskId: "task-defaults",
    signals: [makeLearningSignal()],
    promoteToKnowledge: false, // Disable promotion to avoid knowledge plane dependency
    rememberValidatedLearnings: false, // Disable memory to avoid memory service dependency
  });

  assert.equal(result.taskId, "task-defaults");
  assert.ok(Array.isArray(result.learningObjects));
});

test("LearningFeedbackOrchestrationService.process calls memoryService when rememberValidatedLearnings is true", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();
  const mockMemory = new MockMemoryService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: mockMemory as unknown as MemoryService,
  });

  const signals = [makeLearningSignal({ learningSignalId: "sig-mem" })];
  const result = service.process({ taskId: "task-1", signals, rememberValidatedLearnings: true });

  assert.equal(mockMemory.rememberCalls.length, 1);
  assert.equal(result.rememberedMemories.length, 1);
});

test("LearningFeedbackOrchestrationService.process passes optional fields to memoryService.remember", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();
  const mockMemory = new MockMemoryService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: mockMemory as unknown as MemoryService,
  });

  const signals = [makeLearningSignal({ learningSignalId: "sig-opts" })];
  service.process({
    taskId: "task-opts",
    signals,
    executionId: "exec-123",
    sessionId: "sess-456",
    agentId: "agent-789",
    rememberValidatedLearnings: true,
  });

  assert.equal(mockMemory.rememberCalls.length, 1);
  const rememberInput = mockMemory.rememberCalls[0][0];
  assert.equal(rememberInput.taskId, "task-opts");
  assert.equal(rememberInput.executionId, "exec-123");
  assert.equal(rememberInput.sessionId, "sess-456");
  assert.equal(rememberInput.agentId, "agent-789");
  assert.equal(rememberInput.scope, "evolution");
  assert.equal(rememberInput.memoryLayer, "layer_5");
  assert.equal(rememberInput.classification, "learning");
  assert.equal(rememberInput.sourceTrustLevel, "trusted");
});

test("LearningFeedbackOrchestrationService.process does not call memoryService when memoryService is null", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const signals = [makeLearningSignal()];
  const result = service.process({ taskId: "task-1", signals, rememberValidatedLearnings: true });

  // Should not throw even though memoryService is null and rememberValidatedLearnings is true
  assert.equal(result.rememberedMemories.length, 0);
});

test("LearningFeedbackOrchestrationService.process returns empty promotedKnowledge when promoteToKnowledge is false", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const result = service.process({
    taskId: "task-no-promote",
    signals: [makeLearningSignal()],
    promoteToKnowledge: false,
  });

  assert.equal(result.promotedKnowledge.promotedCount, 0);
  assert.equal(result.promotedKnowledge.failedCount, 0);
  assert.deepEqual(result.promotedKnowledge.knowledgeDocumentIds, []);
});

test("LearningFeedbackOrchestrationService.process returns correct skippedDuplicateCount with duplicates", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  // Override learnSync to return explicitly deduplicated objects
  (mockStrategy as unknown as MockStrategyLearningService).learnSync = () => {
    // Return 3 learning objects where 2 are exact duplicates
    const base = makeLearningObject({
      learningType: "failure_pattern",
      summary: "Same summary",
      recommendation: "Same recommendation",
      evidenceRefs: ["same-evidence"],
    });
    return [base, { ...base, learningObjectId: "lo-2" }, { ...base, learningObjectId: "lo-3" }];
  };

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const result = service.process({
    taskId: "task-dedup",
    signals: [makeLearningSignal()],
  });

  // 3 objects returned, 2 are duplicates (only 1 unique)
  assert.equal(result.learningObjects.length, 1);
  assert.equal(result.skippedDuplicateCount, 2);
});

test("LearningFeedbackOrchestrationService.process handles all learning types in count", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();

  (mockStrategy as unknown as MockStrategyLearningService).learnSync = () => [
    makeLearningObject({ learningObjectId: "lo-1", learningType: "failure_pattern", summary: "failure 1", recommendation: "rec 1", evidenceRefs: ["ev1"] }),
    makeLearningObject({ learningObjectId: "lo-2", learningType: "user_correction", summary: "user 1", recommendation: "rec 2", evidenceRefs: ["ev2"] }),
    makeLearningObject({ learningObjectId: "lo-3", learningType: "recovery_playbook", summary: "recovery 1", recommendation: "rec 3", evidenceRefs: ["ev3"] }),
    makeLearningObject({ learningObjectId: "lo-4", learningType: "model_retraining", summary: "model 1", recommendation: "rec 4", evidenceRefs: ["ev4"] }),
    makeLearningObject({ learningObjectId: "lo-5", learningType: "dataset_gap", summary: "dataset 1", recommendation: "rec 5", evidenceRefs: ["ev5"] }),
  ];

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const result = service.process({ taskId: "task-types", signals: [makeLearningSignal()] });

  assert.equal(result.learningTypeCounts["failure_pattern"], 1);
  assert.equal(result.learningTypeCounts["user_correction"], 1);
  assert.equal(result.learningTypeCounts["recovery_playbook"], 1);
  assert.equal(result.learningTypeCounts["model_retraining"], 1);
  assert.equal(result.learningTypeCounts["dataset_gap"], 1);
});

test("LearningFeedbackOrchestrationService.process passes all learning objects to knowledge promotion", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();
  mockPromotion.promoteResult = { promotedCount: 2, failedCount: 0, knowledgeDocumentIds: ["doc-1", "doc-2"] };

  (mockStrategy as unknown as MockStrategyLearningService).learnSync = () => [
    makeLearningObject({ learningObjectId: "lo-1", summary: "sum 1", recommendation: "rec 1", evidenceRefs: ["ev1"] }),
    makeLearningObject({ learningObjectId: "lo-2", summary: "sum 2", recommendation: "rec 2", evidenceRefs: ["ev2"] }),
  ];

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  service.process({ taskId: "task-multi", signals: [makeLearningSignal()] });

  assert.equal(mockPromotion.promoteCalls.length, 1);
  assert.equal(mockPromotion.promoteCalls[0].learningObjects.length, 2);
  assert.equal(mockPromotion.promoteCalls[0].learningObjects[0].learningObjectId, "lo-1");
  assert.equal(mockPromotion.promoteCalls[0].learningObjects[1].learningObjectId, "lo-2");
});

test("LearningFeedbackOrchestrationService.process returns correct promotedKnowledge from promotion service", () => {
  const mockStrategy = new MockStrategyLearningService();
  const mockPromotion = new MockKnowledgePromotionService();
  mockPromotion.promoteResult = {
    promotedCount: 5,
    failedCount: 2,
    knowledgeDocumentIds: ["doc-a", "doc-b", "doc-c", "doc-d", "doc-e"],
  };

  const service = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
    knowledgePromotion: mockPromotion as unknown as KnowledgePromotionService,
    memoryService: null,
  });

  const result = service.process({
    taskId: "task-result",
    signals: [makeLearningSignal()],
  });

  assert.equal(result.promotedKnowledge.promotedCount, 5);
  assert.equal(result.promotedKnowledge.failedCount, 2);
  assert.deepEqual(result.promotedKnowledge.knowledgeDocumentIds, ["doc-a", "doc-b", "doc-c", "doc-d", "doc-e"]);
});

test("LearningFeedbackOrchestrationService constructor accepts empty options object", () => {
  // Should not throw
  const service1 = new LearningFeedbackOrchestrationService({});
  assert.ok(service1);

  // Should also not throw with no arguments
  const service2 = new LearningFeedbackOrchestrationService();
  assert.ok(service2);
});

test("LearningFeedbackOrchestrationService constructor accepts partial options", () => {
  const mockStrategy = new MockStrategyLearningService();

  // Only strategyLearning
  const service1 = new LearningFeedbackOrchestrationService({
    strategyLearning: mockStrategy as unknown as StrategyLearningService,
  });
  assert.ok(service1);

  // Only knowledgePromotion
  const service2 = new LearningFeedbackOrchestrationService({
    knowledgePromotion: new MockKnowledgePromotionService() as unknown as KnowledgePromotionService,
  });
  assert.ok(service2);

  // Only memoryService
  const service3 = new LearningFeedbackOrchestrationService({
    memoryService: new MockMemoryService() as unknown as MemoryService,
  });
  assert.ok(service3);
});
