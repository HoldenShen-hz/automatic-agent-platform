import assert from "node:assert/strict";
import test from "node:test";
import { MULTI_STEP_TOOL_DEFINITIONS, resolveMultiStepToolPath, runMultiStepOrchestration, runPhase1BOrchestration, } from "../../../../../src/platform/execution/execution-engine/index.js";
test("execution-engine barrel exports orchestration entrypoints", () => {
    assert.equal(typeof runMultiStepOrchestration, "function");
    assert.equal(typeof runPhase1BOrchestration, "function");
    assert.equal(runPhase1BOrchestration, runMultiStepOrchestration);
});
test("execution-engine barrel exports tool definition surface", () => {
    assert.ok(Array.isArray(MULTI_STEP_TOOL_DEFINITIONS));
    assert.ok(MULTI_STEP_TOOL_DEFINITIONS.some((tool) => tool.name === "todo_write"));
});
test("execution-engine barrel exports multi-step path guard helpers", () => {
    const rootPath = "/workspace";
    assert.equal(resolveMultiStepToolPath(rootPath, "src/index.ts"), "/workspace/src/index.ts");
});
//# sourceMappingURL=index.test.js.map