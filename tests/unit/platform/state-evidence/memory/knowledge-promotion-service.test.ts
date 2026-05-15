import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryRecord, MemoryLayer, MemorySourceTrustLevel } from "../../../../../src/platform/contracts/types/domain/task-types.js";
import {
  KnowledgePromotionService,
  DEFAULT_PROMOTION_RULES,
  type KnowledgePromotionTier,
  type PromotionRequest,
  type PromotionResult,
} from "../../../../../src/platform/five-plane-state-evidence/memory/index.js";

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString() as any;
  return {
    id: "mem_001",
    taskId: null,
    sessionId: "sess_001",
    agentId: "agent_001",
    executionId: "exec_001",
    memoryLayer: "layer_3" as MemoryLayer,
    scope: "session",
    contentJson: "{}",
    classification: "content",
    sourceTrustLevel: "trusted" as MemorySourceTrustLevel,
    qualityScore: null,
    hitCount: 0,
    createdAt: now,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// DEFAULT_PROMOTION_RULES tests
// =============================================================================

test("DEFAULT_PROMOTION_RULES has correct number of rules", () => {
  assert.equal(DEFAULT_PROMOTION_RULES.length, 2);
});

test("DEFAULT_PROMOTION_RULES personal to team has correct thresholds", () => {
  const rule = DEFAULT_PROMOTION_RULES.find(r => r.fromTier === "personal" && r.toTier === "team");
  assert.ok(rule);
  assert.equal(rule.minQualityScore, 0.65);
  assert.equal(rule.minImportanceScore, 0.55);
  assert.equal(rule.minHitCount, 5);
  assert.equal(rule.requiresVerification, false);
});

test("DEFAULT_PROMOTION_RULES team to company has correct thresholds", () => {
  const rule = DEFAULT_PROMOTION_RULES.find(r => r.fromTier === "team" && r.toTier === "company");
  assert.ok(rule);
  assert.equal(rule.minQualityScore, 0.8);
  assert.equal(rule.minImportanceScore, 0.75);
  assert.equal(rule.minHitCount, 15);
  assert.equal(rule.requiresVerification, true);
});

// =============================================================================
// KnowledgePromotionService.evaluatePromotion tests
// =============================================================================

test("KnowledgePromotionService constructor accepts custom rules", () => {
  const customRules = DEFAULT_PROMOTION_RULES.slice(0, 1);
  const service = new KnowledgePromotionService(customRules);
  assert.equal(service.getRules().length, 1);
});

test("KnowledgePromotionService.evaluatePromotion returns canPromote false for no rule", () => {
  // company scope maps to company tier, and there's no promotion rule FROM company tier
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({ scope: "company" });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some(b => b.includes("no_rule")));
});

test("KnowledgePromotionService.evaluatePromotion returns canPromote false for no rule from personal to company", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({ scope: "user" }); // personal tier
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion returns canPromote true when thresholds met", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
  assert.equal(result.blockers.length, 0);
});

test("KnowledgePromotionService.evaluatePromotion blocks low quality score", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.3,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some(b => b.includes("qualityScore")));
});

test("KnowledgePromotionService.evaluatePromotion blocks low importance score", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.3,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some(b => b.includes("importanceScore")));
});

test("KnowledgePromotionService.evaluatePromotion blocks low hit count", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 2,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some(b => b.includes("hitCount")));
});

test("KnowledgePromotionService.evaluatePromotion handles low hitCount (zero)", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 0,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion handles low qualityScore (zero)", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion handles low importanceScore (zero)", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

// =============================================================================
// KnowledgePromotionService.promote tests
// =============================================================================

test("KnowledgePromotionService.promote returns failure when evaluation fails", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.3,
    importanceScore: 0.3,
    hitCount: 1,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, false);
  assert.equal(result.lineage, null);
  assert.equal(result.rejected, true);
});

test("KnowledgePromotionService.promote creates lineage when successful", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
    contentHash: "abc123",
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    teamId: "team_1",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.ok(result.lineage);
  assert.equal(result.lineage.promotionTier, "team");
  assert.equal(result.lineage.promotedBy, "user_1");
  assert.equal(result.lineage.originalMemoryId, memory.id);
  assert.equal(result.lineage.contentHash, "abc123");
  assert.equal(result.rejected, false);
});

test("KnowledgePromotionService.promote stores teamId in metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    teamId: "team_special",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.metadata.teamId, "team_special");
});

test("KnowledgePromotionService.promote stores projectId in metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    projectId: "project_123",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.metadata.projectId, "project_123");
});

test("KnowledgePromotionService.promote stores tags in metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    tags: ["tag1", "tag2"],
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.deepEqual(result.lineage.metadata.tags, ["tag1", "tag2"]);
});

test("KnowledgePromotionService.promote stores categories in metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    categories: ["cat1", "cat2"],
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.deepEqual(result.lineage.metadata.categories, ["cat1", "cat2"]);
});

test("KnowledgePromotionService.promote stores verificationNotes in metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    verificationNotes: "Verified by domain expert",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.metadata.verificationNotes, "Verified by domain expert");
});

test("KnowledgePromotionService.promote for company tier sets unverified status", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "project",
    qualityScore: 0.9,
    importanceScore: 0.85,
    hitCount: 20,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "user_1",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.verificationStatus, "unverified");
});

// =============================================================================
// KnowledgePromotionService.getLineage tests
// =============================================================================

test("KnowledgePromotionService.getLineage returns correct lineages", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages.length, 1);
});

test("KnowledgePromotionService.getLineage returns empty for unknown memory", () => {
  const service = new KnowledgePromotionService();
  const lineages = service.getLineage("nonexistent");
  assert.equal(lineages.length, 0);
});

test("KnowledgePromotionService.getLineage finds by originalMemoryId", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.originalMemoryId, memory.id);
});

test("KnowledgePromotionService.getLineage finds by sourceMemoryId", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.sourceMemoryId, memory.id);
});

// =============================================================================
// KnowledgePromotionService.getLineagesByTier tests
// =============================================================================

test("KnowledgePromotionService.getLineagesByTier returns correct lineages", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByTier("team");
  assert.equal(lineages.length, 1);
});

test("KnowledgePromotionService.getLineagesByTier returns empty for wrong tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByTier("company");
  assert.equal(lineages.length, 0);
});

// =============================================================================
// KnowledgePromotionService.getLineagesByTeam tests
// =============================================================================

test("KnowledgePromotionService.getLineagesByTeam returns correct lineages", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    teamId: "team_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByTeam("team_1");
  assert.equal(lineages.length, 1);
});

test("KnowledgePromotionService.getLineagesByTeam returns empty for unknown team", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    teamId: "team_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByTeam("team_unknown");
  assert.equal(lineages.length, 0);
});

// =============================================================================
// KnowledgePromotionService.getLineagesByProject tests
// =============================================================================

test("KnowledgePromotionService.getLineagesByProject returns correct lineages", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    projectId: "project_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByProject("project_1");
  assert.equal(lineages.length, 1);
});

test("KnowledgePromotionService.getLineagesByProject returns empty for unknown project", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    projectId: "project_1",
  };
  service.promote(request, memory);
  const lineages = service.getLineagesByProject("project_unknown");
  assert.equal(lineages.length, 0);
});

// =============================================================================
// KnowledgePromotionService.updateVerificationStatus tests
// =============================================================================

test("KnowledgePromotionService.updateVerificationStatus returns false for unknown lineage", () => {
  const service = new KnowledgePromotionService();
  assert.equal(service.updateVerificationStatus("nonexistent", "verified"), false);
});

test("KnowledgePromotionService.updateVerificationStatus updates status", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage);
  const updated = service.updateVerificationStatus(result.lineage.id, "verified", "looks good");
  assert.equal(updated, true);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.verificationStatus, "verified");
  assert.equal(lineages[0]?.metadata.verificationNotes, "looks good");
});

test("KnowledgePromotionService.updateVerificationStatus can set deprecated status", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  const result = service.promote(request, memory);
  service.updateVerificationStatus(result.lineage!.id, "deprecated");
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.verificationStatus, "deprecated");
});

test("KnowledgePromotionService.updateVerificationStatus can set rejected status", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  const result = service.promote(request, memory);
  service.updateVerificationStatus(result.lineage!.id, "rejected", "Failed review");
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.verificationStatus, "rejected");
  assert.equal(lineages[0]?.metadata.verificationNotes, "Failed review");
});

// =============================================================================
// KnowledgePromotionService.getPromotionChain tests
// =============================================================================

test("KnowledgePromotionService.getPromotionChain returns empty for unknown memory", () => {
  const service = new KnowledgePromotionService();
  const chain = service.getPromotionChain("nonexistent");
  assert.equal(chain.length, 0);
});

test("KnowledgePromotionService.getPromotionChain returns empty when no lineage exists", () => {
  const service = new KnowledgePromotionService();
  const chain = service.getPromotionChain("mem_001");
  assert.equal(chain.length, 0);
});

test("KnowledgePromotionService.getRules returns all rules", () => {
  const service = new KnowledgePromotionService();
  const rules = service.getRules();
  assert.equal(rules.length, 2);
});

// =============================================================================
// KnowledgePromotionService tierFromScope tests
// =============================================================================

test("KnowledgePromotionService handles user scope as personal tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  // Should be able to promote from user (personal) to team
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles project scope as team tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "project",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  // Should be able to promote from project (team) to company
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles workspace scope as team tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "workspace",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles unknown scope as personal tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "unknown",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  // Unknown scope defaults to personal
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

// =============================================================================
// KnowledgePromotionService getPromotionChain with real chains
// =============================================================================

test("KnowledgePromotionService.getPromotionChain returns single entry for direct promotion", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  };
  service.promote(request, memory);
  const chain = service.getPromotionChain(memory.id);
  assert.equal(chain.length, 1);
});

test("KnowledgePromotionService.getPromotionChain follows promotion chain correctly", () => {
  const service = new KnowledgePromotionService();

  // First promotion: personal -> team
  const memory1 = createMemoryRecord({
    id: "mem_first",
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result1 = service.promote({
    memoryId: memory1.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory1);
  assert.ok(result1.lineage);

  // Chain should start from mem_first as root
  const chain = service.getPromotionChain(memory1.id);
  assert.equal(chain.length, 1);
  assert.equal(chain[0]?.originalMemoryId, memory1.id);
});

test("KnowledgePromotionService.getPromotionChain returns empty for memory with only company lineage", () => {
  const service = new KnowledgePromotionService();
  // company scope maps to company tier, and there's no promotion rule FROM company
  const memory = createMemoryRecord({
    scope: "company",
    qualityScore: 0.9,
    importanceScore: 0.8,
    hitCount: 20,
  });
  // Try to get chain for memory that was promoted to company (shouldn't happen in normal flow)
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin",
  }, memory);
  // This would fail since there's no rule from company -> anything
  assert.equal(result.success, false);
});

// =============================================================================
// Additional evaluatePromotion boundary tests
// =============================================================================

test("KnowledgePromotionService.evaluatePromotion passes at exact minQualityScore boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 0.65, exactly at boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.65,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService.evaluatePromotion passes at exact minImportanceScore boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 0.55, exactly at boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.55,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService.evaluatePromotion passes at exact minHitCount boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 5 hits, exactly at boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 5,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService.evaluatePromotion fails just below minQualityScore boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 0.65, just below boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.6499,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion fails just below minImportanceScore boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 0.55, just below boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.5499,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion fails just below minHitCount boundary", () => {
  const service = new KnowledgePromotionService();
  // personal->team requires 5 hits, just below boundary
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 4,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

// =============================================================================
// Additional scope tier mapping tests
// =============================================================================

test("KnowledgePromotionService handles personal scope as personal tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "personal",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles session scope as personal tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "session",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  // session scope defaults to personal tier
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles team scope as team tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "team",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, true);
});

test("KnowledgePromotionService handles company scope as company tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "company",
    qualityScore: 0.9,
    importanceScore: 0.8,
    hitCount: 20,
  });
  // No promotion rule from company, so should fail for any target
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService handles organization scope as company tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "organization",
    qualityScore: 0.9,
    importanceScore: 0.8,
    hitCount: 20,
  });
  // organization maps to company tier - no rule from company
  const result = service.evaluatePromotion(memory, "personal");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService handles global scope as company tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "global",
    qualityScore: 0.9,
    importanceScore: 0.8,
    hitCount: 20,
  });
  // global maps to company tier - no rule from company
  const result = service.evaluatePromotion(memory, "personal");
  assert.equal(result.canPromote, false);
});

// =============================================================================
// Additional promote edge cases
// =============================================================================

test("KnowledgePromotionService.promote preserves originalMemoryId in lineage", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.originalMemoryId, memory.id);
  assert.equal(result.lineage.sourceMemoryId, memory.id);
});

test("KnowledgePromotionService.promote includes qualityScore and importanceScore in lineage", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.87,
    importanceScore: 0.92,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.qualityScore, 0.87);
  assert.equal(result.lineage.importanceScore, 0.92);
});

test("KnowledgePromotionService.promote rejects when promote fails evaluation", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.1, // Too low
    importanceScore: 0.1,
    hitCount: 1,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);
  assert.equal(result.success, false);
  assert.equal(result.rejected, true);
  assert.ok(result.rejectionReason?.includes("qualityScore"));
});

// =============================================================================
// Additional getLineage edge cases
// =============================================================================

test("KnowledgePromotionService.getLineage finds by rootMemoryId", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);

  // getLineage should find by rootMemoryId too
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages.length, 1);
});

test("KnowledgePromotionService.getLineage returns all matching lineages", () => {
  const service = new KnowledgePromotionService();

  // Create two memories and promote both
  const memory1 = createMemoryRecord({
    id: "mem_a",
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const memory2 = createMemoryRecord({
    id: "mem_b",
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });

  service.promote({ memoryId: memory1.id, targetTier: "team", promotedBy: "user_1" }, memory1);
  service.promote({ memoryId: memory2.id, targetTier: "team", promotedBy: "user_1" }, memory2);

  // Each should have its own lineage
  const lineages1 = service.getLineage(memory1.id);
  const lineages2 = service.getLineage(memory2.id);
  assert.equal(lineages1.length, 1);
  assert.equal(lineages2.length, 1);
});

// =============================================================================
// Additional updateVerificationStatus tests
// =============================================================================

test("KnowledgePromotionService.updateVerificationStatus can set pending_review status", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);
  service.updateVerificationStatus(result.lineage!.id, "pending_review", "Under review");
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.verificationStatus, "pending_review");
});

test("KnowledgePromotionService.updateVerificationStatus updates notes when provided", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);

  service.updateVerificationStatus(result.lineage!.id, "verified", "First review");
  service.updateVerificationStatus(result.lineage!.id, "verified", "Second review - confirmed");

  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.metadata.verificationNotes, "Second review - confirmed");
});

test("KnowledgePromotionService.updateVerificationStatus replaces lineage entry instead of mutating returned snapshot", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);

  const originalLineage = result.lineage!;
  service.updateVerificationStatus(originalLineage.id, "verified", "Reviewed");
  const storedLineage = service.getLineage(memory.id)[0]!;

  assert.equal(originalLineage.verificationStatus, "unverified");
  assert.equal(storedLineage.verificationStatus, "verified");
  assert.equal(storedLineage.metadata.verificationNotes, "Reviewed");
});

test("KnowledgePromotionService.updateVerificationStatus does not overwrite notes when not provided", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
    verificationNotes: "Original notes",
  }, memory);

  service.updateVerificationStatus(result.lineage!.id, "verified");

  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.metadata.verificationNotes, "Original notes");
});

// =============================================================================
// Company tier promotion tests
// =============================================================================

test("KnowledgePromotionService.promote to company tier succeeds with high scores", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "project",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin",
  }, memory);
  assert.equal(result.success, true);
  assert.ok(result.lineage);
  assert.equal(result.lineage.promotionTier, "company");
});

test("KnowledgePromotionService.promote to company tier fails without verification requirements met", () => {
  const service = new KnowledgePromotionService();
  // project scope -> team tier requires: minQualityScore 0.8, minImportanceScore 0.75, minHitCount 15
  // team -> company also requires verification
  const memory = createMemoryRecord({
    scope: "project",
    qualityScore: 0.7, // Below 0.8 threshold
    importanceScore: 0.8,
    hitCount: 20,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin",
  }, memory);
  assert.equal(result.success, false);
  assert.equal(result.rejected, true);
});

// =============================================================================
// Empty and null value handling tests
// =============================================================================

test("KnowledgePromotionService.evaluatePromotion handles missing qualityScore as zero", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: null,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion handles missing importanceScore as zero", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: null,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.evaluatePromotion handles missing hitCount as zero", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: null,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService.promote handles null contentHash", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
    contentHash: null,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);
  assert.ok(result.lineage);
  assert.equal(result.lineage.contentHash, "");
});

// =============================================================================
// Custom rules tests
// =============================================================================

test("KnowledgePromotionService with empty custom rules rejects all promotions", () => {
  const service = new KnowledgePromotionService([]);
  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 1.0,
    importanceScore: 1.0,
    hitCount: 1000,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("KnowledgePromotionService with custom rule accepts non-standard tier", () => {
  // Create a service with a custom rule allowing company->company (not normally allowed)
  const customRules = [
    {
      fromTier: "company" as const,
      toTier: "company" as const,
      minQualityScore: 0.5,
      minImportanceScore: 0.5,
      minHitCount: 1,
      requiresVerification: false,
    },
  ];
  const service = new KnowledgePromotionService(customRules);
  const memory = createMemoryRecord({
    scope: "company",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, true);
});
