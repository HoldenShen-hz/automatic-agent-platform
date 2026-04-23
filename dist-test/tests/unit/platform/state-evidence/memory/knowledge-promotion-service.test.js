import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgePromotionService, DEFAULT_PROMOTION_RULES, } from "../../../../../src/platform/state-evidence/memory/index.js";
function createMemoryRecord(overrides = {}) {
    const now = new Date().toISOString();
    return {
        id: "mem_001",
        taskId: null,
        sessionId: "sess_001",
        agentId: "agent_001",
        executionId: "exec_001",
        memoryLayer: "layer_3",
        scope: "session",
        contentJson: "{}",
        classification: "content",
        sourceTrustLevel: "trusted",
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
    };
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
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
    const request = {
        memoryId: memory.id,
        targetTier: "team",
        promotedBy: "user_1",
    };
    const result = service.promote(request, memory);
    service.updateVerificationStatus(result.lineage.id, "deprecated");
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
    const request = {
        memoryId: memory.id,
        targetTier: "team",
        promotedBy: "user_1",
    };
    const result = service.promote(request, memory);
    service.updateVerificationStatus(result.lineage.id, "rejected", "Failed review");
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
//# sourceMappingURL=knowledge-promotion-service.test.js.map