/**
 * Execution Receipt Contract Unit Tests
 *
 * Tests the execution receipt creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionReceipt } from "../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("execution-receipt: createExecutionReceipt generates valid receipt for accepted status", () => {
  const receipt = createExecutionReceipt({
    planId: "plan_123",
    taskId: "task_456",
    stepId: null,
    status: "accepted",
    workerId: null,
    tenantId: null,
    resultRef: null,
    errorCode: null,
  });

  assert.equal(receipt.planId, "plan_123");
  assert.equal(receipt.taskId, "task_456");
  assert.equal(receipt.stepId, null);
  assert.equal(receipt.status, "accepted");
  assert.equal(receipt.workerId, null);
  assert.equal(receipt.tenantId, null);
  assert.equal(receipt.resultRef, null);
  assert.equal(receipt.errorCode, null);
  assert.ok(receipt.receiptId.startsWith("receipt_"));
  assert.ok(receipt.createdAt.length > 0);
});

test("execution-receipt: createExecutionReceipt generates valid receipt for completed status", () => {
  const receipt = createExecutionReceipt({
    planId: "plan_123",
    taskId: "task_456",
    stepId: "step_1",
    status: "completed",
    workerId: "worker_1",
    tenantId: "tenant_abc",
    resultRef: "result_ref_123",
    errorCode: null,
  });

  assert.equal(receipt.status, "completed");
  assert.equal(receipt.stepId, "step_1");
  assert.equal(receipt.workerId, "worker_1");
  assert.equal(receipt.tenantId, "tenant_abc");
  assert.equal(receipt.resultRef, "result_ref_123");
});

test("execution-receipt: createExecutionReceipt generates valid receipt for failed status", () => {
  const receipt = createExecutionReceipt({
    planId: "plan_123",
    taskId: "task_456",
    stepId: "step_2",
    status: "failed",
    workerId: "worker_2",
    tenantId: null,
    resultRef: null,
    errorCode: "ERR_TASK_FAILED",
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.stepId, "step_2");
  assert.equal(receipt.workerId, "worker_2");
  assert.equal(receipt.errorCode, "ERR_TASK_FAILED");
});

test("execution-receipt: createExecutionReceipt throws when taskId is empty", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "",
        stepId: null,
        status: "accepted",
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("execution-receipt: createExecutionReceipt throws when planId is empty", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "   ",
        taskId: "task_456",
        stepId: null,
        status: "accepted",
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("execution-receipt: createExecutionReceipt throws when completed status lacks resultRef", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: null,
        status: "completed",
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("execution-receipt: createExecutionReceipt throws when failed status lacks errorCode", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: null,
        status: "failed",
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    ValidationError,
  );
});

test("execution-receipt: createExecutionReceipt normalizes whitespace-only strings to null", () => {
  const receipt = createExecutionReceipt({
    planId: "plan_123",
    taskId: "task_456",
    stepId: "  ",
    status: "started",
    workerId: "",
    tenantId: "\t",
    resultRef: null,
    errorCode: null,
  });

  assert.equal(receipt.stepId, null);
  assert.equal(receipt.workerId, null);
  assert.equal(receipt.tenantId, null);
});

test("execution-receipt: createExecutionReceipt accepts all status values", () => {
  const statuses: Array<"accepted" | "started" | "completed" | "failed" | "cancelled"> = [
    "accepted",
    "started",
    "completed",
    "failed",
    "cancelled",
  ];

  for (const status of statuses) {
    const receipt = createExecutionReceipt({
      planId: "plan_123",
      taskId: "task_456",
      stepId: status === "completed" ? "step_1" : status === "failed" ? "step_1" : null,
      status,
      workerId: null,
      tenantId: null,
      resultRef: status === "completed" ? "ref" : null,
      errorCode: status === "failed" ? "err" : null,
    });

    assert.equal(receipt.status, status);
  }
});
