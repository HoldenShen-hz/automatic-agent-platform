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
export declare function createExecutionReceipt(input: Omit<ExecutionReceipt, "receiptId" | "createdAt"> & {
    receiptId?: string;
    createdAt?: string;
}): ExecutionReceipt;
