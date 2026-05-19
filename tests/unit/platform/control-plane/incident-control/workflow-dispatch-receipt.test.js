import assert from "node:assert/strict";
import test from "node:test";
import { extractWorkflowDispatchReceipt } from "../../../../../src/platform/control-plane/incident-control/workflow-dispatch-receipt.js";
test("WorkflowDispatchReceipt structure is correct", () => {
    const receipt = {
        runId: "12345678",
        runUrl: "https://github.com/owner/repo/actions/runs/12345678",
    };
    assert.equal(receipt.runId, "12345678");
    assert.ok(receipt.runUrl.includes("12345678"));
});
test("WorkflowDispatchReceipt allows null values", () => {
    const receipt = {
        runId: null,
        runUrl: null,
    };
    assert.equal(receipt.runId, null);
    assert.equal(receipt.runUrl, null);
});
test("extractWorkflowDispatchReceipt extracts run URL", () => {
    const output = "Workflow dispatched successfully\nhttps://github.com/owner/repo/actions/runs/987654321";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "987654321");
    assert.ok(result.runUrl.includes("987654321"));
});
test("extractWorkflowDispatchReceipt extracts run ID from text", () => {
    const output = "Run ID: 54321";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "54321");
    assert.equal(result.runUrl, null);
});
test("extractWorkflowDispatchReceipt extracts workflow run id", () => {
    const output = "workflow run id 12345";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "12345");
});
test("extractWorkflowDispatchReceipt returns null for empty input", () => {
    const result = extractWorkflowDispatchReceipt("");
    assert.equal(result.runId, null);
    assert.equal(result.runUrl, null);
});
test("extractWorkflowDispatchReceipt returns null for no match", () => {
    const output = "Some random output without run info";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, null);
    assert.equal(result.runUrl, null);
});
test("extractWorkflowDispatchReceipt prefers URL over ID", () => {
    const output = "Run ID: 11111 but also https://github.com/owner/repo/actions/runs/22222";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "22222");
    assert.ok(result.runUrl.includes("22222"));
});
test("extractWorkflowDispatchReceipt handles multiline output", () => {
    const output = `Some header text
  https://github.com/owner/repo/actions/runs/555555555
  More details`;
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "555555555");
});
test("extractWorkflowDispatchReceipt requires minimum 5 digits for ID", () => {
    const output = "run id: 1234"; // Only 4 digits
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, null);
});
test("extractWorkflowDispatchReceipt handles case insensitivity", () => {
    const output = "RUN ID: 67890";
    const result = extractWorkflowDispatchReceipt(output);
    assert.equal(result.runId, "67890");
});
//# sourceMappingURL=workflow-dispatch-receipt.test.js.map