import assert from "node:assert/strict";
import test from "node:test";
import { createCacheGovernanceMiddleware, createCacheSummaryMiddleware } from "../../../../../src/platform/shared/cache/middleware/cache-governance-middleware.js";
// Mock cache facade - using any to avoid interface mismatch
const createMockCache = () => ({
    lastNamespace: "",
    lastArgs: {},
    tags: [],
    computeFn: null,
    getOrComputeResult: { fromCache: false, value: "computed" },
    getOrCompute: async function (namespace, args, compute, options) {
        this.lastNamespace = namespace;
        this.lastArgs = args;
        this.tags = options?.tags ?? [];
        this.computeFn = compute;
        return this.getOrComputeResult;
    },
    invalidateByTag: async (tag) => tag.includes("valid") ? 1 : 0,
    getMetricsSnapshot: () => ({ hits: 10, misses: 5 }),
});
// Mock logger - using any to avoid interface mismatch
const createMockLogger = () => ({
    debugMsgs: [],
    debug(msg, meta) {
        this.debugMsgs.push({ msg, ...meta });
    },
    warn() { },
    info() { },
    error() { },
});
function createMockContext() {
    return {
        runtime: {
            traceId: "trace-1",
            taskId: "task-123",
            executionId: "exec-1",
            sessionId: "sess-abc",
        },
        chainStartedAt: new Date().toISOString(),
        agentRound: 1,
        stepId: "step-1",
        executionId: "exec-1",
        taskId: "task-123",
    };
}
test("createCacheGovernanceMiddleware returns middleware with correct name and priority", () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    assert.equal(middleware.name, "cache-governance");
    assert.equal(middleware.priority, 40);
});
test("createCacheGovernanceMiddleware skips non-cacheable tools", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    let nextCalled = false;
    const result = await middleware.run(createMockContext(), { toolName: "bash", args: { command: "ls" } }, async () => { nextCalled = true; return "bash-result"; });
    assert.equal(nextCalled, true);
    assert.equal(result, "bash-result");
    assert.equal(mockCache.lastNamespace, "");
});
test("createCacheGovernanceMiddleware uses correct namespace for cacheable tool", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    await middleware.run(createMockContext(), { toolName: "read", args: { path: "/workspace/file.ts" } }, async () => "read-result");
    assert.equal(mockCache.lastNamespace, "tool.read");
});
test("createCacheGovernanceMiddleware passes normalized args to cache", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    await middleware.run(createMockContext(), { toolName: "read", args: { path: "/workspace/file.ts" } }, async () => "result");
    assert.deepEqual(mockCache.lastArgs, { path: "/workspace/file.ts" });
});
test("createCacheGovernanceMiddleware includes toolName in tags", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    await middleware.run(createMockContext(), { toolName: "read", args: {} }, async () => "result");
    assert.ok(mockCache.tags.some(t => t.startsWith("tool:read")));
});
test("createCacheGovernanceMiddleware includes taskId in tags", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    await middleware.run(createMockContext(), { toolName: "read", args: {} }, async () => "result");
    assert.ok(mockCache.tags.some(t => t.includes("task-123")));
});
test("createCacheGovernanceMiddleware normalizes path with workspaceRoot", async () => {
    const mockCache = createMockCache();
    const middleware = createCacheGovernanceMiddleware({
        cache: mockCache,
        workspaceRoot: "/workspace",
    });
    await middleware.run(createMockContext(), { toolName: "read", args: { path: "relative/path.ts" } }, async () => "result");
    assert.ok(mockCache.lastArgs.path instanceof String || typeof mockCache.lastArgs.path === "string");
});
test("createCacheGovernanceMiddleware returns cached value on cache hit", async () => {
    const mockCache = createMockCache();
    mockCache.getOrComputeResult = { fromCache: true, value: "cached-value" };
    const logger = createMockLogger();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache, logger: logger });
    const result = await middleware.run(createMockContext(), { toolName: "read", args: { path: "/workspace/file.ts" } }, async () => "fresh");
    assert.equal(result, "cached-value");
    assert.ok(logger.debugMsgs.some(m => m.msg === "Cache hit for tool"));
});
test("createCacheGovernanceMiddleware logs cache miss", async () => {
    const mockCache = createMockCache();
    mockCache.getOrComputeResult = { fromCache: false, value: "fresh" };
    const logger = createMockLogger();
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache, logger: logger });
    await middleware.run(createMockContext(), { toolName: "read", args: {} }, async () => "fresh");
    assert.ok(logger.debugMsgs.some(m => m.msg === "Cache miss for tool"));
});
test("createCacheGovernanceMiddleware falls through on cache error", async () => {
    const failingCache = {
        async getOrCompute(_namespace, _args, _compute, _options) {
            throw new Error("Cache error");
        },
    };
    const logger = createMockLogger();
    const middleware = createCacheGovernanceMiddleware({
        cache: failingCache,
        logger: logger,
    });
    const result = await middleware.run(createMockContext(), { toolName: "read", args: {} }, async () => "tool-result");
    assert.equal(result, "tool-result");
});
test("createCacheSummaryMiddleware returns success", async () => {
    const mockCache = createMockCache();
    const logger = createMockLogger();
    const summaryMiddleware = createCacheSummaryMiddleware({ cache: mockCache, logger: logger });
    const result = await summaryMiddleware.run(createMockContext(), { response: {}, toolsUsed: [] });
    assert.deepEqual(result, { success: true });
});
test("createCacheSummaryMiddleware logs metrics", async () => {
    const mockCache = createMockCache();
    const logger = createMockLogger();
    const summaryMiddleware = createCacheSummaryMiddleware({ cache: mockCache, logger: logger });
    await summaryMiddleware.run(createMockContext(), { response: {}, toolsUsed: [] });
    assert.ok(logger.debugMsgs.some(m => m.msg === "Cache metrics summary"));
});
test("createCacheGovernanceMiddleware does not call next when cache hit", async () => {
    const mockCache = createMockCache();
    mockCache.getOrComputeResult = { fromCache: true, value: "cached-value" };
    const middleware = createCacheGovernanceMiddleware({ cache: mockCache });
    let nextCalled = false;
    await middleware.run(createMockContext(), { toolName: "read", args: {} }, async () => { nextCalled = true; return "fresh"; });
    assert.equal(nextCalled, false);
});
//# sourceMappingURL=cache-governance-middleware.test.js.map