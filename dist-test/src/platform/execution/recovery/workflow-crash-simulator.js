/**
 * @fileoverview Workflow Crash Simulator - Injects artificial crashes for stability testing.
 *
 * Provides controlled crash injection for workflow execution testing. This is used
 * exclusively in test/development environments to verify that the system correctly
 * handles and recovers from unexpected workflow failures.
 *
 * Crash points:
 * - step_started: Crash immediately when a workflow step begins
 * - tool_completed: Crash after a tool execution completes
 * - before_commit: Crash just before the workflow state is committed
 *
 * @see Stable Release Gate: stable-release-gate.ts
 */
import { InternalAppError } from "../../contracts/errors.js";
/**
 * Error thrown when an injected workflow crash fires.
 *
 * Extends InternalAppError to indicate this is an expected, controlled
 * error during testing, not a genuine runtime failure.
 */
export class InjectedWorkflowCrashError extends InternalAppError {
    taskId;
    executionId;
    point;
    workflowId;
    stepId;
    constructor(context) {
        super("workflow.crash_injected", `workflow.crash_injected:${context.point}:${context.stepId}`, {
            retryable: false,
            details: { ...context },
        });
        this.name = "InjectedWorkflowCrashError";
        this.point = context.point;
        this.taskId = context.taskId;
        this.executionId = context.executionId;
        this.workflowId = context.workflowId;
        this.stepId = context.stepId;
    }
}
/**
 * Conditionally injects a workflow crash based on injection configuration.
 *
 * Checks if the crash point matches and if the step ID matches (if specified).
 * If conditions are met, throws InjectedWorkflowCrashError to simulate a crash.
 */
export function maybeInjectWorkflowCrash(injection, context) {
    if (!injection) {
        return;
    }
    if (injection.point !== context.point) {
        return;
    }
    if (injection.stepId != null && injection.stepId !== context.stepId) {
        return;
    }
    throw new InjectedWorkflowCrashError(context);
}
/** Type guard to identify injected workflow crash errors. */
export function isInjectedWorkflowCrashError(error) {
    return error instanceof InjectedWorkflowCrashError;
}
//# sourceMappingURL=workflow-crash-simulator.js.map