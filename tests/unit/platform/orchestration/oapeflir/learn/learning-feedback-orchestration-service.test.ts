import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { MemoryService } from "../../../../../../src/platform/state-evidence/memory/memory-service.js";
import {
  LearningFeedbackOrchestrationService,
  type LearningFeedbackOrchestrationInput,
  type LearningObject,
} from "../../../../../../src/platform/orchestration/oapeflir/learn/index.js";

function createLearningSignal(
  overrides: Partial<LearningFeedbackOrchestrationInput["signals"][number]> = {},
): LearningFeedbackOrchestrationInput["signals"][number] {
  return {
    learningSignalId: "ls_1",
    taskId: "task_1",
    sourceFeedbackId: "fb_1",
    learningType: "recovery_playbook",
    confidence: 0.82,
    valueSummary: "Retry with backoff and limit the search scope.",
    evidenceRefs: ["artifact:ops-1"],
    sourceSignalIds: ["signal-1"],
    relatedSignalIds: [],
    evidence: { source: "postmortem" },
    generatedAt: 1_713_564_800_000,
    ...overrides,
  };
}

function createMemoryRecord(memoryId: string, overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: memoryId,
    taskId: "task_1",
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_5",
    scope: "evolution",
    contentJson: "{\"content\":\"learning memory\"}",
    classification: "learning",
    sourceTrustLevel: "trusted",
    qualityScore: 0.82,
    hitCount: 0,
    createdAt: "2026-04-20T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "rule",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: "hash",
    ...overrides,
  };
}

test("LearningFeedbackOrchestrationService deduplicates learned objects and persists promotion evidence", () => {
  let promotedObjects: LearningObject[] = [];
  const rememberedInputs: string[] = [];
  const memoryService = {
    remember(input: { content: string }) {
      rememberedInputs.push(input.content);
      return createMemoryRecord(`mem_${rememberedInputs.length}`);
    },
  } as unknown as MemoryService;
  const service = new LearningFeedbackOrchestrationService({
    knowledgePromotion: {
      promote(learningObjects: readonly LearningObject[]) {
        promotedObjects = [...learningObjects];
        return {
          promotedCount: learningObjects.length,
          failedCount: 0,
          knowledgeDocumentIds: learningObjects.map((learningObject) => `doc:${learningObject.learningObjectId}`),
        };
      },
    } as any,
    memoryService,
  });

  const duplicate = createLearningSignal({ learningSignalId: "ls_2", sourceSignalIds: ["signal-2"] });
  const result = service.process({
    taskId: "task_1",
    sessionId: "session_1",
    agentId: "agent_1",
    signals: [createLearningSignal(), duplicate],
  });

  assert.equal(result.learningObjects.length, 1);
  assert.equal(result.skippedDuplicateCount, 1);
  assert.equal(result.promotedKnowledge.promotedCount, 1);
  assert.equal(result.rememberedMemories.length, 1);
  assert.equal(result.learningTypeCounts.recovery_playbook, 1);
  assert.equal(promotedObjects.length, 1);
  assert.match(rememberedInputs[0] ?? "", /Recommendation:/);
});

test("LearningFeedbackOrchestrationService supports dry-run execution without knowledge or memory writes", () => {
  const service = new LearningFeedbackOrchestrationService();

  const result = service.process({
    taskId: "task_2",
    signals: [
      createLearningSignal({
        learningSignalId: "ls_3",
        learningType: "user_correction",
        confidence: 0.95,
        valueSummary: "User corrected the customer segment mapping before publish.",
        evidenceRefs: ["artifact:ops-2"],
      }),
    ],
    promoteToKnowledge: false,
    rememberValidatedLearnings: false,
  });

  assert.equal(result.learningObjects.length, 1);
  assert.equal(result.promotedKnowledge.promotedCount, 0);
  assert.equal(result.rememberedMemories.length, 0);
  assert.equal(result.learningTypeCounts.user_correction, 1);
});
