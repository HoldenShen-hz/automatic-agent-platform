import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import { assertNotDeprecated } from "../index.js";

// =============================================================================
// Re-export canonical NodeAttemptReceipt from executable-contracts
// =============================================================================
export {
  type NodeAttemptReceipt,
  type AppErrorRef,
  createNodeAttemptReceipt,
} from "../executable-contracts/index.js";

// Runtime warning for imports from legacy contract path
console.warn(
  "[DEPRECATED] execution-receipt/ is deprecated. " +
  "Use NodeAttemptReceipt from src/platform/contracts/executable-contracts instead. " +
  "See: https://docs.example.com/platform/contracts#execution-receipt-migration",
);

export type ExecutionReceiptStatus = "accepted" | "started" | "completed" | "failed" | "cancelled";

/**
 * @deprecated ExecutionReceipt is deprecated per §4.5. Use NodeAttemptReceipt from executable-contracts instead.
 * This type is retained for legacy adapter compatibility only.
 */
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

/**
 * @deprecated createExecutionReceipt is deprecated per §4.5.
 * Use NodeAttemptReceipt from executable-contracts instead.
 */
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
