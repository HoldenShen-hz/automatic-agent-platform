/**
 * Unit Tests: Semantic Knowledge Graph
 *
 * Tests for knowledge promotion service which implements a semantic knowledge graph
 * with promotion chains (personal -> team -> company) and lineage tracking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgePromotionService,
  DEFAULT_PROMOTION_RULES,
  type KnowledgePromotionTier,
  type PromotionRequest,
  type PromotionResult,
  type KnowledgeLineage,
  type VerificationStatus,
} from "../../../../../src/platform/five-plane-state-evidence/memory/knowledge-promotion-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_test",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "test knowledge" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: "hash123",
    ...overrides,
  } as MemoryRecord;
}

// =============================================================================
// Default Promotion Rules Tests
// =============================================================================

test("DEFAULT_PROMOTION_RULES has 2 rules", () => {
  assert.equal(DEFAULT_PROMOTION_RULES.length, 2);
});

test("DEFAULT_PROMOTION_RULES personal to team has correct thresholds", () => {
  const rule = DEFAULT_PROMOTION_RULES.find((r) => r.fromTier === "personal" && r.toTier === "team");
  assert.ok(rule);
  assert.equal(rule!.minQualityScore, 0.65);
  assert.equal(rule!.minImportanceScore, 0.55);
  assert.equal(rule!.minHitCount, 5);
  assert.equal(rule!.requiresVerification, false);
});

test("DEFAULT_PROMOTION_RULES team to company has correct thresholds", () => {
  const rule = DEFAULT_PROMOTION_RULES.find((r) => r.fromTier === "team" && r.toTier === "company");
  assert.ok(rule);
  assert.equal(rule!.minQualityScore, 0.8);
  assert.equal(rule!.minImportanceScore, 0.75);
  assert.equal(rule!.minHitCount, 15);
  assert.equal(rule!.requiresVerification, true);
});

// =============================================================================
// KnowledgePromotionService Construction Tests
// =============================================================================

test("KnowledgePromotionService can be instantiated without rules", () => {
  const service = new KnowledgePromotionService();
  assert.ok(service !== undefined);
});

test("KnowledgePromotionService accepts custom rules", () => {
  const customRules = DEFAULT_PROMOTION_RULES.slice(0, 1);
  const service = new KnowledgePromotionService(customRules);
  assert.equal(service.getRules().length, 1);
});

test("getRules returns the configured rules", () => {
  const service = new KnowledgePromotionService();
  const rules = service.getRules();
  assert.ok(rules.length > 0);
  assert.deepEqual(rules, DEFAULT_PROMOTION_RULES);
});

// =============================================================================
// Evaluate Promotion Tests
// =============================================================================

test("evaluatePromotion: session memory can be promoted to team tier", () => {
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

test("evaluatePromotion: fails when quality score is below threshold", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.5, // below 0.65 threshold
    importanceScore: 0.6,
    hitCount: 6,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("qualityScore")));
});

test("evaluatePromotion: fails when importance score is below threshold", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.4, // below 0.55 threshold
    hitCount: 6,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("importanceScore")));
});

test("evaluatePromotion: fails when hit count is below threshold", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: 3, // below 5 threshold
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("hitCount")));
});

test("evaluatePromotion: fails when no rule exists for the transition", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "company",
    qualityScore: 0.9,
    importanceScore: 0.9,
    hitCount: 100,
  });
  // company -> (no rule exists), so this should fail
  const result = service.evaluatePromotion(memory, "company");
  assert.equal(result.canPromote, false);
});

test("evaluatePromotion: uses default quality score of 0 when null", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: null as any,
    importanceScore: 0.6,
    hitCount: 6,
  });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, false);
  assert.ok(result.blockers.some((b) => b.includes("qualityScore")));
});

// =============================================================================
// Promote Tests
// =============================================================================

test("promote: successfully promotes memory to team tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.7,
    importanceScore: 0.6,
    hitCount: 6,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
    teamId: "team_alpha",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.equal(result.rejected, false);
  assert.ok(result.lineage !== null);
  assert.equal(result.lineage!.promotionTier, "team");
  assert.equal(result.lineage!.promotedBy, "agent_123");
});

test("promote: successfully promotes memory to company tier", () => {
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
    promotedBy: "admin_001",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.equal(result.lineage!.promotionTier, "company");
});

test("promote: rejects when promotion thresholds not met", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.3,
    importanceScore: 0.3,
    hitCount: 1,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, false);
  assert.equal(result.rejected, true);
  assert.ok(result.lineage === null);
  assert.ok(result.rejectionReason !== null);
});

test("promote: creates lineage with correct metadata", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_xyz",
    teamId: "team_beta",
    tags: ["important", "documentation"],
    categories: ["tech", "design"],
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage !== null);
  assert.equal(result.lineage!.metadata.teamId, "team_beta");
  assert.deepEqual(result.lineage!.metadata.tags, ["important", "documentation"]);
  assert.deepEqual(result.lineage!.metadata.categories, ["tech", "design"]);
});

test("promote: sets verification status to unverified by default", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session", // maps to personal tier
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team", // personal -> team is valid
    promotedBy: "promoter_1",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  assert.equal(result.lineage!.verificationStatus, "unverified");
});

test("promote: stores content hash in lineage", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
    contentHash: "abc123hash",
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
  };
  const result = service.promote(request, memory);
  assert.equal(result.lineage!.contentHash, "abc123hash");
});

// =============================================================================
// Get Lineage Tests
// =============================================================================

test("getLineage: returns empty array for unknown memory", () => {
  const service = new KnowledgePromotionService();
  const lineages = service.getLineage("nonexistent_mem");
  assert.deepEqual(lineages, []);
});

test("getLineage: returns lineage for promoted memory", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
  };
  service.promote(request, memory);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages.length, 1);
  assert.equal(lineages[0]!.originalMemoryId, memory.id);
});

test("getLineage: finds lineage by source memory ID", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
  };
  service.promote(request, memory);
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]!.sourceMemoryId, memory.id);
});

// =============================================================================
// Get Promotion Chain Tests
// =============================================================================

test("getPromotionChain: returns empty for memory with no lineage", () => {
  const service = new KnowledgePromotionService();
  const chain = service.getPromotionChain("nonexistent");
  assert.deepEqual(chain, []);
});

// =============================================================================
// Update Verification Status Tests
// =============================================================================

test("updateVerificationStatus: updates status to verified", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_123",
  };
  const result = service.promote(request, memory);
  assert.ok(result.lineage !== null);
  const updated = service.updateVerificationStatus(result.lineage!.id, "verified", "Looks good");
  assert.equal(updated, true);
});

test("updateVerificationStatus: returns false for unknown lineage", () => {
  const service = new KnowledgePromotionService();
  const updated = service.updateVerificationStatus("nonexistent_id", "verified");
  assert.equal(updated, false);
});

test("updateVerificationStatus: adds verification notes", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "project", // maps to team tier
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  const request: PromotionRequest = {
    memoryId: memory.id,
    targetTier: "company",
    promotedBy: "admin_1",
  };
  const result = service.promote(request, memory);
  assert.equal(result.success, true);
  service.updateVerificationStatus(result.lineage!.id, "verified", "Confirmed accurate");
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]!.metadata.verificationNotes, "Confirmed accurate");
});

// =============================================================================
// Get Lineages By Tier Tests
// =============================================================================

test("getLineagesByTier: returns lineages for specific tier", () => {
  const service = new KnowledgePromotionService();

  // Memory 1: session (personal) -> team promotion
  const memory1 = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  const result1 = service.promote({
    memoryId: memory1.id,
    targetTier: "team",
    promotedBy: "agent_1",
  }, memory1);
  assert.equal(result1.success, true, `memory1 promotion failed: ${result1.rejectionReason}`);

  // Memory 2: project (team) -> company promotion
  const memory2 = createMemory({
    scope: "project",
    qualityScore: 0.85,
    importanceScore: 0.8,
    hitCount: 20,
  });
  const result2 = service.promote({
    memoryId: memory2.id,
    targetTier: "company",
    promotedBy: "agent_2",
  }, memory2);
  assert.equal(result2.success, true, `memory2 promotion failed: ${result2.rejectionReason}`);

  const teamLineages = service.getLineagesByTier("team");
  const companyLineages = service.getLineagesByTier("company");

  assert.equal(teamLineages.length, 1);
  assert.equal(teamLineages[0]!.promotionTier, "team");
  assert.equal(companyLineages.length, 1);
  assert.equal(companyLineages[0]!.promotionTier, "company");
});

// =============================================================================
// Get Lineages By Team Tests
// =============================================================================

test("getLineagesByTeam: returns lineages for specific team", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_1",
    teamId: "team_gamma",
  }, memory);
  const lineages = service.getLineagesByTeam("team_gamma");
  assert.equal(lineages.length, 1);
  assert.equal(lineages[0]!.metadata.teamId, "team_gamma");
});

test("getLineagesByTeam: returns empty for unknown team", () => {
  const service = new KnowledgePromotionService();
  const lineages = service.getLineagesByTeam("nonexistent_team");
  assert.deepEqual(lineages, []);
});

// =============================================================================
// Get Lineages By Project Tests
// =============================================================================

test("getLineagesByProject: returns lineages for specific project", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.75,
    importanceScore: 0.65,
    hitCount: 10,
  });
  service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_1",
    projectId: "proj_alpha",
  }, memory);
  const lineages = service.getLineagesByProject("proj_alpha");
  assert.equal(lineages.length, 1);
  assert.equal(lineages[0]!.metadata.projectId, "proj_alpha");
});

test("getLineagesByProject: returns empty for unknown project", () => {
  const service = new KnowledgePromotionService();
  const lineages = service.getLineagesByProject("nonexistent_proj");
  assert.deepEqual(lineages, []);
});

// =============================================================================
// Tier From Scope Tests
// =============================================================================

test("tierFromScope: user scope maps to personal tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({ scope: "user" });
  const result = service.evaluatePromotion(memory, "team");
  assert.equal(result.canPromote, true);
  assert.deepEqual(result.blockers, []);
});

test("tierFromScope: project scope maps to team tier", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({ scope: "project" });
  const result1 = service.evaluatePromotion(memory, "team");
  const result2 = service.evaluatePromotion(memory, "company");
  assert.equal(result1.canPromote, false);
  assert.deepEqual(result1.blockers, ["no_rule_from_team_to_team"]);
  assert.equal(result2.canPromote, false);
  assert.ok(result2.blockers.some((blocker) => blocker.includes("hitCount")));
});

// =============================================================================
// Promotion Result Structure Tests
// =============================================================================

test("PromotionResult has correct structure on success", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_test",
  }, memory);
  assert.equal(result.success, true);
  assert.equal(result.rejected, false);
  assert.equal(result.rejectionReason, null);
  assert.ok(result.lineage !== null);
});

test("PromotionResult has correct structure on rejection", () => {
  const service = new KnowledgePromotionService();
  const memory = createMemory({
    scope: "session",
    qualityScore: 0.1,
    importanceScore: 0.1,
    hitCount: 1,
  });
  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "agent_test",
  }, memory);
  assert.equal(result.success, false);
  assert.equal(result.rejected, true);
  assert.ok(result.rejectionReason !== null);
  assert.equal(result.lineage, null);
});
