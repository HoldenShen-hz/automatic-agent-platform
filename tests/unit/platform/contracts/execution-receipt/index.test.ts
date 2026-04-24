import assert from "node:assert/strict";
import test from "node:test";

import {
  createExecutionReceipt,
  type ExecutionReceipt,
  type ExecutionReceiptStatus,
} from "../../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("createExecutionReceipt generates a receiptId when not provided", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: null,
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
  });

  assert.ok(receipt.receiptId.startsWith("receipt_"));
  assert.equal(receipt.planId, "plan-1");
  assert.equal(receipt.taskId, "task-1");
  assert.equal(receipt.status, "accepted");
});

test("createExecutionReceipt uses provided receiptId", () => {
  const receipt = createExecutionReceipt({
    receiptId: "custom-receipt-id",
    planId: "plan-1",
    taskId: "task-1",
    status: "started",
    stepId: "step-1",
    workerId: "worker-1",
    tenantId: "tenant-1",
    resultRef: null,
    errorCode: null,
  });

  assert.equal(receipt.receiptId, "custom-receipt-id");
  assert.equal(receipt.status, "started");
  assert.equal(receipt.workerId, "worker-1");
});

test("createExecutionReceipt sets createdAt to nowIso when not provided", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: null,
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
  });

  assert.ok(receipt.createdAt.includes("T"));
});

test("createExecutionReceipt uses provided createdAt timestamp", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: null,
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(receipt.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createExecutionReceipt throws when taskId is empty", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "",
        status: "accepted",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("createExecutionReceipt throws when planId is empty", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "",
        taskId: "task-1",
        status: "accepted",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("createExecutionReceipt throws when status is completed but resultRef is missing", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "completed",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("createExecutionReceipt throws when status is failed but errorCode is missing", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "failed",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("createExecutionReceipt accepts completed status with resultRef", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "completed",
    stepId: "step-1",
    workerId: "worker-1",
    tenantId: "tenant-1",
    resultRef: "artifact:result-123",
    errorCode: null,
  });

  assert.equal(receipt.status, "completed");
  assert.equal(receipt.resultRef, "artifact:result-123");
});

test("createExecutionReceipt accepts failed status with errorCode", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "failed",
    stepId: "step-1",
    workerId: "worker-1",
    tenantId: "tenant-1",
    resultRef: null,
    errorCode: "ERR_EXECUTION_FAILED",
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.errorCode, "ERR_EXECUTION_FAILED");
});

test("createExecutionReceipt normalizes empty strings to null for optional fields", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: "",
    workerId: "",
    tenantId: "",
    resultRef: "",
    errorCode: "",
  });

  assert.equal(receipt.stepId, null);
  assert.equal(receipt.workerId, null);
  assert.equal(receipt.tenantId, null);
  assert.equal(receipt.resultRef, null);
  assert.equal(receipt.errorCode, null);
});

test("ExecutionReceiptStatus accepts all canonical status values", () => {
  const statuses: ExecutionReceiptStatus[] = ["accepted", "started", "completed", "failed", "cancelled"];
  assert.equal(statuses.length, 5);
});

test("createExecutionReceipt allows cancelled status without resultRef or errorCode", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "cancelled",
    stepId: null,
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
  });

  assert.equal(receipt.status, "cancelled");
});

test("createExecutionReceipt allows accepted status without resultRef or errorCode", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: null,
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
  });

  assert.equal(receipt.status, "accepted");
});

test("createExecutionReceipt normalizes whitespace-only strings to null", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "accepted",
    stepId: "   ",
    workerId: "\t",
    tenantId: "\n",
    resultRef: "  ",
    errorCode: "\t  \n",
  });

  assert.equal(receipt.stepId, null);
  assert.equal(receipt.workerId, null);
  assert.equal(receipt.tenantId, null);
  assert.equal(receipt.resultRef, null);
  assert.equal(receipt.errorCode, null);
});

test("createExecutionReceipt preserves non-empty string values", () => {
  const receipt = createExecutionReceipt({
    planId: "plan-1",
    taskId: "task-1",
    status: "started",
    stepId: " step-1 ",
    workerId: " worker-1 ",
    tenantId: " tenant-1 ",
    resultRef: " result-1 ",
    errorCode: " ERR_001 ",
  });

  assert.equal(receipt.stepId, " step-1 ");
  assert.equal(receipt.workerId, " worker-1 ");
  assert.equal(receipt.tenantId, " tenant-1 ");
  assert.equal(receipt.resultRef, " result-1 ");
  assert.equal(receipt.errorCode, " ERR_001 ");
});

test("createExecutionReceipt throws ValidationError with correct error code for missing task/plan", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "",
        taskId: "",
        status: "accepted",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    (err: any) => {
      return err.code === "execution_receipt.task_and_plan_required";
    },
  );
});

test("createExecutionReceipt throws ValidationError with correct error code for missing resultRef on completed", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "completed",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    (err: any) => {
      return err.code === "execution_receipt.result_ref_required";
    },
  );
});

test("createExecutionReceipt throws ValidationError with correct error code for missing errorCode on failed", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan-1",
        taskId: "task-1",
        status: "failed",
        stepId: null,
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    (err: any) => {
      return err.code === "execution_receipt.error_code_required";
    },
  );
});