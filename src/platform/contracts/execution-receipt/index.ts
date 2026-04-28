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
  void input;
  void normalizeNullable;
  void newId;
  void nowIso;
  throw new ValidationError(
    "execution_receipt.legacy_contract_forbidden",
    "ExecutionReceipt is deprecated. Use NodeAttemptReceipt from executable-contracts instead.",
  );
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value == null || value.trim().length === 0 ? null : value;
}
