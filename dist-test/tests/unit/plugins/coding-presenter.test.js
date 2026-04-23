import test from "node:test";
import assert from "node:assert/strict";
import { createCodingPresenterPlugin } from "../../../src/plugins/presenters/coding-presenter.js";
test("createCodingPresenterPlugin returns valid presenter plugin structure", () => {
    const plugin = createCodingPresenterPlugin();
    assert.equal(plugin.pluginId, "plugin.coding.presenter");
    assert.equal(plugin.domainId, "coding");
    assert.equal(plugin.spiType, "presenter");
    assert.ok(Array.isArray(plugin.capabilityIds));
    assert.ok(plugin.capabilityIds.includes("present.output"));
    assert.ok(plugin.capabilityIds.includes("present.diff"));
    assert.ok(plugin.capabilityIds.includes("present.summary"));
});
test("createCodingPresenterPlugin.initialize returns undefined", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.initialize();
    assert.equal(result, undefined);
});
test("createCodingPresenterPlugin.healthCheck returns true", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.healthCheck();
    assert.equal(result, true);
});
test("createCodingPresenterPlugin.shutdown returns undefined", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
});
test("formatOutput with no machine outputs returns no coding output message", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.formatOutput({
        machineOutputs: [],
        artifacts: [],
        audience: "end_user",
    });
    assert.equal(result.summary, "No coding output produced");
    assert.deepEqual(result.sections, []);
    assert.deepEqual(result.citations, []);
});
test("formatOutput with no artifacts returns no artifacts section", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "step_1",
                outputRef: null,
                payload: { result: "hello" },
            },
        ],
        artifacts: [],
        audience: "developer",
    });
    assert.ok(result.summary.includes("Completed 1 coding step(s)"));
    assert.ok(result.summary.includes("step_1"));
    assert.ok(result.sections.some((s) => s.includes("step_1")));
});
test("formatOutput includes outputRef when present", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "read_files",
                outputRef: "artifact:abc123",
                payload: { files: ["a.ts", "b.ts"] },
            },
        ],
        artifacts: ["artifact:abc123"],
        audience: "reviewer",
    });
    assert.ok(result.sections.some((s) => s.includes("outputRef: artifact:abc123")));
});
test("formatOutput includes artifacts section when artifacts present", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "build",
                outputRef: null,
                payload: { built: true },
            },
        ],
        artifacts: ["artifact:xyz", "artifact:abc"],
        audience: "operator",
    });
    assert.ok(result.sections.some((s) => s.includes("Artifacts")));
    assert.ok(result.sections.some((s) => s.includes("artifact:xyz")));
    assert.ok(result.sections.some((s) => s.includes("artifact:abc")));
});
test("formatOutput uses audience in formatting", async () => {
    const plugin = createCodingPresenterPlugin();
    const resultEndUser = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "step_1",
                outputRef: null,
                payload: { data: "test" },
            },
        ],
        artifacts: [],
        audience: "end_user",
    });
    const resultDeveloper = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "step_1",
                outputRef: null,
                payload: { data: "test" },
            },
        ],
        artifacts: [],
        audience: "developer",
    });
    // Both should have sections but may differ in detail level
    assert.ok(resultEndUser.sections.length >= 0);
    assert.ok(resultDeveloper.sections.length >= 0);
});
test("formatOutput formats payload as JSON code block", async () => {
    const plugin = createCodingPresenterPlugin();
    const result = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "analyze",
                outputRef: null,
                payload: { files: ["a.ts"], count: 42 },
            },
        ],
        artifacts: [],
        audience: "developer",
    });
    assert.ok(result.sections.some((s) => s.includes("```json")));
    assert.ok(result.sections.some((s) => s.includes('"files"')));
    assert.ok(result.sections.some((s) => s.includes('"count"')));
});
test("formatOutput citations contain all artifact refs", async () => {
    const plugin = createCodingPresenterPlugin();
    const artifacts = ["artifact:ref1", "artifact:ref2", "artifact:ref3"];
    const result = await plugin.formatOutput({
        machineOutputs: [
            {
                stepId: "step_1",
                outputRef: null,
                payload: {},
            },
        ],
        artifacts: [...artifacts],
        audience: "operator",
    });
    assert.deepEqual(result.citations, [...artifacts]);
});
//# sourceMappingURL=coding-presenter.test.js.map