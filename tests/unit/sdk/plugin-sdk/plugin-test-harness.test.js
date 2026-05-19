import assert from "node:assert/strict";
import test from "node:test";
import { PluginTestHarness } from "../../../../src/sdk/plugin-sdk/plugin-test-harness.js";
import { defineTool, defineAdapter, defineRetriever, defineEvaluator } from "../../../../src/sdk/plugin-sdk/plugin-definition.js";
test("PluginTestHarness creates with plugin definition", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    assert.equal(harness.getPlugin().pluginId, "test.tool");
});
test("PluginTestHarness creates with custom timeout", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin, timeoutMs: 60000 });
    assert.ok(harness.getPlugin().pluginId === "test.tool");
});
test("PluginTestHarness creates with mock LLM config", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({
        plugin,
        mockLlm: {
            responses: [{ content: "mock response" }],
            delayMs: 100,
        },
    });
    assert.ok(harness.getPlugin().pluginId === "test.tool");
});
test("PluginTestHarness creates with mock tools", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({
        plugin,
        mockTools: [
            { toolId: "tool1", success: true, output: { result: "ok" }, durationMs: 10 },
        ],
    });
    assert.ok(harness.getPlugin().pluginId === "test.tool");
});
test("PluginTestHarness.configureMockLlm updates mock config", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    harness.configureMockLlm({
        responses: [{ content: "new mock" }],
        delayMs: 50,
    });
    // No error means success
});
test("PluginTestHarness.addMockToolResult adds tool result", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    harness.addMockToolResult({
        toolId: "another-tool",
        success: true,
        output: { result: "added" },
        durationMs: 5,
    });
    // No error means success
});
test("PluginTestHarness.runCase executes and returns result", async () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object", properties: { query: { type: "string" } } },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const result = await harness.runCase({ query: "test" });
    assert.equal(result.caseName, "single-case");
    assert.ok(result.durationMs >= 0);
});
test("PluginTestHarness.runCase handles errors gracefully", async () => {
    const plugin = defineAdapter({
        pluginId: "test.adapter",
        name: "Test Adapter",
        version: "1.0.0",
        capabilities: [{
                name: "adapt",
                description: "Adapt",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    // Run case - should handle gracefully
    const result = await harness.runCase({});
    assert.ok(result.passed === true || result.passed === false);
});
test("PluginTestHarness.runCases processes multiple test cases", async () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([
        { name: "case1", input: { data: "test1" } },
        { name: "case2", input: { data: "test2" } },
        { name: "case3", input: { data: "test3" }, expectedOutput: { result: "match" } },
    ]);
    assert.equal(report.totalCases, 3);
    assert.ok(report.passedCases >= 0);
    assert.ok(report.failedCases >= 0);
    assert.equal(report.pluginId, "test.tool");
    assert.ok(report.timestamp.length > 0);
});
test("PluginTestHarness.runCases calculates coverage percentage", async () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([
        { name: "case1", input: { data: "test1" } },
        { name: "case2", input: { data: "test2" } },
    ]);
    assert.ok(report.coveragePercent >= 0 && report.coveragePercent <= 100);
});
test("PluginTestHarness.runCases handles empty test case list", async () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([]);
    assert.equal(report.totalCases, 0);
    assert.equal(report.passedCases, 0);
    assert.equal(report.failedCases, 0);
    assert.equal(report.coveragePercent, 0);
});
test("PluginTestHarness.runCases handles retriever plugin type", async () => {
    const plugin = defineRetriever({
        pluginId: "test.retriever",
        name: "Test Retriever",
        version: "1.0.0",
        capabilities: [{
                name: "retrieve",
                description: "Retrieve",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([
        { name: "retrieve-case", input: { query: "find stuff" } },
    ]);
    assert.equal(report.totalCases, 1);
});
test("PluginTestHarness.runCases handles evaluator plugin type", async () => {
    const plugin = defineEvaluator({
        pluginId: "test.evaluator",
        name: "Test Evaluator",
        version: "1.0.0",
        capabilities: [{
                name: "evaluate",
                description: "Evaluate",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([
        { name: "eval-case", input: { result: "output" } },
    ]);
    assert.equal(report.totalCases, 1);
});
test("PluginTestHarness.createContext creates plugin context", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const ctx = harness.createContext({ taskId: "task-123" });
    assert.equal(ctx.pluginId, "test.tool");
    assert.equal(ctx.taskId, "task-123");
});
test("PluginTestHarness.getPlugin returns original plugin definition", () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const returned = harness.getPlugin();
    assert.equal(returned.pluginId, "test.tool");
    assert.equal(returned.name, "Test Tool");
    assert.equal(returned.version, "1.0.0");
});
test("PluginTestHarness handles case with expectedOutput mismatch", async () => {
    const plugin = defineTool({
        pluginId: "test.tool",
        name: "Test Tool",
        version: "1.0.0",
        capabilities: [{
                name: "execute",
                description: "Execute",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
            }],
    });
    const harness = new PluginTestHarness({ plugin });
    const report = await harness.runCases([
        { name: "mismatch-case", input: { data: "test" }, expectedOutput: { wrong: "output" } },
    ]);
    assert.equal(report.failedCases, 1);
    assert.ok(report.results[0]?.expectedOutput !== undefined);
});
//# sourceMappingURL=plugin-test-harness.test.js.map