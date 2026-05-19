import assert from "node:assert/strict";
import test from "node:test";
import { createCodingRetrieverPlugin } from "../../../../src/plugins/retrievers/coding-retriever.js";
test("CodingRetriever type exports are correct", () => {
    const plugin = createCodingRetrieverPlugin();
    assert.ok(plugin !== undefined);
});
test("CodingRetriever has correct plugin metadata", () => {
    const plugin = createCodingRetrieverPlugin();
    assert.equal(plugin.pluginId, "plugin.coding.retriever");
    assert.equal(plugin.domainId, "coding");
    assert.equal(plugin.spiType, "retriever");
});
test("CodingRetriever has correct capabilityIds", () => {
    const plugin = createCodingRetrieverPlugin();
    assert.deepEqual(plugin.capabilityIds, ["knowledge.retrieve", "domain.observe", "repo.search"]);
});
test("CodingRetriever.initialize is no-op", async () => {
    const plugin = createCodingRetrieverPlugin();
    assert.ok(plugin.initialize !== undefined);
    await plugin.initialize();
});
test("CodingRetriever.healthCheck returns true", async () => {
    const plugin = createCodingRetrieverPlugin();
    assert.ok(plugin.healthCheck !== undefined);
    const result = await plugin.healthCheck();
    assert.equal(result, true);
});
test("CodingRetriever.shutdown returns undefined", async () => {
    const plugin = createCodingRetrieverPlugin();
    assert.ok(plugin.shutdown !== undefined);
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
});
test("CodingRetriever.retrieve returns results with default tokenBudget", async () => {
    const plugin = createCodingRetrieverPlugin();
    const results = await plugin.retrieve({
        taskId: "task_123",
        intent: "find code",
        context: {},
        tokenBudget: 1000,
    });
    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 2);
    assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});
test("CodingRetriever.retrieve respects tokenBudget", async () => {
    const plugin = createCodingRetrieverPlugin();
    const smallBudget = await plugin.retrieve({
        taskId: "task_456",
        intent: "find code",
        context: {},
        tokenBudget: 200,
    });
    const largeBudget = await plugin.retrieve({
        taskId: "task_789",
        intent: "find code",
        context: {},
        tokenBudget: 2000,
    });
    assert.ok(smallBudget.length >= 2);
    assert.ok(largeBudget.length <= 12);
});
test("CodingRetriever.retrieve includes context in search", async () => {
    const plugin = createCodingRetrieverPlugin();
    const results = await plugin.retrieve({
        taskId: "task_ctx",
        intent: "find function",
        context: { currentFile: "/path/to/file.ts" },
        tokenBudget: 1000,
    });
    assert.ok(results.length > 0);
    assert.ok(results.every(r => typeof r.knowledgeRef === "string"));
});
test("CodingRetriever.retrieve returns valid knowledge references", async () => {
    const plugin = createCodingRetrieverPlugin();
    const results = await plugin.retrieve({
        taskId: "task_struct",
        intent: "find class",
        context: {},
        tokenBudget: 1000,
    });
    for (const result of results) {
        assert.ok(typeof result.knowledgeRef === "string");
        assert.ok(result.knowledgeRef.startsWith("knowledge:"));
    }
});
test("CodingRetriever.retrieve returns at least 2 results even with low budget", async () => {
    const plugin = createCodingRetrieverPlugin();
    const results = await plugin.retrieve({
        taskId: "task_min",
        intent: "code",
        context: {},
        tokenBudget: 100,
    });
    assert.ok(results.length >= 2);
});
test("CodingRetriever.retrieve handles focus from context", async () => {
    const plugin = createCodingRetrieverPlugin();
    const results = await plugin.retrieve({
        taskId: "task_focus",
        intent: "search",
        context: { focus: "authentication" },
        tokenBudget: 1000,
    });
    assert.ok(Array.isArray(results));
});
test("CodingRetriever.createCodingRetrieverPlugin accepts custom rootPath", () => {
    const plugin = createCodingRetrieverPlugin({
        rootPath: "/custom/path",
    });
    assert.ok(plugin !== undefined);
});
//# sourceMappingURL=coding-retriever.test.js.map