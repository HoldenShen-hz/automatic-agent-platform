import test from "node:test";
import assert from "node:assert/strict";
import { ToolbeltAssembler } from "../../../../../src/platform/orchestration/harness/toolbelt-assembler.js";
test("ToolbeltAssembler is exported and can be instantiated", () => {
    const assembler = new ToolbeltAssembler();
    assert.ok(assembler !== undefined);
    assert.equal(typeof assembler.assemble, "function");
});
test("ToolbeltAssembler.assemble returns correct structure", () => {
    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
        allowedTools: ["tool-a"],
        requestedTools: ["tool-a"],
        requiredEvidence: ["evidence-1"],
    });
    assert.ok(Array.isArray(toolbelt.allowedTools));
    assert.ok(Array.isArray(toolbelt.grantedTools));
    assert.ok(Array.isArray(toolbelt.blockedTools));
    assert.ok(Array.isArray(toolbelt.requiredEvidence));
});
test("ToolbeltAssembler.assemble grants allowed tools", () => {
    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
        allowedTools: ["tool-a", "tool-b", "tool-c"],
        requestedTools: ["tool-a", "tool-c"],
        requiredEvidence: ["evidence-1"],
    });
    assert.deepEqual(toolbelt.grantedTools, ["tool-a", "tool-c"]);
    assert.deepEqual(toolbelt.blockedTools, []);
});
test("ToolbeltAssembler.assemble blocks tools not in allowed list", () => {
    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
        allowedTools: ["tool-a", "tool-b"],
        requestedTools: ["tool-a", "tool-x"],
        requiredEvidence: [],
    });
    assert.deepEqual(toolbelt.grantedTools, ["tool-a"]);
    assert.deepEqual(toolbelt.blockedTools, ["tool-x"]);
});
test("ToolbeltAssembler.assemble handles empty requested tools", () => {
    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
        allowedTools: ["tool-a"],
        requestedTools: [],
        requiredEvidence: [],
    });
    assert.deepEqual(toolbelt.grantedTools, []);
    assert.deepEqual(toolbelt.blockedTools, []);
});
test("ToolbeltAssembler.assemble creates defensive copies", () => {
    const assembler = new ToolbeltAssembler();
    const toolbelt = assembler.assemble({
        allowedTools: ["tool-a"],
        requestedTools: ["tool-a"],
        requiredEvidence: [],
    });
    // Verify defensive copy - modifications to result don't affect inputs
    assert.equal(toolbelt.allowedTools.length, 1);
    assert.equal(toolbelt.grantedTools.length, 1);
});
//# sourceMappingURL=toolbelt.test.js.map