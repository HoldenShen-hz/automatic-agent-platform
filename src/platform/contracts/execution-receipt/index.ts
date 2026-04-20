import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

export type ExecutionReceiptStatus = "accepted" | "started" | "completed" | "failed" | "cancelled";

export interface ExecutionReceipt {
  receiptId: string;
  planId: string;
  stepId: string | null;
  status: ExecutionReceiptStatus;
  workerId: string | null;
  taskId: string;
  tenantId: string | null;
  resultRef: string | null;
  errorCode: string | null;
  createdAt: string;
}

export function createExecutionReceipt(input: Omit<ExecutionReceipt, "receiptId" | "createdAt"> & {
  receiptId?: string;
  createdAt?: string;
}): ExecutionReceipt {
  if (input.taskId.trim().length === 0 || input.planId.trim().length === 0) {
    throw new ValidationError("execution_receipt.task_and_plan_required", "Execution receipt requires task and plan identifiers.");
  }
  if (input.status === "completed" && normalizeNullable(input.resultRef) == null) {
    throw new ValidationError("execution_receipt.result_ref_required", "Completed execution receipts require a result reference.");
  }
  if (input.status === "failed" && normalizeNullable(input.errorCode) == null) {
    throw new ValidationError("execution_receipt.error_code_required", "Failed execution receipts require an error code.");
  }
  return {
    receiptId: input.receiptId ?? newId("receipt"),
    planId: input.planId,
    stepId: normalizeNullable(input.stepId),
    status: input.status,
    workerId: normalizeNullable(input.workerId),
    taskId: input.taskId,
    tenantId: normalizeNullable(input.tenantId),
    resultRef: normalizeNullable(input.resultRef),
    errorCode: normalizeNullable(input.errorCode),
    createdAt: input.createdAt ?? nowIso(),
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}
