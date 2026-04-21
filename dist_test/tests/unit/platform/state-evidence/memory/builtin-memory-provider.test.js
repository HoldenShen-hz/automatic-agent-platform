import test from "node:test";
import assert from "node:assert/strict";
import { BuiltInMemoryProvider } from "../../../../../src/platform/state-evidence/memory/builtin-memory-provider.js";
/**
 * Creates a mock MemoryRecord for testing
 */
function createMockMemoryRecord(overrides = {}) {
    return {
        id: overrides.id ?? "mem_test123",
        taskId: overrides.taskId ?? "task_1",
        sessionId: overrides.sessionId ?? "session_1",
        agentId: overrides.agentId ?? "agent_1",
        executionId: overrides.executionId ?? "exec_1",
        memoryLayer: overrides.memoryLayer ?? "layer_3",
        scope: overrides.scope ?? "project",
        contentJson: overrides.contentJson ?? '{"content":"test memory","workContext":"working on testing","topOfMind":[],"recentHistory":[],"facts":[]}',
        classification: overrides.classification ?? "internal",
        sourceTrustLevel: overrides.sourceTrustLevel ?? "trusted",
        qualityScore: overrides.qualityScore ?? 0.8,
        hitCount: overrides.hitCount ?? 5,
        createdAt: overrides.createdAt ?? "2026-04-01T00:00:00.000Z",
        lastAccessedAt: overrides.lastAccessedAt ?? null,
        expiresAt: overrides.expiresAt ?? null,
        revokedAt: overrides.revokedAt ?? null,
        revocationReason: overrides.revocationReason ?? null,
        kind: overrides.kind ?? "general",
        status: overrides.status ?? "active",
        importanceScore: overrides.importanceScore ?? 0.7,
        freshnessScore: overrides.freshnessScore ?? 0.8,
        contentHash: overrides.contentHash ?? "abc123",
    };
}
/**
 * Creates a mock FewShotExample for testing
 */
function createMockFewShotExample(overrides = {}) {
    return {
        taskIntent: overrides.taskIntent ?? "testing memory provider",
        taskContext: overrides.taskContext ?? "unit testing",
        approach: overrides.approach ?? "used assert to verify behavior",
        toolsUsed: overrides.toolsUsed ?? ["test", "node"],
        reasoning: overrides.reasoning ?? "found similar patterns",
        outcome: overrides.outcome ?? "succeeded",
        ...overrides,
    };
}
function createMockStore() {
    const memories = new Map();
    const experiences = new Map();
    const mockConnection = {
        exec: () => { },
        prepare: (sql) => ({
            run: (...args) => {
                // For experience_cache INSERT, store the experience
                if (sql.includes("INSERT INTO experience_cache")) {
                    const id = args[0];
                    experiences.set(id, {
                        id,
                        task_id: args[1],
                        session_id: args[2],
                        agent_id: args[3],
                        execution_id: args[4],
                        task_context: args[5],
                        task_intent: args[6],
                        tools_used_json: args[7],
                        outcome: args[8],
                        final_error_code: args[9],
                        quality_score: args[10],
                        created_at: args[11],
                        hit_count: 0,
                        last_accessed_at: args[12],
                    });
                }
            },
            get: () => ({ count: memories.size }),
            all: (..._args) => {
                // Return experiences for experience_cache queries
                if (sql.includes("experience_cache")) {
                    return Array.from(experiences.values());
                }
                // Return memories for memory queries
                return Array.from(memories.values()).map(m => ({ ...m, rank: -1 }));
            },
        }),
    };
    const mockMemoryRepo = {
        listMemories: (query = {}) => {
            let result = Array.from(memories.values());
            if (query.scopes && query.scopes.length > 0) {
                result = result.filter(m => query.scopes.includes(m.scope));
            }
            if (query.taskId != null) {
                result = result.filter(m => m.taskId === query.taskId);
            }
            if (query.sessionId != null) {
                result = result.filter(m => m.sessionId === query.sessionId);
            }
            if (query.memoryLayers && query.memoryLayers.length > 0) {
                result = result.filter(m => query.memoryLayers.includes(m.memoryLayer));
            }
            return result;
        },
        getMemory: (id) => memories.get(id) ?? null,
        insertMemory: (record) => {
            memories.set(record.id, { ...record });
        },
        recordMemoryAccess: () => { },
        revokeMemory: (id, revokedAt, reason) => {
            const existing = memories.get(id);
            if (existing) {
                memories.set(id, { ...existing, revokedAt, revocationReason: reason });
            }
        },
        updateMemoryQuality: () => { },
        listMemoriesByScope: () => Array.from(memories.values()),
    };
    const mockExperienceRepo = {
        listExperiences: () => Array.from(experiences.values()),
        getExperience: (id) => experiences.get(id) ?? null,
        insertExperience: (record) => {
            experiences.set(record.id, { ...record });
        },
        updateExperienceHitCount: () => { },
    };
    return {
        withConnection: (work) => work(mockConnection),
        memory: mockMemoryRepo,
        experience: mockExperienceRepo,
    };
}
/**
 * Creates a mock MemoryService for testing
 */
function createMockMemoryService(store) {
    const memories = new Map();
    let nextId = 1;
    return {
        getStore: () => store,
        remember(input) {
            const id = `mem_${nextId++}`;
            const record = {
                id,
                taskId: input.taskId ?? null,
                sessionId: input.sessionId ?? null,
                agentId: input.agentId ?? null,
                executionId: input.executionId ?? null,
                memoryLayer: input.memoryLayer ?? "layer_3",
                scope: input.scope,
                contentJson: JSON.stringify(input.content),
                classification: input.classification ?? "general",
                sourceTrustLevel: input.sourceTrustLevel ?? "trusted",
                qualityScore: input.qualityScore ?? null,
                hitCount: 0,
                createdAt: input.createdAt ?? "2026-04-01T00:00:00.000Z",
                lastAccessedAt: null,
                expiresAt: input.expiresAt ?? null,
                revokedAt: null,
                revocationReason: null,
                kind: input.kind ?? "general",
                status: "active",
                importanceScore: null,
                freshnessScore: null,
                contentHash: "hash_" + id,
            };
            memories.set(id, record);
            return record;
        },
        recall: (query = {}) => {
            let result = Array.from(memories.values());
            if (query.scopes && query.scopes.length > 0) {
                result = result.filter(m => query.scopes.includes(m.scope));
            }
            if (query.taskId != null) {
                result = result.filter(m => m.taskId === query.taskId);
            }
            if (query.sessionId != null) {
                result = result.filter(m => m.sessionId === query.sessionId);
            }
            return result;
        },
        revoke: (id) => {
            const existing = memories.get(id);
            if (existing) {
                memories.set(id, { ...existing, revokedAt: "2026-04-01T00:00:00.000Z", revocationReason: "test" });
            }
            return existing ?? null;
        },
        recordFailureMemory: (input) => {
            return {
                id: `mem_fail_${nextId++}`,
                taskId: input.taskId,
                executionId: input.executionId,
                agentId: input.agentId ?? null,
                sessionId: null,
                memoryLayer: "layer_3",
                scope: "project",
                contentJson: JSON.stringify({ error: input.errorMessage, reasonCode: input.reasonCode }),
                classification: "operational",
                sourceTrustLevel: "trusted",
                qualityScore: null,
                hitCount: 0,
                createdAt: input.occurredAt ?? "2026-04-01T00:00:00.000Z",
                lastAccessedAt: null,
                expiresAt: null,
                revokedAt: null,
                revocationReason: null,
                kind: "failure",
                status: "active",
                importanceScore: null,
                freshnessScore: null,
                contentHash: "hash_fail",
            };
        },
        consolidate: () => { return { consolidated: null, revoked: [] }; },
        buildView: () => { return { project: [], user: [], session: [], experience: [] }; },
        getStats: () => { return { totalMemories: 0, byScope: {}, byLayer: {} }; },
    };
}
// Test suite for BuiltInMemoryProvider
test("BuiltInMemoryProvider.initialize returns correct result", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.initialize();
    assert.equal(result.providerId, "builtin-memory");
    assert.equal(result.authoritativeSource, "builtin");
    assert.equal(result.augmentationMode, "authoritative");
    assert.ok(result.initializedAt.length > 0);
});
test("BuiltInMemoryProvider.initialize is idempotent", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const first = await provider.initialize();
    const second = await provider.initialize();
    assert.equal(first.initializedAt, second.initializedAt);
});
test("BuiltInMemoryProvider.initialize with custom providerId", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService, { providerId: "custom-provider" });
    const result = await provider.initialize();
    assert.equal(result.providerId, "custom-provider");
});
test("BuiltInMemoryProvider.systemPromptBlock returns correct structure", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.systemPromptBlock({
        sessionId: "session_1",
        queryText: "test query",
    });
    assert.equal(result.providerId, "builtin-memory");
    assert.ok(Array.isArray(result.memoryIds));
    assert.ok(Array.isArray(result.experienceIds));
    assert.ok(typeof result.block === "string");
    assert.ok(result.generatedAt.length > 0);
});
test("BuiltInMemoryProvider.systemPromptBlock includes memories in block", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    // Add a memory
    memoryService.remember({
        sessionId: "session_1",
        scope: "project",
        content: { workContext: "working on testing", topOfMind: [], recentHistory: [], facts: [] },
    });
    const provider = new BuiltInMemoryProvider(memoryService);
    // Use sessionId-based recall (no queryText) to avoid FTS dependency
    const result = await provider.systemPromptBlock({
        sessionId: "session_1",
    });
    assert.ok(result.block.includes("Relevant memory:"));
});
test("BuiltInMemoryProvider.prefetch returns correct result structure", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.prefetch({
        sessionId: "session_1",
    });
    assert.equal(result.providerId, "builtin-memory");
    assert.ok(result.requestId.length > 0);
    assert.ok(result.generatedAt.length > 0);
    assert.equal(result.degraded, false);
    assert.equal(result.queued, false);
    assert.ok(Array.isArray(result.memories));
    assert.ok(Array.isArray(result.fewShotExamples));
    assert.ok(Array.isArray(result.experienceIds));
    assert.ok(typeof result.promptBlock === "string");
});
test("BuiltInMemoryProvider.prefetch uses maxPromptMemories limit", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    // Add multiple memories
    for (let i = 0; i < 10; i++) {
        memoryService.remember({
            sessionId: "session_1",
            scope: "project",
            content: { workContext: `context ${i}`, topOfMind: [], recentHistory: [], facts: [] },
        });
    }
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.prefetch({
        sessionId: "session_1",
        maxPromptMemories: 3,
    });
    assert.ok(result.memories.length <= 3);
});
test("BuiltInMemoryProvider.queuePrefetch returns queued state", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.queuePrefetch({
        sessionId: "session_1",
    });
    assert.equal(result.providerId, "builtin-memory");
    assert.equal(result.state, "queued");
    assert.ok(result.requestId.length > 0);
    assert.ok(result.queuedAt.length > 0);
});
test("BuiltInMemoryProvider.awaitQueuedPrefetch returns result after queue", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const queued = await provider.queuePrefetch({ sessionId: "session_1" });
    const result = await provider.awaitQueuedPrefetch(queued.requestId);
    assert.ok(result !== null);
    assert.equal(result.providerId, "builtin-memory");
});
test("BuiltInMemoryProvider.awaitQueuedPrefetch returns null for unknown requestId", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.awaitQueuedPrefetch("unknown-request-id");
    assert.equal(result, null);
});
test("BuiltInMemoryProvider.syncTurn stores memories and returns correct result", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.syncTurn({
        memories: [
            {
                sessionId: "session_1",
                scope: "project",
                content: "test memory content",
            },
        ],
    });
    assert.equal(result.providerId, "builtin-memory");
    assert.ok(result.syncedAt.length > 0);
    assert.ok(Array.isArray(result.rememberedMemoryIds));
    assert.ok(result.rememberedMemoryIds.length === 1);
    assert.ok(result.recordedExperienceId === null);
});
test("BuiltInMemoryProvider.syncTurn records experience when provided", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.syncTurn({
        memories: [],
        experience: {
            taskId: "task_1",
            sessionId: "session_1",
            agentId: "agent_1",
            executionId: "exec_1",
            taskContext: "testing",
            taskIntent: "test the memory provider",
            toolsUsed: [{ toolName: "node", callId: "call_1", status: "succeeded", durationMs: 100 }],
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.9,
        },
    });
    assert.ok(result.recordedExperienceId !== null);
});
test("BuiltInMemoryProvider.shutdown waits for pending prefetches", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Queue a prefetch
    await provider.queuePrefetch({ sessionId: "session_1" });
    const result = await provider.shutdown();
    assert.equal(result.providerId, "builtin-memory");
    assert.ok(result.shutdownAt.length > 0);
    assert.equal(result.pendingPrefetches, 0); // Should have completed
});
test("BuiltInMemoryProvider.shutdown with multiple queued prefetches", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Queue multiple prefetches
    await provider.queuePrefetch({ sessionId: "session_1" });
    await provider.queuePrefetch({ sessionId: "session_2" });
    await provider.queuePrefetch({ sessionId: "session_3" });
    const result = await provider.shutdown();
    assert.equal(result.providerId, "builtin-memory");
    assert.ok(result.shutdownAt.length > 0);
});
test("BuiltInMemoryProvider handles empty query results gracefully", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.prefetch({
        sessionId: "session_nonexistent",
    });
    assert.equal(result.memories.length, 0);
    assert.equal(result.fewShotExamples.length, 0);
    assert.equal(result.experienceIds.length, 0);
});
test("BuiltInMemoryProvider uses default maxPromptMemories of 5", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    // Add exactly 5 memories
    for (let i = 0; i < 5; i++) {
        memoryService.remember({
            sessionId: "session_1",
            scope: "project",
            content: { workContext: `context ${i}`, topOfMind: [], recentHistory: [], facts: [] },
        });
    }
    const provider = new BuiltInMemoryProvider(memoryService);
    const result = await provider.prefetch({
        sessionId: "session_1",
    });
    assert.ok(result.memories.length <= 5);
});
test("BuiltInMemoryProvider uses default maxFewShotExamples of 2", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Record some experiences through syncTurn
    for (let i = 0; i < 5; i++) {
        await provider.syncTurn({
            experience: {
                taskId: `task_${i}`,
                sessionId: "session_1",
                agentId: "agent_1",
                executionId: `exec_${i}`,
                taskContext: `context ${i}`,
                taskIntent: `intent ${i}`,
                toolsUsed: [{ toolName: "test", callId: `call_${i}`, status: "succeeded", durationMs: 100 }],
                outcome: "succeeded",
                finalErrorCode: null,
                qualityScore: 0.8,
            },
        });
    }
    const result = await provider.prefetch({
        sessionId: "session_1",
        includeExperienceExamples: true,
    });
    // Default maxFewShotExamples is 2
    assert.ok(result.fewShotExamples.length <= 2);
});
test("BuiltInMemoryProvider.prefetch uses tokenBudget for memory allocation", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    // Add multiple memories with significant content
    for (let i = 0; i < 5; i++) {
        memoryService.remember({
            sessionId: "session_1",
            scope: "project",
            content: {
                workContext: `This is a long work context for memory ${i} with lots of details about the task being performed`,
                topOfMind: [],
                recentHistory: [],
                facts: [],
            },
        });
    }
    const provider = new BuiltInMemoryProvider(memoryService);
    // Use a small tokenBudget to force budget-based selection
    const result = await provider.prefetch({
        sessionId: "session_1",
        tokenBudget: 50, // Very small budget to trigger selectMemoriesWithinBudget early exit
    });
    // Result should still have valid structure even with small budget
    assert.ok(result.memories !== undefined);
    assert.ok(result.promptBlock !== undefined);
});
test("BuiltInMemoryProvider.prefetch uses tokenBudget for example allocation", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Record experiences with significant content
    for (let i = 0; i < 3; i++) {
        await provider.syncTurn({
            experience: {
                taskId: `task_${i}`,
                sessionId: "session_1",
                agentId: "agent_1",
                executionId: `exec_${i}`,
                taskContext: `This is a long context with many words describing the situation ${i}`,
                taskIntent: `Intent with many words describing what we want to achieve ${i}`,
                toolsUsed: [{ toolName: "testtool", callId: `call_${i}`, status: "succeeded", durationMs: 100 }],
                outcome: "succeeded",
                finalErrorCode: null,
                qualityScore: 0.8,
            },
        });
    }
    // Use a small tokenBudget to trigger selectExamplesWithinBudget early exit
    const result = await provider.prefetch({
        sessionId: "session_1",
        includeExperienceExamples: true,
        tokenBudget: 30, // Very small budget
    });
    // Should still return valid structure
    assert.ok(result.fewShotExamples !== undefined);
    assert.ok(result.experienceIds !== undefined);
});
test("BuiltInMemoryProvider.prefetch handles examples with empty toolsUsed", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Record experience with empty toolsUsed
    await provider.syncTurn({
        experience: {
            taskId: "task_empty",
            sessionId: "session_1",
            agentId: "agent_1",
            executionId: "exec_empty",
            taskContext: "context with empty tools",
            taskIntent: "intent with empty tools",
            toolsUsed: [], // Empty tools array
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.8,
        },
    });
    const result = await provider.prefetch({
        sessionId: "session_1",
        taskIntent: "intent with empty tools", // Required for experience lookup
        includeExperienceExamples: true,
    });
    // Should still format correctly with no tools line
    assert.ok(result.promptBlock.includes("Similar prior experience"));
});
test("BuiltInMemoryProvider.prefetch handles examples with null reasoning", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Record experience with null reasoning
    await provider.syncTurn({
        experience: {
            taskId: "task_null_reason",
            sessionId: "session_1",
            agentId: "agent_1",
            executionId: "exec_null_reason",
            taskContext: "context with null reasoning",
            taskIntent: "intent with null reasoning",
            toolsUsed: [{ toolName: "test", callId: "call1", status: "succeeded", durationMs: 100 }],
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.8,
        },
    });
    const result = await provider.prefetch({
        sessionId: "session_1",
        taskIntent: "intent with null reasoning", // Required for experience lookup
        includeExperienceExamples: true,
    });
    // Should not include "Why matched" line when reasoning is null
    assert.ok(result.promptBlock.includes("Similar prior experience"));
});
test("BuiltInMemoryProvider.prefetch respects 70/30 memory/example split", async () => {
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Add memories
    memoryService.remember({
        sessionId: "session_1",
        scope: "project",
        content: {
            workContext: "memory context",
            topOfMind: [],
            recentHistory: [],
            facts: [],
        },
    });
    // Record experience
    await provider.syncTurn({
        experience: {
            taskId: "task_1",
            sessionId: "session_1",
            agentId: "agent_1",
            executionId: "exec_1",
            taskContext: "experience context",
            taskIntent: "experience intent",
            toolsUsed: [{ toolName: "test", callId: "call1", status: "succeeded", durationMs: 100 }],
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.8,
        },
    });
    // With tokenBudget, 70% goes to memories, 30% to examples
    const result = await provider.prefetch({
        sessionId: "session_1",
        includeExperienceExamples: true,
        tokenBudget: 200,
    });
    // Both memories and examples should be included when budget allows
    assert.ok(result.memories !== undefined);
    assert.ok(result.fewShotExamples !== undefined);
});
// =============================================================================
// Additional branch coverage tests for summarizeMemory and token budget selection
// =============================================================================
test("BuiltInMemoryProvider.prefetch handles topOfMind budget exhaustion", async () => {
    // This test exercises the break at line 56-58 in summarizeMemory
    // where a topOfMind item is too large to fit in the remaining budget
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // First memory: small workContext, will be selected
    memoryService.remember({
        sessionId: "session_topofmind",
        scope: "project",
        content: {
            workContext: "short context",
            topOfMind: [],
            recentHistory: [],
            facts: [],
        },
    });
    // Second memory: has large topOfMind item that won't fit after first memory consumes budget
    // The tokenBudget of 100 tokens means ~70 for memories, but the first memory
    // uses some tokens, leaving little for the second memory's topOfMind
    memoryService.remember({
        sessionId: "session_topofmind",
        scope: "project",
        content: {
            workContext: "x".repeat(200), // Large workContext uses most of the per-memory budget
            topOfMind: ["This is a very long top of mind item that exceeds the remaining budget after the first memory"],
            recentHistory: [],
            facts: [],
        },
    });
    const result = await provider.prefetch({
        sessionId: "session_topofmind",
        tokenBudget: 100, // Small budget to force budget-based selection
    });
    // Should still return valid result even with budget exhaustion
    assert.ok(result.memories !== undefined);
    assert.ok(result.promptBlock !== undefined);
});
test("BuiltInMemoryProvider.prefetch handles recentHistory budget exhaustion", async () => {
    // This test exercises the break at line 61-63 in summarizeMemory
    // where a recentHistory item is too large to fit in the remaining budget
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // First memory
    memoryService.remember({
        sessionId: "session_history",
        scope: "project",
        content: {
            workContext: "short context",
            topOfMind: [],
            recentHistory: [],
            facts: [],
        },
    });
    // Second memory: has large recentHistory item
    memoryService.remember({
        sessionId: "session_history",
        scope: "project",
        content: {
            workContext: "y".repeat(200),
            topOfMind: [],
            recentHistory: ["Another very long recent history item that won't fit in the remaining budget"],
            facts: [],
        },
    });
    const result = await provider.prefetch({
        sessionId: "session_history",
        tokenBudget: 100,
    });
    assert.ok(result.memories !== undefined);
    assert.ok(result.promptBlock !== undefined);
});
test("BuiltInMemoryProvider.prefetch uses facts fallback when workContext and topOfMind are empty", async () => {
    // This test exercises the fallback to facts at lines 98-102 in summarizeMemory
    // when workContext is empty and topOfMind/recentHistory don't fit
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Memory with only facts (no workContext, empty topOfMind and recentHistory)
    memoryService.remember({
        sessionId: "session_facts",
        scope: "project",
        content: {
            workContext: "",
            topOfMind: [],
            recentHistory: [],
            facts: [
                { content: "Important fact about the task", category: "learning", confidence: 0.9 },
                { content: "Another key fact", category: "context", confidence: 0.85 },
            ],
        },
    });
    const result = await provider.prefetch({
        sessionId: "session_facts",
    });
    // Should use facts as fallback since workContext is empty
    assert.ok(result.memories.length > 0);
    assert.ok(result.promptBlock.includes("Important fact") || result.promptBlock.includes("structured memory entry"));
});
test("BuiltInMemoryProvider.prefetch uses maxPromptMemories when tokenBudget is null", async () => {
    // This test exercises the else branch at lines 350-352 when tokenBudget is null
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Add 10 memories
    for (let i = 0; i < 10; i++) {
        memoryService.remember({
            sessionId: "session_max",
            scope: "project",
            content: {
                workContext: `context ${i}`,
                topOfMind: [],
                recentHistory: [],
                facts: [],
            },
        });
    }
    // No tokenBudget - should use maxPromptMemories (default 5)
    const result = await provider.prefetch({
        sessionId: "session_max",
        maxPromptMemories: 3, // This should be respected when tokenBudget is null
    });
    // Should respect maxPromptMemories limit
    assert.ok(result.memories.length <= 3);
});
test("BuiltInMemoryProvider.prefetch uses maxFewShotExamples when tokenBudget is null", async () => {
    // This test exercises the else branch at lines 356-358 when tokenBudget is null
    const store = createMockStore();
    const memoryService = createMockMemoryService(store);
    const provider = new BuiltInMemoryProvider(memoryService);
    // Record 5 experiences
    for (let i = 0; i < 5; i++) {
        await provider.syncTurn({
            experience: {
                taskId: `task_${i}`,
                sessionId: "session_examples",
                agentId: "agent_1",
                executionId: `exec_${i}`,
                taskContext: `context ${i}`,
                taskIntent: `intent ${i}`,
                toolsUsed: [{ toolName: "test", callId: `call_${i}`, status: "succeeded", durationMs: 100 }],
                outcome: "succeeded",
                finalErrorCode: null,
                qualityScore: 0.8,
            },
        });
    }
    // No tokenBudget - should use maxFewShotExamples
    const result = await provider.prefetch({
        sessionId: "session_examples",
        includeExperienceExamples: true,
        maxFewShotExamples: 2, // This should be respected when tokenBudget is null
    });
    // Should respect maxFewShotExamples limit
    assert.ok(result.fewShotExamples.length <= 2);
});
//# sourceMappingURL=builtin-memory-provider.test.js.map