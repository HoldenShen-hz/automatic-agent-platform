import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { MemoryService } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import {
  MemoryGateway,
  mapManagedMemoryLayerToRuntimeMemoryLayer,
  toManagedMemoryMinimal,
} from "../../../../../src/platform/five-plane-state-evidence/memory-gateway/index.js";

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
          memories.set(id, { ...existing, status: "archived", revokedAt, revocationReason: reason });
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

test("MemoryGateway blocks direct higher-layer writes", () => {
  const gateway = new MemoryGateway(new MemoryService(createMockStore()));

  assert.throws(() => {
    gateway.rememberDirect({
      tenantId: "tenant-1",
      scope: "project",
      content: "This memory should require proposal because it targets higher layer.",
      memoryLayer: "layer_5",
    });
  }, (error: unknown) => error instanceof ValidationError && error.message.includes("memory.direct_commit_requires_proposal"));
});

test("MemoryGateway commits approved proposal into managed memory", () => {
  const gateway = new MemoryGateway(new MemoryService(createMockStore()));
  const proposal = gateway.proposeMemory({
    missionId: "mission-1",
    tenantId: "tenant-1",
    actorId: "model",
    proposedLayer: "L5",
    proposedScope: "project",
    contentRef: "artifact:memory-content-1",
    sourceEvidenceIds: ["ev-1"],
    sourceTraceIds: ["trace-1"],
    confidence: 0.92,
    sensitivity: "internal",
    rationale: "Validated reusable project learning.",
  });

  const committed = gateway.commitProposal({
    proposal,
    tenantId: "tenant-1",
    remember: {
      scope: "project",
      content: "Validated reusable project learning with enough detail to persist safely.",
      memoryLayer: mapManagedMemoryLayerToRuntimeMemoryLayer(proposal.proposedLayer),
      qualityScore: proposal.confidence,
      classification: "internal",
    },
    approvedBy: "reviewer-1",
    approvalId: "approval-1",
    reasons: ["validated"],
  });

  assert.equal(committed.decision.decision, "approve");
  assert.equal(committed.decision.approvalId, "approval-1");
  assert.equal(committed.memory.layer, "L5");
  assert.equal(committed.memory.approvedBy, "reviewer-1");
});

test("MemoryGateway builds projection and managed memory views", () => {
  const service = new MemoryService(createMockStore());
  const record = service.remember({
    scope: "project",
    content: "Persistent memory with enough descriptive detail for projection building.",
    classification: "confidential",
    qualityScore: 0.75,
  });
  const managed = toManagedMemoryMinimal(record, { tenantId: "tenant-9" });
  const gateway = new MemoryGateway(service);
  const projection = gateway.buildProjection({
    missionId: "mission-9",
    tenantId: "tenant-9",
    memoryIds: [managed.memoryId],
    evidenceIds: ["ev-9"],
    allowedLayers: [managed.layer],
    tokenBudget: 2048,
  });

  assert.equal(managed.sensitivity, "confidential");
  assert.equal(projection.memoryIds[0], managed.memoryId);
  assert.ok(projection.projectionHash.length > 10);
});
