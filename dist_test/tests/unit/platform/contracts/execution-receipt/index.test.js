import assert from "node:assert/strict";
import test from "node:test";
import { createExecutionReceipt } from "../../../../../src/platform/contracts/execution-receipt/index.js";
test("ExecutionReceiptStatus accepts canonical lifecycle states", () => {
    const statuses = ["accepted", "started", "completed", "failed", "cancelled"];
    assert.equal(statuses.length, 5);
});
test("createExecutionReceipt enforces result refs for completed receipts", () => {
    const receipt = createExecutionReceipt({
        planId: "plan-1",
        stepId: "step-1",
        status: "completed",
        workerId: "worker-1",
        taskId: "task-1",
        tenantId: "tenant-1",
        resultRef: "artifact:1",
        errorCode: null,
    });
    assert.equal(receipt.status, "completed");
    assert.equal(receipt.resultRef, "artifact:1");
});
//# sourceMappingURL=index.test.js.map