/**
 * Workflow Dispatch Receipt Tests
 *
 * Tests for the workflow dispatch receipt parser that extracts
 * run IDs and URLs from GitHub Actions CLI output.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { extractWorkflowDispatchReceipt } from "../../../src/platform/control-plane/incident-control/workflow-dispatch-receipt.js";
test("extractWorkflowDispatchReceipt parses run ID from success output", () => {
    const output = `Created workflow_dispatch event
https://github.com/automatic-agent/automatic-agent-platform/actions/runs/710000001`;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "710000001");
    assert.equal(result.runUrl, "https://github.com/automatic-agent/automatic-agent-platform/actions/runs/710000001");
});
test("extractWorkflowDispatchReceipt handles output with run ID only", () => {
    const output = `https://github.com/automatic-agent/automatic-agent-platform/actions/runs/123456`;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "123456");
    assert.equal(result.runUrl, "https://github.com/automatic-agent/automatic-agent-platform/actions/runs/123456");
});
test("extractWorkflowDispatchReceipt returns null on missing run ID", () => {
    const output = "workflow dispatch not triggered";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, null);
    assert.equal(result.runUrl, null);
});
test("extractWorkflowDispatchReceipt handles empty string", () => {
    const result = extractWorkflowDispatchReceipt("");
    assert.equal(result.runId, null);
    assert.equal(result.runUrl, null);
});
test("extractWorkflowDispatchReceipt handles multiline output with errors", () => {
    const output = `Starting job
Created workflow_dispatch event
https://github.com/example/repo/actions/runs/999999
Error: some error occurred`;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "999999");
    assert.equal(result.runUrl, "https://github.com/example/repo/actions/runs/999999");
});
test("extractWorkflowDispatchReceipt handles multiple URLs takes first", () => {
    const output = `First run: https://github.com/example/repo/actions/runs/111111
Second run: https://github.com/example/repo/actions/runs/222222`;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "111111", "Should take first run ID");
    assert.ok(result.runUrl !== null && result.runUrl.includes("111111"), "URL should contain first run ID");
});
test("extractWorkflowDispatchReceipt handles URL with trailing whitespace", () => {
    const output = `Created workflow_dispatch event
https://github.com/automatic-agent/automatic-agent-platform/actions/runs/710000001  `;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "710000001");
});
test("extractWorkflowDispatchReceipt handles different repository formats", () => {
    const outputs = [
        "https://github.com/owner/repo/actions/runs/123",
        "https://github.com/org/team/repo/actions/runs/456",
        "https://github.com/fork/automatic-agent-platform/actions/runs/789",
    ];
    for (const output of outputs) {
        const result = extractWorkflowDispatchReceipt(output);
        assert.ok(result.runId !== null && result.runId.length > 0, `Should parse: ${output}`);
        assert.ok(result.runUrl !== null && result.runUrl.startsWith("https://github.com/"), "Should have valid GitHub URL");
    }
});
test("extractWorkflowDispatchReceipt parses numeric run ID", () => {
    const output = "https://github.com/example/repo/actions/runs/1234567890";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "1234567890");
});
test("extractWorkflowDispatchReceipt handles stderr combined output", () => {
    const combinedOutput = `Warning: deprecated flag
Created workflow_dispatch event
https://github.com/automatic-agent/automatic-agent-platform/actions/runs/710000002
Done`;
    const result = extractWorkflowDispatchReceipt(combinedOutput);
    assert.equal(result.runId, "710000002");
});
//# sourceMappingURL=workflow-dispatch-receipt.test.js.map