import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionReceipt,
  type ExecutionReceiptStatus,
} from "../../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("ExecutionReceiptStatus remains available as a compatibility type", () => {
  const status: ExecutionReceiptStatus = "cancelled";
  assert.equal(status, "cancelled");
});

test("createExecutionReceipt fails fast because NodeAttemptReceipt is canonical", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "accepted",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
});
