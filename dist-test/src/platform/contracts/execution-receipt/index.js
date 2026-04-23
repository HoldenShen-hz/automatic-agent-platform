import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createExecutionReceipt(input) {
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
function normalizeNullable(value) {
    return value == null || value.trim().length === 0 ? null : value;
}
//# sourceMappingURL=index.js.map