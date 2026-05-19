import assert from "node:assert/strict";
import test from "node:test";
import { getMemoryState, matchesMemoryRecallQuery, filterAndSortMemories, } from "../../../../../src/platform/state-evidence/memory/memory-quality.js";
// =============================================================================
// Mock Factory
// =============================================================================
function createMemoryRecord(overrides = {}) {
    const now = new Date().toISOString();
    return {
        id: "mem_q001",
        taskId: null,
        sessionId: "sess_q1",
        agentId: "agent_q1",
        executionId: null,
        memoryLayer: "layer_3",
        scope: "project",
        contentJson: '{"schemaVersion":"memory.v2","workContext":"test","topOfMind":[],"recentHistory":[],"longTermBackground":[],"facts":[]}',
        classification: "general",
        sourceTrustLevel: "trusted",
        qualityScore: 0.8,
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
        contentHash: "hash_q1",
        ...overrides,
    };
}
// =============================================================================
// getMemoryState Tests
// =============================================================================
test("getMemoryState returns active when no expiry or revocation", () => {
    const record = createMemoryRecord();
    const state = getMemoryState(record, "2026-04-24T12:00:00.000Z");
    assert.equal(state, "active");
});
test("getMemoryState returns expired when expiresAt is in the past", () => {
    const record = createMemoryRecord({
        expiresAt: "2026-04-23T00:00:00.000Z",
    });
    const state = getMemoryState(record, "2026-04-24T00:00:00.000Z");
    assert.equal(state, "expired");
});
test("getMemoryState returns revoked when revokedAt is in the past", () => {
    const record = createMemoryRecord({
        revokedAt: "2026-04-23T00:00:00.000Z",
    });
    const state = getMemoryState(record, "2026-04-24T00:00:00.000Z");
    assert.equal(state, "revoked");
});
test("getMemoryState revoked takes precedence over expired", () => {
    const record = createMemoryRecord({
        expiresAt: "2026-04-23T00:00:00.000Z",
        revokedAt: "2026-04-23T00:00:00.000Z",
    });
    const state = getMemoryState(record, "2026-04-24T00:00:00.000Z");
    assert.equal(state, "revoked");
});
test("getMemoryState uses provided evaluatedAt timestamp", () => {
    const record = createMemoryRecord({
        expiresAt: "2026-04-25T00:00:00.000Z",
    });
    const state = getMemoryState(record, "2026-04-24T00:00:00.000Z");
    assert.equal(state, "active");
});
// =============================================================================
// matchesMemoryRecallQuery Tests
// =============================================================================
test("matchesMemoryRecallQuery returns true when no filters", () => {
    const record = createMemoryRecord();
    assert.equal(matchesMemoryRecallQuery(record, {}), true);
});
test("matchesMemoryRecallQuery filters by taskId", () => {
    const record = createMemoryRecord({ taskId: "task_match" });
    assert.equal(matchesMemoryRecallQuery(record, { taskId: "task_match" }), true);
    assert.equal(matchesMemoryRecallQuery(record, { taskId: "task_other" }), false);
});
test("matchesMemoryRecallQuery filters by sessionId", () => {
    const record = createMemoryRecord({ sessionId: "sess_match" });
    assert.equal(matchesMemoryRecallQuery(record, { sessionId: "sess_match" }), true);
    assert.equal(matchesMemoryRecallQuery(record, { sessionId: "sess_other" }), false);
});
test("matchesMemoryRecallQuery filters by agentId", () => {
    const record = createMemoryRecord({ agentId: "agent_match" });
    assert.equal(matchesMemoryRecallQuery(record, { agentId: "agent_match" }), true);
    assert.equal(matchesMemoryRecallQuery(record, { agentId: "agent_other" }), false);
});
test("matchesMemoryRecallQuery filters by executionId", () => {
    const record = createMemoryRecord({ executionId: "exec_match" });
    assert.equal(matchesMemoryRecallQuery(record, { executionId: "exec_match" }), true);
    assert.equal(matchesMemoryRecallQuery(record, { executionId: "exec_other" }), false);
});
test("matchesMemoryRecallQuery filters by scopes", () => {
    const record = createMemoryRecord({ scope: "project" });
    assert.equal(matchesMemoryRecallQuery(record, { scopes: ["project"] }), true);
    assert.equal(matchesMemoryRecallQuery(record, { scopes: ["agent"] }), false);
});
test("matchesMemoryRecallQuery filters by memoryLayers", () => {
    const record = createMemoryRecord({ memoryLayer: "layer_5" });
    assert.equal(matchesMemoryRecallQuery(record, { memoryLayers: ["layer_5"] }), true);
    assert.equal(matchesMemoryRecallQuery(record, { memoryLayers: ["layer_3"] }), false);
});
test("matchesMemoryRecallQuery filters by classifications", () => {
    const record = createMemoryRecord({ classification: "operational" });
    assert.equal(matchesMemoryRecallQuery(record, { classifications: ["operational"] }), true);
    assert.equal(matchesMemoryRecallQuery(record, { classifications: ["general"] }), false);
});
test("matchesMemoryRecallQuery filters by sourceTrustLevels", () => {
    const record = createMemoryRecord({ sourceTrustLevel: "untrusted" });
    assert.equal(matchesMemoryRecallQuery(record, { sourceTrustLevels: ["untrusted"] }), true);
    assert.equal(matchesMemoryRecallQuery(record, { sourceTrustLevels: ["trusted"] }), false);
});
test("matchesMemoryRecallQuery filters by minQualityScore", () => {
    const record = createMemoryRecord({ qualityScore: 0.85 });
    assert.equal(matchesMemoryRecallQuery(record, { minQualityScore: 0.8 }), true);
    assert.equal(matchesMemoryRecallQuery(record, { minQualityScore: 0.9 }), false);
    assert.equal(matchesMemoryRecallQuery(record, { minQualityScore: 0.85 }), true);
});
test("matchesMemoryRecallQuery excludes expired when includeExpired is false", () => {
    const record = createMemoryRecord({
        expiresAt: "2026-04-23T00:00:00.000Z",
    });
    const query = {
        includeExpired: false,
        evaluatedAt: "2026-04-24T00:00:00.000Z",
    };
    assert.equal(matchesMemoryRecallQuery(record, query), false);
});
test("matchesMemoryRecallQuery includes expired when includeExpired is true", () => {
    const record = createMemoryRecord({
        expiresAt: "2026-04-23T00:00:00.000Z",
    });
    const query = {
        includeExpired: true,
        evaluatedAt: "2026-04-24T00:00:00.000Z",
    };
    assert.equal(matchesMemoryRecallQuery(record, query), true);
});
test("matchesMemoryRecallQuery excludes revoked when includeRevoked is false", () => {
    const record = createMemoryRecord({
        revokedAt: "2026-04-23T00:00:00.000Z",
    });
    const query = {
        includeRevoked: false,
        evaluatedAt: "2026-04-24T00:00:00.000Z",
    };
    assert.equal(matchesMemoryRecallQuery(record, query), false);
});
test("matchesMemoryRecallQuery includes revoked when includeRevoked is true", () => {
    const record = createMemoryRecord({
        revokedAt: "2026-04-23T00:00:00.000Z",
    });
    const query = {
        includeRevoked: true,
        evaluatedAt: "2026-04-24T00:00:00.000Z",
    };
    assert.equal(matchesMemoryRecallQuery(record, query), true);
});
// =============================================================================
// filterAndSortMemories Tests
// =============================================================================
test("filterAndSortMemories returns empty array for empty input", () => {
    const result = filterAndSortMemories([]);
    assert.deepEqual(result, []);
});
test("filterAndSortMemories returns all records when query is empty", () => {
    const records = [
        createMemoryRecord({ id: "mem_f1" }),
        createMemoryRecord({ id: "mem_f2" }),
    ];
    const result = filterAndSortMemories(records, {});
    assert.equal(result.length, 2);
});
test("filterAndSortMemories sorts by createdAt descending", () => {
    const records = [
        createMemoryRecord({ id: "mem_old", createdAt: "2026-04-20T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_new", createdAt: "2026-04-24T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_mid", createdAt: "2026-04-22T00:00:00.000Z" }),
    ];
    const result = filterAndSortMemories(records, {});
    assert.equal(result[0]?.id, "mem_new");
    assert.equal(result[1]?.id, "mem_mid");
    assert.equal(result[2]?.id, "mem_old");
});
test("filterAndSortMemories respects limit parameter", () => {
    const records = [
        createMemoryRecord({ id: "mem_l1", createdAt: "2026-04-24T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_l2", createdAt: "2026-04-23T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_l3", createdAt: "2026-04-22T00:00:00.000Z" }),
    ];
    const result = filterAndSortMemories(records, { limit: 2 });
    assert.equal(result.length, 2);
    assert.equal(result[0]?.id, "mem_l1");
    assert.equal(result[1]?.id, "mem_l2");
});
test("filterAndSortMemories applies multiple filters", () => {
    const records = [
        createMemoryRecord({ id: "mem_m1", taskId: "task_1", scope: "project", memoryLayer: "layer_3" }),
        createMemoryRecord({ id: "mem_m2", taskId: "task_2", scope: "project", memoryLayer: "layer_3" }),
        createMemoryRecord({ id: "mem_m3", taskId: "task_1", scope: "agent", memoryLayer: "layer_3" }),
    ];
    const result = filterAndSortMemories(records, {
        taskId: "task_1",
        scopes: ["project"],
        memoryLayers: ["layer_3"],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "mem_m1");
});
test("filterAndSortMemories applies limit with other filters", () => {
    const records = [
        createMemoryRecord({ id: "mem_lim1", taskId: "task_x", createdAt: "2026-04-24T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_lim2", taskId: "task_x", createdAt: "2026-04-23T00:00:00.000Z" }),
        createMemoryRecord({ id: "mem_lim3", taskId: "task_x", createdAt: "2026-04-22T00:00:00.000Z" }),
    ];
    const result = filterAndSortMemories(records, { taskId: "task_x", limit: 2 });
    assert.equal(result.length, 2);
    assert.equal(result[0]?.id, "mem_lim1");
    assert.equal(result[1]?.id, "mem_lim2");
});
//# sourceMappingURL=memory-query.test.js.map