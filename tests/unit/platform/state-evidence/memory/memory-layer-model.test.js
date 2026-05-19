import test from "node:test";
import assert from "node:assert/strict";
import { mapMemoryScopeToLayer, cloneMemoryWithLayer, DEFAULT_MEMORY_PROMOTION_RULES, } from "../../../../../src/platform/state-evidence/memory/memory-layer-model.js";
function createTestMemory(overrides = {}) {
    return {
        id: "mem_test_1",
        taskId: null,
        sessionId: "session_1",
        agentId: null,
        executionId: null,
        memoryLayer: "layer_5",
        scope: "session",
        contentJson: JSON.stringify({ text: "Test memory content" }),
        classification: "general",
        sourceTrustLevel: "trusted",
        qualityScore: 0.7,
        hitCount: 5,
        createdAt: "2024-01-15T10:30:00.000Z",
        lastAccessedAt: null,
        expiresAt: null,
        revokedAt: null,
        revocationReason: null,
        kind: "general",
        status: "active",
        importanceScore: 0.8,
        freshnessScore: 0.9,
        contentHash: null,
        ...overrides,
    };
}
test("mapMemoryScopeToLayer returns runtime for task_runtime", () => {
    assert.equal(mapMemoryScopeToLayer("task_runtime"), "runtime");
});
test("mapMemoryScopeToLayer returns session for session", () => {
    assert.equal(mapMemoryScopeToLayer("session"), "session");
});
test("mapMemoryScopeToLayer returns agent for agent", () => {
    assert.equal(mapMemoryScopeToLayer("agent"), "agent");
});
test("mapMemoryScopeToLayer returns project for workspace", () => {
    assert.equal(mapMemoryScopeToLayer("workspace"), "project");
});
test("mapMemoryScopeToLayer returns project for project", () => {
    assert.equal(mapMemoryScopeToLayer("project"), "project");
});
test("mapMemoryScopeToLayer returns user for user", () => {
    assert.equal(mapMemoryScopeToLayer("user"), "user");
});
test("mapMemoryScopeToLayer returns evolution for experience", () => {
    assert.equal(mapMemoryScopeToLayer("experience"), "evolution");
});
test("mapMemoryScopeToLayer returns evolution for evolution", () => {
    assert.equal(mapMemoryScopeToLayer("evolution"), "evolution");
});
test("mapMemoryScopeToLayer defaults to project for unknown scopes", () => {
    assert.equal(mapMemoryScopeToLayer("unknown_scope"), "project");
    assert.equal(mapMemoryScopeToLayer(""), "project");
    assert.equal(mapMemoryScopeToLayer("invalid"), "project");
});
test("cloneMemoryWithLayer updates scope to target layer", () => {
    const memory = createTestMemory({ scope: "session" });
    const result = cloneMemoryWithLayer(memory, "agent");
    assert.equal(result.scope, "agent");
    assert.equal(result.id, memory.id);
    assert.equal(result.contentJson, memory.contentJson);
});
test("cloneMemoryScopeToLayer project becomes project scope", () => {
    const memory = createTestMemory({ scope: "agent" });
    const result = cloneMemoryWithLayer(memory, "project");
    assert.equal(result.scope, "project");
});
test("cloneMemoryWithLayer preserves other properties", () => {
    const memory = createTestMemory({
        scope: "session",
        importanceScore: 0.8,
        hitCount: 5,
    });
    const result = cloneMemoryWithLayer(memory, "agent");
    assert.equal(result.id, memory.id);
    assert.equal(result.contentJson, memory.contentJson);
    assert.equal(result.importanceScore, 0.8);
    assert.equal(result.hitCount, 5);
});
test("DEFAULT_MEMORY_PROMOTION_RULES has correct structure", () => {
    assert.ok(DEFAULT_MEMORY_PROMOTION_RULES.length > 0);
    for (const rule of DEFAULT_MEMORY_PROMOTION_RULES) {
        assert.ok(rule.from !== undefined);
        assert.ok(rule.to !== undefined);
        assert.ok(rule.minHitCount >= 0);
        assert.ok(rule.minQualityScore >= 0 && rule.minQualityScore <= 1);
        assert.ok(rule.minImportanceScore >= 0 && rule.minImportanceScore <= 1);
    }
});
test("DEFAULT_MEMORY_PROMOTION_RULES has increasing thresholds", () => {
    for (let i = 1; i < DEFAULT_MEMORY_PROMOTION_RULES.length; i++) {
        const prev = DEFAULT_MEMORY_PROMOTION_RULES[i - 1];
        const curr = DEFAULT_MEMORY_PROMOTION_RULES[i];
        assert.ok(prev !== undefined);
        assert.ok(curr !== undefined);
        assert.ok(curr.minHitCount > prev.minHitCount);
        assert.ok(curr.minQualityScore > prev.minQualityScore);
        assert.ok(curr.minImportanceScore > prev.minImportanceScore);
    }
});
test("DEFAULT_MEMORY_PROMOTION_RULES covers session to agent", () => {
    const rule = DEFAULT_MEMORY_PROMOTION_RULES.find(r => r.from === "session" && r.to === "agent");
    assert.ok(rule !== undefined);
    assert.equal(rule.minHitCount, 3);
    assert.equal(rule.minQualityScore, 0.6);
    assert.equal(rule.minImportanceScore, 0.5);
});
test("DEFAULT_MEMORY_PROMOTION_RULES covers agent to project", () => {
    const rule = DEFAULT_MEMORY_PROMOTION_RULES.find(r => r.from === "agent" && r.to === "project");
    assert.ok(rule !== undefined);
    assert.equal(rule.minHitCount, 8);
    assert.equal(rule.minQualityScore, 0.75);
    assert.equal(rule.minImportanceScore, 0.65);
});
test("DEFAULT_MEMORY_PROMOTION_RULES covers project to user", () => {
    const rule = DEFAULT_MEMORY_PROMOTION_RULES.find(r => r.from === "project" && r.to === "user");
    assert.ok(rule !== undefined);
    assert.equal(rule.minHitCount, 12);
    assert.equal(rule.minQualityScore, 0.8);
    assert.equal(rule.minImportanceScore, 0.75);
});
test("DEFAULT_MEMORY_PROMOTION_RULES covers user to evolution", () => {
    const rule = DEFAULT_MEMORY_PROMOTION_RULES.find(r => r.from === "user" && r.to === "evolution");
    assert.ok(rule !== undefined);
    assert.equal(rule.minHitCount, 20);
    assert.equal(rule.minQualityScore, 0.9);
    assert.equal(rule.minImportanceScore, 0.85);
});
//# sourceMappingURL=memory-layer-model.test.js.map