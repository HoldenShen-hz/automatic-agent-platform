import assert from "node:assert/strict";
import test from "node:test";
function createContractProvider() {
    return {
        async initialize() {
            return {
                providerId: "contract-provider",
                initializedAt: "2026-04-15T10:00:00.000Z",
                authoritativeSource: "builtin",
                augmentationMode: "authoritative",
            };
        },
        async systemPromptBlock(_query) {
            return {
                providerId: "contract-provider",
                generatedAt: "2026-04-15T10:00:01.000Z",
                memoryIds: ["mem-1"],
                experienceIds: ["exp-1"],
                block: "Relevant memory:\n- [project] keep authoritative store consistent",
            };
        },
        async prefetch(query) {
            return {
                providerId: "contract-provider",
                requestId: "prefetch-1",
                generatedAt: "2026-04-15T10:00:02.000Z",
                degraded: false,
                queued: false,
                query,
                memories: [],
                fewShotExamples: [],
                experienceIds: [],
                promptBlock: "",
            };
        },
        async queuePrefetch(_query) {
            return {
                providerId: "contract-provider",
                requestId: "prefetch-queued-1",
                queuedAt: "2026-04-15T10:00:03.000Z",
                state: "queued",
            };
        },
        async syncTurn(input) {
            return {
                providerId: "contract-provider",
                syncedAt: "2026-04-15T10:00:04.000Z",
                rememberedMemoryIds: input.memories?.map((_memory, index) => `mem-${index + 1}`) ?? [],
                recordedExperienceId: input.experience == null ? null : "exp-recorded-1",
            };
        },
        async shutdown() {
            return {
                providerId: "contract-provider",
                shutdownAt: "2026-04-15T10:00:05.000Z",
                pendingPrefetches: 0,
            };
        },
    };
}
test("MemoryProvider contract exposes the full augmentation lifecycle", async () => {
    const provider = createContractProvider();
    const query = {
        sessionId: "session-contract",
        taskId: "task-contract",
        queryText: "authoritative store",
        taskIntent: "stabilize storage layer",
        toolNames: ["read", "edit"],
        includeExperienceExamples: true,
        maxPromptMemories: 4,
        maxFewShotExamples: 2,
        tokenBudget: 2048,
        scopes: ["project"],
        sourceTrustLevels: ["trusted"],
    };
    const init = await provider.initialize();
    const prompt = await provider.systemPromptBlock(query);
    const prefetched = await provider.prefetch(query);
    const queued = await provider.queuePrefetch(query);
    const synced = await provider.syncTurn({
        memories: [{
                taskId: "task-contract",
                sessionId: "session-contract",
                agentId: "agent-contract",
                executionId: "exec-contract",
                scope: "project",
                content: "remember the stabilization result",
                classification: "internal",
            }],
        experience: {
            taskId: "task-contract",
            sessionId: "session-contract",
            agentId: "agent-contract",
            executionId: "exec-contract",
            taskContext: "storage stabilization",
            taskIntent: "finish the migration cleanup",
            toolsUsed: [
                { toolName: "read", callId: "call-1", status: "succeeded", durationMs: 10 },
                { toolName: "edit", callId: "call-2", status: "succeeded", durationMs: 25 },
            ],
            outcome: "succeeded",
            finalErrorCode: null,
            qualityScore: 0.95,
        },
    });
    const shutdown = await provider.shutdown();
    assert.equal(init.providerId, "contract-provider");
    assert.equal(prompt.memoryIds.length, 1);
    assert.equal(prefetched.query.queryText, "authoritative store");
    assert.equal(queued.state, "queued");
    assert.deepEqual(synced.rememberedMemoryIds, ["mem-1"]);
    assert.equal(synced.recordedExperienceId, "exp-recorded-1");
    assert.equal(shutdown.pendingPrefetches, 0);
});
test("MemoryProvider contract supports minimal query and sync payloads", async () => {
    const provider = createContractProvider();
    const query = {
        sessionId: "session-minimal",
    };
    const prefetched = await provider.prefetch(query);
    const synced = await provider.syncTurn({});
    assert.equal(prefetched.query.sessionId, "session-minimal");
    assert.deepEqual(prefetched.memories, []);
    assert.deepEqual(synced.rememberedMemoryIds, []);
    assert.equal(synced.recordedExperienceId, null);
});
test("MemoryProvider prefetch returns degraded result when memory retrieval fails", async () => {
    const degradedProvider = {
        async initialize() {
            return {
                providerId: "degraded-provider",
                initializedAt: "2026-04-15T10:00:00.000Z",
                authoritativeSource: "builtin",
                augmentationMode: "authoritative",
            };
        },
        async systemPromptBlock(_query) {
            return {
                providerId: "degraded-provider",
                generatedAt: "2026-04-15T10:00:01.000Z",
                memoryIds: [],
                experienceIds: [],
                block: "",
            };
        },
        async prefetch(_query) {
            return {
                providerId: "degraded-provider",
                requestId: "prefetch-degraded",
                generatedAt: "2026-04-15T10:00:02.000Z",
                degraded: true,
                queued: false,
                query: { sessionId: "session-degraded" },
                memories: [],
                fewShotExamples: [],
                experienceIds: [],
                promptBlock: "",
            };
        },
        async queuePrefetch(_query) {
            return {
                providerId: "degraded-provider",
                requestId: "prefetch-queued-degraded",
                queuedAt: "2026-04-15T10:00:03.000Z",
                state: "queued",
            };
        },
        async syncTurn(input) {
            return {
                providerId: "degraded-provider",
                syncedAt: "2026-04-15T10:00:04.000Z",
                rememberedMemoryIds: [],
                recordedExperienceId: null,
            };
        },
        async shutdown() {
            return {
                providerId: "degraded-provider",
                shutdownAt: "2026-04-15T10:00:05.000Z",
                pendingPrefetches: 0,
            };
        },
    };
    const prefetched = await degradedProvider.prefetch({ sessionId: "session-degraded" });
    assert.equal(prefetched.degraded, true);
    assert.equal(prefetched.providerId, "degraded-provider");
    assert.deepEqual(prefetched.memories, []);
});
test("MemoryProvider syncTurn handles null experience gracefully", async () => {
    const provider = createContractProvider();
    const synced = await provider.syncTurn({
        memories: [{
                taskId: "task-null-exp",
                sessionId: "session-null-exp",
                agentId: "agent-null-exp",
                executionId: "exec-null-exp",
                scope: "project",
                content: "some memory content",
                classification: "internal",
            }],
        experience: null,
    });
    assert.deepEqual(synced.rememberedMemoryIds, ["mem-1"]);
    assert.equal(synced.recordedExperienceId, null);
});
test("MemoryProvider syncTurn records failed task experience", async () => {
    // Use degraded provider to test with specific values
    const failedExpProvider = {
        async initialize() {
            return {
                providerId: "failed-exp-provider",
                initializedAt: "2026-04-15T10:00:00.000Z",
                authoritativeSource: "builtin",
                augmentationMode: "authoritative",
            };
        },
        async systemPromptBlock(_query) {
            return {
                providerId: "failed-exp-provider",
                generatedAt: "2026-04-15T10:00:01.000Z",
                memoryIds: [],
                experienceIds: [],
                block: "",
            };
        },
        async prefetch(_query) {
            return {
                providerId: "failed-exp-provider",
                requestId: "prefetch-failed",
                generatedAt: "2026-04-15T10:00:02.000Z",
                degraded: false,
                queued: false,
                query: { sessionId: "session-failed" },
                memories: [],
                fewShotExamples: [],
                experienceIds: [],
                promptBlock: "",
            };
        },
        async queuePrefetch(_query) {
            return {
                providerId: "failed-exp-provider",
                requestId: "prefetch-queued-failed",
                queuedAt: "2026-04-15T10:00:03.000Z",
                state: "queued",
            };
        },
        async syncTurn(input) {
            // Verify that failed task experience is passed through
            return {
                providerId: "failed-exp-provider",
                syncedAt: "2026-04-15T10:00:04.000Z",
                rememberedMemoryIds: [],
                recordedExperienceId: input.experience?.finalErrorCode === "migration.timeout" ? "exp-failed-recorded" : null,
            };
        },
        async shutdown() {
            return {
                providerId: "failed-exp-provider",
                shutdownAt: "2026-04-15T10:00:05.000Z",
                pendingPrefetches: 0,
            };
        },
    };
    const synced = await failedExpProvider.syncTurn({
        memories: [],
        experience: {
            taskId: "task-failed",
            sessionId: "session-failed",
            agentId: "agent-failed",
            executionId: "exec-failed",
            taskContext: "database migration",
            taskIntent: "complete the migration",
            toolsUsed: [
                { toolName: "read", callId: "call-1", status: "succeeded", durationMs: 10 },
                { toolName: "edit", callId: "call-2", status: "failed", durationMs: 50 },
            ],
            outcome: "failed",
            finalErrorCode: "migration.timeout",
            qualityScore: 0.1,
        },
    });
    assert.deepEqual(synced.rememberedMemoryIds, []);
    assert.equal(synced.recordedExperienceId, "exp-failed-recorded");
});
//# sourceMappingURL=memory-provider.test.js.map