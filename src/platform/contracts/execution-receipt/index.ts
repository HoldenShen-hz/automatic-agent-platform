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
process.emitWarning(
  "[DEPRECATED] execution-receipt/ is deprecated. " +
  "Use NodeAttemptReceipt from src/platform/contracts/executable-contracts instead. " +
  "See: https://docs.example.com/platform/contracts#execution-receipt-migration",
  { code: "AA_LEGACY_EXECUTION_RECEIPT" },
);

export type ExecutionReceiptStatus = "accepted" | "started" | "completed" | "failed" | "cancelled";

/**
 * @deprecated ExecutionReceipt is deprecated per §4.5. Use NodeAttemptReceipt from executable-contracts instead.
 * This type is retained for legacy adapter compatibility only.
 */
export interface ExecutionReceipt {
  receiptId: string;
  planId: string;
  harnessRunId: string | null;
  planGraphId: string | null;
  nodeRunId: string | null;
  attemptId: string | null;
  /** @deprecated legacy execution projection; use nodeRunId */
  stepId?: string | null;
  status: ExecutionReceiptStatus;
  workerId: string | null;
  taskId: string;
  tenantId: string | null;
  resultRef: string | null;
  errorCode: string | null;
  createdAt: string;
}

type LegacyExecutionReceiptInput = Pick<ExecutionReceipt, "planId" | "status" | "taskId"> &
  Partial<
    Pick<
      ExecutionReceipt,
      "harnessRunId" | "planGraphId" | "nodeRunId" | "attemptId" | "stepId" | "workerId" | "tenantId" | "resultRef" | "errorCode"
    >
  > & {
    receiptId?: string;
    createdAt?: string;
    durationMs?: number;
    errorDetail?: string;
  };

/**
 * @deprecated createExecutionReceipt is deprecated per §4.5.
 * Use NodeAttemptReceipt from executable-contracts instead.
 */
export function createExecutionReceipt(input: LegacyExecutionReceiptInput): ExecutionReceipt {
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
