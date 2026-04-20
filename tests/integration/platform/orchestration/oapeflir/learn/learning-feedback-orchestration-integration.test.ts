import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { MemoryService } from "../../../../../../src/platform/state-evidence/memory/memory-service.js";
import { KnowledgePlaneService } from "../../../../../../src/platform/state-evidence/knowledge/knowledge-plane-service.js";
import {
  KnowledgePromotionService,
  LearningFeedbackOrchestrationService,
} from "../../../../../../src/platform/orchestration/oapeflir/learn/index.js";

function createMockStore(): AuthoritativeTaskStore {
  const memories = new Map<string, MemoryRecord>();

  return {
    memory: {
      insertMemory: (record: MemoryRecord) => {
        memories.set(record.id, { ...record });
      },
      listMemories: (query: { scopes?: string[] } = {}) => {
        let result = [...memories.values()];
        if (query.scopes && query.scopes.length > 0) {
          result = result.filter((memory) => query.scopes!.includes(memory.scope));
        }
        return result;
      },
      getMemory: (id: string) => memories.get(id) ?? null,
      recordMemoryAccess: () => {},
      revokeMemory: () => {},
      findMemoryByContentHash: (_contentHash: string, _scope: string) => null,
      getMemoryQualityReport: () => ({
        totalCount: memories.size,
        activeCount: memories.size,
        expiredCount: 0,
        revokedCount: 0,
        averageQualityScore: 0.9,
        byScope: [],
        byLayer: [],
        byClassification: [],
        recallStats: { totalHits: 0, averageHits: 0, memoriesNeverAccessed: memories.size },
      }),
    },
  } as unknown as AuthoritativeTaskStore;
}

test("integration: learning feedback orchestration promotes validated learnings into knowledge and evolution memory", () => {
  const knowledgePlane = new KnowledgePlaneService();
  knowledgePlane.registerNamespace({
    namespaceId: "ns_learned_patterns",
    path: "system/learned-patterns",
    description: "Validated learned patterns",
    ownerDomainId: "platform",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 365,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "reviewed",
    maxDocuments: 1000,
    maxTotalSizeBytes: 5_000_000,
  });
  const memoryStore = createMockStore();
  const memoryService = new MemoryService(memoryStore);
  const service = new LearningFeedbackOrchestrationService({
    knowledgePromotion: new KnowledgePromotionService({ knowledgePlane }),
    memoryService,
  });

  const result = service.process({
    taskId: "task_learning_1",
    executionId: "exec_learning_1",
    sessionId: "session_learning_1",
    agentId: "agent_learning_1",
    signals: [
      {
        learningSignalId: "ls_backoff",
        taskId: "task_learning_1",
        sourceFeedbackId: "fb_learning_1",
        learningType: "recovery_playbook",
        confidence: 0.88,
        valueSummary: "Use exponential backoff and reduce the query scope before retrying.",
        evidenceRefs: ["artifact:postmortem-1"],
        sourceSignalIds: ["signal-backoff"],
        relatedSignalIds: [],
        evidence: { source: "incident-review" },
        generatedAt: 1_713_564_800_000,
      },
    ],
  });

  const hits = knowledgePlane.query("exponential backoff", {
    namespace: "system/learned-patterns",
    limit: 5,
  });
  const evolutionMemories = memoryService.recall({
    taskId: "task_learning_1",
    scopes: ["evolution"],
  });

  assert.equal(result.learningObjects.length, 1);
  assert.equal(result.promotedKnowledge.promotedCount, 1);
  assert.equal(result.rememberedMemories.length, 1);
  assert.ok(hits.length >= 1);
  assert.ok(hits.some((hit) => result.promotedKnowledge.knowledgeDocumentIds.includes(hit.documentId)));
  assert.ok(hits.some((hit) => hit.snippet.includes("exponential backoff")));
  assert.equal(evolutionMemories.length, 1);
  assert.equal(evolutionMemories[0]?.scope, "evolution");
  assert.equal(evolutionMemories[0]?.classification, "learning");
});
