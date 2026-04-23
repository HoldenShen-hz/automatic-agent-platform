import type { TaskSnapshot } from "../../contracts/types/domain.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";
import { getWorkflowDefinition } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
export declare function workflowTerminalForTask(status: TaskTerminalStatus): "completed" | "failed" | "cancelled";
export declare function sessionTerminalForTask(status: TaskTerminalStatus): "completed" | "failed" | "cancelled";
export declare function executionTerminalForTask(status: TaskTerminalStatus): "succeeded" | "failed" | "cancelled";
export declare function normalizeInputJson(inputJson: string): string;
export declare function throwTakeoverStorageError(code: string, details?: Record<string, unknown>): never;
export declare function throwTakeoverWorkflowError(code: string, details?: Record<string, unknown>): never;
export declare function parseOutputs(outputsJson: string): Record<string, unknown>;
export declare function normalizeJson(rawJson: string, errorCode: string): string;
export declare function resolveManualStepOutputSummary(stepId: string, output: unknown): string;
export declare function resolveWorkflowStepTarget(workflowId: string, currentStepIndex: number, input: {
    stepId?: string;
    stepIndex?: number;
}): {
    step: NonNullable<ReturnType<typeof getWorkflowDefinition>>["steps"][number];
    stepIndex: number;
};
export declare function serializeSnapshot(snapshot: TaskSnapshot): Record<string, unknown>;
