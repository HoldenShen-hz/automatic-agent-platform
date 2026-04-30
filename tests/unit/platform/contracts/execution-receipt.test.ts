/**
 * Execution Receipt Contract Unit Tests
 *
 * Tests the execution receipt creation and validation logic, including:
 * - Legacy ExecutionReceipt types (deprecated)
 * - Canonical NodeAttemptReceipt type (re-exported from executable-contracts)
 * - Contract envelope wrapping for receipts
 *
 * @see src/platform/contracts/execution-receipt/index.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  // Legacy (deprecated)
  createExecutionReceipt,
  type ExecutionReceipt,
  type ExecutionReceiptStatus,
  // Re-exported canonical
  type NodeAttemptReceipt,
  type AppErrorRef,
  createNodeAttemptReceipt,
} from "../../../../src/platform/contracts/execution-receipt/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Legacy ExecutionReceipt Tests (Deprecated)
// =============================================================================

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

// =============================================================================
// ExecutionReceiptStatus Union Tests
// =============================================================================

test("execution-receipt: ExecutionReceiptStatus union contains expected values", () => {
  const statuses: ExecutionReceiptStatus[] = [
    "accepted",
    "started",
    "completed",
    "failed",
    "cancelled",
  ];

  for (const status of statuses) {
    const receipt: ExecutionReceipt = {
      receiptId: `receipt_${status}`,
      planId: "plan_test",
      taskId: "task_test",
      tenantId: null,
      stepId: null,
      status,
      workerId: null,
      resultRef: status === "completed" ? "ref" : null,
      errorCode: status === "failed" ? "err" : null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };
    assert.equal(receipt.status, status);
  }
});

// =============================================================================
// Legacy ExecutionReceipt Structure Tests
// =============================================================================

test("execution-receipt: ExecutionReceipt has correct shape", () => {
  const receipt: ExecutionReceipt = {
    receiptId: "receipt_123",
    planId: "plan_abc",
    taskId: "task_xyz",
    tenantId: "tenant_1",
    stepId: "step_1",
    status: "completed",
    workerId: "worker_1",
    resultRef: "result_ref_123",
    errorCode: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  assert.equal(receipt.receiptId, "receipt_123");
  assert.equal(receipt.planId, "plan_abc");
  assert.equal(receipt.taskId, "task_xyz");
  assert.equal(receipt.tenantId, "tenant_1");
  assert.equal(receipt.stepId, "step_1");
  assert.equal(receipt.status, "completed");
  assert.equal(receipt.workerId, "worker_1");
  assert.equal(receipt.resultRef, "result_ref_123");
});

test("execution-receipt: ExecutionReceipt allows nullable fields", () => {
  const receipt: ExecutionReceipt = {
    receiptId: "receipt_null",
    planId: "plan_null",
    taskId: "task_null",
    tenantId: null,
    stepId: null,
    status: "accepted",
    workerId: null,
    resultRef: null,
    errorCode: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  assert.equal(receipt.tenantId, null);
  assert.equal(receipt.stepId, null);
  assert.equal(receipt.workerId, null);
  assert.equal(receipt.resultRef, null);
  assert.equal(receipt.errorCode, null);
});

// =============================================================================
// Canonical NodeAttemptReceipt Tests (Re-exported)
// =============================================================================

test("execution-receipt: createNodeAttemptReceipt creates succeeded receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_123",
    nodeRunId: "nrun_456",
    harnessRunId: "hrun_789",
    planGraphId: "pg_abc",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    errorDetail: "",
    outputRef: {
      artifactId: "output_1",
      uri: "artifact://output_1",
    },
  });

  assert.ok(receipt.nodeAttemptReceiptId.startsWith("nreceipt_"));
  assert.equal(receipt.nodeAttemptId, "nattempt_123");
  assert.equal(receipt.nodeRunId, "nrun_456");
  assert.equal(receipt.harnessRunId, "hrun_789");
  assert.equal(receipt.planGraphId, "pg_abc");
  assert.equal(receipt.graphVersion, 1);
  assert.equal(receipt.receiptKind, "tool");
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.duration, 1500);
  assert.ok(receipt.outputRef);
  assert.equal(receipt.error, undefined);
});

test("execution-receipt: createNodeAttemptReceipt creates failed receipt with error", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_fail",
    nodeRunId: "nrun_fail",
    harnessRunId: "hrun_fail",
    planGraphId: "pg_fail",
    graphVersion: 2,
    receiptKind: "llm",
    status: "failed",
    duration: 3000,
    errorDetail: "Model API returned rate limit error",
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "API rate limit exceeded",
      retryable: true,
    },
  });

  assert.equal(receipt.status, "failed");
  assert.ok(receipt.error);
  assert.equal(receipt.error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(receipt.error.retryable, true);
});

test("execution-receipt: createNodeAttemptReceipt creates partial receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_partial",
    nodeRunId: "nrun_partial",
    harnessRunId: "hrun_partial",
    planGraphId: "pg_partial",
    graphVersion: 1,
    receiptKind: "subgraph",
    status: "partial",
    duration: 5000,
    errorDetail: "Some nodes succeeded, others failed",
  });

  assert.equal(receipt.status, "partial");
  assert.equal(receipt.receiptKind, "subgraph");
});

test("execution-receipt: createNodeAttemptReceipt creates blocked receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_blocked",
    nodeRunId: "nrun_blocked",
    harnessRunId: "hrun_blocked",
    planGraphId: "pg_blocked",
    graphVersion: 1,
    receiptKind: "hitl",
    status: "blocked",
    duration: 0,
    errorDetail: "Awaiting human approval",
    sideEffectRefs: ["seffect_1", "seffect_2"],
    budgetSettlementRefs: [],
    evidenceRefs: [
      { artifactId: "evidence_1", uri: "artifact://evidence_1" },
    ],
  });

  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.sideEffectRefs.length, 2);
  assert.equal(receipt.budgetSettlementRefs.length, 0);
  assert.equal(receipt.evidenceRefs.length, 1);
});

test("execution-receipt: createNodeAttemptReceipt defaults optional arrays", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_defaults",
    nodeRunId: "nrun_defaults",
    harnessRunId: "hrun_defaults",
    planGraphId: "pg_defaults",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
    errorDetail: "",
  });

  assert.deepEqual(receipt.sideEffectRefs, []);
  assert.deepEqual(receipt.budgetSettlementRefs, []);
  assert.deepEqual(receipt.evidenceRefs, []);
});

test("execution-receipt: createNodeAttemptReceipt accepts custom producedAt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_time",
    nodeRunId: "nrun_time",
    harnessRunId: "hrun_time",
    planGraphId: "pg_time",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 200,
    errorDetail: "",
    producedAt: "2026-05-01T12:30:00.000Z",
  });

  assert.equal(receipt.producedAt, "2026-05-01T12:30:00.000Z");
});

// =============================================================================
// NodeAttemptReceipt Status Union Tests
// =============================================================================

test("execution-receipt: NodeAttemptReceipt status union contains expected values", () => {
  const statuses: Array<NodeAttemptReceipt["status"]> = [
    "succeeded",
    "failed",
    "partial",
    "blocked",
  ];

  for (const status of statuses) {
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: `nattempt_${status}`,
      nodeRunId: "nrun_test",
      harnessRunId: "hrun_test",
      planGraphId: "pg_test",
      graphVersion: 1,
      receiptKind: "tool",
      status,
      duration: 100,
      errorDetail: status === "succeeded" ? "" : `Error for ${status}`,
      error: status === "failed" || status === "blocked" ? {
        code: "ERR_TEST",
        message: "Test error",
        retryable: false,
      } : undefined,
    });
    assert.equal(receipt.status, status);
  }
});

test("execution-receipt: NodeAttemptReceipt receiptKind union contains expected values", () => {
  const kinds: Array<NodeAttemptReceipt["receiptKind"]> = [
    "tool",
    "llm",
    "hitl",
    "subgraph",
    "evaluator",
    "router",
  ];

  for (const kind of kinds) {
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: `nattempt_${kind}`,
      nodeRunId: "nrun_kind",
      harnessRunId: "hrun_kind",
      planGraphId: "pg_kind",
      graphVersion: 1,
      receiptKind: kind,
      status: "succeeded",
      duration: 100,
      errorDetail: "",
    });
    assert.equal(receipt.receiptKind, kind);
  }
});

// =============================================================================
// AppErrorRef Structure Tests
// =============================================================================

test("execution-receipt: AppErrorRef has correct shape", () => {
  const errorRef: AppErrorRef = {
    code: "ERR_NETWORK_TIMEOUT",
    message: "Network request timed out",
    retryable: true,
  };

  assert.equal(errorRef.code, "ERR_NETWORK_TIMEOUT");
  assert.equal(errorRef.message, "Network request timed out");
  assert.equal(errorRef.retryable, true);
});

test("execution-receipt: AppErrorRef can be non-retryable", () => {
  const errorRef: AppErrorRef = {
    code: "ERR_AUTH_FAILED",
    message: "Authentication failed",
    retryable: false,
  };

  assert.equal(errorRef.retryable, false);
});

// =============================================================================
// Cross-Reference Tests
// =============================================================================

test("execution-receipt: NodeAttemptReceipt references are consistent", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_consistent",
    nodeRunId: "nrun_consistent",
    harnessRunId: "hrun_consistent",
    planGraphId: "pg_consistent",
    graphVersion: 3,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1000,
    errorDetail: "",
  });

  // All IDs should be present and non-empty
  assert.ok(receipt.nodeAttemptReceiptId);
  assert.ok(receipt.nodeAttemptId);
  assert.ok(receipt.nodeRunId);
  assert.ok(receipt.harnessRunId);
  assert.ok(receipt.planGraphId);
  assert.ok(receipt.graphVersion > 0);
});
