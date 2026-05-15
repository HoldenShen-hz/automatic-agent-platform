/**
 * Integration Tests: Semantic Knowledge Graph
 *
 * Tests for knowledge promotion service integration with memory providers,
 * cross-tier operations, and lineage tracking across organizational boundaries.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgePromotionService,
  DEFAULT_PROMOTION_RULES,
  type PromotionRequest,
  type KnowledgePromotionTier,
} from "../../../../../src/platform/five-plane-state-evidence/memory/knowledge-promotion-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_integ_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_integration",
    agentId: "agent_integration",
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "integration knowledge content" }),
    classification: "knowledge",
    sourceTrustLevel: "trusted",
    qualityScore: 0.75,
    hitCount: 10,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "fact",
    status: "active",
    importanceScore: 0.7,
    freshnessScore: 0.85,
    contentHash: "hash_integ_" + Math.random().toString(36).slice(2, 6),
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// Integration: Cross-Tier Knowledge Promotion
// =============================================================================

test("Integration: personal to team promotion with verification", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "user", // personal tier
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 8,
  });

  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_promoter",
    teamId: "team_integration",
    tags: ["integration", "testing"],
  };

  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.equal(result.lineage!.promotionTier, "team");
  assert.equal(result.lineage!.metadata.teamId, "team_integration");
});

test("Integration: team to company promotion requires higher thresholds", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "project", // team tier
    qualityScore: 0.7, // below 0.8 threshold for company
    importanceScore: 0.6,
    hitCount: 10,
  });

  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin_1",
  };

  const result = service.promote(request, memory);
  assert.equal(result.success, false);
  assert.equal(result.rejected, true);
});

test("Integration: successful team to company promotion", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "project",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });

  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin_integration",
    projectId: "proj_corp",
  };

  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.equal(result.lineage!.promotionTier, "company");
  assert.equal(result.lineage!.metadata.projectId, "proj_corp");
});

// =============================================================================
// Integration: Lineage Tracking
// =============================================================================

test("Integration: getLineage returns all promotions for a memory", () => {
  const service = new KnowledgePromotionService();

  // First promotion: user (personal) -> team
  const memory1 = createMemory({ scope: "user", qualityScore: 0.75, importanceScore: 0.65, hitCount: 8 });
  const result1 = service.promote({
    memoryId: memory1.id,
    targetTier: "team",
    promotedBy: "agent_1",
    teamId: "team_alpha",
  }, memory1);
  assert.equal(result1.success, true, `promotion 1 failed: ${result1.rejectionReason}`);

  // Second promotion: project (team) -> company
  const memory2 = createMemory({ scope: "project", qualityScore: 0.85, importanceScore: 0.8, hitCount: 20 });
  const result2 = service.promote({
    memoryId: memory2.id,
    targetTier: "company",
    promotedBy: "admin_1",
  }, memory2);
  assert.equal(result2.success, true, `promotion 2 failed: ${result2.rejectionReason}`);

  const lineages1 = service.getLineage(memory1.id);
  assert.equal(lineages1.length, 1, `expected 1 lineage for memory1, got ${lineages1.length}`);
  assert.equal(lineages1[0]!.promotionTier, "team");

  const lineages2 = service.getLineage(memory2.id);
  assert.equal(lineages2.length, 1, `expected 1 lineage for memory2, got ${lineages2.length}`);
  assert.equal(lineages2[0]!.promotionTier, "company");
});

test("Integration: getLineagesByTier returns correct tier promotions", () => {
  const service = new KnowledgePromotionService();

  // Memory 1: user (personal) -> team
  const memory1 = createMemory({ scope: "user", qualityScore: 0.75, importanceScore: 0.65, hitCount: 8 });
  const result1 = service.promote({ memoryId: memory1.id, targetTier: "team", promotedBy: "a" }, memory1);
  assert.equal(result1.success, true, `memory1 failed: ${result1.rejectionReason}`);

  // Memory 2: project (team) -> company
  const memory2 = createMemory({ scope: "project", qualityScore: 0.85, importanceScore: 0.8, hitCount: 20 });
  const result2 = service.promote({ memoryId: memory2.id, targetTier: "company", promotedBy: "b" }, memory2);
  assert.equal(result2.success, true, `memory2 failed: ${result2.rejectionReason}`);

  const teamLineages = service.getLineagesByTier("team");
  assert.equal(teamLineages.length, 1);
  assert.equal(teamLineages[0]!.promotionTier, "team");

  const companyLineages = service.getLineagesByTier("company");
  assert.equal(companyLineages.length, 1);
  assert.equal(companyLineages[0]!.promotionTier, "company");
});

test("Integration: getLineagesByTeam filters correctly", () => {
  const service = new KnowledgePromotionService();

  const memory1 = createMemory({ scope: "session" });
  const memory2 = createMemory({ scope: "session" });

  service.promote({
    memoryId: memory1.id,
    targetTier: "team",
    promotedBy: "agent_1",
    teamId: "team_beta",
  }, memory1);

  service.promote({
    memoryId: memory2.id,
    targetTier: "team",
    promotedBy: "agent_2",
    teamId: "team_gamma",
  }, memory2);

  const betaLineages = service.getLineagesByTeam("team_beta");
  assert.equal(betaLineages.length, 1);
  assert.equal(betaLineages[0]!.metadata.teamId, "team_beta");

  const gammaLineages = service.getLineagesByTeam("team_gamma");
  assert.equal(gammaLineages.length, 1);
  assert.equal(gammaLineages[0]!.metadata.teamId, "team_gamma");

  const unknownLineages = service.getLineagesByTeam("nonexistent_team");
  assert.equal(unknownLineages.length, 0);
});

test("Integration: getLineagesByProject filters correctly", () => {
  const service = new KnowledgePromotionService();

  const memory = createMemory({ scope: "session" });
  service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_proj",
    projectId: "proj_integration",
  }, memory);

  const lineages = service.getLineagesByProject("proj_integration");
  assert.equal(lineages.length, 1);
  assert.equal(lineages[0]!.metadata.projectId, "proj_integration");
});

// =============================================================================
// Integration: Verification Status Updates
// =============================================================================

test("Integration: verification status transitions", () => {
  const service = new KnowledgePromotionService();

  const memory = createMemory({
    scope: "session",
    qualityScore: 0.8,
    importanceScore: 0.75,
    hitCount: 12,
  });

  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_verify",
  }, memory);

  assert.equal(result.lineage!.verificationStatus, "unverified");

  // Update to pending_review
  service.updateVerificationStatus(result.lineage!.id, "pending_review");
  let lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]!.verificationStatus, "pending_review");

  // Update to verified
  service.updateVerificationStatus(result.lineage!.id, "verified", "Content verified by team lead");
  lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]!.verificationStatus, "verified");
  assert.equal(lineages[0]!.metadata.verificationNotes, "Content verified by team lead");
});

test("Integration: rejected verification status", () => {
  const service = new KnowledgePromotionService();

  const memory = createMemory({
    scope: "session",
    qualityScore: 0.8,
    importanceScore: 0.75,
    hitCount: 12,
  });

  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_reject",
  }, memory);

  service.updateVerificationStatus(result.lineage!.id, "rejected", "Inaccurate content");
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]!.verificationStatus, "rejected");
});

// =============================================================================
// Integration: Custom Promotion Rules
// =============================================================================

test("Integration: custom rules override defaults", () => {
  const customRules = [
    {
      fromTier: "personal" as KnowledgePromotionTier,
      toTier: "team" as KnowledgePromotionTier,
      minQualityScore: 0.5,
      minImportanceScore: 0.4,
      minHitCount: 3,
      requiresVerification: false,
    },
  ];

  const service = new KnowledgePromotionService(customRules);
  assert.equal(service.getRules().length, 1);

  const memory = createMemory({
    scope: "user",
    qualityScore: 0.55,
    importanceScore: 0.45,
    hitCount: 4,
  });

  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_custom",
  }, memory);

  // With default rules (0.65 threshold), this would fail
  // With custom rules (0.5 threshold), this should pass
  assert.equal(result.success, true);
});

// =============================================================================
// Integration: Quality Score Boundaries
// =============================================================================

test("Integration: memory at exactly the quality threshold passes", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.65, // exactly at threshold
    importanceScore: 0.6,
    hitCount: 6,
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("Integration: memory just below quality threshold fails", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.64, // just below 0.65 threshold
    importanceScore: 0.6,
    hitCount: 6,
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

test("Integration: memory with null quality score fails evaluation", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: null as any,
    importanceScore: 0.6,
    hitCount: 6,
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

// =============================================================================
// Integration: Importance Score Boundaries
// =============================================================================

test("Integration: memory meets both quality and importance thresholds", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: 6,
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
  assert.equal(result.blockers.length, 0);
});

test("Integration: fails if importance score below threshold even with high quality", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.9, // high quality
    importanceScore: 0.3, // below 0.55 threshold
    hitCount: 6,
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("importanceScore")));
});

// =============================================================================
// Integration: Hit Count Boundaries
// =============================================================================

test("Integration: memory with exactly minHitCount passes", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: 5, // exactly at threshold
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
});

test("Integration: memory with one less than minHitCount fails", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: 4, // one below threshold
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("hitCount")));
});

test("Integration: memory with null hit count treated as zero", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: null as any, // null
  });

  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
});

// =============================================================================
// Integration: Multiple Promotions Tracking
// =============================================================================

test("Integration: multiple memories can be promoted to same tier", () => {
  const service = new KnowledgePromotionService();

  const memory1 = createMemory({ scope: "session", qualityScore: 0.8, importanceScore: 0.7, hitCount: 10 });
  const memory2 = createMemory({ scope: "agent", qualityScore: 0.85, importanceScore: 0.8, hitCount: 15 });

  service.promote({ memoryId: memory1.id, targetTier: "team", promotedBy: "agent_1" }, memory1);
  service.promote({ memoryId: memory2.id, targetTier: "team", promotedBy: "agent_2" }, memory2);

  const teamLineages = service.getLineagesByTier("team");
  assert.equal(teamLineages.length, 2);
});

test("Integration: all promotion rules have increasing thresholds", () => {
  const rules = DEFAULT_PROMOTION_RULES;
  for (let i = 1; i < rules.length; i++) {
    assert.ok(
      rules[i]!.minQualityScore > rules[i - 1]!.minQualityScore,
      `Rule ${i} quality should exceed rule ${i - 1}`,
    );
    assert.ok(
      rules[i]!.minImportanceScore > rules[i - 1]!.minImportanceScore,
      `Rule ${i} importance should exceed rule ${i - 1}`,
    );
    assert.ok(
      rules[i]!.minHitCount > rules[i - 1]!.minHitCount,
      `Rule ${i} hit count should exceed rule ${i - 1}`,
    );
  }
});