import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { MemoryService } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { MemoryPrivacyWorkflowService } from "../../../../../src/platform/five-plane-state-evidence/memory-gateway/privacy-workflow.js";

function createMockStore(): AuthoritativeTaskStore {
  const memories = new Map<string, MemoryRecord>();

  return {
    memory: {
      insertMemory: (record: MemoryRecord) => {
        memories.set(record.id, { ...record });
      },
      listMemories: () => [...memories.values()],
      getMemory: (id: string) => memories.get(id) ?? null,
      recordMemoryAccess: () => {},
      revokeMemory: (id: string, revokedAt: string, reason: string) => {
        const existing = memories.get(id);
        if (existing != null) {
          memories.set(id, { ...existing, revokedAt, revocationReason: reason });
        }
      },
      findMemoryByContentHash: () => null,
      getMemoryQualityReport: () => ({
        totalCount: memories.size,
        activeCount: memories.size,
        expiredCount: 0,
        revokedCount: 0,
        averageQualityScore: null,
        byScope: [],
        byLayer: [],
        byClassification: [],
        recallStats: { totalHits: 0, averageHits: 0, memoriesNeverAccessed: 0 },
      }),
    },
  } as unknown as AuthoritativeTaskStore;
}

test("MemoryPrivacyWorkflowService exports selected memories", () => {
  const memoryService = new MemoryService(createMockStore());
  const record = memoryService.remember({
    scope: "project",
    content: "Privacy export test memory with enough detail for workflow validation.",
    classification: "confidential",
  });
  const workflow = new MemoryPrivacyWorkflowService(memoryService);

  const exported = workflow.exportMemories({
    tenantId: "tenant-1",
    requestedBy: "user-1",
    memoryIds: [record.id],
  });

  assert.equal(exported.memoryIds[0], record.id);
  assert.equal(exported.exportedMemories[0]?.classification, "confidential");
});

test("MemoryPrivacyWorkflowService builds delete workflow plans", () => {
  const memoryService = new MemoryService(createMockStore());
  const record = memoryService.remember({
    scope: "project",
    content: "Privacy delete test memory with enough detail for erasure planning.",
    classification: "restricted",
  });
  const workflow = new MemoryPrivacyWorkflowService(memoryService);

  const result = workflow.createDeleteWorkflow({
    tenantId: "tenant-2",
    requestedBy: "admin-1",
    subjectRef: "user:subject-1",
    memoryIds: [record.id],
    containsPii: true,
  });

  assert.equal(result.plan.status, "ready");
  assert.equal(result.plan.steps[0]?.targetKind, "memory");
  assert.equal(result.plan.steps[0]?.action, "erase");
});

test("MemoryPrivacyWorkflowService revokes memories", () => {
  const memoryService = new MemoryService(createMockStore());
  const record = memoryService.remember({
    scope: "project",
    content: "Privacy revoke test memory with enough detail for revocation flow.",
    classification: "internal",
  });
  const workflow = new MemoryPrivacyWorkflowService(memoryService);

  const result = workflow.revokeMemories([record.id], "owner-1", "tenant-3", "subject_requested");

  assert.equal(result.memoryIds[0], record.id);
  assert.equal(result.reason, "subject_requested");
});
