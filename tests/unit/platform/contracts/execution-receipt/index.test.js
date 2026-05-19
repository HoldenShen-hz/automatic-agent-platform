import assert from "node:assert/strict";
import test from "node:test";
import { createExecutionReceipt, } from "../../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
test("ExecutionReceiptStatus remains available as a compatibility type", () => {
    const status = "cancelled";
    assert.equal(status, "cancelled");
});
test("createExecutionReceipt fails fast because NodeAttemptReceipt is canonical", () => {
    assert.throws(() => createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "accepted",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
    }), (error) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden");
});
//# sourceMappingURL=index.test.js.map