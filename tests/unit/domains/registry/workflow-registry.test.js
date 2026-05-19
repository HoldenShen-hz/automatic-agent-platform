import test from "node:test";
import assert from "node:assert/strict";
import { WorkflowRegistry } from "../../../../src/domains/registry/workflow-registry.js";
function makeWorkflow(workflowId) {
    return {
        workflowId,
        name: `Workflow ${workflowId}`,
        triggerConditions: {},
        steps: [],
    };
}
test("WorkflowRegistry.registerAll stores multiple workflows", () => {
    const registry = new WorkflowRegistry();
    registry.registerAll([makeWorkflow("wf_a"), makeWorkflow("wf_b")]);
    const list = registry.list();
    assert.equal(list.length, 2);
});
test("WorkflowRegistry.get returns registered workflow by id", () => {
    const registry = new WorkflowRegistry();
    registry.registerAll([makeWorkflow("wf_get")]);
    const result = registry.get("wf_get");
    assert.ok(result !== null);
    assert.equal(result.workflowId, "wf_get");
});
test("WorkflowRegistry.get returns null for unknown id", () => {
    const registry = new WorkflowRegistry();
    assert.equal(registry.get("nonexistent"), null);
});
test("WorkflowRegistry.list returns all registered workflows", () => {
    const registry = new WorkflowRegistry();
    registry.registerAll([makeWorkflow("wf_list_1"), makeWorkflow("wf_list_2")]);
    const list = registry.list();
    assert.ok(list.some((w) => w.workflowId === "wf_list_1"));
    assert.ok(list.some((w) => w.workflowId === "wf_list_2"));
});
test("WorkflowRegistry.list returns a copy", () => {
    const registry = new WorkflowRegistry();
    registry.registerAll([makeWorkflow("wf_copy")]);
    const list1 = registry.list();
    list1.push({});
    const list2 = registry.list();
    assert.ok(list2.every((w) => w.workflowId !== undefined));
});
test("WorkflowRegistry.registerAll overwrites existing workflow with same id", () => {
    const registry = new WorkflowRegistry();
    registry.registerAll([makeWorkflow("wf_dup")]);
    registry.registerAll([makeWorkflow("wf_dup")]);
    const list = registry.list();
    assert.equal(list.length, 1);
});
//# sourceMappingURL=workflow-registry.test.js.map