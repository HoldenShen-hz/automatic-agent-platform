/**
 * Execution Receipt Contract Unit Tests
 *
 * Tests the execution receipt creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionReceipt } from "../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("execution-receipt: createExecutionReceipt rejects legacy accepted receipts", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: null,
        status: "accepted",
        workerId: null,
        tenantId: null,
        resultRef: null,
        errorCode: null,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("execution-receipt: createExecutionReceipt rejects legacy completed receipts", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: "step_1",
        status: "completed",
        workerId: "worker_1",
        tenantId: "tenant_abc",
        resultRef: "result_ref_123",
        errorCode: null,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("execution-receipt: createExecutionReceipt rejects legacy failed receipts", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: "step_2",
        status: "failed",
        workerId: "worker_2",
        tenantId: null,
        resultRef: null,
        errorCode: "ERR_TASK_FAILED",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
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

test("execution-receipt: createExecutionReceipt rejects even normalized legacy payloads", () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        planId: "plan_123",
        taskId: "task_456",
        stepId: "  ",
        status: "started",
        workerId: "",
        tenantId: "\t",
        resultRef: null,
        errorCode: null,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
  );
});

test("execution-receipt: createExecutionReceipt rejects all legacy status values", () => {
  const statuses: Array<"accepted" | "started" | "completed" | "failed" | "cancelled"> = [
    "accepted",
    "started",
    "completed",
    "failed",
    "cancelled",
  ];

  for (const status of statuses) {
    assert.throws(
      () =>
        createExecutionReceipt({
          planId: "plan_123",
          taskId: "task_456",
          stepId: status === "completed" ? "step_1" : status === "failed" ? "step_1" : null,
          status,
          workerId: null,
          tenantId: null,
          resultRef: status === "completed" ? "ref" : null,
          errorCode: status === "failed" ? "err" : null,
        }),
      (error: unknown) => error instanceof ValidationError && error.code === "execution_receipt.legacy_contract_forbidden",
    );
  }
});
